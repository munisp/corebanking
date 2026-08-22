package main

import (
	"bytes"
	"context"
	"crypto"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"crypto/rsa"
	"crypto/sha256"
	_ "github.com/lib/pq"
	"math/big"
)

var serviceName = "langchain-agent-go"
var db *sql.DB
var requestCount uint64
var errorCount uint64

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
func sanitizeInput(s string) string {
	s = strings.ReplaceAll(s, "<script>", "")
	s = strings.ReplaceAll(s, "</script>", "")
	s = strings.ReplaceAll(s, "javascript:", "")
	if len(s) > 10240 {
		s = s[:10240]
	}
	return s
}
func checkJWT(r *http.Request) error {
	if strings.HasPrefix(r.URL.Path, "/healthz") || strings.HasPrefix(r.URL.Path, "/readyz") || strings.HasPrefix(r.URL.Path, "/livez") || strings.HasPrefix(r.URL.Path, "/metrics") {
		return nil
	}
	auth := r.Header.Get("Authorization")
	if !strings.HasPrefix(auth, "Bearer ") {
		return fmt.Errorf("unauthorized")
	}
	return nil
}

var rlTokens int64 = 100
var rlLastRefill int64

func rlAllow() bool {
	now := time.Now().Unix()
	if now > atomic.LoadInt64(&rlLastRefill) {
		atomic.StoreInt64(&rlTokens, 100)
		atomic.StoreInt64(&rlLastRefill, now)
	}
	return atomic.AddInt64(&rlTokens, -1) >= 0
}
func dbSourceTag() string {
	if os.Getenv("DATABASE_URL") != "" {
		return "postgres"
	}
	return "in-memory"
}
func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		return
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("DB open error: %v", err)
		return
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
}
func dbInsert(id, svc, tenant, status string, data []byte) error {
	if db == nil {
		log.Printf("dbInsert(%s): no db", id)
		return fmt.Errorf("no db")
	}
	_, err := db.Exec("INSERT INTO records (id,service,tenant,status,data,created_at) VALUES ($1,$2,$3,$4,$5,NOW()) ON CONFLICT (id) DO UPDATE SET data=$5", id, svc, tenant, status, data)
	return err
}
func cacheGet(_ string) (string, bool) { return "", false }
func cacheSet(_, _ string, _ int)      {}
func getTLSConfig() (bool, string, string) {
	c := os.Getenv("TLS_CERT_PATH")
	k := os.Getenv("TLS_KEY_PATH")
	if c != "" && k != "" {
		return true, c, k
	}
	return false, "", ""
}
func callService(method, url string, body interface{}) (map[string]interface{}, error) {
	var reqBody io.Reader
	if body != nil {
		j, _ := json.Marshal(body)
		j = []byte(sanitizeInput(string(j)))
		reqBody = bytes.NewBuffer(j)
	}
	for i := 0; i < 3; i++ {
		req, _ := http.NewRequest(method, url, reqBody)
		req.Header.Set("Content-Type", "application/json")
		resp, err := (&http.Client{Timeout: 5 * time.Second}).Do(req)
		if err != nil {
			time.Sleep(time.Duration(i+1) * 500 * time.Millisecond)
			continue
		}
		defer resp.Body.Close()
		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)
		return result, nil
	}
	return nil, fmt.Errorf("all retries failed")
}
func jsonResp(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}
func securityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		w.Header().Set("Content-Security-Policy", "default-src 'self'")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		next.ServeHTTP(w, r)
	})
}
func rateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { atomic.AddUint64(&requestCount, 1); next.ServeHTTP(w, r) })
}

// --- JWT Validation (JWKS-aware) ---

// ── MIDDLEWARE: JWT Validation (JWKS / RS256) — fail-closed ────────────────

type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}

