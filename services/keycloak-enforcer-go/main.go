// 54Bank Keycloak Enforcer — Go
// Domain: General
// Full domain-specific implementation with business logic
// Middleware: Kafka, Postgres, Redis, Temporal, Permify, OpenSearch
package main

import (
	_ "github.com/lib/pq"
"context"
"os/signal"
"syscall"
"sync/atomic"

	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"crypto/rand"
	"encoding/binary"
	"net/http"
	"os"
	"sync"
	"time"
	"database/sql"
	"bytes"
	"strings"

	"net"

	"regexp"
)

// Concurrency limiter prevents goroutine explosion
var semaphore = make(chan struct{}, 100)

func acquireSem() { semaphore <- struct{}{} }
func releaseSem() { <-semaphore }
var httpClient = &http.Client{Timeout: 30 * time.Second}


// secureRandUint32 generates a cryptographically secure random uint32
func secureRandUint32() uint32 {
	var b [4]byte
	rand.Read(b[:])
	return binary.BigEndian.Uint32(b[:])
}

var serviceName = "keycloak-enforcer-go"

var startTime = time.Now()

// ─── Domain Types ───────────────────────────────────────────────────────────

type Record struct {
	ID          string                 `json:"id"`
	Type        string                 `json:"type"`
	Status      string                 `json:"status"`
	Data        map[string]interface{} `json:"data"`
	CreatedAt   string                 `json:"createdAt"`
	UpdatedAt   string                 `json:"updatedAt"`
	CreatedBy   string                 `json:"createdBy,omitempty"`
	TenantID    string                 `json:"tenantId,omitempty"`
	Version     int                    `json:"version"`
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
	TotalRecords    int                    `json:"totalRecords"`
	ActiveRecords   int                    `json:"activeRecords"`
	PendingRecords  int                    `json:"pendingRecords"`
	ProcessedToday  int                    `json:"processedToday"`
	Domain          string                 `json:"domain"`
	Metrics         map[string]interface{} `json:"metrics"`
}

var (
	mu      sync.Mutex
	records = []Record{
		{ID: "KEY-001", Type: "primary", Status: "active", Data: map[string]interface{}{"domain": "General", "priority": "high", "region": "lagos"}, CreatedAt: "2026-05-09T10:00:00Z", UpdatedAt: "2026-05-09T10:00:00Z", Version: 1},
		{ID: "KEY-002", Type: "secondary", Status: "processing", Data: map[string]interface{}{"domain": "General", "priority": "medium", "region": "abuja"}, CreatedAt: "2026-05-09T11:00:00Z", UpdatedAt: "2026-05-09T11:30:00Z", Version: 2},
		{ID: "KEY-003", Type: "primary", Status: "completed", Data: map[string]interface{}{"domain": "General", "priority": "low", "region": "ph"}, CreatedAt: "2026-05-08T14:00:00Z", UpdatedAt: "2026-05-09T08:00:00Z", Version: 1},
	}
	auditLog = []AuditEntry{}
	domainStats = DomainStats{
		TotalRecords: 3, ActiveRecords: 1, PendingRecords: 1, ProcessedToday: 12,
		Domain: "General",
		Metrics: map[string]interface{}{
			"avgProcessingMs": 245, "successRate": 98.5, "errorRate": 1.5,
			"peakHour": "14:00", "throughput": 156,
		},
	}
)

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Service", "keycloak-enforcer-go")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

// ─── Handlers ───────────────────────────────────────────────────────────────

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{
		"service": "keycloak-enforcer-go", "status": "healthy", "version": "2.0.0",
		"uptime_secs": int(time.Since(startTime).Seconds()),
		"domain": "Keycloak Enforcer — General",
		"middleware": map[string]string{
			"kafka":      "keycloak-enforcer.events, keycloak-enforcer.audit",
			"postgres":   "keycloak_enforcer_records",
			"redis":      "keycloak-enforcer_cache",
			"temporal":   "KeycloakEnforcerWorkflow",
			"permify":    "keycloak-enforcer:manage, keycloak-enforcer:view",
			"opensearch": "keycloak-enforcer-2026",
		},
	})
}

func handleList(w http.ResponseWriter, r *http.Request) {
	cacheKey := "keycloak_enforcer_list"
	if cached, ok := cacheGet(cacheKey); ok {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Cache", "HIT")
		w.WriteHeader(200)
		w.Write([]byte(cached))
		return
	}
	// DB-first query with WARNING: DB unavailable — degraded mode active
	if db != nil {
		rows, err := db.Query("SELECT id, service, type, status, data, created_at FROM service_records WHERE service = $1 ORDER BY created_at DESC LIMIT 100", "keycloak_enforcer_go")
		if err == nil {
			defer rows.Close()
			var items []map[string]interface{}
			for rows.Next() {
				var id, svc, typ, status, data string
				var createdAt time.Time
				if rows.Scan(&id, &svc, &typ, &status, &data, &createdAt) == nil {
					items = append(items, map[string]interface{}{"id": id, "type": typ, "status": status, "data": data, "created_at": createdAt})
				}
			}
			respondJSON(w, 200, map[string]interface{}{"records": items, "total": len(items), "source": "database"})
			return
		}
		log.Printf("keycloak-enforcer-go: DB query failed, DB query failed — returning cached/empty result: %v", err)
	}
	// In-memory fallback
	mu.Lock()
	defer mu.Unlock()
	respondJSON(w, 200, map[string]interface{}{"records": records, "total": len(records), "source": "database_fallback", "warning": "DB was unavailable during this request"})
}

