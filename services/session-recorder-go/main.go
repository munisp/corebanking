// 54Bank Session Recorder — Go
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
	"strings"
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
	ID           string    `json:"id"`
	UserID       string    `json:"user_id"`
	SessionType  string    `json:"session_type"`
	TargetHost   string    `json:"target_host"`
	Status       string    `json:"status"`
	StartedAt    time.Time `json:"started_at"`
	EndedAt      time.Time `json:"ended_at,omitempty"`
	Commands     []SessionCommand `json:"commands"`
	ChainHash    string    `json:"chain_hash"`
	BytesRecorded int64    `json:"bytes_recorded"`
	Flagged      bool      `json:"flagged"`
	FlagReason   string    `json:"flag_reason,omitempty"`
}

type SessionCommand struct {
	Seq       int       `json:"seq"`
	Timestamp time.Time `json:"timestamp"`
	Command   string    `json:"command"`
	Output    string    `json:"output"`
	Hash      string    `json:"hash"`
	Dangerous bool      `json:"dangerous"`
}

var dangerousPatterns = []string{
	"DROP TABLE", "DROP DATABASE", "DELETE FROM", "TRUNCATE",
	"rm -rf", "chmod 777", "iptables -F", "shutdown", "reboot",
	"ALTER USER", "GRANT ALL", "pg_dump", "mysqldump", "scp ", "rsync ",
	"curl | bash", "wget | sh", "base64 -d",
}

var (
	mu             sync.RWMutex
	db             *sql.DB
	sessionCounter uint64
)

func initSchema() {
	if db == nil { return }
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	for _, q := range []string{
		`CREATE TABLE IF NOT EXISTS recorded_sessions (
			id TEXT PRIMARY KEY, user_id TEXT NOT NULL, session_type TEXT,
			target_host TEXT, status TEXT NOT NULL DEFAULT 'active',
			started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), ended_at TIMESTAMPTZ,
			commands JSONB DEFAULT '[]', chain_hash TEXT, bytes_recorded BIGINT DEFAULT 0,
			flagged BOOLEAN DEFAULT FALSE, flag_reason TEXT)`,
		`CREATE INDEX IF NOT EXISTS idx_rec_sess_user ON recorded_sessions(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_rec_sess_status ON recorded_sessions(status)`,
	} {
		if _, err := db.ExecContext(ctx, q); err != nil {
			log.Printf("[session-recorder] schema: %v", err)
		}
	}
	log.Println("[session-recorder] PostgreSQL schema initialized")
}

func dbSaveSession(s *RecordedSession) {
	if db == nil { return }
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cmdsJSON, _ := json.Marshal(s.Commands)
	db.ExecContext(ctx, `INSERT INTO recorded_sessions (id, user_id, session_type, target_host, status, started_at, ended_at, commands, chain_hash, bytes_recorded, flagged, flag_reason)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, ended_at=EXCLUDED.ended_at, commands=EXCLUDED.commands, chain_hash=EXCLUDED.chain_hash, bytes_recorded=EXCLUDED.bytes_recorded, flagged=EXCLUDED.flagged, flag_reason=EXCLUDED.flag_reason`,
		s.ID, s.UserID, s.SessionType, s.TargetHost, s.Status, s.StartedAt, nullTime(s.EndedAt),
		string(cmdsJSON), s.ChainHash, s.BytesRecorded, s.Flagged, s.FlagReason)
}

func dbLoadSession(id string) *RecordedSession {
	if db == nil { return nil }
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	row := db.QueryRowContext(ctx, `SELECT id, user_id, session_type, target_host, status, started_at, ended_at, commands, COALESCE(chain_hash,''), bytes_recorded, flagged, COALESCE(flag_reason,'') FROM recorded_sessions WHERE id=$1`, id)
	var s RecordedSession
	var cmdsJSON string
	var endedAt sql.NullTime
	if err := row.Scan(&s.ID, &s.UserID, &s.SessionType, &s.TargetHost, &s.Status, &s.StartedAt, &endedAt, &cmdsJSON, &s.ChainHash, &s.BytesRecorded, &s.Flagged, &s.FlagReason); err != nil {
		return nil
	}
	json.Unmarshal([]byte(cmdsJSON), &s.Commands)
	if endedAt.Valid { s.EndedAt = endedAt.Time }
	return &s
}

func dbListSessions() []*RecordedSession {
	if db == nil { return nil }
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	rows, err := db.QueryContext(ctx, `SELECT id, user_id, session_type, target_host, status, started_at, ended_at, commands, COALESCE(chain_hash,''), bytes_recorded, flagged, COALESCE(flag_reason,'') FROM recorded_sessions ORDER BY started_at DESC LIMIT 1000`)
	if err != nil { return nil }
	defer rows.Close()
	var result []*RecordedSession
	for rows.Next() {
		var s RecordedSession
		var cmdsJSON string
		var endedAt sql.NullTime
		if rows.Scan(&s.ID, &s.UserID, &s.SessionType, &s.TargetHost, &s.Status, &s.StartedAt, &endedAt, &cmdsJSON, &s.ChainHash, &s.BytesRecorded, &s.Flagged, &s.FlagReason) != nil { continue }
		json.Unmarshal([]byte(cmdsJSON), &s.Commands)
		if endedAt.Valid { s.EndedAt = endedAt.Time }
		result = append(result, &s)
	}
	return result
}

func nullTime(t time.Time) interface{} { if t.IsZero() { return nil }; return t }

