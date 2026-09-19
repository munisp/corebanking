package main

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	_ "github.com/lib/pq"
)

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

type Consent struct {
	ID             string   `json:"id"`
	CustomerID     string   `json:"customerId"`
	CustomerName   string   `json:"customerName"`
	TPPID          string   `json:"tppId"`
	TPPName        string   `json:"tppName"`
	ConsentType    string   `json:"consentType"` // ais, pis, cbpii (confirmation of funds)
	Permissions    []string `json:"permissions"`
	Status         string   `json:"status"` // awaiting_authorization, authorized, rejected, revoked, expired
	CreatedAt      string   `json:"createdAt"`
	ExpiresAt      string   `json:"expiresAt"`
	LastAccessedAt string   `json:"lastAccessedAt,omitempty"`
	AccessCount    int      `json:"accessCount"`
	Accounts       []string `json:"accounts"`
}

type TPP struct {
	ID             string   `json:"id"`
	Name           string   `json:"tppName"`
	RegistrationNo string   `json:"registrationNo"`
	Role           string   `json:"role"` // aisp, pisp, cbpii, aspsp
	Status         string   `json:"status"`
	CertIssuer     string   `json:"certIssuer"`
	CertExpiry     string   `json:"certExpiry"`
	RedirectURIs   []string `json:"redirectUris"`
	ContactEmail   string   `json:"contactEmail"`
	APIVersions    []string `json:"apiVersions"`
	ConsentCount   int      `json:"consentCount"`
}

type APIEndpoint struct {
	ID          string `json:"id"`
	Path        string `json:"path"`
	Method      string `json:"method"`
	Category    string `json:"category"` // accounts, payments, funds, events
	Version     string `json:"version"`
	Description string `json:"description"`
	RateLimit   int    `json:"rateLimit"`
	AuthType    string `json:"authType"`
}

type ConsentRequest struct {
	CustomerID  string   `json:"customerId"`
	TPPID       string   `json:"tppId"`
	ConsentType string   `json:"consentType"`
	Permissions []string `json:"permissions"`
	Accounts    []string `json:"accounts"`
}

var (
	tpps      []TPP
	endpoints []APIEndpoint
	mu        sync.Mutex
	// CP-09: Postgres consent store (durable, shared across replicas).
	consentDB *sql.DB
)

// CP-09: initConsentStore creates the durable consent table. Called at boot;
// failure is logged and consent endpoints fail closed with 503.
func initConsentStore() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Printf("[open-banking-go] DATABASE_URL not set — consent store unavailable (endpoints will 503)")
		return
	}
	var err error
	consentDB, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[open-banking-go] consent DB open failed: %v", err)
		consentDB = nil
		return
	}
	consentDB.SetMaxOpenConns(10)
	if _, err := consentDB.Exec(`CREATE TABLE IF NOT EXISTS ob_consents (
		id TEXT PRIMARY KEY,
		customer_id TEXT NOT NULL,
		customer_name TEXT,
		tpp_id TEXT NOT NULL,
		tpp_name TEXT,
		consent_type TEXT NOT NULL CHECK (consent_type IN ('ais','pis','cbpii')),
		permissions JSONB NOT NULL DEFAULT '[]',
		accounts JSONB NOT NULL DEFAULT '[]',
		status TEXT NOT NULL DEFAULT 'awaiting_authorization'
			CHECK (status IN ('awaiting_authorization','authorized','rejected','revoked','expired')),
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		expires_at TIMESTAMPTZ NOT NULL,
		last_accessed_at TIMESTAMPTZ,
		access_count INT NOT NULL DEFAULT 0,
		revoked_at TIMESTAMPTZ
	)`); err != nil {
		log.Printf("[open-banking-go] ob_consents schema init failed: %v", err)
	}
	_, _ = consentDB.Exec(`CREATE INDEX IF NOT EXISTS idx_ob_consents_customer ON ob_consents(customer_id)`)
	_, _ = consentDB.Exec(`CREATE INDEX IF NOT EXISTS idx_ob_consents_tpp ON ob_consents(tpp_id, status)`)
	// Lazily expire consents past their expiry on boot.
	_, _ = consentDB.Exec(`UPDATE ob_consents SET status='expired' WHERE status='authorized' AND expires_at < NOW()`)
	log.Printf("[open-banking-go] consent store ready")
}

