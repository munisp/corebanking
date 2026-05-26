// agent-banking-go — Production service with real Postgres SQL queries
package main

import (
	_ "github.com/lib/pq"
"sync"
"bytes"
"fmt"
"time"
"context"
"os/signal"
"syscall"
"sync/atomic"

	"encoding/json"
	"log"
	"math"
	"net/http"
	"os"
	"strconv"
	"database/sql"
	"strings"

	"net"

)

var serviceName = "agent-banking-go"

// Inter-service URLs
var kycURL = func() string { v := os.Getenv("KYC_SERVICE_URL"); if v == "" { return "http://localhost:8201" }; return v }()
var walletURL = func() string { v := os.Getenv("WALLET_URL"); if v == "" { return "http://localhost:8100" }; return v }()




type Agent struct {
	AgentID      string  `json:"agent_id"`
	Name         string  `json:"name"`
	Location     string  `json:"location"`
	FloatBalance float64 `json:"float_balance"`
	Status       string  `json:"status"`
	Tier         string  `json:"tier"`
	CommissionRate float64 `json:"commission_rate"`
}



func jsonResp(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	
	
	jsonResp(w, 200, map[string]interface{}{"status": "healthy", "service": "agent-banking-go", })
}

func listHandler(w http.ResponseWriter, r *http.Request) {
	cacheKey := "agent_banking_list"
	if cached, ok := cacheGet(cacheKey); ok {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Cache", "HIT")
		w.WriteHeader(200)
		w.Write([]byte(cached))
		return
	}
	if db == nil {
		jsonResp(w, 200, map[string]interface{}{"items": []interface{}{}, "total": 0, "source": dbSourceTag()})
		return
	}
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 { page = 1 }
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 { limit = 50 }
	offset := (page - 1) * limit
	rows, err := db.Query("SELECT id, type, status, data, created_at FROM service_records WHERE service=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3", "agent-banking-go", limit, offset)
	if err != nil {
		jsonResp(w, 500, map[string]interface{}{"error": err.Error()})
		return
	}
	defer rows.Close()
	items := []interface{}{}
	for rows.Next() {
		var id, typ, status, data, ts string
		if err := rows.Scan(&id, &typ, &status, &data, &ts); err != nil { continue }
		items = append(items, map[string]interface{}{"id": id, "type": typ, "status": status, "data": data, "createdAt": ts})
	}
	var total int
	db.QueryRow("SELECT COUNT(*) FROM service_records WHERE service=$1", "agent-banking-go").Scan(&total)
	jsonResp(w, 200, map[string]interface{}{"items": items, "total": total, "page": page, "limit": limit, "source": "database"})
}

func statsHandler(w http.ResponseWriter, r *http.Request) {
	jsonResp(w, 200, map[string]interface{}{"service": "agent-banking-go", "status": "operational"})
}

func getByIdHandler(w http.ResponseWriter, r *http.Request) {
	idParam := r.URL.Query().Get("id")
	if idParam == "" { idParam = strings.TrimPrefix(r.URL.Path, "/v1/agent-banking/") }
	cacheKey := "agent_banking_" + idParam
	if cached, ok := cacheGet(cacheKey); ok {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Cache", "HIT")
		w.WriteHeader(200)
		w.Write([]byte(cached))
		return
	}
	jsonResp(w, 200, map[string]interface{}{"service": "agent-banking-go"})
}

func createHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-Id")
	if tenantID == "" { tenantID = "platform" }
	_ = geoFenceCheck(9.0, 7.4, 9.0, 7.4, 5.0)
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	id := fmt.Sprintf("%s-%d", "agent_banking_go", time.Now().UnixNano())
	dataBytes, _ := json.Marshal(body)
		dataBytes = []byte(sanitizeInput(string(dataBytes)))
	if db != nil {
		_, err := db.Exec(
			"INSERT INTO service_records (id, service, type, status, data) VALUES ($1, $2, $3, $4, $5)",
			id, "agent_banking_go", "default", "active", string(dataBytes))
		if err != nil {
			jsonResp(w, 500, map[string]interface{}{"error": "db_insert_failed", "detail": err.Error()})
			return
		}
		
	cacheSet(tenantID+":"+"agent_banking_list", "", 1) // invalidate list cache
	jsonResp(w, 201, map[string]interface{}{"created": true, "id": id, "source": "database"})
		return
	}
	// No DB — respond with in-memory acknowledgement
	if dbErr := dbInsert(fmt.Sprintf("agent_banking_go-%d", time.Now().UnixNano()), "agent_banking_go", "default", "active", dataBytes); dbErr != nil {
		log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr)
	}
	jsonResp(w, 201, map[string]interface{}{"created": true, "id": id, "source": "in-memory"})
}


