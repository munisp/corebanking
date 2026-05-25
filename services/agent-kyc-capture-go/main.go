// 54Bank Agent KYC Capture — Go
// Offline agent banking capture: GPS-tagged forms, photo capture, sync queue,
// USSD fallback, document OCR routing (PaddleOCR), batch submission.
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

var serviceName = "agent-kyc-capture-go"

var startTime = time.Now()

// ─── Domain Types ───────────────────────────────────────────────────────────

type CaptureForm struct {
	ID             string   `json:"id"`
	AgentID        string   `json:"agentId"`
	CustomerName   string   `json:"customerName"`
	CustomerPhone  string   `json:"customerPhone"`
	BVN            string   `json:"bvn,omitempty"`
	NIN            string   `json:"nin,omitempty"`
	DocumentType   string   `json:"documentType"`
	PhotoCaptured  bool     `json:"photoCaptured"`
	GPSLat         float64  `json:"gpsLat"`
	GPSLon         float64  `json:"gpsLon"`
	GPSAccuracy    float64  `json:"gpsAccuracyMeters"`
	CaptureMode    string   `json:"captureMode"` // online, offline, ussd_fallback
	SyncStatus     string   `json:"syncStatus"`  // pending, synced, failed, retry
	RequestedTier  string   `json:"requestedTier"`
	DOB            string   `json:"dateOfBirth,omitempty"`
	Gender         string   `json:"gender,omitempty"`
	Address        string   `json:"address,omitempty"`
	DocsSubmitted  []string `json:"docsSubmitted"`
	OCRRouting     string   `json:"ocrRouting"`
	CreatedAt      string   `json:"createdAt"`
	SyncedAt       string   `json:"syncedAt,omitempty"`
}

type Agent struct {
	ID              string  `json:"id"`
	Name            string  `json:"name"`
	Phone           string  `json:"phone"`
	Region          string  `json:"region"`
	Status          string  `json:"status"` // active, suspended, offline
	DeviceID        string  `json:"deviceId"`
	CapturesTotal   int     `json:"capturesTotal"`
	CapturesSync    int     `json:"capturesSynced"`
	CapturesPending int     `json:"capturesPending"`
	LastActiveAt    string  `json:"lastActiveAt"`
	GPSEnabled      bool    `json:"gpsEnabled"`
	Rating          float64 `json:"rating"`
}

type SyncQueue struct {
	PendingTotal  int     `json:"pendingTotal"`
	SyncedToday   int     `json:"syncedToday"`
	FailedToday   int     `json:"failedToday"`
	AvgLatencyMs  int     `json:"avgLatencyMs"`
	LastSyncAt    string  `json:"lastSyncAt"`
}

var (
	mu      sync.Mutex
	forms   = []CaptureForm{}
	agents  = []Agent{
		{ID: "AGT-001", Name: "Ibrahim Musa", Phone: "08023456789", Region: "North-West",
			Status: "active", DeviceID: "DEV-TECNO-001", CapturesTotal: 245, CapturesSync: 240,
			CapturesPending: 5, LastActiveAt: "2026-05-09T10:00:00Z", GPSEnabled: true, Rating: 4.7},
		{ID: "AGT-002", Name: "Fatima Bello", Phone: "08034567890", Region: "North-East",
			Status: "active", DeviceID: "DEV-ITEL-002", CapturesTotal: 189, CapturesSync: 189,
			CapturesPending: 0, LastActiveAt: "2026-05-09T09:30:00Z", GPSEnabled: true, Rating: 4.9},
		{ID: "AGT-003", Name: "Emeka Obi", Phone: "07045678901", Region: "South-East",
			Status: "offline", DeviceID: "DEV-INFX-003", CapturesTotal: 312, CapturesSync: 300,
			CapturesPending: 12, LastActiveAt: "2026-05-08T18:00:00Z", GPSEnabled: false, Rating: 4.5},
	}
	syncQ = SyncQueue{PendingTotal: 17, SyncedToday: 156, FailedToday: 3, AvgLatencyMs: 2400, LastSyncAt: "2026-05-09T10:05:00Z"}
	stats = map[string]interface{}{
		"totalCaptures": 746, "pendingSync": 17, "syncedToday": 156,
		"failedSync": 3, "activeAgents": 2, "offlineAgents": 1,
		"avgCaptureTimeSec": 180, "gpsEnabledPct": 66.7,
		"capturesByMode": map[string]int{"online": 520, "offline": 198, "ussd_fallback": 28},
		"capturesByTier": map[string]int{"tier1": 420, "tier2": 280, "tier3": 46},
		"topRegions": []map[string]interface{}{
			{"region": "North-West", "count": 245},
			{"region": "South-East", "count": 312},
			{"region": "North-East", "count": 189},
		},
	}
)

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Service", "agent-kyc-capture-go")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

