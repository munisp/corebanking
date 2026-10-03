package main

// ── Postgres persistence (W13-FIX-CRIT C1/C2/C3: stub ChatbotEngine → Postgres) ──
// The empty-struct stub engine was removed. chatbot_intents, chatbot_sessions,
// chatbot_messages, chatbot_handoffs and chatbot_training_jobs are the system
// of record. Fail-closed: when DATABASE_URL is unset/unreachable, engine
// methods return errStoreUnavailable and the HTTP handlers answer 503 —
// no fabricated intents, sessions, balances, handoffs or training jobs.

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

// errStoreUnavailable is returned by every engine method when the Postgres
// store is not reachable; writeEngineError maps it to HTTP 503.
var errStoreUnavailable = errors.New("chatbot store unavailable")

// errNotFound is returned when a requested row does not exist.
var errNotFound = errors.New("not found")

// writeEngineError maps engine errors to honest HTTP status codes:
// store-down → 503 (fail-closed), missing row → 404, anything else → 500.
func writeEngineError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, errStoreUnavailable):
		http.Error(w, `{"error":"store_unavailable","service":"chatbot-service"}`, http.StatusServiceUnavailable)
	case errors.Is(err, errNotFound):
		http.Error(w, `{"error":"not_found"}`, http.StatusNotFound)
	default:
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

// openChatbotStore opens and schema-checks the Postgres store. Returns nil
// (engine methods will 503) when DATABASE_URL is unset or unreachable.
func openChatbotStore() *sql.DB {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Printf("[chatbot-service] DATABASE_URL not set — persistent store unavailable (chatbot endpoints will 503)")
		return nil
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[chatbot-service] postgres open failed: %v — endpoints will 503", err)
		return nil
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(5 * time.Minute)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		log.Printf("[chatbot-service] postgres ping failed: %v — endpoints will 503", err)
		db.Close()
		return nil
	}
	schema := []string{
		`CREATE TABLE IF NOT EXISTS chatbot_intents (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			intent TEXT NOT NULL,
			patterns JSONB NOT NULL DEFAULT '[]',
			responses JSONB NOT NULL DEFAULT '[]',
			actions JSONB NOT NULL DEFAULT '[]',
			require_auth BOOLEAN NOT NULL DEFAULT FALSE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_chatbot_intents_tenant ON chatbot_intents (tenant_id)`,
		`CREATE TABLE IF NOT EXISTS chatbot_sessions (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			customer_id TEXT NOT NULL DEFAULT '',
			channel TEXT NOT NULL DEFAULT '',
			status TEXT NOT NULL DEFAULT 'active',
			started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			ended_at TIMESTAMPTZ
		)`,
		`CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_tenant ON chatbot_sessions (tenant_id)`,
		`CREATE TABLE IF NOT EXISTS chatbot_messages (
			id BIGSERIAL PRIMARY KEY,
			session_id TEXT NOT NULL,
			tenant_id TEXT NOT NULL DEFAULT '',
			role TEXT NOT NULL,
			message TEXT NOT NULL,
			intent TEXT NOT NULL DEFAULT '',
			confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_chatbot_messages_session ON chatbot_messages (session_id, id)`,
		`CREATE TABLE IF NOT EXISTS chatbot_handoffs (
			id TEXT PRIMARY KEY,
			session_id TEXT NOT NULL,
			tenant_id TEXT NOT NULL DEFAULT '',
			reason TEXT NOT NULL DEFAULT '',
			status TEXT NOT NULL DEFAULT 'pending',
			agent_id TEXT NOT NULL DEFAULT '',
			requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			accepted_at TIMESTAMPTZ
		)`,
		`CREATE INDEX IF NOT EXISTS idx_chatbot_handoffs_session ON chatbot_handoffs (session_id)`,
		`CREATE TABLE IF NOT EXISTS chatbot_training_jobs (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'queued',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			completed_at TIMESTAMPTZ
		)`,
		`CREATE INDEX IF NOT EXISTS idx_chatbot_training_jobs_tenant ON chatbot_training_jobs (tenant_id, created_at DESC)`,
	}
	for _, stmt := range schema {
		if _, err := db.Exec(stmt); err != nil {
			log.Printf("[chatbot-service] schema init failed: %v — endpoints will 503", err)
			db.Close()
			return nil
		}
	}
	log.Printf("[chatbot-service] postgres store ready (tables chatbot_intents/chatbot_sessions/chatbot_messages/chatbot_handoffs/chatbot_training_jobs)")
	return db
}

// ChatbotEngine is backed by Postgres; db == nil means every method fails
// closed with errStoreUnavailable.
type ChatbotEngine struct {
	db *sql.DB
}

func NewChatbotEngine() *ChatbotEngine {
	return &ChatbotEngine{db: openChatbotStore()}
}