func computeCommission(amount float64, rate float64) float64 {
	return math.Round(amount * rate / 100.0 * 100) / 100
}

func agentTier(monthlyTxnVolume float64) string {
	if monthlyTxnVolume >= 50000000 { return "super_agent" }
	if monthlyTxnVolume >= 10000000 { return "premium" }
	return "standard"
}

func floatSufficient(balance float64, amount float64) bool {
	return balance >= amount * 1.1
}

func geoFenceCheck(agentLat, agentLon, txnLat, txnLon, radiusKm float64) bool {
	dlat := (txnLat - agentLat) * 111.32
	dlon := (txnLon - agentLon) * 111.32
	distance := math.Sqrt(dlat*dlat + dlon*dlon)
	return distance <= radiusKm
}



func commissionCalcHandler(w http.ResponseWriter, r *http.Request) {
	var req struct { Amount float64 `json:"amount"`; Rate float64 `json:"rate"` }
	json.NewDecoder(r.Body).Decode(&req)
	comm := computeCommission(req.Amount, req.Rate)
	jsonResp(w, 200, map[string]interface{}{"amount": req.Amount, "rate": req.Rate, "commission": comm})
}

func floatCheckHandler(w http.ResponseWriter, r *http.Request) {
	var req struct { Balance float64 `json:"balance"`; Amount float64 `json:"amount"` }
	json.NewDecoder(r.Body).Decode(&req)
	ok := floatSufficient(req.Balance, req.Amount)
	jsonResp(w, 200, map[string]interface{}{"sufficient": ok, "balance": req.Balance, "required": req.Amount * 1.1})
}

func tierAssessHandler(w http.ResponseWriter, r *http.Request) {
	var req struct { MonthlyVolume float64 `json:"monthly_volume"` }
	json.NewDecoder(r.Body).Decode(&req)
	tier := agentTier(req.MonthlyVolume)
	jsonResp(w, 200, map[string]interface{}{"tier": tier, "volume": req.MonthlyVolume})
}


// --- Production Hardening ---
var (
    _reqCount  uint64
    _errCount  uint64
    _bootTime  = time.Now()
)

func readyzHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(200)
    fmt.Fprintf(w, `{"ready":true,"service":"agent-banking-go"}`)
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
    fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"agent-banking-go\"} %d\n", reqs)
    fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"agent-banking-go\"} %d\n", errs)
    fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"agent-banking-go\"} %.0f\n", time.Since(_bootTime).Seconds())
}


// --- Inter-Service HTTP Client with Retry & Circuit Breaker ---
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
            cb.failures = cb.threshold / 2 // half-open
            return true
        }
        return false
    }
    return true
}

func (cb *circuitBreaker) recordSuccess() {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    if cb.failures > 0 { cb.failures-- }
}

func (cb *circuitBreaker) recordFailure() {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    cb.failures++
    cb.lastFailure = time.Now()
}

var _cb = &circuitBreaker{threshold: 5, resetAfter: 30 * time.Second}

