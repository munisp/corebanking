// 54Bank Data Loss Prevention (DLP) Gateway — Go
// Domain: Security / Insider Threat
// Detects and blocks bulk data exfiltration: large SELECT queries, API scraping,
// bulk exports, and unusual data access patterns.
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
var serviceName = "dlp-gateway-go"
var eventBus = newEventBus("security.insider-threat", "dlp")
var startTime = time.Now()

type DLPRule struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Type        string `json:"type"` // "query_size", "api_rate", "export_size", "pii_access", "bulk_read"
	Threshold   int64  `json:"threshold"`
	WindowSec   int    `json:"window_seconds"`
	Action      string `json:"action"` // "block", "alert", "log"
	Severity    string `json:"severity"`
}

type DLPEvent struct {
	ID          string    `json:"id"`
	RuleID      string    `json:"rule_id"`
	RuleName    string    `json:"rule_name"`
	ActorID     string    `json:"actor_id"`
	ActorIP     string    `json:"actor_ip"`
	Action      string    `json:"action"`
	Details     string    `json:"details"`
	DataVolume  int64     `json:"data_volume_bytes"`
	RecordCount int64     `json:"record_count"`
	Blocked     bool      `json:"blocked"`
	Timestamp   time.Time `json:"timestamp"`
}

type AccessWindow struct {
	ActorID     string
	QueryCount  int64
	BytesRead   int64
	RecordsRead int64
	PIIAccess   int64
	WindowStart time.Time
}

var (
	mu    sync.RWMutex
	rules = []*DLPRule{
		{ID: "DLP-001", Name: "Bulk Query Detection", Type: "query_size", Threshold: 10000, WindowSec: 300, Action: "block", Severity: "critical"},
		{ID: "DLP-002", Name: "API Scraping Detection", Type: "api_rate", Threshold: 500, WindowSec: 60, Action: "block", Severity: "high"},
		{ID: "DLP-003", Name: "Large Export Detection", Type: "export_size", Threshold: 10485760, WindowSec: 3600, Action: "alert", Severity: "high"}, // 10MB
		{ID: "DLP-004", Name: "PII Bulk Access", Type: "pii_access", Threshold: 100, WindowSec: 300, Action: "block", Severity: "critical"},
		{ID: "DLP-005", Name: "Customer Data Bulk Read", Type: "bulk_read", Threshold: 1000, WindowSec: 600, Action: "block", Severity: "critical"},
	}
	accessWindows = make(map[string]*AccessWindow)
	dlpEvents     = make([]DLPEvent, 0)
	db            *sql.DB
	blockedCount  uint64
	alertCount    uint64
)

func checkDLP(actorID, actorIP, operation string, recordCount, dataBytes, piiCount int64) (bool, []DLPEvent) {
	mu.Lock()
	defer mu.Unlock()

	now := time.Now()
	window, ok := accessWindows[actorID]
	if !ok || now.Sub(window.WindowStart) > 10*time.Minute {
		window = &AccessWindow{ActorID: actorID, WindowStart: now}
		accessWindows[actorID] = window
	}

	window.QueryCount++
	window.BytesRead += dataBytes
	window.RecordsRead += recordCount
	window.PIIAccess += piiCount

	var triggered []DLPEvent
	allowed := true

	for _, rule := range rules {
		var violated bool
		switch rule.Type {
		case "query_size":
			violated = window.RecordsRead > rule.Threshold
		case "api_rate":
			violated = window.QueryCount > rule.Threshold
		case "export_size":
			violated = window.BytesRead > rule.Threshold
		case "pii_access":
			violated = window.PIIAccess > rule.Threshold
		case "bulk_read":
			violated = recordCount > rule.Threshold
		}

		if violated {
			blocked := rule.Action == "block"
			if blocked { allowed = false; atomic.AddUint64(&blockedCount, 1) }
			if rule.Action == "alert" { atomic.AddUint64(&alertCount, 1) }

			evt := DLPEvent{
				ID: fmt.Sprintf("DLP-EVT-%s", secureRandHex(6)),
				RuleID: rule.ID, RuleName: rule.Name,
				ActorID: actorID, ActorIP: actorIP,
				Action: rule.Action, Blocked: blocked,
				Details: fmt.Sprintf("operation=%s records=%d bytes=%d pii=%d", operation, recordCount, dataBytes, piiCount),
				DataVolume: dataBytes, RecordCount: recordCount,
				Timestamp: now,
			}
			dlpEvents = append(dlpEvents, evt)
			triggered = append(triggered, evt)

			eventBus.Emit("dlp.violation", map[string]interface{}{
				"event_id": evt.ID, "rule": rule.Name, "actor": actorID, "ip": actorIP,
				"action": rule.Action, "severity": rule.Severity,
				"data_volume": dataBytes, "record_count": recordCount, "pii_count": piiCount,
			})
		}
	}

	return allowed, triggered
}

// ─── HTTP Handlers ──────────────────────────────────────────────────────────

func handleCheckDLP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { http.Error(w, "method not allowed", 405); return }
	var body struct {
		ActorID string `json:"actor_id"`; Operation string `json:"operation"`
		RecordCount int64 `json:"record_count"`; DataBytes int64 `json:"data_bytes"`; PIICount int64 `json:"pii_count"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil { http.Error(w, "invalid JSON", 400); return }
	allowed, events := checkDLP(body.ActorID, r.RemoteAddr, body.Operation, body.RecordCount, body.DataBytes, body.PIICount)
	status := 200; if !allowed { status = 403 }
	w.Header().Set("Content-Type", "application/json"); w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]interface{}{"allowed": allowed, "violations": events})
}

func handleListRules(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(rules)
}

func handleListEvents(w http.ResponseWriter, r *http.Request) {
	mu.RLock(); defer mu.RUnlock()
	w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(dlpEvents)
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	mu.RLock(); defer mu.RUnlock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"total_events": len(dlpEvents), "blocked": atomic.LoadUint64(&blockedCount),
		"alerts": atomic.LoadUint64(&alertCount), "tracked_actors": len(accessWindows),
		"rules": len(rules), "uptime_seconds": int(time.Since(startTime).Seconds()),
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
	if dbURL != "" { var err error; db, err = sql.Open("postgres", dbURL); if err != nil { log.Printf("[dlp] DB: %v", err) } }
	startWatchdog()
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthzHandler); mux.HandleFunc("/livez", livezHandler); mux.HandleFunc("/readyz", readyzHandler)
	mux.HandleFunc("/api/v1/dlp/check", handleCheckDLP)
	mux.HandleFunc("/api/v1/dlp/rules", handleListRules)
	mux.HandleFunc("/api/v1/dlp/events", handleListEvents)
	mux.HandleFunc("/api/v1/dlp/stats", handleStats)
	handler := panicMW(rateLimitMW(loggingMW(mux)))
	srv := &http.Server{Addr: ":" + port, Handler: handler, ReadTimeout: 30 * time.Second, WriteTimeout: 30 * time.Second}
	go func() { log.Printf("[dlp-gateway] Starting on :%s", port); if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed { log.Fatal(err) } }()
	quit := make(chan os.Signal, 1); signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM); <-quit
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second); defer cancel(); srv.Shutdown(ctx)
}