func jwtRealmURL() string {
	if v := os.Getenv("KEYCLOAK_REALM_URL"); v != "" {
		return v
	}
	return "http://keycloak:8080/realms/54bank"
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

// jwtAuthMiddleware validates Bearer tokens against the Keycloak JWKS endpoint (RS256
// signature + expiry). Fail-closed: no token is accepted on structure alone.
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
			fmt.Fprintf(w, `{"error":"unauthorized","service":"langchain-agent-go"}`)
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			http.Error(w, `{"error":"malformed token"}`, http.StatusUnauthorized)
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
		ctx := context.WithValue(r.Context(), "jwt_claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
func metricsHandler(w http.ResponseWriter, _ *http.Request) {
	r2 := atomic.LoadUint64(&requestCount)
	e2 := atomic.LoadUint64(&errorCount)
	w.Header().Set("Content-Type", "text/plain")
	fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"%s\"} %d\n# TYPE errors_total counter\nerrors_total{service=\"%s\"} %d\n", serviceName, r2, serviceName, e2)
}
func healthHandler(w http.ResponseWriter, _ *http.Request) {
	jsonResp(w, 200, map[string]interface{}{"status": "healthy", "service": serviceName})
}
func readyHandler(w http.ResponseWriter, _ *http.Request) {
	jsonResp(w, 200, map[string]interface{}{"ready": true, "service": serviceName})
}
func liveHandler(w http.ResponseWriter, _ *http.Request) {
	jsonResp(w, 200, map[string]interface{}{"live": true})
}

func agent_queryHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-Id")
	if tenantID == "" {
		tenantID = "platform"
	}
	atomic.AddUint64(&requestCount, 1)
	if !rlAllow() {
		jsonResp(w, 429, map[string]string{"error": "rate_limit_exceeded"})
		return
	}
	if err := checkJWT(r); err != nil {
		jsonResp(w, 401, map[string]string{"error": "unauthorized"})
		return
	}
	body, _ := io.ReadAll(io.LimitReader(r.Body, 10240))
	body = []byte(sanitizeInput(string(body)))
	var input map[string]interface{}
	json.Unmarshal(body, &input)
	dbData, _ := json.Marshal(input)
	dbInsert(fmt.Sprintf("agent_query_%d", time.Now().UnixNano()), serviceName, "default", "active", dbData)
	cacheSet(tenantID+":"+"agent_query_last", string(body), 300)
	upstreamURL := envOr("GL_ENGINE_URL", "http://gl-engine-go:8080")
	callService("POST", upstreamURL+"/v1/notify", map[string]interface{}{"source": serviceName, "action": "agent_query"})
	jsonResp(w, 200, map[string]interface{}{"service": serviceName, "endpoint": "agent_query", "result": input, "source": dbSourceTag()})
}

func list_toolsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-Id")
	if tenantID == "" {
		tenantID = "platform"
	}
	atomic.AddUint64(&requestCount, 1)
	if !rlAllow() {
		jsonResp(w, 429, map[string]string{"error": "rate_limit_exceeded"})
		return
	}
	if err := checkJWT(r); err != nil {
		jsonResp(w, 401, map[string]string{"error": "unauthorized"})
		return
	}
	cached, _ := cacheGet(tenantID + ":" + "list_tools")
	_ = cached
	jsonResp(w, 200, map[string]interface{}{"service": serviceName, "endpoint": "list_tools", "items": []interface{}{}, "source": dbSourceTag()})
}

func run_chainHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-Id")
	if tenantID == "" {
		tenantID = "platform"
	}
	atomic.AddUint64(&requestCount, 1)
	if !rlAllow() {
		jsonResp(w, 429, map[string]string{"error": "rate_limit_exceeded"})
		return
	}
	if err := checkJWT(r); err != nil {
		jsonResp(w, 401, map[string]string{"error": "unauthorized"})
		return
	}
	body, _ := io.ReadAll(io.LimitReader(r.Body, 10240))
	body = []byte(sanitizeInput(string(body)))
	var input map[string]interface{}
	json.Unmarshal(body, &input)
	dbData, _ := json.Marshal(input)
	dbInsert(fmt.Sprintf("run_chain_%d", time.Now().UnixNano()), serviceName, "default", "active", dbData)
	cacheSet(tenantID+":"+"run_chain_last", string(body), 300)
	upstreamURL := envOr("GL_ENGINE_URL", "http://gl-engine-go:8080")
	callService("POST", upstreamURL+"/v1/notify", map[string]interface{}{"source": serviceName, "action": "run_chain"})
	jsonResp(w, 200, map[string]interface{}{"service": serviceName, "endpoint": "run_chain", "result": input, "source": dbSourceTag()})
}

func createHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-Id")
	if tenantID == "" {
		tenantID = "platform"
	}
	atomic.AddUint64(&requestCount, 1)
	if !rlAllow() {
		jsonResp(w, 429, map[string]string{"error": "rate_limit_exceeded"})
		return
	}
	if err := checkJWT(r); err != nil {
		jsonResp(w, 401, map[string]string{"error": "unauthorized"})
		return
	}
	body, _ := io.ReadAll(io.LimitReader(r.Body, 10240))
	body = []byte(sanitizeInput(string(body)))
	dbInsert(fmt.Sprintf("create_%d", time.Now().UnixNano()), serviceName, "default", "active", body)
	cacheSet(tenantID+":"+"last_create", string(body), 300)
	jsonResp(w, 201, map[string]interface{}{"created": true})
}

// ─── Domain Logic: Langchain Agent ────────────────────────────────────────────

func validateRequest(requestType string, payload map[string]interface{}) (bool, string) {
	if requestType == "" {
		return false, "Request type required"
	}
	if len(payload) == 0 {
		return false, "Payload required"
	}
	return true, "Request valid"
}

