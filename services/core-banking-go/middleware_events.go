package main

// middleware_events.go — real JWT (JWKS/RS256) enforcement and a real
// Kafka outbox relay for core-banking-go.
//
// Security: the previous structure-only JWT check accepted any three-part
// token. This file ports the JWKS verifier used by journal-posting-go and
// fails closed: no token → 401, bad/unsigned/expired token → 401, JWKS
// unconfigured/unreachable → 503.
//
// Outbox: the previous relay marked rows published without publishing. Now a
// row becomes published=TRUE only after Kafka confirms the produce; publish
// failures leave published=FALSE (retry semantics) and log an error.

import (
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/IBM/sarama"
)

// ── JWT / JWKS ──────────────────────────────────────────────────────────────

var (
	jwtJWKSURL = os.Getenv("JWT_JWKS_URL") // e.g. https://auth.54bank.ng/.well-known/jwks.json
	jwtIssuer  = os.Getenv("JWT_ISSUER")   // optional issuer enforcement
)

var jwksCache = struct {
	sync.Mutex
	keys      map[string]*rsa.PublicKey
	fetchedAt time.Time
}{}

type jwksDocument struct {
	Keys []struct {
		Kty string `json:"kty"`
		Kid string `json:"kid"`
		Alg string `json:"alg"`
		Use string `json:"use"`
		N   string `json:"n"`
		E   string `json:"e"`
	} `json:"keys"`
}

func fetchJWKS() (map[string]*rsa.PublicKey, error) {
	if jwtJWKSURL == "" {
		return nil, fmt.Errorf("JWT_JWKS_URL not configured")
	}
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(jwtJWKSURL)
	if err != nil {
		return nil, fmt.Errorf("jwks fetch: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("jwks fetch: HTTP %d", resp.StatusCode)
	}
	var doc jwksDocument
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		return nil, fmt.Errorf("jwks decode: %w", err)
	}
	keys := make(map[string]*rsa.PublicKey)
	for _, k := range doc.Keys {
		if k.Kty != "RSA" || k.Kid == "" {
			continue
		}
		nBytes, err := base64.RawURLEncoding.DecodeString(k.N)
		if err != nil {
			continue
		}
		eBytes, err := base64.RawURLEncoding.DecodeString(k.E)
		if err != nil {
			continue
		}
		e := 0
		for _, b := range eBytes {
			e = e<<8 | int(b)
		}
		keys[k.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(nBytes), E: e}
	}
	if len(keys) == 0 {
		return nil, fmt.Errorf("jwks contained no usable RSA keys")
	}
	return keys, nil
}

// jwksKeys returns cached keys (10-minute TTL), refetching when stale.
func jwksKeys(forceRefresh bool) (map[string]*rsa.PublicKey, error) {
	jwksCache.Lock()
	defer jwksCache.Unlock()
	if !forceRefresh && jwksCache.keys != nil && time.Since(jwksCache.fetchedAt) < 10*time.Minute {
		return jwksCache.keys, nil
	}
	keys, err := fetchJWKS()
	if err != nil {
		if jwksCache.keys != nil {
			// Serve stale keys rather than dropping all auth, but surface it.
			log.Printf("[auth] JWKS refresh failed (serving cached keys): %v", err)
			return jwksCache.keys, nil
		}
		return nil, err
	}
	jwksCache.keys = keys
	jwksCache.fetchedAt = time.Now()
	return keys, nil
}

type jwtClaims struct {
	Sub      string `json:"sub"`
	Iss      string `json:"iss"`
	Exp      int64  `json:"exp"`
	TenantID string `json:"tenant_id"`
}

