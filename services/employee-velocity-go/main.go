// 54Bank Employee Velocity Limits — Go
// All state persisted to PostgreSQL. No in-memory maps.
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
	Role           string `json:"role"`
	MaxTxnPerHour  int    `json:"max_txn_per_hour"`
	MaxAmountPerHour int64 `json:"max_amount_per_hour_kobo"`
	AlertThreshold float64 `json:"alert_threshold_pct"`
}

type VelocityTransaction struct {
	Timestamp  time.Time `json:"timestamp"`
	AmountKobo int64     `json:"amount_kobo"`
	TxnType    string    `json:"txn_type"`
}

type EmployeeWindow struct {
	EmployeeID   string                `json:"employee_id"`
	Role         string                `json:"role"`
	Transactions []VelocityTransaction `json:"transactions"`
	LastUpdated  time.Time             `json:"last_updated"`
}

var (
	mu    sync.RWMutex
	rules = map[string]*VelocityRule{
		"teller":       {Role: "teller", MaxTxnPerHour: 50, MaxAmountPerHour: 50_000_000_00, AlertThreshold: 0.85},
		"senior_teller": {Role: "senior_teller", MaxTxnPerHour: 80, MaxAmountPerHour: 200_000_000_00, AlertThreshold: 0.85},
		"supervisor":   {Role: "supervisor", MaxTxnPerHour: 100, MaxAmountPerHour: 500_000_000_00, AlertThreshold: 0.90},
	}
	db           *sql.DB
	blockedCount uint64
)

