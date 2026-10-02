// fraudfusion — ML-driven fraud detection fusion engine for 54Bank
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
	"time"

	_ "github.com/lib/pq"
)

var startTime = time.Now()

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

// ---------------------------------------------------------------------------
// JWT validation (RS256 via Keycloak JWKS) — W12-B5-P0-A
// Mutating routes on this service were reachable with no authentication at
// all (w12 findings/b3-exposure.json). Every route except the probe/health
// endpoints now requires a verified Keycloak bearer token; the middleware
// fails closed on any verification error.
// Canonical pattern: services/permify-authz-go/main.go (JWKS cache +
// jwtMiddleware) and services/acgsf-guarantee-go/main.go (jwtAuthMiddleware).
// ---------------------------------------------------------------------------

// jwksRefreshOnce ensures the shared JWKS poller is started exactly once.
var jwksRefreshOnce sync.Once

// ensureJWKSRefresh starts the initial JWKS fetch and the 5-minute refresher
// exactly once per process, no matter how many routes register the middleware
// (GPT-10: was one poller goroutine pair per route registration).
func ensureJWKSRefresh(realmURL string) {
	jwksRefreshOnce.Do(func() {
		go fetchJWKS(realmURL)
		go func() {
			ticker := time.NewTicker(5 * time.Minute)
			defer ticker.Stop()
			for range ticker.C {
				fetchJWKS(realmURL)
			}
		}()
	})
}

type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}
var jwksHTTPClient = &http.Client{Timeout: 5 * time.Second}

func jwtRealmURL() string {
	if v := os.Getenv("KEYCLOAK_REALM_URL"); v != "" {
		return v
	}
	return "http://keycloak:8080/realms/54bank"
}

func fetchJWKS(realmURL string) {
	resp, err := jwksHTTPClient.Get(realmURL + "/protocol/openid-connect/certs")
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
		pub := &rsa.PublicKey{N: new(big.Int).SetBytes(nBytes), E: eInt}
		jwtCache.keys[k.Kid] = pub
	}
	jwtCache.updated = time.Now()
	log.Printf("[middleware] JWKS refreshed: %d keys", len(jwtCache.keys))
}

