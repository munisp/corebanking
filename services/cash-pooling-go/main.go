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

// sharedHTTPClient is a process-wide pooled HTTP client for outbound calls
// (replaces per-call &http.Client{} construction).
var sharedHTTPClient = &http.Client{
	Timeout: 10 * time.Second,
	Transport: &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 25,
		IdleConnTimeout:     90 * time.Second,
	},
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

type PoolStructure struct {
	ID             string         `json:"id"`
	PoolName       string         `json:"poolName"`
	PoolType       string         `json:"poolType"` // zero_balance, target_balance, notional, hybrid
	HeaderAccount  string         `json:"headerAccount"`
	HeaderName     string         `json:"headerName"`
	Currency       string         `json:"currency"`
	ChildAccounts  []ChildAccount `json:"childAccounts"`
	SweepFrequency string         `json:"sweepFrequency"` // real_time, eod, intraday
	Status         string         `json:"status"`
	CreatedDate    string         `json:"createdDate"`
}

type ChildAccount struct {
	AccountID       string  `json:"accountId"`
	AccountName     string  `json:"accountName"`
	BranchCode      string  `json:"branchCode"`
	Balance         float64 `json:"balance"`
	TargetBalance   float64 `json:"targetBalance,omitempty"`
	LastSweepDate   string  `json:"lastSweepDate"`
	LastSweepAmount float64 `json:"lastSweepAmount"`
}

type SweepTransaction struct {
	ID              string  `json:"id"`
	PoolID          string  `json:"poolId"`
	FromAccount     string  `json:"fromAccount"`
	ToAccount       string  `json:"toAccount"`
	Amount          float64 `json:"amount"`
	SweepType       string  `json:"sweepType"` // sweep_in, sweep_out, zero_balance, target_top_up
	ExecutedAt      string  `json:"executedAt"`
	Status          string  `json:"status"`
	ReferenceNumber string  `json:"referenceNumber"`
}

type SweepExecRequest struct {
	PoolID string `json:"poolId"`
}

// ── Persistence (wave-12 C3-P0-B7) ─────────────────────────────────────────
// Pools and sweep transactions are Postgres-authoritative (tables cash_pools
// and sweep_transactions, typed columns; child accounts as jsonb because the
// nested array is read/written atomically with the pool). The package-level
// slices were removed: list/stats are served from PG, and sweep execution
// (the money-moving path) runs pool-read + sweep-inserts in ONE transaction.
// reference_number is UNIQUE to give DB-level duplicate protection on sweep
// records. Fail-closed: endpoints return 503 when DATABASE_URL is unset/down.
var db *sql.DB

const cashPoolingDDL = `
CREATE SEQUENCE IF NOT EXISTS sweep_txn_id_seq START 100;
CREATE TABLE IF NOT EXISTS cash_pools (
    id              text PRIMARY KEY,
    tenant_id       text NOT NULL DEFAULT '',
    pool_name       text NOT NULL,
    pool_type       text NOT NULL,
    header_account  text NOT NULL,
    header_name     text NOT NULL DEFAULT '',
    currency        text NOT NULL DEFAULT 'NGN',
    child_accounts  jsonb NOT NULL DEFAULT '[]'::jsonb,
    sweep_frequency text NOT NULL DEFAULT 'eod',
    status          text NOT NULL DEFAULT 'active',
    created_date    text NOT NULL DEFAULT '',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sweep_transactions (
    id               text PRIMARY KEY,
    tenant_id        text NOT NULL DEFAULT '',
    pool_id          text NOT NULL REFERENCES cash_pools (id),
    from_account     text NOT NULL,
    to_account       text NOT NULL,
    amount           double precision NOT NULL CHECK (amount > 0),
    sweep_type       text NOT NULL,
    executed_at      text NOT NULL,
    status           text NOT NULL DEFAULT 'completed',
    reference_number text NOT NULL UNIQUE,
    created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sweep_tx_pool ON sweep_transactions (pool_id);
`

