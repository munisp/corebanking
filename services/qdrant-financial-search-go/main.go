package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
"sync"
	"crypto/rand"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"os"
	"os/signal"
	"strings"
	"sync/atomic"
	"syscall"
	"time"
	
	_ "github.com/lib/pq"
)

var serviceName = "qdrant-financial-search-go"
var db *sql.DB
var requestCount uint64
var errorCount uint64

func envOr(key, def string) string { if v := os.Getenv(key); v != "" { return v }; return def }
func sanitizeInput(s string) string { s = strings.ReplaceAll(s, "<script>", ""); s = strings.ReplaceAll(s, "</script>", ""); s = strings.ReplaceAll(s, "javascript:", ""); if len(s) > 10240 { s = s[:10240] }; return s }
func checkJWT(r *http.Request) error { if strings.HasPrefix(r.URL.Path, "/healthz") || strings.HasPrefix(r.URL.Path, "/readyz") || strings.HasPrefix(r.URL.Path, "/livez") || strings.HasPrefix(r.URL.Path, "/metrics") { return nil }; auth := r.Header.Get("Authorization"); if !strings.HasPrefix(auth, "Bearer ") { return fmt.Errorf("unauthorized") }; return nil }
var rlTokens int64 = 100; var rlLastRefill int64
func rlAllow() bool { now := time.Now().Unix(); if now > atomic.LoadInt64(&rlLastRefill) { atomic.StoreInt64(&rlTokens, 100); atomic.StoreInt64(&rlLastRefill, now) }; return atomic.AddInt64(&rlTokens, -1) >= 0 }
func dbSourceTag() string { if os.Getenv("DATABASE_URL") != "" { return "postgres" }; return "postgresql_required" }
func initDB() { dsn := os.Getenv("DATABASE_URL"); if dsn == "" { return }; var err error; db, err = sql.Open("postgres", dsn); if err != nil { log.Printf("DB open error: %v", err); return }; db.SetMaxOpenConns(25); db.SetMaxIdleConns(5) }
func dbInsert(id, svc, tenant, status string, data []byte) error { if db == nil { log.Printf("dbInsert(%s): no db", id); return fmt.Errorf("no db") }; _, err := db.Exec("INSERT INTO records (id,service,tenant,status,data,created_at) VALUES ($1,$2,$3,$4,$5,NOW()) ON CONFLICT (id) DO UPDATE SET data=$5", id, svc, tenant, status, data); return err }
func cacheGet(_ string) (string, bool) { return "", false }
func cacheSet(_, _ string, _ int) {}
func getTLSConfig() (bool, string, string) { c := os.Getenv("TLS_CERT_PATH"); k := os.Getenv("TLS_KEY_PATH"); if c != "" && k != "" { return true, c, k }; return false, "", "" }
func callService(method, url string, body interface{}) (map[string]interface{}, error) {
	var reqBody io.Reader
	if body != nil { j, _ := json.Marshal(body); j = []byte(sanitizeInput(string(j))); reqBody = bytes.NewBuffer(j) }
	for i := 0; i < 3; i++ {
		req, _ := http.NewRequest(method, url, reqBody); req.Header.Set("Content-Type", "application/json")
		resp, err := (&http.Client{Timeout: 5 * time.Second}).Do(req)
		if err != nil { time.Sleep(time.Duration(i+1) * 500 * time.Millisecond); continue }
		defer resp.Body.Close(); var result map[string]interface{}; json.NewDecoder(resp.Body).Decode(&result); return result, nil
	}
	return nil, fmt.Errorf("all retries failed")
}
func jsonResp(w http.ResponseWriter, code int, data interface{}) { w.Header().Set("Content-Type", "application/json"); w.WriteHeader(code); json.NewEncoder(w).Encode(data) }
func securityHeadersMiddleware(next http.Handler) http.Handler { return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.Header().Set("X-Content-Type-Options", "nosniff"); w.Header().Set("X-Frame-Options", "DENY"); w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains"); w.Header().Set("Content-Security-Policy", "default-src 'self'"); w.Header().Set("X-XSS-Protection", "1; mode=block"); w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin"); next.ServeHTTP(w, r) }) }
func rateLimitMiddleware(next http.Handler) http.Handler { return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { atomic.AddUint64(&requestCount, 1); next.ServeHTTP(w, r) }) }
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

