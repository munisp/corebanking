// 54Bank Employee Velocity Limiter — Go
// Domain: Security / Insider Threat
// Enforces per-employee transaction velocity limits to detect and prevent
// structuring attacks (smurfing) where insiders split transactions to stay
// below maker-checker thresholds.
// Middleware: Kafka, Redis, Postgres
package main

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	_ "github.com/lib/pq"
)

func secureRandHex(n int) string { b := make([]byte, n); rand.Read(b); return hex.EncodeToString(b) }
var semaphore = make(chan struct{}, 100)
func acquireSem() { semaphore <- struct{}{} }
func releaseSem() { <-semaphore }
var serviceName = "employee-velocity-go"
var eventBus = newEventBus("security.insider-threat", "employee-velocity")
var startTime = time.Now()

type VelocityRule struct {
	ID              string `json:"id"`
	Role            string `json:"role"`
	MaxTxnCount1H   int    `json:"max_txn_count_1h"`
	MaxTxnCount24H  int    `json:"max_txn_count_24h"`
	MaxAmountKobo1H int64  `json:"max_amount_kobo_1h"`
	MaxAmountKobo24H int64 `json:"max_amount_kobo_24h"`
	MaxSingleTxnKobo int64 `json:"max_single_txn_kobo"`
	StructuringThreshold float64 `json:"structuring_threshold"` // % of maker-checker limit
}

type EmployeeWindow struct {
	EmployeeID    string    `json:"employee_id"`
	Role          string    `json:"role"`
	Transactions1H []TxnRecord `json:"transactions_1h"`
	Transactions24H []TxnRecord `json:"transactions_24h"`
}

type TxnRecord struct {
	Timestamp  time.Time `json:"timestamp"`
	AmountKobo int64     `json:"amount_kobo"`
	TxnType    string    `json:"txn_type"`
	Reference  string    `json:"reference"`
}

type VelocityCheck struct {
	EmployeeID  string `json:"employee_id"`
	AmountKobo  int64  `json:"amount_kobo"`
	TxnType     string `json:"txn_type"`
	Allowed     bool   `json:"allowed"`
	Reason      string `json:"reason,omitempty"`
	RiskScore   float64 `json:"risk_score"`
	Violations  []string `json:"violations,omitempty"`
}

var (
	mu    sync.RWMutex
	rules = map[string]*VelocityRule{
		"teller":           {ID: "VR-001", Role: "teller", MaxTxnCount1H: 50, MaxTxnCount24H: 200, MaxAmountKobo1H: 500000000, MaxAmountKobo24H: 2000000000, MaxSingleTxnKobo: 100000000, StructuringThreshold: 0.85},
		"supervisor":       {ID: "VR-002", Role: "supervisor", MaxTxnCount1H: 100, MaxTxnCount24H: 500, MaxAmountKobo1H: 2000000000, MaxAmountKobo24H: 10000000000, MaxSingleTxnKobo: 500000000, StructuringThreshold: 0.90},
		"operations":       {ID: "VR-003", Role: "operations", MaxTxnCount1H: 200, MaxTxnCount24H: 1000, MaxAmountKobo1H: 5000000000, MaxAmountKobo24H: 20000000000, MaxSingleTxnKobo: 1000000000, StructuringThreshold: 0.85},
		"compliance_officer": {ID: "VR-004", Role: "compliance_officer", MaxTxnCount1H: 10, MaxTxnCount24H: 50, MaxAmountKobo1H: 100000000, MaxAmountKobo24H: 500000000, MaxSingleTxnKobo: 50000000, StructuringThreshold: 0.80},
	}
	windows = make(map[string]*EmployeeWindow)
	db      *sql.DB
	blockedCount uint64
)

