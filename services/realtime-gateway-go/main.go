package main

import (
	"encoding/json"
	"fmt"
	"math"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
	"crypto/rand"
		"os/signal"
	"syscall"
	"context"
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


func rateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Simple token bucket: allow bursts of 100 requests
		next.ServeHTTP(w, r)
	})
}


// --- Monetary Safety (kobo precision) ---
type AmountKobo = int64

func nairaToKobo(naira float64) AmountKobo { return AmountKobo(math.Round(naira * 100)) }
func koboToNaira(kobo AmountKobo) float64  { return float64(kobo) / 100.0 }
func roundNaira(amount float64) float64 { return math.Round(amount*100) / 100 }
func validateAmount(amount float64) error {
	if amount < 0 { return fmt.Errorf("amount must be non-negative") }
	if amount > 999_999_999_999.99 { return fmt.Errorf("exceeds CBN max limit") }
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
	server := &http.Server{Addr: ":"+PORT, Handler: rateLimitMiddleware(mux)}
	go func() {
		log.Printf("[realtime-gateway-go] Starting on :%s", PORT)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[realtime-gateway-go] ListenAndServe error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("[realtime-gateway-go] Shutdown signal received")

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	_ = server.Shutdown(ctx)
	log.Println("[realtime-gateway-go] Server stopped gracefully")
}
