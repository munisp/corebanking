// etherisc-service — parametric crop insurance via Etherisc DIP protocol for 54Bank
package main

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"log"
	"math/big"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	_ "github.com/lib/pq"
)

var (
	db        *sql.DB
	startTime = time.Now()
)

func getEnv(k, v string) string {
	if val := os.Getenv(k); val != "" {
		return val
	}
	return v
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func respondErr(w http.ResponseWriter, code int, msg string) {
	respondJSON(w, code, map[string]string{"error": msg})
}

func initDB() {
	var err error
	db, err = sql.Open("postgres", getEnv("DATABASE_URL", ""))
	if err != nil {
		log.Fatalf("[etherisc-service] db open: %v", err)
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)

	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS etherisc_policies (
			id              SERIAL PRIMARY KEY,
			policy_id       VARCHAR(50)  UNIQUE NOT NULL,
			tenant_id       VARCHAR(50)  NOT NULL,
			farmer_id       VARCHAR(100) NOT NULL,
			crop_type       VARCHAR(100) NOT NULL,
			coverage_usd    NUMERIC(14,2) NOT NULL DEFAULT 0,
			premium_usd     NUMERIC(14,2) NOT NULL DEFAULT 0,
			trigger_index   VARCHAR(100),
			status          VARCHAR(20)  NOT NULL DEFAULT 'pending',
			season_start    DATE,
			season_end      DATE,
			created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
			updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		);
		CREATE TABLE IF NOT EXISTS etherisc_claims (
			id              SERIAL PRIMARY KEY,
			claim_id        VARCHAR(50)  UNIQUE NOT NULL,
			policy_id       VARCHAR(50)  NOT NULL REFERENCES etherisc_policies(policy_id),
			tenant_id       VARCHAR(50)  NOT NULL,
			trigger_value   NUMERIC(14,6),
			payout_usd      NUMERIC(14,2) NOT NULL DEFAULT 0,
			status          VARCHAR(20)  NOT NULL DEFAULT 'pending',
			paid_at         TIMESTAMPTZ,
			created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		);
	`)
	if err != nil {
		log.Fatalf("[etherisc-service] migration: %v", err)
	}
	log.Println("[etherisc-service] DB ready")
}

// --- JWT Validation (Keycloak JWKS, RS256, fail-closed) ---

type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}

var jwksRefreshOnce sync.Once

// jwtRealmURL returns the Keycloak realm base URL used to fetch JWKS keys.
func jwtRealmURL() string {
	if v := os.Getenv("KEYCLOAK_REALM_URL"); v != "" {
		return v
	}
	return "http://keycloak:8080/realms/54bank"
}

// fetchJWKS refreshes the RSA public keys used to verify Bearer tokens.
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
		nBytes, err := base64.RawURLEncoding.DecodeString(k.N)
		if err != nil || len(nBytes) == 0 {
			continue
		}
		eBytes, err := base64.RawURLEncoding.DecodeString(k.E)
		if err != nil || len(eBytes) == 0 {
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

// ensureJWKSRefresh starts the initial JWKS fetch and the 5-minute refresher
// exactly once per process.
func ensureJWKSRefresh() {
	jwksRefreshOnce.Do(func() {
		go fetchJWKS(jwtRealmURL())
		go func() {
			ticker := time.NewTicker(5 * time.Minute)
			defer ticker.Stop()
			for range ticker.C {
				fetchJWKS(jwtRealmURL())
			}
		}()
	})
}

// isProbePath reports whether p is a health/metrics endpoint that must remain
// unauthenticated for orchestrators (exact or suffixed probe paths).
func isProbePath(p string) bool {
	switch p {
	case "/healthz", "/health", "/readyz", "/ready", "/livez", "/live", "/metrics", "/ping":
		return true
	}
	for _, s := range []string{"/healthz", "/health", "/readyz", "/ready", "/livez", "/live", "/metrics"} {
		if strings.HasSuffix(p, s) {
			return true
		}
	}
	return false
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
// (RS256 signature + required exp claim). Fail-closed: any verification
// problem yields 401. Identity headers (X-User-Id, X-Keycloak-ID, X-Tenant-ID,
// X-User-Role) are overwritten from verified claims — caller-supplied values
// are never trusted.
func jwtAuthMiddleware(next http.Handler) http.Handler {
	ensureJWKSRefresh()
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if isProbePath(p) {
			next.ServeHTTP(w, r)
			return
		}
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			http.Error(w, `{"error":"missing bearer token"}`, http.StatusUnauthorized)
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			http.Error(w, `{"error":"invalid token format"}`, http.StatusUnauthorized)
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
		if err := json.Unmarshal(headerBytes, &header); err != nil || header.Kid == "" {
			http.Error(w, `{"error":"invalid token header"}`, http.StatusUnauthorized)
			return
		}
		if header.Alg != "RS256" {
			http.Error(w, `{"error":"unsupported token algorithm"}`, http.StatusUnauthorized)
			return
		}
		jwtCache.mu.RLock()
		pub, ok := jwtCache.keys[header.Kid]
		jwtCache.mu.RUnlock()
		if !ok {
			// Unknown key — refresh once and retry (key rotation).
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
		claimsBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
		if err != nil {
			http.Error(w, `{"error":"invalid claims encoding"}`, http.StatusUnauthorized)
			return
		}
		var claims map[string]interface{}
		if err := json.Unmarshal(claimsBytes, &claims); err != nil {
			http.Error(w, `{"error":"invalid claims"}`, http.StatusUnauthorized)
			return
		}
		exp, ok := claims["exp"].(float64)
		if !ok {
			http.Error(w, `{"error":"token missing exp claim"}`, http.StatusUnauthorized)
			return
		}
		if time.Now().Unix() >= int64(exp) {
			http.Error(w, `{"error":"token expired"}`, http.StatusUnauthorized)
			return
		}
		// Identity headers come ONLY from verified claims; overwrite or drop any
		// caller-supplied values before invoking the handler.
		if sub, ok := claims["sub"].(string); ok && sub != "" {
			r.Header.Set("X-User-Id", sub)
			r.Header.Set("X-Keycloak-ID", sub)
		} else {
			r.Header.Del("X-User-Id")
			r.Header.Del("X-Keycloak-ID")
		}
		if tenant := tenantFromClaims(claims); tenant != "" {
			r.Header.Set("X-Tenant-ID", tenant)
		} else {
			r.Header.Del("X-Tenant-ID")
		}
		r.Header.Del("X-User-Role")
		if ra, ok := claims["realm_access"].(map[string]interface{}); ok {
			if roleList, ok := ra["roles"].([]interface{}); ok {
				roles := make([]string, 0, len(roleList))
				for _, v := range roleList {
					if s, ok := v.(string); ok {
						roles = append(roles, s)
					}
				}
				if len(roles) > 0 {
					r.Header.Set("X-User-Role", strings.Join(roles, ","))
				}
			}
		}
		ctx := context.WithValue(r.Context(), "jwt_claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func main() {
	initDB()
	port := getEnv("PORT", "9162")
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", handleHealth)
	mux.HandleFunc("/api/v1/etherisc/policies/all", handlePoliciesAll)
	mux.HandleFunc("/api/v1/etherisc/policies", handlePolicies)
	mux.HandleFunc("/api/v1/etherisc/claims/all", handleClaimsAll)
	mux.HandleFunc("/api/v1/etherisc/claims", handleClaims)
	mux.HandleFunc("/api/v1/etherisc/stats", handleStats)

	log.Printf("[etherisc-service] Parametric crop insurance on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, jwtAuthMiddleware(mux)))
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	respondJSON(w, 200, map[string]interface{}{
		"service":     "etherisc-service",
		"status":      "healthy",
		"uptime_secs": int(time.Since(startTime).Seconds()),
		"protocol":    "Etherisc DIP v2",
	})
}

func handlePoliciesAll(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("x-tenant-id")

	rows, err := db.QueryContext(r.Context(), `
		SELECT policy_id, farmer_id, crop_type, coverage_usd, premium_usd,
		       trigger_index, status, season_start, season_end, created_at
		FROM etherisc_policies
		WHERE ($1 = '' OR tenant_id = $1)
		ORDER BY created_at DESC
	`, tenantID)
	if err != nil {
		respondErr(w, 500, "failed to fetch policies")
		return
	}
	defer rows.Close()

	type Policy struct {
		PolicyID     string  `json:"policyId"`
		FarmerID     string  `json:"farmerId"`
		CropType     string  `json:"cropType"`
		CoverageUSD  float64 `json:"coverageUsd"`
		PremiumUSD   float64 `json:"premiumUsd"`
		TriggerIndex string  `json:"triggerIndex"`
		Status       string  `json:"status"`
		SeasonStart  string  `json:"seasonStart"`
		SeasonEnd    string  `json:"seasonEnd"`
		CreatedAt    string  `json:"createdAt"`
	}

	result := []Policy{}
	for rows.Next() {
		var p Policy
		var seasonStart, seasonEnd sql.NullString
		var createdAt time.Time
		if err := rows.Scan(&p.PolicyID, &p.FarmerID, &p.CropType, &p.CoverageUSD,
			&p.PremiumUSD, &p.TriggerIndex, &p.Status, &seasonStart, &seasonEnd, &createdAt); err != nil {
			respondErr(w, 500, "scan error")
			return
		}
		p.SeasonStart = seasonStart.String
		p.SeasonEnd = seasonEnd.String
		p.CreatedAt = createdAt.Format(time.RFC3339)
		result = append(result, p)
	}
	respondJSON(w, 200, map[string]interface{}{"policies": result, "total": len(result)})
}

func handlePolicies(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondErr(w, 405, "method not allowed")
		return
	}
	tenantID := r.Header.Get("x-tenant-id")

	var req struct {
		FarmerID     string  `json:"farmerId"`
		CropType     string  `json:"cropType"`
		CoverageUSD  float64 `json:"coverageUsd"`
		PremiumUSD   float64 `json:"premiumUsd"`
		TriggerIndex string  `json:"triggerIndex"`
		SeasonStart  string  `json:"seasonStart"`
		SeasonEnd    string  `json:"seasonEnd"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondErr(w, 400, "invalid request body")
		return
	}

	var policyID string
	err := db.QueryRowContext(r.Context(), `
		INSERT INTO etherisc_policies
			(policy_id, tenant_id, farmer_id, crop_type, coverage_usd, premium_usd, trigger_index, status, season_start, season_end)
		VALUES
			(concat('POL-', to_char(NOW(), 'YYYYMMDDHH24MISS'), '-', floor(random()*9000+1000)::int),
			 $1, $2, $3, $4, $5, $6, 'pending',
			 NULLIF($7, '')::date, NULLIF($8, '')::date)
		RETURNING policy_id
	`, tenantID, req.FarmerID, req.CropType, req.CoverageUSD, req.PremiumUSD,
		req.TriggerIndex, req.SeasonStart, req.SeasonEnd).Scan(&policyID)
	if err != nil {
		log.Printf("[etherisc-service] create policy: %v", err)
		respondErr(w, 500, "failed to create policy")
		return
	}
	respondJSON(w, 201, map[string]string{"policyId": policyID, "status": "pending"})
}