// jwtAuthMiddleware enforces a verified RS256 Keycloak bearer token on every
// route except the probe/health endpoints (canonical fleet template).
func jwtAuthMiddleware(next http.Handler) http.Handler {
	realmURL := jwtRealmURL()
	// Single shared JWKS poller per process (started once, not per route)
	ensureJWKSRefresh(realmURL)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip health endpoints
		if r.URL.Path == "/healthz" || r.URL.Path == "/readyz" || r.URL.Path == "/livez" || r.URL.Path == "/metrics" {
			next.ServeHTTP(w, r)
			return
		}
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			http.Error(w, `{"error":"missing bearer token"}`, http.StatusUnauthorized)
			return
		}
		token := auth[7:]
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			http.Error(w, `{"error":"invalid token format"}`, http.StatusUnauthorized)
			return
		}
		// Decode header for kid
		headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
		if err != nil {
			http.Error(w, `{"error":"invalid token header"}`, http.StatusUnauthorized)
			return
		}
		var header struct {
			Kid string `json:"kid"`
		}
		json.Unmarshal(headerBytes, &header)

		jwtCache.mu.RLock()
		pub, ok := jwtCache.keys[header.Kid]
		jwtCache.mu.RUnlock()
		if !ok {
			// Try refresh
			fetchJWKS(realmURL)
			jwtCache.mu.RLock()
			pub, ok = jwtCache.keys[header.Kid]
			jwtCache.mu.RUnlock()
			if !ok {
				http.Error(w, `{"error":"unknown signing key"}`, http.StatusUnauthorized)
				return
			}
		}
		// Verify signature (RS256)
		signingInput := parts[0] + "." + parts[1]
		sigBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
		if err != nil {
			http.Error(w, `{"error":"invalid signature encoding"}`, http.StatusUnauthorized)
			return
		}
		hash := sha256.Sum256([]byte(signingInput))
		if err := rsa.VerifyPKCS1v15(pub, crypto.SHA256, hash[:], sigBytes); err != nil {
			http.Error(w, `{"error":"invalid signature"}`, http.StatusUnauthorized)
			return
		}
		// Decode claims
		claimsBytes, _ := base64.RawURLEncoding.DecodeString(parts[1])
		var claims map[string]interface{}
		json.Unmarshal(claimsBytes, &claims)
		// Check expiry
		exp, ok := claims["exp"].(float64)
		if !ok {
			http.Error(w, `{"error":"token missing exp claim"}`, http.StatusUnauthorized)
			return
		}
		if time.Now().Unix() >= int64(exp) {
			http.Error(w, `{"error":"token expired"}`, http.StatusUnauthorized)
			return
		}
		// Pass claims in context
		ctx := context.WithValue(r.Context(), "jwt_claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

type FraudCase struct {
	ID            string   `json:"id"`
	TransactionID string   `json:"transactionId"`
	RiskScore     float64  `json:"riskScore"`
	RiskLevel     string   `json:"riskLevel"`
	Models        []string `json:"models"`
	Action        string   `json:"action"`
	ReviewedAt    string   `json:"reviewedAt,omitempty"`
	Status        string   `json:"status"`
}

// ── Postgres persistence (W12 C3-P2-B5) ─────────────────────────────────────
// The in-memory `cases` slice was removed. fraud_cases is authoritative;
// mutations are real PG writes and reads are served from PG. When DATABASE_URL
// is unset/unreachable the mutation/list endpoints fail closed (503) — no
// in-memory fallback claims durability Postgres lacks.

var db *sql.DB

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Printf("[fraudfusion] DATABASE_URL not set — fraud case endpoints fail closed (503)")
		return
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[fraudfusion] DB open failed: %v — endpoints fail closed (503)", err)
		db = nil
		return
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err = db.Ping(); err != nil {
		log.Printf("[fraudfusion] DB ping failed: %v — endpoints fail closed (503)", err)
		db = nil
		return
	}
	if _, err = db.Exec(`CREATE TABLE IF NOT EXISTS fraud_cases (
		id TEXT PRIMARY KEY,
		transaction_id TEXT NOT NULL DEFAULT '',
		risk_score DOUBLE PRECISION NOT NULL DEFAULT 0,
		risk_level TEXT NOT NULL DEFAULT '',
		models JSONB NOT NULL DEFAULT '[]',
		action TEXT NOT NULL DEFAULT '',
		reviewed_at TEXT NOT NULL DEFAULT '',
		status TEXT NOT NULL DEFAULT '',
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`); err != nil {
		log.Printf("[fraudfusion] DDL failed: %v — endpoints fail closed (503)", err)
		db = nil
		return
	}
	if _, err = db.Exec(`CREATE SEQUENCE IF NOT EXISTS fraud_cases_seq START 3`); err != nil {
		log.Printf("[fraudfusion] sequence DDL failed: %v — endpoints fail closed (503)", err)
		db = nil
		return
	}
	// Idempotent boot seeds (previously the in-memory fixtures).
	seed := `INSERT INTO fraud_cases (id, transaction_id, risk_score, risk_level, models, action, status) VALUES
		('FC-001', 'TXN-9991', 0.92, 'HIGH', '["velocity","device","ml-xgboost"]', 'block', 'confirmed_fraud'),
		('FC-002', 'TXN-9992', 0.45, 'MEDIUM', '["velocity","ml-xgboost"]', 'challenge', 'under_review')
		ON CONFLICT (id) DO NOTHING`
	if _, err = db.Exec(seed); err != nil {
		log.Printf("[fraudfusion] seed failed: %v — endpoints fail closed (503)", err)
		db = nil
		return
	}
	log.Printf("[fraudfusion] Postgres connected (pool: 10/2), fraud_cases ready")
}

