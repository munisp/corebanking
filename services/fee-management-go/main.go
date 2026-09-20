package main

import (
	"context"
	"crypto"
	"crypto/rand"
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

// ── Model ─────────────────────────────────────────────────────────────────────

type FeeRule struct {
	ID            string   `json:"id"`
	Name          string   `json:"name"`
	FeeType       string   `json:"fee_type"`
	Amount        *float64 `json:"amount,omitempty"` // legacy fixed fee (NGN float) — prefer AmountKobo
	Rate          *float64 `json:"rate,omitempty"`   // legacy percent — prefer RateBps
	ProductCode   *string  `json:"product_code,omitempty"`
	Service       *string  `json:"service,omitempty"`
	Currency      string   `json:"currency"`
	Status        string   `json:"status"`
	EffectiveFrom *string  `json:"effective_from,omitempty"`
	CreatedAt     string   `json:"created_at"`
	// MN-10 evaluation fields (expand-migrated columns):
	TenantID        *string `json:"tenant_id,omitempty"`        // nil/empty = global rule
	TransactionType *string `json:"transaction_type,omitempty"` // nil/empty = any
	Channel         *string `json:"channel,omitempty"`          // nil/empty = any
	FeeAccountID    *string `json:"fee_account_id,omitempty"`   // GL/TB fee-income account for postings
	AmountKobo      *int64  `json:"amount_kobo,omitempty"`      // fixed fee, integer minor units
	RateBps         *int64  `json:"rate_bps,omitempty"`         // percent-of-amount fee in basis points
	MinFeeKobo      *int64  `json:"min_fee_kobo,omitempty"`
	MaxFeeKobo      *int64  `json:"max_fee_kobo,omitempty"`
}

// ── Storage ───────────────────────────────────────────────────────────────────

type Store interface {
	List() ([]FeeRule, error)
	Create(r *FeeRule) error
	Update(id string, r *FeeRule) (*FeeRule, error)
}

// In-memory fallback

type memStore struct {
	mu    sync.RWMutex
	rules []FeeRule
}

func newMemStore() *memStore { return &memStore{} }

func (s *memStore) List() ([]FeeRule, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]FeeRule, len(s.rules))
	copy(out, s.rules)
	return out, nil
}

func (s *memStore) Create(r *FeeRule) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.rules = append(s.rules, *r)
	return nil
}

func (s *memStore) Update(id string, patch *FeeRule) (*FeeRule, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, r := range s.rules {
		if r.ID == id {
			patch.ID = id
			patch.CreatedAt = r.CreatedAt
			s.rules[i] = *patch
			return &s.rules[i], nil
		}
	}
	return nil, fmt.Errorf("not found")
}

// PostgreSQL store

type pgStore struct{ db *sql.DB }

func newPGStore(dsn string) (*pgStore, error) {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, err
	}
	if err := db.Ping(); err != nil {
		return nil, err
	}
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS fee_rules (
		id            TEXT PRIMARY KEY,
		name          TEXT NOT NULL,
		fee_type      TEXT NOT NULL,
		amount        DOUBLE PRECISION,
		rate          DOUBLE PRECISION,
		product_code  TEXT,
		service       TEXT,
		currency      TEXT NOT NULL DEFAULT 'NGN',
		status        TEXT NOT NULL DEFAULT 'active',
		effective_from TEXT,
		created_at    TEXT NOT NULL
	)`)
	if err != nil {
		return nil, err
	}
	// MN-10 expand-migrate: evaluation + posting columns.
	for _, stmt := range []string{
		`ALTER TABLE fee_rules ADD COLUMN IF NOT EXISTS tenant_id TEXT`,
		`ALTER TABLE fee_rules ADD COLUMN IF NOT EXISTS transaction_type TEXT`,
		`ALTER TABLE fee_rules ADD COLUMN IF NOT EXISTS channel TEXT`,
		`ALTER TABLE fee_rules ADD COLUMN IF NOT EXISTS fee_account_id TEXT`,
		`ALTER TABLE fee_rules ADD COLUMN IF NOT EXISTS amount_kobo BIGINT`,
		`ALTER TABLE fee_rules ADD COLUMN IF NOT EXISTS rate_bps BIGINT`,
		`ALTER TABLE fee_rules ADD COLUMN IF NOT EXISTS min_fee_kobo BIGINT`,
		`ALTER TABLE fee_rules ADD COLUMN IF NOT EXISTS max_fee_kobo BIGINT`,
	} {
		if _, err := db.Exec(stmt); err != nil {
			return nil, err
		}
	}
	return &pgStore{db: db}, nil
}

const feeRuleCols = `id,name,fee_type,amount,rate,product_code,service,currency,status,effective_from,created_at,tenant_id,transaction_type,channel,fee_account_id,amount_kobo,rate_bps,min_fee_kobo,max_fee_kobo`

func scanFeeRule(scan func(dest ...any) error) (FeeRule, error) {
	var r FeeRule
	err := scan(&r.ID, &r.Name, &r.FeeType, &r.Amount, &r.Rate, &r.ProductCode, &r.Service, &r.Currency, &r.Status, &r.EffectiveFrom, &r.CreatedAt,
		&r.TenantID, &r.TransactionType, &r.Channel, &r.FeeAccountID, &r.AmountKobo, &r.RateBps, &r.MinFeeKobo, &r.MaxFeeKobo)
	return r, err
}

func (s *pgStore) List() ([]FeeRule, error) {
	rows, err := s.db.Query(`SELECT ` + feeRuleCols + ` FROM fee_rules ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []FeeRule
	for rows.Next() {
		r, err := scanFeeRule(rows.Scan)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	if out == nil {
		out = []FeeRule{}
	}
	return out, rows.Err()
}

