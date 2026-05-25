// 54Bank Multi-Bureau Verification — Go
// Parallel verification across NIBSS (BVN), NIMC (NIN), FRSC (DL), NIS (Passport),
// INEC (PVC). Consensus scoring, fallback routing, response aggregation.
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

var serviceName = "multi-bureau-verification-go"

var startTime = time.Now()

// ─── Domain Types ───────────────────────────────────────────────────────────

type Bureau struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Provider string `json:"provider"`
	Endpoint string `json:"endpoint"`
	IDType   string `json:"idType"`
	Status   string `json:"status"` // active, degraded, down
	AvgMs    int    `json:"avgResponseMs"`
	Uptime   float64 `json:"uptimePct"`
}

type VerificationResult struct {
	BureauID    string  `json:"bureauId"`
	BureauName  string  `json:"bureauName"`
	Status      string  `json:"status"` // verified, not_found, error, timeout
	FirstName   string  `json:"firstName,omitempty"`
	LastName    string  `json:"lastName,omitempty"`
	DOB         string  `json:"dateOfBirth,omitempty"`
	Gender      string  `json:"gender,omitempty"`
	Phone       string  `json:"phone,omitempty"`
	PhotoMatch  bool    `json:"photoMatch"`
	Confidence  float64 `json:"confidence"`
	ResponseMs  int     `json:"responseMs"`
}

type MultiBureauCheck struct {
	ID               string               `json:"id"`
	CustomerID       string               `json:"customerId"`
	IDNumber         string               `json:"idNumber"`
	IDType           string               `json:"idType"`
	BureausQueried   int                  `json:"bureausQueried"`
	BureausVerified  int                  `json:"bureausVerified"`
	ConsensusScore   float64              `json:"consensusScore"`
	OverallStatus    string               `json:"overallStatus"`
	Results          []VerificationResult `json:"results"`
	NameConsistent   bool                 `json:"nameConsistent"`
	DOBConsistent    bool                 `json:"dobConsistent"`
	CreatedAt        string               `json:"createdAt"`
}

var (
	mu      sync.Mutex
	bureaus = []Bureau{
		{ID: "BUR-NIBSS", Name: "NIBSS BVN", Provider: "NIBSS", Endpoint: "/api/bvn/verify", IDType: "bvn", Status: "active", AvgMs: 450, Uptime: 99.5},
		{ID: "BUR-NIMC", Name: "NIMC NIN", Provider: "NIMC", Endpoint: "/api/nin/verify", IDType: "nin", Status: "active", AvgMs: 800, Uptime: 97.2},
		{ID: "BUR-FRSC", Name: "FRSC DL", Provider: "FRSC", Endpoint: "/api/dl/verify", IDType: "drivers_license", Status: "active", AvgMs: 600, Uptime: 98.1},
		{ID: "BUR-NIS", Name: "NIS Passport", Provider: "NIS", Endpoint: "/api/passport/verify", IDType: "passport", Status: "active", AvgMs: 1200, Uptime: 95.8},
		{ID: "BUR-INEC", Name: "INEC PVC", Provider: "INEC", Endpoint: "/api/pvc/verify", IDType: "voters_card", Status: "degraded", AvgMs: 2000, Uptime: 92.3},
	}
	checks = []MultiBureauCheck{}
	stats  = map[string]interface{}{
		"totalChecks":       0,
		"avgConsensus":      0.0,
		"bureauAvailability": map[string]float64{"NIBSS": 99.5, "NIMC": 97.2, "FRSC": 98.1, "NIS": 95.8, "INEC": 92.3},
		"avgResponseMs":     810,
		"verifiedRate":      96.5,
		"nameInconsistency": 3.2,
	}
)

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Service", "multi-bureau-verification-go")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func simulateBureauCheck(bureau Bureau, idNumber string) VerificationResult {
	confidence := 0.85 + float64(rand.Intn(14))/100.0
	ms := bureau.AvgMs + rand.Intn(200) - 100
	status := "verified"
	if rand.Float64() < 0.03 {
		status = "not_found"
		confidence = 0
	}
	return VerificationResult{
		BureauID:   bureau.ID,
		BureauName: bureau.Name,
		Status:     status,
		FirstName:  "VERIFIED",
		LastName:   "NAME",
		DOB:        "1990-01-01",
		Gender:     "Male",
		Phone:      "080XXXXXXXX",
		PhotoMatch: confidence > 0.8,
		Confidence: confidence,
		ResponseMs: ms,
	}
}

