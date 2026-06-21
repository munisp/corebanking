// 54Bank Canary Token Service — Go
// Domain: Security / Insider Threat
// Deploys honeypot accounts, records, and API endpoints that trigger alerts
// when accessed. Detects unauthorized snooping by insiders.
// Middleware: Kafka, Postgres, Redis
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
	ID          string    `json:"id"`
	Type        string    `json:"type"`     // "account", "record", "api_key", "file", "dns", "database_row"
	Name        string    `json:"name"`     // human-readable label
	Resource    string    `json:"resource"` // the honeypot resource identifier
	Status      string    `json:"status"`   // "active", "triggered", "disabled"
	CreatedBy   string    `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
	Triggers    []CanaryTrigger `json:"triggers"`
}

type CanaryTrigger struct {
	Timestamp   time.Time `json:"timestamp"`
	ActorID     string    `json:"actor_id"`
	ActorIP     string    `json:"actor_ip"`
	Operation   string    `json:"operation"` // "read", "write", "query", "api_call"
	UserAgent   string    `json:"user_agent"`
	Severity    string    `json:"severity"`  // "high" (all canary triggers are high)
	Checksum    string    `json:"checksum"`
}

var (
	mu     sync.RWMutex
	tokens = map[string]*CanaryToken{
		"CANARY-ACCT-001": {ID: "CANARY-ACCT-001", Type: "account", Name: "Test Account - DO NOT USE", Resource: "NUBAN-0000000099", Status: "active", CreatedBy: "security-admin", CreatedAt: time.Now().Add(-720 * time.Hour)},
		"CANARY-ACCT-002": {ID: "CANARY-ACCT-002", Type: "account", Name: "VIP Dormant Account", Resource: "NUBAN-0000000098", Status: "active", CreatedBy: "security-admin", CreatedAt: time.Now().Add(-360 * time.Hour)},
		"CANARY-KEY-001":  {ID: "CANARY-KEY-001", Type: "api_key", Name: "Legacy API Key (deprecated)", Resource: "sk_canary_xf9k2m", Status: "active", CreatedBy: "security-admin", CreatedAt: time.Now().Add(-180 * time.Hour)},
		"CANARY-DB-001":   {ID: "CANARY-DB-001", Type: "database_row", Name: "Fake High-Value Customer", Resource: "customer:CUST-CANARY-HNW", Status: "active", CreatedBy: "security-admin", CreatedAt: time.Now().Add(-90 * time.Hour)},
		"CANARY-FILE-001": {ID: "CANARY-FILE-001", Type: "file", Name: "salary_export_2026.csv", Resource: "/exports/salary_export_2026.csv", Status: "active", CreatedBy: "security-admin", CreatedAt: time.Now().Add(-30 * time.Hour)},
	}
	db *sql.DB
	triggerCount uint64
)

func triggerCanary(tokenID, actorID, actorIP, operation, userAgent string) error {
	mu.Lock()
	defer mu.Unlock()

	token, ok := tokens[tokenID]
	if !ok { return fmt.Errorf("canary token %s not found", tokenID) }
	if token.Status == "disabled" { return nil }

	token.Status = "triggered"
	atomic.AddUint64(&triggerCount, 1)

	h := sha256.Sum256([]byte(fmt.Sprintf("%s|%s|%s|%s", tokenID, actorID, operation, time.Now().Format(time.RFC3339Nano))))
	trigger := CanaryTrigger{
		Timestamp: time.Now(), ActorID: actorID, ActorIP: actorIP,
		Operation: operation, UserAgent: userAgent, Severity: "high",
		Checksum: hex.EncodeToString(h[:]),
	}
	token.Triggers = append(token.Triggers, trigger)

	// CRITICAL ALERT — insider threat detected
	eventBus.Emit("canary.triggered", map[string]interface{}{
		"alert":     "CANARY TOKEN TRIGGERED — POSSIBLE INSIDER THREAT",
		"token_id":  tokenID, "token_type": token.Type, "token_name": token.Name,
		"actor_id":  actorID, "actor_ip": actorIP, "operation": operation,
		"resource":  token.Resource, "checksum": trigger.Checksum,
		"severity":  "CRITICAL",
	})

	// Persist alert synchronously
	if db != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		db.ExecContext(ctx, "INSERT INTO canary_alerts (token_id, actor_id, actor_ip, operation, severity, checksum, triggered_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
			tokenID, actorID, actorIP, operation, "CRITICAL", trigger.Checksum, trigger.Timestamp)
	}

	log.Printf("[CANARY] TRIGGERED: token=%s type=%s actor=%s ip=%s op=%s", tokenID, token.Type, actorID, actorIP, operation)
	return nil
}

func checkResource(resource, actorID, actorIP, operation, userAgent string) bool {
	mu.RLock()
	defer mu.RUnlock()
	for id, token := range tokens {
		if token.Resource == resource && token.Status == "active" {
			go func(tid string) {
				mu.RUnlock() // release read lock before acquiring write lock
				triggerCanary(tid, actorID, actorIP, operation, userAgent)
			}(id)
			return true // is a canary
		}
	}
	return false
}

// ─── HTTP Handlers ──────────────────────────────────────────────────────────

func handleCheckResource(w http.ResponseWriter, r *http.Request) {
	resource := r.URL.Query().Get("resource")
	actorID := r.URL.Query().Get("actor_id")
	if resource == "" { http.Error(w, "resource required", 400); return }

	mu.RLock()
	isCanary := false
	var matchedID string
	for id, token := range tokens {
		if token.Resource == resource && token.Status != "disabled" {
			isCanary = true; matchedID = id; break
		}
	}
	mu.RUnlock()

	if isCanary {
		triggerCanary(matchedID, actorID, r.RemoteAddr, "check", r.UserAgent())
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
	mu.Lock(); tokens[token.ID] = &token; mu.Unlock()
	w.Header().Set("Content-Type", "application/json"); w.WriteHeader(201); json.NewEncoder(w).Encode(token)
}

func handleListTokens(w http.ResponseWriter, r *http.Request) {
	mu.RLock(); defer mu.RUnlock()
	result := make([]*CanaryToken, 0, len(tokens))
	for _, t := range tokens { result = append(result, t) }
	w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(result)
}

func handleListTriggers(w http.ResponseWriter, r *http.Request) {
	mu.RLock(); defer mu.RUnlock()
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
	w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(triggers)
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	mu.RLock(); defer mu.RUnlock()
	active, triggered := 0, 0
	for _, t := range tokens { if t.Status == "active" { active++ } else if t.Status == "triggered" { triggered++ } }
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"total_tokens": len(tokens), "active": active, "triggered": triggered,
		"total_trigger_events": atomic.LoadUint64(&triggerCount),
		"uptime_seconds": int(time.Since(startTime).Seconds()),
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
	if dbURL != "" { var err error; db, err = sql.Open("postgres", dbURL); if err != nil { log.Printf("[canary] DB: %v", err) } }
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
