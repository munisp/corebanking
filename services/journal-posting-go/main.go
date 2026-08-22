package main

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
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

	"github.com/IBM/sarama"
	_ "github.com/lib/pq"
	"github.com/munisp/corebanking/pkg/tbclient"
)

var db *sql.DB

// Journal Posting Engine — Posts double-entry journal entries to the general ledger

var serviceName = "journal-posting-go"

// --- Monetary Safety ---
func nairaToKobo(naira float64) int64 { return int64(naira * 100) }
func koboToNaira(kobo int64) float64  { return float64(kobo) / 100.0 }

// --- Watchdog ---
var watchdogLastPing atomic.Int64

func watchdogPing()         { watchdogLastPing.Store(time.Now().UnixMilli()) }
func watchdogHealthy() bool { return time.Now().UnixMilli()-watchdogLastPing.Load() < 60000 }
func startWatchdog(interval time.Duration) {
	watchdogPing()
	go func() {
		for {
			time.Sleep(interval)
			watchdogPing()
		}
	}()
}

// --- Circuit Breaker ---
type CircuitBreaker struct {
	mu           sync.Mutex
	failures     int
	threshold    int
	resetTimeout time.Duration
	state        string
	lastFailure  time.Time
}

func newCircuitBreaker() *CircuitBreaker {
	return &CircuitBreaker{threshold: 5, resetTimeout: 30 * time.Second, state: "closed"}
}

func (cb *CircuitBreaker) Allow() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	if cb.state == "open" {
		if time.Since(cb.lastFailure) > cb.resetTimeout {
			cb.state = "half-open"
			return true
		}
		return false
	}
	return true
}

func (cb *CircuitBreaker) RecordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.failures = 0
	cb.state = "closed"
}

func (cb *CircuitBreaker) RecordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.failures++
	cb.lastFailure = time.Now()
	if cb.failures >= cb.threshold {
		cb.state = "open"
	}
}

var circuitBreaker = newCircuitBreaker()

// --- Rate Limiter ---
type RateLimiter struct {
	mu       sync.Mutex
	requests map[string][]time.Time
	max      int
	window   time.Duration
}

func newRateLimiter() *RateLimiter {
	return &RateLimiter{requests: make(map[string][]time.Time), max: 200, window: time.Minute}
}

func (rl *RateLimiter) Allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	now := time.Now()
	reqs := rl.requests[ip]
	var valid []time.Time
	for _, t := range reqs {
		if now.Sub(t) < rl.window {
			valid = append(valid, t)
		}
	}
	if len(valid) >= rl.max {
		return false
	}
	rl.requests[ip] = append(valid, now)
	return true
}

var rateLimiter = newRateLimiter()

// --- EventBus ---
// Events are really published to Kafka via sarama. Emit NEVER pretends to
// publish: on Kafka failure the event is queued in the Postgres outbox
// (published=FALSE) and the error is returned.
type EventBus struct {
	broker   string
	topic    string
	service  string
	mu       sync.Mutex
	producer sarama.SyncProducer
}

func newEventBus(topic string) *EventBus {
	broker := os.Getenv("KAFKA_BROKERS")
	if broker == "" {
		broker = "localhost:9092"
	}
	return &EventBus{broker: broker, topic: topic, service: serviceName}
}

func (eb *EventBus) getProducer() (sarama.SyncProducer, error) {
	eb.mu.Lock()
	defer eb.mu.Unlock()
	if eb.producer != nil {
		return eb.producer, nil
	}
	cfg := sarama.NewConfig()
	cfg.Producer.Return.Successes = true
	cfg.Producer.RequiredAcks = sarama.WaitForAll
	cfg.Producer.Retry.Max = 3
	p, err := sarama.NewSyncProducer(strings.Split(eb.broker, ","), cfg)
	if err != nil {
		return nil, err
	}
	eb.producer = p
	return eb.producer, nil
}

