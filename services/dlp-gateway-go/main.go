// 54Bank DLP Gateway — Go
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
var serviceName = "dlp-gateway-go"
var eventBus = newEventBus("security.insider-threat", "dlp-gateway")
var startTime = time.Now()

type DLPRule struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Pattern     string `json:"pattern"`
	MaxRecords  int    `json:"max_records"`
	MaxBytes    int64  `json:"max_bytes"`
	WindowMins  int    `json:"window_minutes"`
	Action      string `json:"action"`
	Severity    string `json:"severity"`
}

type AccessWindow struct {
	ActorID     string    `json:"actor_id"`
	QueryCount  int       `json:"query_count"`
	BytesRead   int64     `json:"bytes_read"`
	RecordsRead int       `json:"records_read"`
	PIIAccess   int       `json:"pii_access"`
	WindowStart time.Time `json:"window_start"`
}

type DLPEvent struct {
	ID         string    `json:"id"`
	RuleID     string    `json:"rule_id"`
	RuleName   string    `json:"rule_name"`
	ActorID    string    `json:"actor_id"`
	ActorIP    string    `json:"actor_ip"`
	Action     string    `json:"action"`
	Details    string    `json:"details"`
	DataVolume int64     `json:"data_volume"`
	RecordCount int      `json:"record_count"`
	Blocked    bool      `json:"blocked"`
	Timestamp  time.Time `json:"timestamp"`
}

var (
	mu    sync.RWMutex
	rules = []*DLPRule{
		{ID: "DLP-001", Name: "Bulk Customer Export", Pattern: "customer_data", MaxRecords: 1000, MaxBytes: 10_000_000, WindowMins: 60, Action: "block", Severity: "critical"},
		{ID: "DLP-002", Name: "PII Mass Access", Pattern: "pii", MaxRecords: 500, MaxBytes: 5_000_000, WindowMins: 30, Action: "block", Severity: "high"},
		{ID: "DLP-003", Name: "Transaction Bulk Download", Pattern: "transaction_export", MaxRecords: 5000, MaxBytes: 50_000_000, WindowMins: 60, Action: "alert", Severity: "medium"},
		{ID: "DLP-004", Name: "Account Number Harvesting", Pattern: "account_numbers", MaxRecords: 200, MaxBytes: 1_000_000, WindowMins: 15, Action: "block", Severity: "critical"},
		{ID: "DLP-005", Name: "Salary Data Access", Pattern: "salary_data", MaxRecords: 100, MaxBytes: 500_000, WindowMins: 60, Action: "block", Severity: "high"},
	}
	db           *sql.DB
	blockedCount uint64
	alertCount   uint64
)

