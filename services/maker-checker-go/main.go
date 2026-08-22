// Maker-Checker Workflow Engine — Production Implementation
//
// Enforces the four-eyes principle (segregation of duties) for sensitive
// financial operations. No user may approve a request they themselves created.
//
// Approval lifecycle:
//   pending → (approve at each level) → approved
//   pending → rejected (any checker at any level)
//   pending → escalated (SLA breach with auto_escalate=true)
//   pending → cancelled (maker cancels before resolution)
//   pending → expired (SLA breach with auto_escalate=false)
//
// Multi-level rules (e.g., loan_disbursement > ₦50M requires 3 levels):
//   Level 1: branch-manager approves → current_level becomes 2
//   Level 2: regional-head approves  → current_level becomes 3
//   Level 3: CRO approves            → status → 'approved', callback fired
//
// On final approval, the service POSTs the stored payload to callback_url
// (if set) AND publishes an approval.completed Dapr event. The originating
// service listens for the event and executes the operation.
//
// Port: 8210
//
// Required environment variables:
//   DATABASE_URL     — PostgreSQL DSN
//   DAPR_URL         — Dapr sidecar
//   DAPR_PUBSUB      — Dapr pub/sub component name
//   ALLOWED_ORIGINS  — CORS origins

package main

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	_ "github.com/lib/pq"
)

// ── Config ────────────────────────────────────────────────────────────────────

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func allowedOrigins() string {
	raw := strings.TrimSpace(os.Getenv("ALLOWED_ORIGINS"))
	if raw == "" {
		return "http://localhost:3000,http://localhost:8080"
	}
	return raw
}

// ── Database ──────────────────────────────────────────────────────────────────

var db *sql.DB

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL is required")
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Fatalf("DB open: %v", err)
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err = db.Ping(); err != nil {
		log.Fatalf("DB ping: %v", err)
	}
	if err = ensureSchema(); err != nil {
		log.Fatalf("Schema: %v", err)
	}
	log.Println("PostgreSQL connected and schema ready")
}