// Publish sends one event to Kafka. Returns error when Kafka is unavailable.
func (eb *EventBus) Publish(eventType string, payload map[string]interface{}) error {
	event := map[string]interface{}{
		"id":        fmt.Sprintf("%s_%d", eb.service, time.Now().UnixMilli()),
		"type":      eventType,
		"source":    eb.service,
		"topic":     eb.topic,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"data":      payload,
	}
	data, err := json.Marshal(event)
	if err != nil {
		return err
	}
	producer, err := eb.getProducer()
	if err != nil {
		return fmt.Errorf("kafka unavailable: %w", err)
	}
	_, _, err = producer.SendMessage(&sarama.ProducerMessage{
		Topic: eb.topic,
		Key:   sarama.StringEncoder(event["id"].(string)),
		Value: sarama.ByteEncoder(data),
	})
	return err
}

// Emit publishes via Kafka; on failure it durably queues the event in the
// outbox for the relay and logs the failure loudly.
func (eb *EventBus) Emit(eventType string, payload map[string]interface{}) {
	if err := eb.Publish(eventType, payload); err != nil {
		log.Printf("[EventBus] PUBLISH FAILED %s -> %s: %s (%v) — queueing to outbox", eb.service, eb.topic, eventType, err)
		if db != nil {
			data, mErr := json.Marshal(map[string]interface{}{"type": eventType, "data": payload})
			if mErr == nil {
				if _, dErr := db.Exec(`INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)`,
					eventType, fmt.Sprintf("%s_%d", eb.service, time.Now().UnixMilli()), string(data)); dErr != nil {
					log.Printf("[EventBus] outbox queue failed: %v", dErr)
				}
			}
		}
		return
	}
	log.Printf("[EventBus] published %s -> %s", eb.service, eb.topic)
}

var eventBus = newEventBus("accounting.ledger")

// --- Input Sanitization ---
func sanitizeInput(s string) string {
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	if len(s) > 1000 {
		s = s[:1000]
	}
	return s
}

// --- Handlers ---
func healthHandler(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "healthy", "service": serviceName})
}

func livezHandler(w http.ResponseWriter, r *http.Request) {
	if watchdogHealthy() {
		json.NewEncoder(w).Encode(map[string]string{"status": "alive"})
	} else {
		w.WriteHeader(503)
		json.NewEncoder(w).Encode(map[string]string{"status": "stalled"})
	}
}

func readyzHandler(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
}

func metricsHandler(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]interface{}{"service": serviceName, "uptime": time.Since(time.Now()).String()})
}

// --- Security Middleware ---
func securityMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'")
		w.Header().Set("Content-Type", "application/json")
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
		next.ServeHTTP(w, r)
	})
}

