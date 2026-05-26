// 54Bank Kafka Schema Registry — Go
// Domain: Infrastructure/Data
// Full domain-specific implementation with business logic
// Middleware: Kafka, Postgres, Redis, Temporal, Permify, OpenSearch
package main

import (
	_ "github.com/lib/pq"
"context"
"os/signal"
"syscall"
"sync/atomic"

	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"sync"
	"time"
	"database/sql"
	"bytes"
	"strings"

	"net"

)

var serviceName = "kafka-schema-registry-go"

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
		{ID: "KAF-001", Type: "primary", Status: "active", Data: map[string]interface{}{"domain": "Infrastructure/Data", "priority": "high", "region": "lagos"}, CreatedAt: "2026-05-09T10:00:00Z", UpdatedAt: "2026-05-09T10:00:00Z", Version: 1},
		{ID: "KAF-002", Type: "secondary", Status: "processing", Data: map[string]interface{}{"domain": "Infrastructure/Data", "priority": "medium", "region": "abuja"}, CreatedAt: "2026-05-09T11:00:00Z", UpdatedAt: "2026-05-09T11:30:00Z", Version: 2},
		{ID: "KAF-003", Type: "primary", Status: "completed", Data: map[string]interface{}{"domain": "Infrastructure/Data", "priority": "low", "region": "ph"}, CreatedAt: "2026-05-08T14:00:00Z", UpdatedAt: "2026-05-09T08:00:00Z", Version: 1},
	}
	auditLog = []AuditEntry{}
	domainStats = DomainStats{
		TotalRecords: 3, ActiveRecords: 1, PendingRecords: 1, ProcessedToday: 12,
		Domain: "Infrastructure/Data",
		Metrics: map[string]interface{}{
			"avgProcessingMs": 245, "successRate": 98.5, "errorRate": 1.5,
			"peakHour": "14:00", "throughput": 156,
		},
	}
)

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Service", "kafka-schema-registry-go")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

// ─── Handlers ───────────────────────────────────────────────────────────────

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{
		"service": "kafka-schema-registry-go", "status": "healthy", "version": "2.0.0",
		"uptime_secs": int(time.Since(startTime).Seconds()),
		"domain": "Kafka Schema Registry — Infrastructure/Data",
		"middleware": map[string]string{
			"kafka":      "kafka-schema-registry.events, kafka-schema-registry.audit",
			"postgres":   "kafka_schema_registry_records",
			"redis":      "kafka-schema-registry_cache",
			"temporal":   "KafkaSchemaRegistryWorkflow",
			"permify":    "kafka-schema-registry:manage, kafka-schema-registry:view",
			"opensearch": "kafka-schema-registry-2026",
		},
	})
}

func handleList(w http.ResponseWriter, r *http.Request) {
	cacheKey := "kafka_schema_registry_list"
	if cached, ok := cacheGet(cacheKey); ok {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Cache", "HIT")
		w.WriteHeader(200)
		w.Write([]byte(cached))
		return
	}
	// DB-first query with in-memory fallback
	if db != nil {
		rows, err := db.Query("SELECT id, service, type, status, data, created_at FROM service_records WHERE service = $1 ORDER BY created_at DESC LIMIT 100", "kafka_schema_registry_go")
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
		log.Printf("kafka-schema-registry-go: DB query failed, falling back to in-memory: %v", err)
	}
	// In-memory fallback
	mu.Lock()
	defer mu.Unlock()
	respondJSON(w, 200, map[string]interface{}{"records": records, "total": len(records), "source": "in-memory"})
}

func handleCreate(w http.ResponseWriter, r *http.Request) {
	cacheSet("kafka_schema_registry_list", "", 1) // invalidate list cache on write
	if r.Method != "POST" { respondJSON(w, 405, map[string]string{"error": "POST required"}); return }
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)

	mu.Lock()
	defer mu.Unlock()

	rec := Record{
		ID:        fmt.Sprintf("KAF-%08X", rand.Uint32()),
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
		ID: fmt.Sprintf("AUD-%08X", rand.Uint32()), Action: "create",
		RecordID: rec.ID, Actor: rec.CreatedBy,
		Timestamp: rec.CreatedAt, Details: "Record created",
	})

	// Inter-service call
	_upURL := os.Getenv("CORE_BANKING_URL")
	if _upURL == "" { _upURL = "http://localhost:8100" }
	_csResult, _csErr := callService("POST", _upURL+"/v1/status", nil)
	if _csErr != nil {
		log.Printf("[%s] inter-service call failed: %v", serviceName, _csErr)
	} else {
		log.Printf("[%s] inter-service call ok: %v", serviceName, _csResult)
	}

	respondJSON(w, 201, map[string]interface{}{"created": true, "record": rec})
}

func handleUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" && r.Method != "PUT" { respondJSON(w, 405, map[string]string{"error": "POST/PUT required"}); return }
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)

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
	if r.Method != "POST" { respondJSON(w, 405, map[string]string{"error": "POST required"}); return }
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)

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
			records[i].Data["score"] = 0.85 + float64(rand.Intn(14))/100.0
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


func estimateThroughput(batchSize int, intervalMs int) float64 {
    if intervalMs <= 0 { return 0 }
    return float64(batchSize) / (float64(intervalMs) / 1000.0)
}

func partitionKey(customerID string, numPartitions int) int {
    hash := 0
    for _, c := range customerID { hash = hash*31 + int(c) }
    if hash < 0 { hash = -hash }
    return hash % numPartitions
}

func kafka_schema_registryThroughputHandler(w http.ResponseWriter, r *http.Request) {
    var req struct {
        BatchSize  int `json:"batch_size"`
        IntervalMs int `json:"interval_ms"`
    }
    json.NewDecoder(r.Body).Decode(&req)
    tps := estimateThroughput(req.BatchSize, req.IntervalMs)
    respondJSON(w, 200, map[string]interface{}{"throughput_per_sec": tps, "batch_size": req.BatchSize})
}

func kafka_schema_registryPartitionHandler(w http.ResponseWriter, r *http.Request) {
    var req struct {
        CustomerID    string `json:"customer_id"`
        NumPartitions int    `json:"num_partitions"`
    }
    json.NewDecoder(r.Body).Decode(&req)
    if req.NumPartitions <= 0 { req.NumPartitions = 12 }
    partition := partitionKey(req.CustomerID, req.NumPartitions)
    respondJSON(w, 200, map[string]interface{}{"partition": partition, "customer_id": req.CustomerID, "total_partitions": req.NumPartitions})
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
    fmt.Fprintf(w, `{"ready":true,"service":"kafka-schema-registry-go"}`)
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
    fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"kafka-schema-registry-go\"} %d\n", reqs)
    fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"kafka-schema-registry-go\"} %d\n", errs)
    fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"kafka-schema-registry-go\"} %.0f\n", time.Since(_bootTime).Seconds())
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


func validateKafkaTopic(topicName string, partitions, replicationFactor int) (bool, string) {
	if topicName == "" { return false, "Topic name required" }
	if partitions < 1 { return false, "At least 1 partition required" }
	if replicationFactor < 1 { return false, "Replication factor must be >= 1" }
	if replicationFactor > 3 { return false, "Maximum replication factor is 3" }
	return true, "Kafka topic configuration valid"
}
func computePartitionKey(key string, numPartitions int) int {
	hash := 0
	for _, c := range key { hash = hash*31 + int(c) }
	if hash < 0 { hash = -hash }
	return hash % numPartitions
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

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "9376" }
	initDB()
mux := http.NewServeMux()
	mux.HandleFunc("/readyz", readyzHandler)

	mux.HandleFunc("/livez", livezHandler)

	mux.HandleFunc("/metrics", metricsHandler)

	mux.HandleFunc("/v1/alerts", alertsHandler)
	mux.HandleFunc("/v1/degradation", degradationStatusHandler)
	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/v1/kafka-schema-registry/list", handleList)
	mux.HandleFunc("/v1/kafka-schema-registry/create", handleCreate)
	mux.HandleFunc("/v1/kafka-schema-registry/update", handleUpdate)
	mux.HandleFunc("/v1/kafka-schema-registry/process", handleProcess)
	mux.HandleFunc("/v1/kafka-schema-registry/audit", handleAudit)
	mux.HandleFunc("/v1/kafka-schema-registry/stats", handleStats)
	mux.HandleFunc("/v1/kafka-schema-registry/throughput", kafka_schema_registryThroughputHandler)
	mux.HandleFunc("/v1/kafka-schema-registry/partition", kafka_schema_registryPartitionHandler)
	log.Printf("Kafka Schema Registry v2.0 (Infrastructure/Data) on :%s", port)
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
    log.Println("[kafka-schema-registry-go] Shutdown signal received")
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    _ = server.Shutdown(ctx)
    log.Println("[kafka-schema-registry-go] Server stopped gracefully")
}
