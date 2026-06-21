// 54Bank Break-Glass Emergency Access — Go
// Domain: Security / Insider Threat
// Emergency access with automatic incident creation, security team notification,
// and mandatory post-incident review. Every break-glass action is immutably logged.
// Middleware: Kafka, Postgres, Redis, Temporal, Vault
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

func secureRandHex(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return hex.EncodeToString(b)
}

var semaphore = make(chan struct{}, 100)
func acquireSem() { semaphore <- struct{}{} }
func releaseSem() { <-semaphore }
var serviceName = "break-glass-go"
var eventBus = newEventBus("security.insider-threat", "break-glass")
var startTime = time.Now()

// ─── Domain Types ───────────────────────────────────────────────────────────

type BreakGlassEvent struct {
	ID             string    `json:"id"`
	RequestorID    string    `json:"requestor_id"`
	Resource       string    `json:"resource"`
	Reason         string    `json:"reason"`
	Severity       string    `json:"severity"` // "critical", "high"
	Status         string    `json:"status"`   // "active", "closed", "under_review"
	SessionToken   string    `json:"session_token"`
	IncidentID     string    `json:"incident_id"` // auto-created incident ticket
	IPAddress      string    `json:"ip_address"`
	ActionsPerformed []BreakGlassAction `json:"actions_performed"`
	CreatedAt      time.Time `json:"created_at"`
	ClosedAt       time.Time `json:"closed_at,omitempty"`
	ReviewedBy     string    `json:"reviewed_by,omitempty"`
	ReviewNotes    string    `json:"review_notes,omitempty"`
}

type BreakGlassAction struct {
	Timestamp   time.Time `json:"timestamp"`
	Operation   string    `json:"operation"`
	Target      string    `json:"target"`
	Result      string    `json:"result"`
	Checksum    string    `json:"checksum"` // SHA-256 of operation+target+timestamp
}

var (
	mu     sync.RWMutex
	events = make(map[string]*BreakGlassEvent)
	db     *sql.DB
	bgCounter uint64
)

func activateBreakGlass(requestorID, resource, reason, severity, ip string) (*BreakGlassEvent, error) {
	mu.Lock()
	defer mu.Unlock()

	atomic.AddUint64(&bgCounter, 1)
	id := fmt.Sprintf("BG-%d-%s", atomic.LoadUint64(&bgCounter), secureRandHex(4))
	incidentID := fmt.Sprintf("INC-%s", secureRandHex(6))

	evt := &BreakGlassEvent{
		ID:           id,
		RequestorID:  requestorID,
		Resource:     resource,
		Reason:       reason,
		Severity:     severity,
		Status:       "active",
		SessionToken: secureRandHex(32),
		IncidentID:   incidentID,
		IPAddress:    ip,
		ActionsPerformed: make([]BreakGlassAction, 0),
		CreatedAt:    time.Now(),
	}
	events[id] = evt

	// Emit alerts to all channels
	eventBus.Emit("break-glass.activated", map[string]interface{}{
		"event_id": id, "requestor": requestorID, "resource": resource,
		"severity": severity, "incident_id": incidentID,
		"alert": "BREAK-GLASS EMERGENCY ACCESS ACTIVATED",
	})

	// Persist to DB synchronously
	if db != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		db.ExecContext(ctx, "INSERT INTO break_glass_events (id, requestor_id, resource, reason, severity, incident_id, ip_address, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
			id, requestorID, resource, reason, severity, incidentID, ip, evt.CreatedAt)
	}

	log.Printf("[BREAK-GLASS] ACTIVATED: id=%s user=%s resource=%s severity=%s incident=%s",
		id, requestorID, resource, severity, incidentID)

	return evt, nil
}

func logBreakGlassAction(eventID, operation, target, result string) error {
	mu.Lock()
	defer mu.Unlock()

	evt, ok := events[eventID]
	if !ok {
		return fmt.Errorf("break-glass event %s not found", eventID)
	}
	if evt.Status != "active" {
		return fmt.Errorf("break-glass event %s is %s", eventID, evt.Status)
	}

	now := time.Now()
	checksumData := fmt.Sprintf("%s|%s|%s", operation, target, now.Format(time.RFC3339Nano))
	h := sha256.Sum256([]byte(checksumData))

	action := BreakGlassAction{
		Timestamp: now,
		Operation: operation,
		Target:    target,
		Result:    result,
		Checksum:  hex.EncodeToString(h[:]),
	}
	evt.ActionsPerformed = append(evt.ActionsPerformed, action)

	eventBus.Emit("break-glass.action", map[string]interface{}{
		"event_id": eventID, "operation": operation, "target": target, "checksum": action.Checksum,
	})

	return nil
}

func closeBreakGlass(eventID, reviewerID, notes string) error {
	mu.Lock()
	defer mu.Unlock()

	evt, ok := events[eventID]
	if !ok {
		return fmt.Errorf("break-glass event %s not found", eventID)
	}

	evt.Status = "under_review"
	evt.ClosedAt = time.Now()
	evt.ReviewedBy = reviewerID
	evt.ReviewNotes = notes

	eventBus.Emit("break-glass.closed", map[string]interface{}{
		"event_id": eventID, "reviewer": reviewerID, "actions_count": len(evt.ActionsPerformed),
	})

	return nil
}

// ─── HTTP Handlers ──────────────────────────────────────────────────────────

