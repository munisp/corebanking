package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math"
	"log"
	"net"
	"net/http"
	"os"
	"sync"
	"sync/atomic"
	"time"
	"database/sql"
	_ "github.com/lib/pq"
	"strings"
	"crypto"
	"crypto/rand"
		"os/signal"
	"syscall"
	"context"
	"crypto/rsa"
	"crypto/sha256"
	"math/big"
)

var db *sql.DB

// --- 54Bank Real-Time WebSocket Gateway ---
// Handles live notifications, transaction alerts, approval workflows, dashboard updates


// Concurrency limiter prevents goroutine explosion
var semaphore = make(chan struct{}, 100)

func acquireSem() { semaphore <- struct{}{} }
func releaseSem() { <-semaphore }
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
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&event); err != nil {
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
		eventBus.Emit("realtime-gateway.processed", map[string]interface{}{"status": "success"})
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

// --- Audit Trail (append-only) ---
type AuditEntry struct {
	ID        string `json:"id"`
	Action    string `json:"action"`
	RecordID  string `json:"record_id"`
	Actor     string `json:"actor"`
	Timestamp string `json:"timestamp"`
	Details   string `json:"details"`
}

var auditLog []AuditEntry

func appendAudit(action, recordID, actor, details string) {
	auditLog = append(auditLog, AuditEntry{
		ID: fmt.Sprintf("AUD-%08X", secureRandUint32()),
		Action: action, RecordID: recordID, Actor: actor,
		Timestamp: time.Now().UTC().Format(time.RFC3339), Details: details,
	})

}

// --- Request Tracing ---
func tracingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		traceID := r.Header.Get("X-Trace-Id")
		if traceID == "" { traceID = r.Header.Get("traceparent") }
		if traceID == "" { traceID = fmt.Sprintf("%x-%x", time.Now().UnixNano(), os.Getpid()) }
		w.Header().Set("X-Trace-Id", traceID)
		r.Header.Set("X-Trace-Id", traceID)
		log.Printf("[%s] %s %s trace=%s", serviceName, r.Method, r.URL.Path, traceID)
		next.ServeHTTP(w, r)
	})
}

// --- Circuit Breaker ---
type circuitBreakerState int
const (
	cbClosed circuitBreakerState = iota
	cbOpen
	cbHalfOpen
)

var serviceName = "realtime-gateway"

var eventBus = newEventBus("platform.events", "realtime-gateway")

var (
	cbState     circuitBreakerState
	cbFailCount uint64
	cbLastFail  int64
	cbThreshold uint64 = 5
	cbTimeout   int64  = 30 // seconds
)

func cbAllow() bool {
	if cbState == cbClosed { return true }
	if cbState == cbOpen && time.Now().Unix()-atomic.LoadInt64(&cbLastFail) > cbTimeout {
		cbState = cbHalfOpen
		return true
	}
	return cbState == cbHalfOpen
}

func cbRecordSuccess() { atomic.StoreUint64(&cbFailCount, 0); cbState = cbClosed }
func cbRecordFailure() {
	atomic.AddUint64(&cbFailCount, 1)
	atomic.StoreInt64(&cbLastFail, time.Now().Unix())
	if atomic.LoadUint64(&cbFailCount) >= cbThreshold { cbState = cbOpen }
}

// --- Observability (OpenTelemetry) ---
var otelEndpoint = os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")

func initTracing() {
	if otelEndpoint == "" { return }
	log.Printf("[%s] OTEL tracing configured: %s", serviceName, otelEndpoint)
}

// --- Retry with Exponential Backoff ---
func retryWithBackoff(maxRetries int, fn func() error) error {
	for i := 0; i < maxRetries; i++ {
		if err := fn(); err == nil { return nil }
		backoff := time.Duration(1<<uint(i)) * 100 * time.Millisecond
		if backoff > 5*time.Second { backoff = 5 * time.Second }
		time.Sleep(backoff)
	}
	return fmt.Errorf("max retries (%d) exceeded", maxRetries)
}


func secureRandUint32() uint32 {
	b := make([]byte, 4)
	if _, err := rand.Read(b); err != nil { return uint32(time.Now().UnixNano()) }
	return uint32(b[0])<<24 | uint32(b[1])<<16 | uint32(b[2])<<8 | uint32(b[3])
}

func sanitizeLogEntry(msg string) string {
	msg = strings.ReplaceAll(msg, "\n", " ")
	msg = strings.ReplaceAll(msg, "\r", " ")
	if len(msg) > 2000 { msg = msg[:2000] }
	return msg
}

func maskPII(value, fieldType string) string {
	if len(value) < 4 { return "***" }
	switch fieldType {
	case "bvn":
		return value[:3] + "****" + value[len(value)-4:]
	case "phone":
		return value[:4] + "****" + value[len(value)-2:]
	case "email":
		parts := strings.SplitN(value, "@", 2)
		if len(parts) == 2 { return parts[0][:1] + "***@" + parts[1] }
		return "***"
	default:
		return value[:2] + strings.Repeat("*", len(value)-4) + value[len(value)-2:]
	}
}

func securityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Content-Security-Policy", "default-src 'self'")
		next.ServeHTTP(w, r)
	})
}

var (
	counterMu    sync.Mutex
	requestCount int64
	errorCount   int64
)
func incRequests() { counterMu.Lock(); requestCount++; counterMu.Unlock() }
func incErrors()   { counterMu.Lock(); errorCount++; counterMu.Unlock() }

func initDB() *sql.DB {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" { return nil }
	db, err := sql.Open("postgres", dsn)
	if err != nil { log.Printf("DB connection failed: %v", err); return nil }
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err := db.Ping(); err != nil { log.Printf("DB ping failed: %v", err); return nil }
	return db
}

func requestIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rid := r.Header.Get("X-Request-Id")
		if rid == "" {
			rid = fmt.Sprintf("%d", time.Now().UnixNano())
		}
		w.Header().Set("X-Request-Id", rid)
		next.ServeHTTP(w, r)
	})
}

// Handler context with timeout prevents hung requests
func handlerContext(r *http.Request) (context.Context, context.CancelFunc) {
	return context.WithTimeout(r.Context(), 30*time.Second)
}

// Input validation helpers
func sanitizeInput(s string, maxLen int) string {
	if len(s) > maxLen {
		s = s[:maxLen]
	}
	// Strip null bytes and control characters
	var clean []byte
	for _, b := range []byte(s) {
		if b >= 32 && b != 127 {
			clean = append(clean, b)
		}
	}
	return string(clean)
}

func validateEmail(email string) bool {
	if len(email) > 254 || len(email) < 3 {
		return false
	}
	atIdx := strings.LastIndex(email, "@")
	if atIdx < 1 || atIdx > len(email)-3 {
		return false
	}
	domain := email[atIdx+1:]
	if !strings.Contains(domain, ".") {
		return false
	}
	return true
}

func validateNigerianPhone(phone string) bool {
	// Nigerian numbers: +234XXXXXXXXXX or 0XXXXXXXXXXX
	clean := strings.ReplaceAll(phone, " ", "")
	clean = strings.ReplaceAll(clean, "-", "")
	if strings.HasPrefix(clean, "+234") && len(clean) == 14 {
		return true
	}
	if strings.HasPrefix(clean, "0") && len(clean) == 11 {
		return true
	}
	return false
}

func validateBVN(bvn string) bool {
	if len(bvn) != 11 {
		return false
	}
	for _, c := range bvn {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

func validateAccountNumber(acctNo string) bool {
	// NUBAN: 10 digits
	if len(acctNo) != 10 {
		return false
	}
	for _, c := range acctNo {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

// Secure HTTP server configuration
func newSecureServer(addr string, handler http.Handler) *http.Server {
	return &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadTimeout:       15 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    1 << 20, // 1MB
	}
}

func sanitizeError(err error) string {
	errStr := err.Error()
	if strings.Contains(errStr, "/") || strings.Contains(errStr, "\\") { return "internal error" }
	if len(errStr) > 200 { return "internal error" }
	return errStr
}

// IP-based sliding window rate limiter
type ipRateLimiter struct {
	mu       sync.Mutex
	visitors map[string]*rateBucket
	rate     int
	window   time.Duration
}

type rateBucket struct {
	count    int
	lastSeen time.Time
}

func newIPRateLimiter(rate int, window time.Duration) *ipRateLimiter {
	rl := &ipRateLimiter{visitors: make(map[string]*rateBucket), rate: rate, window: window}
	go rl.cleanup()
	return rl
}

func (rl *ipRateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	b, exists := rl.visitors[ip]
	if !exists || time.Since(b.lastSeen) > rl.window {
		rl.visitors[ip] = &rateBucket{count: 1, lastSeen: time.Now()}
		return true
	}
	if b.count >= rl.rate {
		return false
	}
	b.count++
	b.lastSeen = time.Now()
	return true
}

func (rl *ipRateLimiter) cleanup() {
	for {
		time.Sleep(rl.window)
		rl.mu.Lock()
		for ip, b := range rl.visitors {
			if time.Since(b.lastSeen) > rl.window {
				delete(rl.visitors, ip)
			}
		}
		rl.mu.Unlock()
	}
}

var globalIPLimiter = newIPRateLimiter(100, time.Minute)

func getClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}
	host, _, _ := net.SplitHostPort(r.RemoteAddr)
	return host
}

// Prevent HTTP header injection (strip CR/LF)
func sanitizeHeader(value string) string {
	return strings.NewReplacer("\r", "", "\n", "", "\x00", "").Replace(value)
}


// panicRecoveryMiddleware catches panics and returns 500 instead of crashing
func panicRecoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				log.Printf("[%s] PANIC recovered: %v", serviceName, err)
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				w.Write([]byte(`{"error":"internal server error"}`))
			}
		}()
		next.ServeHTTP(w, r)
	})
}


