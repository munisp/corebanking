// 54Bank Canary Token Service — Go
// All state persisted to PostgreSQL. No in-memory maps.
package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
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
var serviceName = "canary-token-go"
var eventBus = newEventBus("security.insider-threat", "canary-token")
var startTime = time.Now()

type CanaryToken struct {
	ID        string          `json:"id"`
	Type      string          `json:"type"`
	Name      string          `json:"name"`
	Resource  string          `json:"resource"`
	Status    string          `json:"status"`
	CreatedBy string          `json:"created_by"`
	CreatedAt time.Time       `json:"created_at"`
	Triggers  []CanaryTrigger `json:"triggers"`
}

type CanaryTrigger struct {
	Timestamp time.Time `json:"timestamp"`
	ActorID   string    `json:"actor_id"`
	ActorIP   string    `json:"actor_ip"`
	Operation string    `json:"operation"`
	UserAgent string    `json:"user_agent"`
	Severity  string    `json:"severity"`
	Checksum  string    `json:"checksum"`
}

var (
	mu           sync.RWMutex
	db           *sql.DB
	triggerCount uint64
)

func initSchema() {
	if db == nil { return }
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	for _, q := range []string{
		`CREATE TABLE IF NOT EXISTS canary_tokens (
			id TEXT PRIMARY KEY, type TEXT NOT NULL, name TEXT, resource TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'active', created_by TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), triggers JSONB DEFAULT '[]')`,
		`CREATE TABLE IF NOT EXISTS canary_alerts (
			id SERIAL PRIMARY KEY, token_id TEXT NOT NULL, actor_id TEXT, actor_ip TEXT,
			operation TEXT, severity TEXT, checksum TEXT, triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
		`CREATE INDEX IF NOT EXISTS idx_canary_resource ON canary_tokens(resource)`,
		`CREATE INDEX IF NOT EXISTS idx_canary_status ON canary_tokens(status)`,
	} {
		if _, err := db.ExecContext(ctx, q); err != nil {
			log.Printf("[canary] schema: %v", err)
		}
	}
	// Seed default canary tokens
	seedTokens := []struct{ id, typ, name, resource string }{
		{"CANARY-ACCT-001", "account", "Test Account - DO NOT USE", "NUBAN-0000000099"},
		{"CANARY-ACCT-002", "account", "VIP Dormant Account", "NUBAN-0000000098"},
		{"CANARY-KEY-001", "api_key", "Legacy API Key (deprecated)", "sk_canary_xf9k2m"},
		{"CANARY-DB-001", "database_row", "Fake High-Value Customer", "customer:CUST-CANARY-HNW"},
		{"CANARY-FILE-001", "file", "salary_export_2026.csv", "/exports/salary_export_2026.csv"},
	}
	for _, s := range seedTokens {
		db.ExecContext(ctx, `INSERT INTO canary_tokens (id, type, name, resource, status, created_by, triggers) VALUES ($1,$2,$3,$4,'active','security-admin','[]') ON CONFLICT (id) DO NOTHING`,
			s.id, s.typ, s.name, s.resource)
	}
	log.Println("[canary] PostgreSQL schema initialized with seed data")
}

func dbSaveToken(t *CanaryToken) {
	if db == nil { return }
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	triggersJSON, _ := json.Marshal(t.Triggers)
	db.ExecContext(ctx, `INSERT INTO canary_tokens (id, type, name, resource, status, created_by, created_at, triggers) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, triggers=EXCLUDED.triggers`,
		t.ID, t.Type, t.Name, t.Resource, t.Status, t.CreatedBy, t.CreatedAt, string(triggersJSON))
}

func dbLoadTokenByResource(resource string) *CanaryToken {
	if db == nil { return nil }
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	row := db.QueryRowContext(ctx, `SELECT id, type, name, resource, status, COALESCE(created_by,''), created_at, triggers FROM canary_tokens WHERE resource=$1 AND status != 'disabled' LIMIT 1`, resource)
	return scanToken(row)
}

func dbLoadToken(id string) *CanaryToken {
	if db == nil { return nil }
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	row := db.QueryRowContext(ctx, `SELECT id, type, name, resource, status, COALESCE(created_by,''), created_at, triggers FROM canary_tokens WHERE id=$1`, id)
	return scanToken(row)
}

func scanToken(row *sql.Row) *CanaryToken {
	var t CanaryToken
	var triggersJSON string
	if err := row.Scan(&t.ID, &t.Type, &t.Name, &t.Resource, &t.Status, &t.CreatedBy, &t.CreatedAt, &triggersJSON); err != nil {
		return nil
	}
	json.Unmarshal([]byte(triggersJSON), &t.Triggers)
	return &t
}

func dbListTokens() []*CanaryToken {
	if db == nil { return nil }
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	rows, err := db.QueryContext(ctx, `SELECT id, type, name, resource, status, COALESCE(created_by,''), created_at, triggers FROM canary_tokens ORDER BY created_at`)
	if err != nil { return nil }
	defer rows.Close()
	var result []*CanaryToken
	for rows.Next() {
		var t CanaryToken
		var triggersJSON string
		if rows.Scan(&t.ID, &t.Type, &t.Name, &t.Resource, &t.Status, &t.CreatedBy, &t.CreatedAt, &triggersJSON) != nil { continue }
		json.Unmarshal([]byte(triggersJSON), &t.Triggers)
		result = append(result, &t)
	}
	return result
}

func triggerCanary(tokenID, actorID, actorIP, operation, userAgent string) error {
	mu.Lock()
	defer mu.Unlock()
	token := dbLoadToken(tokenID)
	if token == nil { return fmt.Errorf("canary token %s not found", tokenID) }
	if token.Status == "disabled" { return nil }
	token.Status = "triggered"
	atomic.AddUint64(&triggerCount, 1)
	h := sha256.Sum256([]byte(fmt.Sprintf("%s|%s|%s|%s", tokenID, actorID, operation, time.Now().Format(time.RFC3339Nano))))
	trigger := CanaryTrigger{Timestamp: time.Now(), ActorID: actorID, ActorIP: actorIP, Operation: operation, UserAgent: userAgent, Severity: "high", Checksum: hex.EncodeToString(h[:])}
	token.Triggers = append(token.Triggers, trigger)
	dbSaveToken(token)
	if db != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		db.ExecContext(ctx, `INSERT INTO canary_alerts (token_id, actor_id, actor_ip, operation, severity, checksum, triggered_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
			tokenID, actorID, actorIP, operation, "CRITICAL", trigger.Checksum, trigger.Timestamp)
	}
	eventBus.Emit("canary.triggered", map[string]interface{}{
		"alert": "CANARY TOKEN TRIGGERED", "token_id": tokenID, "token_type": token.Type,
		"actor_id": actorID, "actor_ip": actorIP, "operation": operation, "resource": token.Resource,
		"checksum": trigger.Checksum, "severity": "CRITICAL",
	})
	log.Printf("[CANARY] TRIGGERED: token=%s type=%s actor=%s ip=%s op=%s", tokenID, token.Type, actorID, actorIP, operation)
	return nil
}