// seedPools/seedSweeps are the demo fixtures previously held in process memory;
// they are now inserted once at boot with ON CONFLICT DO NOTHING (idempotent,
// never overwrites live rows).
var (
	seedPools = []PoolStructure{
		{
			ID: "POOL-001", PoolName: "Dangote Group ZBA Pool", PoolType: "zero_balance",
			HeaderAccount: "0012345678", HeaderName: "Dangote Industries Master Account",
			Currency: "NGN", SweepFrequency: "eod", Status: "active", CreatedDate: "2025-06-15",
			ChildAccounts: []ChildAccount{
				{"0012345679", "Dangote Cement - Operations", "LAG-001", 250_000_000, 0, "2026-05-09", 250_000_000},
				{"0012345680", "Dangote Sugar - Collections", "LAG-002", 180_000_000, 0, "2026-05-09", 180_000_000},
				{"0012345681", "Dangote Flour - Payroll", "ABJ-001", 45_000_000, 0, "2026-05-09", 45_000_000},
				{"0012345682", "Dangote Petrochemicals", "PHC-001", 520_000_000, 0, "2026-05-09", 520_000_000},
			},
		},
		{
			ID: "POOL-002", PoolName: "MTN Nigeria Target Balance", PoolType: "target_balance",
			HeaderAccount: "0098765432", HeaderName: "MTN Nigeria Treasury Master",
			Currency: "NGN", SweepFrequency: "real_time", Status: "active", CreatedDate: "2025-09-01",
			ChildAccounts: []ChildAccount{
				{"0098765433", "MTN - Lagos Collections", "LAG-010", 1_200_000_000, 500_000_000, "2026-05-09", 700_000_000},
				{"0098765434", "MTN - Abuja Operations", "ABJ-005", 350_000_000, 500_000_000, "2026-05-09", -150_000_000},
				{"0098765435", "MTN - PH Regional", "PHC-003", 280_000_000, 200_000_000, "2026-05-09", 80_000_000},
			},
		},
		{
			ID: "POOL-003", PoolName: "Shell Nigeria Notional Pool", PoolType: "notional",
			HeaderAccount: "0055566677", HeaderName: "Shell Petroleum Dev Co Master",
			Currency: "USD", SweepFrequency: "intraday", Status: "active", CreatedDate: "2026-01-10",
			ChildAccounts: []ChildAccount{
				{"0055566678", "Shell - Exploration", "LAG-020", 45_000_000, 0, "2026-05-09", 0},
				{"0055566679", "Shell - Production", "PHC-010", 32_000_000, 0, "2026-05-09", 0},
				{"0055566680", "Shell - Marketing", "ABJ-020", 18_000_000, 0, "2026-05-09", 0},
			},
		},
		{
			ID: "POOL-004", PoolName: "Access Corp Hybrid Pool", PoolType: "hybrid",
			HeaderAccount: "0033344455", HeaderName: "Access Corporation Master",
			Currency: "NGN", SweepFrequency: "eod", Status: "active", CreatedDate: "2026-02-01",
			ChildAccounts: []ChildAccount{
				{"0033344456", "Access Bank Retail", "LAG-030", 800_000_000, 200_000_000, "2026-05-09", 600_000_000},
				{"0033344457", "Access Pension", "ABJ-030", 150_000_000, 100_000_000, "2026-05-09", 50_000_000},
			},
		},
	}

	seedSweeps = []SweepTransaction{
		{"SWP-001", "POOL-001", "0012345679", "0012345678", 250_000_000, "zero_balance", "2026-05-09T23:00:00Z", "completed", "SWP-ZBA-20260509-001"},
		{"SWP-002", "POOL-001", "0012345680", "0012345678", 180_000_000, "zero_balance", "2026-05-09T23:00:00Z", "completed", "SWP-ZBA-20260509-002"},
		{"SWP-003", "POOL-002", "0098765433", "0098765432", 700_000_000, "sweep_out", "2026-05-09T14:30:00Z", "completed", "SWP-TGT-20260509-001"},
		{"SWP-004", "POOL-002", "0098765432", "0098765434", 150_000_000, "target_top_up", "2026-05-09T14:30:00Z", "completed", "SWP-TGT-20260509-002"},
		{"SWP-005", "POOL-004", "0033344456", "0033344455", 600_000_000, "sweep_out", "2026-05-09T23:00:00Z", "completed", "SWP-HYB-20260509-001"},
	}
)