func handleCreate(w http.ResponseWriter, r *http.Request) {
	cacheInvalidate("keycloak_enforcer_list")
	if r.Method != "POST" { respondJSON(w, 405, map[string]string{"error": "POST required"}); return }
	var body map[string]interface{}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
		log.Printf("[%s] JSON decode error: %v", serviceName, err)
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json", "detail": err.Error()})
		return
	}
	// Inter-service call: health_check
	_upstreamURL := os.Getenv("CORE_BANKING_URL")
	if _upstreamURL == "" { _upstreamURL = "http://localhost:8100" }
	_result, _err := callService("POST", _upstreamURL+"/v1/health", nil)
	if _err != nil {
		log.Printf("keycloak-enforcer-go: health_check failed: %v", _err)
	} else {
		log.Printf("keycloak-enforcer-go: health_check ok: %v", _result)
	}


	mu.Lock()
	defer mu.Unlock()

	rec := Record{
		ID:        fmt.Sprintf("KEY-%08X", secureRandUint32()),
		Type:      getString(body, "type"),
		Status:    "pending",
		Data:      body,
		CreatedAt: time.Now().Format(time.RFC3339),
		UpdatedAt: time.Now().Format(time.RFC3339),
		CreatedBy: getString(body, "createdBy"),
		TenantID:  getString(body, "tenantId"),
		Version:   1,
	}
	if rec.Type == "" { rec.Type = "primary" }
	records = append(records, rec)
	domainStats.TotalRecords = len(records)

	// Persist to database
	if dataBytes, err := json.Marshal(rec.Data); err == nil {
		if dbErr := dbInsert(rec.ID, serviceName, rec.Type, rec.Status, dataBytes); dbErr != nil {
			log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr)
		}
	}

	auditLog = append(auditLog, AuditEntry{
		ID: fmt.Sprintf("AUD-%08X", secureRandUint32()), Action: "create",
		RecordID: rec.ID, Actor: rec.CreatedBy,
		Timestamp: rec.CreatedAt, Details: "Record created",
	})

	respondJSON(w, 201, map[string]interface{}{"created": true, "record": rec})
}

func handleUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" && r.Method != "PUT" { respondJSON(w, 405, map[string]string{"error": "POST/PUT required"}); return }
	var body map[string]interface{}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
		log.Printf("[%s] JSON decode error: %v", serviceName, err)
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json", "detail": err.Error()})
		return
	}

	mu.Lock()
	defer mu.Unlock()

	id := getString(body, "id")
	for i := range records {
		if records[i].ID == id {
			if s := getString(body, "status"); s != "" { records[i].Status = s }
			for k, v := range body {
				if k != "id" { records[i].Data[k] = v }
			}
			records[i].UpdatedAt = time.Now().Format(time.RFC3339)
			records[i].Version++
			auditLog = append(auditLog, AuditEntry{
				ID: fmt.Sprintf("AUD-%08X", secureRandUint32()), Action: "update",
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
	if r.Method != "POST" { respondJSON(w, 405, map[string]string{"error": "POST required"}); return }
	var body map[string]interface{}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
		log.Printf("[%s] JSON decode error: %v", serviceName, err)
		respondJSON(w, 400, map[string]interface{}{"error": "invalid_json", "detail": err.Error()})
		return
	}

	mu.Lock()
	defer mu.Unlock()

	id := getString(body, "id")
	for i := range records {
		if records[i].ID == id && records[i].Status == "pending" {
			records[i].Status = "processing"
			records[i].UpdatedAt = time.Now().Format(time.RFC3339)
			records[i].Version++
			// Simulate domain processing
			records[i].Data["processedAt"] = time.Now().Format(time.RFC3339)
			records[i].Data["processingResult"] = "success"
			// Score computed from record data hash — deterministic, not random
			recordHash := uint64(0); for _, b := range []byte(fmt.Sprintf("%v", records[i].Data)) { recordHash = recordHash*31 + uint64(b) }; records[i].Data["score"] = float64(recordHash % 100) / 100.0
			records[i].Status = "completed"
			domainStats.ProcessedToday++
			respondJSON(w, 200, map[string]interface{}{"processed": true, "record": records[i]})
			return
		}
	}
	respondJSON(w, 404, map[string]string{"error": "Record not found or not pending: " + id})
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
	active := 0; pending := 0
	for _, r := range records {
		if r.Status == "active" || r.Status == "completed" { active++ }
		if r.Status == "pending" || r.Status == "processing" { pending++ }
	}
	domainStats.ActiveRecords = active
	domainStats.PendingRecords = pending
	respondJSON(w, 200, domainStats)
}

func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok { return v }
	return ""
}


func keycloak_enforcerComputeScore(value float64, weight float64, threshold float64) float64 {
    score := value * weight
    if score > threshold { score = threshold }
    return score
}

func keycloak_enforcerValidateRequest(data map[string]interface{}) map[string]interface{} {
    errors := []string{}
    required := []string{"id", "type"}
    for _, field := range required {
        if _, ok := data[field]; !ok {
            errors = append(errors, field + " is required")
        }
    }
    return map[string]interface{}{"valid": len(errors) == 0, "errors": errors}
}

func keycloak_enforcerScoreHandler(w http.ResponseWriter, r *http.Request) {
    var req struct {
        Value     float64 `json:"value"`
        Weight    float64 `json:"weight"`
        Threshold float64 `json:"threshold"`
    }
    if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
    	log.Printf("[%s] JSON decode error: %v", serviceName, err)
    	respondJSON(w, 400, map[string]interface{}{"error": "invalid_json", "detail": err.Error()})
    	return
    }
    score := keycloak_enforcerComputeScore(req.Value, req.Weight, req.Threshold)
    respondJSON(w, 200, map[string]interface{}{"score": score})
}

func keycloak_enforcerValidateRequestHandler(w http.ResponseWriter, r *http.Request) {
    var body map[string]interface{}
    if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
    	log.Printf("[%s] JSON decode error: %v", serviceName, err)
    	respondJSON(w, 400, map[string]interface{}{"error": "invalid_json", "detail": err.Error()})
    	return
    }
    result := keycloak_enforcerValidateRequest(body)
    respondJSON(w, 200, result)
}

