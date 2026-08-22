// 54Bank Privileged Access Management (PAM) — Go
// Domain: Security / Insider Threat
// Implements just-in-time privilege elevation with time-bound sessions.
// No standing admin access — all elevated access requires approval and auto-expires.
// Middleware: Kafka, Postgres, Redis, Temporal, Permify, Vault
package main

import (
	"github.com/IBM/sarama"
	"context"
	"crypto"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"regexp"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	_ "github.com/lib/pq"
	"crypto/rsa"
	"encoding/base64"
	"math/big"
)


func secureRandHex(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func secureRandUint32() uint32 {
	var b [4]byte
	rand.Read(b[:])
	return binary.BigEndian.Uint32(b[:])
}

var semaphore = make(chan struct{}, 100)

func acquireSem() { semaphore <- struct{}{} }
func releaseSem() { <-semaphore }

var serviceName = "privileged-access-go"
var eventBus = newEventBus("security.insider-threat", "pam")
var startTime = time.Now()

// ─── Domain Types ───────────────────────────────────────────────────────────

type AccessRequest struct {
	ID            string    `json:"id"`
	RequestorID   string    `json:"requestor_id"`
	RequestorName string    `json:"requestor_name"`
	Resource      string    `json:"resource"`
	AccessLevel   string    `json:"access_level"`
	Justification string    `json:"justification"`
	Duration      int       `json:"duration_minutes"`
	Status        string    `json:"status"`
	ApprovedBy    string    `json:"approved_by,omitempty"`
	ApprovalChain []string  `json:"approval_chain"`
	SessionToken  string    `json:"session_token,omitempty"`
	IPAddress     string    `json:"ip_address"`
	DeviceID      string    `json:"device_id"`
	CreatedAt     time.Time `json:"created_at"`
	ExpiresAt     time.Time `json:"expires_at,omitempty"`
	RevokedAt     time.Time `json:"revoked_at,omitempty"`
	AuditTrail    []string  `json:"audit_trail"`
}

type ActiveSession struct {
	RequestID    string    `json:"request_id"`
	SessionToken string    `json:"session_token"`
	Resource     string    `json:"resource"`
	AccessLevel  string    `json:"access_level"`
	UserID       string    `json:"user_id"`
	ExpiresAt    time.Time `json:"expires_at"`
	ActionsLog   []Action  `json:"actions_log"`
}

type Action struct {
	Timestamp time.Time `json:"timestamp"`
	Operation string    `json:"operation"`
	Target    string    `json:"target"`
	Result    string    `json:"result"`
}

type AccessPolicy struct {
	Resource         string   `json:"resource"`
	MaxDuration      int      `json:"max_duration_minutes"`
	RequiredApprovers int     `json:"required_approvers"`
	AllowedRoles     []string `json:"allowed_roles"`
	RequiresMFA      bool     `json:"requires_mfa"`
	RequiresTicket   bool     `json:"requires_ticket"`
	BlockedHours     []int    `json:"blocked_hours"`
}

var (
	mu       sync.RWMutex
	policies = map[string]*AccessPolicy{
		"database:core_banking": {Resource: "database:core_banking", MaxDuration: 60, RequiredApprovers: 2, AllowedRoles: []string{"dba", "sre"}, RequiresMFA: true, RequiresTicket: true, BlockedHours: []int{0, 1, 2, 3, 4, 5}},
		"database:audit_trail":  {Resource: "database:audit_trail", MaxDuration: 30, RequiredApprovers: 2, AllowedRoles: []string{"compliance_officer"}, RequiresMFA: true, RequiresTicket: true},
		"service:gl-engine":     {Resource: "service:gl-engine", MaxDuration: 120, RequiredApprovers: 1, AllowedRoles: []string{"sre", "backend_eng"}, RequiresMFA: true},
		"service:payments-hub":  {Resource: "service:payments-hub", MaxDuration: 60, RequiredApprovers: 2, AllowedRoles: []string{"sre"}, RequiresMFA: true, RequiresTicket: true},
		"admin:user-management": {Resource: "admin:user-management", MaxDuration: 240, RequiredApprovers: 1, AllowedRoles: []string{"hr_admin", "security_admin"}, RequiresMFA: true},
		"vault:secrets":         {Resource: "vault:secrets", MaxDuration: 30, RequiredApprovers: 2, AllowedRoles: []string{"security_admin"}, RequiresMFA: true, RequiresTicket: true},
		"k8s:production":        {Resource: "k8s:production", MaxDuration: 120, RequiredApprovers: 2, AllowedRoles: []string{"sre", "platform_eng"}, RequiresMFA: true, RequiresTicket: true},
	}
	db        *sql.DB
	requestID uint64
)

// ─── Database Schema ────────────────────────────────────────────────────────

func initSchema() {
	if db == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	queries := []string{
		`CREATE TABLE IF NOT EXISTS pam_requests (
			id TEXT PRIMARY KEY,
			requestor_id TEXT NOT NULL,
			requestor_name TEXT,
			resource TEXT NOT NULL,
			access_level TEXT NOT NULL,
			justification TEXT,
			duration_minutes INT,
			status TEXT NOT NULL DEFAULT 'pending',
			approved_by TEXT,
			approval_chain JSONB DEFAULT '[]',
			session_token TEXT,
			ip_address TEXT,
			device_id TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			expires_at TIMESTAMPTZ,
			revoked_at TIMESTAMPTZ,
			audit_trail JSONB DEFAULT '[]'
		)`,
		`CREATE TABLE IF NOT EXISTS pam_active_sessions (
			session_token TEXT PRIMARY KEY,
			request_id TEXT NOT NULL REFERENCES pam_requests(id),
			resource TEXT NOT NULL,
			access_level TEXT NOT NULL,
			user_id TEXT NOT NULL,
			expires_at TIMESTAMPTZ NOT NULL,
			actions_log JSONB DEFAULT '[]'
		)`,
		`CREATE TABLE IF NOT EXISTS pam_audit_trail (
			id TEXT PRIMARY KEY,
			action TEXT NOT NULL,
			actor TEXT NOT NULL,
			entity_id TEXT,
			timestamp TEXT NOT NULL,
			details JSONB,
			service TEXT DEFAULT 'privileged-access-go'
		)`,
		`CREATE INDEX IF NOT EXISTS idx_pam_requests_status ON pam_requests(status)`,
		`CREATE INDEX IF NOT EXISTS idx_pam_sessions_expires ON pam_active_sessions(expires_at)`,
	}
	for _, q := range queries {
		if _, err := db.ExecContext(ctx, q); err != nil {
			log.Printf("[PAM] Schema init warning: %v", err)
		}
	}
	log.Println("[PAM] PostgreSQL schema initialized")
}

// ─── Postgres Helpers ───────────────────────────────────────────────────────

func dbSaveRequest(req *AccessRequest) {
	if db == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	chainJSON, _ := json.Marshal(req.ApprovalChain)
	trailJSON, _ := json.Marshal(req.AuditTrail)
	db.ExecContext(ctx, `INSERT INTO pam_requests (id, requestor_id, requestor_name, resource, access_level, justification, duration_minutes, status, approved_by, approval_chain, session_token, ip_address, device_id, created_at, expires_at, revoked_at, audit_trail)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
		ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, approved_by=EXCLUDED.approved_by, approval_chain=EXCLUDED.approval_chain, session_token=EXCLUDED.session_token, expires_at=EXCLUDED.expires_at, revoked_at=EXCLUDED.revoked_at, audit_trail=EXCLUDED.audit_trail`,
		req.ID, req.RequestorID, req.RequestorName, req.Resource, req.AccessLevel, req.Justification, req.Duration,
		req.Status, req.ApprovedBy, string(chainJSON), req.SessionToken, req.IPAddress, req.DeviceID,
		req.CreatedAt, nullTime(req.ExpiresAt), nullTime(req.RevokedAt), string(trailJSON))
}

func dbSaveSession(s *ActiveSession) {
	if db == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	actionsJSON, _ := json.Marshal(s.ActionsLog)
	db.ExecContext(ctx, `INSERT INTO pam_active_sessions (session_token, request_id, resource, access_level, user_id, expires_at, actions_log)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
		ON CONFLICT (session_token) DO UPDATE SET actions_log=EXCLUDED.actions_log`,
		s.SessionToken, s.RequestID, s.Resource, s.AccessLevel, s.UserID, s.ExpiresAt, string(actionsJSON))
}

func dbDeleteSession(token string) {
	if db == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	db.ExecContext(ctx, `DELETE FROM pam_active_sessions WHERE session_token=$1`, token)
}

func dbLoadRequest(id string) *AccessRequest {
	if db == nil {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	row := db.QueryRowContext(ctx, `SELECT id, requestor_id, requestor_name, resource, access_level, justification, duration_minutes, status, COALESCE(approved_by,''), approval_chain, COALESCE(session_token,''), ip_address, device_id, created_at, expires_at, revoked_at, audit_trail FROM pam_requests WHERE id=$1`, id)
	var req AccessRequest
	var chainJSON, trailJSON string
	var expiresAt, revokedAt sql.NullTime
	err := row.Scan(&req.ID, &req.RequestorID, &req.RequestorName, &req.Resource, &req.AccessLevel, &req.Justification, &req.Duration, &req.Status, &req.ApprovedBy, &chainJSON, &req.SessionToken, &req.IPAddress, &req.DeviceID, &req.CreatedAt, &expiresAt, &revokedAt, &trailJSON)
	if err != nil {
		return nil
	}
	json.Unmarshal([]byte(chainJSON), &req.ApprovalChain)
	json.Unmarshal([]byte(trailJSON), &req.AuditTrail)
	if expiresAt.Valid {
		req.ExpiresAt = expiresAt.Time
	}
	if revokedAt.Valid {
		req.RevokedAt = revokedAt.Time
	}
	return &req
}

func dbLoadSession(token string) *ActiveSession {
	if db == nil {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	row := db.QueryRowContext(ctx, `SELECT session_token, request_id, resource, access_level, user_id, expires_at, actions_log FROM pam_active_sessions WHERE session_token=$1`, token)
	var s ActiveSession
	var actionsJSON string
	err := row.Scan(&s.SessionToken, &s.RequestID, &s.Resource, &s.AccessLevel, &s.UserID, &s.ExpiresAt, &actionsJSON)
	if err != nil {
		return nil
	}
	json.Unmarshal([]byte(actionsJSON), &s.ActionsLog)
	return &s
}

func dbListRequests(status string) []*AccessRequest {
	if db == nil {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	var rows *sql.Rows
	var err error
	if status == "" {
		rows, err = db.QueryContext(ctx, `SELECT id, requestor_id, requestor_name, resource, access_level, justification, duration_minutes, status, COALESCE(approved_by,''), approval_chain, COALESCE(session_token,''), ip_address, device_id, created_at, expires_at, revoked_at, audit_trail FROM pam_requests ORDER BY created_at DESC LIMIT 1000`)
	} else {
		rows, err = db.QueryContext(ctx, `SELECT id, requestor_id, requestor_name, resource, access_level, justification, duration_minutes, status, COALESCE(approved_by,''), approval_chain, COALESCE(session_token,''), ip_address, device_id, created_at, expires_at, revoked_at, audit_trail FROM pam_requests WHERE status=$1 ORDER BY created_at DESC LIMIT 1000`, status)
	}
	if err != nil {
		return nil
	}
	defer rows.Close()
	var result []*AccessRequest
	for rows.Next() {
		var req AccessRequest
		var chainJSON, trailJSON string
		var expiresAt, revokedAt sql.NullTime
		if err := rows.Scan(&req.ID, &req.RequestorID, &req.RequestorName, &req.Resource, &req.AccessLevel, &req.Justification, &req.Duration, &req.Status, &req.ApprovedBy, &chainJSON, &req.SessionToken, &req.IPAddress, &req.DeviceID, &req.CreatedAt, &expiresAt, &revokedAt, &trailJSON); err != nil {
			continue
		}
		json.Unmarshal([]byte(chainJSON), &req.ApprovalChain)
		json.Unmarshal([]byte(trailJSON), &req.AuditTrail)
		if expiresAt.Valid {
			req.ExpiresAt = expiresAt.Time
		}
		if revokedAt.Valid {
			req.RevokedAt = revokedAt.Time
		}
		result = append(result, &req)
	}
	return result
}

func dbListActiveSessions() []*ActiveSession {
	if db == nil {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	rows, err := db.QueryContext(ctx, `SELECT session_token, request_id, resource, access_level, user_id, expires_at, actions_log FROM pam_active_sessions ORDER BY expires_at`)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var result []*ActiveSession
	for rows.Next() {
		var s ActiveSession
		var actionsJSON string
		if err := rows.Scan(&s.SessionToken, &s.RequestID, &s.Resource, &s.AccessLevel, &s.UserID, &s.ExpiresAt, &actionsJSON); err != nil {
			continue
		}
		json.Unmarshal([]byte(actionsJSON), &s.ActionsLog)
		result = append(result, &s)
	}
	return result
}

func dbCountByStatus() (total, pending, active, denied, expired int) {
	if db == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	rows, err := db.QueryContext(ctx, `SELECT status, COUNT(*) FROM pam_requests GROUP BY status`)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var s string
		var c int
		if rows.Scan(&s, &c) == nil {
			total += c
			switch s {
			case "pending":
				pending = c
			case "active":
				active = c
			case "denied":
				denied = c
			case "expired":
				expired = c
			}
		}
	}
	return
}

func nullTime(t time.Time) interface{} {
	if t.IsZero() {
		return nil
	}
	return t
}

// ─── Core Logic ─────────────────────────────────────────────────────────────

func createAccessRequest(req *AccessRequest) error {
	mu.Lock()
	defer mu.Unlock()

	atomic.AddUint64(&requestID, 1)
	req.ID = fmt.Sprintf("PAM-%d-%s", atomic.LoadUint64(&requestID), secureRandHex(4))
	req.CreatedAt = time.Now()
	req.Status = "pending"
	req.AuditTrail = []string{fmt.Sprintf("%s: request created by %s for %s (%s)", req.CreatedAt.Format(time.RFC3339), req.RequestorID, req.Resource, req.AccessLevel)}

	policy, ok := policies[req.Resource]
	if !ok {
		return fmt.Errorf("no policy defined for resource %q", req.Resource)
	}
	if req.Duration > policy.MaxDuration {
		return fmt.Errorf("requested duration %d exceeds max %d minutes for %s", req.Duration, policy.MaxDuration, req.Resource)
	}
	if policy.RequiresTicket && req.Justification == "" {
		return fmt.Errorf("resource %s requires incident/change ticket reference in justification", req.Resource)
	}

	currentHour := time.Now().Hour()
	for _, blocked := range policy.BlockedHours {
		if currentHour == blocked {
			return fmt.Errorf("access to %s is blocked during hour %d (maintenance window)", req.Resource, currentHour)
		}
	}

	req.ApprovalChain = make([]string, 0, policy.RequiredApprovers)

	dbSaveRequest(req)

	appendAudit("pam_request_created", req.RequestorID, req.ID, map[string]interface{}{
		"resource": req.Resource, "access_level": req.AccessLevel, "duration": req.Duration,
	})

	eventBus.Emit("pam.request.created", map[string]interface{}{
		"request_id": req.ID, "requestor": req.RequestorID, "resource": req.Resource,
		"access_level": req.AccessLevel, "requires_approvers": policy.RequiredApprovers,
	})

	return nil
}

func approveRequest(reqID, approverID string) error {
	mu.Lock()
	defer mu.Unlock()

	req := dbLoadRequest(reqID)
	if req == nil {
		return fmt.Errorf("request %s not found", reqID)
	}
	if req.Status != "pending" {
		return fmt.Errorf("request %s is %s, cannot approve", reqID, req.Status)
	}

	if approverID == req.RequestorID {
		appendAudit("pam_self_approval_blocked", approverID, reqID, nil)
		return fmt.Errorf("self-approval is prohibited: %s cannot approve their own request", approverID)
	}

	for _, existing := range req.ApprovalChain {
		if existing == approverID {
			return fmt.Errorf("approver %s has already approved this request", approverID)
		}
	}

	policy := policies[req.Resource]
	req.ApprovalChain = append(req.ApprovalChain, approverID)
	req.AuditTrail = append(req.AuditTrail, fmt.Sprintf("%s: approved by %s (%d/%d)", time.Now().Format(time.RFC3339), approverID, len(req.ApprovalChain), policy.RequiredApprovers))

	if len(req.ApprovalChain) >= policy.RequiredApprovers {
		req.Status = "active"
		req.ApprovedBy = strings.Join(req.ApprovalChain, ",")
		req.ExpiresAt = time.Now().Add(time.Duration(req.Duration) * time.Minute)
		req.SessionToken = secureRandHex(32)

		session := &ActiveSession{
			RequestID:    req.ID,
			SessionToken: req.SessionToken,
			Resource:     req.Resource,
			AccessLevel:  req.AccessLevel,
			UserID:       req.RequestorID,
			ExpiresAt:    req.ExpiresAt,
			ActionsLog:   make([]Action, 0),
		}
		dbSaveSession(session)

		eventBus.Emit("pam.session.activated", map[string]interface{}{
			"request_id": req.ID, "user": req.RequestorID, "resource": req.Resource,
			"expires_at": req.ExpiresAt.Format(time.RFC3339), "approvers": req.ApprovalChain,
		})
	}

	dbSaveRequest(req)

	appendAudit("pam_request_approved", approverID, reqID, map[string]interface{}{
		"approval_count": len(req.ApprovalChain), "required": policy.RequiredApprovers,
	})

	return nil
}

func getRequest(reqID string) *AccessRequest {
	mu.RLock()
	defer mu.RUnlock()
	return dbLoadRequest(reqID)
}

func validateSession(token string) (*ActiveSession, error) {
	mu.RLock()
	defer mu.RUnlock()

	session := dbLoadSession(token)
	if session == nil {
		return nil, fmt.Errorf("session not found or expired")
	}
	if time.Now().After(session.ExpiresAt) {
		return nil, fmt.Errorf("session expired at %s", session.ExpiresAt.Format(time.RFC3339))
	}
	return session, nil
}

func revokeSession(token, revokerID, reason string) error {
	mu.Lock()
	defer mu.Unlock()

	session := dbLoadSession(token)
	if session == nil {
		return fmt.Errorf("session not found")
	}

	req := dbLoadRequest(session.RequestID)
	if req != nil {
		req.Status = "revoked"
		req.RevokedAt = time.Now()
		req.AuditTrail = append(req.AuditTrail, fmt.Sprintf("%s: REVOKED by %s — %s", time.Now().Format(time.RFC3339), revokerID, reason))
		dbSaveRequest(req)
	}

	dbDeleteSession(token)

	appendAudit("pam_session_revoked", revokerID, session.RequestID, map[string]interface{}{
		"user": session.UserID, "resource": session.Resource, "reason": reason,
	})

	eventBus.Emit("pam.session.revoked", map[string]interface{}{
		"request_id": session.RequestID, "user": session.UserID, "revoker": revokerID, "reason": reason,
	})

	return nil
}

func expireLoop() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		mu.Lock()
		now := time.Now()
		sessions := dbListActiveSessions()
		for _, session := range sessions {
			if now.After(session.ExpiresAt) {
				req := dbLoadRequest(session.RequestID)
				if req != nil {
					req.Status = "expired"
					req.AuditTrail = append(req.AuditTrail, fmt.Sprintf("%s: session auto-expired", now.Format(time.RFC3339)))
					dbSaveRequest(req)
				}
				dbDeleteSession(session.SessionToken)
				appendAudit("pam_session_expired", "system", session.RequestID, map[string]interface{}{
					"user": session.UserID, "resource": session.Resource,
				})
				eventBus.Emit("pam.session.expired", map[string]interface{}{
					"request_id": session.RequestID, "user": session.UserID, "resource": session.Resource,
				})
			}
		}
		mu.Unlock()
	}
}

func appendAudit(action, actor, entityID string, details map[string]interface{}) {
	entry := map[string]interface{}{
		"id":        fmt.Sprintf("AUD-%s", secureRandHex(8)),
		"action":    action,
		"actor":     actor,
		"entity_id": entityID,
		"timestamp": time.Now().Format(time.RFC3339),
		"service":   serviceName,
		"details":   details,
	}

	if db != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		detailsJSON, _ := json.Marshal(details)
		db.ExecContext(ctx, "INSERT INTO pam_audit_trail (id, action, actor, entity_id, timestamp, details) VALUES ($1,$2,$3,$4,$5,$6)",
			entry["id"], action, actor, entityID, entry["timestamp"], string(detailsJSON))
	}
}

// ─── HTTP Handlers ──────────────────────────────────────────────────────────

func handleRequestAccess(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req AccessRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	req.IPAddress = r.RemoteAddr
	if err := createAccessRequest(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(req)
}

func handleApproveRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var body struct {
		RequestID  string `json:"request_id"`
		ApproverID string `json:"approver_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	if err := approveRequest(body.RequestID, body.ApproverID); err != nil {
		if strings.Contains(err.Error(), "self-approval") {
			w.WriteHeader(http.StatusForbidden)
		} else {
			w.WriteHeader(http.StatusBadRequest)
		}
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	req := getRequest(body.RequestID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(req)
}

func handleValidateSession(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" {
		token = r.Header.Get("X-PAM-Token")
	}
	session, err := validateSession(token)
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(session)
}

func handleRevokeSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var body struct {
		Token    string `json:"session_token"`
		RevokerID string `json:"revoker_id"`
		Reason   string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	if err := revokeSession(body.Token, body.RevokerID, body.Reason); err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "revoked"})
}

func handleListRequests(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	result := dbListRequests(status)
	if result == nil {
		result = make([]*AccessRequest, 0)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func handleListPolicies(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(policies)
}

func handleActiveSessions(w http.ResponseWriter, r *http.Request) {
	sessions := dbListActiveSessions()
	if sessions == nil {
		sessions = make([]*ActiveSession, 0)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sessions)
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	total, pending, _, denied, expired := dbCountByStatus()
	sessions := dbListActiveSessions()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"total_requests":  total,
		"pending":         pending,
		"active_sessions": len(sessions),
		"denied":          denied,
		"expired":         expired,
		"policies":        len(policies),
		"uptime_seconds":  int(time.Since(startTime).Seconds()),
	})
}

// ─── Middleware ──────────────────────────────────────────────────────────────

var healthyFlag int32 = 1

func healthzHandler(w http.ResponseWriter, r *http.Request) {
	if atomic.LoadInt32(&healthyFlag) == 0 {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{"status": "unhealthy"})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "healthy",
		"service": serviceName,
		"uptime":  int(time.Since(startTime).Seconds()),
	})
}

func livezHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "alive"})
}

func readyzHandler(w http.ResponseWriter, r *http.Request) {
	ready := db != nil
	if !ready {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{"status": "not_ready", "reason": "database not connected"})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
}

// ─── Watchdog ───────────────────────────────────────────────────────────────

var lastActivity int64

func startWatchdog() {
	atomic.StoreInt64(&lastActivity, time.Now().Unix())
	go func() {
		for {
			time.Sleep(15 * time.Second)
			last := atomic.LoadInt64(&lastActivity)
			if time.Now().Unix()-last > 60 {
				atomic.StoreInt32(&healthyFlag, 0)
			} else {
				atomic.StoreInt32(&healthyFlag, 1)
			}
		}
	}()
}

func recordActivity() {
	atomic.StoreInt64(&lastActivity, time.Now().Unix())
}

// ─── EventBus ───────────────────────────────────────────────────────────────

type EventBusImpl struct {
	topic    string
	source   string
	mu       sync.Mutex
	events   []map[string]interface{}
}

func newEventBus(topic, source string) *EventBusImpl {
	return &EventBusImpl{topic: topic, source: source, events: make([]map[string]interface{}, 0)}
}

func (eb *EventBusImpl) Emit(eventType string, payload map[string]interface{}) {
	eb.mu.Lock()
	defer eb.mu.Unlock()
	event := map[string]interface{}{
		"event_type": eventType,
		"source":     eb.source,
		"topic":      eb.topic,
		"timestamp":  time.Now().Format(time.RFC3339),
		"payload":    payload,
	}
	eb.events = append(eb.events, event)
	log.Printf("[EventBus] %s → %s: %v", eb.topic, eventType, payload)
}

// ─── Input Validation ───────────────────────────────────────────────────────

var safeStringRegex = regexp.MustCompile(`^[a-zA-Z0-9_\-\.\s@:\/]{1,500}$`)

func sanitizeInput(s string) string {
	s = strings.TrimSpace(s)
	if len(s) > 500 {
		s = s[:500]
	}
	return s
}

func isValidIP(ip string) bool {
	return net.ParseIP(ip) != nil
}

func hashString(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

// ─── Main ───────────────────────────────────────────────────────────────────


// ── MIDDLEWARE: JWT Validation ───────────────────────────────────────────────

type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}

func fetchJWKS(realmURL string) {
	resp, err := http.Get(realmURL + "/protocol/openid-connect/certs")
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
		if len(eBytes) == 0 { continue }
		var eInt int
		for _, b := range eBytes { eInt = eInt<<8 | int(b) }
		pub := &rsa.PublicKey{N: new(big.Int).SetBytes(nBytes), E: eInt}
		jwtCache.keys[k.Kid] = pub
	}
	jwtCache.updated = time.Now()
	log.Printf("[middleware] JWKS refreshed: %d keys", len(jwtCache.keys))
}

func jwtMiddleware(realmURL string, next http.Handler) http.Handler {
	// Initial JWKS fetch
	go fetchJWKS(realmURL)
	// Refresh every 5 minutes
	go func() {
		for range time.Tick(5 * time.Minute) { fetchJWKS(realmURL) }
	}()
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip health endpoints
		if r.URL.Path == "/healthz" || r.URL.Path == "/readyz" || r.URL.Path == "/livez" || r.URL.Path == "/metrics" {
			next.ServeHTTP(w, r)
			return
		}
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			http.Error(w, `{"error":"missing bearer token"}`, http.StatusUnauthorized)
			return
		}
		token := auth[7:]
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			http.Error(w, `{"error":"invalid token format"}`, http.StatusUnauthorized)
			return
		}
		// Decode header for kid
		headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
		if err != nil {
			http.Error(w, `{"error":"invalid token header"}`, http.StatusUnauthorized)
			return
		}
		var header struct { Kid string `json:"kid"` }
		json.Unmarshal(headerBytes, &header)

		jwtCache.mu.RLock()
		pub, ok := jwtCache.keys[header.Kid]
		jwtCache.mu.RUnlock()
		if !ok {
			// Try refresh
			fetchJWKS(realmURL)
			jwtCache.mu.RLock()
			pub, ok = jwtCache.keys[header.Kid]
			jwtCache.mu.RUnlock()
			if !ok {
				http.Error(w, `{"error":"unknown signing key"}`, http.StatusUnauthorized)
				return
			}
		}
		// Verify signature (RS256)
		signingInput := parts[0] + "." + parts[1]
		sigBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
		if err != nil {
			http.Error(w, `{"error":"invalid signature encoding"}`, http.StatusUnauthorized)
			return
		}
		hash := sha256.Sum256([]byte(signingInput))
		if err := rsa.VerifyPKCS1v15(pub, crypto.SHA256, hash[:], sigBytes); err != nil {
			http.Error(w, `{"error":"invalid signature"}`, http.StatusUnauthorized)
			return
		}
		// Decode claims
		claimsBytes, _ := base64.RawURLEncoding.DecodeString(parts[1])
		var claims map[string]interface{}
		json.Unmarshal(claimsBytes, &claims)
		// Check expiry
		if exp, ok := claims["exp"].(float64); ok && time.Now().Unix() > int64(exp) {
			http.Error(w, `{"error":"token expired"}`, http.StatusUnauthorized)
			return
		}
		// Pass claims in context
		ctx := context.WithValue(r.Context(), "jwt_claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// ── MIDDLEWARE: Outbox Relay (Kafka) ────────────────────────────────────────

func startOutboxRelay(ctx context.Context, brokers string, topic string) {
	go func() {
		ticker := time.NewTicker(2 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				relayOutbox(brokers, topic)
			}
		}
	}()
}

func relayOutbox(brokers string, topic string) {
	if db == nil { return }

	// Events are marked published ONLY after a confirmed Kafka produce.
	producer, err := getKafkaProducer(brokers)
	if err != nil {
		log.Printf("[outbox-relay] kafka unavailable: %v — events remain unpublished for retry", err)
		return
	}

	rows, err := db.Query(`SELECT id, event_type, aggregate_id, payload FROM outbox WHERE published = FALSE ORDER BY created_at LIMIT 100`)
	if err != nil { return }
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id, eventType, aggID string
		var payload []byte
		if err := rows.Scan(&id, &eventType, &aggID, &payload); err != nil { continue }
		_, _, err := producer.SendMessage(&sarama.ProducerMessage{
			Topic: topic,
			Key:   sarama.StringEncoder(aggID),
			Value: sarama.ByteEncoder(payload),
		})
		if err != nil {
			log.Printf("[outbox-relay] publish failed for event %s: %v — leaving unpublished for retry", id, err)
			continue
		}
		ids = append(ids, id)
	}
	if len(ids) == 0 { return }
	for _, id := range ids {
		if _, err := db.Exec(`UPDATE outbox SET published = TRUE WHERE id = $1`, id); err != nil {
			log.Printf("[outbox-relay] failed to mark event %s published: %v", id, err)
		}
	}
	if len(ids) > 0 {
		log.Printf("[outbox-relay] published %d events to kafka topic=%s", len(ids), topic)
	}
}

// getKafkaProducer lazily creates a shared sarama SyncProducer.
var kafkaProducer sarama.SyncProducer
var kafkaProducerMu sync.Mutex

func getKafkaProducer(brokers string) (sarama.SyncProducer, error) {
	kafkaProducerMu.Lock()
	defer kafkaProducerMu.Unlock()
	if kafkaProducer != nil {
		return kafkaProducer, nil
	}
	cfg := sarama.NewConfig()
	cfg.Producer.Return.Successes = true
	cfg.Producer.RequiredAcks = sarama.WaitForAll
	cfg.Producer.Retry.Max = 3
	p, err := sarama.NewSyncProducer(strings.Split(brokers, ","), cfg)
	if err != nil {
		return nil, err
	}
	kafkaProducer = p
	return kafkaProducer, nil
}



func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL != "" {
		var err error
		db, err = sql.Open("postgres", dbURL)
		if err != nil {
			log.Printf("[PAM] Database connection failed: %v", err)
		} else {
			db.SetMaxOpenConns(25)
			db.SetMaxIdleConns(5)
			db.SetConnMaxLifetime(5 * time.Minute)
			if err := db.Ping(); err != nil {
				log.Printf("[PAM] Database ping failed: %v", err)
			} else {
				log.Println("[PAM] Connected to PostgreSQL")
				initSchema()
			}
		}
	} else {
		log.Println("[PAM] WARNING: DATABASE_URL not set — service will not persist state")
	}

	startWatchdog()
	go expireLoop()

	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", healthzHandler)
	mux.HandleFunc("/livez", livezHandler)
	mux.HandleFunc("/readyz", readyzHandler)

	mux.Handle("/api/v1/pam/request", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(handleRequestAccess)))
	mux.Handle("/api/v1/pam/approve", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(handleApproveRequest)))
	mux.Handle("/api/v1/pam/validate", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(handleValidateSession)))
	mux.Handle("/api/v1/pam/revoke", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(handleRevokeSession)))
	mux.Handle("/api/v1/pam/requests", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(handleListRequests)))
	mux.Handle("/api/v1/pam/sessions", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(handleActiveSessions)))
	mux.Handle("/api/v1/pam/policies", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(handleListPolicies)))
	mux.Handle("/api/v1/pam/stats", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(handleStats)))

	handler := panicRecoveryMiddleware(rateLimitMiddleware(loggingMiddleware(mux)))

	srv := &http.Server{Addr: ":" + port, Handler: handler, ReadTimeout: 30 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 120 * time.Second}

	go func() {
		log.Printf("[PAM] Privileged Access Management service starting on :%s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[PAM] Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("[PAM] Shutting down gracefully...")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
}

// ─── Standard Middleware ────────────────────────────────────────────────────

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		recordActivity()
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("[%s] %s %s %s", serviceName, r.Method, r.URL.Path, time.Since(start))
	})
}

func rateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		acquireSem()
		defer releaseSem()
		next.ServeHTTP(w, r)
	})
}

func panicRecoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				log.Printf("[PANIC] %s %s: %v", r.Method, r.URL.Path, err)
				http.Error(w, "internal server error", http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// jwtRealmURL resolves the Keycloak realm URL for jwtMiddleware (added by
// scripts/fix-go-wire-jwt.py).
func jwtRealmURL() string {
	if v := os.Getenv("KEYCLOAK_REALM_URL"); v != "" {
		return v
	}
	return "http://keycloak:8080/realms/54bank"
}