func initDB() {
	dsn := envOr("DATABASE_URL", "")
	if dsn == "" {
		log.Printf("[cash-pooling-go] DATABASE_URL not set — pool/sweep endpoints fail-closed (503)")
		return
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[cash-pooling-go] pg open failed: %v — fail-closed (503)", err)
		db = nil
		return
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err = db.Ping(); err != nil {
		log.Printf("[cash-pooling-go] pg ping failed: %v — fail-closed (503)", err)
		db = nil
		return
	}
	if _, err = db.Exec(cashPoolingDDL); err != nil {
		log.Fatalf("[cash-pooling-go] DDL failed: %v", err)
	}
	tx, err := db.Begin()
	if err != nil {
		log.Fatalf("[cash-pooling-go] seed tx begin: %v", err)
	}
	for _, p := range seedPools {
		children, _ := json.Marshal(p.ChildAccounts)
		if _, err = tx.Exec(
			`INSERT INTO cash_pools (id, pool_name, pool_type, header_account, header_name, currency, child_accounts, sweep_frequency, status, created_date)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
			p.ID, p.PoolName, p.PoolType, p.HeaderAccount, p.HeaderName, p.Currency, children, p.SweepFrequency, p.Status, p.CreatedDate); err != nil {
			tx.Rollback()
			log.Fatalf("[cash-pooling-go] seed pool %s: %v", p.ID, err)
		}
	}
	for _, s := range seedSweeps {
		if _, err = tx.Exec(
			`INSERT INTO sweep_transactions (id, pool_id, from_account, to_account, amount, sweep_type, executed_at, status, reference_number)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (reference_number) DO NOTHING`,
			s.ID, s.PoolID, s.FromAccount, s.ToAccount, s.Amount, s.SweepType, s.ExecutedAt, s.Status, s.ReferenceNumber); err != nil {
			tx.Rollback()
			log.Fatalf("[cash-pooling-go] seed sweep %s: %v", s.ID, err)
		}
	}
	if err = tx.Commit(); err != nil {
		log.Fatalf("[cash-pooling-go] seed tx commit: %v", err)
	}
	log.Printf("[cash-pooling-go] postgres authoritative store ready (cash_pools, sweep_transactions)")
}

func dbListPools() ([]PoolStructure, error) {
	rows, err := db.Query(`SELECT id, pool_name, pool_type, header_account, header_name, currency, child_accounts, sweep_frequency, status, created_date FROM cash_pools ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []PoolStructure{}
	for rows.Next() {
		var p PoolStructure
		var children []byte
		if err := rows.Scan(&p.ID, &p.PoolName, &p.PoolType, &p.HeaderAccount, &p.HeaderName, &p.Currency, &children, &p.SweepFrequency, &p.Status, &p.CreatedDate); err != nil {
			return nil, err
		}
		json.Unmarshal(children, &p.ChildAccounts)
		out = append(out, p)
	}
	return out, rows.Err()
}

func dbListSweeps() ([]SweepTransaction, error) {
	rows, err := db.Query(`SELECT id, pool_id, from_account, to_account, amount, sweep_type, executed_at, status, reference_number FROM sweep_transactions ORDER BY created_at, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []SweepTransaction{}
	for rows.Next() {
		var s SweepTransaction
		if err := rows.Scan(&s.ID, &s.PoolID, &s.FromAccount, &s.ToAccount, &s.Amount, &s.SweepType, &s.ExecutedAt, &s.Status, &s.ReferenceNumber); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// dbExecuteSweep locks the pool row (FOR UPDATE), computes the sweep set, and
// inserts all sweep transactions in ONE transaction — the money-moving record
// is atomic and cannot be half-persisted across a restart.
func dbExecuteSweep(poolID string) ([]SweepTransaction, error) {
	tx, err := db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	var p PoolStructure
	var children []byte
	err = tx.QueryRow(
		`SELECT id, pool_name, pool_type, header_account, header_name, currency, child_accounts, sweep_frequency, status, created_date
		 FROM cash_pools WHERE id = $1 FOR UPDATE`, poolID).
		Scan(&p.ID, &p.PoolName, &p.PoolType, &p.HeaderAccount, &p.HeaderName, &p.Currency, &children, &p.SweepFrequency, &p.Status, &p.CreatedDate)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	json.Unmarshal(children, &p.ChildAccounts)
	executedAt := time.Now().UTC().Format(time.RFC3339)
	newSweeps := []SweepTransaction{}
	for _, child := range p.ChildAccounts {
		var amount float64
		var sweepType string
		switch p.PoolType {
		case "zero_balance":
			amount = child.Balance
			sweepType = "zero_balance"
		case "target_balance":
			amount = child.Balance - child.TargetBalance
			if amount > 0 {
				sweepType = "sweep_out"
			} else {
				sweepType = "target_top_up"
				amount = -amount
			}
		default:
			amount = child.Balance * 0.8
			sweepType = "sweep_out"
		}
		if amount <= 0 {
			continue
		}
		var seq int64
		if err = tx.QueryRow(`SELECT nextval('sweep_txn_id_seq')`).Scan(&seq); err != nil {
			return nil, err
		}
		swp := SweepTransaction{
			ID:          fmt.Sprintf("SWP-%03d", seq),
			PoolID:      p.ID,
			FromAccount: child.AccountID, ToAccount: p.HeaderAccount,
			Amount: amount, SweepType: sweepType,
			ExecutedAt:      executedAt,
			Status:          "completed",
			ReferenceNumber: fmt.Sprintf("SWP-%s-%s-%s", p.PoolType, p.ID, child.AccountID) + fmt.Sprintf("-%06d", seq),
		}
		if sweepType == "target_top_up" {
			swp.FromAccount = p.HeaderAccount
			swp.ToAccount = child.AccountID
		}
		if _, err = tx.Exec(
			`INSERT INTO sweep_transactions (id, pool_id, from_account, to_account, amount, sweep_type, executed_at, status, reference_number)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (reference_number) DO NOTHING`,
			swp.ID, swp.PoolID, swp.FromAccount, swp.ToAccount, swp.Amount, swp.SweepType, swp.ExecutedAt, swp.Status, swp.ReferenceNumber); err != nil {
			return nil, err
		}
		newSweeps = append(newSweeps, swp)
	}
	if err = tx.Commit(); err != nil {
		return nil, err
	}
	return newSweeps, nil
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
	resp, err := sharedHTTPClient.Get(realmURL + "/protocol/openid-connect/certs")
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
			fmt.Fprintf(w, `{"error":"unauthorized","service":%q}`, "cash-pooling-go")
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"malformed token","service":%q}`, "cash-pooling-go")
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
	initDB()
	startJWKSRefresh()

	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", healthHandler)
	mux.HandleFunc("/readyz", readyzHandler)
	mux.HandleFunc("/metrics", metricsHandler)

	mux.HandleFunc("/v1/cash-pooling/pools", permifyAuthzGuard("sweep", "register", func(w http.ResponseWriter, _ *http.Request) {
		if db == nil {
			respondJSON(w, 503, map[string]string{"error": "postgres unavailable — fail-closed"})
			return
		}
		items, err := dbListPools()
		if err != nil {
			respondJSON(w, 500, map[string]string{"error": "list failed: " + err.Error()})
			return
		}
		respondJSON(w, 200, map[string]interface{}{"items": items, "total": len(items), "source": "postgres"})
	}))

	mux.HandleFunc("/v1/cash-pooling/sweeps", permifyAuthzGuard("sweep", "register", func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			respondJSON(w, 503, map[string]string{"error": "postgres unavailable — fail-closed"})
			return
		}
		if r.Method == http.MethodGet {
			items, err := dbListSweeps()
			if err != nil {
				respondJSON(w, 500, map[string]string{"error": "list failed: " + err.Error()})
				return
			}
			respondJSON(w, 200, map[string]interface{}{"items": items, "total": len(items), "source": "postgres"})
			return
		}
		if r.Method == http.MethodPost {
			var req SweepExecRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				respondJSON(w, 400, map[string]string{"error": "invalid JSON"})
				return
			}
			if req.PoolID == "" {
				respondJSON(w, 400, map[string]string{"error": "poolId is required"})
				return
			}
			newSweeps, err := dbExecuteSweep(req.PoolID)
			if err != nil {
				respondJSON(w, 500, map[string]string{"error": "sweep execution failed: " + err.Error()})
				return
			}
			if newSweeps == nil {
				respondJSON(w, 404, map[string]string{"error": "pool not found"})
				return
			}
			respondJSON(w, 201, map[string]interface{}{"executed": len(newSweeps), "sweeps": newSweeps})
			return
		}
		respondJSON(w, 405, map[string]string{"error": "method not allowed"})
	}))

	mux.HandleFunc("/v1/cash-pooling/stats", permifyAuthzGuard("sweep", "view", func(w http.ResponseWriter, _ *http.Request) {
		if db == nil {
			respondJSON(w, 503, map[string]string{"error": "postgres unavailable — fail-closed"})
			return
		}
		poolsList, err := dbListPools()
		if err != nil {
			respondJSON(w, 500, map[string]string{"error": "stats failed: " + err.Error()})
			return
		}
		totalPoolBalance := 0.0
		totalChildAccounts := 0
		byType := map[string]int{}
		for _, p := range poolsList {
			byType[p.PoolType]++
			for _, c := range p.ChildAccounts {
				totalPoolBalance += c.Balance
				totalChildAccounts++
			}
		}
		var sweepCount int
		var totalSwept float64
		if err = db.QueryRow(`SELECT count(*), COALESCE(sum(amount), 0) FROM sweep_transactions`).Scan(&sweepCount, &totalSwept); err != nil {
			respondJSON(w, 500, map[string]string{"error": "stats failed: " + err.Error()})
			return
		}
		respondJSON(w, 200, map[string]interface{}{
			"totalPools": len(poolsList), "totalChildAccounts": totalChildAccounts,
			"totalPoolBalance": totalPoolBalance, "totalSweepTransactions": sweepCount,
			"totalSweptAmount": totalSwept, "source": "postgres",
			"byType": byType,
		})
	}))

	port := envOr("PORT", "8159")
	fmt.Printf("Cash Pooling service on :%s\n", port)
	(&http.Server{Addr: ":" + port, Handler: rateLimitMiddleware(jwtAuthMiddleware(countingMiddleware(mux))), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second}).ListenAndServe()
}