func handleCheckResource(w http.ResponseWriter, r *http.Request) {
	resource := r.URL.Query().Get("resource")
	actorID := r.URL.Query().Get("actor_id")
	if resource == "" { http.Error(w, "resource required", 400); return }
	mu.RLock()
	token := dbLoadTokenByResource(resource)
	mu.RUnlock()
	isCanary := token != nil
	if isCanary {
		triggerCanary(token.ID, actorID, r.RemoteAddr, "check", r.UserAgent())
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"is_canary": isCanary})
}

func handleCreateToken(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { http.Error(w, "method not allowed", 405); return }
	var token CanaryToken
	if err := json.NewDecoder(r.Body).Decode(&token); err != nil { http.Error(w, "invalid JSON", 400); return }
	token.ID = fmt.Sprintf("CANARY-%s-%s", token.Type, secureRandHex(4))
	token.Status = "active"
	token.CreatedAt = time.Now()
	token.Triggers = make([]CanaryTrigger, 0)
	mu.Lock()
	dbSaveToken(&token)
	mu.Unlock()
	w.Header().Set("Content-Type", "application/json"); w.WriteHeader(201); json.NewEncoder(w).Encode(token)
}

func handleListTokens(w http.ResponseWriter, r *http.Request) {
	result := dbListTokens()
	if result == nil { result = make([]*CanaryToken, 0) }
	w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(result)
}