func initSchema() {
	if db == nil { return }
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	for _, q := range []string{
		`CREATE TABLE IF NOT EXISTS dlp_access_windows (
			actor_id TEXT PRIMARY KEY, query_count INT DEFAULT 0,
			bytes_read BIGINT DEFAULT 0, records_read INT DEFAULT 0,
			pii_access INT DEFAULT 0, window_start TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
		`CREATE TABLE IF NOT EXISTS dlp_events (
			id TEXT PRIMARY KEY, rule_id TEXT, rule_name TEXT, actor_id TEXT,
			actor_ip TEXT, action TEXT, details TEXT, data_volume BIGINT,
			record_count INT, blocked BOOLEAN, timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
		`CREATE INDEX IF NOT EXISTS idx_dlp_events_actor ON dlp_events(actor_id)`,
		`CREATE INDEX IF NOT EXISTS idx_dlp_events_time ON dlp_events(timestamp)`,
	} {
		if _, err := db.ExecContext(ctx, q); err != nil {
			log.Printf("[dlp] schema: %v", err)
		}
	}
	log.Println("[dlp] PostgreSQL schema initialized")
}

func dbLoadWindow(actorID string) *AccessWindow {
	if db == nil { return nil }
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	row := db.QueryRowContext(ctx, `SELECT actor_id, query_count, bytes_read, records_read, pii_access, window_start FROM dlp_access_windows WHERE actor_id=$1`, actorID)
	var w AccessWindow
	if err := row.Scan(&w.ActorID, &w.QueryCount, &w.BytesRead, &w.RecordsRead, &w.PIIAccess, &w.WindowStart); err != nil {
		return nil
	}
	return &w
}

func dbSaveWindow(w *AccessWindow) {
	if db == nil { return }
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	db.ExecContext(ctx, `INSERT INTO dlp_access_windows (actor_id, query_count, bytes_read, records_read, pii_access, window_start)
		VALUES ($1,$2,$3,$4,$5,$6)
		ON CONFLICT (actor_id) DO UPDATE SET query_count=EXCLUDED.query_count, bytes_read=EXCLUDED.bytes_read, records_read=EXCLUDED.records_read, pii_access=EXCLUDED.pii_access, window_start=EXCLUDED.window_start`,
		w.ActorID, w.QueryCount, w.BytesRead, w.RecordsRead, w.PIIAccess, w.WindowStart)
}

func dbSaveEvent(e *DLPEvent) {
	if db == nil { return }
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	db.ExecContext(ctx, `INSERT INTO dlp_events (id, rule_id, rule_name, actor_id, actor_ip, action, details, data_volume, record_count, blocked, timestamp) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
		e.ID, e.RuleID, e.RuleName, e.ActorID, e.ActorIP, e.Action, e.Details, e.DataVolume, e.RecordCount, e.Blocked, e.Timestamp)
}

func dbListEvents() []DLPEvent {
	if db == nil { return nil }
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	rows, err := db.QueryContext(ctx, `SELECT id, COALESCE(rule_id,''), COALESCE(rule_name,''), actor_id, COALESCE(actor_ip,''), action, details, data_volume, record_count, blocked, timestamp FROM dlp_events ORDER BY timestamp DESC LIMIT 1000`)
	if err != nil { return nil }
	defer rows.Close()
	var result []DLPEvent
	for rows.Next() {
		var e DLPEvent
		if rows.Scan(&e.ID, &e.RuleID, &e.RuleName, &e.ActorID, &e.ActorIP, &e.Action, &e.Details, &e.DataVolume, &e.RecordCount, &e.Blocked, &e.Timestamp) != nil { continue }
		result = append(result, e)
	}
	return result
}

func checkAccess(actorID, actorIP, dataType string, recordCount int, bytesRequested int64, containsPII bool) (bool, []DLPEvent) {
	mu.Lock()
	defer mu.Unlock()
	now := time.Now()
	window := dbLoadWindow(actorID)
	if window == nil {
		window = &AccessWindow{ActorID: actorID, WindowStart: now}
	}
	if now.Sub(window.WindowStart) > time.Hour { *window = AccessWindow{ActorID: actorID, WindowStart: now} }
	window.QueryCount++
	window.BytesRead += bytesRequested
	window.RecordsRead += recordCount
	if containsPII { window.PIIAccess++ }

	var events []DLPEvent
	blocked := false
	for _, rule := range rules {
		var triggered bool
		var details string
		if window.RecordsRead > rule.MaxRecords {
			triggered = true; details = fmt.Sprintf("Records %d exceed limit %d in window", window.RecordsRead, rule.MaxRecords)
		}
		if window.BytesRead > rule.MaxBytes {
			triggered = true; details = fmt.Sprintf("Bytes %d exceed limit %d in window", window.BytesRead, rule.MaxBytes)
		}
		if triggered {
			isBlocked := rule.Action == "block"
			if isBlocked { blocked = true; atomic.AddUint64(&blockedCount, 1) } else { atomic.AddUint64(&alertCount, 1) }
			evt := DLPEvent{
				ID: fmt.Sprintf("DLP-EVT-%s", secureRandHex(8)), RuleID: rule.ID, RuleName: rule.Name,
				ActorID: actorID, ActorIP: actorIP, Action: rule.Action, Details: details,
				DataVolume: bytesRequested, RecordCount: recordCount, Blocked: isBlocked, Timestamp: now,
			}
			events = append(events, evt)
			dbSaveEvent(&evt)
			eventBus.Emit("dlp.violation", map[string]interface{}{
				"rule": rule.Name, "actor": actorID, "action": rule.Action,
				"records": window.RecordsRead, "bytes": window.BytesRead,
			})
		}
	}
	dbSaveWindow(window)
	return !blocked, events
}

func handleCheckAccess(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { http.Error(w, "method not allowed", 405); return }
	var body struct {
		ActorID string `json:"actor_id"`; DataType string `json:"data_type"`
		RecordCount int `json:"record_count"`; BytesRequested int64 `json:"bytes_requested"`
		ContainsPII bool `json:"contains_pii"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil { http.Error(w, "invalid JSON", 400); return }
	allowed, events := checkAccess(body.ActorID, r.RemoteAddr, body.DataType, body.RecordCount, body.BytesRequested, body.ContainsPII)
	status := 200
	if !allowed { status = 403 }
	w.Header().Set("Content-Type", "application/json"); w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]interface{}{"allowed": allowed, "events": events})
}

func handleListEvents(w http.ResponseWriter, r *http.Request) {
	events := dbListEvents()
	if events == nil { events = make([]DLPEvent, 0) }
	w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(events)
}

func handleListRules(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(rules)
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	events := dbListEvents()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"total_events": len(events), "blocked_count": atomic.LoadUint64(&blockedCount),
		"alert_count": atomic.LoadUint64(&alertCount), "rules": len(rules),
		"uptime_seconds": int(time.Since(startTime).Seconds()),
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
		if err != nil { log.Printf("[dlp] DB: %v", err)
		} else {
			db.SetMaxOpenConns(25); db.SetMaxIdleConns(5); db.SetConnMaxLifetime(5*time.Minute)
			if err := db.Ping(); err != nil { log.Printf("[dlp] DB ping: %v", err) } else { initSchema() }
		}
	} else { log.Println("[dlp] WARNING: DATABASE_URL not set") }
	startWatchdog()
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthzHandler); mux.HandleFunc("/livez", livezHandler); mux.HandleFunc("/readyz", readyzHandler)
	mux.HandleFunc("/api/v1/dlp/check", handleCheckAccess)
	mux.HandleFunc("/api/v1/dlp/events", handleListEvents)
	mux.HandleFunc("/api/v1/dlp/rules", handleListRules)
	mux.HandleFunc("/api/v1/dlp/stats", handleStats)
	handler := panicMW(rateLimitMW(loggingMW(mux)))
	srv := &http.Server{Addr: ":" + port, Handler: handler, ReadTimeout: 30 * time.Second, WriteTimeout: 30 * time.Second}
	go func() { log.Printf("[dlp-gateway] Starting on :%s", port); if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed { log.Fatal(err) } }()
	quit := make(chan os.Signal, 1); signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM); <-quit
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second); defer cancel(); srv.Shutdown(ctx)
}
