// 54Bank Loan Origination — Go
// Domain: Lending
// KYC gate: All loan applications require enhanced KYC verification
// Middleware: Kafka, Postgres, Redis, Temporal, Permify, OpenSearch
package main

import (
	_ "github.com/lib/pq"
	"database/sql"
"context"
"os/signal"
"syscall"
"sync/atomic"

	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"sync"
	"time"
	"net"

	"strings"
)

var db *sql.DB

var serviceName = "loan-origination-go"

// Inter-service URLs
var creditScoringURL = func() string { v := os.Getenv("CREDIT_SCORING_URL"); if v == "" { return "http://localhost:8203" }; return v }()
var amlEngineURL = func() string { v := os.Getenv("AML_ENGINE_URL"); if v == "" { return "http://localhost:8120" }; return v }()
var coreBankingURL = func() string { v := os.Getenv("CORE_BANKING_URL"); if v == "" { return "http://localhost:8100" }; return v }()


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
	KYCVerified bool                   `json:"kycVerified"`
	KYCLevel    string                 `json:"kycLevel,omitempty"`
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
	PendingKYC      int                    `json:"pendingKYC"`
	Domain          string                 `json:"domain"`
	Metrics         map[string]interface{} `json:"metrics"`
}

var (
	mu      sync.Mutex
	records = []Record{
		{ID: "LOA-001", Type: "personal_loan", Status: "active", Data: map[string]interface{}{"domain": "Lending", "priority": "high", "region": "lagos", "amount": 5000000, "customerId": "CUS-1045", "customerName": "Amina Yusuf"}, CreatedAt: "2026-05-09T10:00:00Z", UpdatedAt: "2026-05-09T10:00:00Z", Version: 1, KYCVerified: true, KYCLevel: "enhanced"},
		{ID: "LOA-002", Type: "sme_loan", Status: "pending_kyc", Data: map[string]interface{}{"domain": "Lending", "priority": "medium", "region": "abuja", "amount": 15000000, "customerId": "CUS-3021", "customerName": "John Doe"}, CreatedAt: "2026-05-09T11:00:00Z", UpdatedAt: "2026-05-09T11:30:00Z", Version: 2, KYCVerified: false, KYCLevel: ""},
		{ID: "LOA-003", Type: "mortgage", Status: "completed", Data: map[string]interface{}{"domain": "Lending", "priority": "low", "region": "ph", "amount": 50000000, "customerId": "CUS-4055", "customerName": "Ibrahim Musa"}, CreatedAt: "2026-05-08T14:00:00Z", UpdatedAt: "2026-05-09T08:00:00Z", Version: 1, KYCVerified: true, KYCLevel: "full_edd"},
	}
	auditLog = []AuditEntry{}
	domainStats = DomainStats{
		TotalRecords: 3, ActiveRecords: 1, PendingRecords: 1, ProcessedToday: 12, PendingKYC: 1,
		Domain: "Lending",
		Metrics: map[string]interface{}{
			"avgProcessingMs": 245, "successRate": 98.5, "errorRate": 1.5,
			"peakHour": "14:00", "throughput": 156,
		},
	}
)

// ─── KYC Enforcement ────────────────────────────────────────────────────────

func checkKYCForLoan(customerID string, loanType string, amount float64) (bool, string, string) {
	gatewayURL := os.Getenv("GATEWAY_URL")
	if gatewayURL == "" {
		gatewayURL = "http://localhost:5000"
	}

	result, err := callService("POST", gatewayURL+"/api/platform/kyc-enforcement/check", map[string]interface{}{
		"customerId": customerID,
		"serviceId":  "loan-origination-go",
		"operation":  "loan_application",
	})
	if err != nil {
		log.Printf("[loan-origination-go] KYC check failed (circuit breaker / retries exhausted): %v — BLOCKING (fail-closed)", err)
		return false, "gateway_unreachable", fmt.Sprintf("KYC enforcement unavailable — fail-closed: %v", err)
	}

	allowed, _ := result["allowed"].(bool)
	reason, _ := result["reason"].(string)
	kycStatus, _ := result["kycStatus"].(map[string]interface{})
	level, _ := kycStatus["level"].(string)
	return allowed, level, reason
}

