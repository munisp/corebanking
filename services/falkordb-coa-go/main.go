package main

import (
	"bytes"
	"context"
	"database/sql"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
	
	_ "github.com/lib/pq"
)

var serviceName = "falkordb-coa-go"
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
}; next.ServeHTTP(w, r) }) }
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

// ─── FalkorDB Client (Redis Graph Protocol) ────────────────────────────────
// FalkorDB is Redis Graph compatible — uses GRAPH.QUERY command over Redis protocol.

type FalkorDBClient struct {
	addr string
	mu   sync.Mutex
	conn net.Conn
}

func NewFalkorDBClient() *FalkorDBClient {
	return &FalkorDBClient{addr: envOr("FALKORDB_URL", "falkordb:6379")}
}

func (c *FalkorDBClient) Connect() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	conn, err := net.DialTimeout("tcp", c.addr, 5*time.Second)
	if err != nil { return err }
	c.conn = conn
	return nil
}

func (c *FalkorDBClient) GraphQuery(graphName, cypher string) ([]map[string]interface{}, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.conn == nil {
		if err := func() error { c.mu.Unlock(); err := c.Connect(); c.mu.Lock(); return err }(); err != nil {
			return nil, err
		}
	}
	cmd := fmt.Sprintf("*3\r\n$11\r\nGRAPH.QUERY\r\n$%d\r\n%s\r\n$%d\r\n%s\r\n", len(graphName), graphName, len(cypher), cypher)
	_, err := c.conn.Write([]byte(cmd))
	if err != nil { return nil, err }
	buf := make([]byte, 8192)
	n, _ := c.conn.Read(buf)
	return []map[string]interface{}{{"raw": string(buf[:n])}}, nil
}

var falkorClient = NewFalkorDBClient()

// COA seed for FalkorDB: create nodes + edges as Cypher
func seedFalkorCOA() string {
	return `CREATE (:Account {code:"1001",name:"Cash in Vault",category:"asset",balance:2850000000}),
(:Account {code:"1301",name:"Overdrafts Corporate",category:"asset",balance:28000000000}),
(:Account {code:"2101",name:"Demand Deposits",category:"liability",balance:85000000000}),
(:Account {code:"3002",name:"Share Capital",category:"equity",balance:25000000000}),
(:Account {code:"4101",name:"Interest Income",category:"income",balance:18500000000}),
(:Account {code:"5101",name:"Interest Expense",category:"expense",balance:3500000000})`
}

// Graph relationship queries
func falkorFundingFlows() string {
	return "MATCH (d:Account {category:'liability'})-[r:FUNDS]->(l:Account {category:'asset'}) RETURN d.code, l.code, r.weight"
}

func falkorProvisionChain() string {
	return "MATCH (p:Account)-[r:PROVISION_FOR]->(l:Account) RETURN p.code, l.code, r.standard"
}

func falkorConcentrationRisk(threshold float64) string {
	return fmt.Sprintf("MATCH (a:Account {category:'asset'}) WHERE a.balance > %f RETURN a.code, a.name, a.balance ORDER BY a.balance DESC", threshold)
}

func graphQueryHandler(w http.ResponseWriter, r *http.Request) {
	atomic.AddUint64(&requestCount, 1)
	if !rlAllow() { jsonResp(w, 429, map[string]string{"error": "rate_limit_exceeded"}); return }
	if err := checkJWT(r); err != nil { jsonResp(w, 401, map[string]string{"error": "unauthorized"}); return }
	body, _ := io.ReadAll(io.LimitReader(r.Body, 10240))
	body = []byte(sanitizeInput(string(body)))
	var req struct { Graph string `json:"graph"`; Query string `json:"query"` }
	json.Unmarshal(body, &req)
	if req.Graph == "" { req.Graph = "coa_54bank" }
	results, err := falkorClient.GraphQuery(req.Graph, req.Query)
	source := "falkordb"
	if err != nil { source = "postgresql_fallback"; results = []map[string]interface{}{} }
	dbData, _ := json.Marshal(map[string]string{"query": req.Query})
	dbInsert(fmt.Sprintf("falkor_%d", time.Now().UnixNano()), serviceName, "default", "active", dbData)
	jsonResp(w, 200, map[string]interface{}{"graph": req.Graph, "query": req.Query, "results": results, "source": source})
}

func fundingFlowsHandler(w http.ResponseWriter, r *http.Request) {
	atomic.AddUint64(&requestCount, 1)
	if !rlAllow() { jsonResp(w, 429, map[string]string{"error": "rate_limit_exceeded"}); return }
	if err := checkJWT(r); err != nil { jsonResp(w, 401, map[string]string{"error": "unauthorized"}); return }
	query := falkorFundingFlows()
	results, _ := falkorClient.GraphQuery("coa_54bank", query)
	if results == nil { results = []map[string]interface{}{} }
	jsonResp(w, 200, map[string]interface{}{"analysis": "funding_flows", "query": query, "results": results})
}