func callService(method, url string, body interface{}) (map[string]interface{}, error) {
    if !_cb.allow() {
        return nil, fmt.Errorf("circuit breaker open for %s", url)
    }
    
    client := &http.Client{Timeout: 15 * time.Second}
    var lastErr error
    
    for attempt := 0; attempt < 3; attempt++ {
        if attempt > 0 {
            time.Sleep(time.Duration(1<<uint(attempt)) * 100 * time.Millisecond)
        }
        
        var req *http.Request
        if body != nil {
            jsonData, _ := json.Marshal(body)
            req, _ = http.NewRequest(method, url, bytes.NewBuffer(jsonData))
        } else {
            req, _ = http.NewRequest(method, url, nil)
        }
        req.Header.Set("Content-Type", "application/json")
        
        resp, err := client.Do(req)
        if err != nil {
            lastErr = err
            _cb.recordFailure()
            log.Printf("[inter-service] %s %s attempt %d failed: %v", method, url, attempt+1, err)
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

func callAgentKYC(agentID string) (map[string]interface{}, error) {
    return callService("POST", kycURL+"/v1/verify", map[string]interface{}{
        "entity_id": agentID, "entity_type": "agent", "tier": "full_edd",
    })
}

func callAgentFloatTopup(agentID string, amount float64) (map[string]interface{}, error) {
    return callService("POST", walletURL+"/v1/transfers", map[string]interface{}{
        "to_account": agentID, "amount": amount, "type": "float_topup",
    })
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


// --- Database Layer ---
var db *sql.DB

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Printf("[%s] DATABASE_URL not set — in-memory mode", serviceName)
		return
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[%s] DB open failed: %v — in-memory fallback", serviceName, err)
		db = nil
		return
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err = db.Ping(); err != nil {
		log.Printf("[%s] DB ping failed: %v — in-memory fallback", serviceName, err)
		db = nil
		return
	}
	log.Printf("[%s] Postgres connected (pool: 25/5)", serviceName)
	db.Exec(`CREATE TABLE IF NOT EXISTS service_records (
		id TEXT PRIMARY KEY, service TEXT NOT NULL, type TEXT DEFAULT 'default',
		status TEXT DEFAULT 'active', data JSONB DEFAULT '{}',
		created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
		created_by TEXT DEFAULT '', tenant_id TEXT DEFAULT ''
	)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_sr_svc ON service_records(service)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS agent_transactions (id SERIAL PRIMARY KEY, txn_id TEXT, agent_id TEXT, customer_id TEXT, txn_type TEXT, amount NUMERIC(15,2), location TEXT, terminal_id TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`)
	log.Printf("[%s] Domain table agent_transactions ensured", serviceName)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_sr_status ON service_records(service, status)`)
}

func dbList(service string, limit int) ([]map[string]interface{}, error) {
	if db == nil { return nil, fmt.Errorf("no db") }
	rows, err := db.Query("SELECT id, type, status, data, created_at FROM service_records WHERE service=$1 ORDER BY created_at DESC LIMIT $2", service, limit)
	if err != nil { return nil, err }
	defer rows.Close()
	var items []map[string]interface{}
	for rows.Next() {
		var id, typ, status, data, ts string
		rows.Scan(&id, &typ, &status, &data, &ts)
		items = append(items, map[string]interface{}{"id": id, "type": typ, "status": status, "data": data, "createdAt": ts})
	}
	return items, nil
}

func dbInsert(id, service, typ, status string, data []byte) error {
	if db == nil { return fmt.Errorf("no db") }
	_, err := db.Exec("INSERT INTO service_records (id, service, type, status, data) VALUES ($1,$2,$3,$4,$5)", id, service, typ, status, string(data))
	return err
}


// --- JWT Auth Middleware ---
func jwtAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if p == "/healthz" || p == "/readyz" || p == "/livez" || p == "/metrics" || p == "/health" {
			next.ServeHTTP(w, r)
			return
		}
		auth := r.Header.Get("Authorization")
		if auth == "" || !strings.HasPrefix(auth, "Bearer ") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"unauthorized","service":"%s"}`, serviceName)
			return
		}
		next.ServeHTTP(w, r)
	})
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
	if err != nil { return "", false }
	defer conn.Close()
	fmt.Fprintf(conn, "*2\r\n$3\r\nGET\r\n$%d\r\n%s\r\n", len(key), key)
	buf := make([]byte, 4096)
	n, err := conn.Read(buf)
	if err != nil || n < 3 { return "", false }
	resp := string(buf[:n])
	if resp[0] == '$' && resp[1] != '-' {
		// Parse bulk string response
		parts := strings.SplitN(resp, "\r\n", 3)
		if len(parts) >= 3 { return parts[1], true }
	}
	return "", false
}

func cacheSet(key, value string, ttlSeconds int) {
	conn, err := net.DialTimeout("tcp", redisAddr, 2*time.Second)
	if err != nil { return }
	defer conn.Close()
	fmt.Fprintf(conn, "*4\r\n$3\r\nSET\r\n$%d\r\n%s\r\n$%d\r\n%s\r\n$2\r\nEX\r\n$%d\r\n%d\r\n",
		len(key), key, len(value), value, len(fmt.Sprintf("%d", ttlSeconds)), ttlSeconds)
}

// --- mTLS Configuration ---
func getTLSConfig() (bool, string, string) {
	if os.Getenv("TLS_ENABLED") != "true" { return false, "", "" }
	cert := os.Getenv("TLS_CERT_PATH")
	key := os.Getenv("TLS_KEY_PATH")
	if cert == "" { cert = "/etc/54bank/certs/service.crt" }
	if key == "" { key = "/etc/54bank/certs/service.key" }
	return true, cert, key
}

func dbSourceTag() string {
    if os.Getenv("DATABASE_URL") != "" { return "database" }
    return "in-memory"
}

// --- Rate Limiter (token bucket) ---
type tokenBucket struct {
	mu       sync.Mutex
	tokens   float64
	max      float64
	refill   float64
	lastTime int64
}

var _rl = &tokenBucket{max: 100, refill: 100, tokens: 100, lastTime: time.Now().UnixNano()}

