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
	"os/signal"
	"regexp"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/IBM/sarama"
	_ "github.com/lib/pq"
)

var db *sql.DB

var serviceName = "identity-verification-go"

var startTime = time.Now()

// ─── Domain Types ───────────────────────────────────────────────────────────

type VerificationRequest struct {
	Type       string `json:"type"`
	IDNumber   string `json:"idNumber"`
	FirstName  string `json:"firstName,omitempty"`
	LastName   string `json:"lastName,omitempty"`
	DOB        string `json:"dateOfBirth,omitempty"`
	PhotoB64   string `json:"photoBase64,omitempty"`
	CustomerID string `json:"customerId,omitempty"`
}

type VerificationResult struct {
	ID         string  `json:"id"`
	Type       string  `json:"type"`
	MaskedID   string  `json:"maskedId"`
	Verified   *bool   `json:"verified"` // nil = unknown (provider unavailable)
	Status     string  `json:"status"`   // verified | not_verified | provider_unavailable
	FirstName  string  `json:"firstName,omitempty"`
	LastName   string  `json:"lastName,omitempty"`
	DOB        string  `json:"dateOfBirth,omitempty"`
	NameMatch  float64 `json:"nameMatchScore,omitempty"`
	Provider   string  `json:"provider"`
	ProviderRef string `json:"providerRef,omitempty"`
	VerifiedAt string  `json:"verifiedAt,omitempty"`
}

var bvnRegex = regexp.MustCompile(`^\d{11}$`)
var ninRegex = regexp.MustCompile(`^\d{11}$`)

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Service", serviceName)
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func maskID(id string) string {
	if len(id) < 7 {
		return id
	}
	return id[:3] + "****" + id[len(id)-4:]
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func boolPtr(b bool) *bool { return &b }

// ─── Provider Integration (NIBSS BVN / NIMC NIN) ────────────────────────────
//
// Identity verification is fail-closed: if the upstream provider is not
// configured or is unreachable, the handler returns 503 and verified=null.
// This service NEVER synthesizes a "verified" verdict.

var providerHTTPClient = &http.Client{Timeout: 10 * time.Second}

// callIdentityProvider POSTs the verification request to the configured
// upstream provider and returns its raw JSON response.
func callIdentityProvider(providerURL string, reqBody map[string]interface{}) (map[string]interface{}, error) {
	payload, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}
	resp, err := providerHTTPClient.Post(providerURL, "application/json", bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("provider call failed: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("provider returned status %d", resp.StatusCode)
	}
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("provider returned invalid JSON: %w", err)
	}
	return result, nil
}

// nameMatchScore computes a real normalized token-overlap score between the
// requester-supplied name and the provider-returned name. No randomness.
func nameMatchScore(reqFirst, reqLast, provFirst, provLast string) float64 {
	if reqFirst == "" && reqLast == "" {
		return 0
	}
	norm := func(s string) map[string]bool {
		out := map[string]bool{}
		for _, tok := range strings.Fields(strings.ToUpper(strings.TrimSpace(s))) {
			out[tok] = true
		}
		return out
	}
	reqTokens := norm(reqFirst + " " + reqLast)
	provTokens := norm(provFirst + " " + provLast)
	if len(reqTokens) == 0 || len(provTokens) == 0 {
		return 0
	}
	overlap := 0
	for tok := range reqTokens {
		if provTokens[tok] {
			overlap++
		}
	}
	return float64(overlap) / float64(len(reqTokens))
}

func strField(m map[string]interface{}, keys ...string) string {
	for _, k := range keys {
		if v, ok := m[k].(string); ok && v != "" {
			return v
		}
	}
	return ""
}