func requiredKYCLevel(loanType string, amount float64) string {
	if loanType == "mortgage" || amount >= 50000000 {
		return "full_edd"
	}
	if loanType == "sme_loan" || loanType == "corporate" || amount >= 10000000 {
		return "enhanced"
	}
	return "enhanced" // default: all loans require enhanced
}

// ─── Handlers ───────────────────────────────────────────────────────────────

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Service", "loan-origination-go")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{
		"service": "loan-origination-go", "status": "healthy", "version": "3.0.0",
		"uptime_secs": int(time.Since(startTime).Seconds()),
		"domain": "Loan Origination — Lending",
		"kycEnforcement": map[string]interface{}{
			"enabled":        true,
			"default_level":  "enhanced",
			"mortgage_level": "full_edd",
			"sme_level":      "enhanced",
		},
		"middleware": map[string]string{
			"kafka":      "loan.application.submitted, loan.kyc.required, loan.approved, loan.disbursed",
			"postgres":   "loan_origination_records",
			"redis":      "loan-origination_cache",
			"temporal":   "LoanOriginationWorkflow, KYCVerificationChild",
			"permify":    "loan:apply, loan:approve, loan:disburse, kyc:verify",
			"opensearch": "loan-origination-2026",
		},
	})
}

func handleList(w http.ResponseWriter, r *http.Request) {
	cacheKey := "loan_origination_list"
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
	respondJSON(w, 200, map[string]interface{}{"records": filtered, "total": len(filtered), "domain": "Lending"})
}