func computeMetrics(items []map[string]interface{}) map[string]interface{} {
	total := len(items)
	active := 0
	for _, item := range items {
		if status, ok := item["status"].(string); ok && status == "active" {
			active++
		}
	}
	return map[string]interface{}{"total": total, "active": active, "inactive": total - active, "utilization": float64(active) / float64(total+1) * 100}
}

// --- Circuit Breaker + Retry (Production) ---
type circuitBreaker struct {
	failures    int
	lastFailure time.Time
	threshold   int
	resetAfter  time.Duration
	mu          sync.Mutex
}

func (cb *circuitBreaker) allow() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	if cb.failures >= cb.threshold {
		if time.Since(cb.lastFailure) > cb.resetAfter {
			cb.failures = cb.threshold / 2
			return true
		}
		return false
	}
	return true
}

func (cb *circuitBreaker) recordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	if cb.failures > 0 {
		cb.failures--
	}
}

func (cb *circuitBreaker) recordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.failures++
	cb.lastFailure = time.Now()
}

var _cb = &circuitBreaker{threshold: 5, resetAfter: 30 * time.Second}

func callServiceWithRetry(method, url string, body interface{}) (map[string]interface{}, error) {
	if !_cb.allow() {
		return nil, fmt.Errorf("circuit breaker open for %s", url)
	}
	client := &http.Client{Timeout: 15 * time.Second}
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Duration(1<<uint(attempt)) * 200 * time.Millisecond)
		}
		var req *http.Request
		if body != nil {
			jsonData, _ := json.Marshal(body)
			req, _ = http.NewRequest(method, url, bytes.NewBuffer(jsonData))
		} else {
			req, _ = http.NewRequest(method, url, nil)
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Source-Service", serviceName)
		resp, err := client.Do(req)
		if err != nil {
			lastErr = err
			_cb.recordFailure()
			log.Printf("[%s] %s %s attempt %d failed: %v", serviceName, method, url, attempt+1, err)
			continue
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 500 {
			lastErr = fmt.Errorf("upstream %s returned %d", url, resp.StatusCode)
			_cb.recordFailure()
			continue
		}
		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)
		_cb.recordSuccess()
		return result, nil
	}
	return nil, fmt.Errorf("all retries exhausted for %s: %w", url, lastErr)
}

// --- Alerting ---
type alertManager struct {
	rules []alertRule
	mu    sync.RWMutex
}

type alertRule struct {
	Name      string
	Metric    string
	Threshold float64
	Severity  string
}

var _alertMgr = &alertManager{
	rules: []alertRule{
		{"high_error_rate", "error_rate", 0.05, "critical"},
		{"high_latency", "p99_latency_ms", 5000, "warning"},
		{"db_connection_failures", "db_failures", 3, "critical"},
	},
}

func (am *alertManager) check() []map[string]interface{} {
	var fired []map[string]interface{}
	errRate := float64(atomic.LoadUint64(&_errCount)) / float64(max64(atomic.LoadUint64(&_reqCount), 1))
	if errRate > 0.05 {
		fired = append(fired, map[string]interface{}{"rule": "high_error_rate", "value": errRate, "severity": "critical"})
	}
	return fired
}

func max64(a, b uint64) uint64 {
	if a > b {
		return a
	}
	return b
}

func alertsHandler(w http.ResponseWriter, r *http.Request) {
	jsonResp(w, 200, map[string]interface{}{"alerts": _alertMgr.check(), "rules": len(_alertMgr.rules)})
}

// --- Integration Tests ---
func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func main() {
	initDB()
	tlsEnabled, tlsCert, tlsKey := getTLSConfig()
	_ = tlsCert
	_ = tlsKey
	_ = tlsEnabled

	mux := http.NewServeMux()
	mux.HandleFunc("/v1/alerts", alertsHandler)
	mux.HandleFunc("/healthz", healthHandler)
	mux.HandleFunc("/readyz", readyHandler)
	mux.HandleFunc("/livez", liveHandler)
	mux.HandleFunc("/metrics", metricsHandler)
	mux.HandleFunc("/v1/agent/query", agent_queryHandler)
	mux.HandleFunc("/v1/agent/tools", list_toolsHandler)
	mux.HandleFunc("/v1/agent/chain", run_chainHandler)
	mux.HandleFunc("/v1/create", createHandler)

	port := envOr("PORT", "8080")
	handler := rateLimitMiddleware(securityHeadersMiddleware(jwtAuthMiddleware(mux)))
	srv := &http.Server{Addr: ":" + port, Handler: handler}
	go func() { log.Printf("[%s] listening on port %s", serviceName, port); srv.ListenAndServe() }()
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)
	<-quit
	log.Println("shutting down")
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
}
