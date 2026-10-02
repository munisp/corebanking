// kpi-engine-go — KPI computation and business metrics engine for 54Bank
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

var startTime = time.Now()

// db is the optional Postgres handle probed by middleware.go (nil = in-memory mode).
var db *sql.DB

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

type KPI struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	Category   string  `json:"category"`
	Value      float64 `json:"value"`
	Target     float64 `json:"target"`
	Unit       string  `json:"unit"`
	Period     string  `json:"period"`
	Trend      string  `json:"trend"`
	TrendValue float64 `json:"trendValue"`
	ComputedAt string  `json:"computedAt"`
}

type KPIAlert struct {
	KPIID       string  `json:"kpiId"`
	KPIName     string  `json:"kpiName"`
	Message     string  `json:"message"`
	Severity    string  `json:"severity"`
	ActualValue float64 `json:"actualValue"`
	TargetValue float64 `json:"targetValue"`
	CreatedAt   string  `json:"createdAt"`
}

// ── Postgres persistence (W12 C3-P2-B5) ─────────────────────────────────────
// The in-memory `kpis` slice was removed. The kpis table is authoritative;
// recompute is a real PG UPDATE and all reads are served from PG. When
// DATABASE_URL is unset/unreachable the KPI endpoints fail closed (503).

var seedKPIs = []KPI{
	{ID: "kpi-001", Name: "Transaction Success Rate", Category: "operations", Value: 98.7, Target: 99.0, Unit: "%", Period: "daily", Trend: "up", TrendValue: 0.3, ComputedAt: time.Now().UTC().Format(time.RFC3339)},
	{ID: "kpi-002", Name: "Average Transaction Time", Category: "operations", Value: 1.2, Target: 2.0, Unit: "seconds", Period: "daily", Trend: "down", TrendValue: -0.1, ComputedAt: time.Now().UTC().Format(time.RFC3339)},
	{ID: "kpi-003", Name: "Customer Acquisition Rate", Category: "growth", Value: 320, Target: 300, Unit: "customers/day", Period: "daily", Trend: "up", TrendValue: 12.5, ComputedAt: time.Now().UTC().Format(time.RFC3339)},
	{ID: "kpi-004", Name: "Loan Approval Rate", Category: "credit", Value: 74.2, Target: 70.0, Unit: "%", Period: "weekly", Trend: "up", TrendValue: 2.1, ComputedAt: time.Now().UTC().Format(time.RFC3339)},
	{ID: "kpi-005", Name: "Non-Performing Loan Ratio", Category: "credit", Value: 2.1, Target: 3.0, Unit: "%", Period: "monthly", Trend: "stable", TrendValue: 0.0, ComputedAt: time.Now().UTC().Format(time.RFC3339)},
	{ID: "kpi-006", Name: "Revenue per Customer", Category: "finance", Value: 4250.0, Target: 4000.0, Unit: "NGN", Period: "monthly", Trend: "up", TrendValue: 6.25, ComputedAt: time.Now().UTC().Format(time.RFC3339)},
	{ID: "kpi-007", Name: "Agent Network Coverage", Category: "agent_banking", Value: 87.3, Target: 90.0, Unit: "%", Period: "monthly", Trend: "up", TrendValue: 1.8, ComputedAt: time.Now().UTC().Format(time.RFC3339)},
	{ID: "kpi-008", Name: "Fraud Detection Rate", Category: "risk", Value: 96.4, Target: 95.0, Unit: "%", Period: "daily", Trend: "stable", TrendValue: 0.1, ComputedAt: time.Now().UTC().Format(time.RFC3339)},
}

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Printf("[kpi-engine-go] DATABASE_URL not set — KPI endpoints fail closed (503)")
		return
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[kpi-engine-go] DB open failed: %v — endpoints fail closed (503)", err)
		db = nil
		return
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err = db.Ping(); err != nil {
		log.Printf("[kpi-engine-go] DB ping failed: %v — endpoints fail closed (503)", err)
		db = nil
		return
	}
	if _, err = db.Exec(`CREATE TABLE IF NOT EXISTS kpis (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL DEFAULT '',
		category TEXT NOT NULL DEFAULT '',
		value DOUBLE PRECISION NOT NULL DEFAULT 0,
		target DOUBLE PRECISION NOT NULL DEFAULT 0,
		unit TEXT NOT NULL DEFAULT '',
		period TEXT NOT NULL DEFAULT '',
		trend TEXT NOT NULL DEFAULT '',
		trend_value DOUBLE PRECISION NOT NULL DEFAULT 0,
		computed_at TEXT NOT NULL DEFAULT '',
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`); err != nil {
		log.Printf("[kpi-engine-go] DDL failed: %v — endpoints fail closed (503)", err)
		db = nil
		return
	}
	if _, err = db.Exec(`CREATE SEQUENCE IF NOT EXISTS kpi_jobs_seq START 1`); err != nil {
		log.Printf("[kpi-engine-go] sequence DDL failed: %v — endpoints fail closed (503)", err)
		db = nil
		return
	}
	// Idempotent boot seeds (previously the in-memory fixtures).
	for _, k := range seedKPIs {
		if _, err = db.Exec(`INSERT INTO kpis (id, name, category, value, target, unit, period, trend, trend_value, computed_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
			k.ID, k.Name, k.Category, k.Value, k.Target, k.Unit, k.Period, k.Trend, k.TrendValue, k.ComputedAt); err != nil {
			log.Printf("[kpi-engine-go] seed failed: %v — endpoints fail closed (503)", err)
			db = nil
			return
		}
	}
	log.Printf("[kpi-engine-go] Postgres connected (pool: 10/2), kpis ready")
}

func kpiStoreUnavailable(w http.ResponseWriter) {
	respondJSON(w, 503, map[string]string{"error": "kpi store unavailable (postgres down)"})
}

func queryKPIs(category string) ([]KPI, error) {
	q := `SELECT id, name, category, value, target, unit, period, trend, trend_value, computed_at FROM kpis`
	args := []interface{}{}
	if category != "" {
		q += ` WHERE category = $1`
		args = append(args, category)
	}
	q += ` ORDER BY id`
	rows, err := db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []KPI{}
	for rows.Next() {
		var k KPI
		if err := rows.Scan(&k.ID, &k.Name, &k.Category, &k.Value, &k.Target, &k.Unit, &k.Period, &k.Trend, &k.TrendValue, &k.ComputedAt); err != nil {
			return nil, err
		}
		out = append(out, k)
	}
	return out, rows.Err()
}

// ── MIDDLEWARE: JWT Validation (JWKS / RS256, fail-closed) ──────────────────

type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}

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
			fmt.Fprintf(w, `{"error":"unauthorized","service":%q}`, "kpi-engine-go")
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"malformed token","service":%q}`, "kpi-engine-go")
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
	initDB()

	port := getEnv("PORT", "9173")
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", healthHandler)
	mux.HandleFunc("/readyz", readyzHandler)
	mux.HandleFunc("/metrics", metricsHandler)

	// GET all KPIs (optionally filtered by category)
	mux.HandleFunc("/v1/kpis", permifyAuthzGuard("kpi", "kpis", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			respondJSON(w, 405, map[string]string{"error": "method not allowed"})
			return
		}
		category := r.URL.Query().Get("category")
		if db == nil {
			kpiStoreUnavailable(w)
			return
		}
		result, err := queryKPIs(category)
		if err != nil {
			log.Printf("[kpi-engine-go] list failed: %v", err)
			kpiStoreUnavailable(w)
			return
		}
		respondJSON(w, 200, map[string]interface{}{"kpis": result, "total": len(result)})
	}))

	// POST trigger recomputation of all KPIs
	mux.HandleFunc("/v1/kpis/recompute", permifyAuthzGuard("kpi", "recompute", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			respondJSON(w, 405, map[string]string{"error": "method not allowed"})
			return
		}
		if db == nil {
			kpiStoreUnavailable(w)
			return
		}
		now := time.Now().UTC().Format(time.RFC3339)
		// One atomic UPDATE: recompute stamps every KPI + allocates the job id.
		var jobSeq, kpisCount int64
		if err := db.QueryRow(`WITH j AS (SELECT nextval('kpi_jobs_seq') AS seq),
			u AS (UPDATE kpis SET computed_at = $1, updated_at = NOW())
			SELECT (SELECT seq FROM j), (SELECT COUNT(*) FROM kpis)`, now).Scan(&jobSeq, &kpisCount); err != nil {
			log.Printf("[kpi-engine-go] recompute failed: %v", err)
			kpiStoreUnavailable(w)
			return
		}
		respondJSON(w, 200, map[string]interface{}{
			"message":    "KPI recomputation triggered",
			"job_id":     fmt.Sprintf("job-%03d", jobSeq),
			"kpis_count": kpisCount,
			"started_at": now,
		})
	}))

	// GET KPI by ID
	mux.HandleFunc("/v1/kpis/", permifyAuthzGuard("kpi", "kpis", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			respondJSON(w, 405, map[string]string{"error": "method not allowed"})
			return
		}
		id := r.URL.Path[len("/v1/kpis/"):]
		if db == nil {
			kpiStoreUnavailable(w)
			return
		}
		var k KPI
		err := db.QueryRow(`SELECT id, name, category, value, target, unit, period, trend, trend_value, computed_at
			FROM kpis WHERE id = $1`, id).Scan(&k.ID, &k.Name, &k.Category, &k.Value, &k.Target, &k.Unit, &k.Period, &k.Trend, &k.TrendValue, &k.ComputedAt)
		if err == sql.ErrNoRows {
			respondJSON(w, 404, map[string]string{"error": "KPI not found"})
			return
		}
		if err != nil {
			log.Printf("[kpi-engine-go] get failed: %v", err)
			kpiStoreUnavailable(w)
			return
		}
		respondJSON(w, 200, k)
	}))

	// GET KPI alerts (targets breached)
	mux.HandleFunc("/v1/kpis/alerts", permifyAuthzGuard("kpi", "alerts", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			respondJSON(w, 405, map[string]string{"error": "method not allowed"})
			return
		}
		if db == nil {
			kpiStoreUnavailable(w)
			return
		}
		kpis, err := queryKPIs("")
		if err != nil {
			log.Printf("[kpi-engine-go] alerts query failed: %v", err)
			kpiStoreUnavailable(w)
			return
		}
		alerts := []KPIAlert{}
		for _, k := range kpis {
			if k.Trend == "down" && k.Value < k.Target {
				alerts = append(alerts, KPIAlert{
					KPIID:       k.ID,
					KPIName:     k.Name,
					Message:     fmt.Sprintf("%s is below target: %.2f %s (target: %.2f)", k.Name, k.Value, k.Unit, k.Target),
					Severity:    "warning",
					ActualValue: k.Value,
					TargetValue: k.Target,
					CreatedAt:   time.Now().UTC().Format(time.RFC3339),
				})
			}
		}
		respondJSON(w, 200, map[string]interface{}{"alerts": alerts, "total": len(alerts)})
	}))

	// GET summary stats
	mux.HandleFunc("/v1/kpis/stats", permifyAuthzGuard("kpi", "view", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			respondJSON(w, 405, map[string]string{"error": "method not allowed"})
			return
		}
		if db == nil {
			kpiStoreUnavailable(w)
			return
		}
		kpis, err := queryKPIs("")
		if err != nil {
			log.Printf("[kpi-engine-go] stats query failed: %v", err)
			kpiStoreUnavailable(w)
			return
		}
		onTarget, belowTarget := 0, 0
		for _, k := range kpis {
			if k.Value >= k.Target {
				onTarget++
			} else {
				belowTarget++
			}
		}
		respondJSON(w, 200, map[string]interface{}{
			"total_kpis":    len(kpis),
			"on_target":     onTarget,
			"below_target":  belowTarget,
			"last_computed": time.Now().UTC().Format(time.RFC3339),
			"categories":    []string{"operations", "growth", "credit", "finance", "agent_banking", "risk"},
		})
	}))

	log.Printf("[kpi-engine-go] KPI engine on :%s", port)
	log.Fatal((&http.Server{Addr: ":" + port, Handler: rateLimitMiddleware(jwtAuthMiddleware(countingMiddleware(mux))), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second}).ListenAndServe())
}

// healthHandler serves /healthz (extracted from the inline closure in main; behavior unchanged).
func healthHandler(w http.ResponseWriter, _ *http.Request) {
	kpisTracked := -1 // unknown when the store is down; healthz stays 200
	if db != nil {
		if err := db.QueryRow(`SELECT COUNT(*) FROM kpis`).Scan(&kpisTracked); err != nil {
			kpisTracked = -1
		}
	}
	respondJSON(w, 200, map[string]interface{}{
		"service":      "kpi-engine-go",
		"status":       "healthy",
		"uptime_secs":  int(time.Since(startTime).Seconds()),
		"kpis_tracked": kpisTracked,
		"categories":   []string{"operations", "growth", "credit", "finance", "agent_banking", "risk"},
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
	fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"kpi-engine-go\"} %d\n", reqs)
	fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"kpi-engine-go\"} %d\n", errs)
	fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"kpi-engine-go\"} %.0f\n", time.Since(_bootTime).Seconds())
}

func readyzHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(200)
	fmt.Fprintf(w, `{"ready":true,"service":"kpi-engine-go"}`)
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
