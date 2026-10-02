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
	mathrand "math/rand"
	"os/signal"
	"strconv"
	"sync/atomic"
	"syscall"

	"bytes"
	"crypto/rand"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// _jitterW11 applies full jitter to retry backoff sleeps (GPT-04): returns a
// duration in [d/2, d), matching the service-framework-go Retry pattern.
func _jitterW11(d time.Duration) time.Duration {
	return d/2 + time.Duration(mathrand.Int63n(int64(d)/2))
}

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

var db *sql.DB

// cryptoRandUint32 returns a cryptographically secure random uint32 for
// record and audit identifiers (L-06/L-16-residual: math/rand IDs are
// predictable and collision-prone).
func cryptoRandUint32() uint32 {
	var b [4]byte
	if _, err := rand.Read(b[:]); err != nil {
		log.Fatalf("crypto/rand unavailable: %v", err)
	}
	return binary.BigEndian.Uint32(b[:])
}

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
	mu      sync.RWMutex
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

const (
	maxInMemoryRecords = 5000
	maxAuditEntries    = 2000
)

// appendRecord persists to Postgres FIRST (PG-authoritative, W12-C3P2B1) and
// updates the bounded in-memory mirror only after a successful INSERT. When no
// database is configured the service runs in documented degraded-memory mode
// and the mirror is the only copy. An error means the record was NOT persisted
// and NOT mirrored; callers must fail the request (503).
func appendRecord(rec Record) error {
	if db != nil {
		dataBytes, merr := json.Marshal(rec.Data)
		if merr != nil {
			return merr
		}
		if err := dbInsert(rec.ID, serviceName, rec.Type, rec.Status, dataBytes); err != nil {
			return err
		}
	}
	records = append(records, rec)
	if len(records) > maxInMemoryRecords {
		copy(records, records[len(records)-maxInMemoryRecords:])
		records = records[:maxInMemoryRecords]
	}
	return nil
}

// appendAudit persists to the audit_log table FIRST (PG-authoritative,
// W12-C3P2B1) and updates the bounded in-memory mirror only after a successful
// INSERT; on insert failure the entry is deliberately NOT mirrored so the
// memory mirror never claims durability Postgres does not have. When no
// database is configured the mirror is the only copy (degraded-memory mode).
func appendAudit(e AuditEntry) {
	if db != nil {
		if err := dbAuditInsert(e); err != nil {
			log.Printf("[%s] audit_log insert failed - entry NOT mirrored in memory: %v", serviceName, err)
			return
		}
	}
	auditLog = append(auditLog, e)
	if len(auditLog) > maxAuditEntries {
		copy(auditLog, auditLog[len(auditLog)-maxAuditEntries:])
		auditLog = auditLog[:maxAuditEntries]
	}
}

// parsePageParams extracts limit/offset query params with a hard cap (GPT-07).
func parsePageParams(r *http.Request, defLimit, maxLimit int) (limit, offset int) {
	limit = defLimit
	if l, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && l > 0 {
		limit = l
	}
	if limit > maxLimit {
		limit = maxLimit
	}
	if o, err := strconv.Atoi(r.URL.Query().Get("offset")); err == nil && o > 0 {
		offset = o
	}
	return
}

// paginateRecords bounds list responses (default 100, max 500 per page).
func paginateRecords(all []Record, r *http.Request) []Record {
	limit, offset := parsePageParams(r, 100, 500)
	if offset >= len(all) {
		return []Record{}
	}
	end := offset + limit
	if end > len(all) {
		end = len(all)
	}
	return all[offset:end]
}