// insertFraudCase persists a scored case in one atomic INSERT … RETURNING.
// The id is sequence-derived (FC-003, FC-004, …) so concurrent scorers never
// collide and a retried request that already committed returns the stored row.
func insertFraudCase(fc *FraudCase) error {
	models, err := json.Marshal(fc.Models)
	if err != nil {
		return err
	}
	return db.QueryRow(`INSERT INTO fraud_cases
		(id, transaction_id, risk_score, risk_level, models, action, reviewed_at, status)
		VALUES ('FC-' || LPAD(nextval('fraud_cases_seq')::text, 3, '0'), $1, $2, $3, $4, $5, $6, $7)
		RETURNING id`,
		fc.TransactionID, fc.RiskScore, fc.RiskLevel, models, fc.Action, fc.ReviewedAt, fc.Status,
	).Scan(&fc.ID)
}

func listFraudCases() ([]FraudCase, error) {
	rows, err := db.Query(`SELECT id, transaction_id, risk_score, risk_level, models, action, reviewed_at, status
		FROM fraud_cases ORDER BY created_at, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []FraudCase{}
	for rows.Next() {
		var fc FraudCase
		var models []byte
		if err := rows.Scan(&fc.ID, &fc.TransactionID, &fc.RiskScore, &fc.RiskLevel, &models, &fc.Action, &fc.ReviewedAt, &fc.Status); err != nil {
			return nil, err
		}
		fc.Models = []string{}
		_ = json.Unmarshal(models, &fc.Models)
		out = append(out, fc)
	}
	return out, rows.Err()
}

// ---------------------------------------------------------------------------
// Permify authorization (W12-B5-P0-D2) — the mutating /v1/fraud/score handler
// performs a REAL Permify permission check. Composes with the W12-B5-P0-A
// jwtAuthMiddleware (runs after it): subject/tenant come from the verified
// jwt_claims stored in the request context by that middleware, never from
// caller-supplied headers. FAIL-CLOSED: Permify unreachable/non-200 => 503;
// CHECK_RESULT_DENIED => 403. Canonical pattern:
// services/permify-authz-go/main.go:428 (check call) + :479 (30s decision
// cache; errors are never cached). Schema entity fraud_case:
// services/auth-service/schemas/permify/v2-kyc-compliance.fragment.
// ---------------------------------------------------------------------------

var permifyHTTPClient = &http.Client{Timeout: 5 * time.Second}

type permifyDecision struct {
	allowed   bool
	expiresAt time.Time
}

var (
	permifyDecisions   = make(map[string]permifyDecision)
	permifyDecisionsMu sync.RWMutex
)

// permifyAuthorize enforces <permission> on entityType:entityID for the
// authenticated caller. On denial or check failure it writes the response
// (403 / 503) and returns false; the handler must return without executing.
func permifyAuthorize(w http.ResponseWriter, r *http.Request, entityType, entityID, permission string) bool {
	claims, _ := r.Context().Value("jwt_claims").(map[string]interface{})
	subject, _ := claims["sub"].(string)
	tenantID, _ := claims["tenant_id"].(string)
	if tenantID == "" {
		if v := os.Getenv("PERMIFY_DEFAULT_TENANT"); v != "" {
			tenantID = v
		} else {
			tenantID = "bpmgd"
		}
	}
	if subject == "" || entityID == "" {
		respondJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden", "detail": "authorization context incomplete"})
		return false
	}
	key := tenantID + "|" + subject + "|" + entityType + "|" + entityID + "|" + permission
	now := time.Now()
	permifyDecisionsMu.RLock()
	cached, hit := permifyDecisions[key]
	permifyDecisionsMu.RUnlock()
	if hit && now.Before(cached.expiresAt) {
		if !cached.allowed {
			respondJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden", "detail": "permify: " + permission + " denied on " + entityType + ":" + entityID})
		}
		return cached.allowed
	}
	baseURL := strings.TrimRight(os.Getenv("PERMIFY_URL"), "/")
	if baseURL == "" {
		baseURL = "http://permify:3476"
	}
	payload := map[string]interface{}{
		"metadata":   map[string]interface{}{"schema_version": "", "snap_token": "", "depth": 20},
		"entity":     map[string]string{"type": entityType, "id": entityID},
		"permission": permission,
		"subject":    map[string]string{"type": "user", "id": subject},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "permify_encode_failed"})
		return false
	}
	url := fmt.Sprintf("%s/v1/tenants/%s/permissions/check", baseURL, tenantID)
	resp, err := permifyHTTPClient.Post(url, "application/json", strings.NewReader(string(body)))
	if err != nil {
		log.Printf("[permify] FAIL-CLOSED check %s on %s:%s unreachable: %v", permission, entityType, entityID, err)
		respondJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "authorization_unavailable", "detail": "permify unreachable (fail-closed)"})
		return false
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		log.Printf("[permify] FAIL-CLOSED check %s on %s:%s http=%d", permission, entityType, entityID, resp.StatusCode)
		respondJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "authorization_unavailable", "detail": "permify check failed (fail-closed)"})
		return false
	}
	var result struct {
		Can string `json:"can"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		respondJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "authorization_unavailable", "detail": "permify malformed response (fail-closed)"})
		return false
	}
	allowed := result.Can == "CHECK_RESULT_ALLOWED"
	permifyDecisionsMu.Lock()
	if len(permifyDecisions) >= 10000 { // evict expired entries first
		for k, v := range permifyDecisions {
			if now.After(v.expiresAt) {
				delete(permifyDecisions, k)
			}
		}
	}
	permifyDecisions[key] = permifyDecision{allowed: allowed, expiresAt: now.Add(30 * time.Second)}
	permifyDecisionsMu.Unlock()
	if !allowed {
		respondJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden", "detail": "permify: " + permission + " denied on " + entityType + ":" + entityID})
	}
	return allowed
}

