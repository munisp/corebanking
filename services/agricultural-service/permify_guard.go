// Wave-12 B5-P1-D-E: Permify authorization guard. Mirrors the landed
// wave-12 B5-P0-D1/D3 money/ledger guard
// (services/tb-regulatory-ledger-go/permify_authz.go) and the wave-12
// B5-P1-D-A core-domain guard (services/approval-workflow-go/permify_guard.go):
// real POST {PERMIFY_URL}/v1/tenants/{tenant}/permissions/check with a 30s
// in-process decision cache; errors are never cached; fail-closed (Permify
// unreachable -> 502, denied -> 403). Composable: the guard wraps individual
// route registrations and runs AFTER the wave-11 JWT middleware, which stamps
// X-User-Id / X-Tenant-ID from verified JWT claims (or leaves the verified
// claims in the "jwt_claims" request context). Read-only methods pass through
// untouched; only mutating methods (POST/PUT/PATCH/DELETE) are enforced.
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

var permifyAuthzBaseURL = func() string {
	u := strings.TrimRight(os.Getenv("PERMIFY_URL"), "/")
	if u == "" {
		u = "http://permify:3476"
	}
	return u
}()

var permifyAuthzHTTPClient = &http.Client{Timeout: 5 * time.Second}

type permifyAuthzRef struct {
	Type string `json:"type"`
	ID   string `json:"id"`
}

type permifyAuthzCheckRequest struct {
	Metadata   map[string]interface{} `json:"metadata"`
	Entity     permifyAuthzRef        `json:"entity"`
	Permission string                 `json:"permission"`
	Subject    permifyAuthzRef        `json:"subject"`
}

type permifyAuthzCheckResponse struct {
	Can string `json:"can"`
}

// Decision cache — mirrors services/permify-authz-go/main.go:470: short-TTL
// cache of completed Permify decisions; errors are never cached so the caller
// keeps fail-closed behavior.
type permifyAuthzDecisionEntry struct {
	allowed   bool
	expiresAt time.Time
}

const (
	permifyAuthzDecisionCacheTTL        = 30 * time.Second
	permifyAuthzDecisionCacheMaxEntries = 10000
)

var (
	permifyAuthzDecisionCache   = make(map[string]permifyAuthzDecisionEntry)
	permifyAuthzDecisionCacheMu sync.RWMutex
)

// permifyAuthzCheck performs a real Permify permissions/check call with a 30s
// decision cache in front of it.
func permifyAuthzCheck(tenantID, userID, entityType, entityID, permission string) (bool, error) {
	key := tenantID + "|" + userID + "|" + entityType + "|" + entityID + "|" + permission
	now := time.Now()
	permifyAuthzDecisionCacheMu.RLock()
	e, ok := permifyAuthzDecisionCache[key]
	permifyAuthzDecisionCacheMu.RUnlock()
	if ok && now.Before(e.expiresAt) {
		return e.allowed, nil
	}

	payload, err := json.Marshal(permifyAuthzCheckRequest{
		Metadata:   map[string]interface{}{"schema_version": "", "snap_token": "", "depth": 20},
		Entity:     permifyAuthzRef{Type: entityType, ID: entityID},
		Permission: permission,
		Subject:    permifyAuthzRef{Type: "user", ID: userID},
	})
	if err != nil {
		return false, err
	}
	resp, err := permifyAuthzHTTPClient.Post(
		fmt.Sprintf("%s/v1/tenants/%s/permissions/check", permifyAuthzBaseURL, tenantID),
		"application/json", bytes.NewReader(payload))
	if err != nil {
		return false, fmt.Errorf("permify unreachable: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return false, fmt.Errorf("permify returned %d", resp.StatusCode)
	}
	var result permifyAuthzCheckResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, err
	}
	allowed := result.Can == "CHECK_RESULT_ALLOWED"

	permifyAuthzDecisionCacheMu.Lock()
	if len(permifyAuthzDecisionCache) >= permifyAuthzDecisionCacheMaxEntries {
		for k, v := range permifyAuthzDecisionCache { // evict expired first
			if now.After(v.expiresAt) {
				delete(permifyAuthzDecisionCache, k)
			}
		}
		if len(permifyAuthzDecisionCache) >= permifyAuthzDecisionCacheMaxEntries { // still full: drop one
			for k := range permifyAuthzDecisionCache {
				delete(permifyAuthzDecisionCache, k)
				break
			}
		}
	}
	permifyAuthzDecisionCache[key] = permifyAuthzDecisionEntry{allowed: allowed, expiresAt: now.Add(permifyAuthzDecisionCacheTTL)}
	permifyAuthzDecisionCacheMu.Unlock()
	return allowed, nil
}