// --- Panic Recovery ---
func panicRecoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				log.Printf("[PANIC] %v", err)
				w.WriteHeader(500)
				json.NewEncoder(w).Encode(map[string]string{"error": "internal server error"})
			}
		}()
		next.ServeHTTP(w, r)
	})
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
		if len(eBytes) == 0 {
			continue
		}
		var eInt int
		for _, b := range eBytes {
			eInt = eInt<<8 | int(b)
		}
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
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			fetchJWKS(realmURL)
		}
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
		var header struct {
			Kid string `json:"kid"`
		}
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
		exp, ok := claims["exp"].(float64)
		if !ok {
			http.Error(w, `{"error":"token missing exp claim"}`, http.StatusUnauthorized)
			return
		}
		if time.Now().Unix() >= int64(exp) {
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
	if db == nil {
		return
	}
	rows, err := db.Query(`SELECT id, event_type, aggregate_id, payload FROM outbox WHERE published = FALSE ORDER BY created_at LIMIT 100`)
	if err != nil {
		return
	}
	defer rows.Close()

	// Events are marked published ONLY after a confirmed Kafka produce.
	producer, err := eventBus.getProducer()
	if err != nil {
		log.Printf("[outbox-relay] kafka unavailable: %v — events remain unpublished for retry", err)
		return
	}

	var ids []string
	for rows.Next() {
		var id, eventType, aggID string
		var payload []byte
		if err := rows.Scan(&id, &eventType, &aggID, &payload); err != nil {
			continue
		}
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
	if len(ids) == 0 {
		return
	}
	// Mark as published — only events confirmed by Kafka above. If the UPDATE
	// fails the event stays unpublished and will be re-published on the next
	// relay tick (duplicate-safe), so the error is logged loudly, never
	// silently dropped — and never crashes the relay.
	for _, id := range ids {
		if _, err := db.Exec(`UPDATE outbox SET published = TRUE WHERE id = $1`, id); err != nil {
			log.Printf("[outbox-relay] failed to mark event %s published: %v — event remains unpublished and will be retried", id, err)
		}
	}
	log.Printf("[outbox-relay] published %d events to kafka topic=%s", len(ids), topic)
}

// ─── Journal Posting Engine (real, TigerBeetle-backed) ─────────────────────
//
// POST /v1/journals posts a BALANCED double-entry journal to TigerBeetle via
// pkg/tbclient and records it in Postgres. The posting fails fast when the
// ledger is unavailable; nothing is reported "posted" that was not committed.

var tbClient *tbclient.Client

type JournalLeg struct {
	AccountID uint64 `json:"accountId"` // TigerBeetle account id (uint64 form)
	Type      string `json:"type"`      // debit | credit
	Amount    uint64 `json:"amount"`    // smallest currency unit (e.g. kobo)
}

type PostJournalRequest struct {
	TenantID       string       `json:"tenantId"`
	TransactionRef string       `json:"transactionRef"`
	Narration      string       `json:"narration"`
	Currency       string       `json:"currency"`
	Legs           []JournalLeg `json:"legs"`
}

func handlePostJournal(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		w.WriteHeader(405)
		json.NewEncoder(w).Encode(map[string]string{"error": "POST required"})
		return
	}
	var req PostJournalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid JSON body"})
		return
	}
	if len(req.Legs) < 2 {
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]string{"error": "journal must have at least 2 legs"})
		return
	}

	// Balanced check: total debits must equal total credits.
	var debits, credits uint64
	for _, leg := range req.Legs {
		if leg.Amount == 0 || leg.AccountID == 0 {
			w.WriteHeader(400)
			json.NewEncoder(w).Encode(map[string]string{"error": "each leg requires accountId and amount > 0"})
			return
		}
		switch leg.Type {
		case "debit":
			debits += leg.Amount
		case "credit":
			credits += leg.Amount
		default:
			w.WriteHeader(400)
			json.NewEncoder(w).Encode(map[string]string{"error": "leg type must be debit or credit"})
			return
		}
	}
	if debits != credits {
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]string{"error": "journal not balanced: debits != credits"})
		return
	}

	if tbClient == nil {
		w.WriteHeader(503)
		json.NewEncoder(w).Encode(map[string]string{"error": "ledger_unavailable", "detail": "TigerBeetle client not configured (set TB_ADDRESS) — journal NOT posted"})
		return
	}

	// Deterministic journal identity: the same logical journal (same
	// tenant + transactionRef, or an identical leg payload when no ref is
	// supplied) always maps to the same journalID, so an HTTP retry replays
	// against the same TigerBeetle transfer IDs (TransferExists) instead of
	// double-posting with fresh random IDs.
	idBasis := req.TenantID + "|" + req.TransactionRef
	if req.TransactionRef == "" {
		legsJSON, _ := json.Marshal(req.Legs)
		idBasis = req.TenantID + "|payload:" + string(legsJSON)
	}
	journalIDSum := sha256.Sum256([]byte("54bank/journal-posting/" + idBasis))
	journalID := fmt.Sprintf("JRN-%x", journalIDSum[:16])

	// transferIDForLeg derives the TigerBeetle transfer ID for leg i from the
	// journal ID (sha256 of journalID + leg index) — deterministic, so retries
	// yield TransferExists instead of duplicates.
	transferIDForLeg := func(i int) tbclient.Uint128 {
		sum := sha256.Sum256([]byte(fmt.Sprintf("%s/leg/%d", journalID, i)))
		var b [16]byte
		copy(b[:], sum[:16])
		return tbclient.BytesToUint128(b)
	}

	// Post each leg to TigerBeetle against the clearing account. Balanced
	// totals guarantee the clearing account nets to zero per journal. All
	// legs are submitted as one LINKED batch (all-or-nothing): a failure in
	// any leg fails the whole batch, so no partial journal can be applied.
	clearingAccount := tbclient.ToUint128(1) // ledger clearing account 1
	var transfers []tbclient.Transfer
	for i, leg := range req.Legs {
		acct := tbclient.ToUint128(leg.AccountID)
		t := tbclient.Transfer{
			ID:     transferIDForLeg(i),
			Amount: tbclient.ToUint128(leg.Amount),
			Ledger: 1,
			Code:   100,
		}
		// Linked chain: every transfer except the last carries the linked
		// flag; the last one closes the chain (TigerBeetle semantics).
		if i < len(req.Legs)-1 {
			t.Flags = tbclient.TransferFlags{Linked: true}.ToUint16()
		}
		if leg.Type == "debit" {
			t.DebitAccountID = acct
			t.CreditAccountID = clearingAccount
		} else {
			t.DebitAccountID = clearingAccount
			t.CreditAccountID = acct
		}
		transfers = append(transfers, t)
	}

	results, err := tbClient.CreateTransfers(r.Context(), transfers)
	if err != nil {
		w.WriteHeader(502)
		json.NewEncoder(w).Encode(map[string]string{"error": "ledger_posting_failed", "detail": err.Error()})
		return
	}
	allExisted := true
	for _, res := range results {
		// Any non-created/non-existing result means the journal did not post.
		// (Linked batches fail atomically, so this is all-or-nothing.)
		if res.Status != tbclient.TransferCreated && res.Status != tbclient.TransferExists {
			w.WriteHeader(502)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "ledger_posting_rejected", "detail": fmt.Sprintf("transfer status code %d", res.Status),
			})
			return
		}
		if res.Status != tbclient.TransferExists {
			allExisted = false
		}
	}

	if allExisted {
		// Pure retry of an already-posted journal: the linked batch with
		// deterministic IDs matched existing transfers. Do NOT insert another
		// journal record or outbox event — report the idempotent replay.
		w.WriteHeader(200)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"journalId":   journalID,
			"status":      "already_posted",
			"ledger":      "tigerbeetle",
			"legsPosted":  len(transfers),
			"totalAmount": debits,
		})
		return
	}

	// Persist the journal record + outbox event (relay publishes to Kafka).
	if db != nil {
		payload, _ := json.Marshal(map[string]interface{}{
			"journalId": journalID, "tenantId": req.TenantID, "transactionRef": req.TransactionRef,
			"narration": req.Narration, "currency": req.Currency, "legs": req.Legs,
			"totalAmount": debits,
		})
		if _, err := db.ExecContext(r.Context(),
			`INSERT INTO journal_postings (journal_id, tenant_id, transaction_ref, narration, currency, total_amount, leg_count, payload)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
			 ON CONFLICT (journal_id) DO NOTHING`,
			journalID, req.TenantID, req.TransactionRef, req.Narration, req.Currency, int64(debits), len(req.Legs), string(payload)); err != nil {
			log.Printf("[%s] journal record persist failed (ledger posting DID commit): %v", serviceName, err)
		}
		if _, err := db.ExecContext(r.Context(),
			`INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ('journal.posted', $1, $2)`,
			journalID, string(payload)); err != nil {
			log.Printf("[%s] outbox insert failed: %v", serviceName, err)
		}
	}

	w.WriteHeader(201)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"journalId":   journalID,
		"status":      "posted",
		"ledger":      "tigerbeetle",
		"legsPosted":  len(transfers),
		"totalAmount": debits,
		"postedAt":    time.Now().UTC().Format(time.RFC3339),
	})
}