// verifyWithProvider performs a BVN or NIN verification against the configured
// upstream provider. Returns (result, nil) on a definitive provider answer, or
// (nil, error) when no verdict could be obtained (fail-closed path).
func verifyWithProvider(providerURL, providerName, idType string, req VerificationRequest) (*VerificationResult, error) {
	providerResp, err := callIdentityProvider(providerURL, map[string]interface{}{
		strings.ToLower(idType): req.IDNumber,
		"firstName":             req.FirstName,
		"lastName":              req.LastName,
		"dateOfBirth":           req.DOB,
		"customerId":            req.CustomerID,
	})
	if err != nil {
		return nil, err
	}

	// The provider MUST state its verdict explicitly; absence of a verdict is
	// treated as an error, never as success.
	verifiedRaw, ok := providerResp["verified"]
	if !ok {
		return nil, fmt.Errorf("provider response missing 'verified' verdict")
	}
	verified, ok := verifiedRaw.(bool)
	if !ok {
		return nil, fmt.Errorf("provider response has non-boolean 'verified' verdict")
	}

	provFirst := strField(providerResp, "firstName", "first_name")
	provLast := strField(providerResp, "lastName", "last_name")
	provDOB := strField(providerResp, "dateOfBirth", "dob")

	status := "not_verified"
	if verified {
		status = "verified"
	}

	result := &VerificationResult{
		ID:          fmt.Sprintf("VER-%d", time.Now().UnixNano()),
		Type:        idType,
		MaskedID:    maskID(req.IDNumber),
		Verified:    boolPtr(verified),
		Status:      status,
		FirstName:   provFirst,
		LastName:    provLast,
		DOB:         provDOB,
		NameMatch:   nameMatchScore(req.FirstName, req.LastName, provFirst, provLast),
		Provider:    providerName,
		ProviderRef: strField(providerResp, "providerRef", "reference", "transactionRef"),
		VerifiedAt:  time.Now().UTC().Format(time.RFC3339),
	}
	return result, nil
}

// ─── Handlers ───────────────────────────────────────────────────────────────

func healthHandler(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{
		"service": serviceName, "status": "healthy", "version": "2.0.0",
		"uptime_secs": int(time.Since(startTime).Seconds()),
		"domain":      "Identity Verification — BVN/NIN with Liveness (fail-closed)",
	})
}

func handleVerifyBVN(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var req VerificationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, 400, map[string]string{"error": "invalid JSON body"})
		return
	}
	if !bvnRegex.MatchString(req.IDNumber) {
		respondJSON(w, 400, map[string]string{"error": "BVN must be 11 digits"})
		return
	}

	providerURL := os.Getenv("NIBSS_BVN_URL")
	if providerURL == "" {
		providerURL = os.Getenv("NIBSS_URL")
	}
	if providerURL == "" {
		respondJSON(w, 503, map[string]interface{}{
			"error": "bvn_provider_unconfigured", "verified": nil,
			"detail": "set NIBSS_BVN_URL (or NIBSS_URL) to the NIBSS BVN verification endpoint",
		})
		return
	}

	result, err := verifyWithProvider(providerURL, "NIBSS", "bvn", req)
	if err != nil {
		log.Printf("[%s] BVN provider call failed: %v", serviceName, err)
		respondJSON(w, 503, map[string]interface{}{
			"error": "bvn_provider_unavailable", "verified": nil, "detail": err.Error(),
		})
		return
	}
	persistVerification(*result)
	respondJSON(w, 200, result)
}

func handleVerifyNIN(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var req VerificationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, 400, map[string]string{"error": "invalid JSON body"})
		return
	}
	if !ninRegex.MatchString(req.IDNumber) {
		respondJSON(w, 400, map[string]string{"error": "NIN must be 11 digits"})
		return
	}

	providerURL := os.Getenv("NIMC_NIN_URL")
	if providerURL == "" {
		providerURL = os.Getenv("NIMC_URL")
	}
	if providerURL == "" {
		respondJSON(w, 503, map[string]interface{}{
			"error": "nin_provider_unconfigured", "verified": nil,
			"detail": "set NIMC_NIN_URL (or NIMC_URL) to the NIMC NIN verification endpoint",
		})
		return
	}

	result, err := verifyWithProvider(providerURL, "NIMC", "nin", req)
	if err != nil {
		log.Printf("[%s] NIN provider call failed: %v", serviceName, err)
		respondJSON(w, 503, map[string]interface{}{
			"error": "nin_provider_unavailable", "verified": nil, "detail": err.Error(),
		})
		return
	}
	persistVerification(*result)
	respondJSON(w, 200, result)
}