func (s *pgStore) Create(r *FeeRule) error {
	_, err := s.db.Exec(`INSERT INTO fee_rules(`+feeRuleCols+`) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
		r.ID, r.Name, r.FeeType, r.Amount, r.Rate, r.ProductCode, r.Service, r.Currency, r.Status, r.EffectiveFrom, r.CreatedAt,
		r.TenantID, r.TransactionType, r.Channel, r.FeeAccountID, r.AmountKobo, r.RateBps, r.MinFeeKobo, r.MaxFeeKobo)
	return err
}

func (s *pgStore) Update(id string, patch *FeeRule) (*FeeRule, error) {
	var createdAt string
	err := s.db.QueryRow(`SELECT created_at FROM fee_rules WHERE id=$1`, id).Scan(&createdAt)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("not found")
	}
	if err != nil {
		return nil, err
	}
	patch.ID = id
	patch.CreatedAt = createdAt
	_, err = s.db.Exec(`UPDATE fee_rules SET name=$2,fee_type=$3,amount=$4,rate=$5,product_code=$6,service=$7,currency=$8,status=$9,effective_from=$10,
		tenant_id=$11,transaction_type=$12,channel=$13,fee_account_id=$14,amount_kobo=$15,rate_bps=$16,min_fee_kobo=$17,max_fee_kobo=$18 WHERE id=$1`,
		id, patch.Name, patch.FeeType, patch.Amount, patch.Rate, patch.ProductCode, patch.Service, patch.Currency, patch.Status, patch.EffectiveFrom,
		patch.TenantID, patch.TransactionType, patch.Channel, patch.FeeAccountID, patch.AmountKobo, patch.RateBps, patch.MinFeeKobo, patch.MaxFeeKobo)
	if err != nil {
		return nil, err
	}
	return patch, nil
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func newUUID() string {
	b := make([]byte, 16)
	rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func pathID(path, prefix string) string {
	if !strings.HasPrefix(path, prefix) {
		return ""
	}
	return strings.TrimPrefix(path, prefix)
}

// ── Handlers ──────────────────────────────────────────────────────────────────

func handleRules(store Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// R3-NEW-6: no wildcard origin — echo the request Origin only when it is
		// on the CORS_ALLOWED_ORIGINS allowlist (comma-separated; restrictive default).
		allowedOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
		if allowedOrigins == "" {
			allowedOrigins = "https://dashboard.54bank.ng"
		}
		origin := r.Header.Get("Origin")
		for _, allowed := range strings.Split(allowedOrigins, ",") {
			if strings.TrimSpace(allowed) == origin && origin != "" {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
				break
			}
		}
		w.Header().Set("Access-Control-Allow-Methods", "*")
		w.Header().Set("Access-Control-Allow-Headers", "*")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		// /v1/fee-rules/{id}
		if id := pathID(r.URL.Path, "/v1/fee-rules/"); id != "" {
			if r.Method != http.MethodPut && r.Method != http.MethodPatch {
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
				return
			}
			var patch FeeRule
			if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
				writeErr(w, http.StatusBadRequest, "invalid JSON")
				return
			}
			updated, err := store.Update(id, &patch)
			if err != nil {
				if err.Error() == "not found" {
					writeErr(w, http.StatusNotFound, "fee rule not found")
				} else {
					writeErr(w, http.StatusInternalServerError, err.Error())
				}
				return
			}
			writeJSON(w, http.StatusOK, updated)
			return
		}

		// /v1/fee-rules
		switch r.Method {
		case http.MethodGet:
			rules, err := store.List()
			if err != nil {
				writeErr(w, http.StatusInternalServerError, err.Error())
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"items": rules, "total": len(rules)})

		case http.MethodPost:
			var rule FeeRule
			if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
				writeErr(w, http.StatusBadRequest, "invalid JSON")
				return
			}
			if rule.Name == "" {
				writeErr(w, http.StatusBadRequest, "name is required")
				return
			}
			if rule.FeeType == "" {
				writeErr(w, http.StatusBadRequest, "fee_type is required")
				return
			}
			if rule.Currency == "" {
				rule.Currency = "NGN"
			}
			if rule.Status == "" {
				rule.Status = "active"
			}
			rule.ID = newUUID()
			rule.CreatedAt = time.Now().UTC().Format(time.RFC3339)
			if err := store.Create(&rule); err != nil {
				writeErr(w, http.StatusInternalServerError, err.Error())
				return
			}
			writeJSON(w, http.StatusCreated, rule)

		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}
}

// ── Fee evaluation (MN-10) ──────────────────────────────────────────────────
//
// POST /v1/fee-rules/evaluate — deterministic, pure function of the persisted
// rule set. Consumed (or to be consumed) by payment paths; R2's
// payment-processing-service currently computes commission via its own
// adapter — convergence on this endpoint is noted as future work, not claimed.
//
// Request:  {transaction_type, amount_kobo, tenant_id, channel, currency}
// Response: {fee_kobo, fee_account_id, rule_id, currency, matched}
//
// Fee = fixed (amount_kobo | legacy amount×100) + proportional
// (ROUND_HALF_UP(amount_kobo × rate_bps / 10000) | legacy rate %), clamped to
// [min_fee_kobo, max_fee_kobo]. Matching: status='active', effective_from ≤
// now, and each of tenant_id / transaction_type / channel either unset on the
// rule or equal to the request. The most specific matching rule wins
// (tenant+type+channel specificity), latest created_at breaks ties.

type EvaluateRequest struct {
	TransactionType string `json:"transaction_type"`
	AmountKobo      int64  `json:"amount_kobo"`
	TenantID        string `json:"tenant_id"`
	Channel         string `json:"channel"`
	Currency        string `json:"currency"`
}

type EvaluateResponse struct {
	FeeKobo      int64  `json:"fee_kobo"`
	FeeAccountID string `json:"fee_account_id"`
	RuleID       string `json:"rule_id"`
	Currency     string `json:"currency"`
	Matched      bool   `json:"matched"`
}

// roundHalfUpFloat converts a legacy float NGN/percent quantity to integer
// kobo via big.Rat ROUND_HALF_UP (deprecation path only).
func roundHalfUpKobo(v float64) int64 {
	r := new(big.Rat).SetFloat64(v)
	num, den := r.Num(), r.Denom()
	q, rem := new(big.Int).QuoRem(num, den, new(big.Int))
	if q.Sign() >= 0 && new(big.Int).Mul(rem, big.NewInt(2)).Cmp(den) >= 0 {
		q.Add(q, big.NewInt(1))
	}
	return q.Int64()
}

// evaluateFee computes the fee in integer kobo for one matched rule.
func evaluateFee(rule *FeeRule, amountKobo int64) int64 {
	fee := int64(0)
	if rule.AmountKobo != nil {
		fee += *rule.AmountKobo
	} else if rule.Amount != nil {
		fee += roundHalfUpKobo(*rule.Amount * 100)
	}
	if rule.RateBps != nil {
		// ROUND_HALF_UP(amount × bps / 10000), big-int to avoid overflow.
		num := new(big.Int).Mul(big.NewInt(amountKobo), big.NewInt(*rule.RateBps))
		num.Add(num, big.NewInt(5000))
		fee += new(big.Int).Quo(num, big.NewInt(10000)).Int64()
	} else if rule.Rate != nil {
		fee += roundHalfUpKobo(float64(amountKobo) * *rule.Rate / 100)
	}
	if rule.MinFeeKobo != nil && fee < *rule.MinFeeKobo {
		fee = *rule.MinFeeKobo
	}
	if rule.MaxFeeKobo != nil && fee > *rule.MaxFeeKobo {
		fee = *rule.MaxFeeKobo
	}
	return fee
}

func matchStr(ruleVal *string, reqVal string) bool {
	if ruleVal == nil || *ruleVal == "" {
		return true
	}
	return *ruleVal == reqVal
}

func ruleEffective(rule *FeeRule, now time.Time) bool {
	if rule.EffectiveFrom == nil || *rule.EffectiveFrom == "" {
		return true
	}
	for _, layout := range []string{time.RFC3339, "2006-01-02"} {
		if t, err := time.Parse(layout, *rule.EffectiveFrom); err == nil {
			return !t.After(now)
		}
	}
	return true // unparsable effective_from does not block (legacy rows)
}

func handleEvaluate(store Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.Header().Set("Allow", "POST")
			writeErr(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		var req EvaluateRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeErr(w, http.StatusBadRequest, "invalid JSON")
			return
		}
		if req.AmountKobo <= 0 {
			writeErr(w, http.StatusBadRequest, "amount_kobo must be positive")
			return
		}
		if req.Currency == "" {
			req.Currency = "NGN"
		}
		rules, err := store.List()
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		now := time.Now().UTC()
		best := -1
		bestScore := -1
		for i := range rules {
			rule := &rules[i]
			if rule.Status != "active" || !ruleEffective(rule, now) {
				continue
			}
			if rule.Currency != "" && rule.Currency != req.Currency {
				continue
			}
			if !matchStr(rule.TenantID, req.TenantID) ||
				!matchStr(rule.TransactionType, req.TransactionType) ||
				!matchStr(rule.Channel, req.Channel) {
				continue
			}
			score := 0
			if rule.TenantID != nil && *rule.TenantID != "" {
				score++
			}
			if rule.TransactionType != nil && *rule.TransactionType != "" {
				score++
			}
			if rule.Channel != nil && *rule.Channel != "" {
				score++
			}
			// Higher specificity wins; RFC3339 created_at breaks ties (latest).
			if score > bestScore || (score == bestScore && best >= 0 && rule.CreatedAt > rules[best].CreatedAt) {
				best, bestScore = i, score
			}
		}
		if best < 0 {
			writeJSON(w, http.StatusOK, EvaluateResponse{FeeKobo: 0, Currency: req.Currency, Matched: false})
			return
		}
		rule := &rules[best]
		resp := EvaluateResponse{
			FeeKobo:  evaluateFee(rule, req.AmountKobo),
			RuleID:   rule.ID,
			Currency: req.Currency,
			Matched:  true,
		}
		if rule.FeeAccountID != nil {
			resp.FeeAccountID = *rule.FeeAccountID
		}
		writeJSON(w, http.StatusOK, resp)
	}
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
			fmt.Fprintf(w, `{"error":"unauthorized","service":%q}`, "fee-management-go")
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"malformed token","service":%q}`, "fee-management-go")
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

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	var store Store
	if dsn := os.Getenv("DATABASE_URL"); dsn != "" {
		pg, err := newPGStore(dsn)
		if err != nil {
			log.Printf("[fee-management-go] postgres unavailable (%v) — using in-memory store", err)
			store = newMemStore()
		} else {
			log.Printf("[fee-management-go] connected to postgres")
			store = pg
		}
	} else {
		log.Printf("[fee-management-go] no DATABASE_URL — using in-memory store")
		store = newMemStore()
	}

	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", healthHandler)
	mux.HandleFunc("/readyz", readyzHandler)
	mux.HandleFunc("/metrics", metricsHandler)

	rulesHandler := handleRules(store)
	mux.HandleFunc("/v1/fee-rules/evaluate", handleEvaluate(store)) // MN-10 — registered before the /v1/fee-rules/ subtree; ServeMux picks the longest pattern
	mux.HandleFunc("/v1/fee-rules/", rulesHandler)
	mux.HandleFunc("/v1/fee-rules", rulesHandler)

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"service":"fee-management-go","status":"running"}`)
	})

	log.Printf("[fee-management-go] listening on :%s", port)
	if err := http.ListenAndServe(":"+port, rateLimitMiddleware(jwtAuthMiddleware(countingMiddleware(mux)))); err != nil {
		log.Fatal(err)
	}
}

// healthHandler serves /healthz (extracted from the inline closure in main; behavior unchanged).
func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok", "service": "fee-management-go"})
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
	fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"fee-management-go\"} %d\n", reqs)
	fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"fee-management-go\"} %d\n", errs)
	fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"fee-management-go\"} %.0f\n", time.Since(_bootTime).Seconds())
}

func readyzHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(200)
	fmt.Fprintf(w, `{"ready":true,"service":"fee-management-go"}`)
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