func initSchema() {
	if db == nil { return }
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	for _, q := range []string{
		`CREATE TABLE IF NOT EXISTS velocity_windows (
			employee_id TEXT PRIMARY KEY, role TEXT NOT NULL,
			transactions JSONB DEFAULT '[]', last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
		`CREATE TABLE IF NOT EXISTS velocity_checks (
			id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, amount_kobo BIGINT,
			txn_type TEXT, allowed BOOLEAN, violations JSONB DEFAULT '[]',
			risk_score FLOAT DEFAULT 0, checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
		`CREATE INDEX IF NOT EXISTS idx_vel_checks_emp ON velocity_checks(employee_id)`,
		`CREATE INDEX IF NOT EXISTS idx_vel_checks_time ON velocity_checks(checked_at)`,
	} {
		if _, err := db.ExecContext(ctx, q); err != nil {
			log.Printf("[velocity] schema: %v", err)
		}
	}
	log.Println("[velocity] PostgreSQL schema initialized")
}

func dbLoadWindow(employeeID string) *EmployeeWindow {
	if db == nil { return nil }
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	row := db.QueryRowContext(ctx, `SELECT employee_id, role, transactions, last_updated FROM velocity_windows WHERE employee_id=$1`, employeeID)
	var w EmployeeWindow
	var txnsJSON string
	if err := row.Scan(&w.EmployeeID, &w.Role, &txnsJSON, &w.LastUpdated); err != nil {
		return nil
	}
	json.Unmarshal([]byte(txnsJSON), &w.Transactions)
	return &w
}

func dbSaveWindow(w *EmployeeWindow) {
	if db == nil { return }
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	txnsJSON, _ := json.Marshal(w.Transactions)
	db.ExecContext(ctx, `INSERT INTO velocity_windows (employee_id, role, transactions, last_updated) VALUES ($1,$2,$3,$4)
		ON CONFLICT (employee_id) DO UPDATE SET role=EXCLUDED.role, transactions=EXCLUDED.transactions, last_updated=EXCLUDED.last_updated`,
		w.EmployeeID, w.Role, string(txnsJSON), w.LastUpdated)
}

func dbSaveCheck(id, employeeID string, amountKobo int64, txnType string, allowed bool, violations []string, riskScore float64) {
	if db == nil { return }
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	violJSON, _ := json.Marshal(violations)
	db.ExecContext(ctx, `INSERT INTO velocity_checks (id, employee_id, amount_kobo, txn_type, allowed, violations, risk_score) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		id, employeeID, amountKobo, txnType, allowed, string(violJSON), riskScore)
}

func dbListWindows() []*EmployeeWindow {
	if db == nil { return nil }
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	rows, err := db.QueryContext(ctx, `SELECT employee_id, role, transactions, last_updated FROM velocity_windows ORDER BY last_updated DESC LIMIT 1000`)
	if err != nil { return nil }
	defer rows.Close()
	var result []*EmployeeWindow
	for rows.Next() {
		var w EmployeeWindow
		var txnsJSON string
		if rows.Scan(&w.EmployeeID, &w.Role, &txnsJSON, &w.LastUpdated) != nil { continue }
		json.Unmarshal([]byte(txnsJSON), &w.Transactions)
		result = append(result, &w)
	}
	return result
}

func checkVelocity(employeeID, role string, amountKobo int64, txnType string) (bool, []string, float64) {
	mu.Lock()
	defer mu.Unlock()

	rule, ok := rules[role]
	if !ok { rule = rules["teller"] }

	window := dbLoadWindow(employeeID)
	if window == nil {
		window = &EmployeeWindow{EmployeeID: employeeID, Role: role, Transactions: make([]VelocityTransaction, 0)}
	}

	now := time.Now()
	cutoff := now.Add(-1 * time.Hour)
	var recent []VelocityTransaction
	for _, t := range window.Transactions {
		if t.Timestamp.After(cutoff) { recent = append(recent, t) }
	}
	window.Transactions = recent

	var totalAmount int64
	for _, t := range recent { totalAmount += t.AmountKobo }

	txnCount := len(recent) + 1
	newTotal := totalAmount + amountKobo
	var violations []string
	var riskScore float64

	countRatio := float64(txnCount) / float64(rule.MaxTxnPerHour)
	amountRatio := float64(newTotal) / float64(rule.MaxAmountPerHour)

	if countRatio > 1.0 { violations = append(violations, fmt.Sprintf("txn_count_exceeded: %d/%d per hour", txnCount, rule.MaxTxnPerHour)) }
	if amountRatio > 1.0 { violations = append(violations, fmt.Sprintf("amount_exceeded: %d/%d kobo per hour", newTotal, rule.MaxAmountPerHour)) }
	if countRatio >= rule.AlertThreshold { riskScore = countRatio }
	if amountRatio >= rule.AlertThreshold && amountRatio > riskScore { riskScore = amountRatio }

	allowed := len(violations) == 0

	if allowed {
		window.Transactions = append(window.Transactions, VelocityTransaction{Timestamp: now, AmountKobo: amountKobo, TxnType: txnType})
	} else {
		atomic.AddUint64(&blockedCount, 1)
		eventBus.Emit("velocity.limit.exceeded", map[string]interface{}{
			"employee_id": employeeID, "role": role, "txn_count": txnCount,
			"total_amount_kobo": newTotal, "violations": violations,
		})
	}

	window.LastUpdated = now
	dbSaveWindow(window)
	checkID := fmt.Sprintf("VEL-%s", secureRandHex(8))
	dbSaveCheck(checkID, employeeID, amountKobo, txnType, allowed, violations, riskScore)

	return allowed, violations, riskScore
}

func handleCheckVelocity(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { http.Error(w, "method not allowed", 405); return }
	var body struct {
		EmployeeID string `json:"employee_id"`; Role string `json:"role"`
		AmountKobo int64  `json:"amount_kobo"`; TxnType string `json:"txn_type"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil { http.Error(w, "invalid JSON", 400); return }
	allowed, violations, riskScore := checkVelocity(body.EmployeeID, body.Role, body.AmountKobo, body.TxnType)
	status := 200
	if !allowed { status = 429 }
	w.Header().Set("Content-Type", "application/json"); w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"allowed": allowed, "violations": violations, "risk_score": riskScore,
		"employee_id": body.EmployeeID, "role": body.Role,
	})
}

func handleListWindows(w http.ResponseWriter, r *http.Request) {
	result := dbListWindows()
	if result == nil { result = make([]*EmployeeWindow, 0) }
	w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(result)
}