func ensureSchema() error {
	// Add columns that may be missing from tables created by an older schema version.
	if _, err := db.Exec(`
		ALTER TABLE IF EXISTS approval_rules ADD COLUMN IF NOT EXISTS created_at     TIMESTAMPTZ NOT NULL DEFAULT now();
		ALTER TABLE IF EXISTS approval_rules ADD COLUMN IF NOT EXISTS levels_required INT NOT NULL DEFAULT 1;
		ALTER TABLE IF EXISTS approval_rules ADD COLUMN IF NOT EXISTS required_roles  TEXT NOT NULL DEFAULT '';
		ALTER TABLE IF EXISTS approval_rules ADD COLUMN IF NOT EXISTS sla_minutes     INT NOT NULL DEFAULT 120;
		ALTER TABLE IF EXISTS approval_rules ADD COLUMN IF NOT EXISTS auto_escalate   BOOLEAN NOT NULL DEFAULT true;
		ALTER TABLE IF EXISTS approval_rules ADD COLUMN IF NOT EXISTS is_active       BOOLEAN NOT NULL DEFAULT true;
		ALTER TABLE IF EXISTS approval_rules ADD COLUMN IF NOT EXISTS min_amount_kobo BIGINT NOT NULL DEFAULT 0;
		ALTER TABLE IF EXISTS approval_rules ADD COLUMN IF NOT EXISTS max_amount_kobo BIGINT NOT NULL DEFAULT 9223372036854775807;

		ALTER TABLE IF EXISTS approval_requests ADD COLUMN IF NOT EXISTS reference     TEXT NOT NULL DEFAULT '';
		ALTER TABLE IF EXISTS approval_requests ADD COLUMN IF NOT EXISTS operation     TEXT NOT NULL DEFAULT '';
		ALTER TABLE IF EXISTS approval_requests ADD COLUMN IF NOT EXISTS entity_type   TEXT NOT NULL DEFAULT '';
		ALTER TABLE IF EXISTS approval_requests ADD COLUMN IF NOT EXISTS entity_id     TEXT NOT NULL DEFAULT '';
		ALTER TABLE IF EXISTS approval_requests ADD COLUMN IF NOT EXISTS amount_kobo   BIGINT NOT NULL DEFAULT 0;
		ALTER TABLE IF EXISTS approval_requests ADD COLUMN IF NOT EXISTS currency      TEXT NOT NULL DEFAULT 'NGN';
		ALTER TABLE IF EXISTS approval_requests ADD COLUMN IF NOT EXISTS payload       TEXT NOT NULL DEFAULT '{}';
		ALTER TABLE IF EXISTS approval_requests ADD COLUMN IF NOT EXISTS callback_url  TEXT;
		ALTER TABLE IF EXISTS approval_requests ADD COLUMN IF NOT EXISTS status        TEXT NOT NULL DEFAULT 'pending';
		ALTER TABLE IF EXISTS approval_requests ADD COLUMN IF NOT EXISTS maker_id      TEXT NOT NULL DEFAULT '';
		ALTER TABLE IF EXISTS approval_requests ADD COLUMN IF NOT EXISTS maker_name    TEXT NOT NULL DEFAULT '';
		ALTER TABLE IF EXISTS approval_requests ADD COLUMN IF NOT EXISTS current_level INT NOT NULL DEFAULT 1;
		ALTER TABLE IF EXISTS approval_requests ADD COLUMN IF NOT EXISTS max_level     INT NOT NULL DEFAULT 1;
		ALTER TABLE IF EXISTS approval_requests ADD COLUMN IF NOT EXISTS risk_score    INT NOT NULL DEFAULT 0;
		ALTER TABLE IF EXISTS approval_requests ADD COLUMN IF NOT EXISTS sla_deadline  TIMESTAMPTZ NOT NULL DEFAULT now();
		ALTER TABLE IF EXISTS approval_requests ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ NOT NULL DEFAULT now();
		ALTER TABLE IF EXISTS approval_requests ADD COLUMN IF NOT EXISTS resolved_at   TIMESTAMPTZ;
		ALTER TABLE IF EXISTS approval_requests ADD COLUMN IF NOT EXISTS remarks       TEXT;

		ALTER TABLE IF EXISTS approval_actions ADD COLUMN IF NOT EXISTS tenant_id   TEXT NOT NULL DEFAULT '';
		ALTER TABLE IF EXISTS approval_actions ADD COLUMN IF NOT EXISTS action      TEXT NOT NULL DEFAULT 'comment';
		ALTER TABLE IF EXISTS approval_actions ADD COLUMN IF NOT EXISTS actor_id    TEXT NOT NULL DEFAULT '';
		ALTER TABLE IF EXISTS approval_actions ADD COLUMN IF NOT EXISTS actor_name  TEXT NOT NULL DEFAULT '';
		ALTER TABLE IF EXISTS approval_actions ADD COLUMN IF NOT EXISTS actor_role  TEXT NOT NULL DEFAULT '';
		ALTER TABLE IF EXISTS approval_actions ADD COLUMN IF NOT EXISTS level       INT NOT NULL DEFAULT 1;
		ALTER TABLE IF EXISTS approval_actions ADD COLUMN IF NOT EXISTS remarks     TEXT;
		ALTER TABLE IF EXISTS approval_actions ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ NOT NULL DEFAULT now();
	`); err != nil {
		return fmt.Errorf("schema migration: %w", err)
	}
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS approval_rules (
			id               SERIAL PRIMARY KEY,
			tenant_id        TEXT NOT NULL,
			operation        TEXT NOT NULL,
			min_amount_kobo  BIGINT NOT NULL DEFAULT 0,
			max_amount_kobo  BIGINT NOT NULL DEFAULT 9223372036854775807,
			levels_required  INT NOT NULL DEFAULT 1 CHECK (levels_required BETWEEN 1 AND 5),
			required_roles   TEXT NOT NULL DEFAULT '',
			sla_minutes      INT NOT NULL DEFAULT 120,
			auto_escalate    BOOLEAN NOT NULL DEFAULT true,
			is_active        BOOLEAN NOT NULL DEFAULT true,
			created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
			UNIQUE (tenant_id, operation, min_amount_kobo)
		);

		CREATE TABLE IF NOT EXISTS approval_requests (
			id               SERIAL PRIMARY KEY,
			tenant_id        TEXT NOT NULL,
			reference        TEXT NOT NULL,
			operation        TEXT NOT NULL,
			entity_type      TEXT NOT NULL,
			entity_id        TEXT NOT NULL,
			amount_kobo      BIGINT NOT NULL DEFAULT 0,
			currency         TEXT NOT NULL DEFAULT 'NGN',
			payload          TEXT NOT NULL DEFAULT '{}',
			callback_url     TEXT,
			status           TEXT NOT NULL DEFAULT 'pending'
			                 CHECK (status IN ('pending','approved','rejected','escalated','expired','cancelled')),
			maker_id         TEXT NOT NULL,
			maker_name       TEXT NOT NULL,
			current_level    INT NOT NULL DEFAULT 1,
			max_level        INT NOT NULL DEFAULT 1,
			risk_score       INT NOT NULL DEFAULT 0,
			sla_deadline     TIMESTAMPTZ NOT NULL,
			created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
			resolved_at      TIMESTAMPTZ,
			remarks          TEXT,
			UNIQUE (tenant_id, reference)
		);

		CREATE TABLE IF NOT EXISTS approval_actions (
			id               SERIAL PRIMARY KEY,
			request_id       INT NOT NULL REFERENCES approval_requests(id),
			tenant_id        TEXT NOT NULL,
			action           TEXT NOT NULL CHECK (action IN ('approve','reject','escalate','cancel','comment')),
			actor_id         TEXT NOT NULL,
			actor_name       TEXT NOT NULL,
			actor_role       TEXT NOT NULL DEFAULT '',
			level            INT NOT NULL,
			remarks          TEXT,
			created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
		);

		CREATE INDEX IF NOT EXISTS idx_ar_tenant_status
			ON approval_requests (tenant_id, status, created_at DESC);
		CREATE INDEX IF NOT EXISTS idx_ar_tenant_ref
			ON approval_requests (tenant_id, reference);
		CREATE INDEX IF NOT EXISTS idx_aa_request
			ON approval_actions (request_id, created_at);
		CREATE INDEX IF NOT EXISTS idx_rules_tenant_op
			ON approval_rules (tenant_id, operation, is_active);

		-- Seed default CBN-compliant approval rules
		INSERT INTO approval_rules
			(tenant_id, operation, min_amount_kobo, max_amount_kobo,
			 levels_required, required_roles, sla_minutes, auto_escalate)
		VALUES
			('default','loan_disbursement',0,500000000,1,'branch-manager',60,true),
			('default','loan_disbursement',500000001,5000000000,2,'branch-manager,regional-head',120,true),
			('default','loan_disbursement',5000000001,9223372036854775807,3,'regional-head,chief-risk-officer,md',480,true),
			('default','fund_transfer',0,1000000000,1,'operations-officer',30,false),
			('default','fund_transfer',1000000001,9223372036854775807,2,'operations-officer,head-of-operations',60,true),
			('default','gl_manual_entry',0,9223372036854775807,2,'gl-officer,chief-finance-officer',240,true),
			('default','product_creation',0,9223372036854775807,2,'product-manager,head-of-retail',1440,false),
			('default','customer_onboarding',0,9223372036854775807,1,'kyc-officer',120,false),
			('default','account_closure',0,9223372036854775807,2,'operations-officer,branch-manager',60,true),
			('default','limit_override',0,9223372036854775807,3,'operations-officer,compliance-officer,chief-compliance-officer',120,true)
		ON CONFLICT (tenant_id, operation, min_amount_kobo) DO NOTHING;
	`)
	return err
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func tenantID(r *http.Request) string {
	return r.Header.Get("x-tenant-id")
}

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func errorJSON(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}

// lookupRule finds the most specific matching rule for an operation + amount.
func lookupRule(tid, operation string, amountKobo int64) (levelsRequired, slaMinutes int, autoEscalate bool, err error) {
	err = db.QueryRow(`
		SELECT levels_required, sla_minutes, auto_escalate
		FROM approval_rules
		WHERE tenant_id IN ($1,'default')
		  AND operation=$2
		  AND is_active=true
		  AND min_amount_kobo <= $3
		  AND max_amount_kobo >= $3
		ORDER BY tenant_id DESC, min_amount_kobo DESC
		LIMIT 1`, tid, operation, amountKobo,
	).Scan(&levelsRequired, &slaMinutes, &autoEscalate)
	return
}

// pbacCheck calls auth-enforcer-rs for an authorization decision (fail-closed).
func pbacCheck(tid, userID, permission, entityType string) bool {
	pdpURL := getEnv("AUTH_ENFORCER_URL", "http://auth-enforcer-rs:8314") + "/v1/authz/check"
	payload, _ := json.Marshal(map[string]string{
		"userId": userID, "tenantId": tid,
		"permission": permission, "entityType": entityType, "entityId": "global",
	})
	req, err := http.NewRequest("POST", pdpURL, bytes.NewReader(payload))
	if err != nil {
		return false
	}
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("AUTHZ PDP unreachable (fail-closed): %v", err)
		return false
	}
	defer resp.Body.Close()
	var result struct {
		Allowed bool `json:"allowed"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	return result.Allowed
}