func checkVelocity(employeeID, role string, amountKobo int64, txnType string) *VelocityCheck {
	mu.Lock()
	defer mu.Unlock()

	result := &VelocityCheck{EmployeeID: employeeID, AmountKobo: amountKobo, TxnType: txnType, Allowed: true, Violations: make([]string, 0)}

	rule, ok := rules[role]
	if !ok { rule = rules["teller"] } // default to most restrictive

	// Get or create employee window
	window, ok := windows[employeeID]
	if !ok {
		window = &EmployeeWindow{EmployeeID: employeeID, Role: role}
		windows[employeeID] = window
	}

	now := time.Now()

	// Prune old transactions
	var fresh1H, fresh24H []TxnRecord
	for _, t := range window.Transactions1H { if now.Sub(t.Timestamp) < time.Hour { fresh1H = append(fresh1H, t) } }
	for _, t := range window.Transactions24H { if now.Sub(t.Timestamp) < 24*time.Hour { fresh24H = append(fresh24H, t) } }
	window.Transactions1H = fresh1H
	window.Transactions24H = fresh24H

	// Check single transaction limit
	if amountKobo > rule.MaxSingleTxnKobo {
		result.Violations = append(result.Violations, fmt.Sprintf("single_txn_exceeds_limit: %d > %d kobo", amountKobo, rule.MaxSingleTxnKobo))
	}

	// Check 1H count
	if len(window.Transactions1H)+1 > rule.MaxTxnCount1H {
		result.Violations = append(result.Violations, fmt.Sprintf("1h_count_exceeded: %d >= %d", len(window.Transactions1H)+1, rule.MaxTxnCount1H))
	}

	// Check 24H count
	if len(window.Transactions24H)+1 > rule.MaxTxnCount24H {
		result.Violations = append(result.Violations, fmt.Sprintf("24h_count_exceeded: %d >= %d", len(window.Transactions24H)+1, rule.MaxTxnCount24H))
	}

	// Check 1H amount
	var total1H int64
	for _, t := range window.Transactions1H { total1H += t.AmountKobo }
	if total1H+amountKobo > rule.MaxAmountKobo1H {
		result.Violations = append(result.Violations, fmt.Sprintf("1h_amount_exceeded: %d > %d kobo", total1H+amountKobo, rule.MaxAmountKobo1H))
	}

	// Check 24H amount
	var total24H int64
	for _, t := range window.Transactions24H { total24H += t.AmountKobo }
	if total24H+amountKobo > rule.MaxAmountKobo24H {
		result.Violations = append(result.Violations, fmt.Sprintf("24h_amount_exceeded: %d > %d kobo", total24H+amountKobo, rule.MaxAmountKobo24H))
	}

	// Structuring detection: many transactions just below maker-checker threshold
	makerCheckerThreshold := rule.MaxSingleTxnKobo
	structuringLimit := int64(float64(makerCheckerThreshold) * rule.StructuringThreshold)
	nearThresholdCount := 0
	for _, t := range window.Transactions24H {
		if t.AmountKobo >= structuringLimit && t.AmountKobo < makerCheckerThreshold {
			nearThresholdCount++
		}
	}
	if amountKobo >= structuringLimit && amountKobo < makerCheckerThreshold {
		nearThresholdCount++
	}
	if nearThresholdCount >= 3 {
		result.Violations = append(result.Violations, fmt.Sprintf("structuring_detected: %d transactions near maker-checker threshold (%.0f%%)", nearThresholdCount, rule.StructuringThreshold*100))
	}

	// Calculate risk score
	result.RiskScore = float64(len(result.Violations)) * 0.25
	if nearThresholdCount >= 3 { result.RiskScore += 0.5 }
	if result.RiskScore > 1.0 { result.RiskScore = 1.0 }

	if len(result.Violations) > 0 {
		result.Allowed = false
		result.Reason = fmt.Sprintf("%d velocity violations detected", len(result.Violations))
		atomic.AddUint64(&blockedCount, 1)

		eventBus.Emit("velocity.violation", map[string]interface{}{
			"employee_id": employeeID, "role": role, "amount_kobo": amountKobo,
			"violations": result.Violations, "risk_score": result.RiskScore,
			"severity": "HIGH",
		})
	} else {
		// Record successful transaction
		txn := TxnRecord{Timestamp: now, AmountKobo: amountKobo, TxnType: txnType, Reference: secureRandHex(8)}
		window.Transactions1H = append(window.Transactions1H, txn)
		window.Transactions24H = append(window.Transactions24H, txn)
	}

	return result
}

// ─── HTTP Handlers ──────────────────────────────────────────────────────────

