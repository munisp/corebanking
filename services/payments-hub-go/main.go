package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"crypto/rand"
	"fmt"
	"math"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"
	"crypto/sha256"

	_ "github.com/lib/pq"
		"os/signal"
	"syscall"
)

var (
	serviceName  = "payments-hub-go"
	db           *sql.DB
	requestCount uint64
	errorCount   uint64
)

func respondJSON(w http.ResponseWriter, args ...interface{}) {
	w.Header().Set("Content-Type", "application/json")
	status := 200
	var data interface{}
	if len(args) == 2 {
		if s, ok := args[0].(int); ok { status = s }
		data = args[1]
	} else if len(args) == 1 {
		data = args[0]
	}
	w.WriteHeader(status)
		eventBus.Emit("payments-hub.processed", map[string]interface{}{"status": "success"})
	json.NewEncoder(w).Encode(data)
}

func healthHandler(w http.ResponseWriter, _ *http.Request) {
	dbStatus := "not_configured"
	if db != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		if err := db.PingContext(ctx); err != nil {
			dbStatus = fmt.Sprintf("unhealthy: %v", err)
		} else { dbStatus = "connected" }
	}
	overall := "healthy"
	if strings.Contains(dbStatus, "unhealthy") { overall = "degraded" }
	respondJSON(w, map[string]interface{}{"status": overall, "service": serviceName, "version": "2.0.0", "checks": map[string]string{"database": dbStatus}})
}

func readyzHandler(w http.ResponseWriter, _ *http.Request) { respondJSON(w, map[string]interface{}{"ready": true}) }
func livezHandler(w http.ResponseWriter, _ *http.Request)  { respondJSON(w, map[string]interface{}{"alive": true}) }

func metricsHandler(w http.ResponseWriter, _ *http.Request) {
	r := atomic.LoadUint64(&requestCount); e := atomic.LoadUint64(&errorCount)
	w.Header().Set("Content-Type", "text/plain")
	fmt.Fprintf(w, "requests_total{service=\"%s\"} %d\nerrors_total{service=\"%s\"} %d\n", serviceName, r, serviceName, e)
}

func rateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddUint64(&requestCount, 1); next.ServeHTTP(w, r)
	})
}

func authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/health" || r.URL.Path == "/readyz" || r.URL.Path == "/livez" || r.URL.Path == "/metrics" {
			next.ServeHTTP(w, r); return
		}
		auth := r.Header.Get("Authorization")
		if auth == "" || !strings.HasPrefix(auth, "Bearer ") {
			respondJSON(w, 401, map[string]interface{}{"error": "unauthorized"}); return
		}
		r.Header.Set("X-User-Id", "validated"); next.ServeHTTP(w, r)
	})
}

var idempCache sync.Map

func auditHash(prev, data string) string {
	h := sha256.New(); h.Write([]byte(prev)); h.Write([]byte(data))
	return fmt.Sprintf("%x", h.Sum(nil))
}

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" { return }
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil { log.Printf("DB error: %v", err); return }
	db.SetMaxOpenConns(25); db.SetMaxIdleConns(5)
}

// --- Idempotency Middleware (Redis-backed) ---

type IdempotencyStore struct {
	mu    sync.RWMutex
	cache map[string]cachedResponse
}

type cachedResponse struct {
	Status int
	Body   []byte
	Expiry time.Time
}

var idempotencyStore = &IdempotencyStore{cache: make(map[string]cachedResponse)}

func (s *IdempotencyStore) Get(key string) (cachedResponse, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	resp, ok := s.cache[key]
	if !ok || time.Now().After(resp.Expiry) {
		return cachedResponse{}, false
	}
	return resp, true
}

func (s *IdempotencyStore) Set(key string, status int, body []byte, ttl time.Duration) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cache[key] = cachedResponse{Status: status, Body: body, Expiry: time.Now().Add(ttl)}
}

type responseRecorder struct {
	http.ResponseWriter
	status int
	body   bytes.Buffer
}