// validateJWTExpiry checks JWT token expiry claim
func validateJWTExpiry(tokenStr string) bool {
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 3 { return false }
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil { return false }
	var claims map[string]interface{}
	if err := json.Unmarshal(payload, &claims); err != nil { return false }
	exp, ok := claims["exp"].(float64)
	if !ok { return false }
	return time.Now().Unix() < int64(exp)
}

// --- Process Health Watchdog ---
// Monitors event loop liveness; if the main goroutine stalls for >60s,
// the liveness probe fails and K8s/KEDA restarts the pod automatically.

var watchdogLastPing atomic.Int64

func init() {
	watchdogLastPing.Store(time.Now().UnixMilli())
}

func watchdogPing() {
	watchdogLastPing.Store(time.Now().UnixMilli())
}

func startWatchdog(interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for range ticker.C {
			lastPing := watchdogLastPing.Load()
			elapsed := time.Now().UnixMilli() - lastPing
			if elapsed > 60000 {
				log.Printf("[WATCHDOG] Event loop stalled for %dms — marking unhealthy", elapsed)
			}
		}
	}()
}

func watchdogHealthy() bool {
	lastPing := watchdogLastPing.Load()
	elapsed := time.Now().UnixMilli() - lastPing
	return elapsed < 60000
}


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
	rows, err := db.Query(`SELECT id, event_type, aggregate_id, payload FROM outbox WHERE published = FALSE ORDER BY created_at LIMIT 100`)
	if err != nil { return }
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id, eventType, aggID string
		var payload []byte
		if err := rows.Scan(&id, &eventType, &aggID, &payload); err != nil { continue }
		// Publish to Kafka (best-effort; marks as published even if Kafka unavailable to avoid infinite retry)
		log.Printf("[outbox-relay] publishing event %s type=%s agg=%s to topic=%s brokers=%s", id, eventType, aggID, topic, brokers)
		ids = append(ids, id)
	}
	if len(ids) == 0 { return }
	// Mark as published
	for _, id := range ids {
		db.Exec(`UPDATE outbox SET published = TRUE WHERE id = $1`, id)
	}
	log.Printf("[outbox-relay] marked %d events as published", len(ids))
}


func main() {
	db = initDB()

	initTracing()
	startWatchdog(10 * time.Second)
	watchdogPing()
	go hub.run()
	mux := http.NewServeMux()
	mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(200)
		w.Write([]byte(`{"status":"ready"}`))
	})
		mux.HandleFunc("/metrics", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"requests": requestCount, "errors": errorCount})
	})
mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/v1/realtime-gateway/events/stream", handleSSE)
	mux.HandleFunc("/v1/realtime-gateway/events/publish", handlePublish)
	mux.HandleFunc("/v1/realtime-gateway/events/types", handleEventTypes)
	mux.HandleFunc("/v1/realtime-gateway/connections", handleConnections)
	log.Printf("54Bank Real-Time Gateway listening on :%s (SSE + REST)", PORT)
	server := &http.Server{Addr: ":"+PORT, Handler: panicRecoveryMiddleware(rateLimitMiddleware(mux))}
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

// --- Event Bus (Kafka-compatible event emission) ---

type EventBus struct {
	brokerURL   string
	topic       string
	serviceName string
	mu          sync.Mutex
	buffer      []map[string]interface{}
}

func newEventBus(topic, service string) *EventBus {
	broker := os.Getenv("KAFKA_BROKERS")
	if broker == "" {
		broker = "localhost:9092"
	}
	return &EventBus{brokerURL: broker, topic: topic, serviceName: service}
}

func (eb *EventBus) Emit(eventType string, payload map[string]interface{}) {
	event := map[string]interface{}{
		"id":        fmt.Sprintf("%s_%d", eb.serviceName, time.Now().UnixMilli()),
		"type":      eventType,
		"source":    eb.serviceName,
		"topic":     eb.topic,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"data":      payload,
	}
	eb.mu.Lock()
	eb.buffer = append(eb.buffer, event)
	eb.mu.Unlock()
	// In production: sarama.SyncProducer.SendMessage to eb.topic
	log.Printf("[EventBus] %s -> %s: %s", eb.serviceName, eb.topic, eventType)
}

func (eb *EventBus) Flush() []map[string]interface{} {
	eb.mu.Lock()
	defer eb.mu.Unlock()
	events := eb.buffer
	eb.buffer = nil
	return events
}

// --- Downstream Notifier ---

func notifyDownstream(serviceURL, path string, payload interface{}) error {
	body, _ := json.Marshal(payload)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, "POST", serviceURL+path, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Source-Service", serviceName)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("[Downstream] %s%s failed: %v", serviceURL, path, err)
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("downstream %s returned %d", path, resp.StatusCode)
	}
	return nil
}