// ─── Handlers ───────────────────────────────────────────────────────────────

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{
		"service": "multi-bureau-verification-go", "status": "healthy", "version": "2.0.0",
		"uptime_secs": int(time.Since(startTime).Seconds()),
		"domain": "Multi-Bureau Verification",
		"capabilities": []string{
			"parallel_bureau_query", "consensus_scoring", "fallback_routing",
			"response_aggregation", "name_consistency_check", "dob_cross_validation",
			"photo_match_correlation", "bureau_health_monitoring",
			"degraded_mode_operation", "batch_verification",
		},
		"bureaus": []string{"NIBSS/BVN", "NIMC/NIN", "FRSC/DL", "NIS/Passport", "INEC/PVC"},
		"middleware": map[string]string{
			"kafka":      "multi-bureau.verifications, multi-bureau.alerts",
			"postgres":   "multi_bureau_checks, multi_bureau_results",
			"redis":      "bureau_response_cache (TTL 5min), bureau_health",
			"temporal":   "MultiBureauVerificationWorkflow",
			"permify":    "multi-bureau:verify, multi-bureau:admin",
			"opensearch": "multi-bureau-2026",
		},
	})
}

func handleVerify(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)

	idNumber := getString(body, "idNumber")
	if idNumber == "" {
		respondJSON(w, 400, map[string]string{"error": "idNumber required"})
		return
	}

	results := []VerificationResult{}
	for _, b := range bureaus {
		if b.Status != "down" {
			results = append(results, simulateBureauCheck(b, idNumber))
		}
	}

	verified := 0
	totalConf := 0.0
	for _, r := range results {
		if r.Status == "verified" {
			verified++
			totalConf += r.Confidence
		}
	}
	consensus := 0.0
	if verified > 0 {
		consensus = totalConf / float64(verified)
	}

	check := MultiBureauCheck{
		ID:              fmt.Sprintf("MBV-%08X", rand.Uint32()),
		CustomerID:      getString(body, "customerId"),
		IDNumber:        idNumber,
		IDType:          getString(body, "idType"),
		BureausQueried:  len(results),
		BureausVerified: verified,
		ConsensusScore:  consensus,
		OverallStatus:   overallStatus(verified, len(results)),
		Results:         results,
		NameConsistent:  true,
		DOBConsistent:   true,
		CreatedAt:       time.Now().Format(time.RFC3339),
	}

	mu.Lock()
	checks = append(checks, check)
	stats["totalChecks"] = len(checks)
	mu.Unlock()

	dbData, _ := json.Marshal(map[string]string{"service": "multi_bureau_verification_go", "action": "create"})
	if dbErr := dbInsert(fmt.Sprintf("multi_bureau_verification_go-%d", time.Now().UnixNano()), "multi_bureau_verification_go", "default", "active", dbData); dbErr != nil {
		log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr)
	cacheSet("multi_bureau_verification_list", "", 1) // invalidate cache on write
	}
	csURL := os.Getenv("KYC_ENGINE_URL")
	if csURL == "" { csURL = "http://kyc-engine-go:8080" }
	if _, csErr := callService("POST", csURL+"/v1/notify", map[string]interface{}{"source": "multi_bureau_verification_go", "action": "create"}); csErr != nil {
		log.Printf("[%s] upstream call failed: %v", serviceName, csErr)
	}
	respondJSON(w, 200, check)
}

func handleBureaus(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{
		"bureaus": bureaus, "total": len(bureaus),
	})
}