func persistVerification(v VerificationResult) {
	if db == nil {
		return
	}
	payload, err := json.Marshal(v)
	if err != nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var verified interface{}
	if v.Verified != nil {
		verified = *v.Verified
	}
	if _, err := db.ExecContext(ctx,
		`INSERT INTO identity_verifications (id, type, masked_id, verified, status, provider, payload)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		v.ID, v.Type, v.MaskedID, verified, v.Status, v.Provider, string(payload)); err != nil {
		log.Printf("[%s] persist verification failed: %v", serviceName, err)
		return
	}
	// Outbox row; published only by the relay after a confirmed Kafka produce.
	if _, err := db.ExecContext(ctx,
		`INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)`,
		"identity."+v.Type+".verified", v.ID, string(payload)); err != nil {
		log.Printf("[%s] outbox insert failed: %v", serviceName, err)
	}
}

func handleLivenessCheck(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondJSON(w, 400, map[string]string{"error": "invalid JSON body"})
		return
	}

	// Delegate to the real liveness inference engine. Fail closed: any engine
	// error means NOT live, never a synthesized verdict.
	engineURL := os.Getenv("LIVENESS_INFERENCE_URL")
	if engineURL == "" {
		engineURL = "http://localhost:8230"
	}
	engineResp, err := callIdentityProvider(engineURL+"/v1/liveness/check", body)
	if err != nil {
		log.Printf("[%s] liveness engine call failed: %v", serviceName, err)
		respondJSON(w, 503, map[string]interface{}{
			"error": "liveness_engine_unavailable", "isLive": false, "verdict": "UNKNOWN",
			"detail": err.Error(),
		})
		return
	}
	isLive, _ := engineResp["isLive"].(bool)
	if !isLive {
		isLive, _ = engineResp["is_live"].(bool)
	}
	score, _ := engineResp["score"].(float64)
	verdict := "SPOOF"
	if isLive {
		verdict = "LIVE"
	}
	respondJSON(w, 200, map[string]interface{}{
		"sessionId": fmt.Sprintf("LIV-%d", time.Now().UnixNano()),
		"isLive":    isLive,
		"verdict":   verdict,
		"score":     score,
		"engine":    engineURL,
		"createdAt": time.Now().UTC().Format(time.RFC3339),
	})
}

// listHandler returns persisted verification records from Postgres (no
// fabricated records). Used by /v1/verifications.
func listHandler(w http.ResponseWriter, r *http.Request) {
	if db == nil {
		respondJSON(w, 503, map[string]string{"error": "database unavailable"})
		return
	}
	rows, err := db.QueryContext(r.Context(),
		`SELECT payload FROM identity_verifications ORDER BY created_at DESC LIMIT 100`)
	if err != nil {
		respondJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()
	var out []json.RawMessage
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err != nil {
			continue
		}
		out = append(out, json.RawMessage(p))
	}
	respondJSON(w, 200, map[string]interface{}{"verifications": out, "total": len(out)})
}

// ── MIDDLEWARE: JWT Validation (JWKS / RS256) ───────────────────────────────

type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}

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

func jwtRealmURL() string {
	return getEnv("KEYCLOAK_REALM_URL", "http://keycloak:8080/realms/54bank")
}

func startJWKSRefresh() {
	go fetchJWKS(jwtRealmURL())
	go func() {
		for range time.Tick(5 * time.Minute) {
			fetchJWKS(jwtRealmURL())
		}
	}()
}

// jwtAuthMiddleware validates Bearer tokens against the Keycloak JWKS endpoint
// (RS256 signature + expiry). Fail-closed: any validation problem rejects the
// request; no token is ever accepted on structure alone.
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
			fmt.Fprintf(w, `{"error":"missing bearer token","service":%q}`, serviceName)
			return
		}
		token := auth[7:]
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"malformed token","service":%q}`, serviceName)
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
		ctx := context.WithValue(r.Context(), "jwt_claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// ── MIDDLEWARE: Outbox Relay (Kafka) ────────────────────────────────────────
//
// Events are marked published ONLY after a confirmed Kafka produce. If Kafka
// is unavailable the rows stay published=FALSE and are retried on the next
// tick — no event is ever silently discarded.

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
	producer, err := getKafkaProducer(brokers)
	if err != nil {
		log.Printf("[outbox-relay] kafka unavailable: %v — events remain unpublished for retry", err)
		return
	}
	rows, err := db.Query(`SELECT id, event_type, aggregate_id, payload FROM outbox WHERE published = FALSE ORDER BY created_at LIMIT 100`)
	if err != nil {
		return
	}
	defer rows.Close()

	var publishedIDs []string
	for rows.Next() {
		var id, eventType, aggID string
		var payload []byte
		if err := rows.Scan(&id, &eventType, &aggID, &payload); err != nil {
			continue
		}
		msg := &sarama.ProducerMessage{
			Topic: topic,
			Key:   sarama.StringEncoder(aggID),
			Value: sarama.ByteEncoder(payload),
		}
		if _, _, err := producer.SendMessage(msg); err != nil {
			log.Printf("[outbox-relay] publish failed for event %s: %v — leaving unpublished for retry", id, err)
			continue
		}
		publishedIDs = append(publishedIDs, id)
	}
	for _, id := range publishedIDs {
		if _, err := db.Exec(`UPDATE outbox SET published = TRUE WHERE id = $1`, id); err != nil {
			log.Printf("[outbox-relay] failed to mark event %s published: %v", id, err)
		}
	}
	if len(publishedIDs) > 0 {
		log.Printf("[outbox-relay] published %d events to kafka topic=%s", len(publishedIDs), topic)
	}
}