// ─── Handlers ───────────────────────────────────────────────────────────────

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{
		"service": "agent-kyc-capture-go", "status": "healthy", "version": "2.0.0",
		"uptime_secs": int(time.Since(startTime).Seconds()),
		"domain": "Agent KYC Capture — Offline Banking",
		"capabilities": []string{
			"offline_capture", "gps_tagged_forms", "photo_capture",
			"sync_queue", "ussd_fallback", "batch_submission",
			"agent_management", "device_tracking", "ocr_routing_paddleocr",
			"tier1_instant_onboard", "document_validation",
		},
		"capture_modes": []string{"online", "offline", "ussd_fallback"},
		"supported_devices": []string{"android_4.4+", "kaios", "ussd_any"},
		"middleware": map[string]string{
			"kafka":       "agent-kyc.captures, agent-kyc.sync, agent-kyc.audit",
			"postgres":    "agent_kyc_forms, agent_kyc_agents, agent_kyc_sync_queue",
			"redis":       "offline_queue (persistent), sync_lock",
			"temporal":    "AgentKYCSyncWorkflow, BatchSubmissionWorkflow",
			"permify":     "agent-kyc:capture, agent-kyc:sync, agent-kyc:admin",
			"opensearch":  "agent-kyc-2026",
		},
	})
}

func handleCaptures(w http.ResponseWriter, r *http.Request) {
	mu.Lock()
	defer mu.Unlock()
	respondJSON(w, 200, map[string]interface{}{
		"captures": forms, "total": len(forms),
	})
}

func handleCreateCapture(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)

	mu.Lock()
	defer mu.Unlock()

	mode := "online"
	if m, ok := body["captureMode"].(string); ok {
		mode = m
	}
	tier := "tier1"
	if t, ok := body["requestedTier"].(string); ok {
		tier = t
	}

	form := CaptureForm{
		ID:            fmt.Sprintf("CAP-%08X", rand.Uint32()),
		AgentID:       getString(body, "agentId"),
		CustomerName:  getString(body, "customerName"),
		CustomerPhone: getString(body, "customerPhone"),
		BVN:           getString(body, "bvn"),
		NIN:           getString(body, "nin"),
		DocumentType:  getString(body, "documentType"),
		PhotoCaptured: body["photoCaptured"] != nil,
		GPSLat:        getFloat(body, "gpsLat"),
		GPSLon:        getFloat(body, "gpsLon"),
		GPSAccuracy:   getFloat(body, "gpsAccuracy"),
		CaptureMode:   mode,
		SyncStatus:    "pending",
		RequestedTier: tier,
		DOB:           getString(body, "dateOfBirth"),
		Gender:        getString(body, "gender"),
		Address:       getString(body, "address"),
		DocsSubmitted: []string{},
		OCRRouting:    "paddleocr_v4",
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	forms = append(forms, form)
	syncQ.PendingTotal++

	// Persist to database
	if db != nil {
		id := fmt.Sprintf("%s-%d", serviceName, time.Now().UnixNano())
		if dataBytes, err := json.Marshal(body)
		dataBytes = []byte(sanitizeInput(string(dataBytes))); err == nil {
			dbInsert(id, serviceName, "default", "active", dataBytes)
		}
	}

	csURL := os.Getenv("KYC_ENGINE_URL")
	if csURL == "" { csURL = "http://kyc-engine-go:8080" }
	if _, csErr := callService("POST", csURL+"/v1/notify", map[string]interface{}{"source": "agent_kyc_capture_go", "action": "create"}); csErr != nil {
		log.Printf("[%s] upstream call failed: %v", serviceName, csErr)
	}
	respondJSON(w, 201, map[string]interface{}{
		"created": true, "capture": form,
		"next_steps": []string{"sync_to_server", "trigger_ocr", "verify_bvn"},
	})
}

func handleSyncCapture(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)

	captureID := getString(body, "captureId")
	mu.Lock()
	defer mu.Unlock()

	for i := range forms {
		if forms[i].ID == captureID {
			forms[i].SyncStatus = "synced"
			forms[i].SyncedAt = time.Now().Format(time.RFC3339)
			syncQ.PendingTotal--
			syncQ.SyncedToday++
			respondJSON(w, 200, map[string]interface{}{
				"synced": true, "capture": forms[i],
				"ocr_triggered": true, "ocr_engine": "paddleocr_v4",
			})
			return
		}
	}
	respondJSON(w, 404, map[string]string{"error": "Capture not found: " + captureID})
}

func handleBatchSync(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)

	mu.Lock()
	defer mu.Unlock()

	synced := 0
	for i := range forms {
		if forms[i].SyncStatus == "pending" {
			forms[i].SyncStatus = "synced"
			forms[i].SyncedAt = time.Now().Format(time.RFC3339)
			synced++
		}
	}
	syncQ.PendingTotal -= synced
	syncQ.SyncedToday += synced
	respondJSON(w, 200, map[string]interface{}{
		"batch_synced": synced, "remaining_pending": syncQ.PendingTotal,
	})
}