func handleListTriggers(w http.ResponseWriter, r *http.Request) {
	tokens := dbListTokens()
	var triggers []map[string]interface{}
	for _, token := range tokens {
		for _, t := range token.Triggers {
			triggers = append(triggers, map[string]interface{}{
				"token_id": token.ID, "token_type": token.Type, "token_name": token.Name,
				"actor_id": t.ActorID, "actor_ip": t.ActorIP, "operation": t.Operation,
				"timestamp": t.Timestamp, "severity": t.Severity, "checksum": t.Checksum,
			})
		}
	}
	if triggers == nil { triggers = make([]map[string]interface{}, 0) }
	w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(triggers)
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	tokens := dbListTokens()
	active, triggered := 0, 0
	for _, t := range tokens { if t.Status == "active" { active++ } else if t.Status == "triggered" { triggered++ } }
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"total_tokens": len(tokens), "active": active, "triggered": triggered,
		"total_trigger_events": atomic.LoadUint64(&triggerCount),
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
func (eb *EventBusImpl) Emit(eventType string, payload map[string]interface{}) { eb.mu.Lock(); defer eb.mu.Unlock(); eb.events = append(eb.events, map[string]interface{}{"event_type": eventType, "source": eb.source, "topic": eb.topic, "timestamp": time.Now().Format(time.RFC3339), "payload": payload}); log.Printf("[EventBus] %s -> %s: %v", eb.topic, eventType, payload) }
func loggingMW(next http.Handler) http.Handler { return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { recordActivity(); start := time.Now(); next.ServeHTTP(w, r); log.Printf("[%s] %s %s %s", serviceName, r.Method, r.URL.Path, time.Since(start)) }) }
func rateLimitMW(next http.Handler) http.Handler { return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { acquireSem(); defer releaseSem(); next.ServeHTTP(w, r) }) }
func panicMW(next http.Handler) http.Handler { return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { defer func() { if err := recover(); err != nil { log.Printf("[PANIC] %v", err); http.Error(w, "internal error", 500) } }(); next.ServeHTTP(w, r) }) }

func main() {
	port := os.Getenv("PORT"); if port == "" { port = "8080" }
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL != "" {
		var err error; db, err = sql.Open("postgres", dbURL)
		if err != nil { log.Printf("[canary] DB: %v", err)
		} else {
			db.SetMaxOpenConns(25); db.SetMaxIdleConns(5); db.SetConnMaxLifetime(5*time.Minute)
			if err := db.Ping(); err != nil { log.Printf("[canary] DB ping: %v", err) } else { initSchema() }
		}
	} else { log.Println("[canary] WARNING: DATABASE_URL not set") }
	startWatchdog()
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthzHandler); mux.HandleFunc("/livez", livezHandler); mux.HandleFunc("/readyz", readyzHandler)
	mux.HandleFunc("/api/v1/canary/check", handleCheckResource)
	mux.HandleFunc("/api/v1/canary/create", handleCreateToken)
	mux.HandleFunc("/api/v1/canary/tokens", handleListTokens)
	mux.HandleFunc("/api/v1/canary/triggers", handleListTriggers)
	mux.HandleFunc("/api/v1/canary/stats", handleStats)
	handler := panicMW(rateLimitMW(loggingMW(mux)))
	srv := &http.Server{Addr: ":" + port, Handler: handler, ReadTimeout: 30 * time.Second, WriteTimeout: 30 * time.Second}
	go func() { log.Printf("[canary-token] Starting on :%s", port); if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed { log.Fatal(err) } }()
	quit := make(chan os.Signal, 1); signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM); <-quit
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second); defer cancel(); srv.Shutdown(ctx)
}