// paginateAudit bounds audit responses (default 100, max 500 per page).
func paginateAudit(all []AuditEntry, r *http.Request) []AuditEntry {
	limit, offset := parsePageParams(r, 100, 500)
	if offset >= len(all) {
		return []AuditEntry{}
	}
	end := offset + limit
	if end > len(all) {
		end = len(all)
	}
	return all[offset:end]
}

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
	// PG-authoritative read (W12-C3P2B1): records are served from Postgres.
	// The bounded in-memory store below is only a degraded-mode fallback
	// mirror and is explicitly marked as such.
	if db != nil {
		rows, err := db.Query("SELECT id, service, type, status, data, created_at FROM service_records WHERE service = $1 ORDER BY created_at DESC LIMIT 100", serviceName)
		if err == nil {
			defer rows.Close()
			items := []map[string]interface{}{}
			for rows.Next() {
				var id, svc, typ, rstatus, data string
				var createdAt time.Time
				if rows.Scan(&id, &svc, &typ, &rstatus, &data, &createdAt) == nil {
					items = append(items, map[string]interface{}{"id": id, "type": typ, "status": rstatus, "data": data, "created_at": createdAt})
				}
			}
			respondJSON(w, 200, map[string]interface{}{"records": items, "total": len(items), "domain": "Security", "source": "database"})
			return
		}
		log.Printf("[%s] DB query failed - degraded-memory fallback: %v", serviceName, err)
	} else {
		log.Printf("[%s] no database configured - records served from degraded memory mirror", serviceName)
	}
	mu.RLock()
	defer mu.RUnlock()
	status := r.URL.Query().Get("status")
	filtered := []Record{}
	for _, rec := range records {
		if status == "" || rec.Status == status {
			filtered = append(filtered, rec)
		}
	}
	respondJSON(w, 200, map[string]interface{}{"records": paginateRecords(filtered, r), "total": len(filtered), "domain": "Security", "source": "degraded-memory"})
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
		ID:        fmt.Sprintf("SEC-%08X", cryptoRandUint32()),
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
	if err := appendRecord(rec); err != nil {
		log.Printf("[%s] record INSERT failed - record NOT created: %v", serviceName, err)
		respondJSON(w, 503, map[string]string{"error": "persistence unavailable: record not created"})
		return
	}
	domainStats.TotalRecords = len(records)

	appendAudit(AuditEntry{
		ID: fmt.Sprintf("AUD-%08X", cryptoRandUint32()), Action: "create",
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
			// Build the updated record on a copy FIRST (W12-C3P2B1): the
			// in-memory mirror is mutated only after Postgres accepts the
			// write — PG is authoritative, memory is a mirror.
			updated := records[i]
			newData := make(map[string]interface{}, len(records[i].Data)+len(body))
			for k, v := range records[i].Data {
				newData[k] = v
			}
			updated.Data = newData
			if s := getString(body, "status"); s != "" {
				updated.Status = s
			}
			for k, v := range body {
				if k != "id" {
					updated.Data[k] = v
				}
			}
			updated.UpdatedAt = time.Now().Format(time.RFC3339)
			updated.Version++
			if db != nil {
				dataBytes, merr := json.Marshal(updated.Data)
				if merr != nil {
					respondJSON(w, 500, map[string]string{"error": "record encode failed"})
					return
				}
				res, uerr := db.Exec("UPDATE service_records SET status = $1, data = $2 WHERE id = $3 AND service = $4", updated.Status, string(dataBytes), id, serviceName)
				if uerr != nil {
					log.Printf("[%s] record UPDATE failed - record NOT updated: %v", serviceName, uerr)
					respondJSON(w, 503, map[string]string{"error": "persistence unavailable: record not updated"})
					return
				}
				if n, _ := res.RowsAffected(); n == 0 {
					// Row absent in PG (created before the flip or in degraded
					// mode): backfill via INSERT so PG is authoritative from
					// this write onward.
					if ierr := dbInsert(updated.ID, serviceName, updated.Type, updated.Status, dataBytes); ierr != nil {
						log.Printf("[%s] record UPDATE backfill INSERT failed - record NOT updated: %v", serviceName, ierr)
						respondJSON(w, 503, map[string]string{"error": "persistence unavailable: record not updated"})
						return
					}
				}
			}
			records[i] = updated
			appendAudit(AuditEntry{
				ID: fmt.Sprintf("AUD-%08X", cryptoRandUint32()), Action: "update",
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
	// PG-authoritative read (W12-C3P2B1): the audit log is served from
	// Postgres. The bounded in-memory log is only a degraded-mode fallback
	// mirror and is explicitly marked as such.
	if db != nil {
		rows, err := db.Query("SELECT id, action, record_id, actor, timestamp, details FROM audit_log WHERE service = $1 ORDER BY created_at DESC LIMIT 100", serviceName)
		if err == nil {
			defer rows.Close()
			items := []map[string]interface{}{}
			for rows.Next() {
				var id, action, recordID, actor, ts, details string
				if rows.Scan(&id, &action, &recordID, &actor, &ts, &details) == nil {
					items = append(items, map[string]interface{}{"id": id, "action": action, "recordId": recordID, "actor": actor, "timestamp": ts, "details": details})
				}
			}
			respondJSON(w, 200, map[string]interface{}{"auditLog": items, "total": len(items), "source": "database"})
			return
		}
		log.Printf("[%s] audit_log query failed - degraded-memory fallback: %v", serviceName, err)
	} else {
		log.Printf("[%s] no database configured - audit log served from degraded memory mirror", serviceName)
	}
	mu.RLock()
	defer mu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{"auditLog": paginateAudit(auditLog, r), "total": len(auditLog), "source": "degraded-memory"})
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

// sanitizeLogValue strips CR/LF and other control characters from
// client-supplied values (e.g. trace headers) before they reach log
// statements, preventing log injection/forgery (L-18). Output length is
// bounded to keep log lines small.
func sanitizeLogValue(s string) string {
	const maxLen = 128
	if len(s) > maxLen {
		s = s[:maxLen]
	}
	return strings.Map(func(r rune) rune {
		if r < 0x20 || r == 0x7f {
			return -1
		}
		return r
	}, s)
}

// --- Distributed Tracing ---
func traceMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		traceID := sanitizeLogValue(r.Header.Get("X-Trace-Id"))
		if traceID == "" {
			traceID = sanitizeLogValue(r.Header.Get("traceparent"))
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

// dbAuditInsert persists one audit entry to the shared audit_log table
// (W12-C3P2B1).
func dbAuditInsert(e AuditEntry) error {
	if db == nil {
		return fmt.Errorf("no db")
	}
	_, err := db.Exec("INSERT INTO audit_log (id, service, action, record_id, actor, timestamp, details) VALUES ($1,$2,$3,$4,$5,$6,$7)",
		e.ID, serviceName, e.Action, e.RecordID, e.Actor, e.Timestamp, e.Details)
	return err
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
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 {
			time.Sleep(_jitterW11(time.Duration(1<<uint(attempt)) * 200 * time.Millisecond))
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
		resp, err := sharedHTTPClient.Do(req)
		if err != nil {
			lastErr = err
			_cb.recordFailure()
			log.Printf("[%s] %s %s attempt %d failed: %v", serviceName, method, url, attempt+1, err)
			continue
		}
		if resp.StatusCode >= 500 {
			resp.Body.Close()
			lastErr = fmt.Errorf("upstream %s returned %d", url, resp.StatusCode)
			_cb.recordFailure()
			continue
		}
		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)
		resp.Body.Close()
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

// ensureRecordsSchemaW12 creates the PG-authoritative record/audit stores
// (W12-C3P2B1). Idempotent; no-op when the service runs without a database
// (documented degraded-memory mode).
func ensureRecordsSchemaW12() {
	if db == nil {
		return
	}
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS service_records (
		id TEXT PRIMARY KEY, service TEXT NOT NULL, type TEXT DEFAULT 'default',
		status TEXT DEFAULT 'active', data JSONB DEFAULT '{}',
		created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
		created_by TEXT DEFAULT '', tenant_id TEXT DEFAULT ''
	)`); err != nil {
		log.Printf("[%s] service_records schema init failed: %v", serviceName, err)
	}
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS audit_log (
		id TEXT PRIMARY KEY, service TEXT NOT NULL, action TEXT NOT NULL,
		record_id TEXT DEFAULT '', actor TEXT DEFAULT '', timestamp TEXT DEFAULT '',
		details TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT NOW()
	)`); err != nil {
		log.Printf("[%s] audit_log schema init failed: %v", serviceName, err)
	}
	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_audit_log_svc_created ON audit_log(service, created_at DESC)`)
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
			ensureRecordsSchemaW12()
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

	mux.Handle("/v1/alerts", jwtMiddleware(jwtRealmURL(), permifyAuthzGuard("security_gateway", "view", http.HandlerFunc(alertsHandler))))
	mux.HandleFunc("/healthz", handleHealthz)
	mux.Handle("/v1/security-gateway/list", jwtMiddleware(jwtRealmURL(), permifyAuthzGuard("security_gateway", "view", http.HandlerFunc(handleList))))
	mux.Handle("/v1/security-gateway/create", jwtMiddleware(jwtRealmURL(), permifyAuthzGuard("security_gateway", "create", http.HandlerFunc(handleCreate))))
	mux.Handle("/v1/security-gateway/update", jwtMiddleware(jwtRealmURL(), permifyAuthzGuard("security_gateway", "update", http.HandlerFunc(handleUpdate))))
	mux.Handle("/v1/security-gateway/process", jwtMiddleware(jwtRealmURL(), permifyAuthzGuard("security_gateway", "process", http.HandlerFunc(handleProcess))))
	mux.Handle("/v1/security-gateway/audit", jwtMiddleware(jwtRealmURL(), permifyAuthzGuard("security_gateway", "view", http.HandlerFunc(handleAudit))))
	mux.Handle("/v1/security-gateway/stats", jwtMiddleware(jwtRealmURL(), permifyAuthzGuard("security_gateway", "view", http.HandlerFunc(handleStats))))
	mux.Handle("/v1/security-gateway/health-score", jwtMiddleware(jwtRealmURL(), permifyAuthzGuard("security_gateway", "health_score", http.HandlerFunc(security_gatewayHealthScoreHandler))))
	mux.Handle("/v1/security-gateway/circuit-state", jwtMiddleware(jwtRealmURL(), permifyAuthzGuard("security_gateway", "circuit_state", http.HandlerFunc(security_gatewayCircuitHandler))))
	log.Printf("Security Gateway v2.0 (Security) on :%s", port)
	tlsEnabled, tlsCert, tlsKey := getTLSConfig()
	_ = tlsCert
	_ = tlsKey
	_ = tlsEnabled
	server := &http.Server{
		Addr:              ":" + port,
		Handler:           jwtAuthMiddleware(rateLimitMiddleware(securityHeadersMiddleware(traceMiddleware(countingMiddleware(mux))))),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
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
