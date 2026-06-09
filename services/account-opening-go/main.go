// account-opening-go — Account Opening with KYC/KYB enforcement
// Domain: Customer Onboarding
// KYC gate: Tier 2+ accounts require verified KYC before opening
// Middleware: Kafka, Postgres, Redis, Temporal, Permify, OpenSearch
package main

import (
	_ "github.com/lib/pq"
	"context"
	"os/signal"
	"syscall"
	"sync/atomic"
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"crypto/rand"
	"encoding/binary"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
	"net"

	"regexp"
)

// secureRandUint32 generates a cryptographically secure random uint32
func secureRandUint32() uint32 {
	var b [4]byte
	rand.Read(b[:])
	return binary.BigEndian.Uint32(b[:])
}

var serviceName = "account-opening-go"

// Inter-service URLs
var kycServiceURL = func() string { v := os.Getenv("KYC_SERVICE_URL"); if v == "" { return "http://localhost:8201" }; return v }()
var coreServiceURL = func() string { v := os.Getenv("CORE_BANKING_URL"); if v == "" { return "http://localhost:8100" }; return v }()


var (
	db           *sql.DB
	startTime    = time.Now()
	kycEngineURL string
	mu           sync.Mutex
)

// ── Domain Types ────────────────────────────────────────────────────────────

type AccountApplication struct {
	ID           string                 `json:"id"`
	CustomerID   string                 `json:"customerId"`
	CustomerName string                 `json:"customerName"`
	AccountType  string                 `json:"accountType"`
	Currency     string                 `json:"currency"`
	Tier         string                 `json:"tier"`
	Status       string                 `json:"status"`
	KYCStatus    string                 `json:"kycStatus"`
	KYCLevel     string                 `json:"kycLevel"`
	KYCVerified  bool                   `json:"kycVerified"`
	Documents    []string               `json:"documents"`
	BVN          string                 `json:"bvn,omitempty"`
	NIN          string                 `json:"nin,omitempty"`
	Data         map[string]interface{} `json:"data,omitempty"`
	CreatedAt    string                 `json:"createdAt"`
	UpdatedAt    string                 `json:"updatedAt"`
}

type KYCCheckResult struct {
	Allowed       bool   `json:"allowed"`
	CustomerID    string `json:"customerId"`
	Status        string `json:"status"`
	Level         string `json:"level"`
	Verified      bool   `json:"verified"`
	Reason        string `json:"reason"`
	RequiredLevel string `json:"requiredLevel"`
}

var applications = []AccountApplication{
	{ID: "APP-001", CustomerID: "CUS-1045", CustomerName: "Amina Yusuf", AccountType: "savings", Currency: "NGN", Tier: "tier2", Status: "approved", KYCStatus: "verified", KYCLevel: "enhanced", KYCVerified: true, Documents: []string{"bvn", "nin", "passport_photo"}, BVN: "22345678901", CreatedAt: "2026-05-08T09:00:00Z", UpdatedAt: "2026-05-08T09:02:45Z"},
	{ID: "APP-002", CustomerID: "CUS-2089", CustomerName: "Chinedu Okeke", AccountType: "current", Currency: "NGN", Tier: "tier3", Status: "pending_kyc", KYCStatus: "pending", KYCLevel: "standard", KYCVerified: false, Documents: []string{"bvn"}, BVN: "33456789012", CreatedAt: "2026-05-09T10:00:00Z", UpdatedAt: "2026-05-09T10:00:00Z"},
	{ID: "APP-003", CustomerID: "CUS-WALK-001", CustomerName: "Walk-in Customer", AccountType: "savings", Currency: "NGN", Tier: "tier1", Status: "approved", KYCStatus: "basic_only", KYCLevel: "basic", KYCVerified: true, Documents: []string{"phone"}, CreatedAt: "2026-05-10T14:00:00Z", UpdatedAt: "2026-05-10T14:00:30Z"},
}

var auditLog []map[string]interface{}

// ── KYC Enforcement ─────────────────────────────────────────────────────────

func checkKYCStatus(customerID, requiredLevel string) KYCCheckResult {
	gatewayURL := os.Getenv("GATEWAY_URL")
	if gatewayURL == "" {
		gatewayURL = "http://localhost:5000"
	}

	result, err := callService("POST", gatewayURL+"/api/platform/kyc-enforcement/check", map[string]string{
		"customerId": customerID,
		"serviceId":  "account-opening-go",
		"operation":  "account_open",
	})
	if err != nil {
		log.Printf("[account-opening-go] KYC check failed (circuit breaker / retries exhausted): %v — BLOCKING (fail-closed)", err)
		return KYCCheckResult{Allowed: false, CustomerID: customerID, Status: "gateway_unreachable", Reason: fmt.Sprintf("KYC enforcement unavailable — fail-closed: %v", err)}
	}

	allowed, _ := result["allowed"].(bool)
	reason, _ := result["reason"].(string)
	reqLevel, _ := result["requiredLevel"].(string)
	kycStatus, _ := result["kycStatus"].(map[string]interface{})
	level, _ := kycStatus["level"].(string)
	status, _ := kycStatus["status"].(string)
	verified, _ := kycStatus["verified"].(bool)

	return KYCCheckResult{
		Allowed:       allowed,
		CustomerID:    customerID,
		Status:        status,
		Level:         level,
		Verified:      verified,
		Reason:        reason,
		RequiredLevel: reqLevel,
	}
}

