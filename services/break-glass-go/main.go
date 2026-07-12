// 54Bank Break-Glass Emergency Access — Go
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

type BreakGlassEvent struct {
	ID             string    `json:"id"`
	RequestorID    string    `json:"requestor_id"`
	Resource       string    `json:"resource"`
	Reason         string    `json:"reason"`
	Severity       string    `json:"severity"`
	Status         string    `json:"status"`
	SessionToken   string    `json:"session_token"`
	IncidentID     string    `json:"incident_id"`
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
	Checksum    string    `json:"checksum"`
}

var (
	mu        sync.RWMutex
	db        *sql.DB
	bgCounter uint64
)

func initSchema() {
	if db == nil { return }
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	for _, q := range []string{
		`CREATE TABLE IF NOT EXISTS break_glass_events (
			id TEXT PRIMARY KEY, requestor_id TEXT NOT NULL, resource TEXT NOT NULL,
			reason TEXT, severity TEXT, status TEXT NOT NULL DEFAULT 'active',
			session_token TEXT, incident_id TEXT, ip_address TEXT,
			actions_performed JSONB DEFAULT '[]',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			closed_at TIMESTAMPTZ, reviewed_by TEXT, review_notes TEXT)`,
		`CREATE INDEX IF NOT EXISTS idx_bg_status ON break_glass_events(status)`,
	} {
		if _, err := db.ExecContext(ctx, q); err != nil {
			log.Printf("[break-glass] schema: %v", err)
		}
	}
	log.Println("[break-glass] PostgreSQL schema initialized")
}

func dbSaveEvent(evt *BreakGlassEvent) {
	if db == nil { return }
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	actionsJSON, _ := json.Marshal(evt.ActionsPerformed)
	db.ExecContext(ctx, `INSERT INTO break_glass_events (id, requestor_id, resource, reason, severity, status, session_token, incident_id, ip_address, actions_performed, created_at, closed_at, reviewed_by, review_notes)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
		ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, actions_performed=EXCLUDED.actions_performed, closed_at=EXCLUDED.closed_at, reviewed_by=EXCLUDED.reviewed_by, review_notes=EXCLUDED.review_notes`,
		evt.ID, evt.RequestorID, evt.Resource, evt.Reason, evt.Severity, evt.Status,
		evt.SessionToken, evt.IncidentID, evt.IPAddress, string(actionsJSON),
		evt.CreatedAt, nullTime(evt.ClosedAt), evt.ReviewedBy, evt.ReviewNotes)
}

func dbLoadEvent(id string) *BreakGlassEvent {
	if db == nil { return nil }
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	row := db.QueryRowContext(ctx, `SELECT id, requestor_id, resource, reason, severity, status, COALESCE(session_token,''), COALESCE(incident_id,''), COALESCE(ip_address,''), actions_performed, created_at, closed_at, COALESCE(reviewed_by,''), COALESCE(review_notes,'') FROM break_glass_events WHERE id=$1`, id)
	var evt BreakGlassEvent
	var actionsJSON string
	var closedAt sql.NullTime
	if err := row.Scan(&evt.ID, &evt.RequestorID, &evt.Resource, &evt.Reason, &evt.Severity, &evt.Status, &evt.SessionToken, &evt.IncidentID, &evt.IPAddress, &actionsJSON, &evt.CreatedAt, &closedAt, &evt.ReviewedBy, &evt.ReviewNotes); err != nil {
		return nil
	}
	json.Unmarshal([]byte(actionsJSON), &evt.ActionsPerformed)
	if closedAt.Valid { evt.ClosedAt = closedAt.Time }
	return &evt
}

func dbListEvents() []*BreakGlassEvent {
	if db == nil { return nil }
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	rows, err := db.QueryContext(ctx, `SELECT id, requestor_id, resource, reason, severity, status, COALESCE(session_token,''), COALESCE(incident_id,''), COALESCE(ip_address,''), actions_performed, created_at, closed_at, COALESCE(reviewed_by,''), COALESCE(review_notes,'') FROM break_glass_events ORDER BY created_at DESC LIMIT 1000`)
	if err != nil { return nil }
	defer rows.Close()
	var result []*BreakGlassEvent
	for rows.Next() {
		var evt BreakGlassEvent
		var actionsJSON string
		var closedAt sql.NullTime
		if rows.Scan(&evt.ID, &evt.RequestorID, &evt.Resource, &evt.Reason, &evt.Severity, &evt.Status, &evt.SessionToken, &evt.IncidentID, &evt.IPAddress, &actionsJSON, &evt.CreatedAt, &closedAt, &evt.ReviewedBy, &evt.ReviewNotes) != nil { continue }
		json.Unmarshal([]byte(actionsJSON), &evt.ActionsPerformed)
		if closedAt.Valid { evt.ClosedAt = closedAt.Time }
		result = append(result, &evt)
	}
	return result
}