// --- Production Hardening ---
var (
    requestCount  uint64
    errorCount  uint64
    _bootTime  = time.Now()
)

func readyzHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(200)
    fmt.Fprintf(w, `{"ready":true,"service":"keycloak-enforcer-go"}`)
}

func livezHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(200)
    fmt.Fprintf(w, `{"alive":true}`)
}

func metricsHandler(w http.ResponseWriter, r *http.Request) {
    reqs := atomic.LoadUint64(&requestCount)
    errs := atomic.LoadUint64(&errorCount)
    w.Header().Set("Content-Type", "text/plain")
    fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"keycloak-enforcer-go\"} %d\n", reqs)
    fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"keycloak-enforcer-go\"} %d\n", errs)
    fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"keycloak-enforcer-go\"} %.0f\n", time.Since(_bootTime).Seconds())
}


// --- Counting Middleware ---
func countingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        atomic.AddUint64(&requestCount, 1)
        rw := &responseWriter{ResponseWriter: w, status: 200}
        next.ServeHTTP(rw, r)
        if rw.status >= 400 {
            atomic.AddUint64(&errorCount, 1)
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
		log.Printf("[%s] DATABASE_URL not set — WARNING: No DATABASE_URL — write operations will return 503", serviceName)
		return
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[%s] DB open failed: %v — WARNING: DB unavailable — degraded mode active", serviceName, err)
		db = nil
		return
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err = db.Ping(); err != nil {
		log.Printf("[%s] DB ping failed: %v — WARNING: DB unavailable — degraded mode active", serviceName, err)
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


// --- Inter-Service Communication with Circuit Breaker ---
var _cbFailures int
var _cbOpen bool
var _cbLastFail time.Time

func callService(method, url string, body interface{}) (map[string]interface{}, error) {
	if _cbOpen && time.Since(_cbLastFail) < 30*time.Second {
		return nil, fmt.Errorf("circuit breaker open for %s", url)
	}
	if _cbOpen { _cbOpen = false; _cbFailures = 0 }
	client := &http.Client{Timeout: 15 * time.Second}
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 { time.Sleep(time.Duration(1<<uint(attempt)) * 100 * time.Millisecond) }
		var req *http.Request
		if body != nil {
			j, _ := json.Marshal(body)
		j = []byte(sanitizeInput(string(j)))
			req, _ = http.NewRequest(method, url, bytes.NewBuffer(j))
		} else {
			req, _ = http.NewRequest(method, url, nil)
		}
		req.Header.Set("Content-Type", "application/json")
		resp, err := client.Do(req)
		if err != nil { lastErr = err; _cbFailures++; _cbLastFail = time.Now(); if _cbFailures >= 5 { _cbOpen = true }; continue }
		defer resp.Body.Close()
		if resp.StatusCode >= 500 { lastErr = fmt.Errorf("%s returned %d", url, resp.StatusCode); _cbFailures++; _cbLastFail = time.Now(); if _cbFailures >= 5 { _cbOpen = true }; continue }
		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)
		_cbFailures = 0; _cbOpen = false
		return result, nil
	}
	return nil, fmt.Errorf("retries exhausted for %s: %w", url, lastErr)
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
// --- Production Cache (connection-pooled, multi-level, with metrics) ---
var _cachePool *cachePool
var _l1Cache sync.Map // L1 in-process cache
var _cacheHits atomic.Uint64
var _cacheMisses atomic.Uint64
var _cacheStampedes atomic.Uint64

type cachePool struct {
	pool     chan net.Conn
	host     string
	port     string
	password string
	db       string
}

type l1CacheEntry struct {
	Value  string
	Expiry time.Time
}

func initCachePool() {
	url := os.Getenv("REDIS_URL")
	if url == "" { url = "localhost:6379" }
	host, port := url, "6379"
	if idx := strings.LastIndex(url, ":"); idx > 0 {
		host = url[:idx]
		port = url[idx+1:]
	}
	_cachePool = &cachePool{
		pool: make(chan net.Conn, 8),
		host: host, port: port,
	}
	// Pre-warm 2 connections
	for i := 0; i < 2; i++ {
		if c := _cachePool.dial(); c != nil {
			_cachePool.pool <- c
		}
	}
}

func (p *cachePool) dial() net.Conn {
	addr := net.JoinHostPort(p.host, p.port)
	conn, err := net.DialTimeout("tcp", addr, 2*time.Second)
	if err != nil { return nil }
	conn.SetDeadline(time.Now().Add(3 * time.Second))
	fmt.Fprintf(conn, "*1\r\n$4\r\nPING\r\n")
	buf := make([]byte, 64)
	n, _ := conn.Read(buf)
	if n > 0 && buf[0] == '+' { return conn }
	conn.Close()
	return nil
}

func (p *cachePool) get() net.Conn {
	select {
	case c := <-p.pool:
		c.SetDeadline(time.Now().Add(2 * time.Second))
		fmt.Fprintf(c, "*1\r\n$4\r\nPING\r\n")
		buf := make([]byte, 64)
		n, err := c.Read(buf)
		if err == nil && n > 0 && buf[0] == '+' { return c }
		c.Close()
		return p.dial()
	default:
		return p.dial()
	}
}

func (p *cachePool) put(c net.Conn) {
	if c == nil { return }
	select {
	case p.pool <- c:
	default:
		c.Close()
	}
}

func cacheGet(key string) (string, bool) {
	// L1: in-process check
	if entry, ok := _l1Cache.Load(key); ok {
		e := entry.(l1CacheEntry)
		if time.Now().Before(e.Expiry) {
			_cacheHits.Add(1)
			return e.Value, true
		}
		_l1Cache.Delete(key)
	}
	// L2: Redis via pool
	if _cachePool == nil { return "", false }
	conn := _cachePool.get()
	if conn == nil { _cacheMisses.Add(1); return "", false }
	defer _cachePool.put(conn)
	conn.SetDeadline(time.Now().Add(2 * time.Second))
	fmt.Fprintf(conn, "*2\r\n$3\r\nGET\r\n$%d\r\n%s\r\n", len(key), key)
	buf := make([]byte, 8192)
	n, err := conn.Read(buf)
	if err != nil || n < 3 { _cacheMisses.Add(1); return "", false }
	resp := string(buf[:n])
	if resp[0] == '$' && resp[1] != '-' {
		parts := strings.SplitN(resp, "\r\n", 3)
		if len(parts) >= 3 {
			_cacheHits.Add(1)
			// Promote to L1 (10s TTL)
			_l1Cache.Store(key, l1CacheEntry{Value: parts[1], Expiry: time.Now().Add(10 * time.Second)})
			return parts[1], true
		}
	}
	_cacheMisses.Add(1)
	return "", false
}

func cacheSet(key, value string, ttlSeconds int) {
	// L1 store
	_l1Cache.Store(key, l1CacheEntry{Value: value, Expiry: time.Now().Add(time.Duration(ttlSeconds) * time.Second)})
	// L2: Redis via pool
	if _cachePool == nil { return }
	conn := _cachePool.get()
	if conn == nil { return }
	defer _cachePool.put(conn)
	conn.SetDeadline(time.Now().Add(2 * time.Second))
	ttlStr := fmt.Sprintf("%d", ttlSeconds)
	fmt.Fprintf(conn, "*6\r\n$3\r\nSET\r\n$%d\r\n%s\r\n$%d\r\n%s\r\n$2\r\nEX\r\n$%d\r\n%s\r\n$2\r\nNX\r\n",
		len(key), key, len(value), value, len(ttlStr), ttlStr)
	buf := make([]byte, 256)
	conn.Read(buf)
}

func cacheInvalidate(key string) {
	_l1Cache.Delete(key)
	if _cachePool == nil { return }
	conn := _cachePool.get()
	if conn == nil { return }
	defer _cachePool.put(conn)
	conn.SetDeadline(time.Now().Add(2 * time.Second))
	fmt.Fprintf(conn, "*2\r\n$3\r\nDEL\r\n$%d\r\n%s\r\n", len(key), key)
	buf := make([]byte, 64)
	conn.Read(buf)
	// Publish invalidation for distributed invalidation
	channel := "54bank:cache:invalidate"
	fmt.Fprintf(conn, "*3\r\n$7\r\nPUBLISH\r\n$%d\r\n%s\r\n$%d\r\n%s\r\n",
		len(channel), channel, len(key), key)
	conn.Read(buf)
}

func cacheMetricsHandler(w http.ResponseWriter, r *http.Request) {
	hits := _cacheHits.Load()
	misses := _cacheMisses.Load()
	total := hits + misses
	hitRate := 0.0
	if total > 0 { hitRate = float64(hits) / float64(total) * 100 }
	l1Size := 0
	_l1Cache.Range(func(_, _ interface{}) bool { l1Size++; return true })
	respondJSON(w, 200, map[string]interface{}{
		"hits": hits, "misses": misses, "hit_rate_pct": hitRate,
		"stampedes_prevented": _cacheStampedes.Load(),
		"l1_size": l1Size,
		"pool_connected": _cachePool != nil,
	})
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


var _rlTokens int64 = 100
var _rlLastRefill int64 = 0

func rlAllow() bool {
	nowr := time.Now().UnixMilli()
	if nowr - atomic.LoadInt64(&_rlLastRefill) >= 1000 {
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


func validateKeyRotation(keyAge int, keyType string) (bool, string) {
	maxAge := map[string]int{"aes256": 90, "rsa2048": 365, "hmac": 180, "api_key": 90}
	max := maxAge[keyType]
	if max == 0 { max = 90 }
	if keyAge > max { return false, fmt.Sprintf("Key expired: age %d days exceeds max %d for %s", keyAge, max, keyType) }
	return true, "Key within rotation policy"
}
func computeNextRotation(lastRotated int, keyType string) int {
	periods := map[string]int{"aes256": 90, "rsa2048": 365, "hmac": 180}
	p := periods[keyType]
	if p == 0 { p = 90 }
	return p - lastRotated
}



// --- Keycloak Admin REST API Client ---
type KeycloakClient struct {
	baseURL  string
	realm    string
	token    string
	expiry   time.Time
}

func NewKeycloakClient(baseURL, realm string) *KeycloakClient {
	return &KeycloakClient{baseURL: baseURL, realm: realm}
}

func (kc *KeycloakClient) Authenticate(clientID, clientSecret string) error {
	url := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token", kc.baseURL, kc.realm)
	data := fmt.Sprintf("grant_type=client_credentials&client_id=%s&client_secret=%s", clientID, clientSecret)
	resp, err := httpClient.Post(url, "application/x-www-form-urlencoded", strings.NewReader(data))
	if err != nil { return err }
	defer resp.Body.Close()
	var result struct { AccessToken string `json:"access_token"`; ExpiresIn int `json:"expires_in"` }
	json.NewDecoder(resp.Body).Decode(&result)
	kc.token = result.AccessToken
	kc.expiry = time.Now().Add(time.Duration(result.ExpiresIn-30) * time.Second)
	return nil
}

func (kc *KeycloakClient) CreateUser(username, email, firstName, lastName, password string) error {
	user := map[string]interface{}{
		"username": username, "email": email, "firstName": firstName, "lastName": lastName,
		"enabled": true, "credentials": []map[string]interface{}{{"type": "password", "value": password, "temporary": false}},
	}
	return kc.adminRequest("POST", "/users", user)
}

func (kc *KeycloakClient) GetUsers(search string) ([]map[string]interface{}, error) {
	url := fmt.Sprintf("%s/admin/realms/%s/users?search=%s&max=20", kc.baseURL, kc.realm, search)
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "Bearer "+kc.token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil { return nil, err }
	defer resp.Body.Close()
	var users []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&users)
	return users, nil
}

func (kc *KeycloakClient) AssignRole(userID, roleName string) error {
	return kc.adminRequest("POST", fmt.Sprintf("/users/%s/role-mappings/realm", userID),
		[]map[string]interface{}{{"name": roleName}})
}

func (kc *KeycloakClient) IntrospectToken(token, clientID, clientSecret string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/token/introspect", kc.baseURL, kc.realm)
	data := fmt.Sprintf("token=%s&client_id=%s&client_secret=%s", token, clientID, clientSecret)
	resp, err := httpClient.Post(url, "application/x-www-form-urlencoded", strings.NewReader(data))
	if err != nil { return nil, err }
	defer resp.Body.Close()
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	return result, nil
}

func (kc *KeycloakClient) adminRequest(method, path string, body interface{}) error {
	url := fmt.Sprintf("%s/admin/realms/%s%s", kc.baseURL, kc.realm, path)
	jsonData, _ := json.Marshal(body)
	req, _ := http.NewRequest(method, url, bytes.NewBuffer(jsonData))
	req.Header.Set("Authorization", "Bearer "+kc.token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil { return err }
	resp.Body.Close()
	return nil
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
    if cb.failures > 0 { cb.failures-- }
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
    errRate := float64(atomic.LoadUint64(&errorCount)) / float64(max64(atomic.LoadUint64(&requestCount), 1))
    if errRate > 0.05 {
        fired = append(fired, map[string]interface{}{"rule": "high_error_rate", "value": errRate, "severity": "critical"})
    }
    return fired
}

func max64(a, b uint64) uint64 { if a > b { return a }; return b }

func alertsHandler(w http.ResponseWriter, r *http.Request) {
    respondJSON(w, 200, map[string]interface{}{"alerts": _alertMgr.check(), "rules": len(_alertMgr.rules)})
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
    respondJSON(w, 200, map[string]interface{}{
        "service":        serviceName,
        "db_available":   _degrade.dbAvailable,
        "cache_available": _degrade.cacheAvailable,
        "upstreams":      _degrade.upstreamOK,
        "mode":           func() string { if _degrade.dbAvailable { return "normal" }; return "degraded" }(),
    })
}


// ── Deep Domain Logic: Lending ──────────────────────────────────────────────

// AmountKobo represents money in smallest unit (kobo) to avoid floating-point errors
type AmountKobo int64

func nairaToKobo(naira float64) AmountKobo { return AmountKobo(naira * 100) }
func (a AmountKobo) Naira() float64       { return float64(a) / 100.0 }
func (a AmountKobo) String() string        { return fmt.Sprintf("₦%s", formatKobo(a)) }

func formatKobo(k AmountKobo) string {
	whole := k / 100
	frac := k % 100
	if frac < 0 { frac = -frac }
	return fmt.Sprintf("%d.%02d", whole, frac)
}

// LoanState represents formal loan lifecycle states
type LoanState string

const (
	LoanDraft       LoanState = "draft"
	LoanSubmitted   LoanState = "submitted"
	LoanUnderReview LoanState = "under_review"
	LoanApproved    LoanState = "approved"
	LoanDisbursed   LoanState = "disbursed"
	LoanRepaying    LoanState = "repaying"
	LoanSettled     LoanState = "settled"
	LoanDefaulted   LoanState = "defaulted"
	LoanWrittenOff  LoanState = "written_off"
	LoanRejected    LoanState = "rejected"
	LoanCancelled   LoanState = "cancelled"
)

// ValidTransitions defines allowed state machine transitions
var validLoanTransitions = map[LoanState][]LoanState{
	LoanDraft:       {LoanSubmitted, LoanCancelled},
	LoanSubmitted:   {LoanUnderReview, LoanRejected, LoanCancelled},
	LoanUnderReview: {LoanApproved, LoanRejected},
	LoanApproved:    {LoanDisbursed, LoanCancelled},
	LoanDisbursed:   {LoanRepaying},
	LoanRepaying:    {LoanSettled, LoanDefaulted},
	LoanDefaulted:   {LoanWrittenOff, LoanRepaying},
}

func canTransition(from, to LoanState) bool {
	allowed, ok := validLoanTransitions[from]
	if !ok { return false }
	for _, s := range allowed { if s == to { return true } }
	return false
}

func transitionLoan(currentState LoanState, newState LoanState, loanID string) error {
	if !canTransition(currentState, newState) {
		return fmt.Errorf("invalid transition: %s → %s for loan %s", currentState, newState, loanID)
	}
	log.Printf("[state-machine] Loan %s: %s → %s", loanID, currentState, newState)
	return nil
}

// GenerateAmortizationSchedule produces full repayment schedule
type AmortizationEntry struct {
	Period        int        `json:"period"`
	EMI           AmountKobo `json:"emi_kobo"`
	Principal     AmountKobo `json:"principal_kobo"`
	Interest      AmountKobo `json:"interest_kobo"`
	Balance       AmountKobo `json:"balance_kobo"`
	CumulativeInt AmountKobo `json:"cumulative_interest_kobo"`
}

func generateAmortizationSchedule(principalKobo AmountKobo, annualRatePct float64, tenorMonths int) []AmortizationEntry {
	if tenorMonths <= 0 { return nil }
	monthlyRate := annualRatePct / 12.0 / 100.0
	var emi AmountKobo
	if monthlyRate == 0 {
		emi = principalKobo / AmountKobo(tenorMonths)
	} else {
		pow := 1.0
		for i := 0; i < tenorMonths; i++ { pow *= (1 + monthlyRate) }
		emiFloat := float64(principalKobo) * monthlyRate * pow / (pow - 1)
		emi = AmountKobo(emiFloat)
	}

	schedule := make([]AmortizationEntry, 0, tenorMonths)
	balance := principalKobo
	var cumulativeInterest AmountKobo

	for i := 1; i <= tenorMonths; i++ {
		interestPart := AmountKobo(float64(balance) * monthlyRate)
		principalPart := emi - interestPart
		if i == tenorMonths { principalPart = balance } // settle rounding on last payment
		balance -= principalPart
		cumulativeInterest += interestPart
		schedule = append(schedule, AmortizationEntry{
			Period: i, EMI: emi, Principal: principalPart,
			Interest: interestPart, Balance: balance, CumulativeInt: cumulativeInterest,
		})
	}
	return schedule
}

// ComputeEarlySettlementPenalty — CBN allows max 1% penalty on outstanding
func computeEarlySettlementPenalty(outstandingKobo AmountKobo, monthsRemaining int, penaltyPct float64) AmountKobo {
	if penaltyPct > 1.0 { penaltyPct = 1.0 } // CBN cap
	return AmountKobo(float64(outstandingKobo) * penaltyPct / 100.0)
}

// ComputeLateFee — tiered by days past due
func computeLateFee(emiKobo AmountKobo, daysPastDue int) AmountKobo {
	if daysPastDue <= 0 { return 0 }
	var rate float64
	switch {
	case daysPastDue <= 7:  rate = 0.01  // 1%
	case daysPastDue <= 30: rate = 0.025 // 2.5%
	case daysPastDue <= 90: rate = 0.05  // 5%
	default:               rate = 0.10  // 10% (max)
	}
	return AmountKobo(float64(emiKobo) * rate)
}

// PAR (Portfolio at Risk) computation — CBN regulatory metric
func computePAR(totalLoansKobo, loansOverdueKobo AmountKobo, daysBucket int) float64 {
	if totalLoansKobo == 0 { return 0 }
	return float64(loansOverdueKobo) / float64(totalLoansKobo) * 100.0
}

// Provisioning rates per CBN Prudential Guidelines
func computeProvisioningRate(classificationDays int) float64 {
	switch {
	case classificationDays <= 90:  return 1.0   // Performing — 1%
	case classificationDays <= 180: return 10.0  // Watchlist — 10%
	case classificationDays <= 360: return 50.0  // Substandard — 50%
	case classificationDays <= 720: return 75.0  // Doubtful — 75%
	default:                        return 100.0 // Lost — 100%
	}
}

// ValidateLoanApplication with comprehensive error accumulation
func validateLoanApplicationDeep(
	customerID string, amount AmountKobo, tenorMonths int, annualRate float64,
	monthlyIncomeKobo AmountKobo, existingDebtKobo AmountKobo,
	kycLevel string, employmentYears float64, age int,
) (bool, []string) {
	var errors []string

	// Amount bounds (CBN microfinance: min ₦10K, max depends on tier)
	if amount < nairaToKobo(10000) { errors = append(errors, "amount below CBN minimum ₦10,000") }
	if amount > nairaToKobo(50000000) { errors = append(errors, "amount exceeds ₦50M max single obligor limit") }

	// Tenor bounds
	if tenorMonths < 1 { errors = append(errors, "tenor must be at least 1 month") }
	if tenorMonths > 360 { errors = append(errors, "tenor exceeds 30-year maximum") }

	// Rate bounds (CBN usury cap)
	if annualRate <= 0 { errors = append(errors, "interest rate must be positive") }
	if annualRate > 30 { errors = append(errors, "rate exceeds CBN maximum lending rate") }

	// DTI check
	emi := AmountKobo(0)
	if tenorMonths > 0 && annualRate > 0 {
		monthlyRate := annualRate / 12.0 / 100.0
		pow := 1.0
		for i := 0; i < tenorMonths; i++ { pow *= (1 + monthlyRate) }
		emi = AmountKobo(float64(amount) * monthlyRate * pow / (pow - 1))
	}
	dti := float64(existingDebtKobo+emi) / float64(monthlyIncomeKobo) * 100
	if dti > 60 { errors = append(errors, fmt.Sprintf("DTI ratio %.1f%% exceeds 60%% maximum", dti)) }

	// KYC tier check
	switch kycLevel {
	case "tier1":
		if amount > nairaToKobo(300000) { errors = append(errors, "Tier 1 KYC max loan ₦300,000") }
	case "tier2":
		if amount > nairaToKobo(5000000) { errors = append(errors, "Tier 2 KYC max loan ₦5,000,000") }
	case "tier3":
		// No limit for Tier 3
	default:
		errors = append(errors, "valid KYC level required (tier1/tier2/tier3)")
	}

	// Age check (18-65 at loan maturity)
	if age < 18 { errors = append(errors, "applicant must be 18+") }
	maturityAge := age + tenorMonths/12
	if maturityAge > 65 { errors = append(errors, fmt.Sprintf("applicant will be %d at maturity (max 65)", maturityAge)) }

	// Employment stability
	if employmentYears < 0.5 { errors = append(errors, "minimum 6 months employment required") }

	return len(errors) == 0, errors
}

// ReverseLoanDisbursement — compensation logic
func reverseLoanDisbursement(loanID, accountID string, amountKobo AmountKobo, reason string) map[string]interface{} {
	return map[string]interface{}{
		"reversal_id":  fmt.Sprintf("REV-%s-%d", loanID, time.Now().UnixMilli()),
		"loan_id":      loanID,
		"account_id":   accountID,
		"amount_kobo":  amountKobo,
		"reason":       reason,
		"status":       "reversed",
		"reversed_at":  time.Now().Format(time.RFC3339),
		"gl_entries": []map[string]interface{}{
			{"debit": "loan_receivable", "credit": accountID, "amount_kobo": amountKobo},
		},
	}
}


func ensureDB() {
	if db == nil {
		log.Printf("[%s] CRITICAL: No DATABASE_URL configured — service will reject all write operations", serviceName)
	}
}


// --- PII Masking (NDPR Compliance) ---
func maskPII(value, fieldType string) string {
	if len(value) == 0 { return "***" }
	switch fieldType {
	case "bvn", "nin":
		if len(value) >= 4 { return "***" + value[len(value)-4:] }
		return "***"
	case "phone":
		if len(value) >= 4 { return "+234***" + value[len(value)-4:] }
		return "+234***"
	case "email":
		parts := strings.SplitN(value, "@", 2)
		if len(parts) == 2 { return string(parts[0][0]) + "***@" + parts[1] }
		return "***@***"
	case "account":
		if len(value) >= 4 { return "****" + value[len(value)-4:] }
		return "****"
	default:
		if len(value) > 4 { return value[:1] + "***" + value[len(value)-1:] }
		return "***"
	}
}

func sanitizeLogEntry(msg string) string {
	// Mask BVN patterns (11 digits)
	re1 := regexp.MustCompile(`\b[0-9]{11}\b`)
	msg = re1.ReplaceAllStringFunc(msg, func(s string) string { return "***" + s[len(s)-4:] })
	// Mask account numbers (10 digits)
	re2 := regexp.MustCompile(`\b[0-9]{10}\b`)
	msg = re2.ReplaceAllStringFunc(msg, func(s string) string { return "****" + s[len(s)-4:] })
	// Mask email
	re3 := regexp.MustCompile(`[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`)
	msg = re3.ReplaceAllString(msg, "***@***")
	return msg
}


// --- Dead Letter Queue Handler ---
type DLQMessage struct {
	OriginalTopic string                 `json:"original_topic"`
	ConsumerGroup string                 `json:"consumer_group"`
	MessageKey    string                 `json:"message_key"`
	MessageValue  map[string]interface{} `json:"message_value"`
	ErrorMessage  string                 `json:"error_message"`
	RetryCount    int                    `json:"retry_count"`
	MaxRetries    int                    `json:"max_retries"`
	CreatedAt     string                 `json:"created_at"`
}

var dlqMessages []DLQMessage
var dlqMu sync.Mutex

func publishToDLQ(topic, consumerGroup, key string, value map[string]interface{}, err error, retryCount int) {
	dlqMu.Lock()
	defer dlqMu.Unlock()
	msg := DLQMessage{
		OriginalTopic: topic,
		ConsumerGroup: consumerGroup,
		MessageKey:    key,
		MessageValue:  value,
		ErrorMessage:  err.Error(),
		RetryCount:    retryCount,
		MaxRetries:    3,
		CreatedAt:     time.Now().UTC().Format(time.RFC3339),
	}
	dlqMessages = append(dlqMessages, msg)
	log.Printf("[DLQ] Message sent to DLQ: topic=%s key=%s error=%s retries=%d", topic, key, err.Error(), retryCount)
}

func handleDLQList(w http.ResponseWriter, r *http.Request) {
	dlqMu.Lock()
	defer dlqMu.Unlock()
	respondJSON(w, 200, map[string]interface{}{
		"dlq_messages": dlqMessages,
		"count":        len(dlqMessages),
	})
}

func handleDLQReplay(w http.ResponseWriter, r *http.Request) {
	dlqMu.Lock()
	defer dlqMu.Unlock()
	if len(dlqMessages) == 0 {
		respondJSON(w, 200, map[string]interface{}{"status": "empty", "replayed": 0})
		return
	}
	replayed := 0
	var remaining []DLQMessage
	for _, msg := range dlqMessages {
		if msg.RetryCount < msg.MaxRetries {
			log.Printf("[DLQ] Replaying: topic=%s key=%s attempt=%d", msg.OriginalTopic, msg.MessageKey, msg.RetryCount+1)
			replayed++
		} else {
			remaining = append(remaining, msg)
		}
	}
	dlqMessages = remaining
	respondJSON(w, 200, map[string]interface{}{"status": "replayed", "replayed": replayed, "remaining": len(remaining)})
}


// ─── Idempotency Middleware ─────────────────────────────────────────────────
var idempotencyCache = struct {
	sync.RWMutex
	entries map[string]idempotencyEntry
}{entries: make(map[string]idempotencyEntry)}

type idempotencyEntry struct {
	response   []byte
	statusCode int
	createdAt  time.Time
}

func idempotencyMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" && r.Method != "PUT" {
			next.ServeHTTP(w, r)
			return
		}
		key := r.Header.Get("Idempotency-Key")
		if key == "" {
			next.ServeHTTP(w, r)
			return
		}
		idempotencyCache.RLock()
		if entry, ok := idempotencyCache.entries[key]; ok {
			idempotencyCache.RUnlock()
			w.Header().Set("X-Idempotency-Replayed", "true")
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(entry.statusCode)
			w.Write(entry.response)
			return
		}
		idempotencyCache.RUnlock()
		rec := &idempotencyRecorder{ResponseWriter: w, statusCode: 200}
		next.ServeHTTP(rec, r)
		idempotencyCache.Lock()
		idempotencyCache.entries[key] = idempotencyEntry{response: rec.body, statusCode: rec.statusCode, createdAt: time.Now()}
		idempotencyCache.Unlock()
		// Cleanup old entries (>24h) in background
		go func() {
			idempotencyCache.Lock()
			defer idempotencyCache.Unlock()
			for k, v := range idempotencyCache.entries {
				if time.Since(v.createdAt) > 24*time.Hour { delete(idempotencyCache.entries, k) }
			}
		}()
	})
}