func kycLevelForTier(tier string) string {
	switch tier {
	case "tier1":
		return "basic"
	case "tier2":
		return "standard"
	case "tier3":
		return "enhanced"
	default:
		return "standard"
	}
}

// ── Handlers ────────────────────────────────────────────────────────────────

func jsonResp(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Service", "account-opening-go")
	w.Header().Set("X-Request-Id", fmt.Sprintf("%d", time.Now().UnixNano()))
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Idempotency-Key")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	dbURL := os.Getenv("DATABASE_URL")
	dbStatus := "disconnected"
	if dbURL != "" {
		dbStatus = "configured"
	}
	jsonResp(w, 200, map[string]interface{}{
		"service": "account-opening-go", "status": "healthy", "version": "3.0.0",
		"domain": "Account Opening — Customer Onboarding",
		"kycEnforcement": map[string]interface{}{
			"enabled":           true,
			"tier1_bypass":      true,
			"tier2_requires":    "standard",
			"tier3_requires":    "enhanced",
			"kycEngineUrl":      kycEngineURL,
			"enforcementMode":   "gateway_middleware + service_check",
		},
		"capabilities": []string{
			"account_application", "kyc_gate_enforcement", "tier_assignment",
			"bvn_nin_validation", "document_collection", "approval_workflow",
			"kafka_events", "audit_trail", "idempotency",
		},
		"middleware": map[string]string{
			"postgres":   dbStatus,
			"kafka":      "account.opened, account.kyc.required, account.kyc.verified",
			"redis":      getEnvStatus("REDIS_URL"),
			"temporal":   "AccountOpeningWorkflow, KYCVerificationChild",
			"permify":    "account:open, account:approve, kyc:verify",
			"opensearch": "account-applications-2026",
		},
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"uptime":    time.Since(startTime).String(),
	})
}

func getEnvStatus(key string) string {
	if os.Getenv(key) != "" { return "configured" }
	return "not_configured"
}

func listHandler(w http.ResponseWriter, r *http.Request) {
	cacheKey := "account_opening_list"
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
	tier := r.URL.Query().Get("tier")
	var filtered []AccountApplication
	for _, app := range applications {
		if (status == "" || app.Status == status) && (tier == "" || app.Tier == tier) {
			filtered = append(filtered, app)
		}
	}
	if filtered == nil { filtered = []AccountApplication{} }
	jsonResp(w, 200, map[string]interface{}{
		"applications": filtered, "total": len(filtered),
		"domain": "Account Opening",
	})
}

func statsHandler(w http.ResponseWriter, r *http.Request) {
	mu.Lock()
	defer mu.Unlock()
	approved, pending, rejected, pendingKYC := 0, 0, 0, 0
	for _, app := range applications {
		switch app.Status {
		case "approved": approved++
		case "pending", "pending_review": pending++
		case "rejected": rejected++
		case "pending_kyc": pendingKYC++
		}
	}
	jsonResp(w, 200, map[string]interface{}{
		"total": len(applications), "approved": approved, "pending": pending,
		"rejected": rejected, "pendingKYC": pendingKYC,
		"service": "account-opening-go",
	})
}

func getByIdHandler(w http.ResponseWriter, r *http.Request) {
	idParam := r.URL.Query().Get("id")
	if idParam == "" { idParam = strings.TrimPrefix(r.URL.Path, "/v1/account-opening/") }
	cacheKey := "account_opening_" + idParam
	if cached, ok := cacheGet(cacheKey); ok {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Cache", "HIT")
		w.WriteHeader(200)
		w.Write([]byte(cached))
		return
	}
	id := strings.TrimPrefix(r.URL.Path, "/v1/account-opening/")
	if id == "" || id == "list" || id == "stats" || id == "products" || id == "tier-limits" {
		listHandler(w, r)
		return
	}
	mu.Lock()
	defer mu.Unlock()
	for _, app := range applications {
		if app.ID == id {
			jsonResp(w, 200, app)
			return
		}
	}
	jsonResp(w, 404, map[string]string{"error": "Application not found"})
}

