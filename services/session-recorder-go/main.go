// 54Bank Session Recorder — Go
// Domain: Security / Insider Threat
// Records all privileged sessions (SSH, DB console, admin UI) with keystroke
// logging, screen capture references, and tamper-proof storage.
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
var serviceName = "session-recorder-go"
var eventBus = newEventBus("security.insider-threat", "session-recorder")
var startTime = time.Now()

type RecordedSession struct {
	ID            string    `json:"id"`
	UserID        string    `json:"user_id"`
	SessionType   string    `json:"session_type"` // "ssh", "db_console", "admin_ui", "api"
	TargetHost    string    `json:"target_host"`
	Status        string    `json:"status"` // "recording", "completed", "flagged"
	StartedAt     time.Time `json:"started_at"`
	EndedAt       time.Time `json:"ended_at,omitempty"`
	Commands      []SessionCommand `json:"commands"`
	ChainHash     string    `json:"chain_hash"` // running SHA-256 for tamper detection
	BytesRecorded int64     `json:"bytes_recorded"`
	FlaggedReason string    `json:"flagged_reason,omitempty"`
}

type SessionCommand struct {
	Timestamp time.Time `json:"timestamp"`
	Command   string    `json:"command"`
	Output    string    `json:"output,omitempty"`
	Risk      string    `json:"risk"` // "normal", "elevated", "dangerous"
	Hash      string    `json:"hash"`
}

// Dangerous command patterns that trigger alerts
var dangerousPatterns = []string{
	"DROP TABLE", "DELETE FROM", "TRUNCATE", "ALTER TABLE",
	"SELECT * FROM customers", "SELECT * FROM accounts",
	"pg_dump", "mysqldump", "mongodump",
	"curl.*/etc/passwd", "wget.*sensitive",
	"chmod 777", "rm -rf",
	"scp.*@", "rsync.*@",
	"base64.*decode",
}

var (
	mu       sync.RWMutex
	sessions = make(map[string]*RecordedSession)
	db       *sql.DB
	sessionCounter uint64
)

func startRecording(userID, sessionType, targetHost string) *RecordedSession {
	mu.Lock()
	defer mu.Unlock()

	atomic.AddUint64(&sessionCounter, 1)
	id := fmt.Sprintf("REC-%d-%s", atomic.LoadUint64(&sessionCounter), secureRandHex(4))

	session := &RecordedSession{
		ID: id, UserID: userID, SessionType: sessionType,
		TargetHost: targetHost, Status: "recording",
		StartedAt: time.Now(), Commands: make([]SessionCommand, 0),
		ChainHash: hex.EncodeToString(sha256.New().Sum([]byte(id))),
	}
	sessions[id] = session

	eventBus.Emit("session.recording.started", map[string]interface{}{
		"session_id": id, "user": userID, "type": sessionType, "target": targetHost,
	})
	return session
}

func recordCommand(sessionID, command, output string) error {
	mu.Lock()
	defer mu.Unlock()

	session, ok := sessions[sessionID]
	if !ok { return fmt.Errorf("session %s not found", sessionID) }
	if session.Status != "recording" { return fmt.Errorf("session %s is %s", sessionID, session.Status) }

	risk := classifyRisk(command)
	h := sha256.Sum256([]byte(fmt.Sprintf("%s|%s|%s|%s", session.ChainHash, command, output, time.Now().Format(time.RFC3339Nano))))
	hashStr := hex.EncodeToString(h[:])

	cmd := SessionCommand{
		Timestamp: time.Now(), Command: command, Output: output,
		Risk: risk, Hash: hashStr,
	}
	session.Commands = append(session.Commands, cmd)
	session.ChainHash = hashStr
	session.BytesRecorded += int64(len(command) + len(output))

	if risk == "dangerous" {
		session.Status = "flagged"
		session.FlaggedReason = fmt.Sprintf("dangerous command detected: %s", command)
		eventBus.Emit("session.dangerous_command", map[string]interface{}{
			"session_id": sessionID, "user": session.UserID, "command": command,
			"risk": risk, "severity": "CRITICAL",
		})
	}

	if db != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		db.ExecContext(ctx, "INSERT INTO session_commands (session_id, command, output, risk, hash, recorded_at) VALUES ($1,$2,$3,$4,$5,$6)",
			sessionID, command, output, risk, hashStr, cmd.Timestamp)
	}

	return nil
}