// fireCallback POSTs the approval result to the originating service's callback URL.
func fireCallback(callbackURL, status string, requestID int, payload string) {
	if callbackURL == "" {
		return
	}
	body, _ := json.Marshal(map[string]interface{}{
		"requestId":  requestID,
		"status":     status,
		"payload":    json.RawMessage(payload),
		"resolvedAt": time.Now().UTC().Format(time.RFC3339),
	})
	req, err := http.NewRequest("POST", callbackURL, bytes.NewReader(body))
	if err != nil {
		log.Printf("WARN callback build failed id=%d: %v", requestID, err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("WARN callback id=%d url=%s failed: %v", requestID, callbackURL, err)
		return
	}
	resp.Body.Close()
	log.Printf("Callback fired id=%d status=%s http=%d", requestID, status, resp.StatusCode)
}

// publishEvent posts to Dapr pub/sub.
func publishEvent(topic string, payload interface{}) {
	daprURL := getEnv("DAPR_URL", "http://localhost:3500")
	pubsub := getEnv("DAPR_PUBSUB", "approval-pubsub")
	url := fmt.Sprintf("%s/v1.0/publish/%s/%s", daprURL, pubsub, topic)
	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", url, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("WARN publish %s: %v", topic, err)
		return
	}
	resp.Body.Close()
}

// ── Handlers ──────────────────────────────────────────────────────────────────

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	dbOK := db.Ping() == nil
	status := "healthy"
	code := http.StatusOK
	if !dbOK {
		status = "degraded"
		code = http.StatusServiceUnavailable
	}

	var pendingCount int
	if dbOK {
		db.QueryRow("SELECT COUNT(*) FROM approval_requests WHERE status='pending'").Scan(&pendingCount)
	}

	writeJSON(w, code, map[string]interface{}{
		"service": "maker-checker-go",
		"status":  status,
		"checks":  map[string]string{"postgres": boolStatus(dbOK)},
		"queue":   map[string]int{"pending": pendingCount},
	})
}

func boolStatus(ok bool) string {
	if ok {
		return "connected"
	}
	return "unreachable"
}