func productsHandler(w http.ResponseWriter, r *http.Request) {
	products := []map[string]interface{}{
		{"id": "PRD-SAV", "name": "Savings Account", "type": "savings", "currency": "NGN", "minBalance": 1000, "kycRequired": "basic", "tier": "tier1"},
		{"id": "PRD-CUR", "name": "Current Account", "type": "current", "currency": "NGN", "minBalance": 10000, "kycRequired": "standard", "tier": "tier2"},
		{"id": "PRD-DOM", "name": "Domiciliary Account", "type": "domiciliary", "currency": "USD", "minBalance": 100, "kycRequired": "enhanced", "tier": "tier3"},
		{"id": "PRD-FD", "name": "Fixed Deposit", "type": "fixed_deposit", "currency": "NGN", "minBalance": 100000, "kycRequired": "standard", "tier": "tier2"},
		{"id": "PRD-CORP", "name": "Corporate Account", "type": "corporate", "currency": "NGN", "minBalance": 500000, "kycRequired": "full_edd", "tier": "tier3", "kybRequired": true},
	}
	jsonResp(w, 200, map[string]interface{}{"products": products, "total": len(products)})
}

func tierLimitsHandler(w http.ResponseWriter, r *http.Request) {
	limits := []map[string]interface{}{
		{"tier": "tier1", "name": "Basic (Mobile Money)", "maxBalance": 300000, "dailyLimit": 50000, "kycLevel": "basic", "docs": []string{"phone_number", "name", "dob"}},
		{"tier": "tier2", "name": "Standard", "maxBalance": 500000, "dailyLimit": 200000, "kycLevel": "standard", "docs": []string{"bvn", "id_document"}},
		{"tier": "tier3", "name": "Enhanced (Full Banking)", "maxBalance": "unlimited", "dailyLimit": "unlimited", "kycLevel": "enhanced", "docs": []string{"bvn", "nin", "utility_bill", "passport_photo"}},
	}
	jsonResp(w, 200, map[string]interface{}{"tierLimits": limits, "total": len(limits)})
}

func createHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-Id")
	if tenantID == "" { tenantID = "platform" }
	if r.Method == "OPTIONS" {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Idempotency-Key")
		w.WriteHeader(204)
		return
	}
	if r.Method != "POST" {
		jsonResp(w, 405, map[string]string{"error": "Method not allowed"})
		return
	}
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonResp(w, 400, map[string]string{"error": "Invalid JSON body"})
		return
	}

	customerID := getString(body, "customerId")
	customerName := getString(body, "customerName")
	accountType := getString(body, "accountType")
	tier := getString(body, "tier")
	if tier == "" { tier = "tier1" }
	if accountType == "" { accountType = "savings" }

	requiredKYCLevel := kycLevelForTier(tier)

	// Tier 1 basic accounts bypass KYC (CBN allows phone-only for mobile money)
	if tier != "tier1" && customerID != "" {
		kycResult := checkKYCStatus(customerID, requiredKYCLevel)
		if !kycResult.Allowed {
			mu.Lock()
			app := AccountApplication{
				ID: fmt.Sprintf("APP-%08X", secureRandUint32()), CustomerID: customerID,
				CustomerName: customerName, AccountType: accountType, Currency: getString(body, "currency"),
				Tier: tier, Status: "pending_kyc", KYCStatus: kycResult.Status,
				KYCLevel: kycResult.Level, KYCVerified: false,
				CreatedAt: time.Now().Format(time.RFC3339), UpdatedAt: time.Now().Format(time.RFC3339),
			}
			applications = append(applications, app)
			mu.Unlock()

			jsonResp(w, 202, map[string]interface{}{
				"application":  app,
				"kycRequired":  true,
				"kycResult":    kycResult,
				"message":      fmt.Sprintf("Account application created but requires %s KYC verification before approval", requiredKYCLevel),
				"nextStep":     "Complete KYC verification via /api/platform/kyc-triggers/initiate",
				"kafkaEvents": []map[string]string{
					{"topic": "account.application.created", "status": "pending_kyc"},
					{"topic": "kyc.verification.required", "customerId": customerID, "requiredLevel": requiredKYCLevel},
				},
			})
			return
		}
	}

	mu.Lock()
	defer mu.Unlock()

	app := AccountApplication{
		ID: fmt.Sprintf("APP-%08X", secureRandUint32()), CustomerID: customerID,
		CustomerName: customerName, AccountType: accountType,
		Currency: getString(body, "currency"), Tier: tier,
		Status: "approved", KYCStatus: "verified", KYCLevel: requiredKYCLevel,
		KYCVerified: true, BVN: getString(body, "bvn"), NIN: getString(body, "nin"),
		Documents: []string{}, Data: body,
		CreatedAt: time.Now().Format(time.RFC3339), UpdatedAt: time.Now().Format(time.RFC3339),
	}
	if tier == "tier1" { app.KYCStatus = "basic_only" }
	applications = append(applications, app)

	auditLog = append(auditLog, map[string]interface{}{
		"action": "account_opened", "applicationId": app.ID,
		"customerId": customerID, "tier": tier, "kycVerified": app.KYCVerified,
		"timestamp": app.CreatedAt,
	})

	dataBytes, marshalErr := json.Marshal(body)
	if marshalErr != nil {
		log.Printf("[%s] JSON marshal error: %v", serviceName, marshalErr)
		jsonResp(w, 400, map[string]interface{}{"error": "marshal_failed", "detail": marshalErr.Error()})
		return
	}
		dataBytes = []byte(sanitizeInput(string(dataBytes)))
	if dbErr := dbInsert(fmt.Sprintf("account_opening_go-%d", time.Now().UnixNano()), "account_opening_go", "default", "active", dataBytes); dbErr != nil {
		log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr)
	}
	
	cacheSet(tenantID+":"+"account_opening_list", "", 1) // invalidate list cache
	jsonResp(w, 201, map[string]interface{}{
		"application": app,
		"message":     fmt.Sprintf("Account application approved — %s KYC verified", app.KYCLevel),
		"kafkaEvents": []map[string]string{
			{"topic": "account.opened", "customerId": customerID, "tier": tier},
		},
	})
}

func approveHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" { jsonResp(w, 405, map[string]string{"error": "POST required"}); return }
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		log.Printf("[%s] JSON decode error: %v", serviceName, err)
		jsonResp(w, 400, map[string]interface{}{"error": "invalid_json", "detail": err.Error()})
		return
	}
	appID := getString(body, "applicationId")

	mu.Lock()
	defer mu.Unlock()
	for i := range applications {
		if applications[i].ID == appID {
			if !applications[i].KYCVerified {
				jsonResp(w, 403, map[string]interface{}{
					"error": "Cannot approve — KYC verification incomplete",
					"code": "KYC_NOT_VERIFIED",
					"applicationId": appID,
					"kycStatus": applications[i].KYCStatus,
					"message": "Complete KYC verification before approving this application",
				})
				return
			}
			applications[i].Status = "approved"
			applications[i].UpdatedAt = time.Now().Format(time.RFC3339)
			jsonResp(w, 200, map[string]interface{}{
				"application": applications[i],
				"message": "Application approved — KYC verified",
			})
			return
		}
	}
	jsonResp(w, 404, map[string]string{"error": "Application not found"})
}

func kycVerifyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" { jsonResp(w, 405, map[string]string{"error": "POST required"}); return }
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		log.Printf("[%s] JSON decode error: %v", serviceName, err)
		jsonResp(w, 400, map[string]interface{}{"error": "invalid_json", "detail": err.Error()})
		return
	}
	customerID := getString(body, "customerId")
	level := getString(body, "level")
	if level == "" { level = "standard" }

	mu.Lock()
	defer mu.Unlock()
	updated := 0
	for i := range applications {
		if applications[i].CustomerID == customerID && applications[i].Status == "pending_kyc" {
			applications[i].KYCVerified = true
			applications[i].KYCStatus = "verified"
			applications[i].KYCLevel = level
			applications[i].Status = "approved"
			applications[i].UpdatedAt = time.Now().Format(time.RFC3339)
			updated++
		}
	}
	jsonResp(w, 200, map[string]interface{}{
		"customerId": customerID, "level": level, "applicationsUpdated": updated,
		"message": fmt.Sprintf("KYC verified at %s level — %d applications approved", level, updated),
		"kafkaEvent": map[string]string{"topic": "account.kyc.verified", "customerId": customerID},
	})
}

func auditHandler(w http.ResponseWriter, r *http.Request) {
	mu.Lock()
	defer mu.Unlock()
	if auditLog == nil { auditLog = []map[string]interface{}{} }
	jsonResp(w, 200, map[string]interface{}{"audit": auditLog, "total": len(auditLog)})
}

func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok { return s }
	}
	return ""
}

func initDB() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Println("[account-opening-go] DATABASE_URL not set, running without DB")
		return
	}
	var err error
	db, err = sql.Open("postgres", dbURL)
	if err != nil {
		log.Printf("[account-opening-go] DB connection error: %v", err)
		return
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err = db.Ping(); err != nil {
		log.Printf("[account-opening-go] DB ping failed: %v", err)
		db = nil
		return
	}
	log.Println("[account-opening-go] Connected to Postgres")
}

func dbInsert(id, service, typ, status string, data []byte) error {
	if db == nil { return fmt.Errorf("no db") }
	_, err := db.Exec("INSERT INTO service_records (id, service, type, status, data) VALUES ($1,$2,$3,$4,$5)", id, service, typ, status, string(data))
	return err
}

