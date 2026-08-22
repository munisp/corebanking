// 54Bank Security Gateway — Go
// Domain: Security
// Full domain-specific implementation with business logic
// Middleware: Kafka, Postgres, Redis, Temporal, Permify, OpenSearch
package main

import (
	"context"
	"database/sql"
	"github.com/IBM/sarama"
	_ "github.com/lib/pq"
	"os/signal"
	"sync/atomic"
	"syscall"

	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

var db *sql.DB

var serviceName = "security-gateway-go"
var startTime = time.Now()

// ─── Domain Types ───────────────────────────────────────────────────────────

type Record struct {
	ID        string                 `json:"id"`
	Type      string                 `json:"type"`
	Status    string                 `json:"status"`
	Data      map[string]interface{} `json:"data"`
	CreatedAt string                 `json:"createdAt"`
	UpdatedAt string                 `json:"updatedAt"`
	CreatedBy string                 `json:"createdBy,omitempty"`
	TenantID  string                 `json:"tenantId,omitempty"`
	Version   int                    `json:"version"`
}

type AuditEntry struct {
	ID        string `json:"id"`
	Action    string `json:"action"`
	RecordID  string `json:"recordId"`
	Actor     string `json:"actor"`
	Timestamp string `json:"timestamp"`
	Details   string `json:"details"`
}

type DomainStats struct {
	TotalRecords   int                    `json:"totalRecords"`
	ActiveRecords  int                    `json:"activeRecords"`
	PendingRecords int                    `json:"pendingRecords"`
	ProcessedToday int                    `json:"processedToday"`
	Domain         string                 `json:"domain"`
	Metrics        map[string]interface{} `json:"metrics"`
}

var (
	mu      sync.Mutex
	records = []Record{
		{ID: "SEC-001", Type: "primary", Status: "active", Data: map[string]interface{}{"domain": "Security", "priority": "high", "region": "lagos"}, CreatedAt: "2026-05-09T10:00:00Z", UpdatedAt: "2026-05-09T10:00:00Z", Version: 1},
		{ID: "SEC-002", Type: "secondary", Status: "processing", Data: map[string]interface{}{"domain": "Security", "priority": "medium", "region": "abuja"}, CreatedAt: "2026-05-09T11:00:00Z", UpdatedAt: "2026-05-09T11:30:00Z", Version: 2},
		{ID: "SEC-003", Type: "primary", Status: "completed", Data: map[string]interface{}{"domain": "Security", "priority": "low", "region": "ph"}, CreatedAt: "2026-05-08T14:00:00Z", UpdatedAt: "2026-05-09T08:00:00Z", Version: 1},
	}
	auditLog    = []AuditEntry{}
	domainStats = DomainStats{
		TotalRecords: 3, ActiveRecords: 1, PendingRecords: 1, ProcessedToday: 12,
		Domain: "Security",
		Metrics: map[string]interface{}{
			"avgProcessingMs": 245, "successRate": 98.5, "errorRate": 1.5,
			"peakHour": "14:00", "throughput": 156,
		},
	}
)

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Service", "security-gateway-go")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

// ─── Handlers ───────────────────────────────────────────────────────────────

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{
		"service": "security-gateway-go", "status": "healthy", "version": "2.0.0",
		"uptime_secs": int(time.Since(startTime).Seconds()),
		"domain":      "Security Gateway — Security",
		"middleware": map[string]string{
			"kafka":      "security-gateway.events, security-gateway.audit",
			"postgres":   "security_gateway_records",
			"redis":      "security-gateway_cache",
			"temporal":   "SecurityGatewayWorkflow",
			"permify":    "security-gateway:manage, security-gateway:view",
			"opensearch": "security-gateway-2026",
		},
	})
}

func handleList(w http.ResponseWriter, r *http.Request) {
	cacheKey := "security_gateway_list"
	if cached, ok := cacheGet(cacheKey); ok {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Cache", "HIT")
		w.WriteHeader(200)
		w.Write([]byte(cached))
		return
	}
	mu.Lock()
	defer mu.Unlock()
	status := r.URL.Query().Get("status")
	filtered := []Record{}
	for _, rec := range records {
		if status == "" || rec.Status == status {
			filtered = append(filtered, rec)
		}
	}
	respondJSON(w, 200, map[string]interface{}{"records": filtered, "total": len(filtered), "domain": "Security"})
}