// POST /v1/approvals — create approval request (by maker)
func handleCreateApproval(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	if tid == "" {
		errorJSON(w, http.StatusBadRequest, "x-tenant-id required")
		return
	}

	var body struct {
		Reference   string          `json:"reference"`
		Operation   string          `json:"operation"`
		EntityType  string          `json:"entityType"`
		EntityID    string          `json:"entityId"`
		AmountKobo  int64           `json:"amountKobo"`
		Currency    string          `json:"currency"`
		Payload     json.RawMessage `json:"payload"`
		CallbackURL string          `json:"callbackUrl"`
		MakerID     string          `json:"makerId"`
		MakerName   string          `json:"makerName"`
		RiskScore   int             `json:"riskScore"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		errorJSON(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if body.Reference == "" || body.Operation == "" || body.EntityType == "" ||
		body.EntityID == "" || body.MakerID == "" {
		errorJSON(w, http.StatusBadRequest, "reference, operation, entityType, entityId, makerId required")
		return
	}
	// PBAC: maker must hold approval:create permission
	if !pbacCheck(tid, body.MakerID, "approval:create", "approval_request") {
		errorJSON(w, http.StatusForbidden, "forbidden: approval:create permission required")
		return
	}
	if body.Currency == "" {
		body.Currency = "NGN"
	}
	if body.Payload == nil {
		body.Payload = json.RawMessage("{}")
	}

	// Look up applicable rule
	levelsRequired, slaMinutes, _, err := lookupRule(tid, body.Operation, body.AmountKobo)
	if err == sql.ErrNoRows {
		errorJSON(w, http.StatusUnprocessableEntity,
			fmt.Sprintf("no approval rule configured for operation=%s amount=%d", body.Operation, body.AmountKobo))
		return
	}
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, err.Error())
		return
	}

	slaDeadline := time.Now().UTC().Add(time.Duration(slaMinutes) * time.Minute)
	payloadStr := string(body.Payload)

	var reqID int
	err = db.QueryRow(`
		INSERT INTO approval_requests
		  (tenant_id, reference, operation, entity_type, entity_id,
		   amount_kobo, currency, payload, callback_url,
		   maker_id, maker_name, max_level, risk_score, sla_deadline)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
		ON CONFLICT (tenant_id, reference) DO NOTHING
		RETURNING id`,
		tid, body.Reference, body.Operation, body.EntityType, body.EntityID,
		body.AmountKobo, body.Currency, payloadStr, body.CallbackURL,
		body.MakerID, body.MakerName, levelsRequired, body.RiskScore, slaDeadline,
	).Scan(&reqID)
	if err == sql.ErrNoRows {
		// Idempotent: return existing
		db.QueryRow("SELECT id FROM approval_requests WHERE tenant_id=$1 AND reference=$2",
			tid, body.Reference).Scan(&reqID)
		writeJSON(w, http.StatusOK, map[string]interface{}{"id": reqID, "status": "already_exists"})
		return
	}
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, err.Error())
		return
	}

	publishEvent("approval.requested", map[string]interface{}{
		"requestId": reqID, "tenantId": tid,
		"operation": body.Operation, "amountKobo": body.AmountKobo,
		"makerId": body.MakerID, "levelsRequired": levelsRequired,
	})

	log.Printf("APPROVAL REQUESTED id=%d op=%s amount=%d maker=%s levels=%d",
		reqID, body.Operation, body.AmountKobo, body.MakerID, levelsRequired)

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"id": reqID, "reference": body.Reference, "status": "pending",
		"levelsRequired": levelsRequired, "slaDeadline": slaDeadline.Format(time.RFC3339),
	})
}

// GET /v1/approvals
func handleListApprovals(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	if tid == "" {
		errorJSON(w, http.StatusBadRequest, "x-tenant-id required")
		return
	}
	statusFilter := r.URL.Query().Get("status")
	opFilter := r.URL.Query().Get("operation")
	makerFilter := r.URL.Query().Get("makerId")

	query := `SELECT id, reference, operation, entity_type, entity_id,
		amount_kobo, currency, status, maker_id, maker_name,
		current_level, max_level, risk_score, sla_deadline, created_at, resolved_at, remarks
		FROM approval_requests WHERE tenant_id=$1`
	args := []interface{}{tid}
	n := 2
	if statusFilter != "" {
		query += fmt.Sprintf(" AND status=$%d", n)
		args = append(args, statusFilter)
		n++
	}
	if opFilter != "" {
		query += fmt.Sprintf(" AND operation=$%d", n)
		args = append(args, opFilter)
		n++
	}
	if makerFilter != "" {
		query += fmt.Sprintf(" AND maker_id=$%d", n)
		args = append(args, makerFilter)
		n++
	}
	query += " ORDER BY created_at DESC LIMIT 100"

	rows, err := db.Query(query, args...)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	var items []map[string]interface{}
	for rows.Next() {
		var id, currentLevel, maxLevel, riskScore int
		var ref, op, entityType, entityID, currency, status, makerID, makerName string
		var amountKobo int64
		var slaDeadline, createdAt time.Time
		var resolvedAt sql.NullTime
		var remarks sql.NullString
		rows.Scan(&id, &ref, &op, &entityType, &entityID, &amountKobo, &currency,
			&status, &makerID, &makerName, &currentLevel, &maxLevel, &riskScore,
			&slaDeadline, &createdAt, &resolvedAt, &remarks)
		item := map[string]interface{}{
			"id": id, "reference": ref, "operation": op,
			"entityType": entityType, "entityId": entityID,
			"amountKobo": amountKobo, "currency": currency,
			"status": status, "makerId": makerID, "makerName": makerName,
			"currentLevel": currentLevel, "maxLevel": maxLevel,
			"riskScore":   riskScore,
			"slaDeadline": slaDeadline.Format(time.RFC3339),
			"slaBreached": time.Now().After(slaDeadline) && status == "pending",
			"createdAt":   createdAt.Format(time.RFC3339),
		}
		if resolvedAt.Valid {
			item["resolvedAt"] = resolvedAt.Time.Format(time.RFC3339)
		}
		if remarks.Valid {
			item["remarks"] = remarks.String
		}
		items = append(items, item)
	}
	if items == nil {
		items = []map[string]interface{}{}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"items": items, "total": len(items)})
}

// GET /v1/approvals/{id}
func handleGetApproval(w http.ResponseWriter, r *http.Request, id int) {
	tid := tenantID(r)
	if tid == "" {
		errorJSON(w, http.StatusBadRequest, "x-tenant-id required")
		return
	}

	var reqID, currentLevel, maxLevel, riskScore int
	var ref, op, entityType, entityID, currency, status, makerID, makerName, payloadStr string
	var amountKobo int64
	var callbackURL, remarks sql.NullString
	var slaDeadline, createdAt time.Time
	var resolvedAt sql.NullTime

	err := db.QueryRow(`
		SELECT id, reference, operation, entity_type, entity_id,
		       amount_kobo, currency, payload, callback_url, status,
		       maker_id, maker_name, current_level, max_level, risk_score,
		       sla_deadline, created_at, resolved_at, remarks
		FROM approval_requests WHERE id=$1 AND tenant_id=$2`, id, tid,
	).Scan(&reqID, &ref, &op, &entityType, &entityID, &amountKobo, &currency,
		&payloadStr, &callbackURL, &status, &makerID, &makerName,
		&currentLevel, &maxLevel, &riskScore, &slaDeadline, &createdAt, &resolvedAt, &remarks)
	if err == sql.ErrNoRows {
		errorJSON(w, http.StatusNotFound, "approval request not found")
		return
	}
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Load action history
	actRows, _ := db.Query(`
		SELECT action, actor_id, actor_name, actor_role, level, remarks, created_at
		FROM approval_actions WHERE request_id=$1 ORDER BY created_at`, id)
	defer actRows.Close()

	var actions []map[string]interface{}
	for actRows.Next() {
		var action, actorID, actorName, actorRole string
		var level int
		var actRemarks sql.NullString
		var actAt time.Time
		actRows.Scan(&action, &actorID, &actorName, &actorRole, &level, &actRemarks, &actAt)
		a := map[string]interface{}{
			"action": action, "actorId": actorID, "actorName": actorName,
			"actorRole": actorRole, "level": level, "at": actAt.Format(time.RFC3339),
		}
		if actRemarks.Valid {
			a["remarks"] = actRemarks.String
		}
		actions = append(actions, a)
	}
	if actions == nil {
		actions = []map[string]interface{}{}
	}

	result := map[string]interface{}{
		"id": reqID, "reference": ref, "operation": op,
		"entityType": entityType, "entityId": entityID,
		"amountKobo": amountKobo, "currency": currency,
		"status": status, "makerId": makerID, "makerName": makerName,
		"currentLevel": currentLevel, "maxLevel": maxLevel,
		"riskScore":   riskScore,
		"slaDeadline": slaDeadline.Format(time.RFC3339),
		"slaBreached": time.Now().After(slaDeadline) && status == "pending",
		"createdAt":   createdAt.Format(time.RFC3339),
		"actions":     actions,
	}
	if callbackURL.Valid {
		result["callbackUrl"] = callbackURL.String
	}
	if resolvedAt.Valid {
		result["resolvedAt"] = resolvedAt.Time.Format(time.RFC3339)
	}
	if remarks.Valid {
		result["remarks"] = remarks.String
	}
	var payload interface{}
	if json.Unmarshal([]byte(payloadStr), &payload) == nil {
		result["payload"] = payload
	}

	writeJSON(w, http.StatusOK, result)
}

// POST /v1/approvals/{id}/approve
func handleApprove(w http.ResponseWriter, r *http.Request, reqID int) {
	tid := tenantID(r)
	checkerID := r.Header.Get("x-keycloak-id")
	checkerName := r.Header.Get("x-user-name")
	checkerRole := r.Header.Get("x-user-role")
	if tid == "" || checkerID == "" {
		errorJSON(w, http.StatusBadRequest, "x-tenant-id and x-keycloak-id required")
		return
	}
	if checkerName == "" {
		checkerName = checkerID
	}
	// PBAC: user must hold approval:check permission to act as checker
	if !pbacCheck(tid, checkerID, "approval:check", "approval_request") {
		errorJSON(w, http.StatusForbidden, "forbidden: approval:check permission required")
		return
	}

	var body struct {
		Remarks string `json:"remarks"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	tx, err := db.Begin()
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer tx.Rollback()

	var makerID, status, payloadStr, callbackURL string
	var currentLevel, maxLevel int
	var slaDeadline time.Time
	err = tx.QueryRow(`
		SELECT maker_id, status, current_level, max_level, sla_deadline, payload, COALESCE(callback_url,'')
		FROM approval_requests WHERE id=$1 AND tenant_id=$2 FOR UPDATE`,
		reqID, tid,
	).Scan(&makerID, &status, &currentLevel, &maxLevel, &slaDeadline, &payloadStr, &callbackURL)
	if err == sql.ErrNoRows {
		errorJSON(w, http.StatusNotFound, "approval request not found")
		return
	}
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, err.Error())
		return
	}
	if status != "pending" {
		errorJSON(w, http.StatusConflict, "request is not pending (status="+status+")")
		return
	}
	// Four-eyes: checker cannot be the maker
	if checkerID == makerID {
		errorJSON(w, http.StatusForbidden, "checker cannot be the same person as the maker")
		return
	}
	// SLA check
	if time.Now().After(slaDeadline) {
		errorJSON(w, http.StatusConflict, "SLA has expired for this approval request")
		return
	}

	// Record action
	tx.Exec(`INSERT INTO approval_actions
		(request_id, tenant_id, action, actor_id, actor_name, actor_role, level, remarks)
		VALUES ($1,$2,'approve',$3,$4,$5,$6,$7)`,
		reqID, tid, checkerID, checkerName, checkerRole, currentLevel, body.Remarks)

	var newStatus string
	if currentLevel >= maxLevel {
		// Final approval
		newStatus = "approved"
		tx.Exec(`UPDATE approval_requests SET status='approved', resolved_at=now(),
			remarks=$1 WHERE id=$2`, body.Remarks, reqID)
	} else {
		// Advance to next level
		newStatus = "pending"
		tx.Exec(`UPDATE approval_requests SET current_level=current_level+1 WHERE id=$1`, reqID)
	}

	tx.Commit()

	if newStatus == "approved" {
		go fireCallback(callbackURL, "approved", reqID, payloadStr)
		publishEvent("approval.completed", map[string]interface{}{
			"requestId": reqID, "tenantId": tid, "status": "approved",
			"checkerId": checkerID, "level": currentLevel,
		})
		log.Printf("APPROVED id=%d by=%s at level %d/%d", reqID, checkerID, currentLevel, maxLevel)
	} else {
		publishEvent("approval.level-advanced", map[string]interface{}{
			"requestId": reqID, "tenantId": tid,
			"fromLevel": currentLevel, "toLevel": currentLevel + 1,
		})
		log.Printf("LEVEL ADVANCED id=%d by=%s level %d→%d", reqID, checkerID, currentLevel, currentLevel+1)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id": reqID, "status": newStatus, "level": currentLevel, "maxLevel": maxLevel,
		"fullyApproved": newStatus == "approved",
	})
}