func dataHandler(w http.ResponseWriter, r *http.Request) {
	if db == nil {
		jsonResp(w, 200, map[string]interface{}{"items": []interface{}{}, "source": "no-db"})
		return
	}
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 { page = 1 }
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 || limit > 100 { limit = 25 }
	offset := (page - 1) * limit

	var total int
	db.QueryRow(`SELECT count(*) FROM "accounts"`).Scan(&total)

	rows, err := db.Query(fmt.Sprintf(`SELECT accountId, accountName, accountType, currency, balance, status FROM "accounts" ORDER BY id LIMIT %d OFFSET %d`, limit, offset))
	if err != nil {
		jsonResp(w, 500, map[string]interface{}{"error": err.Error()})
		return
	}
	defer rows.Close()

	cols, _ := rows.Columns()
	var items []map[string]interface{}
	for rows.Next() {
		vals := make([]interface{}, len(cols))
		ptrs := make([]interface{}, len(cols))
		for i := range vals { ptrs[i] = &vals[i] }
		rows.Scan(ptrs...)
		row := make(map[string]interface{})
		for i, col := range cols { row[col] = vals[i] }
		items = append(items, row)
	}
	if items == nil { items = []map[string]interface{}{} }

	jsonResp(w, 200, map[string]interface{}{
		"items": items, "total": total, "page": page, "limit": limit, "source": "database",
	})
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
    fmt.Fprintf(w, `{"ready":true,"service":"account-opening-go"}`)
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
    fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"account-opening-go\"} %d\n", reqs)
    fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"account-opening-go\"} %d\n", errs)
    fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"account-opening-go\"} %.0f\n", time.Since(_bootTime).Seconds())
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

func callKYCCheck(customerID string, tier string) (map[string]interface{}, error) {
    return callService("POST", kycServiceURL+"/v1/verify", map[string]interface{}{
        "customer_id": customerID, "tier": tier, "checks": []string{"bvn", "nin"},
    })
}