// verifyJWT validates an RS256 token against the JWKS endpoint. Returns the
// claims on success.
func verifyJWT(token string) (*jwtClaims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("malformed token")
	}
	headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, fmt.Errorf("malformed token header")
	}
	var header struct {
		Alg string `json:"alg"`
		Kid string `json:"kid"`
	}
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		return nil, fmt.Errorf("malformed token header")
	}
	if header.Alg != "RS256" {
		return nil, fmt.Errorf("unsupported alg %q (RS256 required)", header.Alg)
	}
	if header.Kid == "" {
		return nil, fmt.Errorf("token missing kid")
	}

	keys, err := jwksKeys(false)
	if err != nil {
		return nil, fmt.Errorf("jwks unavailable: %w", err)
	}
	key, ok := keys[header.Kid]
	if !ok {
		// Unknown kid — try one forced refresh (key rotation), then give up.
		if keys, err = jwksKeys(true); err != nil {
			return nil, fmt.Errorf("jwks unavailable: %w", err)
		}
		key, ok = keys[header.Kid]
		if !ok {
			return nil, fmt.Errorf("unknown signing key %q", header.Kid)
		}
	}

	signed := []byte(parts[0] + "." + parts[1])
	sig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, fmt.Errorf("malformed signature")
	}
	digest := sha256.Sum256(signed)
	if err := rsa.VerifyPKCS1v15(key, crypto.SHA256, digest[:], sig); err != nil {
		return nil, fmt.Errorf("invalid signature")
	}

	claimBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("malformed claims")
	}
	var claims jwtClaims
	if err := json.Unmarshal(claimBytes, &claims); err != nil {
		return nil, fmt.Errorf("malformed claims")
	}
	if claims.Exp != 0 && time.Now().Unix() > claims.Exp {
		return nil, fmt.Errorf("token expired")
	}
	if jwtIssuer != "" && claims.Iss != jwtIssuer {
		return nil, fmt.Errorf("issuer mismatch")
	}
	return &claims, nil
}

// jwtAuthMiddleware enforces RS256 JWT auth. Fails closed: 401 on missing /
// invalid tokens; 503 when the JWKS endpoint is not configured (the service
// cannot verify, so it refuses rather than allows).
func jwtAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if p == "/healthz" || p == "/readyz" || p == "/livez" || p == "/metrics" || p == "/health" {
			next.ServeHTTP(w, r)
			return
		}
		authz := r.Header.Get("Authorization")
		if authz == "" || !strings.HasPrefix(authz, "Bearer ") {
			jsonResp(w, 401, map[string]string{"error": "missing bearer token"})
			return
		}
		if jwtJWKSURL == "" {
			log.Printf("[auth] JWT_JWKS_URL not configured — refusing request (fail closed)")
			jsonResp(w, 503, map[string]string{"error": "authentication not configured"})
			return
		}
		claims, err := verifyJWT(strings.TrimPrefix(authz, "Bearer "))
		if err != nil {
			jsonResp(w, 401, map[string]string{"error": "invalid token: " + err.Error()})
			return
		}
		if claims.Sub != "" {
			r.Header.Set("X-User-ID", claims.Sub)
		}
		if claims.TenantID != "" {
			r.Header.Set("X-Tenant-ID", claims.TenantID)
		}
		next.ServeHTTP(w, r)
	})
}

// ── Kafka producer + domain events ──────────────────────────────────────────

var kafkaInit = struct {
	sync.Mutex
	producer  sarama.SyncProducer
	err       error
	attempted bool
}{}