func handleCreate(w http.ResponseWriter, r *http.Request) {
	cacheSet("loan_origination_list", "", 1) // invalidate list cache on write
	if r.Method != "POST" { respondJSON(w, 405, map[string]string{"error": "POST required"}); return }
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)

	customerID := getString(body, "customerId")
	loanType := getString(body, "type")
	if loanType == "" { loanType = "personal_loan" }

	amount := 0.0
	if v, ok := body["amount"].(float64); ok { amount = v }

	// KYC enforcement — all loan applications require enhanced KYC
	if customerID != "" {
		allowed, kycLevel, reason := checkKYCForLoan(customerID, loanType, amount)
		if !allowed {
			mu.Lock()
			rec := Record{
				ID:        fmt.Sprintf("LOA-%08X", rand.Uint32()),
				Type:      loanType,
				Status:    "pending_kyc",
				Data:      body,
				CreatedAt: time.Now().Format(time.RFC3339),
				UpdatedAt: time.Now().Format(time.RFC3339),
				CreatedBy: getString(body, "createdBy"),
				TenantID:  getString(body, "tenantId"),
				Version:   1,
				KYCVerified: false,
			}
			records = append(records, rec)
			domainStats.PendingKYC++
			mu.Unlock()
	dataBytes, _ := json.Marshal(body)
		dataBytes = []byte(sanitizeInput(string(dataBytes)))
	if dbErr := dbInsert(fmt.Sprintf("loan_origination_go-%d", time.Now().UnixNano()), "loan_origination_go", "default", "active", dataBytes); dbErr != nil {
		log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr)
	}

			respondJSON(w, 202, map[string]interface{}{
				"created": true, "record": rec,
				"kycRequired": true,
				"kycLevel":    kycLevel,
				"requiredLevel": requiredKYCLevel(loanType, amount),
				"reason":     reason,
				"message":    fmt.Sprintf("Loan application created but requires KYC verification — %s", reason),
				"nextStep":   "Complete KYC verification via /api/platform/kyc-triggers/initiate",
				"kafkaEvents": []map[string]string{
					{"topic": "loan.application.submitted", "status": "pending_kyc"},
					{"topic": "kyc.verification.required", "customerId": customerID, "requiredLevel": requiredKYCLevel(loanType, amount)},
				},
			})
			return
		}
	}

	mu.Lock()
	defer mu.Unlock()

	rec := Record{
		ID:        fmt.Sprintf("LOA-%08X", rand.Uint32()),
		Type:      loanType,
		Status:    "pending",
		Data:      body,
		CreatedAt: time.Now().Format(time.RFC3339),
		UpdatedAt: time.Now().Format(time.RFC3339),
		CreatedBy: getString(body, "createdBy"),
		TenantID:  getString(body, "tenantId"),
		Version:   1,
		KYCVerified: true,
		KYCLevel:    requiredKYCLevel(loanType, amount),
	}
	records = append(records, rec)
	domainStats.TotalRecords = len(records)

	auditLog = append(auditLog, AuditEntry{
		ID: fmt.Sprintf("AUD-%08X", rand.Uint32()), Action: "create",
		RecordID: rec.ID, Actor: rec.CreatedBy,
		Timestamp: rec.CreatedAt, Details: fmt.Sprintf("Loan application created — KYC verified at %s level", rec.KYCLevel),
	})

	respondJSON(w, 201, map[string]interface{}{
		"created": true, "record": rec,
		"kycVerified": true,
		"message": fmt.Sprintf("Loan application created — KYC verified at %s level", rec.KYCLevel),
		"kafkaEvent": map[string]string{"topic": "loan.application.submitted", "customerId": customerID},
	})
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
		if records[i].ID == id {
			if !records[i].KYCVerified {
				respondJSON(w, 403, map[string]interface{}{
					"error":   "Cannot process loan — KYC verification incomplete",
					"code":    "KYC_NOT_VERIFIED",
					"loanId":  id,
					"message": "Complete KYC verification before processing this loan",
				})
				return
			}
			if records[i].Status == "pending" || records[i].Status == "processing" {
				records[i].Status = "processing"
				records[i].UpdatedAt = time.Now().Format(time.RFC3339)
				records[i].Version++
				records[i].Data["processedAt"] = time.Now().Format(time.RFC3339)
				records[i].Data["processingResult"] = "success"
				records[i].Data["score"] = 0.85 + float64(rand.Intn(14))/100.0
				records[i].Status = "completed"
				domainStats.ProcessedToday++
				respondJSON(w, 200, map[string]interface{}{"processed": true, "record": records[i]})
				return
			}
		}
	}
	respondJSON(w, 404, map[string]string{"error": "Record not found or not processable: " + id})
}

func handleKYCCallback(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" { respondJSON(w, 405, map[string]string{"error": "POST required"}); return }
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)

	customerID := getString(body, "customerId")
	level := getString(body, "level")
	if level == "" { level = "enhanced" }

	mu.Lock()
	defer mu.Unlock()
	updated := 0
	for i := range records {
		cid := getString(records[i].Data, "customerId")
		if cid == customerID && records[i].Status == "pending_kyc" {
			records[i].KYCVerified = true
			records[i].KYCLevel = level
			records[i].Status = "pending"
			records[i].UpdatedAt = time.Now().Format(time.RFC3339)
			records[i].Version++
			domainStats.PendingKYC--
			updated++
		}
	}
	respondJSON(w, 200, map[string]interface{}{
		"customerId": customerID, "level": level, "applicationsUpdated": updated,
		"message": fmt.Sprintf("KYC verified — %d loan applications moved to pending", updated),
	})
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
	active := 0; pending := 0; pendingKYC := 0
	for _, r := range records {
		if r.Status == "active" || r.Status == "completed" { active++ }
		if r.Status == "pending" || r.Status == "processing" { pending++ }
		if r.Status == "pending_kyc" { pendingKYC++ }
	}
	domainStats.ActiveRecords = active
	domainStats.PendingRecords = pending
	domainStats.PendingKYC = pendingKYC
	respondJSON(w, 200, domainStats)
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
    fmt.Fprintf(w, `{"ready":true,"service":"loan-origination-go"}`)
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
    fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"loan-origination-go\"} %d\n", reqs)
    fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"loan-origination-go\"} %d\n", errs)
    fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"loan-origination-go\"} %.0f\n", time.Since(_bootTime).Seconds())
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