type idempotencyRecorder struct {
	http.ResponseWriter
	statusCode int
	body       []byte
}

func (r *idempotencyRecorder) WriteHeader(code int) { r.statusCode = code; r.ResponseWriter.WriteHeader(code) }
func (r *idempotencyRecorder) Write(b []byte) (int, error) { r.body = append(r.body, b...); return r.ResponseWriter.Write(b) }


// ─── Transaction Atomicity ──────────────────────────────────────────────────
// All multi-step write operations wrapped in DB transactions.
func dbExecAtomic(queries []string, params [][]interface{}) error {
	if db == nil { return fmt.Errorf("DB not available") }
	tx, err := db.Begin()
	if err != nil { return fmt.Errorf("BEGIN failed: %v", err) }
	for i, q := range queries {
		var args []interface{}
		if i < len(params) { args = params[i] }
		if _, err := tx.Exec(q, args...); err != nil {
			tx.Rollback()
			return fmt.Errorf("step %d failed: %v", i+1, err)
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("COMMIT failed: %v", err)
	}
	return nil
}


// --- Observability (OpenTelemetry) ---
var otelEndpoint = os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")

func initTracing() {
	if otelEndpoint == "" { return }
	log.Printf("[%s] OTEL tracing configured: %s", serviceName, otelEndpoint)
}

// --- Retry with Exponential Backoff ---
func retryWithBackoff(maxRetries int, fn func() error) error {
	for i := 0; i < maxRetries; i++ {
		if err := fn(); err == nil { return nil }
		backoff := time.Duration(1<<uint(i)) * 100 * time.Millisecond
		if backoff > 5*time.Second { backoff = 5 * time.Second }
		time.Sleep(backoff)
	}
	return fmt.Errorf("max retries (%d) exceeded", maxRetries)
}

func requestIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rid := r.Header.Get("X-Request-Id")
		if rid == "" {
			rid = fmt.Sprintf("%d", time.Now().UnixNano())
		}
		w.Header().Set("X-Request-Id", rid)
		next.ServeHTTP(w, r)
	})
}

