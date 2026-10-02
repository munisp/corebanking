// Wave-12 B5-P0-D3: Permify authorization guard for mutating money/ledger
// handlers. Modeled on the verified integration in
// services/permify-authz-go/main.go:440 (check call) and :470 (30s decision
// cache). Composable: the guard wraps individual mutating route registrations
// and runs AFTER the wave-11 jwtAuthMiddleware, which stamps X-User-Id /
// X-Tenant-ID from verified JWT claims. Fail-closed: when Permify is
// unreachable the mutation is rejected (502); denials yield 403; read-only
// methods pass through untouched.
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
					"id", "account_id", "accountId", "transfer_id", "transferId",
					"lien_id", "lienId", "entry_id", "entryId", "journal_id", "journalId",
					"settlement_id", "settlementId", "batch_id", "batchId",
					"facility_id", "facilityId", "case_id", "caseId",
					"cheque_id", "chequeId", "terminal_id", "terminalId",
					"from_account", "from_account_id", "fromAccountId",
				} {
					if v, ok := fields[k].(string); ok && v != "" {
						return v
					}
				}
			}
		}
	}
	q := r.URL.Query()
	for _, k := range []string{"id", "account_id", "accountId", "transfer_id"} {
		if v := q.Get(k); v != "" {
			return v
		}
	}
	return "scope:" + strings.TrimPrefix(r.URL.Path, "/")
}

// permifyAuthzSubject resolves the authorization subject from the identity the
// wave-11 jwtAuthMiddleware stamped onto the request (X-User-Id / X-Tenant-ID
// from verified JWT claims). The tenant falls back to the fleet default tenant
// only when the claim header is absent.
func permifyAuthzSubject(r *http.Request) (tenantID, userID string, ok bool) {
	userID = r.Header.Get("X-User-Id")
	tenantID = r.Header.Get("X-Tenant-ID")
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
// check. It runs AFTER authentication (wave-11 jwtAuthMiddleware) and only
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