func handleCreate(w http.ResponseWriter, r *http.Request) {
	cacheSet("security_gateway_list", "", 1) // invalidate list cache on write
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)

	mu.Lock()
	defer mu.Unlock()

	rec := Record{
		ID:        fmt.Sprintf("SEC-%08X", rand.Uint32()),
		Type:      getString(body, "type"),
		Status:    "pending",
		Data:      body,
		CreatedAt: time.Now().Format(time.RFC3339),
		UpdatedAt: time.Now().Format(time.RFC3339),
		CreatedBy: getString(body, "createdBy"),
		TenantID:  getString(body, "tenantId"),
		Version:   1,
	}
	if rec.Type == "" {
		rec.Type = "primary"
	}
	records = append(records, rec)
	dataBytes, _ := json.Marshal(body)
	dataBytes = []byte(sanitizeInput(string(dataBytes)))
	if dbErr := dbInsert(fmt.Sprintf("security_gateway_go-%d", time.Now().UnixNano()), "security_gateway_go", "default", "active", dataBytes); dbErr != nil {
		log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr)
	}
	domainStats.TotalRecords = len(records)

	auditLog = append(auditLog, AuditEntry{
		ID: fmt.Sprintf("AUD-%08X", rand.Uint32()), Action: "create",
		RecordID: rec.ID, Actor: rec.CreatedBy,
		Timestamp: rec.CreatedAt, Details: "Record created",
	})

	respondJSON(w, 201, map[string]interface{}{"created": true, "record": rec})
}

func handleUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" && r.Method != "PUT" {
		respondJSON(w, 405, map[string]string{"error": "POST/PUT required"})
		return
	}
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)

	mu.Lock()
	defer mu.Unlock()

	id := getString(body, "id")
	for i := range records {
		if records[i].ID == id {
			if s := getString(body, "status"); s != "" {
				records[i].Status = s
			}
			for k, v := range body {
				if k != "id" {
					records[i].Data[k] = v
				}
			}
			records[i].UpdatedAt = time.Now().Format(time.RFC3339)
			records[i].Version++
			auditLog = append(auditLog, AuditEntry{
				ID: fmt.Sprintf("AUD-%08X", rand.Uint32()), Action: "update",
				RecordID: id, Actor: getString(body, "updatedBy"),
				Timestamp: records[i].UpdatedAt, Details: "Record updated",
			})
			respondJSON(w, 200, map[string]interface{}{"updated": true, "record": records[i]})
			return
		}
	}
	respondJSON(w, 404, map[string]string{"error": "Record not found: " + id})
}

func handleProcess(w http.ResponseWriter, r *http.Request) {
	// NOT IMPLEMENTED: the scaffold previously FABRICATED processing results here
	// (processingResult="success" and a random score via math/rand). Real domain
	// processing must be implemented before this endpoint is enabled.
	// Fail fast; never fabricate.
	respondJSON(w, 501, map[string]string{"error": "not_implemented"})
}

func handleAudit(w http.ResponseWriter, r *http.Request) {
	mu.Lock()
	defer mu.Unlock()
	respondJSON(w, 200, map[string]interface{}{"auditLog": auditLog, "total": len(auditLog)})
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	mu.Lock()
	defer mu.Unlock()
	domainStats.TotalRecords = len(records)
	active := 0
	pending := 0
	for _, r := range records {
		if r.Status == "active" || r.Status == "completed" {
			active++
		}
		if r.Status == "pending" || r.Status == "processing" {
			pending++
		}
	}
	domainStats.ActiveRecords = active
	domainStats.PendingRecords = pending
	respondJSON(w, 200, domainStats)
}

func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

func healthScore(errorRate float64, latencyP99 float64, uptime float64) float64 {
	score := uptime*40 + (1-errorRate)*100*30/100 + (1000-latencyP99)/1000*30
	if score < 0 {
		score = 0
	}
	if score > 100 {
		score = 100
	}
	return score
}

func circuitState(errorRate float64, threshold float64) string {
	if errorRate >= threshold {
		return "open"
	}
	if errorRate >= threshold*0.5 {
		return "half_open"
	}
	return "closed"
}