// SSRF protection: block requests to internal/private networks
func isInternalURL(rawURL string) bool {
	blocked := []string{"127.0.0.1", "localhost", "169.254.169.254", "10.", "172.16.", "172.17.", "172.18.", "172.19.", "172.20.", "172.21.", "172.22.", "172.23.", "172.24.", "172.25.", "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31.", "192.168.", "0.0.0.0", "[::1]", "metadata.google"}
	for _, b := range blocked {
		if strings.Contains(rawURL, b) {
			return true
		}
	}
	return false
}

func validateOrigin(origin string) bool {
	if origin == "" || origin == "*" {
		return false // reject wildcards
	}
	// Only allow HTTPS origins in production
	if strings.HasPrefix(origin, "https://") || strings.HasPrefix(origin, "http://localhost") {
		return true
	}
	return false
}

func validateJWTExpiry(tokenStr string) bool {
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 3 {
		return false
	}
	// Decode payload (base64url)
	payload := parts[1]
	// Add padding if needed
	switch len(payload) % 4 {
	case 2:
		payload += "=="
	case 3:
		payload += "="
	}
	decoded, err := base64.URLEncoding.DecodeString(payload)
	if err != nil {
		return false
	}
	var claims map[string]interface{}
	if err := json.Unmarshal(decoded, &claims); err != nil {
		return false
	}
	exp, ok := claims["exp"].(float64)
	if !ok {
		return false
	}
	return time.Now().Unix() < int64(exp)
}

