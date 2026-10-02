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

var port = getEnv("PORT", "8221")

var middlewareConfig = map[string]interface{}{
	"kafka":       map[string]string{"broker": getEnv("KAFKA_BROKER", "localhost:9092"), "topics": "mandate.created,mandate.activated,mandate.executed,mandate.cancelled"},
	"redis":       map[string]string{"url": getEnv("REDIS_URL", "redis://localhost:6379"), "purpose": "mandate-cache,execution-tracker"},
	"postgres":    map[string]string{"url": os.Getenv("DATABASE_URL"), "tables": "mandates,mandate_executions,mandate_disputes"},
	"opensearch":  map[string]string{"url": getEnv("OPENSEARCH_URL", "http://localhost:9200"), "index": "mandate-history"},
	"keycloak":    map[string]string{"url": getEnv("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "role": "operations-officer"},
	"permify":     map[string]string{"url": getEnv("PERMIFY_URL", "http://localhost:3476"), "schema": "mandate:create,mandate:activate,mandate:cancel,mandate:dispute"},
	"dapr":        map[string]string{"url": getEnv("DAPR_URL", "http://localhost:3500"), "pubsub": "mandate-events"},
	"fluvio":      map[string]string{"url": getEnv("FLUVIO_URL", "localhost:9003"), "topic": "mandate-executions"},
	"temporal":    map[string]string{"url": getEnv("TEMPORAL_URL", "localhost:7233"), "workflow": "MandateExecutionWorkflow"},
	"mojaloop":    map[string]string{"url": getEnv("MOJALOOP_URL", "http://localhost:4000"), "purpose": "nibss-mandate-sync"},
	"tigerbeetle": map[string]string{"url": getEnv("TIGERBEETLE_URL", "localhost:3000"), "purpose": "mandate-debit-ledger"},
	"lakehouse":   map[string]string{"url": getEnv("LAKEHOUSE_URL", "http://localhost:8206"), "tables": "mandate_analytics"},
	"apisix":      map[string]string{"url": getEnv("APISIX_URL", "http://localhost:9080"), "route": "/mandates/*"},
	"openappsec":  map[string]string{"url": getEnv("OPENAPPSEC_URL", "http://localhost:8090")},
}

type Mandate struct {
	ID           string  `json:"id"`
	AccountNo    string  `json:"accountNumber"`
	AccountName  string  `json:"accountName"`
	Beneficiary  string  `json:"beneficiary"`
	MandateRef   string  `json:"nibssMandateRef"`
	Type         string  `json:"type"`
	Amount       float64 `json:"amount"`
	Currency     string  `json:"currency"`
	Frequency    string  `json:"frequency"`
	Status       string  `json:"status"`
	StartDate    string  `json:"startDate"`
	EndDate      string  `json:"endDate"`
	NextExec     string  `json:"nextExecutionDate"`
	TotalExec    int     `json:"totalExecutions"`
	TotalDebited float64 `json:"totalDebited"`
}

// ── Persistence (wave-12 C3-P0-B7) ─────────────────────────────────────────
// Mandates are Postgres-authoritative (typed table mandates; the register's
// proposed name — NOTE: nibss-nip-engine-go also owns a `mandates` table per
// its register entry; these services are deployed against separate databases
// per fleet convention, so the names do not collide). The in-memory slice
// was removed: list/stats/health are served from PG. Fail-closed 503 when
// DATABASE_URL is unset/down.
var db *sql.DB

const mandateDDL = `
CREATE TABLE IF NOT EXISTS mandates (
    id            text PRIMARY KEY,
    tenant_id     text NOT NULL DEFAULT '',
    account_no    text NOT NULL DEFAULT '',
    account_name  text NOT NULL DEFAULT '',
    beneficiary   text NOT NULL DEFAULT '',
    mandate_ref   text NOT NULL DEFAULT '' UNIQUE,
    type          text NOT NULL DEFAULT '',
    amount        double precision NOT NULL DEFAULT 0,
    currency      text NOT NULL DEFAULT 'NGN',
    frequency     text NOT NULL DEFAULT '',
    status        text NOT NULL DEFAULT 'created',
    start_date    text NOT NULL DEFAULT '',
    end_date      text NOT NULL DEFAULT '',
    next_exec     text NOT NULL DEFAULT '',
    total_exec    integer NOT NULL DEFAULT 0,
    total_debited double precision NOT NULL DEFAULT 0,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mandates_status ON mandates (status);
`

func initDB() {
	dsn := getEnv("DATABASE_URL", "")
	if dsn == "" {
		log.Printf("[mandate-management] DATABASE_URL not set — endpoints fail-closed (503)")
		return
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[mandate-management] pg open failed: %v — fail-closed (503)", err)
		db = nil
		return
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err = db.Ping(); err != nil {
		log.Printf("[mandate-management] pg ping failed: %v — fail-closed (503)", err)
		db = nil
		return
	}
	if _, err = db.Exec(mandateDDL); err != nil {
		log.Fatalf("[mandate-management] DDL failed: %v", err)
	}
	log.Printf("[mandate-management] postgres authoritative store ready (mandates)")
}

func dbListMandates() ([]Mandate, error) {
	rows, err := db.Query(`SELECT id, account_no, account_name, beneficiary, mandate_ref, type, amount, currency, frequency, status, start_date, end_date, next_exec, total_exec, total_debited FROM mandates ORDER BY created_at, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Mandate{}
	for rows.Next() {
		var m Mandate
		if err := rows.Scan(&m.ID, &m.AccountNo, &m.AccountName, &m.Beneficiary, &m.MandateRef, &m.Type, &m.Amount, &m.Currency, &m.Frequency, &m.Status, &m.StartDate, &m.EndDate, &m.NextExec, &m.TotalExec, &m.TotalDebited); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func jsonResponse(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Service", "mandate-management")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
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
			fmt.Fprintf(w, `{"error":"unauthorized","service":%q}`, "mandate-management-go")
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"malformed token","service":%q}`, "mandate-management-go")
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
	mux.HandleFunc("/v1/mandates", permifyAuthzGuard("mandate_management", "manage", func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			jsonResponse(w, 503, map[string]string{"error": "postgres unavailable — fail-closed"})
			return
		}
		items, err := dbListMandates()
		if err != nil {
			jsonResponse(w, 500, map[string]string{"error": "list failed: " + err.Error()})
			return
		}
		jsonResponse(w, 200, map[string]interface{}{"items": items, "total": len(items), "source": "postgres"})
	}))
	mux.HandleFunc("/v1/stats", permifyAuthzGuard("mandate_management", "view", func(w http.ResponseWriter, r *http.Request) {
		if db == nil {
			jsonResponse(w, 503, map[string]string{"error": "postgres unavailable — fail-closed"})
			return
		}
		var total, active, suspended, totalExec int
		var totalDebited float64
		if err := db.QueryRow(`SELECT count(*),
		        count(*) FILTER (WHERE status = 'active'),
		        count(*) FILTER (WHERE status = 'suspended'),
		        COALESCE(sum(total_debited), 0),
		        COALESCE(sum(total_exec), 0) FROM mandates`).
			Scan(&total, &active, &suspended, &totalDebited, &totalExec); err != nil {
			jsonResponse(w, 500, map[string]string{"error": "stats failed: " + err.Error()})
			return
		}
		types := map[string]int{}
		rows, err := db.Query(`SELECT type, count(*) FROM mandates GROUP BY type`)
		if err != nil {
			jsonResponse(w, 500, map[string]string{"error": "stats failed: " + err.Error()})
			return
		}
		defer rows.Close()
		for rows.Next() {
			var t string
			var c int
			if err := rows.Scan(&t, &c); err == nil {
				types[t] = c
			}
		}
		jsonResponse(w, 200, map[string]interface{}{
			"totalMandates": total, "active": active, "suspended": suspended,
			"totalDebited": totalDebited, "totalExecutions": totalExec,
			"source": "postgres",
			"types":  types,
		})
	}))

	mandateCount := 0
	if db != nil {
		_ = db.QueryRow(`SELECT count(*) FROM mandates`).Scan(&mandateCount)
	}
	log.Printf("[mandate-management] Listening on :%s with %d mandates\n", port, mandateCount)
	log.Fatal((&http.Server{Addr: ":" + port, Handler: rateLimitMiddleware(jwtAuthMiddleware(countingMiddleware(mux))), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second}).ListenAndServe())
}

// healthHandler serves /healthz (extracted from the inline closure in main; behavior unchanged).
func healthHandler(w http.ResponseWriter, r *http.Request) {
	total, active := 0, 0
	if db != nil {
		_ = db.QueryRow(`SELECT count(*), count(*) FILTER (WHERE status = 'active') FROM mandates`).Scan(&total, &active)
	}
	jsonResponse(w, 200, map[string]interface{}{
		"status": "healthy", "service": "mandate-management",
		"mandates":   map[string]int{"total": total, "active": active},
		"middleware": middlewareConfig,
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
	fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"mandate-management-go\"} %d\n", reqs)
	fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"mandate-management-go\"} %d\n", errs)
	fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"mandate-management-go\"} %.0f\n", time.Since(_bootTime).Seconds())
}

func readyzHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(200)
	fmt.Fprintf(w, `{"ready":true,"service":"mandate-management-go"}`)
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