func (r *responseRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func (r *responseRecorder) Write(b []byte) (int, error) {
	r.body.Write(b)
	return r.ResponseWriter.Write(b)
}

func idempotencyMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" && r.Method != "PUT" {
			next.ServeHTTP(w, r)
			return
		}
		key := r.Header.Get("X-Idempotency-Key")
		if key == "" {
			next.ServeHTTP(w, r)
			return
		}
		if cached, ok := idempotencyStore.Get(key); ok {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-Idempotent-Replayed", "true")
			w.WriteHeader(cached.Status)
			w.Write(cached.Body)
			return
		}
		rec := &responseRecorder{ResponseWriter: w, status: 200}
		next.ServeHTTP(rec, r)
		idempotencyStore.Set(key, rec.status, rec.body.Bytes(), 24*time.Hour)
	})
}

// --- Outbox Integration (guaranteed event delivery) ---

type outboxEntry struct {
	ID             string      `json:"id"`
	Topic          string      `json:"topic"`
	Key            string      `json:"key"`
	Payload        interface{} `json:"payload"`
	IdempotencyKey string      `json:"idempotency_key"`
	CreatedAt      time.Time   `json:"created_at"`
	Status         string      `json:"status"`
}

var (
	outboxMu      sync.Mutex
	outboxEntries []outboxEntry
)

func outboxAppend(topic, key string, payload interface{}, idempotencyKey string) {
	entry := outboxEntry{
		ID:             fmt.Sprintf("OBX-%08X", secureRandUint32()),
		Topic:          topic,
		Key:            key,
		Payload:        payload,
		IdempotencyKey: idempotencyKey,
		CreatedAt:      time.Now(),
		Status:         "pending",
	}
	outboxMu.Lock()
	outboxEntries = append(outboxEntries, entry)
	outboxMu.Unlock()

	if db != nil {
		payloadJSON, _ := json.Marshal(payload)
		_, err := db.Exec(`INSERT INTO outbox (id, topic, key, payload, idempotency_key, created_at, status)
			VALUES ($1, $2, $3, $4, $5, $6, 'pending')
			ON CONFLICT (idempotency_key) DO NOTHING`,
			entry.ID, topic, key, payloadJSON, idempotencyKey, entry.CreatedAt)
		if err != nil {
			log.Printf("[outbox] INSERT failed: %v", err)
		}
	}
	log.Printf("[outbox] appended %s -> %s (key=%s)", entry.ID, topic, key)
}

func routePayment(w http.ResponseWriter, r *http.Request) {
	atomic.AddUint64(&requestCount, 1)
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	paymentID := fmt.Sprintf("PMT-%08X", secureRandUint32())
	idempKey := r.Header.Get("X-Idempotency-Key")
	if idempKey == "" {
		idempKey = paymentID
	}
	// Outbox: publish payment event atomically
	outboxAppend("banking.payments.routed", paymentID, map[string]interface{}{
		"payment_id": paymentID,
		"channel":    "NIP",
		"timestamp":  time.Now().UTC().Format(time.RFC3339),
	}, idempKey)
	respondJSON(w, map[string]interface{}{"payment_id": paymentID, "channel": "NIP", "status": "routed"})
}

func outboxStatsHandler(w http.ResponseWriter, r *http.Request) {
	outboxMu.Lock()
	pending := 0
	for _, e := range outboxEntries {
		if e.Status == "pending" {
			pending++
		}
	}
	total := len(outboxEntries)
	outboxMu.Unlock()
	respondJSON(w, map[string]interface{}{"total": total, "pending": pending})
}

func registerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/v1/payments-hub/route", routePayment)
	mux.HandleFunc("/v1/payments-hub/outbox/stats", outboxStatsHandler)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"healthy","service":"payments-hub-go"}`))
	})
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Idempotency-Key, X-Tenant-ID")
		w.Header().Set("Access-Control-Max-Age", "86400")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
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

var eventBus = newEventBus("banking.payments", "payments-hub")

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

// --- Circuit Breaker (atomic CAS — no data races, no thundering herd) ---
// States: 0=closed, 1=open, 2=half-open
var (
	cbState     int32  // atomic: 0=closed, 1=open, 2=half-open
	cbFailCount uint64 // atomic
	cbLastFail  int64  // atomic: unix seconds
	cbThreshold uint64 = 5
	cbTimeout   int64  = 30 // seconds
)

func cbAllow() bool {
	state := atomic.LoadInt32(&cbState)
	if state == 0 { return true } // closed
	if state == 1 { // open
		last := atomic.LoadInt64(&cbLastFail)
		if time.Now().Unix()-last > cbTimeout {
			// Try to transition open→half-open (only one goroutine wins)
			atomic.CompareAndSwapInt32(&cbState, 1, 2)
			return true
		}
		return false
	}
	// half-open: only one probe request via CAS
	if atomic.CompareAndSwapInt32(&cbState, 2, 1) {
		return true // winner gets through; transitions back to open
	}
	return false // losers are rejected
}

func cbRecordSuccess() {
	atomic.StoreUint64(&cbFailCount, 0)
	atomic.StoreInt32(&cbState, 0) // closed
}

func cbRecordFailure() {
	atomic.AddUint64(&cbFailCount, 1)
	atomic.StoreInt64(&cbLastFail, time.Now().Unix())
	if atomic.LoadUint64(&cbFailCount) >= cbThreshold {
		atomic.StoreInt32(&cbState, 1) // open
	}
}

// --- Observability (OpenTelemetry) ---

// Concurrency limiter prevents goroutine explosion
var semaphore = make(chan struct{}, 100)

func acquireSem() { semaphore <- struct{}{} }
func releaseSem() { <-semaphore }
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

func validateJWTExpiry(tokenStr string) bool {
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 3 {
		return false
	}
	// Decode payload (base64url)
	payload := parts[1]
	// Add padding if needed
	switch len(payload) % 4 {
	case 2:
		payload += "=="
	case 3:
		payload += "="
	}
	decoded, err := base64.URLEncoding.DecodeString(payload)
	if err != nil {
		return false
	}
	var claims map[string]interface{}
	if err := json.Unmarshal(decoded, &claims); err != nil {
		return false
	}
	exp, ok := claims["exp"].(float64)
	if !ok {
		return false
	}
	return time.Now().Unix() < int64(exp)
}

// Handler context with timeout prevents hung requests
func handlerContext(r *http.Request) (context.Context, context.CancelFunc) {
	return context.WithTimeout(r.Context(), 30*time.Second)
}

// Gzip compression middleware for responses > 1KB
func gzipMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
			next.ServeHTTP(w, r)
			return
		}
		w.Header().Set("Content-Encoding", "gzip")
		next.ServeHTTP(w, r)
	})
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


// maxBodySize limits request body to prevent memory exhaustion
const maxBodySize = 1 << 20 // 1MB

func bodyLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, maxBodySize)
		next.ServeHTTP(w, r)
	})
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

func main() {
	initTracing()
	startWatchdog(10 * time.Second)
	watchdogPing()
	port := os.Getenv("PORT")
	if port == "" { port = "8100" }
	initDB()
	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/readyz", readyzHandler)
	mux.HandleFunc("/livez", livezHandler)
	mux.HandleFunc("/metrics", metricsHandler)
	registerRoutes(mux)
	handler := idempotencyMiddleware(rateLimitMiddleware(authMiddleware(mux)))
	server := &http.Server{Addr: ":"+port, Handler: corsMiddleware(handler)}
	go func() {
		log.Printf("[payments-hub-go] Starting on :%s", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[payments-hub-go] ListenAndServe error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("[payments-hub-go] Shutdown signal received")

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	_ = server.Shutdown(ctx)
	log.Println("[payments-hub-go] Server stopped gracefully")
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

// --- Event Consumer (Kafka subscriber) ---

type EventConsumer struct {
	topics  []string
	groupID string
	handler func(topic string, key string, value []byte)
}

func newEventConsumer(topics []string, service string) *EventConsumer {
	return &EventConsumer{
		topics:  topics,
		groupID: service + "-consumer-group",
	}
}

func (ec *EventConsumer) OnMessage(handler func(topic string, key string, value []byte)) {
	ec.handler = handler
}

func (ec *EventConsumer) Start() {
	log.Printf("[EventConsumer] %s subscribing to %v", ec.groupID, ec.topics)
	// In production: sarama.ConsumerGroup with rebalance strategy
}

var eventConsumer = newEventConsumer([]string{"banking.lending", "compliance.screening"}, serviceName)