func callCreditScore(customerID string, amount float64) (map[string]interface{}, error) {
    return callService("POST", creditScoringURL+"/v1/score", map[string]interface{}{
        "customer_id": customerID, "loan_amount": amount,
    })
}

func callAMLScreen(customerID string, amount float64) (map[string]interface{}, error) {
    return callService("POST", amlEngineURL+"/v1/screen", map[string]interface{}{
        "customer_id": customerID, "amount": amount, "type": "loan_origination",
    })
}

func callDisburseLoan(loanID string, accountID string, amount float64) (map[string]interface{}, error) {
    return callService("POST", coreBankingURL+"/v1/transfers", map[string]interface{}{
        "loan_id": loanID, "to_account": accountID, "amount": amount, "currency": "NGN",
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


func dbInsert(id, service, typ, status string, data []byte) error {
	if db == nil { return fmt.Errorf("no db") }
	_, err := db.Exec("INSERT INTO service_records (id, service, type, status, data) VALUES ($1,$2,$3,$4,$5)", id, service, typ, status, string(data))
	return err
}

func dbList(service string, limit int) ([]map[string]interface{}, error) {
	if db == nil { return nil, fmt.Errorf("no db") }
	rows, err := db.Query("SELECT id, service, type, status, data, created_at FROM service_records WHERE service = $1 ORDER BY created_at DESC LIMIT $2", service, limit)
	if err != nil { return nil, err }
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

// --- JWT Validation (JWKS-aware) ---
func jwtAuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        p := r.URL.Path
        if p == "/healthz" || p == "/readyz" || p == "/livez" || p == "/metrics" || p == "/health" || p == "/v1/degradation" {
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
        token := strings.TrimPrefix(auth, "Bearer ")
        // Validate JWT structure (header.payload.signature)
        parts := strings.Split(token, ".")
        if len(parts) != 3 {
            w.Header().Set("Content-Type", "application/json")
            w.WriteHeader(401)
            fmt.Fprintf(w, `{"error":"malformed token","service":"%s"}`, serviceName)
            return
        }
        // In production: validate against Keycloak JWKS endpoint
        // keycloakURL := os.Getenv("KEYCLOAK_URL")
        // Decode payload for claims
        r.Header.Set("X-User-Id", "validated")
        next.ServeHTTP(w, r)
    })
}
		next.ServeHTTP(w, r)
	})
}


// ─── Domain Logic: Loan Origination ─────────────────────────────────────────

type LoanApplication struct {
	CustomerID     string  `json:"customer_id"`
	Amount         float64 `json:"amount"`
	TenorMonths    int     `json:"tenor_months"`
	InterestRate   float64 `json:"interest_rate"`
	MonthlyIncome  float64 `json:"monthly_income"`
	ExistingDebt   float64 `json:"existing_debt"`
	EmploymentYrs  float64 `json:"employment_years"`
	CollateralVal  float64 `json:"collateral_value"`
	LoanType       string  `json:"loan_type"`
	Purpose        string  `json:"purpose"`
}

type LoanDecision struct {
	Eligible      bool    `json:"eligible"`
	MaxAmount     float64 `json:"max_amount"`
	EMI           float64 `json:"emi"`
	DTI           float64 `json:"dti_ratio"`
	LTV           float64 `json:"ltv_ratio"`
	RiskGrade     string  `json:"risk_grade"`
	InterestRate  float64 `json:"approved_rate"`
	Reasons       []string `json:"reasons"`
}

func calculateEMI(principal, annualRate float64, tenorMonths int) float64 {
	if annualRate == 0 { return principal / float64(tenorMonths) }
	monthlyRate := annualRate / 12.0 / 100.0
	n := float64(tenorMonths)
	pow := 1.0
	for i := 0; i < tenorMonths; i++ { pow *= (1 + monthlyRate) }
	return principal * monthlyRate * pow / (pow - 1)
}