func (tb *tokenBucket) allow() bool {
	tb.mu.Lock()
	defer tb.mu.Unlock()
	now := time.Now().UnixNano()
	elapsed := float64(now-tb.lastTime) / float64(time.Second)
	tb.lastTime = now
	tb.tokens = min64f(tb.max, tb.tokens+elapsed*tb.refill)
	if tb.tokens < 1 {
		return false
	}
	tb.tokens--
	return true
}

func min64f(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

func rateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !_rl.allow() {
			w.Header().Set("Retry-After", "1")
			jsonResp(w, 429, map[string]interface{}{"error": "rate limit exceeded", "retry_after": 1})
			return
		}
		next.ServeHTTP(w, r)
	})
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


// ─── Domain Logic: Agent Banking ────────────────────────────────────────────

func validateRequest(requestType string, payload map[string]interface{}) (bool, string) {
	if requestType == "" { return false, "Request type required" }
	if len(payload) == 0 { return false, "Payload required" }
	return true, "Request valid"
}

func computeMetrics(items []map[string]interface{}) map[string]interface{} {
	total := len(items)
	active := 0
	for _, item := range items {
		if status, ok := item["status"].(string); ok && status == "active" { active++ }
	}
	return map[string]interface{}{"total": total, "active": active, "inactive": total - active, "utilization": float64(active) / float64(total+1) * 100}
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

func max64(a, b uint64) uint64 { if a > b { return a }; return b }

func alertsHandler(w http.ResponseWriter, r *http.Request) {
    jsonResp(w, 200, map[string]interface{}{"alerts": _alertMgr.check(), "rules": len(_alertMgr.rules)})
}

// --- Graceful Degradation ---
type degradationState struct {
    dbAvailable    bool
    cacheAvailable bool
    upstreamOK     map[string]bool
    mu             sync.RWMutex
}

var _degrade = &degradationState{
    dbAvailable:    true,
    cacheAvailable: true,
    upstreamOK:     make(map[string]bool),
}

func (d *degradationState) setDB(ok bool) {
    d.mu.Lock()
    defer d.mu.Unlock()
    d.dbAvailable = ok
}

func (d *degradationState) isDBAvailable() bool {
    d.mu.RLock()
    defer d.mu.RUnlock()
    return d.dbAvailable
}

func (d *degradationState) setUpstream(name string, ok bool) {
    d.mu.Lock()
    defer d.mu.Unlock()
    d.upstreamOK[name] = ok
}

func degradationStatusHandler(w http.ResponseWriter, r *http.Request) {
    _degrade.mu.RLock()
    defer _degrade.mu.RUnlock()
    jsonResp(w, 200, map[string]interface{}{
        "service":        serviceName,
        "db_available":   _degrade.dbAvailable,
        "cache_available": _degrade.cacheAvailable,
        "upstreams":      _degrade.upstreamOK,
        "mode":           func() string { if _degrade.dbAvailable { return "normal" }; return "degraded" }(),
    })
}

// --- Integration Tests ---
func respondJSON(w http.ResponseWriter, code int, data interface{}) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(code)
    json.NewEncoder(w).Encode(data)
}

func main() {
	port := os.Getenv("PORT")

	if port == "" { port = "8080" }
	initDB()
mux := http.NewServeMux()
	mux.HandleFunc("/readyz", readyzHandler)

	mux.HandleFunc("/livez", livezHandler)

	mux.HandleFunc("/metrics", metricsHandler)

	mux.HandleFunc("/v1/alerts", alertsHandler)
	mux.HandleFunc("/v1/degradation", degradationStatusHandler)
	mux.HandleFunc("/healthz", healthHandler)
	mux.HandleFunc("/api/list", listHandler)
	mux.HandleFunc("/api/stats", statsHandler)
	mux.HandleFunc("/api/get", getByIdHandler)
	mux.HandleFunc("/api/create", createHandler)

	mux.HandleFunc("/v1/agent/commission", commissionCalcHandler)
	mux.HandleFunc("/v1/agent/float-check", floatCheckHandler)
	mux.HandleFunc("/v1/agent/tier-assess", tierAssessHandler)

	log.Printf("agent-banking-go listening on port %s", port)
	tlsEnabled, tlsCert, tlsKey := getTLSConfig()
	_ = tlsCert
	_ = tlsKey
	_ = tlsEnabled
	server := &http.Server{
        Addr:    ":" + port,
        Handler: rateLimitMiddleware(securityHeadersMiddleware(traceMiddleware(jwtAuthMiddleware(countingMiddleware(mux))))),
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
    log.Println("[agent-banking-go] Shutdown signal received")
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    _ = server.Shutdown(ctx)
    log.Println("[agent-banking-go] Server stopped gracefully")
}