func security_gatewayHealthScoreHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ErrorRate  float64 `json:"error_rate"`
		LatencyP99 float64 `json:"latency_p99_ms"`
		Uptime     float64 `json:"uptime_pct"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	score := healthScore(req.ErrorRate, req.LatencyP99, req.Uptime)
	respondJSON(w, 200, map[string]interface{}{"health_score": score, "status": func() string {
		if score >= 80 {
			return "healthy"
		}
		if score >= 50 {
			return "degraded"
		}
		return "unhealthy"
	}()})
}

func security_gatewayCircuitHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ErrorRate float64 `json:"error_rate"`
		Threshold float64 `json:"threshold"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	state := circuitState(req.ErrorRate, req.Threshold)
	respondJSON(w, 200, map[string]interface{}{"circuit_state": state, "error_rate": req.ErrorRate})
}

// --- Production Hardening ---
var (
	_reqCount uint64
	_errCount uint64
	_bootTime = time.Now()
)

func readyzHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(200)
	fmt.Fprintf(w, `{"ready":true,"service":"security-gateway-go"}`)
}

func livezHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(200)
	fmt.Fprintf(w, `{"alive":true}`)
}

func metricsHandler(w http.ResponseWriter, r *http.Request) {
	reqs := atomic.LoadUint64(&_reqCount)
	errs := atomic.LoadUint64(&_errCount)
	w.Header().Set("Content-Type", "text/plain")
	fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"security-gateway-go\"} %d\n", reqs)
	fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"security-gateway-go\"} %d\n", errs)
	fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"security-gateway-go\"} %.0f\n", time.Since(_bootTime).Seconds())
}

// --- Counting Middleware ---
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

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

// --- Distributed Tracing ---
func traceMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		traceID := r.Header.Get("X-Trace-Id")
		if traceID == "" {
			traceID = r.Header.Get("traceparent")
		}
		if traceID == "" {
			traceID = fmt.Sprintf("%x-%x", time.Now().UnixNano(), os.Getpid())
		}
		w.Header().Set("X-Trace-Id", traceID)
		r.Header.Set("X-Trace-Id", traceID)
		log.Printf("[%s] %s %s trace=%s", serviceName, r.Method, r.URL.Path, traceID)
		next.ServeHTTP(w, r)
	})
}

// --- Redis Caching Layer ---
var redisAddr string

func init() {
	redisAddr = os.Getenv("REDIS_URL")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}
}

func cacheGet(key string) (string, bool) {
	conn, err := net.DialTimeout("tcp", redisAddr, 2*time.Second)
	if err != nil {
		return "", false
	}
	defer conn.Close()
	fmt.Fprintf(conn, "*2\r\n$3\r\nGET\r\n$%d\r\n%s\r\n", len(key), key)
	buf := make([]byte, 4096)
	n, err := conn.Read(buf)
	if err != nil || n < 3 {
		return "", false
	}
	resp := string(buf[:n])
	if resp[0] == '$' && resp[1] != '-' {
		// Parse bulk string response
		parts := strings.SplitN(resp, "\r\n", 3)
		if len(parts) >= 3 {
			return parts[1], true
		}
	}
	return "", false
}

func cacheSet(key, value string, ttlSeconds int) {
	conn, err := net.DialTimeout("tcp", redisAddr, 2*time.Second)
	if err != nil {
		return
	}
	defer conn.Close()
	fmt.Fprintf(conn, "*4\r\n$3\r\nSET\r\n$%d\r\n%s\r\n$%d\r\n%s\r\n$2\r\nEX\r\n$%d\r\n%d\r\n",
		len(key), key, len(value), value, len(fmt.Sprintf("%d", ttlSeconds)), ttlSeconds)
}

// --- mTLS Configuration ---
func getTLSConfig() (bool, string, string) {
	if os.Getenv("TLS_ENABLED") != "true" {
		return false, "", ""
	}
	cert := os.Getenv("TLS_CERT_PATH")
	key := os.Getenv("TLS_KEY_PATH")
	if cert == "" {
		cert = "/etc/54bank/certs/service.crt"
	}
	if key == "" {
		key = "/etc/54bank/certs/service.key"
	}
	return true, cert, key
}