// permifyAuthzEntityID derives the resource id for the authorization decision
// from the request: well-known JSON body id fields first (the body is restored
// for the downstream handler), then common query parameters, then a stable
// per-route scope so the decision is still real and tenant-scoped when no
// domain id is present.
func permifyAuthzEntityID(r *http.Request) string {
	if r.Body != nil && (r.Method == http.MethodPost || r.Method == http.MethodPut || r.Method == http.MethodPatch) {
		body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
		r.Body.Close()
		r.Body = io.NopCloser(bytes.NewReader(body))
		if err == nil && len(body) > 0 {
			var fields map[string]interface{}
			if json.Unmarshal(body, &fields) == nil {
				for _, k := range []string{
					"id", "record_id", "recordId", "entity_id", "entityId",
					"account_id", "accountId", "customer_id", "customerId",
					"tenant_id", "tenantId", "user_id", "userId",
					"farm_id", "farmId", "farmer_id", "farmerId",
					"loan_id", "loanId", "case_id", "caseId",
					"session_id", "sessionId", "key_id", "keyId",
					"request_id", "requestId", "resource_id", "resourceId",
				} {
					if v, ok := fields[k].(string); ok && v != "" {
						return v
					}
				}
			}
		}
	}
	q := r.URL.Query()
	for _, k := range []string{"id", "record_id", "recordId", "farm_id", "farmer_id", "loan_id"} {
		if v := q.Get(k); v != "" {
			return v
		}
	}
	return "scope:" + strings.TrimPrefix(r.URL.Path, "/")
}

// permifyAuthzSubject resolves the authorization subject from the identity the
// wave-11 JWT middleware established: the X-User-Id / X-Tenant-ID headers it
// stamps from verified claims, falling back to the verified claims it leaves
// in the "jwt_claims" request context. The tenant falls back to the fleet
// default tenant only when neither source carries one.
func permifyAuthzSubject(r *http.Request) (tenantID, userID string, ok bool) {
	userID = r.Header.Get("X-User-Id")
	tenantID = r.Header.Get("X-Tenant-ID")
	if claims, cok := r.Context().Value("jwt_claims").(map[string]interface{}); cok {
		if userID == "" {
			for _, k := range []string{"sub", "user_id", "userId", "preferred_username", "email"} {
				if v, sok := claims[k].(string); sok && v != "" {
					userID = v
					break
				}
			}
		}
		if tenantID == "" {
			for _, k := range []string{"tenant_id", "tenantId", "tenant"} {
				if v, sok := claims[k].(string); sok && v != "" {
					tenantID = v
					break
				}
			}
		}
	}
	if tenantID == "" {
		tenantID = os.Getenv("PERMIFY_DEFAULT_TENANT")
	}
	if tenantID == "" {
		tenantID = "bpmgd"
	}
	if userID == "" {
		return "", "", false
	}
	return tenantID, userID, true
}

func permifyAuthzIsMutating(method string) bool {
	switch method {
	case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		return true
	}
	return false
}

// permifyAuthzGuard wraps a route handler with a real Permify permission
// check. It runs AFTER authentication (wave-11 JWT middleware) and only
// enforces on mutating methods; read-only methods pass through.
func permifyAuthzGuard(entityType, permission string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !permifyAuthzIsMutating(r.Method) {
			next(w, r)
			return
		}
		tenantID, userID, ok := permifyAuthzSubject(r)
		if !ok {
			http.Error(w, `{"error":"missing authenticated subject"}`, http.StatusForbidden)
			return
		}
		allowed, err := permifyAuthzCheck(tenantID, userID, entityType, permifyAuthzEntityID(r), permission)
		if err != nil {
			// Fail-closed: Permify unreachable -> the mutation is rejected.
			http.Error(w, `{"error":"authorization service unavailable"}`, http.StatusBadGateway)
			return
		}
		if !allowed {
			http.Error(w, `{"error":"forbidden: missing permission `+entityType+`:`+permission+`"}`, http.StatusForbidden)
			return
		}
		next(w, r)
	}
}

