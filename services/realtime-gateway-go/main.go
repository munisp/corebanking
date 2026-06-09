package main

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
	"crypto/rand"
)

// --- 54Bank Real-Time WebSocket Gateway ---
// Handles live notifications, transaction alerts, approval workflows, dashboard updates

var PORT = "8096"

func init() {
	if p := os.Getenv("PORT"); p != "" { PORT = p }
}

// --- Connection Hub ---
type Client struct {
	ID       string
	UserID   string
	TenantID string
	Channels map[string]bool
	Send     chan []byte
}

type Hub struct {
	mu         sync.RWMutex
	clients    map[string]*Client
	broadcast  chan *Event
	register   chan *Client
	unregister chan *Client
}

type Event struct {
	Type      string                 `json:"type"`
	Channel   string                 `json:"channel"`
	Payload   map[string]interface{} `json:"payload"`
	Timestamp  string                 `json:"timestamp"`
	TargetUser string                `json:"target_user,omitempty"`
	TenantID  string                 `json:"tenant_id,omitempty"`
}

var hub = &Hub{
	clients:    make(map[string]*Client),
	broadcast:  make(chan *Event, 256),
	register:   make(chan *Client),
	unregister: make(chan *Client),
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client.ID] = client
			h.mu.Unlock()
			log.Printf("[WS] Client connected: %s user=%s", client.ID, client.UserID)
		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.ID]; ok {
				delete(h.clients, client.ID)
				close(client.Send)
			}
			h.mu.Unlock()
			log.Printf("[WS] Client disconnected: %s", client.ID)
		case event := <-h.broadcast:
			h.mu.RLock()
			data, _ := json.Marshal(event)
			for _, client := range h.clients {
				if event.TargetUser != "" && client.UserID != event.TargetUser { continue }
				if event.TenantID != "" && client.TenantID != event.TenantID { continue }
				if event.Channel != "" && !client.Channels[event.Channel] { continue }
				select {
				case client.Send <- data:
				default: // buffer full, skip
				}
			}
			h.mu.RUnlock()
		}
	}
}

func generateID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return fmt.Sprintf("%x", b)
}

// --- SSE (Server-Sent Events) Endpoint ---
func handleSSE(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "SSE not supported", http.StatusInternalServerError)
		return
	}

	userID := r.URL.Query().Get("user_id")
	tenantID := r.URL.Query().Get("tenant_id")
	clientID := generateID()

	client := &Client{
		ID: clientID, UserID: userID, TenantID: tenantID,
		Channels: map[string]bool{"transactions": true, "approvals": true, "alerts": true, "system": true},
		Send: make(chan []byte, 64),
	}
	hub.register <- client

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Send connection event
	connEvent, _ := json.Marshal(map[string]interface{}{
		"type": "connected", "client_id": clientID, "channels": []string{"transactions", "approvals", "alerts", "system"},
	})
	fmt.Fprintf(w, "data: %s\n\n", connEvent)
	flusher.Flush()

	notify := r.Context().Done()
	for {
		select {
		case msg, ok := <-client.Send:
			if !ok { return }
			fmt.Fprintf(w, "data: %s\n\n", msg)
			flusher.Flush()
		case <-notify:
			hub.unregister <- client
			return
		}
	}
}

// --- Event Publishing API ---
func handlePublish(w http.ResponseWriter, r *http.Request) {
	var event Event
	if err := json.NewDecoder(r.Body).Decode(&event); err != nil {
		respondJSON(w, 400, map[string]interface{}{"error": "Invalid JSON"})
		return
	}
	event.Timestamp = time.Now().UTC().Format(time.RFC3339)
	hub.broadcast <- &event
	respondJSON(w, 200, map[string]interface{}{"status": "published", "channel": event.Channel})
}

// --- Predefined Event Types ---
var eventTypes = map[string]string{
	"transaction.completed":   "transactions",
	"transaction.failed":      "transactions",
	"transaction.reversed":    "transactions",
	"approval.requested":      "approvals",
	"approval.approved":       "approvals",
	"approval.rejected":       "approvals",
	"alert.fraud":             "alerts",
	"alert.aml":               "alerts",
	"alert.system":            "system",
	"kyc.status_changed":      "alerts",
	"loan.disbursed":          "transactions",
	"loan.repayment_due":      "alerts",
	"card.transaction":        "transactions",
	"balance.threshold":       "alerts",
}

func handleEventTypes(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{"event_types": eventTypes})
}