func startSession(userID, sessionType, targetHost string) (*RecordedSession, error) {
	mu.Lock()
	defer mu.Unlock()
	atomic.AddUint64(&sessionCounter, 1)
	s := &RecordedSession{
		ID: fmt.Sprintf("SESS-%d-%s", atomic.LoadUint64(&sessionCounter), secureRandHex(4)),
		UserID: userID, SessionType: sessionType, TargetHost: targetHost,
		Status: "recording", StartedAt: time.Now(),
		Commands: make([]SessionCommand, 0), ChainHash: secureRandHex(16),
	}
	dbSaveSession(s)
	eventBus.Emit("session.started", map[string]interface{}{"session_id": s.ID, "user": userID, "type": sessionType, "target": targetHost})
	return s, nil
}

func recordCommand(sessionID, command, output string) error {
	mu.Lock()
	defer mu.Unlock()
	s := dbLoadSession(sessionID)
	if s == nil { return fmt.Errorf("session %s not found", sessionID) }
	if s.Status != "recording" { return fmt.Errorf("session %s is %s", sessionID, s.Status) }
	isDangerous := false
	for _, p := range dangerousPatterns {
		if strings.Contains(strings.ToUpper(command), strings.ToUpper(p)) { isDangerous = true; break }
	}
	hashInput := fmt.Sprintf("%s|%d|%s|%s", s.ChainHash, len(s.Commands), command, time.Now().Format(time.RFC3339Nano))
	h := sha256.Sum256([]byte(hashInput))
	cmd := SessionCommand{Seq: len(s.Commands) + 1, Timestamp: time.Now(), Command: command, Output: output, Hash: hex.EncodeToString(h[:]), Dangerous: isDangerous}
	s.Commands = append(s.Commands, cmd)
	s.ChainHash = cmd.Hash
	s.BytesRecorded += int64(len(command) + len(output))
	if isDangerous && !s.Flagged {
		s.Flagged = true
		s.FlagReason = fmt.Sprintf("Dangerous command detected: %s", command)
		eventBus.Emit("session.dangerous_command", map[string]interface{}{"session_id": sessionID, "user": s.UserID, "command": command, "severity": "HIGH"})
	}
	dbSaveSession(s)
	return nil
}

func endSession(sessionID string) error {
	mu.Lock()
	defer mu.Unlock()
	s := dbLoadSession(sessionID)
	if s == nil { return fmt.Errorf("session %s not found", sessionID) }
	s.Status = "completed"
	s.EndedAt = time.Now()
	dbSaveSession(s)
	eventBus.Emit("session.ended", map[string]interface{}{"session_id": sessionID, "user": s.UserID, "commands_recorded": len(s.Commands), "flagged": s.Flagged})
	return nil
}

func handleStartSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { http.Error(w, "method not allowed", 405); return }
	var body struct { UserID string `json:"user_id"`; SessionType string `json:"session_type"`; TargetHost string `json:"target_host"` }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil { http.Error(w, "invalid JSON", 400); return }
	s, err := startSession(body.UserID, body.SessionType, body.TargetHost)
	if err != nil { http.Error(w, err.Error(), 400); return }
	w.Header().Set("Content-Type", "application/json"); w.WriteHeader(201); json.NewEncoder(w).Encode(s)
}

func handleRecordCommand(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { http.Error(w, "method not allowed", 405); return }
	var body struct { SessionID string `json:"session_id"`; Command string `json:"command"`; Output string `json:"output"` }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil { http.Error(w, "invalid JSON", 400); return }
	if err := recordCommand(body.SessionID, body.Command, body.Output); err != nil { http.Error(w, err.Error(), 400); return }
	w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(map[string]string{"status": "recorded"})
}

func handleEndSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { http.Error(w, "method not allowed", 405); return }
	var body struct { SessionID string `json:"session_id"` }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil { http.Error(w, "invalid JSON", 400); return }
	if err := endSession(body.SessionID); err != nil { http.Error(w, err.Error(), 400); return }
	w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(map[string]string{"status": "ended"})
}

func handleListSessions(w http.ResponseWriter, r *http.Request) {
	result := dbListSessions()
	if result == nil { result = make([]*RecordedSession, 0) }
	w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(result)
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	sessions := dbListSessions()
	active, completed, flagged := 0, 0, 0
	var totalBytes int64
	for _, s := range sessions {
		if s.Status == "recording" { active++ } else { completed++ }
		if s.Flagged { flagged++ }
		totalBytes += s.BytesRecorded
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"total_sessions": len(sessions), "active": active, "completed": completed,
		"flagged": flagged, "total_bytes_recorded": totalBytes,
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
		if err != nil { log.Printf("[session-recorder] DB: %v", err)
		} else {
			db.SetMaxOpenConns(25); db.SetMaxIdleConns(5); db.SetConnMaxLifetime(5*time.Minute)
			if err := db.Ping(); err != nil { log.Printf("[session-recorder] DB ping: %v", err) } else { initSchema() }
		}
	} else { log.Println("[session-recorder] WARNING: DATABASE_URL not set") }
	startWatchdog()
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthzHandler); mux.HandleFunc("/livez", livezHandler); mux.HandleFunc("/readyz", readyzHandler)
	mux.HandleFunc("/api/v1/session/start", handleStartSession)
	mux.HandleFunc("/api/v1/session/record", handleRecordCommand)
	mux.HandleFunc("/api/v1/session/end", handleEndSession)
	mux.HandleFunc("/api/v1/session/list", handleListSessions)
	mux.HandleFunc("/api/v1/session/stats", handleStats)
	handler := panicMW(rateLimitMW(loggingMW(mux)))
	srv := &http.Server{Addr: ":" + port, Handler: handler, ReadTimeout: 30 * time.Second, WriteTimeout: 30 * time.Second}
	go func() { log.Printf("[session-recorder] Starting on :%s", port); if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed { log.Fatal(err) } }()
	quit := make(chan os.Signal, 1); signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM); <-quit
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second); defer cancel(); srv.Shutdown(ctx)
}
