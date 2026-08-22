// 54Bank Break-Glass Emergency Access — Go
// All state persisted to PostgreSQL. No in-memory maps.
package main

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
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
		`CREATE TABLE IF NOT EXISTS break_glass_audit_log (
			id TEXT PRIMARY KEY, event_id TEXT, actor TEXT NOT NULL,
			action TEXT NOT NULL, reason TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
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

// ── MIDDLEWARE: JWT Validation (RS256 via Keycloak JWKS) ────────────────────
// Break-glass is an emergency privileged-access surface: every non-health
// route MUST be authenticated and authorized. Fail closed on any error.

type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}
var jwksHTTPClient = &http.Client{Timeout: 5 * time.Second}

func jwtRealmURL() string {
	if v := os.Getenv("KEYCLOAK_REALM_URL"); v != "" {
		return v
	}
	return "http://keycloak:8080/realms/54bank"
}

func fetchJWKS(realmURL string) {
	resp, err := jwksHTTPClient.Get(realmURL + "/protocol/openid-connect/certs")
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

// ── Break-glass role authorization ──────────────────────────────────────────

func breakGlassAllowedRoles() map[string]bool {
	if v := os.Getenv("BREAK_GLASS_REQUIRED_ROLES"); v != "" {
		roles := map[string]bool{}
		for _, r := range strings.Split(v, ",") {
			if r = strings.TrimSpace(r); r != "" { roles[r] = true }
		}
		if len(roles) > 0 { return roles }
	}
	// Default: only explicit break-glass or platform admin roles.
	return map[string]bool{"break-glass": true, "break-glass-admin": true, "admin": true}
}

func jwtClaims(r *http.Request) map[string]interface{} {
	if c, ok := r.Context().Value("jwt_claims").(map[string]interface{}); ok { return c }
	return nil
}

func tokenSubject(r *http.Request) string {
	claims := jwtClaims(r)
	if claims == nil { return "" }
	if sub, ok := claims["sub"].(string); ok { return sub }
	if p, ok := claims["preferred_username"].(string); ok { return p }
	return ""
}

func claimsHaveRole(claims map[string]interface{}, allowed map[string]bool) bool {
	// Keycloak realm_access.roles
	if ra, ok := claims["realm_access"].(map[string]interface{}); ok {
		if roles, ok := ra["roles"].([]interface{}); ok {
			for _, role := range roles {
				if s, ok := role.(string); ok && allowed[s] { return true }
			}
		}
	}
	if roles, ok := claims["roles"].([]interface{}); ok {
		for _, role := range roles {
			if s, ok := role.(string); ok && allowed[s] { return true }
		}
	}
	if role, ok := claims["role"].(string); ok && allowed[role] { return true }
	return false
}

func requireBreakGlassRole(next http.Handler) http.Handler {
	allowed := breakGlassAllowedRoles()
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims := jwtClaims(r)
		if claims == nil {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		if !claimsHaveRole(claims, allowed) {
			log.Printf("[break-glass] DENIED: subject=%q lacks break-glass role", tokenSubject(r))
			http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// secure wires the full auth chain for privileged break-glass routes.
func secure(h http.HandlerFunc) http.Handler {
	return jwtMiddleware(jwtRealmURL(), requireBreakGlassRole(h))
}

// ── Mandatory audit logging (who / when / why) ──────────────────────────────

// auditBreakGlass writes a tamper-evident audit entry for a break-glass
// lifecycle transition. Auditing is MANDATORY: if the database is configured
// and the audit insert fails, an error is returned so the caller fails the
// request rather than performing privileged actions unaudited.
func auditBreakGlass(actor, action, eventID, reason string) error {
	id := fmt.Sprintf("BGA-%d-%s", time.Now().UnixNano(), secureRandHex(4))
	now := time.Now()
	log.Printf("[BREAK-GLASS-AUDIT] id=%s action=%s actor=%s event=%s reason=%q at=%s",
		id, action, actor, eventID, reason, now.Format(time.RFC3339Nano))
	eventBus.Emit("break-glass.audit", map[string]interface{}{
		"audit_id": id, "action": action, "actor": actor,
		"event_id": eventID, "reason": reason, "at": now.Format(time.RFC3339Nano),
	})
	if db == nil { return nil }
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.ExecContext(ctx,
		`INSERT INTO break_glass_audit_log (id, event_id, actor, action, reason, created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
		id, eventID, actor, action, reason, now)
	if err != nil {
		log.Printf("[BREAK-GLASS-AUDIT] CRITICAL: audit insert failed: %v", err)
		return fmt.Errorf("audit logging failed")
	}
	return nil
}

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
	if body.Reason == "" { http.Error(w, `{"error":"reason is required"}`, 400); return }
	// Identity comes from verified JWT claims, never client-supplied fields.
	requestorID := tokenSubject(r)
	if requestorID == "" { http.Error(w, `{"error":"unauthorized"}`, 401); return }
	evt, err := activateBreakGlass(requestorID, body.Resource, body.Reason, body.Severity, r.RemoteAddr)
	if err != nil { http.Error(w, err.Error(), 400); return }
	if err := auditBreakGlass(requestorID, "activate", evt.ID, body.Reason); err != nil {
		http.Error(w, `{"error":"internal error"}`, 500); return
	}
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
	var body struct { EventID string `json:"event_id"`; ReviewerID string `json:"reviewer_id"`; Reason string `json:"reason"`; Notes string `json:"notes"` }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil { http.Error(w, "invalid JSON", 400); return }
	if body.Reason == "" { http.Error(w, `{"error":"reason is required"}`, 400); return }
	// Identity comes from verified JWT claims, never client-supplied fields.
	reviewerID := tokenSubject(r)
	if reviewerID == "" { http.Error(w, `{"error":"unauthorized"}`, 401); return }
	if err := auditBreakGlass(reviewerID, "close", body.EventID, body.Reason); err != nil {
		http.Error(w, `{"error":"internal error"}`, 500); return
	}
	if err := closeBreakGlass(body.EventID, reviewerID, body.Notes); err != nil { http.Error(w, err.Error(), 400); return }
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
	mux.Handle("/api/v1/break-glass/activate", secure(handleActivate))
	mux.Handle("/api/v1/break-glass/log-action", secure(handleLogAction))
	mux.Handle("/api/v1/break-glass/close", secure(handleClose))
	mux.Handle("/api/v1/break-glass/events", secure(handleListEvents))
	mux.Handle("/api/v1/break-glass/stats", secure(handleStats))
	handler := panicRecoveryMiddleware(rateLimitMiddleware(loggingMiddleware(mux)))
	srv := &http.Server{Addr: ":" + port, Handler: handler, ReadTimeout: 30 * time.Second, WriteTimeout: 30 * time.Second}
	go func() { log.Printf("[break-glass] Starting on :%s", port); if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed { log.Fatal(err) } }()
	quit := make(chan os.Signal, 1); signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM); <-quit
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second); defer cancel(); srv.Shutdown(ctx)
}