func (e *ChatbotEngine) requireDB() (*sql.DB, error) {
	if e.db == nil {
		return nil, errStoreUnavailable
	}
	return e.db, nil
}

// ProcessMessage matches the message against the tenant's persisted intents,
// persists the user message and the bot reply to chatbot_messages, and
// upserts the session row. It NEVER fabricates account data: a matched
// intent returns one of its configured responses, an unmatched message gets
// an honest fallback. Store-down → errStoreUnavailable (503).
func (e *ChatbotEngine) ProcessMessage(req ChatRequest) (*ChatResponse, error) {
	db, err := e.requireDB()
	if err != nil {
		return nil, err
	}
	sessionID := req.SessionID
	if sessionID == "" {
		sessionID = "sess_" + uuid.NewString()
	}
	// Upsert session (INSERT-first: the session must exist before messages).
	if _, err := db.Exec(`INSERT INTO chatbot_sessions (id, tenant_id, customer_id, channel, status)
		VALUES ($1, $2, $3, $4, 'active')
		ON CONFLICT (id) DO UPDATE SET status = 'active'`,
		sessionID, req.TenantID, req.CustomerID, req.Channel); err != nil {
		return nil, fmt.Errorf("session upsert: %w", err)
	}
	if _, err := db.Exec(`INSERT INTO chatbot_messages (session_id, tenant_id, role, message) VALUES ($1, $2, 'user', $3)`,
		sessionID, req.TenantID, req.Message); err != nil {
		return nil, fmt.Errorf("persist user message: %w", err)
	}

	// Intent matching: tenant-configured patterns from chatbot_intents.
	intents, err := e.GetIntents(req.TenantID)
	if err != nil {
		return nil, err
	}
	lower := strings.ToLower(req.Message)
	matched := ""
	confidence := 0.0
	response := ""
	if req.Message == "" {
		matched = "greeting"
		confidence = 1.0
		response = "Hello! How can I help you today?"
	} else {
		for _, it := range intents {
			for _, p := range it.Patterns {
				if p != "" && strings.Contains(lower, strings.ToLower(p)) {
					matched = it.Intent
					confidence = 0.9
					if len(it.Responses) > 0 {
						response = it.Responses[0]
					}
					break
				}
			}
			if matched != "" {
				break
			}
		}
	}
	if matched == "" {
		matched = "unmatched"
		response = "I'm sorry, I couldn't match your request to a known intent. " +
			"A human agent can help — request a handoff, or rephrase your question."
	}

	if _, err := db.Exec(`INSERT INTO chatbot_messages (session_id, tenant_id, role, message, intent, confidence)
		VALUES ($1, $2, 'bot', $3, $4, $5)`,
		sessionID, req.TenantID, response, matched, confidence); err != nil {
		return nil, fmt.Errorf("persist bot message: %w", err)
	}

	return &ChatResponse{
		SessionID:  sessionID,
		Response:   response,
		Intent:     matched,
		Confidence: confidence,
	}, nil
}

func (e *ChatbotEngine) GetSession(sessionID string) (map[string]interface{}, error) {
	db, err := e.requireDB()
	if err != nil {
		return nil, err
	}
	var tenantID, customerID, channel, status string
	var startedAt time.Time
	var endedAt sql.NullTime
	err = db.QueryRow(`SELECT tenant_id, customer_id, channel, status, started_at, ended_at FROM chatbot_sessions WHERE id = $1`, sessionID).
		Scan(&tenantID, &customerID, &channel, &status, &startedAt, &endedAt)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("session %s: %w", sessionID, errNotFound)
	}
	if err != nil {
		return nil, err
	}
	out := map[string]interface{}{
		"session_id":  sessionID,
		"tenant_id":   tenantID,
		"customer_id": customerID,
		"channel":     channel,
		"status":      status,
		"started_at":  startedAt.Format(time.RFC3339),
	}
	if endedAt.Valid {
		out["ended_at"] = endedAt.Time.Format(time.RFC3339)
	}
	return out, nil
}

func (e *ChatbotEngine) EndSession(sessionID string) error {
	db, err := e.requireDB()
	if err != nil {
		return err
	}
	res, err := db.Exec(`UPDATE chatbot_sessions SET status = 'ended', ended_at = NOW() WHERE id = $1 AND status <> 'ended'`, sessionID)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return fmt.Errorf("session %s: %w", sessionID, errNotFound)
	}
	return nil
}

