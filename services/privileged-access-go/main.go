// 54Bank Privileged Access Management (PAM) — Go
// Domain: Security / Insider Threat
// Implements just-in-time privilege elevation with time-bound sessions.
// No standing admin access — all elevated access requires approval and auto-expires.
// Middleware: Kafka, Postgres, Redis, Temporal, Permify, Vault
package main

import (
	"context"
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

// AccessRequest represents a request for elevated privileges
type AccessRequest struct {
	ID            string    `json:"id"`
	RequestorID   string    `json:"requestor_id"`
	RequestorName string    `json:"requestor_name"`
	Resource      string    `json:"resource"`       // e.g. "database:core_banking", "service:gl-engine", "admin:user-management"
	AccessLevel   string    `json:"access_level"`   // "read", "write", "admin", "superadmin"
	Justification string    `json:"justification"`
	Duration      int       `json:"duration_minutes"` // max 480 (8 hours)
	Status        string    `json:"status"`           // "pending", "approved", "denied", "active", "expired", "revoked"
	ApprovedBy    string    `json:"approved_by,omitempty"`
	ApprovalChain []string  `json:"approval_chain"` // for superadmin: requires 2+ approvers
	SessionToken  string    `json:"session_token,omitempty"`
	IPAddress     string    `json:"ip_address"`
	DeviceID      string    `json:"device_id"`
	CreatedAt     time.Time `json:"created_at"`
	ExpiresAt     time.Time `json:"expires_at,omitempty"`
	RevokedAt     time.Time `json:"revoked_at,omitempty"`
	AuditTrail    []string  `json:"audit_trail"`
}

// ActiveSession represents a currently elevated session
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

// Policy defines access control rules
type AccessPolicy struct {
	Resource         string   `json:"resource"`
	MaxDuration      int      `json:"max_duration_minutes"`
	RequiredApprovers int     `json:"required_approvers"`
	AllowedRoles     []string `json:"allowed_roles"`
	RequiresMFA      bool     `json:"requires_mfa"`
	RequiresTicket   bool     `json:"requires_ticket"` // must reference incident/change ticket
	BlockedHours     []int    `json:"blocked_hours"`   // hours when access is denied (e.g. [0,1,2,3,4,5])
}

var (
	mu             sync.RWMutex
	requests       = make(map[string]*AccessRequest)
	activeSessions = make(map[string]*ActiveSession)
	policies       = map[string]*AccessPolicy{
		"database:core_banking": {Resource: "database:core_banking", MaxDuration: 60, RequiredApprovers: 2, AllowedRoles: []string{"dba", "sre"}, RequiresMFA: true, RequiresTicket: true, BlockedHours: []int{0, 1, 2, 3, 4, 5}},
		"database:audit_trail":  {Resource: "database:audit_trail", MaxDuration: 30, RequiredApprovers: 2, AllowedRoles: []string{"compliance_officer"}, RequiresMFA: true, RequiresTicket: true},
		"service:gl-engine":     {Resource: "service:gl-engine", MaxDuration: 120, RequiredApprovers: 1, AllowedRoles: []string{"sre", "backend_eng"}, RequiresMFA: true},
		"service:payments-hub":  {Resource: "service:payments-hub", MaxDuration: 60, RequiredApprovers: 2, AllowedRoles: []string{"sre"}, RequiresMFA: true, RequiresTicket: true},
		"admin:user-management": {Resource: "admin:user-management", MaxDuration: 240, RequiredApprovers: 1, AllowedRoles: []string{"hr_admin", "security_admin"}, RequiresMFA: true},
		"vault:secrets":         {Resource: "vault:secrets", MaxDuration: 30, RequiredApprovers: 2, AllowedRoles: []string{"security_admin"}, RequiresMFA: true, RequiresTicket: true},
		"k8s:production":        {Resource: "k8s:production", MaxDuration: 120, RequiredApprovers: 2, AllowedRoles: []string{"sre", "platform_eng"}, RequiresMFA: true, RequiresTicket: true},
	}
	auditLog  []map[string]interface{}
	db        *sql.DB
	requestID uint64
)

// ─── Core Logic ─────────────────────────────────────────────────────────────

func createAccessRequest(req *AccessRequest) error {
	mu.Lock()
	defer mu.Unlock()

	atomic.AddUint64(&requestID, 1)
	req.ID = fmt.Sprintf("PAM-%d-%s", atomic.LoadUint64(&requestID), secureRandHex(4))
	req.CreatedAt = time.Now()
	req.Status = "pending"
	req.AuditTrail = []string{fmt.Sprintf("%s: request created by %s for %s (%s)", req.CreatedAt.Format(time.RFC3339), req.RequestorID, req.Resource, req.AccessLevel)}

	// Validate against policy
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

	// Check blocked hours
	currentHour := time.Now().Hour()
	for _, blocked := range policy.BlockedHours {
		if currentHour == blocked {
			return fmt.Errorf("access to %s is blocked during hour %d (maintenance window)", req.Resource, currentHour)
		}
	}

	// Self-approval prevention: requestor cannot approve their own request
	req.ApprovalChain = make([]string, 0, policy.RequiredApprovers)

	requests[req.ID] = req

	appendAudit("pam_request_created", req.RequestorID, req.ID, map[string]interface{}{
		"resource": req.Resource, "access_level": req.AccessLevel, "duration": req.Duration,
	})

	eventBus.Emit("pam.request.created", map[string]interface{}{
		"request_id": req.ID, "requestor": req.RequestorID, "resource": req.Resource,
		"access_level": req.AccessLevel, "requires_approvers": policy.RequiredApprovers,
	})

	return nil
}

func approveRequest(requestID, approverID string) error {
	mu.Lock()
	defer mu.Unlock()

	req, ok := requests[requestID]
	if !ok {
		return fmt.Errorf("request %s not found", requestID)
	}
	if req.Status != "pending" {
		return fmt.Errorf("request %s is %s, cannot approve", requestID, req.Status)
	}

	// Self-approval prevention
	if approverID == req.RequestorID {
		appendAudit("pam_self_approval_blocked", approverID, requestID, nil)
		return fmt.Errorf("self-approval is prohibited: %s cannot approve their own request", approverID)
	}

	// Duplicate approval prevention
	for _, existing := range req.ApprovalChain {
		if existing == approverID {
			return fmt.Errorf("approver %s has already approved this request", approverID)
		}
	}

	policy := policies[req.Resource]
	req.ApprovalChain = append(req.ApprovalChain, approverID)
	req.AuditTrail = append(req.AuditTrail, fmt.Sprintf("%s: approved by %s (%d/%d)", time.Now().Format(time.RFC3339), approverID, len(req.ApprovalChain), policy.RequiredApprovers))

	if len(req.ApprovalChain) >= policy.RequiredApprovers {
		// Fully approved — activate session
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
		activeSessions[req.SessionToken] = session

		eventBus.Emit("pam.session.activated", map[string]interface{}{
			"request_id": req.ID, "user": req.RequestorID, "resource": req.Resource,
			"expires_at": req.ExpiresAt.Format(time.RFC3339), "approvers": req.ApprovalChain,
		})
	}

	appendAudit("pam_request_approved", approverID, requestID, map[string]interface{}{
		"approval_count": len(req.ApprovalChain), "required": policy.RequiredApprovers,
	})

	return nil
}

func validateSession(token string) (*ActiveSession, error) {
	mu.RLock()
	defer mu.RUnlock()

	session, ok := activeSessions[token]
	if !ok {
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

	session, ok := activeSessions[token]
	if !ok {
		return fmt.Errorf("session not found")
	}

	if req, exists := requests[session.RequestID]; exists {
		req.Status = "revoked"
		req.RevokedAt = time.Now()
		req.AuditTrail = append(req.AuditTrail, fmt.Sprintf("%s: REVOKED by %s — %s", time.Now().Format(time.RFC3339), revokerID, reason))
	}

	delete(activeSessions, token)

	appendAudit("pam_session_revoked", revokerID, session.RequestID, map[string]interface{}{
		"user": session.UserID, "resource": session.Resource, "reason": reason,
	})

	eventBus.Emit("pam.session.revoked", map[string]interface{}{
		"request_id": session.RequestID, "user": session.UserID, "revoker": revokerID, "reason": reason,
	})

	return nil
}

// expireLoop runs every 30 seconds, expiring sessions past their TTL
func expireLoop() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		mu.Lock()
		now := time.Now()
		for token, session := range activeSessions {
			if now.After(session.ExpiresAt) {
				if req, ok := requests[session.RequestID]; ok {
					req.Status = "expired"
					req.AuditTrail = append(req.AuditTrail, fmt.Sprintf("%s: session auto-expired", now.Format(time.RFC3339)))
				}
				delete(activeSessions, token)
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
	auditLog = append(auditLog, entry)

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

	mu.RLock()
	req := requests[body.RequestID]
	mu.RUnlock()

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
	mu.RLock()
	defer mu.RUnlock()

	status := r.URL.Query().Get("status")
	result := make([]*AccessRequest, 0)
	for _, req := range requests {
		if status == "" || req.Status == status {
			result = append(result, req)
		}
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
	mu.RLock()
	defer mu.RUnlock()

	sessions := make([]*ActiveSession, 0, len(activeSessions))
	for _, s := range activeSessions {
		sessions = append(sessions, s)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sessions)
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	defer mu.RUnlock()

	pending, active, denied, expired := 0, 0, 0, 0
	for _, req := range requests {
		switch req.Status {
		case "pending":
			pending++
		case "active":
			active++
		case "denied":
			denied++
		case "expired":
			expired++
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"total_requests":  len(requests),
		"pending":         pending,
		"active_sessions": len(activeSessions),
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

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Database connection
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL != "" {
		var err error
		db, err = sql.Open("postgres", dbURL)
		if err != nil {
			log.Printf("[PAM] Database connection failed: %v (continuing in-memory)", err)
		}
	}

	startWatchdog()
	go expireLoop()

	mux := http.NewServeMux()

	// Health endpoints
	mux.HandleFunc("/healthz", healthzHandler)
	mux.HandleFunc("/livez", livezHandler)
	mux.HandleFunc("/readyz", readyzHandler)

	// PAM endpoints
	mux.HandleFunc("/api/v1/pam/request", handleRequestAccess)
	mux.HandleFunc("/api/v1/pam/approve", handleApproveRequest)
	mux.HandleFunc("/api/v1/pam/validate", handleValidateSession)
	mux.HandleFunc("/api/v1/pam/revoke", handleRevokeSession)
	mux.HandleFunc("/api/v1/pam/requests", handleListRequests)
	mux.HandleFunc("/api/v1/pam/sessions", handleActiveSessions)
	mux.HandleFunc("/api/v1/pam/policies", handleListPolicies)
	mux.HandleFunc("/api/v1/pam/stats", handleStats)

	// Wrap with middleware
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