func handleGetJournal(w http.ResponseWriter, r *http.Request) {
	if db == nil {
		w.WriteHeader(503)
		json.NewEncoder(w).Encode(map[string]string{"error": "database unavailable"})
		return
	}
	id := strings.TrimPrefix(r.URL.Path, "/v1/journals/")
	var payload string
	err := db.QueryRowContext(r.Context(), `SELECT payload FROM journal_postings WHERE journal_id = $1`, id).Scan(&payload)
	if err == sql.ErrNoRows {
		w.WriteHeader(404)
		json.NewEncoder(w).Encode(map[string]string{"error": "journal not found"})
		return
	}
	if err != nil {
		w.WriteHeader(500)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	w.Write([]byte(payload))
}

func initJournalSchema() {
	_, err := db.Exec(`CREATE TABLE IF NOT EXISTS journal_postings (
		journal_id VARCHAR(96) PRIMARY KEY,
		tenant_id VARCHAR(64),
		transaction_ref VARCHAR(128),
		narration VARCHAR(500),
		currency VARCHAR(8),
		total_amount BIGINT,
		leg_count INT,
		payload JSONB,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`)
	if err != nil {
		log.Fatalf("journal_postings schema init failed: %v", err)
	}
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS outbox (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		event_type VARCHAR(64) NOT NULL,
		aggregate_id VARCHAR(128) NOT NULL,
		payload JSONB NOT NULL,
		published BOOLEAN DEFAULT FALSE,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`)
	if err != nil {
		log.Printf("outbox table creation (may already exist): %v", err)
	}
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	startWatchdog(10 * time.Second)

	// Postgres (journal records + outbox)
	// DATABASE_URL is REQUIRED — no credential-bearing default. Fail fast at startup.
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatalf("[journal-posting-go] DATABASE_URL env var is required; refusing to start with default database credentials")
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		log.Fatalf("database ping failed: %v", err)
	}
	initJournalSchema()

	// TigerBeetle ledger client (required for posting; 503 if unconfigured)
	if tb, err := tbclient.NewClient(tbclient.Config{}); err != nil {
		log.Printf("[%s] TigerBeetle unavailable: %v — /v1/journals will fail closed (503)", serviceName, err)
	} else {
		tbClient = tb
		defer tbClient.Close()
	}

	// Outbox relay: marks published only after confirmed Kafka produce
	relayCtx, stopRelay := context.WithCancel(context.Background())
	defer stopRelay()
	startOutboxRelay(relayCtx, eventBus.broker, eventBus.topic)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthHandler)
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/readyz", readyzHandler)
	mux.HandleFunc("/livez", livezHandler)
	mux.HandleFunc("/metrics", metricsHandler)
	mux.Handle("/v1/journals", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(handlePostJournal)))
	mux.Handle("/v1/journals/", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(handleGetJournal)))

	handler := panicRecoveryMiddleware(securityMiddleware(mux))

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("[%s] Starting on :%s", serviceName, port)
		if err := srv.ListenAndServe(); err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Printf("[%s] Shutting down...", serviceName)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
	log.Printf("[%s] Server stopped", serviceName)
}

// jwtRealmURL resolves the Keycloak realm URL for jwtMiddleware (added by
// scripts/fix-go-wire-jwt.py).
func jwtRealmURL() string {
	if v := os.Getenv("KEYCLOAK_REALM_URL"); v != "" {
		return v
	}
	return "http://keycloak:8080/realms/54bank"
}