// --- Rate Limiting ---
var _rlTokens int64 = 100
var _rlLastRefill int64 = 0

func rlAllow() bool {
	nowr := time.Now().UnixMilli()
	if nowr-atomic.LoadInt64(&_rlLastRefill) >= 1000 {
		atomic.StoreInt64(&_rlTokens, 100)
		atomic.StoreInt64(&_rlLastRefill, nowr)
	}
	if atomic.AddInt64(&_rlTokens, -1) < 0 {
		atomic.AddInt64(&_rlTokens, 1)
		return false
	}
	return true
}

func rateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !rlAllow() {
			w.Header().Set("Retry-After", "1")
			http.Error(w, `{"error":"rate_limit_exceeded"}`, 429)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// --- Production Hardening ---
var (
	_reqCount uint64
	_errCount uint64
	_bootTime = time.Now()
)

func readyzHandler(w http.ResponseWriter, r *http.Request) {
	if db == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{"status": "not ready", "error": "database not initialized"})
		return
	}
	if err := db.Ping(); err != nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{"status": "not ready", "error": err.Error()})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
}

func metricsHandler(w http.ResponseWriter, r *http.Request) {
	reqs := atomic.LoadUint64(&_reqCount)
	errs := atomic.LoadUint64(&_errCount)
	w.Header().Set("Content-Type", "text/plain")
	fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"identity-verification-go\"} %d\n", reqs)
	fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"identity-verification-go\"} %d\n", errs)
	fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"identity-verification-go\"} %.0f\n", time.Since(_bootTime).Seconds())
}

func countingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddUint64(&_reqCount, 1)
		rw := &responseWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(rw, r)
		if rw.status >= 400 {
			atomic.AddUint64(&_errCount, 1)
		}
	})
}

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Tenant-ID, X-User-ID, X-Request-ID")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func initSchema() {
	_, err := db.Exec(`CREATE TABLE IF NOT EXISTS identity_verifications (
		id VARCHAR(64) PRIMARY KEY,
		type VARCHAR(16) NOT NULL,
		masked_id VARCHAR(32) NOT NULL,
		verified BOOLEAN,
		status VARCHAR(32) NOT NULL,
		provider VARCHAR(32),
		payload JSONB NOT NULL,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`)
	if err != nil {
		log.Fatalf("schema init failed: %v", err)
	}

	// Outbox for event sourcing
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

	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_identity_verifications_created ON identity_verifications(created_at DESC)`)
	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_outbox_unpublished ON outbox(published, created_at) WHERE NOT published`)
}

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Printf("[%s] starting", serviceName)

	// PostgreSQL connection
	dsn := getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/identity_verification_go?sslmode=disable")
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer db.Close()

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err := db.Ping(); err != nil {
		log.Fatalf("database ping failed: %v", err)
	}

	initSchema()
	log.Printf("[%s] database connected, schema initialized", serviceName)

	keycloakURL := jwtRealmURL()
	kafkaBrokers := getEnv("KAFKA_BROKERS", "localhost:9092")
	log.Printf("[%s] middleware: keycloak=%s kafka=%s", serviceName, keycloakURL, kafkaBrokers)

	startJWKSRefresh()

	relayCtx, stopRelay := context.WithCancel(context.Background())
	defer stopRelay()
	startOutboxRelay(relayCtx, kafkaBrokers, "kyc.verifications")

	mux := http.NewServeMux()

	// Health endpoints
	mux.HandleFunc("/healthz", healthHandler)
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/readyz", readyzHandler)
	mux.HandleFunc("/livez", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "alive"})
	})
	mux.HandleFunc("/metrics", metricsHandler)

	// Domain endpoints (JWT-protected, fail-closed provider-backed)
	mux.HandleFunc("/v1/verify/bvn", handleVerifyBVN)
	mux.HandleFunc("/v1/verify/nin", handleVerifyNIN)
	mux.HandleFunc("/v1/liveness/check", handleLivenessCheck)
	mux.HandleFunc("/v1/verifications", listHandler)

	server := &http.Server{
		Addr:         ":" + getEnv("PORT", "8480"),
		Handler:      countingMiddleware(rateLimitMiddleware(jwtAuthMiddleware(corsMiddleware(mux)))),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	log.Printf("[%s] ready on :%s", serviceName, getEnv("PORT", "8480"))

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Printf("[%s] shutting down...", serviceName)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	server.Shutdown(ctx)
	log.Printf("[%s] stopped", serviceName)
}