func handleConnections(w http.ResponseWriter, r *http.Request) {
	hub.mu.RLock()
	defer hub.mu.RUnlock()
	conns := make([]map[string]interface{}, 0, len(hub.clients))
	for _, c := range hub.clients {
		conns = append(conns, map[string]interface{}{
			"client_id": c.ID, "user_id": c.UserID, "tenant_id": c.TenantID,
			"channels": c.Channels,
		})
	}
	respondJSON(w, 200, map[string]interface{}{"connections": conns, "count": len(conns)})
}

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	hub.mu.RLock()
	count := len(hub.clients)
	hub.mu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{
		"status": "healthy", "service": "realtime-gateway", "version": "1.0.0",
		"connections": count, "channels": []string{"transactions", "approvals", "alerts", "system"},
	})
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}


// ─── Idempotency Middleware ─────────────────────────────────────────────────
var idempotencyCache = struct {
	sync.RWMutex
	entries map[string]idempotencyEntry
}{entries: make(map[string]idempotencyEntry)}

type idempotencyEntry struct {
	response   []byte
	statusCode int
	createdAt  time.Time
}

func idempotencyMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" && r.Method != "PUT" {
			next.ServeHTTP(w, r)
			return
		}
		key := r.Header.Get("Idempotency-Key")
		if key == "" {
			next.ServeHTTP(w, r)
			return
		}
		idempotencyCache.RLock()
		if entry, ok := idempotencyCache.entries[key]; ok {
			idempotencyCache.RUnlock()
			w.Header().Set("X-Idempotency-Replayed", "true")
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(entry.statusCode)
			w.Write(entry.response)
			return
		}
		idempotencyCache.RUnlock()
		rec := &idempotencyRecorder{ResponseWriter: w, statusCode: 200}
		next.ServeHTTP(rec, r)
		idempotencyCache.Lock()
		idempotencyCache.entries[key] = idempotencyEntry{response: rec.body, statusCode: rec.statusCode, createdAt: time.Now()}
		idempotencyCache.Unlock()
		// Cleanup old entries (>24h) in background
		go func() {
			idempotencyCache.Lock()
			defer idempotencyCache.Unlock()
			for k, v := range idempotencyCache.entries {
				if time.Since(v.createdAt) > 24*time.Hour { delete(idempotencyCache.entries, k) }
			}
		}()
	})
}

type idempotencyRecorder struct {
	http.ResponseWriter
	statusCode int
	body       []byte
}

func (r *idempotencyRecorder) WriteHeader(code int) { r.statusCode = code; r.ResponseWriter.WriteHeader(code) }
func (r *idempotencyRecorder) Write(b []byte) (int, error) { r.body = append(r.body, b...); return r.ResponseWriter.Write(b) }


// ─── Optimistic Locking for Balance Updates ─────────────────────────────────
// All balance updates use version-checked atomic operations.
type BalanceLock struct {
	AccountID string
	Version   int64
	Balance   int64 // kobo
}

func dbUpdateBalanceAtomic(accountID string, deltaKobo int64, currentVersion int64) (int64, error) {
	if db == nil { return 0, fmt.Errorf("DB not available") }
	tx, err := db.Begin()
	if err != nil { return 0, err }
	defer tx.Rollback()
	var balance int64
	var version int64
	err = tx.QueryRow("SELECT balance_kobo, version FROM account_balances WHERE account_id = $1 FOR UPDATE", accountID).Scan(&balance, &version)
	if err != nil { return 0, fmt.Errorf("account not found or locked: %v", err) }
	if version != currentVersion {
		return 0, fmt.Errorf("optimistic lock conflict: expected version %d, got %d", currentVersion, version)
	}
	newBalance := balance + deltaKobo
	if newBalance < 0 { return 0, fmt.Errorf("insufficient balance: have %d kobo, need %d kobo", balance, -deltaKobo) }
	_, err = tx.Exec("UPDATE account_balances SET balance_kobo = $1, version = version + 1, updated_at = NOW() WHERE account_id = $2 AND version = $3",
		newBalance, accountID, currentVersion)
	if err != nil { return 0, err }
	err = tx.Commit()
	if err != nil { return 0, err }
	return newBalance, nil
}


// ─── Maker-Checker (Dual Authorization) ────────────────────────────────────
// CBN requires dual control for high-value operations.
type MakerCheckerRequest struct {
	RequestID  string      `json:"request_id"`
	Operation  string      `json:"operation"`
	MakerID    string      `json:"maker_id"`
	CheckerID  string      `json:"checker_id,omitempty"`
	AmountKobo int64       `json:"amount_kobo"`
	Status     string      `json:"status"` // pending_approval|approved|rejected
	Payload    interface{} `json:"payload"`
	CreatedAt  string      `json:"created_at"`
	DecidedAt  string      `json:"decided_at,omitempty"`
}

var (
	makerCheckerRequests []MakerCheckerRequest
	makerCheckerMu       sync.Mutex
)