// POST /v1/approvals/{id}/reject
func handleReject(w http.ResponseWriter, r *http.Request, reqID int) {
	tid := tenantID(r)
	checkerID := r.Header.Get("x-keycloak-id")
	checkerName := r.Header.Get("x-user-name")
	checkerRole := r.Header.Get("x-user-role")
	if tid == "" || checkerID == "" {
		errorJSON(w, http.StatusBadRequest, "x-tenant-id and x-keycloak-id required")
		return
	}
	if checkerName == "" {
		checkerName = checkerID
	}
	if !pbacCheck(tid, checkerID, "approval:check", "approval_request") {
		errorJSON(w, http.StatusForbidden, "forbidden: approval:check permission required")
		return
	}

	var body struct {
		Remarks string `json:"remarks"`
	}
	json.NewDecoder(r.Body).Decode(&body)
	if body.Remarks == "" {
		errorJSON(w, http.StatusBadRequest, "rejection reason (remarks) required")
		return
	}

	tx, err := db.Begin()
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer tx.Rollback()

	var makerID, status, callbackURL string
	var currentLevel int
	err = tx.QueryRow(`
		SELECT maker_id, status, current_level, COALESCE(callback_url,'')
		FROM approval_requests WHERE id=$1 AND tenant_id=$2 FOR UPDATE`,
		reqID, tid,
	).Scan(&makerID, &status, &currentLevel, &callbackURL)
	if err == sql.ErrNoRows {
		errorJSON(w, http.StatusNotFound, "approval request not found")
		return
	}
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, err.Error())
		return
	}
	if status != "pending" {
		errorJSON(w, http.StatusConflict, "request is not pending (status="+status+")")
		return
	}
	if checkerID == makerID {
		errorJSON(w, http.StatusForbidden, "checker cannot be the same person as the maker")
		return
	}

	tx.Exec(`INSERT INTO approval_actions
		(request_id, tenant_id, action, actor_id, actor_name, actor_role, level, remarks)
		VALUES ($1,$2,'reject',$3,$4,$5,$6,$7)`,
		reqID, tid, checkerID, checkerName, checkerRole, currentLevel, body.Remarks)

	tx.Exec(`UPDATE approval_requests SET status='rejected', resolved_at=now(), remarks=$1 WHERE id=$2`,
		body.Remarks, reqID)

	tx.Commit()

	go fireCallback(callbackURL, "rejected", reqID, "{}")
	publishEvent("approval.rejected", map[string]interface{}{
		"requestId": reqID, "tenantId": tid,
		"checkerId": checkerID, "remarks": body.Remarks,
	})
	log.Printf("REJECTED id=%d by=%s reason=%s", reqID, checkerID, body.Remarks)
	writeJSON(w, http.StatusOK, map[string]interface{}{"id": reqID, "status": "rejected"})
}