// healthHandler serves /healthz (extracted from the inline closure in main; behavior unchanged).
func healthHandler(w http.ResponseWriter, _ *http.Request) {
	respondJSON(w, 200, map[string]interface{}{
		"status": "ok", "service": "cash-pooling",
		"middleware": map[string]interface{}{
			"kafka":       map[string]interface{}{"broker": envOr("KAFKA_BROKER", "localhost:9092"), "topics": []string{"cp.sweep.executed", "cp.pool.created", "cp.balance.update"}},
			"redis":       map[string]interface{}{"url": envOr("REDIS_URL", "redis://localhost:6379"), "cache_keys": []string{"cp:pools", "cp:balances", "cp:sweep_schedules"}},
			"postgres":    map[string]interface{}{"url": os.Getenv("DATABASE_URL"), "tables": []string{"cp_pools", "cp_child_accounts", "cp_sweep_transactions"}},
			"opensearch":  map[string]interface{}{"url": envOr("OPENSEARCH_URL", "http://localhost:9200"), "indices": []string{"cp-sweeps", "cp-audit"}},
			"keycloak":    map[string]interface{}{"url": envOr("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "client": "cash-pooling-service"},
			"permify":     map[string]interface{}{"url": envOr("PERMIFY_URL", "http://localhost:3476"), "resources": []string{"cash_pool", "sweep_transaction"}},
			"dapr":        map[string]interface{}{"url": envOr("DAPR_URL", "http://localhost:3500"), "app_id": "cash-pooling", "pubsub": "cp-events"},
			"fluvio":      map[string]interface{}{"url": envOr("FLUVIO_URL", "localhost:9003"), "topics": []string{"cp-balance-stream", "cp-sweep-stream"}},
			"temporal":    map[string]interface{}{"url": envOr("TEMPORAL_URL", "localhost:7233"), "workflows": []string{"SweepExecutionWorkflow", "BalanceReconWorkflow", "NotionalPoolingWorkflow"}},
			"mojaloop":    map[string]interface{}{"url": envOr("MOJALOOP_URL", "http://localhost:3002"), "usage": "interbank-sweep-settlement"},
			"tigerbeetle": map[string]interface{}{"url": envOr("TIGERBEETLE_URL", "localhost:3000"), "ledgers": []string{"cp_header_accounts", "cp_child_accounts", "cp_sweep_entries"}},
			"lakehouse":   map[string]interface{}{"url": envOr("LAKEHOUSE_URL", "http://localhost:8181"), "tables": []string{"cp_sweep_history", "cp_balance_snapshots"}},
			"apisix":      map[string]interface{}{"url": envOr("APISIX_URL", "http://localhost:9080"), "routes": []string{"/api/cash-pooling/*"}},
			"openappsec":  map[string]interface{}{"url": envOr("OPENAPPSEC_URL", "http://localhost:4000"), "policy": "cp-waf-rules"},
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
	fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"cash-pooling-go\"} %d\n", reqs)
	fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"cash-pooling-go\"} %d\n", errs)
	fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"cash-pooling-go\"} %.0f\n", time.Since(_bootTime).Seconds())
}

func readyzHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(200)
	fmt.Fprintf(w, `{"ready":true,"service":"cash-pooling-go"}`)
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
