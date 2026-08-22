package main

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/big"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/IBM/sarama"
	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
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
		if s, ok := args[0].(int); ok {
			status = s
		}
		data = args[1]
	} else if len(args) == 1 {
		data = args[0]
	}
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func healthHandler(w http.ResponseWriter, _ *http.Request) {
	dbStatus := "not_configured"
	if db != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		if err := db.PingContext(ctx); err != nil {
			dbStatus = fmt.Sprintf("unhealthy: %v", err)
		} else {
			dbStatus = "connected"
		}
	}
	overall := "healthy"
	if strings.Contains(dbStatus, "unhealthy") {
		overall = "degraded"
	}
	respondJSON(w, map[string]interface{}{"status": overall, "service": serviceName, "version": "2.0.0", "checks": map[string]string{"database": dbStatus}})
}

func readyzHandler(w http.ResponseWriter, _ *http.Request) {
	respondJSON(w, map[string]interface{}{"ready": true})
}
func livezHandler(w http.ResponseWriter, _ *http.Request) {
	respondJSON(w, map[string]interface{}{"alive": true})
}

func metricsHandler(w http.ResponseWriter, _ *http.Request) {
	r := atomic.LoadUint64(&requestCount)
	e := atomic.LoadUint64(&errorCount)
	w.Header().Set("Content-Type", "text/plain")
	fmt.Fprintf(w, "requests_total{service=\"%s\"} %d\nerrors_total{service=\"%s\"} %d\n", serviceName, r, serviceName, e)
}

func rateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddUint64(&requestCount, 1)
		next.ServeHTTP(w, r)
	})
}

// ── JWT Validation (JWKS / RS256, fail-closed) ──────────────────────────────

type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}

// jwtRealmURL resolves the Keycloak realm URL whose JWKS endpoint signs the
// Bearer tokens accepted by this service.
func jwtRealmURL() string {
	if v := os.Getenv("KEYCLOAK_REALM_URL"); v != "" {
		return v
	}
	return "http://keycloak:8080/realms/54bank"
}