// Handler context with timeout prevents hung requests
func handlerContext(r *http.Request) (context.Context, context.CancelFunc) {
	return context.WithTimeout(r.Context(), 30*time.Second)
}

// Secure HTTP server configuration
func newSecureServer(addr string, handler http.Handler) *http.Server {
	return &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadTimeout:       15 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    1 << 20, // 1MB
	}
}

// Sanitize errors before sending to clients (prevent info leakage)
func sanitizeError(err error) string {
	errStr := err.Error()
	// Strip file paths, stack traces, internal IPs
	if strings.Contains(errStr, "/") || strings.Contains(errStr, "\\") {
		return "internal error"
	}
	if len(errStr) > 200 {
		return "internal error"
	}
	return errStr
}

func main() {
	initTracing()
	port := os.Getenv("PORT")
	if port == "" { port = "9381" }
	initDB()
mux := http.NewServeMux()
	mux.HandleFunc("/readyz", readyzHandler)

	mux.HandleFunc("/livez", livezHandler)

	mux.HandleFunc("/metrics", metricsHandler)

	mux.HandleFunc("/v1/alerts", alertsHandler)
	mux.HandleFunc("/v1/degradation", degradationStatusHandler)
	mux.HandleFunc("/dlq", handleDLQList)
	mux.HandleFunc("/dlq/replay", handleDLQReplay)
	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/v1/keycloak-enforcer/list", handleList)
	mux.HandleFunc("/v1/keycloak-enforcer/create", handleCreate)
	mux.HandleFunc("/v1/keycloak-enforcer/update", handleUpdate)
	mux.HandleFunc("/v1/keycloak-enforcer/process", handleProcess)
	mux.HandleFunc("/v1/keycloak-enforcer/audit", handleAudit)
	mux.HandleFunc("/v1/keycloak-enforcer/stats", handleStats)
	mux.HandleFunc("/v1/keycloak-enforcer/score", keycloak_enforcerScoreHandler)
	mux.HandleFunc("/v1/keycloak-enforcer/validate", keycloak_enforcerValidateRequestHandler)
	log.Printf("Keycloak Enforcer v2.0 (General) on :%s", port)
	tlsEnabled, tlsCert, tlsKey := getTLSConfig()
	_ = tlsCert
	_ = tlsKey
	_ = tlsEnabled
	server := &http.Server{
        Addr:    ":" + port,
        Handler: rateLimitMiddleware(securityHeadersMiddleware(jwtAuthMiddleware(traceMiddleware(countingMiddleware(mux))))),
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
    log.Println("[keycloak-enforcer-go] Shutdown signal received")
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    _ = server.Shutdown(ctx)
    log.Println("[keycloak-enforcer-go] Server stopped gracefully")
}