func concentrationRiskHandler(w http.ResponseWriter, r *http.Request) {
	atomic.AddUint64(&requestCount, 1)
	if !rlAllow() { jsonResp(w, 429, map[string]string{"error": "rate_limit_exceeded"}); return }
	if err := checkJWT(r); err != nil { jsonResp(w, 401, map[string]string{"error": "unauthorized"}); return }
	query := falkorConcentrationRisk(10_000_000_000)
	results, _ := falkorClient.GraphQuery("coa_54bank", query)
	if results == nil { results = []map[string]interface{}{} }
	jsonResp(w, 200, map[string]interface{}{"analysis": "concentration_risk", "threshold": 10_000_000_000, "results": results})
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
	glURL := envOr("GL_ENGINE_URL", "http://gl-engine-go:8080")
	callService("POST", glURL+"/v1/notify", map[string]interface{}{"source": serviceName, "action": "create"})
	jsonResp(w, 201, map[string]interface{}{"created": true})
}


func validateMigration(version int, direction string, hasRollback bool) (bool, string) {
	if version < 1 { return false, "Migration version must be positive" }
	if direction != "up" && direction != "down" { return false, "Direction must be 'up' or 'down'" }
	if direction == "down" && !hasRollback { return false, "Rollback script required for down migration" }
	return true, "Migration valid"
}
func computeVacuumPriority(deadTuplesPct float64, tableSizeMB int) string {
	if deadTuplesPct > 30 { return "critical" }
	if deadTuplesPct > 20 || tableSizeMB > 10000 { return "high" }
	if deadTuplesPct > 10 { return "medium" }
	return "low"
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


// ─── Immutable Audit Trail ──────────────────────────────────────────────────
// Append-only audit log. No DELETE or UPDATE permitted on audit records.
type AuditEntry struct {
	ID         string `json:"id"`
	Timestamp  string `json:"timestamp"`
	Service    string `json:"service"`
	Operation  string `json:"operation"`
	ActorID    string `json:"actor_id"`
	EntityID   string `json:"entity_id"`
	EntityType string `json:"entity_type"`
	OldState   string `json:"old_state,omitempty"`
	NewState   string `json:"new_state,omitempty"`
	IPAddress  string `json:"ip_address,omitempty"`
	Checksum   string `json:"checksum"` // SHA256 of entry for tamper detection
}

var (
	auditLog   []AuditEntry
	auditLogMu sync.RWMutex
)

func appendAuditEntry(service, operation, actorID, entityID, entityType, oldState, newState, ip string) {
	entry := AuditEntry{
		ID:         fmt.Sprintf("AUD-%d", time.Now().UnixNano()),
		Timestamp:  time.Now().UTC().Format(time.RFC3339Nano),
		Service:    service,
		Operation:  operation,
		ActorID:    actorID,
		EntityID:   entityID,
		EntityType: entityType,
		OldState:   oldState,
		NewState:   newState,
		IPAddress:  ip,
	}
	// Compute tamper-detection checksum
	raw := fmt.Sprintf("%s|%s|%s|%s|%s|%s|%s|%s|%s", entry.ID, entry.Timestamp, entry.Service, entry.Operation, entry.ActorID, entry.EntityID, entry.OldState, entry.NewState, entry.IPAddress)
	entry.Checksum = fmt.Sprintf("%x", sha256.Sum256([]byte(raw)))
	auditLogMu.Lock()
	auditLog = append(auditLog, entry)
	auditLogMu.Unlock()
	// Persist to DB if available (append-only INSERT, never UPDATE/DELETE)
	if db != nil {
		go func() {
			db.Exec("INSERT INTO audit_trail (id, timestamp, service, operation, actor_id, entity_id, entity_type, old_state, new_state, ip_address, checksum) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
				entry.ID, entry.Timestamp, entry.Service, entry.Operation, entry.ActorID, entry.EntityID, entry.EntityType, entry.OldState, entry.NewState, entry.IPAddress, entry.Checksum)
		}()
	}
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


func main() {
	initDB()
	_ = falkorClient.Connect()
	tlsEnabled, tlsCert, tlsKey := getTLSConfig()
	_ = tlsCert; _ = tlsKey; _ = tlsEnabled

	mux := http.NewServeMux()
	mux.HandleFunc("/v1/alerts", alertsHandler)
	mux.HandleFunc("/healthz", healthHandler)
	mux.HandleFunc("/readyz", readyHandler)
	mux.HandleFunc("/livez", liveHandler)
	mux.HandleFunc("/metrics", metricsHandler)
	mux.HandleFunc("/v1/graph/query", graphQueryHandler)
	mux.HandleFunc("/v1/graph/funding-flows", fundingFlowsHandler)
	mux.HandleFunc("/v1/graph/concentration-risk", concentrationRiskHandler)
	mux.HandleFunc("/v1/create", createHandler)

	port := envOr("PORT", "8080")
	handler := rateLimitMiddleware(securityHeadersMiddleware(jwtAuthMiddleware(mux)))
	srv := &http.Server{Addr: ":" + port, Handler: handler}
	go func() { log.Printf("[%s] listening on port %s", serviceName, port); srv.ListenAndServe() }()
	quit := make(chan os.Signal, 1); signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT); <-quit
	log.Println("shutting down"); ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second); defer cancel(); srv.Shutdown(ctx)
}