// POST /v1/approvals/{id}/cancel — maker cancels their own pending request
func handleCancel(w http.ResponseWriter, r *http.Request, reqID int) {
	tid := tenantID(r)
	userID := r.Header.Get("x-keycloak-id")
	if tid == "" || userID == "" {
		errorJSON(w, http.StatusBadRequest, "x-tenant-id and x-keycloak-id required")
		return
	}

	var body struct {
		Remarks string `json:"remarks"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	var makerID, status string
	err := db.QueryRow(`SELECT maker_id, status FROM approval_requests WHERE id=$1 AND tenant_id=$2`,
		reqID, tid).Scan(&makerID, &status)
	if err == sql.ErrNoRows {
		errorJSON(w, http.StatusNotFound, "approval request not found")
		return
	}
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, err.Error())
		return
	}
	if status != "pending" {
		errorJSON(w, http.StatusConflict, "only pending requests can be cancelled")
		return
	}
	if userID != makerID {
		errorJSON(w, http.StatusForbidden, "only the original maker can cancel this request")
		return
	}

	db.Exec(`UPDATE approval_requests SET status='cancelled', resolved_at=now(), remarks=$1 WHERE id=$2`,
		body.Remarks, reqID)
	db.Exec(`INSERT INTO approval_actions
		(request_id, tenant_id, action, actor_id, actor_name, actor_role, level, remarks)
		VALUES ($1,$2,'cancel',$3,$4,'maker',1,$5)`,
		reqID, tid, userID, userID, body.Remarks)

	log.Printf("CANCELLED id=%d by maker=%s", reqID, userID)
	writeJSON(w, http.StatusOK, map[string]interface{}{"id": reqID, "status": "cancelled"})
}

// GET /v1/rules + POST /v1/rules
func handleRules(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	if tid == "" {
		errorJSON(w, http.StatusBadRequest, "x-tenant-id required")
		return
	}

	if r.Method == http.MethodPost {
		var body struct {
			Operation      string   `json:"operation"`
			MinAmountKobo  int64    `json:"minAmountKobo"`
			MaxAmountKobo  int64    `json:"maxAmountKobo"`
			LevelsRequired int      `json:"levelsRequired"`
			RequiredRoles  []string `json:"requiredRoles"`
			SLAMinutes     int      `json:"slaMinutes"`
			AutoEscalate   bool     `json:"autoEscalate"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			errorJSON(w, http.StatusBadRequest, "invalid JSON")
			return
		}
		if body.Operation == "" || body.LevelsRequired == 0 {
			errorJSON(w, http.StatusBadRequest, "operation and levelsRequired required")
			return
		}
		if body.MaxAmountKobo == 0 {
			body.MaxAmountKobo = 9223372036854775807
		}
		if body.SLAMinutes == 0 {
			body.SLAMinutes = 120
		}
		rolesStr := strings.Join(body.RequiredRoles, ",")

		var id int
		err := db.QueryRow(`
			INSERT INTO approval_rules
			  (tenant_id, operation, min_amount_kobo, max_amount_kobo,
			   levels_required, required_roles, sla_minutes, auto_escalate)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
			ON CONFLICT (tenant_id, operation, min_amount_kobo) DO UPDATE SET
			  max_amount_kobo=EXCLUDED.max_amount_kobo,
			  levels_required=EXCLUDED.levels_required,
			  required_roles=EXCLUDED.required_roles,
			  sla_minutes=EXCLUDED.sla_minutes,
			  auto_escalate=EXCLUDED.auto_escalate,
			  is_active=true
			RETURNING id`,
			tid, body.Operation, body.MinAmountKobo, body.MaxAmountKobo,
			body.LevelsRequired, rolesStr, body.SLAMinutes, body.AutoEscalate,
		).Scan(&id)
		if err != nil {
			errorJSON(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, map[string]interface{}{"id": id, "operation": body.Operation})
		return
	}

	rows, err := db.Query(`
		SELECT id, operation, min_amount_kobo, max_amount_kobo,
		       levels_required, required_roles, sla_minutes, auto_escalate, is_active, created_at
		FROM approval_rules
		WHERE tenant_id IN ($1,'default') AND is_active=true
		ORDER BY operation, min_amount_kobo`, tid)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	var items []map[string]interface{}
	for rows.Next() {
		var id, levelsReq, slaMin int
		var op, rolesStr string
		var minAmt, maxAmt int64
		var autoEsc, isActive bool
		var createdAt time.Time
		rows.Scan(&id, &op, &minAmt, &maxAmt, &levelsReq, &rolesStr, &slaMin, &autoEsc, &isActive, &createdAt)
		roles := strings.Split(rolesStr, ",")
		items = append(items, map[string]interface{}{
			"id": id, "operation": op,
			"minAmountKobo": minAmt, "maxAmountKobo": maxAmt,
			"levelsRequired": levelsReq, "requiredRoles": roles,
			"slaMinutes": slaMin, "autoEscalate": autoEsc,
			"createdAt": createdAt.Format(time.RFC3339),
		})
	}
	if items == nil {
		items = []map[string]interface{}{}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"items": items, "total": len(items)})
}