func handleClaimsAll(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("x-tenant-id")

	rows, err := db.QueryContext(r.Context(), `
		SELECT c.claim_id, c.policy_id, c.trigger_value, c.payout_usd, c.status, c.paid_at, c.created_at
		FROM etherisc_claims c
		JOIN etherisc_policies p ON p.policy_id = c.policy_id
		WHERE ($1 = '' OR c.tenant_id = $1)
		ORDER BY c.created_at DESC
	`, tenantID)
	if err != nil {
		respondErr(w, 500, "failed to fetch claims")
		return
	}
	defer rows.Close()

	type Claim struct {
		ClaimID      string   `json:"claimId"`
		PolicyID     string   `json:"policyId"`
		TriggerValue *float64 `json:"triggerValue"`
		PayoutUSD    float64  `json:"payoutUsd"`
		Status       string   `json:"status"`
		PaidAt       *string  `json:"paidAt"`
		CreatedAt    string   `json:"createdAt"`
	}

	result := []Claim{}
	for rows.Next() {
		var c Claim
		var triggerValue sql.NullFloat64
		var paidAt sql.NullTime
		var createdAt time.Time
		if err := rows.Scan(&c.ClaimID, &c.PolicyID, &triggerValue, &c.PayoutUSD,
			&c.Status, &paidAt, &createdAt); err != nil {
			respondErr(w, 500, "scan error")
			return
		}
		if triggerValue.Valid {
			c.TriggerValue = &triggerValue.Float64
		}
		if paidAt.Valid {
			s := paidAt.Time.Format(time.RFC3339)
			c.PaidAt = &s
		}
		c.CreatedAt = createdAt.Format(time.RFC3339)
		result = append(result, c)
	}
	respondJSON(w, 200, map[string]interface{}{"claims": result, "total": len(result)})
}