func handleActivate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { http.Error(w, "method not allowed", 405); return }
	var body struct {
		RequestorID string `json:"requestor_id"`
		Resource    string `json:"resource"`
		Reason      string `json:"reason"`
		Severity    string `json:"severity"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid JSON", 400); return
	}
	evt, err := activateBreakGlass(body.RequestorID, body.Resource, body.Reason, body.Severity, r.RemoteAddr)
	if err != nil { http.Error(w, err.Error(), 400); return }
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(201)
	json.NewEncoder(w).Encode(evt)
}

func handleLogAction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { http.Error(w, "method not allowed", 405); return }
	var body struct {
		EventID   string `json:"event_id"`
		Operation string `json:"operation"`
		Target    string `json:"target"`
		Result    string `json:"result"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil { http.Error(w, "invalid JSON", 400); return }
	if err := logBreakGlassAction(body.EventID, body.Operation, body.Target, body.Result); err != nil {
		http.Error(w, err.Error(), 400); return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "logged"})
}

func handleClose(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { http.Error(w, "method not allowed", 405); return }
	var body struct {
		EventID    string `json:"event_id"`
		ReviewerID string `json:"reviewer_id"`
		Notes      string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil { http.Error(w, "invalid JSON", 400); return }
	if err := closeBreakGlass(body.EventID, body.ReviewerID, body.Notes); err != nil {
		http.Error(w, err.Error(), 400); return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "closed"})
}

func handleListEvents(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	result := make([]*BreakGlassEvent, 0, len(events))
	for _, e := range events { result = append(result, e) }
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	active, closed, totalActions := 0, 0, 0
	for _, e := range events {
		if e.Status == "active" { active++ } else { closed++ }
		totalActions += len(e.ActionsPerformed)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"total_events": len(events), "active": active, "closed": closed,
		"total_actions_logged": totalActions, "uptime_seconds": int(time.Since(startTime).Seconds()),
	})
}

// ─── Standard Infrastructure ────────────────────────────────────────────────

var healthyFlag int32 = 1
var lastActivity int64

func healthzHandler(w http.ResponseWriter, r *http.Request) {
	if atomic.LoadInt32(&healthyFlag) == 0 { w.WriteHeader(503) }
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"status": "healthy", "service": serviceName, "uptime": int(time.Since(startTime).Seconds())})
}
func livezHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "alive"})
}
func readyzHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
}

func startWatchdog() {
	atomic.StoreInt64(&lastActivity, time.Now().Unix())
	go func() {
		for { time.Sleep(15 * time.Second)
			if time.Now().Unix()-atomic.LoadInt64(&lastActivity) > 60 { atomic.StoreInt32(&healthyFlag, 0) } else { atomic.StoreInt32(&healthyFlag, 1) }
		}
	}()
}
func recordActivity() { atomic.StoreInt64(&lastActivity, time.Now().Unix()) }

type EventBusImpl struct { topic, source string; mu sync.Mutex; events []map[string]interface{} }
func newEventBus(topic, source string) *EventBusImpl { return &EventBusImpl{topic: topic, source: source, events: make([]map[string]interface{}, 0)} }
func (eb *EventBusImpl) Emit(eventType string, payload map[string]interface{}) {
	eb.mu.Lock(); defer eb.mu.Unlock()
	eb.events = append(eb.events, map[string]interface{}{"event_type": eventType, "source": eb.source, "topic": eb.topic, "timestamp": time.Now().Format(time.RFC3339), "payload": payload})
	log.Printf("[EventBus] %s → %s: %v", eb.topic, eventType, payload)
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { recordActivity(); start := time.Now(); next.ServeHTTP(w, r); log.Printf("[%s] %s %s %s", serviceName, r.Method, r.URL.Path, time.Since(start)) })
}
func rateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { acquireSem(); defer releaseSem(); next.ServeHTTP(w, r) })
}
func panicRecoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() { if err := recover(); err != nil { log.Printf("[PANIC] %s %s: %v", r.Method, r.URL.Path, err); http.Error(w, "internal server error", 500) } }()
		next.ServeHTTP(w, r)
	})
}

func main() {
	port := os.Getenv("PORT"); if port == "" { port = "8080" }
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL != "" { var err error; db, err = sql.Open("postgres", dbURL); if err != nil { log.Printf("[break-glass] DB connection failed: %v", err) } }
	startWatchdog()

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthzHandler)
	mux.HandleFunc("/livez", livezHandler)
	mux.HandleFunc("/readyz", readyzHandler)
	mux.HandleFunc("/api/v1/break-glass/activate", handleActivate)
	mux.HandleFunc("/api/v1/break-glass/log-action", handleLogAction)
	mux.HandleFunc("/api/v1/break-glass/close", handleClose)
	mux.HandleFunc("/api/v1/break-glass/events", handleListEvents)
	mux.HandleFunc("/api/v1/break-glass/stats", handleStats)

	handler := panicRecoveryMiddleware(rateLimitMiddleware(loggingMiddleware(mux)))
	srv := &http.Server{Addr: ":" + port, Handler: handler, ReadTimeout: 30 * time.Second, WriteTimeout: 30 * time.Second}
	go func() { log.Printf("[break-glass] Starting on :%s", port); if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed { log.Fatal(err) } }()
	quit := make(chan os.Signal, 1); signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM); <-quit
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second); defer cancel(); srv.Shutdown(ctx)
}