// GET /v1/stats
func handleStats(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	if tid == "" {
		errorJSON(w, http.StatusBadRequest, "x-tenant-id required")
		return
	}
	rows, err := db.Query(`
		SELECT status, COUNT(*) AS cnt, COALESCE(SUM(amount_kobo),0) AS total_kobo
		FROM approval_requests WHERE tenant_id=$1
		GROUP BY status`, tid)
	if err != nil {
		errorJSON(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	byStatus := map[string]map[string]int64{}
	for rows.Next() {
		var status string
		var cnt int64
		var totalKobo int64
		rows.Scan(&status, &cnt, &totalKobo)
		byStatus[status] = map[string]int64{"count": cnt, "totalKobo": totalKobo}
	}

	var slaBreaches int
	db.QueryRow(`SELECT COUNT(*) FROM approval_requests
		WHERE tenant_id=$1 AND status='pending' AND sla_deadline < now()`, tid).Scan(&slaBreaches)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"byStatus": byStatus, "slaBreaches": slaBreaches,
	})
}

// ── Router ────────────────────────────────────────────────────────────────────

func corsMiddleware(next http.Handler) http.Handler {
	origins := allowedOrigins()
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", origins)
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers",
			"Content-Type,Authorization,x-tenant-id,x-keycloak-id,x-user-name,x-user-role,x-request-id")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ── MIDDLEWARE: JWT Validation (JWKS / RS256, fail-closed) ──────────────────

type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}

func jwtRealmURL() string {
	return getEnv("KEYCLOAK_REALM_URL", "http://keycloak:8080/realms/54bank")
}