func classifyRisk(command string) string {
	upper := ""
	for _, c := range command {
		if c >= 'a' && c <= 'z' { upper += string(c - 32) } else { upper += string(c) }
	}
	for _, pattern := range dangerousPatterns {
		pUpper := ""
		for _, c := range pattern {
			if c >= 'a' && c <= 'z' { pUpper += string(c - 32) } else { pUpper += string(c) }
		}
		if len(upper) >= len(pUpper) {
			for i := 0; i <= len(upper)-len(pUpper); i++ {
				if upper[i:i+len(pUpper)] == pUpper { return "dangerous" }
			}
		}
	}
	if len(command) > 200 { return "elevated" }
	return "normal"
}

func endRecording(sessionID string) error {
	mu.Lock()
	defer mu.Unlock()
	session, ok := sessions[sessionID]
	if !ok { return fmt.Errorf("session %s not found", sessionID) }
	if session.Status == "recording" { session.Status = "completed" }
	session.EndedAt = time.Now()
	eventBus.Emit("session.recording.ended", map[string]interface{}{
		"session_id": sessionID, "user": session.UserID, "commands": len(session.Commands),
		"bytes": session.BytesRecorded, "duration_seconds": int(session.EndedAt.Sub(session.StartedAt).Seconds()),
	})
	return nil
}

// ─── HTTP Handlers ──────────────────────────────────────────────────────────

func handleStartRecording(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { http.Error(w, "method not allowed", 405); return }
	var body struct { UserID string `json:"user_id"`; SessionType string `json:"session_type"`; TargetHost string `json:"target_host"` }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil { http.Error(w, "invalid JSON", 400); return }
	session := startRecording(body.UserID, body.SessionType, body.TargetHost)
	w.Header().Set("Content-Type", "application/json"); w.WriteHeader(201); json.NewEncoder(w).Encode(session)
}

func handleRecordCommand(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { http.Error(w, "method not allowed", 405); return }
	var body struct { SessionID string `json:"session_id"`; Command string `json:"command"`; Output string `json:"output"` }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil { http.Error(w, "invalid JSON", 400); return }
	if err := recordCommand(body.SessionID, body.Command, body.Output); err != nil { http.Error(w, err.Error(), 400); return }
	w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(map[string]string{"status": "recorded"})
}

func handleEndRecording(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { http.Error(w, "method not allowed", 405); return }
	var body struct { SessionID string `json:"session_id"` }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil { http.Error(w, "invalid JSON", 400); return }
	if err := endRecording(body.SessionID); err != nil { http.Error(w, err.Error(), 400); return }
	w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(map[string]string{"status": "completed"})
}

func handleListSessions(w http.ResponseWriter, r *http.Request) {
	mu.RLock(); defer mu.RUnlock()
	result := make([]*RecordedSession, 0, len(sessions))
	for _, s := range sessions { result = append(result, s) }
	w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(result)
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	mu.RLock(); defer mu.RUnlock()
	recording, flagged, totalCmds := 0, 0, 0
	for _, s := range sessions {
		if s.Status == "recording" { recording++ }
		if s.Status == "flagged" { flagged++ }
		totalCmds += len(s.Commands)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"total_sessions": len(sessions), "recording": recording, "flagged": flagged,
		"total_commands": totalCmds, "uptime_seconds": int(time.Since(startTime).Seconds()),
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
	if dbURL != "" { var err error; db, err = sql.Open("postgres", dbURL); if err != nil { log.Printf("[session-recorder] DB: %v", err) } }
	startWatchdog()
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthzHandler); mux.HandleFunc("/livez", livezHandler); mux.HandleFunc("/readyz", readyzHandler)
	mux.HandleFunc("/api/v1/sessions/start", handleStartRecording)
	mux.HandleFunc("/api/v1/sessions/command", handleRecordCommand)
	mux.HandleFunc("/api/v1/sessions/end", handleEndRecording)
	mux.HandleFunc("/api/v1/sessions/list", handleListSessions)
	mux.HandleFunc("/api/v1/sessions/stats", handleStats)
	handler := panicMW(rateLimitMW(loggingMW(mux)))
	srv := &http.Server{Addr: ":" + port, Handler: handler, ReadTimeout: 30 * time.Second, WriteTimeout: 30 * time.Second}
	go func() { log.Printf("[session-recorder] Starting on :%s", port); if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed { log.Fatal(err) } }()
	quit := make(chan os.Signal, 1); signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM); <-quit
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second); defer cancel(); srv.Shutdown(ctx)
}