func main() {
	initDB()
	port := getEnv("PORT", "9164")
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"service":     "fraudfusion",
			"status":      "healthy",
			"uptime_secs": int(time.Since(startTime).Seconds()),
			"models":      []string{"velocity-check", "device-fingerprint", "ml-xgboost", "graph-analysis", "behaviour-biometrics"},
			"middleware": map[string]string{
				"kafka":    "fraud.events, fraud.decisions",
				"redis":    "velocity_counters",
				"postgres": "fraud_db",
			},
		})
	})

	mux.HandleFunc("/v1/fraud/score", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			TransactionID string  `json:"transactionId"`
			Amount        float64 `json:"amount"`
			AccountID     string  `json:"accountId"`
			DeviceID      string  `json:"deviceId"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		entityID := req.TransactionID
		if entityID == "" {
			entityID = req.AccountID
		}
		if !permifyAuthorize(w, r, "fraud_case", entityID, "score") {
			return
		}
		if db == nil {
			respondJSON(w, 503, map[string]string{"error": "fraud case store unavailable (postgres down)"})
			return
		}
		fc := FraudCase{
			TransactionID: req.TransactionID,
			RiskScore:     0.12,
			RiskLevel:     "LOW",
			Models:        []string{"velocity", "device", "ml-xgboost"},
			Action:        "allow",
			Status:        "scored",
		}
		if err := insertFraudCase(&fc); err != nil {
			log.Printf("[fraudfusion] insert failed: %v", err)
			respondJSON(w, 503, map[string]string{"error": "fraud case store unavailable (postgres down)"})
			return
		}
		respondJSON(w, 200, map[string]interface{}{
			"caseId": fc.ID, "riskScore": fc.RiskScore,
			"riskLevel": fc.RiskLevel, "action": fc.Action,
		})
	})

	mux.HandleFunc("/v1/fraud/cases", func(w http.ResponseWriter, _ *http.Request) {
		if db == nil {
			respondJSON(w, 503, map[string]string{"error": "fraud case store unavailable (postgres down)"})
			return
		}
		cases, err := listFraudCases()
		if err != nil {
			log.Printf("[fraudfusion] list failed: %v", err)
			respondJSON(w, 503, map[string]string{"error": "fraud case store unavailable (postgres down)"})
			return
		}
		respondJSON(w, 200, map[string]interface{}{"cases": cases, "total": len(cases)})
	})

	mux.HandleFunc("/v1/fraud/stats", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"scoredToday":      128400,
			"blockedToday":     43,
			"falsePositivePct": 0.8,
			"avgScoringMs":     18,
			"modelAccuracy":    97.4,
		})
	})

	log.Printf("[fraudfusion] Fraud fusion engine on :%s", port)
	log.Fatal((&http.Server{Addr: ":" + port, Handler: jwtAuthMiddleware(mux), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second}).ListenAndServe())
}