// makerCheckerThresholds defines CBN-required dual authorization thresholds (kobo)
var makerCheckerThresholds = map[string]int64{
	"transfer":      100_000_000, // ₦1M
	"loan_disburse": 100_000_000, // ₦1M
	"gl_posting":    50_000_000,  // ₦500K
	"account_close": 0,           // Always requires checker
}

func requiresMakerChecker(operation string, amountKobo int64) bool {
	threshold, ok := makerCheckerThresholds[operation]
	if !ok { threshold = 100_000_000 }
	return amountKobo >= threshold
}

func submitForApproval(operation, makerID string, amountKobo int64, payload interface{}) *MakerCheckerRequest {
	req := MakerCheckerRequest{
		RequestID: fmt.Sprintf("MCR-%d", time.Now().UnixNano()),
		Operation: operation, MakerID: makerID, AmountKobo: amountKobo,
		Status: "pending_approval", Payload: payload,
		CreatedAt: time.Now().Format(time.RFC3339),
	}
	makerCheckerMu.Lock()
	makerCheckerRequests = append(makerCheckerRequests, req)
	makerCheckerMu.Unlock()
	return &req
}


// ─── Immutable Audit Trail ──────────────────────────────────────────────────
// Append-only audit log. No DELETE or UPDATE permitted on audit records.
type AuditEntry struct {
	ID         string `json:"id"`
	Timestamp  string `json:"timestamp"`
	Service    string `json:"service"`
	Operation  string `json:"operation"`
	ActorID    string `json:"actor_id"`
	EntityID   string `json:"entity_id"`
	EntityType string `json:"entity_type"`
	OldState   string `json:"old_state,omitempty"`
	NewState   string `json:"new_state,omitempty"`
	IPAddress  string `json:"ip_address,omitempty"`
	Checksum   string `json:"checksum"` // SHA256 of entry for tamper detection
}

var (
	auditLog   []AuditEntry
	auditLogMu sync.RWMutex
)

func appendAuditEntry(service, operation, actorID, entityID, entityType, oldState, newState, ip string) {
	entry := AuditEntry{
		ID:         fmt.Sprintf("AUD-%d", time.Now().UnixNano()),
		Timestamp:  time.Now().UTC().Format(time.RFC3339Nano),
		Service:    service,
		Operation:  operation,
		ActorID:    actorID,
		EntityID:   entityID,
		EntityType: entityType,
		OldState:   oldState,
		NewState:   newState,
		IPAddress:  ip,
	}
	// Compute tamper-detection checksum
	raw := fmt.Sprintf("%s|%s|%s|%s|%s|%s|%s|%s|%s", entry.ID, entry.Timestamp, entry.Service, entry.Operation, entry.ActorID, entry.EntityID, entry.OldState, entry.NewState, entry.IPAddress)
	entry.Checksum = fmt.Sprintf("%x", sha256.Sum256([]byte(raw)))
	auditLogMu.Lock()
	auditLog = append(auditLog, entry)
	auditLogMu.Unlock()
	// Persist to DB if available (append-only INSERT, never UPDATE/DELETE)
	if db != nil {
		go func() {
			db.Exec("INSERT INTO audit_trail (id, timestamp, service, operation, actor_id, entity_id, entity_type, old_state, new_state, ip_address, checksum) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
				entry.ID, entry.Timestamp, entry.Service, entry.Operation, entry.ActorID, entry.EntityID, entry.EntityType, entry.OldState, entry.NewState, entry.IPAddress, entry.Checksum)
		}()
	}
}


// ─── Transaction Atomicity ──────────────────────────────────────────────────
// All multi-step write operations wrapped in DB transactions.
func dbExecAtomic(queries []string, params [][]interface{}) error {
	if db == nil { return fmt.Errorf("DB not available") }
	tx, err := db.Begin()
	if err != nil { return fmt.Errorf("BEGIN failed: %v", err) }
	for i, q := range queries {
		var args []interface{}
		if i < len(params) { args = params[i] }
		if _, err := tx.Exec(q, args...); err != nil {
			tx.Rollback()
			return fmt.Errorf("step %d failed: %v", i+1, err)
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("COMMIT failed: %v", err)
	}
	return nil
}


func main() {
	go hub.run()
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/events/stream", handleSSE)
	mux.HandleFunc("/events/publish", handlePublish)
	mux.HandleFunc("/events/types", handleEventTypes)
	mux.HandleFunc("/connections", handleConnections)
	log.Printf("54Bank Real-Time Gateway listening on :%s (SSE + REST)", PORT)
	log.Fatal(http.ListenAndServe(":"+PORT, mux))
}