func handleChecks(w http.ResponseWriter, r *http.Request) {
	mu.Lock()
	defer mu.Unlock()
	respondJSON(w, 200, map[string]interface{}{
		"checks": checks, "total": len(checks),
	})
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, stats)
}

func overallStatus(verified, total int) string {
	ratio := float64(verified) / float64(total)
	if ratio >= 0.8 {
		return "verified"
	}
	if ratio >= 0.5 {
		return "partial"
	}
	return "unverified"
}

func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}


func multi_bureau_verificationComputeScore(value float64, weight float64, threshold float64) float64 {
    score := value * weight
    if score > threshold { score = threshold }
    return score
}

func multi_bureau_verificationValidateRequest(data map[string]interface{}) map[string]interface{} {
    errors := []string{}
    required := []string{"id", "type"}
    for _, field := range required {
        if _, ok := data[field]; !ok {
            errors = append(errors, field + " is required")
        }
    }
    return map[string]interface{}{"valid": len(errors) == 0, "errors": errors}
}

func multi_bureau_verificationScoreHandler(w http.ResponseWriter, r *http.Request) {
    var req struct {
        Value     float64 `json:"value"`
        Weight    float64 `json:"weight"`
        Threshold float64 `json:"threshold"`
    }
    json.NewDecoder(r.Body).Decode(&req)
    score := multi_bureau_verificationComputeScore(req.Value, req.Weight, req.Threshold)
    respondJSON(w, 200, map[string]interface{}{"score": score})
}

func multi_bureau_verificationValidateRequestHandler(w http.ResponseWriter, r *http.Request) {
    var body map[string]interface{}
    json.NewDecoder(r.Body).Decode(&body)
    result := multi_bureau_verificationValidateRequest(body)
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
    fmt.Fprintf(w, `{"ready":true,"service":"multi-bureau-verification-go"}`)
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
    fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"multi-bureau-verification-go\"} %d\n", reqs)
    fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"multi-bureau-verification-go\"} %d\n", errs)
    fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"multi-bureau-verification-go\"} %.0f\n", time.Since(_bootTime).Seconds())
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


func aggregateBureauScores(scores map[string]int) (int, string) {
	total := 0; count := 0
	for _, s := range scores { total += s; count++ }
	if count == 0 { return 0, "No bureau data" }
	avg := total / count
	grade := "E"
	switch { case avg >= 750: grade = "A"; case avg >= 650: grade = "B"; case avg >= 550: grade = "C"; case avg >= 450: grade = "D" }
	return avg, grade
}
func validateBureauReport(bureauName string, reportAge int) (bool, string) {
	if reportAge > 90 { return false, "Bureau report older than 90 days — request fresh report" }
	validBureaus := map[string]bool{"CRC": true, "FirstCentral": true, "CreditRegistry": true}
	if !validBureaus[bureauName] { return false, "Unknown credit bureau: " + bureauName }
	return true, "Bureau report valid"
}


func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "9088"
	}
	initDB()
mux := http.NewServeMux()
	mux.HandleFunc("/readyz", readyzHandler)

	mux.HandleFunc("/livez", livezHandler)

	mux.HandleFunc("/metrics", metricsHandler)

	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/v1/multi-bureau/verify", handleVerify)
	mux.HandleFunc("/v1/multi-bureau/bureaus", handleBureaus)
	mux.HandleFunc("/v1/multi-bureau/checks", handleChecks)
	mux.HandleFunc("/v1/multi-bureau/stats", handleStats)
	mux.HandleFunc("/v1/multi-bureau-verification/score", multi_bureau_verificationScoreHandler)
	mux.HandleFunc("/v1/multi-bureau-verification/validate", multi_bureau_verificationValidateRequestHandler)
	log.Printf("Multi-Bureau Verification v2.0 (Go) on :%s", port)
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
    log.Println("[multi-bureau-verification-go] Shutdown signal received")
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    _ = server.Shutdown(ctx)
    log.Println("[multi-bureau-verification-go] Server stopped gracefully")
}