// getKafkaProducer lazily creates a SyncProducer from KAFKA_BOOTSTRAP_SERVERS
// (or KAFKA_BROKERS). Returns an error when unconfigured/unreachable.
func getKafkaProducer() (sarama.SyncProducer, error) {
	kafkaInit.Lock()
	defer kafkaInit.Unlock()
	if kafkaInit.attempted {
		return kafkaInit.producer, kafkaInit.err
	}
	kafkaInit.attempted = true
	raw := os.Getenv("KAFKA_BOOTSTRAP_SERVERS")
	if raw == "" {
		raw = os.Getenv("KAFKA_BROKERS")
	}
	if raw == "" {
		kafkaInit.err = fmt.Errorf("kafka not configured (set KAFKA_BOOTSTRAP_SERVERS)")
		return nil, kafkaInit.err
	}
	brokers := strings.Split(raw, ",")
	for i := range brokers {
		brokers[i] = strings.TrimSpace(brokers[i])
	}
	cfg := sarama.NewConfig()
	cfg.Producer.RequiredAcks = sarama.WaitForAll
	cfg.Producer.Return.Successes = true
	cfg.Producer.Retry.Max = 3
	producer, err := sarama.NewSyncProducer(brokers, cfg)
	if err != nil {
		kafkaInit.err = fmt.Errorf("kafka producer init: %w", err)
		return nil, kafkaInit.err
	}
	kafkaInit.producer = producer
	return producer, nil
}

// publishDomainEvent publishes a domain event to Kafka. Returns an error
// when Kafka is unavailable — callers must surface it.
func publishDomainEvent(eventType, tenantID string, payload interface{}) error {
	producer, err := getKafkaProducer()
	if err != nil {
		return err
	}
	body, err := json.Marshal(map[string]interface{}{
		"eventType": eventType,
		"tenantID":  tenantID,
		"service":   serviceName,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"payload":   payload,
	})
	if err != nil {
		return err
	}
	_, _, err = producer.SendMessage(&sarama.ProducerMessage{
		Topic: "core-banking.events",
		Key:   sarama.StringEncoder(eventType),
		Value: sarama.ByteEncoder(body),
	})
	if err != nil {
		return fmt.Errorf("kafka publish %s: %w", eventType, err)
	}
	return nil
}

// ── Outbox relay ────────────────────────────────────────────────────────────

// startOutboxRelay publishes pending outbox rows to Kafka and marks them
// published ONLY after a confirmed produce. Publish failures leave
// published=FALSE so the next cycle retries — this is the correct
// at-least-once semantics the previous fake relay violated.
func startOutboxRelay(interval time.Duration) {
	if db == nil {
		log.Printf("[outbox] no DATABASE_URL — relay disabled (nothing marked published)")
		return
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for range ticker.C {
		relayOutbox()
	}
}

func relayOutbox() {
	rows, err := db.Query(`SELECT id, topic, payload FROM outbox WHERE published = FALSE ORDER BY id LIMIT 100`)
	if err != nil {
		log.Printf("[outbox] query failed: %v", err)
		return
	}
	type pendingRow struct {
		id      int64
		topic   string
		payload []byte
	}
	var pending []pendingRow
	for rows.Next() {
		var p pendingRow
		if err := rows.Scan(&p.id, &p.topic, &p.payload); err != nil {
			log.Printf("[outbox] scan failed: %v", err)
			continue
		}
		pending = append(pending, p)
	}
	rows.Close()

	if len(pending) == 0 {
		return
	}

	producer, err := getKafkaProducer()
	if err != nil {
		log.Printf("[outbox] %d events pending; Kafka unavailable: %v (leaving published=FALSE)", len(pending), err)
		return
	}

	for _, p := range pending {
		_, _, err := producer.SendMessage(&sarama.ProducerMessage{
			Topic: p.topic,
			Value: sarama.ByteEncoder(p.payload),
		})
		if err != nil {
			log.Printf("[outbox] publish failed for id=%d topic=%s: %v (leaving published=FALSE for retry)", p.id, p.topic, err)
			continue
		}
		if _, err := db.Exec(`UPDATE outbox SET published = TRUE, published_at = NOW() WHERE id = $1`, p.id); err != nil {
			// The event IS in Kafka; a duplicate on retry is preferable to a
			// lost event, so this is logged, not silently ignored.
			log.Printf("[outbox] CRITICAL: published id=%d to Kafka but DB mark failed: %v (may republish on retry)", p.id, err)
		}
	}
}