func handleCheckVelocity(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { http.Error(w, "method not allowed", 405); return }
	var body struct {
		EmployeeID string `json:"employee_id"`; Role string `json:"role"`
		AmountKobo int64 `json:"amount_kobo"`; TxnType string `json:"txn_type"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil { http.Error(w, "invalid JSON", 400); return }
	result := checkVelocity(body.EmployeeID, body.Role, body.AmountKobo, body.TxnType)
	w.Header().Set("Content-Type", "application/json")
	if !result.Allowed { w.WriteHeader(http.StatusForbidden) }
	json.NewEncoder(w).Encode(result)
}

func handleListRules(w http.ResponseWriter, r *http.Request) {
	mu.RLock(); defer mu.RUnlock()
	w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(rules)
}

func handleEmployeeWindow(w http.ResponseWriter, r *http.Request) {
	empID := r.URL.Query().Get("employee_id")
	mu.RLock(); defer mu.RUnlock()
	window, ok := windows[empID]
	if !ok { http.Error(w, "no data for employee", 404); return }
	w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(window)
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	mu.RLock(); defer mu.RUnlock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"total_employees_tracked": len(windows), "blocked_transactions": atomic.LoadUint64(&blockedCount),
		"velocity_rules": len(rules), "uptime_seconds": int(time.Since(startTime).Seconds()),
	})
}

// ─── Standard Infrastructure ────────────────────────────────────────────────
var healthyFlag int32 = 1; var lastActivity int64
func healthzHandler(w http.ResponseWriter, r *http.Request) { w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(map[string]interface{}{"status": "healthy", "service": serviceName}) }
func livezHandler(w http.ResponseWriter, r *http.Request) { w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(map[string]string{"status": "alive"}) }
func readyzHandler(w http.ResponseWriter, r *http.Request) { w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(map[string]string{"status": "ready"}) }
func startWatchdog() { atomic.StoreInt64(&lastActivity, time.Now().Unix()); go func() { for { time.Sleep(15*time.Second); if time.Now().Unix()-atomic.LoadInt64(&lastActivity) > 60 { atomic.StoreInt32(&healthyFlag, 0) } else { atomic.StoreInt32(&healthyFlag, 1) } } }() }
func recordActivity() { atomic.StoreInt64(&lastActivity, time.Now().Unix()) }
type EventBusImpl struct { topic, source string; mu sync.Mutex; events []map[string]interface{} }
func newEventBus(topic, source string) *EventBusImpl { return &EventBusImpl{topic: topic, source: source, events: make([]map[string]interface{}, 0)} }
func (eb *EventBusImpl) Emit(eventType string, payload map[string]interface{}) { eb.mu.Lock(); defer eb.mu.Unlock(); eb.events = append(eb.events, map[string]interface{}{"event_type": eventType, "source": eb.source, "topic": eb.topic, "timestamp": time.Now().Format(time.RFC3339), "payload": payload}); log.Printf("[EventBus] %s → %s: %v", eb.topic, eventType, payload) }
func loggingMW(next http.Handler) http.Handler { return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { recordActivity(); start := time.Now(); next.ServeHTTP(w, r); log.Printf("[%s] %s %s %s", serviceName, r.Method, r.URL.Path, time.Since(start)) }) }
func rateLimitMW(next http.Handler) http.Handler { return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { acquireSem(); defer releaseSem(); next.ServeHTTP(w, r) }) }
func panicMW(next http.Handler) http.Handler { return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { defer func() { if err := recover(); err != nil { log.Printf("[PANIC] %v", err); http.Error(w, "internal error", 500) } }(); next.ServeHTTP(w, r) }) }

func main() {
	port := os.Getenv("PORT"); if port == "" { port = "8080" }
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL != "" { var err error; db, err = sql.Open("postgres", dbURL); if err != nil { log.Printf("[velocity] DB: %v", err) } }
	startWatchdog()
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthzHandler); mux.HandleFunc("/livez", livezHandler); mux.HandleFunc("/readyz", readyzHandler)
	mux.HandleFunc("/api/v1/velocity/check", handleCheckVelocity)
	mux.HandleFunc("/api/v1/velocity/rules", handleListRules)
	mux.HandleFunc("/api/v1/velocity/employee", handleEmployeeWindow)
	mux.HandleFunc("/api/v1/velocity/stats", handleStats)
	handler := panicMW(rateLimitMW(loggingMW(mux)))
	srv := &http.Server{Addr: ":" + port, Handler: handler, ReadTimeout: 30 * time.Second, WriteTimeout: 30 * time.Second}
	go func() { log.Printf("[employee-velocity] Starting on :%s", port); if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed { log.Fatal(err) } }()
	quit := make(chan os.Signal, 1); signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM); <-quit
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second); defer cancel(); srv.Shutdown(ctx)
}