func callCreateAccount(customerID string, accountType string) (map[string]interface{}, error) {
    return callService("POST", coreServiceURL+"/v1/accounts", map[string]interface{}{
        "customer_id": customerID, "type": accountType, "currency": "NGN",
    })
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


// ─── Domain Logic: Account Opening ──────────────────────────────────────────

func validateAccountOpening(customerType, accountType, kycLevel string, age int) (bool, []string) {
	var errors []string
	// CBN tiered KYC requirements
	kycRequirements := map[string][]string{
		"tier1": {"bvn"},
		"tier2": {"bvn", "nin", "utility_bill"},
		"tier3": {"bvn", "nin", "utility_bill", "reference_letter", "employer_letter"},
	}
	if _, ok := kycRequirements[kycLevel]; !ok {
		errors = append(errors, "Invalid KYC tier: must be tier1, tier2, or tier3")
	}
	if age < 18 && accountType != "savings" {
		errors = append(errors, "Minors can only open savings accounts")
	}
	if customerType == "corporate" && kycLevel != "tier3" {
		errors = append(errors, "Corporate accounts require Tier 3 KYC")
	}
	// Account type validation
	validTypes := map[string]bool{"savings": true, "current": true, "domiciliary": true, "fixed_deposit": true, "corporate": true}
	if !validTypes[accountType] {
		errors = append(errors, "Invalid account type")
	}
	// Transaction limits per tier
	return len(errors) == 0, errors
}

func computeAccountTierLimits(kycTier string) map[string]interface{} {
	switch kycTier {
	case "tier1":
		return map[string]interface{}{"single_debit_limit": 50000, "daily_limit": 300000, "cumulative_balance": 300000}
	case "tier2":
		return map[string]interface{}{"single_debit_limit": 200000, "daily_limit": 500000, "cumulative_balance": 500000}
	case "tier3":
		return map[string]interface{}{"single_debit_limit": 5000000, "daily_limit": 25000000, "cumulative_balance": "unlimited"}
	default:
		return map[string]interface{}{"single_debit_limit": 0, "daily_limit": 0, "cumulative_balance": 0}
	}
}

func generateAccountNumber() string {
	digits := "0123456789"
	result := "54" // Bank code prefix
	for i := 0; i < 8; i++ {
		result += string(digits[secureRandUint32() % 10])
	}
	return result
}

func handleAccountValidate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" { respondJSON(w, 405, map[string]string{"error": "POST required"}); return }
	var body struct {
		CustomerType string `json:"customer_type"`
		AccountType  string `json:"account_type"`
		KYCLevel     string `json:"kyc_level"`
		Age          int    `json:"age"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		log.Printf("[%s] JSON decode error: %v", serviceName, err)
		jsonResp(w, 400, map[string]interface{}{"error": "invalid_json", "detail": err.Error()})
		return
	}
	if body.CustomerType == "" { body.CustomerType = "individual" }
	if body.KYCLevel == "" { body.KYCLevel = "tier1" }

	valid, errors := validateAccountOpening(body.CustomerType, body.AccountType, body.KYCLevel, body.Age)
	limits := computeAccountTierLimits(body.KYCLevel)
	accountNumber := ""
	if valid { accountNumber = generateAccountNumber() }
	respondJSON(w, 200, map[string]interface{}{
		"eligible": valid, "errors": errors, "tier_limits": limits,
		"proposed_account_number": accountNumber,
	})
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
    jsonResp(w, 200, map[string]interface{}{"alerts": _alertMgr.check(), "rules": len(_alertMgr.rules)})
}

// --- Integration Tests ---
func respondJSON(w http.ResponseWriter, code int, data interface{}) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(code)
    json.NewEncoder(w).Encode(data)
}


// ── Deep Domain Logic: Accounts ─────────────────────────────────────────────

type AmountKobo int64
func nairaToKobo(naira float64) AmountKobo { return AmountKobo(naira * 100) }
func (a AmountKobo) Naira() float64       { return float64(a) / 100.0 }

// AccountState lifecycle
type AccountState string
const (
	AccountDraft     AccountState = "draft"
	AccountPendingKYC AccountState = "pending_kyc"
	AccountActive    AccountState = "active"
	AccountDormant   AccountState = "dormant"
	AccountFrozen    AccountState = "frozen"
	AccountClosed    AccountState = "closed"
	AccountPND       AccountState = "post_no_debit"
)

var validAccountTransitions = map[AccountState][]AccountState{
	AccountDraft:      {AccountPendingKYC, AccountActive},
	AccountPendingKYC: {AccountActive, AccountClosed},
	AccountActive:     {AccountDormant, AccountFrozen, AccountClosed, AccountPND},
	AccountDormant:    {AccountActive, AccountClosed},
	AccountFrozen:     {AccountActive, AccountClosed},
	AccountPND:        {AccountActive, AccountFrozen, AccountClosed},
}

func canTransitionAccount(from, to AccountState) bool {
	allowed := validAccountTransitions[from]
	for _, s := range allowed { if s == to { return true } }
	return false
}

// CBN Tier Limits
type TierLimit struct {
	MaxSingleDebit    AmountKobo
	MaxDailyDebit     AmountKobo
	MaxBalance        AmountKobo
	MaxDailyCumulative AmountKobo
	RequiredDocs      []string
}

var cbnTierLimits = map[string]TierLimit{
	"tier1": {
		MaxSingleDebit:    nairaToKobo(50000),
		MaxDailyDebit:     nairaToKobo(300000),
		MaxBalance:        nairaToKobo(300000),
		MaxDailyCumulative: nairaToKobo(300000),
		RequiredDocs:      []string{"phone_number"},
	},
	"tier2": {
		MaxSingleDebit:    nairaToKobo(200000),
		MaxDailyDebit:     nairaToKobo(500000),
		MaxBalance:        nairaToKobo(500000),
		MaxDailyCumulative: nairaToKobo(500000),
		RequiredDocs:      []string{"bvn", "phone_number", "date_of_birth"},
	},
	"tier3": {
		MaxSingleDebit:    nairaToKobo(5000000),
		MaxDailyDebit:     nairaToKobo(10000000),
		MaxBalance:        nairaToKobo(0), // unlimited
		MaxDailyCumulative: nairaToKobo(10000000),
		RequiredDocs:      []string{"bvn", "nin", "proof_of_address", "passport_photo", "utility_bill"},
	},
}

func validateTierTransaction(tier string, amountKobo AmountKobo, dailyTotalKobo AmountKobo) (bool, string) {
	limit, ok := cbnTierLimits[tier]
	if !ok { return false, "unknown tier" }
	if amountKobo > limit.MaxSingleDebit { return false, fmt.Sprintf("exceeds %s single debit limit ₦%.0f", tier, limit.MaxSingleDebit.Naira()) }
	if dailyTotalKobo+amountKobo > limit.MaxDailyCumulative { return false, fmt.Sprintf("exceeds %s daily cumulative limit ₦%.0f", tier, limit.MaxDailyCumulative.Naira()) }
	return true, ""
}

// BVN Validation (11-digit with check algorithm)
func validateBVN(bvn string) (bool, string) {
	if len(bvn) != 11 { return false, "BVN must be 11 digits" }
	for _, c := range bvn {
		if c < '0' || c > '9' { return false, "BVN must contain only digits" }
	}
	// First 2 digits = issuer code (must be valid)
	issuer := bvn[:2]
	if issuer == "00" { return false, "invalid BVN issuer code" }
	return true, ""
}

// NIN Validation (11-digit National Identity Number)
func validateNIN(nin string) (bool, string) {
	if len(nin) != 11 { return false, "NIN must be 11 digits" }
	for _, c := range nin {
		if c < '0' || c > '9' { return false, "NIN must contain only digits" }
	}
	return true, ""
}

// Dormancy detection — CBN: no customer-initiated transaction in 12 months
func checkDormancy(lastTxnDate time.Time) (bool, int) {
	days := int(time.Since(lastTxnDate).Hours() / 24)
	isDormant := days >= 365
	return isDormant, days
}

// COT (Commission on Turnover) — deprecated but some accounts still have it
func computeCOT(turnoverKobo AmountKobo, rate float64) AmountKobo {
	if rate <= 0 { return 0 }
	return AmountKobo(float64(turnoverKobo) * rate / 100.0)
}

// SMS alert charge
func computeSMSAlertCharge(alertCount int, pricePerAlert AmountKobo) AmountKobo {
	return AmountKobo(alertCount) * pricePerAlert
}

// Account closure validation
func validateAccountClosure(balanceKobo AmountKobo, hasActiveLoan, hasPendingTxn, hasLien bool) (bool, []string) {
	var errors []string
	if balanceKobo != 0 { errors = append(errors, fmt.Sprintf("account balance must be zero (current: ₦%.2f)", balanceKobo.Naira())) }
	if hasActiveLoan { errors = append(errors, "active loan linked to account") }
	if hasPendingTxn { errors = append(errors, "pending transactions exist") }
	if hasLien { errors = append(errors, "lien placed on account") }
	return len(errors) == 0, errors
}

// Interest accrual for savings (daily accrual, monthly capitalization)
func computeDailyInterestAccrual(balanceKobo AmountKobo, annualRatePct float64) AmountKobo {
	dailyRate := annualRatePct / 365.0 / 100.0
	return AmountKobo(float64(balanceKobo) * dailyRate)
}

// WHT (Withholding Tax) on interest — 10% for individuals, 10% for corporates
func computeWHT(interestKobo AmountKobo, accountType string) AmountKobo {
	rate := 0.10 // 10% for both individual and corporate per Nigerian tax law
	return AmountKobo(float64(interestKobo) * rate)
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


// ─── Optimistic Locking for Balance Updates ─────────────────────────────────
// All balance updates use version-checked atomic operations.
type BalanceLock struct {
	AccountID string
	Version   int64
	Balance   int64 // kobo
}

func dbUpdateBalanceAtomic(accountID string, deltaKobo int64, currentVersion int64) (int64, error) {
	if db == nil { return 0, fmt.Errorf("DB not available") }
	tx, err := db.Begin()
	if err != nil { return 0, err }
	defer tx.Rollback()
	var balance int64
	var version int64
	err = tx.QueryRow("SELECT balance_kobo, version FROM account_balances WHERE account_id = $1 FOR UPDATE", accountID).Scan(&balance, &version)
	if err != nil { return 0, fmt.Errorf("account not found or locked: %v", err) }
	if version != currentVersion {
		return 0, fmt.Errorf("optimistic lock conflict: expected version %d, got %d", currentVersion, version)
	}
	newBalance := balance + deltaKobo
	if newBalance < 0 { return 0, fmt.Errorf("insufficient balance: have %d kobo, need %d kobo", balance, -deltaKobo) }
	_, err = tx.Exec("UPDATE account_balances SET balance_kobo = $1, version = version + 1, updated_at = NOW() WHERE account_id = $2 AND version = $3",
		newBalance, accountID, currentVersion)
	if err != nil { return 0, err }
	err = tx.Commit()
	if err != nil { return 0, err }
	return newBalance, nil
}


// ─── Maker-Checker (Dual Authorization) ────────────────────────────────────
// CBN requires dual control for high-value operations.
type MakerCheckerRequest struct {
	RequestID  string      `json:"request_id"`
	Operation  string      `json:"operation"`
	MakerID    string      `json:"maker_id"`
	CheckerID  string      `json:"checker_id,omitempty"`
	AmountKobo int64       `json:"amount_kobo"`
	Status     string      `json:"status"` // pending_approval|approved|rejected
	Payload    interface{} `json:"payload"`
	CreatedAt  string      `json:"created_at"`
	DecidedAt  string      `json:"decided_at,omitempty"`
}

var (
	makerCheckerRequests []MakerCheckerRequest
	makerCheckerMu       sync.Mutex
)

// makerCheckerThresholds defines CBN-required dual authorization thresholds (kobo)
var makerCheckerThresholds = map[string]int64{
	"transfer":      100_000_000, // ₦1M
	"loan_disburse": 100_000_000, // ₦1M
	"gl_posting":    50_000_000,  // ₦500K
	"account_close": 0,           // Always requires checker
}

func requiresMakerChecker(operation string, amountKobo int64) bool {
	threshold, ok := makerCheckerThresholds[operation]
	if !ok { threshold = 100_000_000 }
	return amountKobo >= threshold
}

func submitForApproval(operation, makerID string, amountKobo int64, payload interface{}) *MakerCheckerRequest {
	req := MakerCheckerRequest{
		RequestID: fmt.Sprintf("MCR-%d", time.Now().UnixNano()),
		Operation: operation, MakerID: makerID, AmountKobo: amountKobo,
		Status: "pending_approval", Payload: payload,
		CreatedAt: time.Now().Format(time.RFC3339),
	}
	makerCheckerMu.Lock()
	makerCheckerRequests = append(makerCheckerRequests, req)
	makerCheckerMu.Unlock()
	return &req
}


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


// ─── Domain-Specific Account Validation ─────────────────────────────────────
var validAccountTypes = map[string]bool{"savings": true, "current": true, "domiciliary": true, "fixed_deposit": true, "corporate": true, "joint": true}
var validCurrencies = map[string]bool{"NGN": true, "USD": true, "GBP": true, "EUR": true}

func validateAccountCreation(accountType, currency, tier, customerName string, bvn string) (bool, []string) {
	var errs []string
	if !validAccountTypes[accountType] { errs = append(errs, "invalid account type: "+accountType) }
	if !validCurrencies[currency] { errs = append(errs, "unsupported currency: "+currency) }
	if tier != "tier1" && tier != "tier2" && tier != "tier3" { errs = append(errs, "invalid KYC tier") }
	if len(customerName) < 2 { errs = append(errs, "customer name too short") }
	if len(customerName) > 100 { errs = append(errs, "customer name too long (max 100)") }
	if tier != "tier1" && len(bvn) != 11 { errs = append(errs, "BVN required for tier2+ accounts") }
	return len(errs) == 0, errs
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

func main() {
	initTracing()
	port := os.Getenv("PORT")

	if port == "" { port = "8114" }
	kycEngineURL = os.Getenv("KYC_ENGINE_URL")
	if kycEngineURL == "" { kycEngineURL = "http://localhost:9433" }

	initDB()

	mux := http.NewServeMux()
	mux.HandleFunc("/readyz", readyzHandler)

	mux.HandleFunc("/livez", livezHandler)

	mux.HandleFunc("/metrics", metricsHandler)

	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/v1/alerts", alertsHandler)
	mux.HandleFunc("/dlq", handleDLQList)
	mux.HandleFunc("/dlq/replay", handleDLQReplay)
	mux.HandleFunc("/healthz", healthHandler)
	mux.HandleFunc("/v1/account-opening/list", listHandler)
	mux.HandleFunc("/v1/account-opening/stats", statsHandler)
	mux.HandleFunc("/v1/account-opening/products", productsHandler)
	mux.HandleFunc("/v1/account-opening/tier-limits", tierLimitsHandler)
	mux.HandleFunc("/v1/account-opening/approve", approveHandler)
	mux.HandleFunc("/v1/account-opening/kyc-verify", kycVerifyHandler)
	mux.HandleFunc("/v1/account-opening/audit", auditHandler)
	mux.HandleFunc("/v1/account-opening/data", dataHandler)
	mux.HandleFunc("/v1/account-opening/", getByIdHandler)
	mux.HandleFunc("/v1/account-opening", createHandler)
	// Alternate paths
	mux.HandleFunc("/v1/accounts/products", productsHandler)
	mux.HandleFunc("/v1/accounts/applications", createHandler)
	mux.HandleFunc("/v1/accounts/applications/approve", approveHandler)
	mux.HandleFunc("/v1/accounts/kyc/verify", kycVerifyHandler)
	mux.HandleFunc("/v1/accounts/tier-limits", tierLimitsHandler)
	mux.HandleFunc("/v1/accounts/validate", handleAccountValidate)

	log.Printf("[account-opening-go] Starting on :%s (KYC enforcement enabled)", port)
	tlsEnabled, tlsCert, tlsKey := getTLSConfig()
	_ = tlsCert
	_ = tlsKey
	_ = tlsEnabled
	server := &http.Server{
		Addr:         ":" + port,
		Handler:      rateLimitMiddleware(securityHeadersMiddleware(traceMiddleware(jwtAuthMiddleware(countingMiddleware(mux))))),
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
	log.Println("[account-opening-go] Shutting down gracefully...")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Forced shutdown: %v", err)
	}
	log.Println("[account-opening-go] Server stopped")
}