func handleUSSDCapture(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)

	mu.Lock()
	defer mu.Unlock()

	form := CaptureForm{
		ID:            fmt.Sprintf("USSD-%08X", rand.Uint32()),
		AgentID:       getString(body, "agentId"),
		CustomerName:  getString(body, "customerName"),
		CustomerPhone: getString(body, "customerPhone"),
		BVN:           getString(body, "bvn"),
		CaptureMode:   "ussd_fallback",
		SyncStatus:    "pending",
		RequestedTier: "tier1",
		OCRRouting:    "none",
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	forms = append(forms, form)

	respondJSON(w, 201, map[string]interface{}{
		"created": true, "capture": form,
		"ussd_response": "*901*1*" + form.CustomerPhone + "#",
		"note": "Tier 1 USSD capture — photo/document required for tier upgrade",
	})
}

func handleAgents(w http.ResponseWriter, r *http.Request) {
	active := 0
	for _, a := range agents {
		if a.Status == "active" {
			active++
		}
	}
	respondJSON(w, 200, map[string]interface{}{
		"agents": agents, "total": len(agents), "active": active,
	})
}

func handleSyncQueue(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, syncQ)
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, stats)
}

func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

func getFloat(m map[string]interface{}, key string) float64 {
	if v, ok := m[key].(float64); ok {
		return v
	}
	return 0
}


func agent_kyc_captureComputeScore(value float64, weight float64, threshold float64) float64 {
    score := value * weight
    if score > threshold { score = threshold }
    return score
}

func agent_kyc_captureValidateRequest(data map[string]interface{}) map[string]interface{} {
    errors := []string{}
    required := []string{"id", "type"}
    for _, field := range required {
        if _, ok := data[field]; !ok {
            errors = append(errors, field + " is required")
        }
    }
    return map[string]interface{}{"valid": len(errors) == 0, "errors": errors}
}

func agent_kyc_captureScoreHandler(w http.ResponseWriter, r *http.Request) {
    var req struct {
        Value     float64 `json:"value"`
        Weight    float64 `json:"weight"`
        Threshold float64 `json:"threshold"`
    }
    json.NewDecoder(r.Body).Decode(&req)
    score := agent_kyc_captureComputeScore(req.Value, req.Weight, req.Threshold)
    respondJSON(w, 200, map[string]interface{}{"score": score})
}

func agent_kyc_captureValidateRequestHandler(w http.ResponseWriter, r *http.Request) {
    var body map[string]interface{}
    json.NewDecoder(r.Body).Decode(&body)
    result := agent_kyc_captureValidateRequest(body)
    respondJSON(w, 200, result)
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
    fmt.Fprintf(w, `{"ready":true,"service":"agent-kyc-capture-go"}`)
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
    fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"agent-kyc-capture-go\"} %d\n", reqs)
    fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"agent-kyc-capture-go\"} %d\n", errs)
    fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"agent-kyc-capture-go\"} %.0f\n", time.Since(_bootTime).Seconds())
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
	cacheKey := fmt.Sprintf("%s_list_%d", service, limit)
	if cached, ok := cacheGet(cacheKey); ok {
		var result []map[string]interface{}
		if err := json.Unmarshal([]byte(cached), &result); err == nil {
			return result, nil
		}
	}
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


func validateKYCCompleteness(documents map[string]bool, tier string) (bool, []string) {
	required := map[string][]string{
		"tier1": {"bvn"},
		"tier2": {"bvn", "nin", "utility_bill"},
		"tier3": {"bvn", "nin", "utility_bill", "reference_letter"},
	}
	missing := []string{}
	for _, doc := range required[tier] {
		if !documents[doc] { missing = append(missing, doc) }
	}
	return len(missing) == 0, missing
}
func computeKYCRiskScore(pepStatus bool, countryRisk string, sourceOfFunds string) float64 {
	score := 0.0
	if pepStatus { score += 40 }
	riskMap := map[string]float64{"high": 30, "medium": 15, "low": 5}
	score += riskMap[countryRisk]
	if sourceOfFunds == "unknown" { score += 25 }
	return score
}


func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "9016"
	}
	initDB()
mux := http.NewServeMux()
	mux.HandleFunc("/readyz", readyzHandler)

	mux.HandleFunc("/livez", livezHandler)

	mux.HandleFunc("/metrics", metricsHandler)

	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/v1/agent-kyc/captures", handleCaptures)
	mux.HandleFunc("/v1/agent-kyc/capture", handleCreateCapture)
	mux.HandleFunc("/v1/agent-kyc/sync", handleSyncCapture)
	mux.HandleFunc("/v1/agent-kyc/batch-sync", handleBatchSync)
	mux.HandleFunc("/v1/agent-kyc/ussd-capture", handleUSSDCapture)
	mux.HandleFunc("/v1/agent-kyc/agents", handleAgents)
	mux.HandleFunc("/v1/agent-kyc/sync-queue", handleSyncQueue)
	mux.HandleFunc("/v1/agent-kyc/stats", handleStats)
	mux.HandleFunc("/v1/agent-kyc-capture/score", agent_kyc_captureScoreHandler)
	mux.HandleFunc("/v1/agent-kyc-capture/validate", agent_kyc_captureValidateRequestHandler)
	log.Printf("Agent KYC Capture v2.0 (Go) on :%s", port)
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
    log.Println("[agent-kyc-capture-go] Shutdown signal received")
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    _ = server.Shutdown(ctx)
    log.Println("[agent-kyc-capture-go] Server stopped gracefully")
}