// --- Router-level variant (W12-B5-P1-D-E, agricultural-service) ---
// agricultural-service registers 350+ endpoints across 15 sub-service
// modules (RegisterRoutes in store-adjacent files owned by other batches), so
// the canonical per-route wrap is applied once at the gorilla/mux router
// instead: same check, same cache, same fail-closed semantics, entity and
// permission derived from the request path. Runs AFTER jwtAuthMiddleware
// (server Handler chain), which stamps "jwt_claims" on the request context.
func permifyAuthzMuxMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !permifyAuthzIsMutating(r.Method) {
			next.ServeHTTP(w, r)
			return
		}
		entityType, permission := permifyAuthzRoute(r.URL.Path, r.Method)
		tenantID, userID, ok := permifyAuthzSubject(r)
		if !ok {
			http.Error(w, `{"error":"missing authenticated subject"}`, http.StatusForbidden)
			return
		}
		allowed, err := permifyAuthzCheck(tenantID, userID, entityType, permifyAuthzEntityID(r), permission)
		if err != nil {
			http.Error(w, `{"error":"authorization service unavailable"}`, http.StatusBadGateway)
			return
		}
		if !allowed {
			http.Error(w, `{"error":"forbidden: missing permission `+entityType+`:`+permission+`"}`, http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// permifyAuthzRoute maps an agricultural-service route to its Permify entity
// and permission: the domain noun after the api/v1/agriculture prefix is the
// entity (singularized for the well-known domain nouns); a trailing action
// verb is the permission, otherwise the HTTP method decides.
func permifyAuthzRoute(path, method string) (entityType, permission string) {
	segs := strings.Split(strings.Trim(path, "/"), "/")
	entityType = "agri_domain"
	for i, s := range segs {
		if s == "v1" && i+1 < len(segs) {
			noun := segs[i+1]
			if noun == "agriculture" && i+2 < len(segs) {
				noun = segs[i+2]
			}
			entityType = permifyAuthzEntityForNoun(noun)
			break
		}
	}
	last := ""
	if len(segs) > 0 {
		last = permifyAuthzSanitize(segs[len(segs)-1])
	}
	switch last {
	case "apply", "approve", "disburse", "repay", "assess", "verify", "quote",
		"purchase", "enroll", "redeem", "submit", "process", "validate", "score",
		"notify", "check", "register", "claim", "trigger", "onboard", "configure":
		permission = last
	default:
		switch method {
		case http.MethodPost:
			permission = "create"
		case http.MethodPut, http.MethodPatch:
			permission = "update"
		case http.MethodDelete:
			permission = "delete"
		}
	}
	return entityType, permission
}

func permifyAuthzSanitize(s string) string {
	s = strings.ToLower(strings.ReplaceAll(s, "-", "_"))
	var b strings.Builder
	for _, c := range s {
		if (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '_' {
			b.WriteRune(c)
		}
	}
	return b.String()
}

func permifyAuthzEntityForNoun(noun string) string {
	switch permifyAuthzSanitize(noun) {
	case "farmers":
		return "farmer"
	case "farms":
		return "farm"
	case "crops":
		return "crop_cycle"
	case "livestock":
		return "livestock"
	case "loans":
		return "agri_loan"
	case "livestock_loans":
		return "livestock_loan"
	case "cooperatives":
		return "cooperative"
	case "off_takers":
		return "offtaker_contract"
	case "input_suppliers":
		return "input_supplier"
	case "partners":
		return "agri_partner"
	case "programs":
		return "agri_program"
	case "insurance":
		return "insurance_policy"
	case "weather":
		return "weather_reading"
	case "prices":
		return "commodity_price"
	case "analytics":
		return "agri_analytics"
	case "satellite", "ndvi", "scans":
		return "satellite_scan"
	case "ussd":
		return "ussd_session"
	default:
		return permifyAuthzSanitize(noun)
	}
}