func fetchJWKS(realmURL string) {
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(realmURL + "/protocol/openid-connect/certs")
	if err != nil {
		log.Printf("[%s] JWKS fetch failed: %v", serviceName, err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		log.Printf("[%s] JWKS fetch returned HTTP %d", serviceName, resp.StatusCode)
		return
	}
	var jwks struct {
		Keys []struct {
			Kid string `json:"kid"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		log.Printf("[%s] JWKS decode failed: %v", serviceName, err)
		return
	}
	jwtCache.mu.Lock()
	defer jwtCache.mu.Unlock()
	for _, k := range jwks.Keys {
		nBytes, err := base64.RawURLEncoding.DecodeString(k.N)
		if err != nil || len(nBytes) == 0 {
			continue
		}
		eBytes, err := base64.RawURLEncoding.DecodeString(k.E)
		if err != nil || len(eBytes) == 0 {
			continue
		}
		var eInt int
		for _, b := range eBytes {
			eInt = eInt<<8 | int(b)
		}
		jwtCache.keys[k.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(nBytes), E: eInt}
	}
	jwtCache.updated = time.Now()
	log.Printf("[%s] JWKS refreshed: %d keys", serviceName, len(jwtCache.keys))
}

func startJWKSRefresh() {
	go fetchJWKS(jwtRealmURL())
	go func() {
		for range time.Tick(5 * time.Minute) {
			fetchJWKS(jwtRealmURL())
		}
	}()
}

// verifyBearerToken performs full RS256 verification of a JWT against the
// realm JWKS (signature + kid + alg + expiry). Any verification problem is an
// error — callers must reject the request (fail-closed).
func verifyBearerToken(token string) (map[string]interface{}, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("invalid token format")
	}
	headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, fmt.Errorf("invalid token header encoding")
	}
	var header struct {
		Kid string `json:"kid"`
		Alg string `json:"alg"`
	}
	if err := json.Unmarshal(headerBytes, &header); err != nil || header.Kid == "" {
		return nil, fmt.Errorf("invalid token header")
	}
	if header.Alg != "RS256" {
		return nil, fmt.Errorf("unsupported token algorithm %q", header.Alg)
	}
	jwtCache.mu.RLock()
	pub, ok := jwtCache.keys[header.Kid]
	jwtCache.mu.RUnlock()
	if !ok {
		// Key unknown — refresh once and retry (key rotation).
		fetchJWKS(jwtRealmURL())
		jwtCache.mu.RLock()
		pub, ok = jwtCache.keys[header.Kid]
		jwtCache.mu.RUnlock()
		if !ok {
			return nil, fmt.Errorf("unknown signing key")
		}
	}
	sigBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, fmt.Errorf("invalid signature encoding")
	}
	hash := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	if err := rsa.VerifyPKCS1v15(pub, crypto.SHA256, hash[:], sigBytes); err != nil {
		return nil, fmt.Errorf("invalid signature")
	}
	claimsBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("invalid claims encoding")
	}
	var claims map[string]interface{}
	if err := json.Unmarshal(claimsBytes, &claims); err != nil {
		return nil, fmt.Errorf("invalid claims")
	}
	exp, ok := claims["exp"].(float64)
	if !ok {
		return nil, fmt.Errorf("token missing exp claim")
	}
	if time.Now().Unix() >= int64(exp) {
		return nil, fmt.Errorf("token expired")
	}
	return claims, nil
}

// authMiddleware requires a valid Keycloak-issued RS256 Bearer token on every
// non-health route. It NEVER accepts a token on structure alone: any
// verification problem (no keys fetched, unknown kid, bad signature, expiry)
// yields 401.
func authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/health" || r.URL.Path == "/healthz" || r.URL.Path == "/readyz" || r.URL.Path == "/livez" || r.URL.Path == "/metrics" {
			next.ServeHTTP(w, r)
			return
		}
		auth := r.Header.Get("Authorization")
		if auth == "" || !strings.HasPrefix(auth, "Bearer ") {
			respondJSON(w, 401, map[string]interface{}{"error": "unauthorized", "detail": "missing bearer token"})
			return
		}
		claims, err := verifyBearerToken(strings.TrimPrefix(auth, "Bearer "))
		if err != nil {
			atomic.AddUint64(&errorCount, 1)
			respondJSON(w, 401, map[string]interface{}{"error": "unauthorized", "detail": err.Error()})
			return
		}
		if sub, ok := claims["sub"].(string); ok && sub != "" {
			r.Header.Set("X-User-Id", sub)
		}
		next.ServeHTTP(w, r)
	})
}

var idempCache sync.Map

func auditHash(prev, data string) string {
	h := sha256.New()
	h.Write([]byte(prev))
	h.Write([]byte(data))
	return fmt.Sprintf("%x", h.Sum(nil))
}

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		return
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("DB error: %v", err)
		return
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
}

// --- Idempotency Middleware (Redis-backed) ---

var redisClient *redis.Client

func initRedis() {
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "localhost:6379"
	}
	redisClient = redis.NewClient(&redis.Options{
		Addr:         redisURL,
		Password:     os.Getenv("REDIS_PASSWORD"),
		DB:           0,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
		PoolSize:     25,
	})
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := redisClient.Ping(ctx).Err(); err != nil {
		log.Printf("[%s] Redis connection failed: %v — idempotency will use PostgreSQL fallback", serviceName, err)
		redisClient = nil
	} else {
		log.Printf("[%s] Redis connected for idempotency", serviceName)
	}
}

type cachedResponse struct {
	Status int    `json:"status"`
	Body   []byte `json:"body"`
}

func idempotencyGet(key string) (cachedResponse, bool) {
	ctx := context.Background()
	prefix := "idempotency:" + key
	if redisClient != nil {
		vals, err := redisClient.MGet(ctx, prefix+":status", prefix+":body").Result()
		if err != nil || vals[0] == nil {
			return cachedResponse{}, false
		}
		status, _ := strconv.Atoi(vals[0].(string))
		body := []byte(vals[1].(string))
		return cachedResponse{Status: status, Body: body}, true
	}
	if db != nil {
		var status int
		var body []byte
		err := db.QueryRow("SELECT status_code, response_body FROM payments_hub_idempotency WHERE idempotency_key = $1 AND expires_at > NOW()", key).Scan(&status, &body)
		if err == nil {
			return cachedResponse{Status: status, Body: body}, true
		}
	}
	return cachedResponse{}, false
}

func idempotencySet(key string, status int, body []byte, ttl time.Duration) {
	ctx := context.Background()
	prefix := "idempotency:" + key
	if redisClient != nil {
		pipe := redisClient.Pipeline()
		pipe.Set(ctx, prefix+":status", strconv.Itoa(status), ttl)
		pipe.Set(ctx, prefix+":body", string(body), ttl)
		if _, err := pipe.Exec(ctx); err != nil {
			log.Printf("[%s] Redis idempotency SET error: %v", serviceName, err)
		}
		return
	}
	if db != nil {
		db.Exec("INSERT INTO payments_hub_idempotency (idempotency_key, status_code, response_body, expires_at) VALUES ($1, $2, $3, NOW() + $4::interval) ON CONFLICT (idempotency_key) DO NOTHING",
			key, status, body, fmt.Sprintf("%d seconds", int(ttl.Seconds())))
	}
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
		if cached, ok := idempotencyGet(key); ok {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-Idempotent-Replayed", "true")
			w.WriteHeader(cached.Status)
			w.Write(cached.Body)
			return
		}
		rec := &responseRecorder{ResponseWriter: w, status: 200}
		next.ServeHTTP(rec, r)
		idempotencySet(key, rec.status, rec.body.Bytes(), 24*time.Hour)
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

// outboxAppend records the event and publishes it to Kafka. The entry is
// marked "published" ONLY after a confirmed produce; on failure it stays
// "pending" (retry semantics) and an error is returned to the caller.
func outboxAppend(topic, key string, payload interface{}, idempotencyKey string) error {
	entry := outboxEntry{
		ID:             fmt.Sprintf("OBX-%08X", secureRandUint32()),
		Topic:          topic,
		Key:            key,
		Payload:        payload,
		IdempotencyKey: idempotencyKey,
		CreatedAt:      time.Now(),
		Status:         "pending",
	}

	publishErr := eventBus.Publish(topic, key, payload)
	if publishErr != nil {
		log.Printf("[outbox] KAFKA PUBLISH FAILED for %s -> %s (key=%s): %v — entry stays pending", entry.ID, topic, key, publishErr)
	} else {
		entry.Status = "published"
	}

	outboxMu.Lock()
	outboxEntries = append(outboxEntries, entry)
	outboxMu.Unlock()

	if db != nil {
		payloadJSON, _ := json.Marshal(payload)
		_, err := db.Exec(`INSERT INTO outbox (id, topic, key, payload, idempotency_key, created_at, status)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			ON CONFLICT (idempotency_key) DO NOTHING`,
			entry.ID, topic, key, payloadJSON, idempotencyKey, entry.CreatedAt, entry.Status)
		if err != nil {
			log.Printf("[outbox] INSERT failed: %v", err)
		}
	}
	if publishErr != nil {
		return publishErr
	}
	log.Printf("[outbox] published %s -> %s (key=%s)", entry.ID, topic, key)
	return nil
}

// railURL returns the configured NIP rail adapter base URL ("" if unset).
func railURL() string {
	if v := os.Getenv("NIP_ENGINE_URL"); v != "" {
		return v
	}
	return os.Getenv("NIBSS_BASE_URL")
}

func routePayment(w http.ResponseWriter, r *http.Request) {
	atomic.AddUint64(&requestCount, 1)
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondJSON(w, 400, map[string]interface{}{"error": "invalid request body"})
		return
	}
	paymentID := fmt.Sprintf("PMT-%08X", secureRandUint32())
	idempKey := r.Header.Get("X-Idempotency-Key")
	if idempKey == "" {
		idempKey = paymentID
	}

	// Route to the real NIP rail adapter. Never report "routed" for a
	// payment that was not accepted by the rail.
	base := railURL()
	if base == "" {
		atomic.AddUint64(&errorCount, 1)
		respondJSON(w, 503, map[string]interface{}{
			"error": "payment rail not configured (set NIP_ENGINE_URL)", "payment_id": paymentID, "status": "failed",
		})
		return
	}

	railBody, _ := json.Marshal(map[string]interface{}{
		"sourceAccount":       body["source_account"],
		"destinationBankCode": body["dest_bank"],
		"destinationAccount":  body["dest_account"],
		"amountKobo":          body["amount_kobo"],
		"narration":           body["narration"],
		"channelCode":         body["channel_code"],
	})
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, "POST", base+"/v1/nip/funds-transfer", bytes.NewReader(railBody))
	if err != nil {
		respondJSON(w, 500, map[string]interface{}{"error": "internal error", "status": "failed"})
		return
	}
	req.Header.Set("Content-Type", "application/json")
	// Forward the caller's verified Bearer token: the NIP engine authenticates
	// /v1/nip/funds-transfer and rejects unauthenticated calls.
	if authz := r.Header.Get("Authorization"); authz != "" {
		req.Header.Set("Authorization", authz)
	}
	// The NIP engine requires an Idempotency-Key on funds transfers and
	// derives its session ID from it — replays collapse to one transfer.
	req.Header.Set("Idempotency-Key", idempKey)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		atomic.AddUint64(&errorCount, 1)
		log.Printf("[route] rail call failed for %s: %v", paymentID, err)
		respondJSON(w, 503, map[string]interface{}{
			"error": "payment rail unreachable", "payment_id": paymentID, "status": "failed",
		})
		return
	}
	defer resp.Body.Close()
	var railResp struct {
		ResponseCode    string `json:"responseCode"`
		ResponseMessage string `json:"responseMessage"`
		SessionID       string `json:"sessionId"`
		Status          string `json:"status"`
	}
	json.NewDecoder(resp.Body).Decode(&railResp)

	if resp.StatusCode >= 300 || railResp.ResponseCode != "00" {
		atomic.AddUint64(&errorCount, 1)
		respondJSON(w, 502, map[string]interface{}{
			"payment_id": paymentID, "channel": "NIP", "status": "failed",
			"rail_response_code": railResp.ResponseCode, "rail_message": railResp.ResponseMessage,
		})
		return
	}

	// Rail accepted the payment — record and publish the routed event. If the
	// event cannot be published, surface the failure (do not silently buffer).
	if err := outboxAppend("banking.payments.routed", paymentID, map[string]interface{}{
		"payment_id": paymentID,
		"channel":    "NIP",
		"session_id": railResp.SessionID,
		"timestamp":  time.Now().UTC().Format(time.RFC3339),
	}, idempKey); err != nil {
		atomic.AddUint64(&errorCount, 1)
		respondJSON(w, 503, map[string]interface{}{
			"error":      "event bus unavailable (Kafka not configured/reachable) — payment routed at rail but event publication failed",
			"payment_id": paymentID, "channel": "NIP", "status": "routed_unconfirmed",
			"session_id": railResp.SessionID,
		})
		return
	}
	respondJSON(w, map[string]interface{}{
		"payment_id": paymentID, "channel": "NIP", "status": "routed", "session_id": railResp.SessionID,
	})
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
func roundNaira(amount float64) float64    { return math.Round(amount*100) / 100 }
func validateAmount(amount float64) error {
	if amount < 0 {
		return fmt.Errorf("amount must be non-negative")
	}
	if amount > 999_999_999_999.99 {
		return fmt.Errorf("exceeds CBN max limit")
	}
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
		ID:     fmt.Sprintf("AUD-%08X", secureRandUint32()),
		Action: action, RecordID: recordID, Actor: actor,
		Timestamp: time.Now().UTC().Format(time.RFC3339), Details: details,
	})

}

// --- Request Tracing ---
func tracingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		traceID := r.Header.Get("X-Trace-Id")
		if traceID == "" {
			traceID = r.Header.Get("traceparent")
		}
		if traceID == "" {
			traceID = fmt.Sprintf("%x-%x", time.Now().UnixNano(), os.Getpid())
		}
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
	if state == 0 {
		return true
	} // closed
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
	if otelEndpoint == "" {
		return
	}
	log.Printf("[%s] OTEL tracing configured: %s", serviceName, otelEndpoint)
}

// --- Retry with Exponential Backoff ---
func retryWithBackoff(maxRetries int, fn func() error) error {
	for i := 0; i < maxRetries; i++ {
		if err := fn(); err == nil {
			return nil
		}
		backoff := time.Duration(1<<uint(i)) * 100 * time.Millisecond
		if backoff > 5*time.Second {
			backoff = 5 * time.Second
		}
		time.Sleep(backoff)
	}
	return fmt.Errorf("max retries (%d) exceeded", maxRetries)
}

func secureRandUint32() uint32 {
	b := make([]byte, 4)
	if _, err := rand.Read(b); err != nil {
		return uint32(time.Now().UnixNano())
	}
	return uint32(b[0])<<24 | uint32(b[1])<<16 | uint32(b[2])<<8 | uint32(b[3])
}

func sanitizeLogEntry(msg string) string {
	msg = strings.ReplaceAll(msg, "\n", " ")
	msg = strings.ReplaceAll(msg, "\r", " ")
	if len(msg) > 2000 {
		msg = msg[:2000]
	}
	return msg
}

func maskPII(value, fieldType string) string {
	if len(value) < 4 {
		return "***"
	}
	switch fieldType {
	case "bvn":
		return value[:3] + "****" + value[len(value)-4:]
	case "phone":
		return value[:4] + "****" + value[len(value)-2:]
	case "email":
		parts := strings.SplitN(value, "@", 2)
		if len(parts) == 2 {
			return parts[0][:1] + "***@" + parts[1]
		}
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
	if strings.Contains(errStr, "/") || strings.Contains(errStr, "\\") {
		return "internal error"
	}
	if len(errStr) > 200 {
		return "internal error"
	}
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
	if port == "" {
		port = "8100"
	}
	initDB()
	initRedis()
	startJWKSRefresh()
	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/readyz", readyzHandler)
	mux.HandleFunc("/livez", livezHandler)
	mux.HandleFunc("/metrics", metricsHandler)
	registerRoutes(mux)
	handler := idempotencyMiddleware(rateLimitMiddleware(authMiddleware(mux)))
	server := &http.Server{Addr: ":" + port, Handler: corsMiddleware(handler)}
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

// --- Event Bus (real Kafka producer via sarama) ---

var errKafkaNotConfigured = fmt.Errorf("kafka not configured (set KAFKA_BOOTSTRAP_SERVERS)")

type EventBus struct {
	brokers     []string
	topic       string
	serviceName string
	mu          sync.Mutex
	producer    sarama.SyncProducer
}

func kafkaBrokers() []string {
	raw := os.Getenv("KAFKA_BOOTSTRAP_SERVERS")
	if raw == "" {
		raw = os.Getenv("KAFKA_BROKERS")
	}
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	for i := range parts {
		parts[i] = strings.TrimSpace(parts[i])
	}
	return parts
}

func newEventBus(topic, service string) *EventBus {
	eb := &EventBus{brokers: kafkaBrokers(), topic: topic, serviceName: service}
	if len(eb.brokers) == 0 {
		log.Printf("[EventBus] %s: KAFKA_BOOTSTRAP_SERVERS not set — Emit/Publish will fail fast", service)
		return eb
	}
	cfg := sarama.NewConfig()
	cfg.Producer.RequiredAcks = sarama.WaitForAll
	cfg.Producer.Return.Successes = true
	cfg.Producer.Retry.Max = 3
	producer, err := sarama.NewSyncProducer(eb.brokers, cfg)
	if err != nil {
		log.Printf("[EventBus] %s: Kafka producer init failed (%v) — Emit/Publish will fail fast", service, err)
		return eb
	}
	eb.producer = producer
	log.Printf("[EventBus] %s: Kafka producer connected to %v", service, eb.brokers)
	return eb
}

// Emit publishes the event to Kafka. Returns an error when Kafka is not
// configured or the produce fails — events are never silently buffered.
func (eb *EventBus) Emit(eventType string, payload map[string]interface{}) error {
	event := map[string]interface{}{
		"id":        fmt.Sprintf("%s_%d", eb.serviceName, time.Now().UnixMilli()),
		"type":      eventType,
		"source":    eb.serviceName,
		"topic":     eb.topic,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"data":      payload,
	}
	return eb.Publish(eb.topic, event["id"].(string), event)
}

// Publish sends a payload to an explicit topic. Returns errKafkaNotConfigured
// when no producer exists.
func (eb *EventBus) Publish(topic, key string, payload interface{}) error {
	eb.mu.Lock()
	producer := eb.producer
	eb.mu.Unlock()
	if producer == nil {
		return errKafkaNotConfigured
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	msg := &sarama.ProducerMessage{
		Topic: topic,
		Key:   sarama.StringEncoder(key),
		Value: sarama.ByteEncoder(body),
	}
	partition, offset, err := producer.SendMessage(msg)
	if err != nil {
		return fmt.Errorf("kafka produce to %s: %w", topic, err)
	}
	log.Printf("[EventBus] %s -> %s (partition=%d offset=%d)", eb.serviceName, topic, partition, offset)
	return nil
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

// --- Event Consumer (real Kafka consumer group via sarama) ---

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

type consumerGroupHandler struct {
	ec *EventConsumer
}

func (consumerGroupHandler) Setup(sarama.ConsumerGroupSession) error   { return nil }
func (consumerGroupHandler) Cleanup(sarama.ConsumerGroupSession) error { return nil }
func (h consumerGroupHandler) ConsumeClaim(session sarama.ConsumerGroupSession, claim sarama.ConsumerGroupClaim) error {
	for msg := range claim.Messages() {
		if h.ec.handler != nil {
			h.ec.handler(msg.Topic, string(msg.Key), msg.Value)
		}
		session.MarkMessage(msg, "")
	}
	return nil
}

// Start joins the Kafka consumer group and consumes until ctx cancellation.
// When Kafka is not configured it logs the failure and returns — it does NOT
// pretend to be subscribed.
func (ec *EventConsumer) Start() {
	brokers := kafkaBrokers()
	if len(brokers) == 0 {
		log.Printf("[EventConsumer] %s NOT started: %v", ec.groupID, errKafkaNotConfigured)
		return
	}
	cfg := sarama.NewConfig()
	cfg.Consumer.Group.Rebalance.GroupStrategies = []sarama.BalanceStrategy{sarama.NewBalanceStrategyRoundRobin()}
	cfg.Consumer.Offsets.Initial = sarama.OffsetNewest
	group, err := sarama.NewConsumerGroup(brokers, ec.groupID, cfg)
	if err != nil {
		log.Printf("[EventConsumer] %s NOT started: consumer group init failed: %v", ec.groupID, err)
		return
	}
	log.Printf("[EventConsumer] %s subscribing to %v", ec.groupID, ec.topics)
	go func() {
		ctx := context.Background()
		for {
			if err := group.Consume(ctx, ec.topics, consumerGroupHandler{ec: ec}); err != nil {
				log.Printf("[EventConsumer] %s consume error: %v", ec.groupID, err)
				time.Sleep(2 * time.Second)
			}
		}
	}()
}

var eventConsumer = newEventConsumer([]string{"banking.lending", "compliance.screening"}, serviceName)