func nullTime(t time.Time) interface{} { if t.IsZero() { return nil }; return t }

func activateBreakGlass(requestorID, resource, reason, severity, ip string) (*BreakGlassEvent, error) {
	mu.Lock()
	defer mu.Unlock()
	atomic.AddUint64(&bgCounter, 1)
	id := fmt.Sprintf("BG-%d-%s", atomic.LoadUint64(&bgCounter), secureRandHex(4))
	incidentID := fmt.Sprintf("INC-%s", secureRandHex(6))
	evt := &BreakGlassEvent{
		ID: id, RequestorID: requestorID, Resource: resource, Reason: reason,
		Severity: severity, Status: "active", SessionToken: secureRandHex(32),
		IncidentID: incidentID, IPAddress: ip, ActionsPerformed: make([]BreakGlassAction, 0),
		CreatedAt: time.Now(),
	}
	dbSaveEvent(evt)
	eventBus.Emit("break-glass.activated", map[string]interface{}{
		"event_id": id, "requestor": requestorID, "resource": resource,
		"severity": severity, "incident_id": incidentID,
		"alert": "BREAK-GLASS EMERGENCY ACCESS ACTIVATED",
	})
	log.Printf("[BREAK-GLASS] ACTIVATED: id=%s user=%s resource=%s severity=%s incident=%s", id, requestorID, resource, severity, incidentID)
	return evt, nil
}

func logBreakGlassAction(eventID, operation, target, result string) error {
	mu.Lock()
	defer mu.Unlock()
	evt := dbLoadEvent(eventID)
	if evt == nil { return fmt.Errorf("break-glass event %s not found", eventID) }
	if evt.Status != "active" { return fmt.Errorf("break-glass event %s is %s", eventID, evt.Status) }
	now := time.Now()
	checksumData := fmt.Sprintf("%s|%s|%s", operation, target, now.Format(time.RFC3339Nano))
	h := sha256.Sum256([]byte(checksumData))
	action := BreakGlassAction{Timestamp: now, Operation: operation, Target: target, Result: result, Checksum: hex.EncodeToString(h[:])}
	evt.ActionsPerformed = append(evt.ActionsPerformed, action)
	dbSaveEvent(evt)
	eventBus.Emit("break-glass.action", map[string]interface{}{"event_id": eventID, "operation": operation, "target": target, "checksum": action.Checksum})
	return nil
}

func closeBreakGlass(eventID, reviewerID, notes string) error {
	mu.Lock()
	defer mu.Unlock()
	evt := dbLoadEvent(eventID)
	if evt == nil { return fmt.Errorf("break-glass event %s not found", eventID) }
	evt.Status = "under_review"
	evt.ClosedAt = time.Now()
	evt.ReviewedBy = reviewerID
	evt.ReviewNotes = notes
	dbSaveEvent(evt)
	eventBus.Emit("break-glass.closed", map[string]interface{}{"event_id": eventID, "reviewer": reviewerID, "actions_count": len(evt.ActionsPerformed)})
	return nil
}

func handleActivate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { http.Error(w, "method not allowed", 405); return }
	var body struct { RequestorID string `json:"requestor_id"`; Resource string `json:"resource"`; Reason string `json:"reason"`; Severity string `json:"severity"` }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil { http.Error(w, "invalid JSON", 400); return }
	evt, err := activateBreakGlass(body.RequestorID, body.Resource, body.Reason, body.Severity, r.RemoteAddr)
	if err != nil { http.Error(w, err.Error(), 400); return }
	w.Header().Set("Content-Type", "application/json"); w.WriteHeader(201); json.NewEncoder(w).Encode(evt)
}