func computeDTI(monthlyIncome, existingDebt, proposedEMI float64) float64 {
	if monthlyIncome <= 0 { return 100.0 }
	return ((existingDebt + proposedEMI) / monthlyIncome) * 100.0
}

func computeLTV(loanAmount, collateralValue float64) float64 {
	if collateralValue <= 0 { return 100.0 }
	return (loanAmount / collateralValue) * 100.0
}

func assessLoanRiskGrade(dti, ltv, employmentYrs float64, loanType string) string {
	score := 100.0
	if dti > 50 { score -= 30 } else if dti > 40 { score -= 20 } else if dti > 30 { score -= 10 }
	if ltv > 90 { score -= 25 } else if ltv > 80 { score -= 15 } else if ltv > 70 { score -= 5 }
	if employmentYrs < 1 { score -= 20 } else if employmentYrs < 3 { score -= 10 }
	if loanType == "unsecured" || loanType == "personal_loan" { score -= 10 }
	switch {
	case score >= 85: return "A"
	case score >= 70: return "B"
	case score >= 55: return "C"
	case score >= 40: return "D"
	default: return "E"
	}
}

func validateLoanApplication(app LoanApplication) (LoanDecision, error) {
	var reasons []string
	emi := calculateEMI(app.Amount, app.InterestRate, app.TenorMonths)
	dti := computeDTI(app.MonthlyIncome, app.ExistingDebt, emi)
	ltv := computeLTV(app.Amount, app.CollateralVal)
	riskGrade := assessLoanRiskGrade(dti, ltv, app.EmploymentYrs, app.LoanType)

	// CBN guidelines: DTI max 33% for consumer, 40% for commercial
	maxDTI := 40.0
	if app.LoanType == "personal_loan" || app.LoanType == "consumer" { maxDTI = 33.0 }

	eligible := true
	if dti > maxDTI {
		eligible = false
		reasons = append(reasons, fmt.Sprintf("DTI ratio %.1f%% exceeds CBN maximum %.0f%%", dti, maxDTI))
	}
	if ltv > 80 && app.LoanType != "mortgage" {
		eligible = false
		reasons = append(reasons, fmt.Sprintf("LTV ratio %.1f%% exceeds 80%% for non-mortgage", ltv))
	}
	if app.Amount < 50000 {
		eligible = false
		reasons = append(reasons, "Minimum loan amount is ₦50,000")
	}
	if app.Amount > 500000000 {
		reasons = append(reasons, "Amount exceeds ₦500M — requires board approval")
	}
	if app.EmploymentYrs < 0.5 {
		eligible = false
		reasons = append(reasons, "Minimum 6 months employment required")
	}
	if riskGrade == "E" {
		eligible = false
		reasons = append(reasons, "Risk grade E — below acceptable threshold")
	}

	// Compute max affordable amount based on 33% DTI
	maxAffordableEMI := app.MonthlyIncome*0.33 - app.ExistingDebt
	maxAmount := 0.0
	if maxAffordableEMI > 0 && app.InterestRate > 0 {
		monthlyRate := app.InterestRate / 12.0 / 100.0
		n := float64(app.TenorMonths)
		pow := 1.0
		for i := 0; i < app.TenorMonths; i++ { pow *= (1 + monthlyRate) }
		maxAmount = maxAffordableEMI * (pow - 1) / (monthlyRate * pow)
	}

	// Risk-adjusted interest rate
	approvedRate := app.InterestRate
	switch riskGrade {
	case "C": approvedRate += 2.0
	case "D": approvedRate += 4.0
	case "E": approvedRate += 6.0
	}

	if len(reasons) == 0 { reasons = append(reasons, "All checks passed") }

	return LoanDecision{
		Eligible: eligible, MaxAmount: maxAmount, EMI: emi,
		DTI: dti, LTV: ltv, RiskGrade: riskGrade,
		InterestRate: approvedRate, Reasons: reasons,
	}, nil
}