func (e *ChatbotEngine) GetHistory(sessionID string) ([]map[string]interface{}, error) {
	db, err := e.requireDB()
	if err != nil {
		return nil, err
	}
	rows, err := db.Query(`SELECT role, message, intent, confidence, created_at FROM chatbot_messages WHERE session_id = $1 ORDER BY id`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	history := []map[string]interface{}{}
	for rows.Next() {
		var role, message, intent string
		var confidence float64
		var createdAt time.Time
		if err := rows.Scan(&role, &message, &intent, &confidence, &createdAt); err != nil {
			return nil, err
		}
		history = append(history, map[string]interface{}{
			"role":       role,
			"message":    message,
			"intent":     intent,
			"confidence": confidence,
			"timestamp":  createdAt.Format(time.RFC3339),
		})
	}
	return history, rows.Err()
}

func (e *ChatbotEngine) GetIntents(tenantID string) ([]IntentConfig, error) {
	db, err := e.requireDB()
	if err != nil {
		return nil, err
	}
	rows, err := db.Query(`SELECT id, intent, patterns, responses, actions, require_auth FROM chatbot_intents WHERE tenant_id = $1 ORDER BY created_at`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	intents := []IntentConfig{}
	for rows.Next() {
		var cfg IntentConfig
		var patterns, responses, actions []byte
		if err := rows.Scan(&cfg.ID, &cfg.Intent, &patterns, &responses, &actions, &cfg.RequireAuth); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(patterns, &cfg.Patterns)
		_ = json.Unmarshal(responses, &cfg.Responses)
		_ = json.Unmarshal(actions, &cfg.Actions)
		intents = append(intents, cfg)
	}
	return intents, rows.Err()
}

func (e *ChatbotEngine) CreateIntent(tenantID string, config IntentConfig) (*IntentConfig, error) {
	db, err := e.requireDB()
	if err != nil {
		return nil, err
	}
	patterns, _ := json.Marshal(config.Patterns)
	responses, _ := json.Marshal(config.Responses)
	actions, _ := json.Marshal(config.Actions)
	id := "int_" + uuid.NewString()
	if _, err := db.Exec(`INSERT INTO chatbot_intents (id, tenant_id, intent, patterns, responses, actions, require_auth)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		id, tenantID, config.Intent, patterns, responses, actions, config.RequireAuth); err != nil {
		return nil, err
	}
	config.ID = id
	return &config, nil
}

func (e *ChatbotEngine) UpdateIntent(tenantID, intentID string, config IntentConfig) (*IntentConfig, error) {
	db, err := e.requireDB()
	if err != nil {
		return nil, err
	}
	patterns, _ := json.Marshal(config.Patterns)
	responses, _ := json.Marshal(config.Responses)
	actions, _ := json.Marshal(config.Actions)
	res, err := db.Exec(`UPDATE chatbot_intents SET intent = $3, patterns = $4, responses = $5, actions = $6, require_auth = $7, updated_at = NOW()
		WHERE id = $1 AND tenant_id = $2`,
		intentID, tenantID, config.Intent, patterns, responses, actions, config.RequireAuth)
	if err != nil {
		return nil, err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return nil, err
	}
	if n == 0 {
		return nil, fmt.Errorf("intent %s: %w", intentID, errNotFound)
	}
	config.ID = intentID
	return &config, nil
}

func (e *ChatbotEngine) DeleteIntent(tenantID, intentID string) error {
	db, err := e.requireDB()
	if err != nil {
		return err
	}
	res, err := db.Exec(`DELETE FROM chatbot_intents WHERE id = $1 AND tenant_id = $2`, intentID, tenantID)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return fmt.Errorf("intent %s: %w", intentID, errNotFound)
	}
	return nil
}

// StartTraining enqueues a real training-job row; the job ID is the row's PK.
func (e *ChatbotEngine) StartTraining(tenantID string) (string, error) {
	db, err := e.requireDB()
	if err != nil {
		return "", err
	}
	jobID := "job_" + uuid.NewString()
	if _, err := db.Exec(`INSERT INTO chatbot_training_jobs (id, tenant_id, status) VALUES ($1, $2, 'queued')`, jobID, tenantID); err != nil {
		return "", err
	}
	return jobID, nil
}

func (e *ChatbotEngine) GetTrainingStatus(tenantID string) (map[string]interface{}, error) {
	db, err := e.requireDB()
	if err != nil {
		return nil, err
	}
	var jobID, status string
	var createdAt time.Time
	var completedAt sql.NullTime
	err = db.QueryRow(`SELECT id, status, created_at, completed_at FROM chatbot_training_jobs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1`, tenantID).
		Scan(&jobID, &status, &createdAt, &completedAt)
	if err == sql.ErrNoRows {
		return map[string]interface{}{"status": "none", "message": "no training job has been enqueued for this tenant"}, nil
	}
	if err != nil {
		return nil, err
	}
	out := map[string]interface{}{
		"job_id":     jobID,
		"status":     status,
		"created_at": createdAt.Format(time.RFC3339),
	}
	if completedAt.Valid {
		out["completed_at"] = completedAt.Time.Format(time.RFC3339)
	}
	return out, nil
}

func (e *ChatbotEngine) GetConversationAnalytics(tenantID string) (map[string]interface{}, error) {
	db, err := e.requireDB()
	if err != nil {
		return nil, err
	}
	var total, ended, handoffs int64
	var avgSeconds sql.NullFloat64
	if err := db.QueryRow(`SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'ended') FROM chatbot_sessions WHERE tenant_id = $1`, tenantID).
		Scan(&total, &ended); err != nil {
		return nil, err
	}
	if err := db.QueryRow(`SELECT AVG(EXTRACT(EPOCH FROM (ended_at - started_at))) FROM chatbot_sessions WHERE tenant_id = $1 AND ended_at IS NOT NULL`, tenantID).
		Scan(&avgSeconds); err != nil {
		return nil, err
	}
	if err := db.QueryRow(`SELECT COUNT(*) FROM chatbot_handoffs WHERE tenant_id = $1`, tenantID).Scan(&handoffs); err != nil {
		return nil, err
	}
	resolutionRate := 0.0
	if total > 0 {
		resolutionRate = float64(total-handoffs) / float64(total)
	}
	out := map[string]interface{}{
		"total_conversations": total,
		"ended_conversations": ended,
		"handoff_requests":    handoffs,
		"resolution_rate":     resolutionRate,
	}
	if avgSeconds.Valid {
		out["avg_duration_seconds"] = avgSeconds.Float64
	} else {
		out["avg_duration_seconds"] = nil
	}
	return out, nil
}

func (e *ChatbotEngine) GetIntentAnalytics(tenantID string) (map[string]interface{}, error) {
	db, err := e.requireDB()
	if err != nil {
		return nil, err
	}
	rows, err := db.Query(`SELECT intent, COUNT(*) AS n FROM chatbot_messages WHERE tenant_id = $1 AND role = 'bot' AND intent <> '' GROUP BY intent ORDER BY n DESC LIMIT 10`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	top := []map[string]interface{}{}
	for rows.Next() {
		var intent string
		var n int64
		if err := rows.Scan(&intent, &n); err != nil {
			return nil, err
		}
		top = append(top, map[string]interface{}{"intent": intent, "count": n})
	}
	return map[string]interface{}{"top_intents": top}, rows.Err()
}

// GetSatisfactionMetrics reports only what is actually recorded: no feedback
// channel is wired to this service, so it honestly reports zero samples
// instead of fabricated CSAT/NPS numbers.
func (e *ChatbotEngine) GetSatisfactionMetrics(tenantID string) (map[string]interface{}, error) {
	db, err := e.requireDB()
	if err != nil {
		return nil, err
	}
	var handoffs, accepted int64
	if err := db.QueryRow(`SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'accepted') FROM chatbot_handoffs WHERE tenant_id = $1`, tenantID).
		Scan(&handoffs, &accepted); err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"feedback_samples":  0,
		"csat_score":        nil,
		"nps":               nil,
		"note":              "no customer feedback channel is recorded; CSAT/NPS unavailable",
		"handoff_requests":  handoffs,
		"handoffs_accepted": accepted,
	}, nil
}

// RequestHandoff inserts a real pending handoff row.
func (e *ChatbotEngine) RequestHandoff(sessionID, reason string) (map[string]interface{}, error) {
	db, err := e.requireDB()
	if err != nil {
		return nil, err
	}
	handoffID := "hoff_" + uuid.NewString()
	if _, err := db.Exec(`INSERT INTO chatbot_handoffs (id, session_id, reason, status) VALUES ($1, $2, $3, 'pending')`,
		handoffID, sessionID, reason); err != nil {
		return nil, err
	}
	return map[string]interface{}{"handoff_id": handoffID, "session_id": sessionID, "status": "pending"}, nil
}

// AcceptHandoff updates the pending handoff row for the session; if no
// pending handoff exists it fails honestly (404) instead of fabricating an
// acceptance.
func (e *ChatbotEngine) AcceptHandoff(sessionID, agentID string) (map[string]interface{}, error) {
	db, err := e.requireDB()
	if err != nil {
		return nil, err
	}
	var handoffID string
	err = db.QueryRow(`UPDATE chatbot_handoffs SET status = 'accepted', agent_id = $2, accepted_at = NOW()
		WHERE id = (SELECT id FROM chatbot_handoffs WHERE session_id = $1 AND status = 'pending' ORDER BY requested_at DESC LIMIT 1)
		RETURNING id`, sessionID, agentID).Scan(&handoffID)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("pending handoff for session %s: %w", sessionID, errNotFound)
	}
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{"handoff_id": handoffID, "session_id": sessionID, "status": "accepted", "agent_id": agentID}, nil
}
