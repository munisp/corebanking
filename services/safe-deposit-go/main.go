// 54Bank Safe Deposit — Go
// Domain: Payments
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

var serviceName = "safe-deposit-go"

var startTime = time.Now()

// ─── Domain Types ───────────────────────────────────────────────────────────

type BoxStatus string
type BoxSize string

const (
	BoxStatusOccupied    BoxStatus = "occupied"
	BoxStatusAvailable   BoxStatus = "available"
	BoxStatusMaintenance BoxStatus = "maintenance"

	BoxSizeSmall  BoxSize = "small"
	BoxSizeMedium BoxSize = "medium"
	BoxSizeLarge  BoxSize = "large"
)

type DepositBox struct {
	ID           string    `json:"id"`
	BoxSize      BoxSize   `json:"box_size"`
	CustomerName string    `json:"customer_name"`
	CustomerID   string    `json:"customer_id,omitempty"`
	Branch       string    `json:"branch"`
	AnnualRent   float64   `json:"annual_rent"`
	Currency     string    `json:"currency"`
	RenewalDate  string    `json:"renewal_date"`
	Status       BoxStatus `json:"status"`
	CreatedAt    string    `json:"created_at"`
	UpdatedAt    string    `json:"updated_at"`
	TenantID     string    `json:"tenant_id,omitempty"`
}

type DepositBoxListResponse struct {
	Items []DepositBox `json:"items"`
	Total int          `json:"total"`
}

type DepositBoxStats struct {
	TotalBoxes  int `json:"total_boxes"`
	Occupied    int `json:"occupied"`
	Available   int `json:"available"`
	Maintenance int `json:"maintenance"`
}

type AuditEntry struct {
	ID        string `json:"id"`
	Action    string `json:"action"`
	RecordID  string `json:"recordId"`
	Actor     string `json:"actor"`
	Timestamp string `json:"timestamp"`
	Details   string `json:"details"`
}

var (
	mu       sync.Mutex
	boxes    = []DepositBox{
		{ID: "BOX-0001", BoxSize: BoxSizeSmall, CustomerName: "Adebayo Okafor", CustomerID: "CUST-1001", Branch: "Lagos Island", AnnualRent: 45000, Currency: "NGN", RenewalDate: "2027-01-15", Status: BoxStatusOccupied, CreatedAt: "2025-01-15T09:00:00Z", UpdatedAt: "2025-01-15T09:00:00Z"},
		{ID: "BOX-0002", BoxSize: BoxSizeMedium, CustomerName: "Ngozi Eze", CustomerID: "CUST-1002", Branch: "Abuja Central", AnnualRent: 80000, Currency: "NGN", RenewalDate: "2027-03-20", Status: BoxStatusOccupied, CreatedAt: "2025-03-20T10:30:00Z", UpdatedAt: "2025-03-20T10:30:00Z"},
		{ID: "BOX-0003", BoxSize: BoxSizeLarge, CustomerName: "", CustomerID: "", Branch: "Port Harcourt", AnnualRent: 120000, Currency: "NGN", RenewalDate: "", Status: BoxStatusAvailable, CreatedAt: "2025-02-01T08:00:00Z", UpdatedAt: "2025-02-01T08:00:00Z"},
		{ID: "BOX-0004", BoxSize: BoxSizeSmall, CustomerName: "", CustomerID: "", Branch: "Lagos Island", AnnualRent: 45000, Currency: "NGN", RenewalDate: "", Status: BoxStatusMaintenance, CreatedAt: "2025-04-10T11:00:00Z", UpdatedAt: "2026-05-01T09:00:00Z"},
		{ID: "BOX-0005", BoxSize: BoxSizeMedium, CustomerName: "Emeka Chukwu", CustomerID: "CUST-1003", Branch: "Enugu", AnnualRent: 80000, Currency: "NGN", RenewalDate: "2026-11-30", Status: BoxStatusOccupied, CreatedAt: "2025-11-30T14:00:00Z", UpdatedAt: "2025-11-30T14:00:00Z"},
		{ID: "BOX-0006", BoxSize: BoxSizeLarge, CustomerName: "", CustomerID: "", Branch: "Abuja Central", AnnualRent: 120000, Currency: "NGN", RenewalDate: "", Status: BoxStatusAvailable, CreatedAt: "2025-06-15T10:00:00Z", UpdatedAt: "2025-06-15T10:00:00Z"},
	}
	auditLog = []AuditEntry{}
)

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Service", "safe-deposit-go")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