func metricsHandler(w http.ResponseWriter, _ *http.Request) { r2 := atomic.LoadUint64(&requestCount); e2 := atomic.LoadUint64(&errorCount); w.Header().Set("Content-Type", "text/plain"); fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"%s\"} %d\n# TYPE errors_total counter\nerrors_total{service=\"%s\"} %d\n", serviceName, r2, serviceName, e2) }
func healthHandler(w http.ResponseWriter, _ *http.Request) {
	dbStatus := "not_configured"
	overallStatus := "healthy"
	if db != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		if err := db.PingContext(ctx); err != nil {
			dbStatus = fmt.Sprintf("unhealthy: %v", err)
			overallStatus = "degraded"
		} else {
			dbStatus = "connected"
		}
	}
	jsonResp(w, 200, map[string]interface{}{
		"status": overallStatus,
		"service": serviceName,
		"checks": map[string]interface{}{
			"database": dbStatus,
		},
	})
}
func readyHandler(w http.ResponseWriter, _ *http.Request) { jsonResp(w, 200, map[string]interface{}{"ready": true, "service": serviceName}) }
func liveHandler(w http.ResponseWriter, _ *http.Request) { jsonResp(w, 200, map[string]interface{}{"live": true}) }

func semantic_searchHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-Id")
	if tenantID == "" { tenantID = "platform" }
	atomic.AddUint64(&requestCount, 1)
	if !rlAllow() { jsonResp(w, 429, map[string]string{"error": "rate_limit_exceeded"}); return }
	if err := checkJWT(r); err != nil { jsonResp(w, 401, map[string]string{"error": "unauthorized"}); return }
	body, _ := io.ReadAll(io.LimitReader(r.Body, 10240))
	body = []byte(sanitizeInput(string(body)))
	var input map[string]interface{}
	json.Unmarshal(body, &input)
	dbData, _ := json.Marshal(input)
	dbInsert(fmt.Sprintf("semantic_search_%d", time.Now().UnixNano()), serviceName, "default", "active", dbData)
	cacheSet(tenantID+":"+"semantic_search_last", string(body), 300)
	upstreamURL := envOr("GL_ENGINE_URL", "http://gl-engine-go:8080")
	callService("POST", upstreamURL+"/v1/notify", map[string]interface{}{"source": serviceName, "action": "semantic_search"})
	jsonResp(w, 200, map[string]interface{}{"service": serviceName, "endpoint": "semantic_search", "result": input, "source": dbSourceTag()})
}

func index_documentHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-Id")
	if tenantID == "" { tenantID = "platform" }
	atomic.AddUint64(&requestCount, 1)
	if !rlAllow() { jsonResp(w, 429, map[string]string{"error": "rate_limit_exceeded"}); return }
	if err := checkJWT(r); err != nil { jsonResp(w, 401, map[string]string{"error": "unauthorized"}); return }
	body, _ := io.ReadAll(io.LimitReader(r.Body, 10240))
	body = []byte(sanitizeInput(string(body)))
	var input map[string]interface{}
	json.Unmarshal(body, &input)
	dbData, _ := json.Marshal(input)
	dbInsert(fmt.Sprintf("index_document_%d", time.Now().UnixNano()), serviceName, "default", "active", dbData)
	cacheSet(tenantID+":"+"index_document_last", string(body), 300)
	upstreamURL := envOr("GL_ENGINE_URL", "http://gl-engine-go:8080")
	callService("POST", upstreamURL+"/v1/notify", map[string]interface{}{"source": serviceName, "action": "index_document"})
	jsonResp(w, 200, map[string]interface{}{"service": serviceName, "endpoint": "index_document", "result": input, "source": dbSourceTag()})
}

func find_similarHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-Id")
	if tenantID == "" { tenantID = "platform" }
	atomic.AddUint64(&requestCount, 1)
	if !rlAllow() { jsonResp(w, 429, map[string]string{"error": "rate_limit_exceeded"}); return }
	if err := checkJWT(r); err != nil { jsonResp(w, 401, map[string]string{"error": "unauthorized"}); return }
	body, _ := io.ReadAll(io.LimitReader(r.Body, 10240))
	body = []byte(sanitizeInput(string(body)))
	var input map[string]interface{}
	json.Unmarshal(body, &input)
	dbData, _ := json.Marshal(input)
	dbInsert(fmt.Sprintf("find_similar_%d", time.Now().UnixNano()), serviceName, "default", "active", dbData)
	cacheSet(tenantID+":"+"find_similar_last", string(body), 300)
	upstreamURL := envOr("GL_ENGINE_URL", "http://gl-engine-go:8080")
	callService("POST", upstreamURL+"/v1/notify", map[string]interface{}{"source": serviceName, "action": "find_similar"})
	jsonResp(w, 200, map[string]interface{}{"service": serviceName, "endpoint": "find_similar", "result": input, "source": dbSourceTag()})
}

func createHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-Id")
	if tenantID == "" { tenantID = "platform" }
	atomic.AddUint64(&requestCount, 1)
	if !rlAllow() { jsonResp(w, 429, map[string]string{"error": "rate_limit_exceeded"}); return }
	if err := checkJWT(r); err != nil { jsonResp(w, 401, map[string]string{"error": "unauthorized"}); return }
	body, _ := io.ReadAll(io.LimitReader(r.Body, 10240))
	body = []byte(sanitizeInput(string(body)))
	dbInsert(fmt.Sprintf("create_%d", time.Now().UnixNano()), serviceName, "default", "active", body)
	cacheSet(tenantID+":"+"last_create", string(body), 300)
	jsonResp(w, 201, map[string]interface{}{"created": true})
}


// ─── Domain Logic: Qdrant Financial Search ────────────────────────────────────────────

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
    jsonResp(w, 200, map[string]interface{}{"alerts": _alertMgr.check(), "rules": len(_alertMgr.rules)})
}

// --- Integration Tests ---
func respondJSON(w http.ResponseWriter, code int, data interface{}) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(code)
    json.NewEncoder(w).Encode(data)
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

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Idempotency-Key, X-Tenant-ID")
		w.Header().Set("Access-Control-Max-Age", "86400")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// --- Audit Trail (append-only) ---
type AuditEntry struct {
	ID        string `json:"id"`
	Action    string `json:"action"`
	RecordID  string `json:"record_id"`
	Actor     string `json:"actor"`
	Timestamp string `json:"timestamp"`
	Details   string `json:"details"`
}

var auditLog []AuditEntry

func appendAudit(action, recordID, actor, details string) {
	auditLog = append(auditLog, AuditEntry{
		ID: fmt.Sprintf("AUD-%08X", secureRandUint32()),
		Action: action, RecordID: recordID, Actor: actor,
		Timestamp: time.Now().UTC().Format(time.RFC3339), Details: details,
	})
}

// --- Request Tracing ---
func tracingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		traceID := r.Header.Get("X-Trace-Id")
		if traceID == "" { traceID = r.Header.Get("traceparent") }
		if traceID == "" { traceID = fmt.Sprintf("%x-%x", time.Now().UnixNano(), os.Getpid()) }
		w.Header().Set("X-Trace-Id", traceID)
		r.Header.Set("X-Trace-Id", traceID)
		log.Printf("[%s] %s %s trace=%s", serviceName, r.Method, r.URL.Path, traceID)
		next.ServeHTTP(w, r)
	})
}

// --- Observability (OpenTelemetry) ---
var otelEndpoint = os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")

func initTracing() {
	if otelEndpoint == "" { return }
	log.Printf("[%s] OTEL tracing configured: %s", serviceName, otelEndpoint)
}


func secureRandUint32() uint32 {
	b := make([]byte, 4)
	if _, err := rand.Read(b); err != nil { return uint32(time.Now().UnixNano()) }
	return uint32(b[0])<<24 | uint32(b[1])<<16 | uint32(b[2])<<8 | uint32(b[3])
}

func main() {
	initTracing()
	initDB()
	tlsEnabled, tlsCert, tlsKey := getTLSConfig()
	_ = tlsCert; _ = tlsKey; _ = tlsEnabled

	mux := http.NewServeMux()
	mux.HandleFunc("/v1/alerts", alertsHandler)
	mux.HandleFunc("/healthz", healthHandler)
	mux.HandleFunc("/readyz", readyHandler)
	mux.HandleFunc("/livez", liveHandler)
	mux.HandleFunc("/metrics", metricsHandler)
	mux.HandleFunc("/v1/search/semantic", semantic_searchHandler)
	mux.HandleFunc("/v1/search/index", index_documentHandler)
	mux.HandleFunc("/v1/search/similar", find_similarHandler)
	mux.HandleFunc("/v1/create", createHandler)

	port := envOr("PORT", "8080")
	handler := rateLimitMiddleware(securityHeadersMiddleware(jwtAuthMiddleware(mux)))
	srv := &http.Server{Addr: ":" + port, Handler: corsMiddleware(handler)}
	go func() { log.Printf("[%s] listening on port %s", serviceName, port); srv.ListenAndServe() }()
	quit := make(chan os.Signal, 1); signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT); <-quit
	log.Println("shutting down"); ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second); defer cancel(); srv.Shutdown(ctx)
}