func handleListRules(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(rules)
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	windows := dbListWindows()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"tracked_employees": len(windows), "blocked_count": atomic.LoadUint64(&blockedCount),
		"rules": len(rules), "uptime_seconds": int(time.Since(startTime).Seconds()),
	})
}

var healthyFlag int32 = 1; var lastActivity int64
func healthzHandler(w http.ResponseWriter, r *http.Request) { w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(map[string]interface{}{"status": "healthy", "service": serviceName}) }
func livezHandler(w http.ResponseWriter, r *http.Request) { w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(map[string]string{"status": "alive"}) }
func readyzHandler(w http.ResponseWriter, r *http.Request) {
	if db == nil { w.WriteHeader(503); json.NewEncoder(w).Encode(map[string]string{"status": "not_ready"}); return }
	w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
}
func startWatchdog() { atomic.StoreInt64(&lastActivity, time.Now().Unix()); go func() { for { time.Sleep(15*time.Second); if time.Now().Unix()-atomic.LoadInt64(&lastActivity) > 60 { atomic.StoreInt32(&healthyFlag, 0) } else { atomic.StoreInt32(&healthyFlag, 1) } } }() }
func recordActivity() { atomic.StoreInt64(&lastActivity, time.Now().Unix()) }
type EventBusImpl struct { topic, source string; mu sync.Mutex; events []map[string]interface{} }
func newEventBus(topic, source string) *EventBusImpl { return &EventBusImpl{topic: topic, source: source, events: make([]map[string]interface{}, 0)} }
func (eb *EventBusImpl) Emit(eventType string, payload map[string]interface{}) { eb.mu.Lock(); defer eb.mu.Unlock(); eb.events = append(eb.events, map[string]interface{}{"event_type": eventType, "source": eb.source, "topic": eb.topic, "timestamp": time.Now().Format(time.RFC3339), "payload": payload}); log.Printf("[EventBus] %s -> %s", eb.topic, eventType) }
func loggingMW(next http.Handler) http.Handler { return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { recordActivity(); start := time.Now(); next.ServeHTTP(w, r); log.Printf("[%s] %s %s %s", serviceName, r.Method, r.URL.Path, time.Since(start)) }) }
func rateLimitMW(next http.Handler) http.Handler { return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { acquireSem(); defer releaseSem(); next.ServeHTTP(w, r) }) }
func panicMW(next http.Handler) http.Handler { return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { defer func() { if err := recover(); err != nil { log.Printf("[PANIC] %v", err); http.Error(w, "internal error", 500) } }(); next.ServeHTTP(w, r) }) }

func main() {
	port := os.Getenv("PORT"); if port == "" { port = "8080" }
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL != "" {
		var err error; db, err = sql.Open("postgres", dbURL)
		if err != nil { log.Printf("[velocity] DB: %v", err)
		} else {
			db.SetMaxOpenConns(25); db.SetMaxIdleConns(5); db.SetConnMaxLifetime(5*time.Minute)
			if err := db.Ping(); err != nil { log.Printf("[velocity] DB ping: %v", err) } else { initSchema() }
		}
	} else { log.Println("[velocity] WARNING: DATABASE_URL not set") }
	startWatchdog()
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthzHandler); mux.HandleFunc("/livez", livezHandler); mux.HandleFunc("/readyz", readyzHandler)
	mux.HandleFunc("/api/v1/velocity/check", handleCheckVelocity)
	mux.HandleFunc("/api/v1/velocity/windows", handleListWindows)
	mux.HandleFunc("/api/v1/velocity/rules", handleListRules)
	mux.HandleFunc("/api/v1/velocity/stats", handleStats)
	handler := panicMW(rateLimitMW(loggingMW(mux)))
	srv := &http.Server{Addr: ":" + port, Handler: handler, ReadTimeout: 30 * time.Second, WriteTimeout: 30 * time.Second}
	go func() { log.Printf("[velocity] Starting on :%s", port); if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed { log.Fatal(err) } }()
	quit := make(chan os.Signal, 1); signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM); <-quit
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second); defer cancel(); srv.Shutdown(ctx)
}