func handleLogAction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { http.Error(w, "method not allowed", 405); return }
	var body struct { EventID string `json:"event_id"`; Operation string `json:"operation"`; Target string `json:"target"`; Result string `json:"result"` }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil { http.Error(w, "invalid JSON", 400); return }
	if err := logBreakGlassAction(body.EventID, body.Operation, body.Target, body.Result); err != nil { http.Error(w, err.Error(), 400); return }
	w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(map[string]string{"status": "logged"})
}

func handleClose(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { http.Error(w, "method not allowed", 405); return }
	var body struct { EventID string `json:"event_id"`; ReviewerID string `json:"reviewer_id"`; Notes string `json:"notes"` }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil { http.Error(w, "invalid JSON", 400); return }
	if err := closeBreakGlass(body.EventID, body.ReviewerID, body.Notes); err != nil { http.Error(w, err.Error(), 400); return }
	w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(map[string]string{"status": "closed"})
}

func handleListEvents(w http.ResponseWriter, r *http.Request) {
	result := dbListEvents()
	if result == nil { result = make([]*BreakGlassEvent, 0) }
	w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(result)
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	events := dbListEvents()
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

var healthyFlag int32 = 1; var lastActivity int64
func healthzHandler(w http.ResponseWriter, r *http.Request) {
	if atomic.LoadInt32(&healthyFlag) == 0 { w.WriteHeader(503) }
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"status": "healthy", "service": serviceName, "uptime": int(time.Since(startTime).Seconds())})
}
func livezHandler(w http.ResponseWriter, r *http.Request) { w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(map[string]string{"status": "alive"}) }
func readyzHandler(w http.ResponseWriter, r *http.Request) {
	if db == nil { w.WriteHeader(503); json.NewEncoder(w).Encode(map[string]string{"status": "not_ready", "reason": "database not connected"}); return }
	w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
}

func startWatchdog() { atomic.StoreInt64(&lastActivity, time.Now().Unix()); go func() { for { time.Sleep(15*time.Second); if time.Now().Unix()-atomic.LoadInt64(&lastActivity) > 60 { atomic.StoreInt32(&healthyFlag, 0) } else { atomic.StoreInt32(&healthyFlag, 1) } } }() }
func recordActivity() { atomic.StoreInt64(&lastActivity, time.Now().Unix()) }

type EventBusImpl struct { topic, source string; mu sync.Mutex; events []map[string]interface{} }
func newEventBus(topic, source string) *EventBusImpl { return &EventBusImpl{topic: topic, source: source, events: make([]map[string]interface{}, 0)} }
func (eb *EventBusImpl) Emit(eventType string, payload map[string]interface{}) {
	eb.mu.Lock(); defer eb.mu.Unlock()
	eb.events = append(eb.events, map[string]interface{}{"event_type": eventType, "source": eb.source, "topic": eb.topic, "timestamp": time.Now().Format(time.RFC3339), "payload": payload})
	log.Printf("[EventBus] %s -> %s: %v", eb.topic, eventType, payload)
}
func loggingMiddleware(next http.Handler) http.Handler { return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { recordActivity(); start := time.Now(); next.ServeHTTP(w, r); log.Printf("[%s] %s %s %s", serviceName, r.Method, r.URL.Path, time.Since(start)) }) }
func rateLimitMiddleware(next http.Handler) http.Handler { return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { acquireSem(); defer releaseSem(); next.ServeHTTP(w, r) }) }
func panicRecoveryMiddleware(next http.Handler) http.Handler { return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { defer func() { if err := recover(); err != nil { log.Printf("[PANIC] %v", err); http.Error(w, "internal error", 500) } }(); next.ServeHTTP(w, r) }) }

func main() {
	port := os.Getenv("PORT"); if port == "" { port = "8080" }
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL != "" {
		var err error; db, err = sql.Open("postgres", dbURL)
		if err != nil { log.Printf("[break-glass] DB connection failed: %v", err)
		} else {
			db.SetMaxOpenConns(25); db.SetMaxIdleConns(5); db.SetConnMaxLifetime(5*time.Minute)
			if err := db.Ping(); err != nil { log.Printf("[break-glass] DB ping failed: %v", err) } else { log.Println("[break-glass] Connected to PostgreSQL"); initSchema() }
		}
	} else { log.Println("[break-glass] WARNING: DATABASE_URL not set") }
	startWatchdog()
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthzHandler); mux.HandleFunc("/livez", livezHandler); mux.HandleFunc("/readyz", readyzHandler)
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