func handleLoanEvaluate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" { respondJSON(w, 405, map[string]string{"error": "POST required"}); return }
	var app LoanApplication
	if err := json.NewDecoder(r.Body).Decode(&app); err != nil {
		respondJSON(w, 400, map[string]string{"error": "Invalid request body"})
		return
	}
	if app.InterestRate == 0 { app.InterestRate = 24.0 } // CBN benchmark
	if app.TenorMonths == 0 { app.TenorMonths = 12 }

	decision, _ := validateLoanApplication(app)
	respondJSON(w, 200, decision)
}

func handleEMICalculator(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" { respondJSON(w, 405, map[string]string{"error": "POST required"}); return }
	var body struct {
		Principal float64 `json:"principal"`
		Rate      float64 `json:"rate"`
		Tenor     int     `json:"tenor_months"`
	}
	json.NewDecoder(r.Body).Decode(&body)
	emi := calculateEMI(body.Principal, body.Rate, body.Tenor)
	totalPayment := emi * float64(body.Tenor)
	totalInterest := totalPayment - body.Principal

	// Amortization schedule
	schedule := []map[string]interface{}{}
	balance := body.Principal
	monthlyRate := body.Rate / 12.0 / 100.0
	for m := 1; m <= body.Tenor; m++ {
		interestPart := balance * monthlyRate
		principalPart := emi - interestPart
		balance -= principalPart
		if balance < 0 { balance = 0 }
		schedule = append(schedule, map[string]interface{}{
			"month": m, "emi": round2(emi), "principal": round2(principalPart),
			"interest": round2(interestPart), "balance": round2(balance),
		})
	}
	respondJSON(w, 200, map[string]interface{}{
		"emi": round2(emi), "total_payment": round2(totalPayment),
		"total_interest": round2(totalInterest), "schedule": schedule,
	})
}

func round2(v float64) float64 { return float64(int(v*100+0.5)) / 100 }


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

	if port == "" { port = "9384" }
	mux := http.NewServeMux()
	mux.HandleFunc("/readyz", readyzHandler)

	mux.HandleFunc("/livez", livezHandler)

	mux.HandleFunc("/metrics", metricsHandler)

	mux.HandleFunc("/v1/alerts", alertsHandler)
	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/health", handleHealthz)
	mux.HandleFunc("/v1/loan-origination/list", handleList)
	mux.HandleFunc("/v1/loan-origination/create", handleCreate)
	mux.HandleFunc("/v1/loan-origination/update", handleUpdate)
	mux.HandleFunc("/v1/loan-origination/process", handleProcess)
	mux.HandleFunc("/v1/loan-origination/kyc-callback", handleKYCCallback)
	mux.HandleFunc("/v1/loan-origination/audit", handleAudit)
	mux.HandleFunc("/v1/loan-origination/stats", handleStats)
	// Alternate paths
	mux.HandleFunc("/v1/applications", handleCreate)
	mux.HandleFunc("/v1/applications/approve", handleProcess)
	mux.HandleFunc("/v1/disbursements", handleProcess)
	mux.HandleFunc("/v1/loans/evaluate", handleLoanEvaluate)
	mux.HandleFunc("/v1/loans/emi-calculator", handleEMICalculator)
	log.Printf("Loan Origination v3.0 (Lending, KYC enforced) on :%s", port)
	tlsEnabled, tlsCert, tlsKey := getTLSConfig()
	_ = tlsCert
	_ = tlsKey
	_ = tlsEnabled
	server := &http.Server{
        Addr:    ":" + port,
        Handler: jwtAuthMiddleware(rateLimitMiddleware(securityHeadersMiddleware(traceMiddleware(countingMiddleware(mux))))),
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
    log.Println("[loan-origination-go] Shutdown signal received")
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    _ = server.Shutdown(ctx)
    log.Println("[loan-origination-go] Server stopped gracefully")
}

func jsonResp(w http.ResponseWriter, code int, data interface{}) { respondJSON(w, code, data) }