func init() {
	tpps = []TPP{
		{"TPP-001", "Paystack (Stripe)", "CBN/TPP/2025/001", "pisp", "active", "CBN Certificate Authority", "2027-12-31", []string{"https://paystack.com/callback"}, "api@paystack.com", []string{"v3.1", "v3.2"}, 12500},
		{"TPP-002", "Flutterwave", "CBN/TPP/2025/002", "pisp", "active", "CBN Certificate Authority", "2027-06-30", []string{"https://flutterwave.com/callback"}, "api@flutterwave.com", []string{"v3.1"}, 8200},
		{"TPP-003", "Mono (YC)", "CBN/TPP/2025/003", "aisp", "active", "CBN Certificate Authority", "2027-09-30", []string{"https://mono.co/callback"}, "api@mono.co", []string{"v3.1", "v3.2"}, 5600},
		{"TPP-004", "Okra", "CBN/TPP/2025/004", "aisp", "active", "CBN Certificate Authority", "2028-03-31", []string{"https://okra.ng/callback"}, "api@okra.ng", []string{"v3.1"}, 3200},
		{"TPP-005", "Stitch", "CBN/TPP/2025/005", "cbpii", "active", "CBN Certificate Authority", "2027-12-31", []string{"https://stitch.money/callback"}, "api@stitch.money", []string{"v3.1"}, 1500},
		{"TPP-006", "Carbon (Paylater)", "CBN/TPP/2025/006", "pisp", "suspended", "CBN Certificate Authority", "2026-06-30", []string{"https://carbon.ng/callback"}, "api@carbon.ng", []string{"v3.1"}, 450},
	}

	// CP-09: the six seeded in-memory consents (Dangote/MTN/Access Corp/BUA/
	// Retail/Shell) were fabricated and lived only in process memory — deleted.
	// Consents now live in Postgres (ob_consents) and are enforced on data
	// endpoints. The TPP registry seed above is retained as the static
	// accreditation list used for consent-creation validation.
	endpoints = []APIEndpoint{
		{"API-001", "/open-banking/v3.1/accounts", "GET", "accounts", "v3.1", "Get list of accounts", 1000, "oauth2_ais"},
		{"API-002", "/open-banking/v3.1/accounts/{accountId}", "GET", "accounts", "v3.1", "Get account details", 1000, "oauth2_ais"},
		{"API-003", "/open-banking/v3.1/accounts/{accountId}/balances", "GET", "accounts", "v3.1", "Get account balances", 2000, "oauth2_ais"},
		{"API-004", "/open-banking/v3.1/accounts/{accountId}/transactions", "GET", "accounts", "v3.1", "Get account transactions", 500, "oauth2_ais"},
		{"API-005", "/open-banking/v3.1/accounts/{accountId}/statements", "GET", "accounts", "v3.1", "Get account statements", 200, "oauth2_ais"},
		{"API-006", "/open-banking/v3.1/payments/domestic-payments", "POST", "payments", "v3.1", "Create domestic payment", 500, "oauth2_pis"},
		{"API-007", "/open-banking/v3.1/payments/international-payments", "POST", "payments", "v3.1", "Create international payment", 200, "oauth2_pis"},
		{"API-008", "/open-banking/v3.1/funds-confirmation", "POST", "funds", "v3.1", "Confirm availability of funds", 2000, "oauth2_cbpii"},
		{"API-009", "/open-banking/v3.1/event-subscriptions", "POST", "events", "v3.1", "Subscribe to account events", 100, "oauth2_ais"},
		{"API-010", "/open-banking/v3.1/payments/standing-orders", "POST", "payments", "v3.1", "Create standing order", 200, "oauth2_pis"},
	}
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// ── MIDDLEWARE: JWT Validation (JWKS / RS256, fail-closed) ──────────────────

type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func jwtRealmURL() string {
	return getEnv("KEYCLOAK_REALM_URL", "http://keycloak:8080/realms/54bank")
}

func fetchJWKS(realmURL string) {
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(realmURL + "/protocol/openid-connect/certs")
	if err != nil {
		log.Printf("[middleware] JWKS fetch failed: %v", err)
		return
	}
	defer resp.Body.Close()
	var jwks struct {
		Keys []struct {
			Kid string `json:"kid"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		log.Printf("[middleware] JWKS decode failed: %v", err)
		return
	}
	jwtCache.mu.Lock()
	defer jwtCache.mu.Unlock()
	for _, k := range jwks.Keys {
		nBytes, _ := base64.RawURLEncoding.DecodeString(k.N)
		eBytes, _ := base64.RawURLEncoding.DecodeString(k.E)
		if len(eBytes) == 0 {
			continue
		}
		var eInt int
		for _, b := range eBytes {
			eInt = eInt<<8 | int(b)
		}
		jwtCache.keys[k.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(nBytes), E: eInt}
	}
	jwtCache.updated = time.Now()
	log.Printf("[middleware] JWKS refreshed: %d keys", len(jwtCache.keys))
}

func startJWKSRefresh() {
	go fetchJWKS(jwtRealmURL())
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			fetchJWKS(jwtRealmURL())
		}
	}()
}

// tenantFromClaims derives the tenant ONLY from verified token claims — never
// from caller-supplied headers or parameters.
func tenantFromClaims(claims map[string]interface{}) string {
	for _, k := range []string{"tenant_id", "tenantId", "tenant"} {
		if s, ok := claims[k].(string); ok && s != "" {
			return s
		}
	}
	return ""
}

// jwtAuthMiddleware validates Bearer tokens against the Keycloak JWKS endpoint
// (RS256 signature + expiry). Fail-closed: requests without a verifiable token
// get 401. Only health/metrics probes are exempt. Tenant identity is derived
// from the verified claims and stamped onto X-Tenant-ID, overwriting any
// caller-supplied value.
func jwtAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if p == "/healthz" || p == "/readyz" || p == "/livez" || p == "/metrics" || p == "/health" {
			next.ServeHTTP(w, r)
			return
		}
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"unauthorized","service":%q}`, "open-banking-go")
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"malformed token","service":%q}`, "open-banking-go")
			return
		}
		headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
		if err != nil {
			http.Error(w, `{"error":"invalid token header"}`, http.StatusUnauthorized)
			return
		}
		var header struct {
			Kid string `json:"kid"`
			Alg string `json:"alg"`
		}
		json.Unmarshal(headerBytes, &header)
		if header.Alg != "RS256" {
			http.Error(w, `{"error":"unsupported token algorithm"}`, http.StatusUnauthorized)
			return
		}

		jwtCache.mu.RLock()
		pub, ok := jwtCache.keys[header.Kid]
		jwtCache.mu.RUnlock()
		if !ok {
			fetchJWKS(jwtRealmURL())
			jwtCache.mu.RLock()
			pub, ok = jwtCache.keys[header.Kid]
			jwtCache.mu.RUnlock()
			if !ok {
				http.Error(w, `{"error":"unknown signing key"}`, http.StatusUnauthorized)
				return
			}
		}

		sigBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
		if err != nil {
			http.Error(w, `{"error":"invalid signature encoding"}`, http.StatusUnauthorized)
			return
		}
		hash := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
		if err := rsa.VerifyPKCS1v15(pub, crypto.SHA256, hash[:], sigBytes); err != nil {
			http.Error(w, `{"error":"invalid signature"}`, http.StatusUnauthorized)
			return
		}

		claimsBytes, _ := base64.RawURLEncoding.DecodeString(parts[1])
		var claims map[string]interface{}
		json.Unmarshal(claimsBytes, &claims)
		exp, ok := claims["exp"].(float64)
		if !ok {
			http.Error(w, `{"error":"token missing exp claim"}`, http.StatusUnauthorized)
			return
		}
		if time.Now().Unix() >= int64(exp) {
			http.Error(w, `{"error":"token expired"}`, http.StatusUnauthorized)
			return
		}
		if sub, ok := claims["sub"].(string); ok {
			r.Header.Set("X-User-Id", sub)
		}
		// Tenant identity comes ONLY from verified claims; overwrite any
		// caller-supplied tenant header before invoking the handler.
		if tenant := tenantFromClaims(claims); tenant != "" {
			r.Header.Set("X-Tenant-ID", tenant)
		} else {
			r.Header.Del("X-Tenant-ID")
		}
		ctx := context.WithValue(r.Context(), "jwt_claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func main() {
	startJWKSRefresh()
	initConsentStore() // CP-09

	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", healthHandler)
	mux.HandleFunc("/readyz", readyzHandler)
	mux.HandleFunc("/metrics", metricsHandler)

	mux.HandleFunc("/v1/open-banking/consents", handleConsents)
	// CP-09: consent lifecycle sub-actions (authorize / revoke).
	mux.HandleFunc("/v1/open-banking/consents/", handleConsentAction)

	// CP-09: AIS/PIS data endpoints behind real consent enforcement. The
	// account/payment DATA source is not implemented in this service, so
	// these honestly return 501 AFTER the consent check — an unauthenticated
	// or out-of-scope request is rejected (403), never served.
	mux.HandleFunc("/open-banking/v3.1/accounts", consentEnforcement("ais", "ReadAccountsBasic", notImplementedData))
	mux.HandleFunc("/open-banking/v3.1/accounts/", consentEnforcement("ais", "ReadAccountsDetail", notImplementedData))
	mux.HandleFunc("/open-banking/v3.1/payments/domestic-payments", consentEnforcement("pis", "CreatePayment", notImplementedData))
	mux.HandleFunc("/open-banking/v3.1/funds-confirmation", consentEnforcement("cbpii", "ConfirmFunds", notImplementedData))

	mux.HandleFunc("/v1/open-banking/tpps", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{"items": tpps, "total": len(tpps)})
	})

	mux.HandleFunc("/v1/open-banking/api-catalog", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{"items": endpoints, "total": len(endpoints)})
	})

	mux.HandleFunc("/v1/open-banking/stats", handleConsentStats)

	fmt.Println("Open Banking service on :8165")
	http.ListenAndServe(":8165", rateLimitMiddleware(jwtAuthMiddleware(countingMiddleware(mux))))
}

// healthHandler serves /healthz (extracted from the inline closure in main; behavior unchanged).

// ── CP-09: DB-backed consent lifecycle + enforcement ────────────────────────

func consentDBOr503(w http.ResponseWriter) bool {
	if consentDB == nil {
		respondJSON(w, 503, map[string]string{"error": "consent store unavailable"})
		return false
	}
	return true
}

func handleConsents(w http.ResponseWriter, r *http.Request) {
	if !consentDBOr503(w) {
		return
	}
	switch r.Method {
	case http.MethodGet:
		// Expire lazily on read so expired consents are never served as active.
		_, _ = consentDB.Exec(`UPDATE ob_consents SET status='expired' WHERE status='authorized' AND expires_at < NOW()`)
		rows, err := consentDB.Query(`SELECT id, customer_id, customer_name, tpp_id, tpp_name, consent_type,
			permissions, accounts, status, created_at, expires_at, access_count
			FROM ob_consents ORDER BY created_at DESC LIMIT 500`)
		if err != nil {
			respondJSON(w, 500, map[string]string{"error": "query failed"})
			return
		}
		defer rows.Close()
		items := []Consent{}
		for rows.Next() {
			var c Consent
			var perms, accounts string
			var customerName, tppName *string
			var createdAt, expiresAt time.Time
			if err := rows.Scan(&c.ID, &c.CustomerID, &customerName, &c.TPPID, &tppName, &c.ConsentType,
				&perms, &accounts, &c.Status, &createdAt, &expiresAt, &c.AccessCount); err != nil {
				continue
			}
			if customerName != nil {
				c.CustomerName = *customerName
			}
			if tppName != nil {
				c.TPPName = *tppName
			}
			_ = json.Unmarshal([]byte(perms), &c.Permissions)
			_ = json.Unmarshal([]byte(accounts), &c.Accounts)
			c.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			c.ExpiresAt = expiresAt.UTC().Format(time.RFC3339)
			items = append(items, c)
		}
		respondJSON(w, 200, map[string]interface{}{"items": items, "total": len(items)})
	case http.MethodPost:
		var req ConsentRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondJSON(w, 400, map[string]string{"error": "invalid JSON"})
			return
		}
		if req.ConsentType != "ais" && req.ConsentType != "pis" && req.ConsentType != "cbpii" {
			respondJSON(w, 400, map[string]string{"error": "consentType must be ais, pis, or cbpii"})
			return
		}
		if len(req.Permissions) == 0 {
			respondJSON(w, 400, map[string]string{"error": "at least one permission required"})
			return
		}
		if req.CustomerID == "" || req.TPPID == "" {
			respondJSON(w, 400, map[string]string{"error": "customerId and tppId required"})
			return
		}
		tppActive := false
		tppName := ""
		for _, t := range tpps {
			if t.ID == req.TPPID && t.Status == "active" {
				tppActive = true
				tppName = t.Name
				break
			}
		}
		if !tppActive {
			respondJSON(w, 403, map[string]string{"error": "TPP is not active or not found"})
			return
		}
		id := fmt.Sprintf("CNS-%x", sha256.Sum256([]byte(fmt.Sprintf("%s-%s-%d", req.CustomerID, req.TPPID, time.Now().UnixNano()))))[:18]
		perms, _ := json.Marshal(req.Permissions)
		accounts, _ := json.Marshal(req.Accounts)
		expires := time.Now().UTC().Add(180 * 24 * time.Hour)
		_, err := consentDB.Exec(`INSERT INTO ob_consents
			(id, customer_id, tpp_id, tpp_name, consent_type, permissions, accounts, status, expires_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,'awaiting_authorization',$8)`,
			id, req.CustomerID, req.TPPID, tppName, req.ConsentType, string(perms), string(accounts), expires)
		if err != nil {
			log.Printf("[open-banking-go] consent insert failed: %v", err)
			respondJSON(w, 500, map[string]string{"error": "consent creation failed"})
			return
		}
		respondJSON(w, 201, map[string]interface{}{
			"id": id, "status": "awaiting_authorization", "expiresAt": expires.Format(time.RFC3339),
			"message": "consent created — customer authorization required before use",
		})
	default:
		respondJSON(w, 405, map[string]string{"error": "method not allowed"})
	}
}

// handleConsentAction handles /v1/open-banking/consents/{id}/authorize and
// /{id}/revoke. Revocation sets status='revoked' AND expires_at=NOW() so the
// consent is dead on both axes immediately (CP-09).
func handleConsentAction(w http.ResponseWriter, r *http.Request) {
	if !consentDBOr503(w) {
		return
	}
	if r.Method != http.MethodPost {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	rest := strings.TrimPrefix(r.URL.Path, "/v1/open-banking/consents/")
	parts := strings.Split(rest, "/")
	if len(parts) != 2 {
		respondJSON(w, 404, map[string]string{"error": "expected /consents/{id}/authorize|revoke"})
		return
	}
	id, action := parts[0], parts[1]
	switch action {
	case "authorize":
		res, err := consentDB.Exec(`UPDATE ob_consents SET status='authorized'
			WHERE id=$1 AND status='awaiting_authorization' AND expires_at > NOW()`, id)
		if err != nil {
			respondJSON(w, 500, map[string]string{"error": "authorize failed"})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			respondJSON(w, 409, map[string]string{"error": "consent not found, already decided, or expired"})
			return
		}
		respondJSON(w, 200, map[string]string{"id": id, "status": "authorized"})
	case "revoke":
		res, err := consentDB.Exec(`UPDATE ob_consents SET status='revoked', revoked_at=NOW(), expires_at=NOW()
			WHERE id=$1 AND status IN ('awaiting_authorization','authorized')`, id)
		if err != nil {
			respondJSON(w, 500, map[string]string{"error": "revocation failed"})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			respondJSON(w, 409, map[string]string{"error": "consent not found or already terminated"})
			return
		}
		log.Printf("[open-banking-go] consent %s revoked", id)
		respondJSON(w, 200, map[string]string{"id": id, "status": "revoked"})
	default:
		respondJSON(w, 404, map[string]string{"error": "unknown consent action"})
	}
}

// consentEnforcement is the CP-09 enforcement middleware for AIS/PIS data
// endpoints: the caller must present x-consent-id referencing a consent that
// is (a) authorized, (b) not expired, (c) of the right type, and (d) carrying
// the required permission scope. Failures are 403 with a precise reason;
// store outage is 503 (fail closed).
func consentEnforcement(consentType, permission string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !consentDBOr503(w) {
			return
		}
		consentID := r.Header.Get("x-consent-id")
		if consentID == "" {
			respondJSON(w, 403, map[string]string{"error": "x-consent-id header required (CBN OB Guidelines / NDPR consent enforcement)"})
			return
		}
		var status, cType, perms string
		var expiresAt time.Time
		err := consentDB.QueryRow(`SELECT status, consent_type, permissions, expires_at FROM ob_consents WHERE id=$1`, consentID).
			Scan(&status, &cType, &perms, &expiresAt)
		if err != nil {
			respondJSON(w, 403, map[string]string{"error": "consent not found"})
			return
		}
		if status != "authorized" {
			respondJSON(w, 403, map[string]string{"error": "consent not authorized", "status": status})
			return
		}
		if time.Now().After(expiresAt) {
			_, _ = consentDB.Exec(`UPDATE ob_consents SET status='expired' WHERE id=$1 AND status='authorized'`, consentID)
			respondJSON(w, 403, map[string]string{"error": "consent expired"})
			return
		}
		if cType != consentType {
			respondJSON(w, 403, map[string]string{"error": fmt.Sprintf("consent type %s does not permit %s access", cType, consentType)})
			return
		}
		var scopes []string
		_ = json.Unmarshal([]byte(perms), &scopes)
		ok := false
		for _, s := range scopes {
			if s == permission {
				ok = true
				break
			}
		}
		if !ok {
			respondJSON(w, 403, map[string]string{"error": "consent lacks required permission scope", "required": permission})
			return
		}
		_, _ = consentDB.Exec(`UPDATE ob_consents SET last_accessed_at=NOW(), access_count=access_count+1 WHERE id=$1`, consentID)
		next(w, r)
	}
}

// notImplementedData: consent is enforced, but the AIS/PIS data source is not
// implemented in this service — honest 501 instead of fabricated data.
func notImplementedData(w http.ResponseWriter, _ *http.Request) {
	respondJSON(w, 501, map[string]string{
		"error":  "not_implemented",
		"detail": "Consent verified. This data endpoint has no upstream account/payment data source wired in this service.",
	})
}

func handleConsentStats(w http.ResponseWriter, _ *http.Request) {
	if !consentDBOr503(w) {
		return
	}
	_, _ = consentDB.Exec(`UPDATE ob_consents SET status='expired' WHERE status='authorized' AND expires_at < NOW()`)
	stats := map[string]interface{}{"byStatus": map[string]int{}, "byConsentType": map[string]int{}}
	rows, err := consentDB.Query(`SELECT status, consent_type, COUNT(*), COALESCE(SUM(access_count),0) FROM ob_consents GROUP BY status, consent_type`)
	if err != nil {
		respondJSON(w, 500, map[string]string{"error": "query failed"})
		return
	}
	defer rows.Close()
	total, active, totalAccess := 0, 0, 0
	byStatus := map[string]int{}
	byType := map[string]int{}
	for rows.Next() {
		var st, ct string
		var n, ac int
		if rows.Scan(&st, &ct, &n, &ac) != nil {
			continue
		}
		byStatus[st] += n
		byType[ct] += n
		total += n
		totalAccess += ac
		if st == "authorized" {
			active += n
		}
	}
	activeTPPs := 0
	for _, t := range tpps {
		if t.Status == "active" {
			activeTPPs++
		}
	}
	stats["byStatus"] = byStatus
	stats["byConsentType"] = byType
	stats["totalConsents"] = total
	stats["activeConsents"] = active
	stats["totalTPPs"] = len(tpps)
	stats["activeTPPs"] = activeTPPs
	stats["totalAPIAccesses"] = totalAccess
	stats["apiEndpoints"] = len(endpoints)
	respondJSON(w, 200, stats)
}

func healthHandler(w http.ResponseWriter, _ *http.Request) {
	respondJSON(w, 200, map[string]interface{}{
		"status": "ok", "service": "open-banking",
		"middleware": map[string]interface{}{
			"kafka":       map[string]interface{}{"broker": envOr("KAFKA_BROKER", "localhost:9092"), "topics": []string{"ob.consent.created", "ob.consent.revoked", "ob.payment.initiated", "ob.account.accessed"}},
			"redis":       map[string]interface{}{"url": envOr("REDIS_URL", "redis://localhost:6379"), "cache_keys": []string{"ob:consents", "ob:tpp_certs", "ob:rate_limits", "ob:tokens"}},
			"postgres":    map[string]interface{}{"url": os.Getenv("DATABASE_URL"), "tables": []string{"ob_consents", "ob_tpps", "ob_api_endpoints", "ob_access_logs"}},
			"opensearch":  map[string]interface{}{"url": envOr("OPENSEARCH_URL", "http://localhost:9200"), "indices": []string{"ob-access-logs", "ob-consent-audit", "ob-api-metrics"}},
			"keycloak":    map[string]interface{}{"url": envOr("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank-openbanking", "client": "open-banking-service"},
			"permify":     map[string]interface{}{"url": envOr("PERMIFY_URL", "http://localhost:3476"), "resources": []string{"ob_consent", "ob_tpp", "ob_api_access"}},
			"dapr":        map[string]interface{}{"url": envOr("DAPR_URL", "http://localhost:3500"), "app_id": "open-banking", "pubsub": "ob-events"},
			"fluvio":      map[string]interface{}{"url": envOr("FLUVIO_URL", "localhost:9003"), "topics": []string{"ob-api-requests-stream", "ob-consent-events-stream"}},
			"temporal":    map[string]interface{}{"url": envOr("TEMPORAL_URL", "localhost:7233"), "workflows": []string{"ConsentAuthorization", "PaymentInitiation", "TPPCertRenewal", "ConsentExpiry"}},
			"mojaloop":    map[string]interface{}{"url": envOr("MOJALOOP_URL", "http://localhost:3002"), "usage": "open-banking-payment-routing"},
			"tigerbeetle": map[string]interface{}{"url": envOr("TIGERBEETLE_URL", "localhost:3000"), "ledgers": []string{"ob_payment_initiation", "ob_funds_confirmation"}},
			"lakehouse":   map[string]interface{}{"url": envOr("LAKEHOUSE_URL", "http://localhost:8181"), "tables": []string{"ob_api_usage_history", "ob_consent_history", "ob_tpp_analytics"}},
			"apisix":      map[string]interface{}{"url": envOr("APISIX_URL", "http://localhost:9080"), "routes": []string{"/open-banking/*"}},
			"openappsec":  map[string]interface{}{"url": envOr("OPENAPPSEC_URL", "http://localhost:4000"), "policy": "ob-waf-rules"},
		},
	})
}

// --- Request metrics (restored fleet-canonical block) ---
var (
	_reqCount uint64
	_errCount uint64
	_bootTime = time.Now()
)

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

func countingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddUint64(&_reqCount, 1)
		rw := &responseWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(rw, r)
		if rw.status >= 400 {
			atomic.AddUint64(&_errCount, 1)
		}
	})
}

func metricsHandler(w http.ResponseWriter, r *http.Request) {
	reqs := atomic.LoadUint64(&_reqCount)
	errs := atomic.LoadUint64(&_errCount)
	w.Header().Set("Content-Type", "text/plain")
	fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"open-banking-go\"} %d\n", reqs)
	fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"open-banking-go\"} %d\n", errs)
	fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"open-banking-go\"} %.0f\n", time.Since(_bootTime).Seconds())
}

func readyzHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(200)
	fmt.Fprintf(w, `{"ready":true,"service":"open-banking-go"}`)
}

// --- Rate limiting (restored fleet-canonical token bucket: 100 rps) ---
var _rlTokens int64 = 100
var _rlLastRefill int64

func rlAllow() bool {
	nowr := time.Now().UnixMilli()
	if nowr-atomic.LoadInt64(&_rlLastRefill) >= 1000 {
		atomic.StoreInt64(&_rlTokens, 100)
		atomic.StoreInt64(&_rlLastRefill, nowr)
	}
	if atomic.AddInt64(&_rlTokens, -1) < 0 {
		atomic.AddInt64(&_rlTokens, 1)
		return false
	}
	return true
}

func rateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !rlAllow() {
			w.Header().Set("Retry-After", "1")
			http.Error(w, `{"error":"rate_limit_exceeded"}`, 429)
			return
		}
		next.ServeHTTP(w, r)
	})
}