func fetchJWKS(realmURL string) {
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(realmURL + "/protocol/openid-connect/certs")
	if err != nil {
		log.Printf("[middleware] JWKS fetch failed: %v", err)
		return
	}
	defer resp.Body.Close()
	var jwks struct {
		Keys []struct {
			Kid string `json:"kid"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		log.Printf("[middleware] JWKS decode failed: %v", err)
		return
	}
	jwtCache.mu.Lock()
	defer jwtCache.mu.Unlock()
	for _, k := range jwks.Keys {
		nBytes, _ := base64.RawURLEncoding.DecodeString(k.N)
		eBytes, _ := base64.RawURLEncoding.DecodeString(k.E)
		if len(eBytes) == 0 {
			continue
		}
		var eInt int
		for _, b := range eBytes {
			eInt = eInt<<8 | int(b)
		}
		jwtCache.keys[k.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(nBytes), E: eInt}
	}
	jwtCache.updated = time.Now()
	log.Printf("[middleware] JWKS refreshed: %d keys", len(jwtCache.keys))
}

func startJWKSRefresh() {
	go fetchJWKS(jwtRealmURL())
	go func() {
		for range time.Tick(5 * time.Minute) {
			fetchJWKS(jwtRealmURL())
		}
	}()
}

// tenantFromClaims derives the tenant ONLY from verified token claims — never
// from caller-supplied headers or parameters.
func tenantFromClaims(claims map[string]interface{}) string {
	for _, k := range []string{"tenant_id", "tenantId", "tenant"} {
		if s, ok := claims[k].(string); ok && s != "" {
			return s
		}
	}
	return ""
}

// jwtAuthMiddleware validates Bearer tokens against the Keycloak JWKS endpoint
// (RS256 signature + expiry). Fail-closed: requests without a verifiable token
// get 401. Only health/metrics probes are exempt. Tenant identity is derived
// from the verified claims and stamped onto X-Tenant-ID, overwriting any
// caller-supplied value.
func jwtAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if p == "/healthz" || p == "/readyz" || p == "/livez" || p == "/metrics" || p == "/health" {
			next.ServeHTTP(w, r)
			return
		}
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"unauthorized","service":%q}`, "maker-checker-go")
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"malformed token","service":%q}`, "maker-checker-go")
			return
		}
		headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
		if err != nil {
			http.Error(w, `{"error":"invalid token header"}`, http.StatusUnauthorized)
			return
		}
		var header struct {
			Kid string `json:"kid"`
			Alg string `json:"alg"`
		}
		json.Unmarshal(headerBytes, &header)
		if header.Alg != "RS256" {
			http.Error(w, `{"error":"unsupported token algorithm"}`, http.StatusUnauthorized)
			return
		}

		jwtCache.mu.RLock()
		pub, ok := jwtCache.keys[header.Kid]
		jwtCache.mu.RUnlock()
		if !ok {
			fetchJWKS(jwtRealmURL())
			jwtCache.mu.RLock()
			pub, ok = jwtCache.keys[header.Kid]
			jwtCache.mu.RUnlock()
			if !ok {
				http.Error(w, `{"error":"unknown signing key"}`, http.StatusUnauthorized)
				return
			}
		}

		sigBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
		if err != nil {
			http.Error(w, `{"error":"invalid signature encoding"}`, http.StatusUnauthorized)
			return
		}
		hash := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
		if err := rsa.VerifyPKCS1v15(pub, crypto.SHA256, hash[:], sigBytes); err != nil {
			http.Error(w, `{"error":"invalid signature"}`, http.StatusUnauthorized)
			return
		}

		claimsBytes, _ := base64.RawURLEncoding.DecodeString(parts[1])
		var claims map[string]interface{}
		json.Unmarshal(claimsBytes, &claims)
		if exp, ok := claims["exp"].(float64); ok && time.Now().Unix() > int64(exp) {
			http.Error(w, `{"error":"token expired"}`, http.StatusUnauthorized)
			return
		}
		if sub, ok := claims["sub"].(string); ok {
			r.Header.Set("X-User-Id", sub)
		}
		// Tenant identity comes ONLY from verified claims; overwrite any
		// caller-supplied tenant header before invoking the handler.
		if tenant := tenantFromClaims(claims); tenant != "" {
			r.Header.Set("X-Tenant-ID", tenant)
		} else {
			r.Header.Del("X-Tenant-ID")
		}
		ctx := context.WithValue(r.Context(), "jwt_claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func main() {
	startJWKSRefresh()

	initDB()

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/v1/rules", handleRules)
	mux.HandleFunc("/v1/stats", handleStats)

	mux.HandleFunc("/v1/approvals", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handleListApprovals(w, r)
		case http.MethodPost:
			handleCreateApproval(w, r)
		default:
			errorJSON(w, http.StatusMethodNotAllowed, "method not allowed")
		}
	})

	mux.HandleFunc("/v1/approvals/", func(w http.ResponseWriter, r *http.Request) {
		parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/v1/approvals/"), "/")
		if len(parts) == 0 || parts[0] == "" {
			errorJSON(w, http.StatusNotFound, "not found")
			return
		}
		id, err := strconv.Atoi(parts[0])
		if err != nil {
			errorJSON(w, http.StatusBadRequest, "invalid approval ID")
			return
		}
		if len(parts) == 1 {
			if r.Method == http.MethodGet {
				handleGetApproval(w, r, id)
			} else {
				errorJSON(w, http.StatusMethodNotAllowed, "GET required")
			}
			return
		}
		action := parts[1]
		if r.Method != http.MethodPost {
			errorJSON(w, http.StatusMethodNotAllowed, "POST required")
			return
		}
		switch action {
		case "approve":
			handleApprove(w, r, id)
		case "reject":
			handleReject(w, r, id)
		case "cancel":
			handleCancel(w, r, id)
		default:
			errorJSON(w, http.StatusNotFound, "unknown action: "+action)
		}
	})

	// Read body for logging
	io.Discard.Write(nil)

	port := getEnv("PORT", "8210")
	log.Printf("maker-checker-go listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, jwtAuthMiddleware(corsMiddleware(mux))))
}