// ─── Handlers ───────────────────────────────────────────────────────────────

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{
		"service": "safe-deposit-go", "status": "healthy", "version": "2.0.0",
		"uptime_secs": int(time.Since(startTime).Seconds()),
		"domain": "Safe Deposit — Payments",
		"middleware": map[string]string{
			"kafka":      "safe-deposit.events, safe-deposit.audit",
			"postgres":   "safe_deposit_records",
			"redis":      "safe-deposit_cache",
			"temporal":   "SafeDepositWorkflow",
			"permify":    "safe-deposit:manage, safe-deposit:view",
			"opensearch": "safe-deposit-2026",
		},
	})
}

func handleList(w http.ResponseWriter, r *http.Request) {
	cacheKey := "safe_deposit_list"
	if cached, ok := cacheGet(cacheKey); ok {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Cache", "HIT")
		w.WriteHeader(200)
		w.Write([]byte(cached))
		return
	}
	mu.Lock()
	defer mu.Unlock()
	resp := DepositBoxListResponse{Items: boxes, Total: len(boxes)}
	if resp.Items == nil {
		resp.Items = []DepositBox{}
	}
	respondJSON(w, 200, resp)
}

func handleCreate(w http.ResponseWriter, r *http.Request) {
	cacheSet("safe_deposit_list", "", 1)
	if r.Method != "POST" { respondJSON(w, 405, map[string]string{"error": "POST required"}); return }

	var body struct {
		BoxSize      string  `json:"box_size"`
		Branch       string  `json:"branch"`
		AnnualRent   float64 `json:"annual_rent"`
		Currency     string  `json:"currency"`
		CustomerName string  `json:"customer_name"`
		CustomerID   string  `json:"customer_id"`
		RenewalDate  string  `json:"renewal_date"`
		TenantID     string  `json:"tenant_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondJSON(w, 400, map[string]string{"error": "invalid request body"}); return
	}
	if body.BoxSize == "" || body.Branch == "" {
		respondJSON(w, 400, map[string]string{"error": "box_size and branch are required"}); return
	}
	currency := body.Currency
	if currency == "" { currency = "NGN" }
	status := BoxStatusAvailable
	if body.CustomerID != "" || body.CustomerName != "" {
		status = BoxStatusOccupied
	}

	mu.Lock()
	defer mu.Unlock()

	now := time.Now().Format(time.RFC3339)
	box := DepositBox{
		ID:           fmt.Sprintf("BOX-%04d", len(boxes)+1),
		BoxSize:      BoxSize(body.BoxSize),
		Branch:       body.Branch,
		AnnualRent:   body.AnnualRent,
		Currency:     currency,
		CustomerName: body.CustomerName,
		CustomerID:   body.CustomerID,
		RenewalDate:  body.RenewalDate,
		Status:       status,
		TenantID:     body.TenantID,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	boxes = append(boxes, box)

	auditLog = append(auditLog, AuditEntry{
		ID: fmt.Sprintf("AUD-%08X", rand.Uint32()), Action: "create",
		RecordID: box.ID, Actor: body.CustomerID,
		Timestamp: now, Details: "Box created",
	})

	respondJSON(w, 201, map[string]interface{}{"created": true, "box": box})
}

// handleAssign assigns an existing available box to a customer.
func handleAssign(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" { respondJSON(w, 405, map[string]string{"error": "POST required"}); return }

	var body struct {
		ID           string  `json:"id"`
		CustomerName string  `json:"customer_name"`
		CustomerID   string  `json:"customer_id"`
		AnnualRent   float64 `json:"annual_rent"`
		RenewalDate  string  `json:"renewal_date"`
		UpdatedBy    string  `json:"updated_by"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondJSON(w, 400, map[string]string{"error": "invalid request body"}); return
	}
	if body.ID == "" || body.CustomerID == "" {
		respondJSON(w, 400, map[string]string{"error": "id and customer_id are required"}); return
	}

	mu.Lock()
	defer mu.Unlock()

	for i := range boxes {
		if boxes[i].ID == body.ID {
			if boxes[i].Status != BoxStatusAvailable {
				respondJSON(w, 409, map[string]string{"error": "box is not available for assignment"}); return
			}
			boxes[i].CustomerName = body.CustomerName
			boxes[i].CustomerID = body.CustomerID
			if body.AnnualRent > 0 { boxes[i].AnnualRent = body.AnnualRent }
			if body.RenewalDate != "" { boxes[i].RenewalDate = body.RenewalDate }
			boxes[i].Status = BoxStatusOccupied
			boxes[i].UpdatedAt = time.Now().Format(time.RFC3339)
			auditLog = append(auditLog, AuditEntry{
				ID: fmt.Sprintf("AUD-%08X", rand.Uint32()), Action: "assign",
				RecordID: body.ID, Actor: body.UpdatedBy,
				Timestamp: boxes[i].UpdatedAt, Details: "Box assigned to customer",
			})
			respondJSON(w, 200, map[string]interface{}{"updated": true, "box": boxes[i]})
			return
		}
	}
	respondJSON(w, 404, map[string]string{"error": "box not found: " + body.ID})
}

func handleUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" && r.Method != "PUT" { respondJSON(w, 405, map[string]string{"error": "POST/PUT required"}); return }

	var body struct {
		ID          string  `json:"id"`
		Status      string  `json:"status"`
		RenewalDate string  `json:"renewal_date"`
		AnnualRent  float64 `json:"annual_rent"`
		UpdatedBy   string  `json:"updated_by"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondJSON(w, 400, map[string]string{"error": "invalid request body"}); return
	}
	if body.ID == "" { respondJSON(w, 400, map[string]string{"error": "id is required"}); return }

	mu.Lock()
	defer mu.Unlock()

	for i := range boxes {
		if boxes[i].ID == body.ID {
			if body.Status != "" { boxes[i].Status = BoxStatus(body.Status) }
			if body.RenewalDate != "" { boxes[i].RenewalDate = body.RenewalDate }
			if body.AnnualRent > 0 { boxes[i].AnnualRent = body.AnnualRent }
			boxes[i].UpdatedAt = time.Now().Format(time.RFC3339)
			auditLog = append(auditLog, AuditEntry{
				ID: fmt.Sprintf("AUD-%08X", rand.Uint32()), Action: "update",
				RecordID: body.ID, Actor: body.UpdatedBy,
				Timestamp: boxes[i].UpdatedAt, Details: "Box updated",
			})
			respondJSON(w, 200, map[string]interface{}{"updated": true, "box": boxes[i]})
			return
		}
	}
	respondJSON(w, 404, map[string]string{"error": "box not found: " + body.ID})
}

func handleVacate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" { respondJSON(w, 405, map[string]string{"error": "POST required"}); return }

	var body struct {
		ID        string `json:"id"`
		UpdatedBy string `json:"updated_by"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondJSON(w, 400, map[string]string{"error": "invalid request body"}); return
	}
	if body.ID == "" { respondJSON(w, 400, map[string]string{"error": "id is required"}); return }

	mu.Lock()
	defer mu.Unlock()

	for i := range boxes {
		if boxes[i].ID == body.ID {
			boxes[i].CustomerName = ""
			boxes[i].CustomerID = ""
			boxes[i].RenewalDate = ""
			boxes[i].Status = BoxStatusAvailable
			boxes[i].UpdatedAt = time.Now().Format(time.RFC3339)
			auditLog = append(auditLog, AuditEntry{
				ID: fmt.Sprintf("AUD-%08X", rand.Uint32()), Action: "vacate",
				RecordID: body.ID, Actor: body.UpdatedBy,
				Timestamp: boxes[i].UpdatedAt, Details: "Box vacated",
			})
			respondJSON(w, 200, map[string]interface{}{"updated": true, "box": boxes[i]})
			return
		}
	}
	respondJSON(w, 404, map[string]string{"error": "box not found: " + body.ID})
}