func handleClaims(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondErr(w, 405, "method not allowed")
		return
	}
	tenantID := r.Header.Get("x-tenant-id")

	var req struct {
		PolicyID     string  `json:"policyId"`
		TriggerValue float64 `json:"triggerValue"`
		PayoutUSD    float64 `json:"payoutUsd"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondErr(w, 400, "invalid request body")
		return
	}

	var claimID string
	err := db.QueryRowContext(r.Context(), `
		INSERT INTO etherisc_claims
			(claim_id, policy_id, tenant_id, trigger_value, payout_usd, status)
		VALUES
			(concat('CLM-', to_char(NOW(), 'YYYYMMDDHH24MISS'), '-', floor(random()*9000+1000)::int),
			 $1, $2, $3, $4, 'pending')
		RETURNING claim_id
	`, req.PolicyID, tenantID, req.TriggerValue, req.PayoutUSD).Scan(&claimID)
	if err != nil {
		log.Printf("[etherisc-service] create claim: %v", err)
		respondErr(w, 500, "failed to create claim")
		return
	}
	respondJSON(w, 201, map[string]string{"claimId": claimID, "status": "pending"})
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("x-tenant-id")

	var activePolicies int
	var totalCoverageUSD float64
	db.QueryRowContext(r.Context(), `
		SELECT COUNT(*), COALESCE(SUM(coverage_usd), 0)
		FROM etherisc_policies
		WHERE status = 'active' AND ($1 = '' OR tenant_id = $1)
	`, tenantID).Scan(&activePolicies, &totalCoverageUSD)

	var claimsPaid int
	var claimPayoutUSD float64
	db.QueryRowContext(r.Context(), `
		SELECT COUNT(*), COALESCE(SUM(payout_usd), 0)
		FROM etherisc_claims
		WHERE status = 'paid' AND ($1 = '' OR tenant_id = $1)
	`, tenantID).Scan(&claimsPaid, &claimPayoutUSD)

	respondJSON(w, 200, map[string]interface{}{
		"activePolicies":   activePolicies,
		"totalCoverageUsd": totalCoverageUSD,
		"claimsPaid":       claimsPaid,
		"claimPayoutUsd":   claimPayoutUSD,
	})
}