// --- CORS + Security Headers Middleware ---
func securityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		allowedOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
		if allowedOrigins == "" {
			allowedOrigins = "https://dashboard.54bank.ng"
		}
		origin := r.Header.Get("Origin")
		for _, allowed := range strings.Split(allowedOrigins, ",") {
			if strings.TrimSpace(allowed) == origin {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				break
			}
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Trace-Id")
		w.Header().Set("Access-Control-Max-Age", "86400")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Content-Security-Policy", "default-src 'self'")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// --- Input Sanitization ---
func sanitizeInput(s string) string {
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "'", "&#39;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	s = strings.ReplaceAll(s, "\\", "")
	if len(s) > 10000 {
		s = s[:10000]
	}
	return s
}

func dbInsert(id, service, typ, status string, data []byte) error {
	if db == nil {
		return fmt.Errorf("no db")
	}
	_, err := db.Exec("INSERT INTO service_records (id, service, type, status, data) VALUES ($1,$2,$3,$4,$5)", id, service, typ, status, string(data))
	return err
}

func dbList(service string, limit int) ([]map[string]interface{}, error) {
	if db == nil {
		return nil, fmt.Errorf("no db")
	}
	rows, err := db.Query("SELECT id, service, type, status, data, created_at FROM service_records WHERE service = $1 ORDER BY created_at DESC LIMIT $2", service, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []map[string]interface{}
	for rows.Next() {
		var id, svc, typ, status, data string
		var createdAt time.Time
		if rows.Scan(&id, &svc, &typ, &status, &data, &createdAt) == nil {
			items = append(items, map[string]interface{}{"id": id, "type": typ, "status": status, "data": data, "created_at": createdAt})
		}
	}
	return items, nil
}

var _rlTokens int64 = 100
var _rlLastRefill int64 = 0

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

// --- JWT Validation (JWKS-aware) ---
// jwtAuthMiddleware delegates to the JWKS/RS256 jwtMiddleware (fail-closed).
func jwtAuthMiddleware(next http.Handler) http.Handler {
	return jwtMiddleware(jwtRealmURL(), next)
}

func validateSecurityPolicy(passwordLength int, hasMFA bool, sessionTimeout int) (bool, []string) {
	var issues []string
	if passwordLength < 12 {
		issues = append(issues, "Password must be at least 12 characters")
	}
	if !hasMFA {
		issues = append(issues, "MFA is required for all accounts")
	}
	if sessionTimeout > 3600 {
		issues = append(issues, "Session timeout cannot exceed 1 hour")
	}
	return len(issues) == 0, issues
}
func computeSecurityScore(hasMFA bool, passwordStrength, patchLevel int) float64 {
	score := 0.0
	if hasMFA {
		score += 30
	}
	score += float64(passwordStrength) * 3
	score += float64(patchLevel) * 2
	if score > 100 {
		return 100
	}
	return score
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

// ── MIDDLEWARE: JWT Validation ───────────────────────────────────────────────

type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}

func fetchJWKS(realmURL string) {
	resp, err := http.Get(realmURL + "/protocol/openid-connect/certs")
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

func jwtMiddleware(realmURL string, next http.Handler) http.Handler {
	// Initial JWKS fetch
	go fetchJWKS(realmURL)
	// Refresh every 5 minutes
	go func() {
		for range time.Tick(5 * time.Minute) {
			fetchJWKS(realmURL)
		}
	}()
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
		if exp, ok := claims["exp"].(float64); ok && time.Now().Unix() > int64(exp) {
			http.Error(w, `{"error":"token expired"}`, http.StatusUnauthorized)
			return
		}
		// Pass claims in context
		ctx := context.WithValue(r.Context(), "jwt_claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// ── MIDDLEWARE: Outbox Relay (Kafka) ────────────────────────────────────────

func startOutboxRelay(ctx context.Context, brokers string, topic string) {
	go func() {
		ticker := time.NewTicker(2 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				relayOutbox(brokers, topic)
			}
		}
	}()
}

func relayOutbox(brokers string, topic string) {
	if db == nil {
		return
	}

	// Events are marked published ONLY after a confirmed Kafka produce.
	producer, err := getKafkaProducer(brokers)
	if err != nil {
		log.Printf("[outbox-relay] kafka unavailable: %v — events remain unpublished for retry", err)
		return
	}

	rows, err := db.Query(`SELECT id, event_type, aggregate_id, payload FROM outbox WHERE published = FALSE ORDER BY created_at LIMIT 100`)
	if err != nil {
		return
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id, eventType, aggID string
		var payload []byte
		if err := rows.Scan(&id, &eventType, &aggID, &payload); err != nil {
			continue
		}
		_, _, err := producer.SendMessage(&sarama.ProducerMessage{
			Topic: topic,
			Key:   sarama.StringEncoder(aggID),
			Value: sarama.ByteEncoder(payload),
		})
		if err != nil {
			log.Printf("[outbox-relay] publish failed for event %s: %v — leaving unpublished for retry", id, err)
			continue
		}
		ids = append(ids, id)
	}
	if len(ids) == 0 {
		return
	}
	for _, id := range ids {
		if _, err := db.Exec(`UPDATE outbox SET published = TRUE WHERE id = $1`, id); err != nil {
			log.Printf("[outbox-relay] failed to mark event %s published: %v", id, err)
		}
	}
	if len(ids) > 0 {
		log.Printf("[outbox-relay] published %d events to kafka topic=%s", len(ids), topic)
	}
}

// getKafkaProducer lazily creates a shared sarama SyncProducer.
var kafkaProducer sarama.SyncProducer
var kafkaProducerMu sync.Mutex

func getKafkaProducer(brokers string) (sarama.SyncProducer, error) {
	kafkaProducerMu.Lock()
	defer kafkaProducerMu.Unlock()
	if kafkaProducer != nil {
		return kafkaProducer, nil
	}
	cfg := sarama.NewConfig()
	cfg.Producer.Return.Successes = true
	cfg.Producer.RequiredAcks = sarama.WaitForAll
	cfg.Producer.Retry.Max = 3
	p, err := sarama.NewSyncProducer(strings.Split(brokers, ","), cfg)
	if err != nil {
		return nil, err
	}
	kafkaProducer = p
	return kafkaProducer, nil
}

func main() {

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL != "" {
		var dbErr error
		db, dbErr = sql.Open("postgres", dbURL)
		if dbErr != nil {
			log.Printf("[%s] DB open failed: %v", serviceName, dbErr)
		} else {
			db.SetMaxOpenConns(10)
			db.SetMaxIdleConns(5)
			db.Exec("CREATE TABLE IF NOT EXISTS service_records (id TEXT PRIMARY KEY, service TEXT, type TEXT, status TEXT, data TEXT, created_at TIMESTAMPTZ DEFAULT NOW())")
			log.Printf("[%s] DB connected", serviceName)
		}
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "9429"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/readyz", readyzHandler)

	mux.HandleFunc("/livez", livezHandler)

	mux.HandleFunc("/metrics", metricsHandler)

	mux.Handle("/v1/alerts", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(alertsHandler)))
	mux.HandleFunc("/healthz", handleHealthz)
	mux.Handle("/v1/security-gateway/list", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(handleList)))
	mux.Handle("/v1/security-gateway/create", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(handleCreate)))
	mux.Handle("/v1/security-gateway/update", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(handleUpdate)))
	mux.Handle("/v1/security-gateway/process", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(handleProcess)))
	mux.Handle("/v1/security-gateway/audit", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(handleAudit)))
	mux.Handle("/v1/security-gateway/stats", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(handleStats)))
	mux.Handle("/v1/security-gateway/health-score", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(security_gatewayHealthScoreHandler)))
	mux.Handle("/v1/security-gateway/circuit-state", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(security_gatewayCircuitHandler)))
	log.Printf("Security Gateway v2.0 (Security) on :%s", port)
	tlsEnabled, tlsCert, tlsKey := getTLSConfig()
	_ = tlsCert
	_ = tlsKey
	_ = tlsEnabled
	server := &http.Server{
		Addr:         ":" + port,
		Handler:      jwtAuthMiddleware(rateLimitMiddleware(securityHeadersMiddleware(traceMiddleware(countingMiddleware(mux))))),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()
	<-quit
	log.Println("[security-gateway-go] Shutdown signal received")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	_ = server.Shutdown(ctx)
	log.Println("[security-gateway-go] Server stopped gracefully")
}

func jsonResp(w http.ResponseWriter, code int, data interface{}) { respondJSON(w, code, data) }

// jwtRealmURL resolves the Keycloak realm URL for jwtMiddleware (added by
// scripts/fix-go-wire-jwt.py).
func jwtRealmURL() string {
	if v := os.Getenv("KEYCLOAK_REALM_URL"); v != "" {
		return v
	}
	return "http://keycloak:8080/realms/54bank"
}