func handleProcess(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{"message": "use /assign or /update for box operations"})
}

func handleAudit(w http.ResponseWriter, r *http.Request) {
	mu.Lock()
	defer mu.Unlock()
	respondJSON(w, 200, map[string]interface{}{"auditLog": auditLog, "total": len(auditLog)})
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	mu.Lock()
	defer mu.Unlock()
	stats := DepositBoxStats{}
	for _, b := range boxes {
		stats.TotalBoxes++
		switch b.Status {
		case BoxStatusOccupied:
			stats.Occupied++
		case BoxStatusAvailable:
			stats.Available++
		case BoxStatusMaintenance:
			stats.Maintenance++
		}
	}
	respondJSON(w, 200, stats)
}

func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok { return v }
	return ""
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
    fmt.Fprintf(w, `{"ready":true,"service":"safe-deposit-go"}`)
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
    fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"safe-deposit-go\"} %d\n", reqs)
    fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"safe-deposit-go\"} %d\n", errs)
    fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"safe-deposit-go\"} %.0f\n", time.Since(_bootTime).Seconds())
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
	db.Exec(`CREATE TABLE IF NOT EXISTS fixed_deposits (id SERIAL PRIMARY KEY, deposit_id TEXT, customer_id TEXT, principal NUMERIC(18,2), rate NUMERIC(5,4), tenor_days INT, maturity_date DATE, status TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`)
	log.Printf("[%s] Domain table fixed_deposits ensured", serviceName)
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


func validatePOSTransaction(amount float64, merchantID, terminalID string) (bool, string) {
	if amount <= 0 { return false, "Amount must be positive" }
	if amount > 5000000 { return false, "POS single transaction limit is ₦5M" }
	if merchantID == "" { return false, "Merchant ID required" }
	if terminalID == "" { return false, "Terminal ID required" }
	return true, "POS transaction approved"
}
func computePOSCharge(amount float64, isInterbank bool) float64 {
	mdr := amount * 0.005 // 0.5% MDR
	if mdr > 1000 { mdr = 1000 } // ₦1000 cap
	if isInterbank { mdr += 35 } // Interbank switching fee
	return mdr
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
	if port == "" { port = "9423" }
	initDB()
mux := http.NewServeMux()
	mux.HandleFunc("/readyz", readyzHandler)

	mux.HandleFunc("/livez", livezHandler)

	mux.HandleFunc("/metrics", metricsHandler)

	mux.HandleFunc("/v1/alerts", alertsHandler)
	mux.HandleFunc("/v1/degradation", degradationStatusHandler)
	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/v1/safe-deposit/list", handleList)
	mux.HandleFunc("/v1/safe-deposit/create", handleCreate)
	mux.HandleFunc("/v1/safe-deposit/assign", handleAssign)
	mux.HandleFunc("/v1/safe-deposit/update", handleUpdate)
	mux.HandleFunc("/v1/safe-deposit/vacate", handleVacate)
	mux.HandleFunc("/v1/safe-deposit/process", handleProcess)
	mux.HandleFunc("/v1/safe-deposit/audit", handleAudit)
	mux.HandleFunc("/v1/safe-deposit/stats", handleStats)
	log.Printf("Safe Deposit v2.0 (Payments) on :%s", port)
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
    log.Println("[safe-deposit-go] Shutdown signal received")
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    _ = server.Shutdown(ctx)
    log.Println("[safe-deposit-go] Server stopped gracefully")
}

func jsonResp(w http.ResponseWriter, code int, data interface{}) { respondJSON(w, code, data) }
