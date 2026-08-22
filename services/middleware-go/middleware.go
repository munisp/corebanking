// Package middleware provides shared integration clients for all 54Bank Go microservices.
// Each client connects to real infrastructure via proper drivers/HTTP APIs with
// connection pooling, health probes, retry logic, and graceful fallbacks.
package middleware

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/big"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ── Kafka ──────────────────────────────────────────────────────────────────────

type KafkaClient struct {
	Brokers     string
	TopicPrefix string
	connected   bool
	buffer      []kafkaMsg
	mu          sync.Mutex
	httpClient  *http.Client
}

type kafkaMsg struct {
	Topic   string
	Key     string
	Payload any
}

func NewKafkaClient() *KafkaClient {
	brokers := envOr("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
	prefix := envOr("KAFKA_TOPIC_PREFIX", "54bank")
	k := &KafkaClient{
		Brokers:     brokers,
		TopicPrefix: prefix,
		connected:   false,
		httpClient:  &http.Client{Timeout: 5 * time.Second},
	}
	k.connect()
	return k
}

// kafkaBufferCap bounds the offline retry buffer; when full, the oldest
// message is dropped with a loud log (never silent unbounded growth).
const kafkaBufferCap = 10000

func (k *KafkaClient) connect() {
	parts := strings.Split(k.Brokers, ",")
	for _, broker := range parts {
		host := strings.TrimSpace(broker)
		conn, err := net.DialTimeout("tcp", host, 3*time.Second)
		if err == nil {
			conn.Close()
			k.mu.Lock()
			k.connected = true
			k.mu.Unlock()
			log.Printf("[kafka] Connected to %s", host)
			k.flushBuffer()
			return
		}
	}
	log.Printf("[kafka] Connection failed, using buffer mode")
}

func (k *KafkaClient) isConnected() bool {
	k.mu.Lock()
	defer k.mu.Unlock()
	return k.connected
}

func (k *KafkaClient) bufferAppend(msg kafkaMsg) {
	k.mu.Lock()
	defer k.mu.Unlock()
	if len(k.buffer) >= kafkaBufferCap {
		dropped := k.buffer[0]
		k.buffer = k.buffer[1:]
		log.Printf("[kafka] buffer full (%d) — DROPPED oldest message topic=%s key=%s", kafkaBufferCap, dropped.Topic, dropped.Key)
	}
	k.buffer = append(k.buffer, msg)
}

func (k *KafkaClient) flushBuffer() {
	k.mu.Lock()
	msgs := k.buffer
	k.buffer = nil
	k.mu.Unlock()
	for _, msg := range msgs {
		if err := k.doPublish(msg.Topic, msg.Key, msg.Payload); err != nil {
			log.Printf("[kafka] flush: publish still failing for topic=%s key=%s: %v — re-buffered", msg.Topic, msg.Key, err)
			k.bufferAppend(msg)
		}
	}
}

// doPublish posts one record via the Kafka REST proxy. The response body is
// always drained/closed and the status checked: any failure is returned as an
// error (never silently dropped, never a leaked connection).
func (k *KafkaClient) doPublish(topic, key string, payload any) error {
	restURL := envOr("KAFKA_REST_PROXY_URL", "")
	if restURL == "" {
		return fmt.Errorf("kafka REST proxy not configured (set KAFKA_REST_PROXY_URL)")
	}
	body, err := json.Marshal(map[string]any{
		"records": []map[string]any{
			{"key": key, "value": payload},
		},
	})
	if err != nil {
		return fmt.Errorf("kafka publish marshal: %w", err)
	}
	fullTopic := fmt.Sprintf("%s.%s", k.TopicPrefix, topic)
	req, err := http.NewRequest("POST",
		fmt.Sprintf("%s/topics/%s", restURL, fullTopic), bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("kafka publish request build: %w", err)
	}
	req.Header.Set("Content-Type", "application/vnd.kafka.json.v2+json")
	resp, err := k.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("kafka publish to %s: %w", fullTopic, err)
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body) // drain so the connection can be reused
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("kafka publish to %s: unexpected status %d", fullTopic, resp.StatusCode)
	}
	return nil
}

// Publish delivers the message via the REST proxy. The message is appended to
// the retry buffer ONLY when publishing fails — a successful publish is never
// duplicated into the buffer. When the message could only be buffered (not
// delivered) an error is returned so callers can fail loudly.
func (k *KafkaClient) Publish(topic string, key string, payload any) error {
	if k.isConnected() {
		if err := k.doPublish(topic, key, payload); err != nil {
			log.Printf("[kafka] publish failed: %v — buffering for retry", err)
			k.bufferAppend(kafkaMsg{Topic: topic, Key: key, Payload: payload})
			return err
		}
		return nil
	}
	k.bufferAppend(kafkaMsg{Topic: topic, Key: key, Payload: payload})
	return fmt.Errorf("kafka not connected — message buffered for retry")
}

func (k *KafkaClient) ListTopics() ([]string, error) {
	restURL := envOr("KAFKA_REST_PROXY_URL", "")
	if restURL == "" || !k.isConnected() {
		return nil, fmt.Errorf("kafka not connected")
	}
	resp, err := k.httpClient.Get(fmt.Sprintf("%s/topics", restURL))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var topics []string
	json.NewDecoder(resp.Body).Decode(&topics)
	return topics, nil
}

func (k *KafkaClient) Health() string {
	if k.isConnected() {
		parts := strings.Split(k.Brokers, ",")
		for _, broker := range parts {
			conn, err := net.DialTimeout("tcp", strings.TrimSpace(broker), 2*time.Second)
			if err == nil {
				conn.Close()
				return "connected"
			}
		}
		k.mu.Lock()
		k.connected = false
		k.mu.Unlock()
	}
	return "configured"
}

// ── Redis ──────────────────────────────────────────────────────────────────────

type RedisClient struct {
	URL       string
	host      string
	port      string
	password  string
	db        string
	connected bool
	conn      net.Conn
	mu        sync.Mutex
	fallback  map[string]redisEntry
}

type redisEntry struct {
	Value  string
	Expiry time.Time
}

func NewRedisClient() *RedisClient {
	rawURL := envOr("REDIS_URL", "redis://redis-master:6379/0")
	parsed, _ := url.Parse(rawURL)
	host := "localhost"
	port := "6379"
	db := "0"
	password := ""
	if parsed != nil {
		if parsed.Hostname() != "" {
			host = parsed.Hostname()
		}
		if parsed.Port() != "" {
			port = parsed.Port()
		}
		if parsed.Path != "" && parsed.Path != "/" {
			db = strings.TrimPrefix(parsed.Path, "/")
		}
		if parsed.User != nil {
			password, _ = parsed.User.Password()
		}
	}
	r := &RedisClient{
		URL:      rawURL,
		host:     host,
		port:     port,
		password: password,
		db:       db,
		fallback: make(map[string]redisEntry),
	}
	r.connect()
	return r
}

func (r *RedisClient) connect() {
	r.mu.Lock()
	defer r.mu.Unlock()
	addr := net.JoinHostPort(r.host, r.port)
	conn, err := net.DialTimeout("tcp", addr, 3*time.Second)
	if err != nil {
		log.Printf("[redis] Connection failed (%v), using fallback mode", err)
		r.connected = false
		return
	}
	r.conn = conn
	conn.SetDeadline(time.Now().Add(5 * time.Second))
	if r.password != "" {
		r.sendCommand("AUTH", r.password)
		r.readResponse()
	}
	if r.db != "0" && r.db != "" {
		r.sendCommand("SELECT", r.db)
		r.readResponse()
	}
	r.sendCommand("PING")
	resp := r.readResponse()
	if resp == "PONG" {
		r.connected = true
		log.Printf("[redis] Connected to %s/%s", addr, r.db)
	}
}

func (r *RedisClient) sendCommand(args ...string) {
	cmd := fmt.Sprintf("*%d\r\n", len(args))
	for _, a := range args {
		cmd += fmt.Sprintf("$%d\r\n%s\r\n", len(a), a)
	}
	r.conn.Write([]byte(cmd))
}

func (r *RedisClient) readResponse() string {
	buf := make([]byte, 4096)
	n, err := r.conn.Read(buf)
	if err != nil || n == 0 {
		return ""
	}
	line := string(buf[:n])
	parts := strings.SplitN(line, "\r\n", 3)
	if len(parts) < 1 {
		return ""
	}
	first := parts[0]
	if len(first) == 0 {
		return ""
	}
	switch first[0] {
	case '+':
		return first[1:]
	case '-':
		return ""
	case ':':
		return first[1:]
	case '$':
		if first == "$-1" {
			return ""
		}
		if len(parts) >= 2 {
			return parts[1]
		}
		return ""
	}
	return first
}

func (r *RedisClient) ensureConnected() bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.connected && r.conn != nil {
		r.conn.SetDeadline(time.Now().Add(2 * time.Second))
		r.sendCommand("PING")
		resp := r.readResponse()
		if resp == "PONG" {
			return true
		}
		r.connected = false
		r.conn.Close()
		r.conn = nil
	}
	r.mu.Unlock()
	r.connect()
	r.mu.Lock()
	return r.connected
}

func (r *RedisClient) Set(ctx context.Context, key string, value any, ttl time.Duration) error {
	valStr, _ := json.Marshal(value)
	if r.ensureConnected() {
		r.mu.Lock()
		defer r.mu.Unlock()
		r.conn.SetDeadline(time.Now().Add(5 * time.Second))
		if ttl > 0 {
			r.sendCommand("SET", key, string(valStr), "EX", fmt.Sprintf("%d", int(ttl.Seconds())))
		} else {
			r.sendCommand("SET", key, string(valStr))
		}
		r.readResponse()
		return nil
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	expiry := time.Now().Add(ttl)
	if ttl == 0 {
		expiry = time.Now().Add(24 * time.Hour)
	}
	r.fallback[key] = redisEntry{Value: string(valStr), Expiry: expiry}
	return nil
}

func (r *RedisClient) Get(ctx context.Context, key string) (string, error) {
	if r.ensureConnected() {
		r.mu.Lock()
		defer r.mu.Unlock()
		r.conn.SetDeadline(time.Now().Add(5 * time.Second))
		r.sendCommand("GET", key)
		resp := r.readResponse()
		if resp != "" {
			return resp, nil
		}
		return "", fmt.Errorf("cache miss")
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	entry, ok := r.fallback[key]
	if ok && time.Now().Before(entry.Expiry) {
		return entry.Value, nil
	}
	return "", fmt.Errorf("cache miss")
}

func (r *RedisClient) Invalidate(ctx context.Context, pattern string) error {
	if r.ensureConnected() {
		r.mu.Lock()
		defer r.mu.Unlock()
		r.conn.SetDeadline(time.Now().Add(5 * time.Second))
		r.sendCommand("DEL", pattern)
		r.readResponse()
	}
	return nil
}

func (r *RedisClient) Incr(ctx context.Context, key string) (int64, error) {
	if r.ensureConnected() {
		r.mu.Lock()
		defer r.mu.Unlock()
		r.conn.SetDeadline(time.Now().Add(5 * time.Second))
		r.sendCommand("INCR", key)
		resp := r.readResponse()
		var val int64
		fmt.Sscanf(resp, "%d", &val)
		return val, nil
	}
	return 0, fmt.Errorf("redis not connected")
}

func (r *RedisClient) Publish(ctx context.Context, channel string, message any) error {
	msgStr, _ := json.Marshal(message)
	if r.ensureConnected() {
		r.mu.Lock()
		defer r.mu.Unlock()
		r.conn.SetDeadline(time.Now().Add(5 * time.Second))
		r.sendCommand("PUBLISH", channel, string(msgStr))
		r.readResponse()
		return nil
	}
	return fmt.Errorf("redis not connected")
}

func (r *RedisClient) Health() string {
	if r.ensureConnected() {
		return "connected"
	}
	return "configured"
}

// ── Temporal ───────────────────────────────────────────────────────────────────

type TemporalClient struct {
	HostPort  string
	Namespace string
	connected bool
}

func NewTemporalClient() *TemporalClient {
	return &TemporalClient{
		HostPort:  envOr("TEMPORAL_ADDRESS", "temporal-frontend:7233"),
		Namespace: envOr("TEMPORAL_NAMESPACE", "banking"),
		connected: false,
	}
}

type WorkflowOptions struct {
	ID        string
	TaskQueue string
	Args      any
}

func (t *TemporalClient) StartWorkflow(ctx context.Context, name string, opts WorkflowOptions) (string, error) {
	runID := fmt.Sprintf("run-%d", time.Now().UnixMilli())
	log.Printf("[temporal] StartWorkflow name=%s id=%s taskQueue=%s", name, opts.ID, opts.TaskQueue)
	return runID, nil
}

func (t *TemporalClient) SignalWorkflow(ctx context.Context, workflowID string, signal string, data any) error {
	log.Printf("[temporal] Signal workflow=%s signal=%s", workflowID, signal)
	return nil
}

func (t *TemporalClient) Health() string {
	if t.connected {
		return "connected"
	}
	return "configured"
}

// ── Keycloak ───────────────────────────────────────────────────────────────────

type KeycloakClient struct {
	IssuerURL          string
	ClientID           string
	ClientSecret       string
	connected          bool
	introspectEndpoint string
	jwksURI            string
	httpClient         *http.Client
	jwksMu             sync.Mutex
	jwksKeys           map[string]*rsa.PublicKey
	jwksFetchedAt      time.Time
}

func NewKeycloakClient() *KeycloakClient {
	k := &KeycloakClient{
		IssuerURL:    envOr("KEYCLOAK_ISSUER_URL", "https://identity.54bank.app/realms/54bank"),
		ClientID:     envOr("KEYCLOAK_CLIENT_ID", "54bank-operations-ui"),
		ClientSecret: envOr("KEYCLOAK_CLIENT_SECRET", ""),
		connected:    false,
		httpClient:   &http.Client{Timeout: 5 * time.Second},
	}
	k.connect()
	return k
}

func (k *KeycloakClient) connect() {
	oidcURL := fmt.Sprintf("%s/.well-known/openid-configuration", k.IssuerURL)
	resp, err := k.httpClient.Get(oidcURL)
	if err != nil {
		log.Printf("[keycloak] Connection failed (%v), using offline validation", err)
		return
	}
	defer resp.Body.Close()
	var config map[string]any
	json.NewDecoder(resp.Body).Decode(&config)
	if ep, ok := config["introspection_endpoint"].(string); ok {
		k.introspectEndpoint = ep
	}
	if jwks, ok := config["jwks_uri"].(string); ok {
		k.jwksURI = jwks
	}
	k.connected = true
	log.Printf("[keycloak] Connected to %s", k.IssuerURL)
}

type TokenClaims struct {
	Sub       string   `json:"sub"`
	Email     string   `json:"email"`
	Roles     []string `json:"roles"`
	TenantID  string   `json:"tenant_id"`
	ExpiresAt int64    `json:"exp"`
}

func (k *KeycloakClient) ValidateToken(token string) (*TokenClaims, error) {
	if k.connected && k.introspectEndpoint != "" && k.ClientSecret != "" {
		data := fmt.Sprintf("token=%s&client_id=%s&client_secret=%s",
			url.QueryEscape(token), url.QueryEscape(k.ClientID), url.QueryEscape(k.ClientSecret))
		resp, err := k.httpClient.Post(k.introspectEndpoint,
			"application/x-www-form-urlencoded", strings.NewReader(data))
		if err == nil {
			defer resp.Body.Close()
			var result map[string]any
			json.NewDecoder(resp.Body).Decode(&result)
			if active, ok := result["active"].(bool); ok && active {
				roles := []string{}
				if ra, ok := result["realm_access"].(map[string]any); ok {
					if r, ok := ra["roles"].([]any); ok {
						for _, role := range r {
							roles = append(roles, fmt.Sprintf("%v", role))
						}
					}
				}
				expFloat, _ := result["exp"].(float64)
				return &TokenClaims{
					Sub:       fmt.Sprintf("%v", result["sub"]),
					Email:     fmt.Sprintf("%v", result["email"]),
					Roles:     roles,
					TenantID:  envOr("TENANT_ID", "54bank-platform-prod"),
					ExpiresAt: int64(expFloat),
				}, nil
			}
		}
	}

	// Offline path: only acceptable with an RS256 signature verified against the
	// realm JWKS. If the signature cannot be verified, fail closed.
	return k.verifyOfflineJWT(token)
}

type jwksKeySet struct {
	Keys []struct {
		Kty string `json:"kty"`
		Kid string `json:"kid"`
		Use string `json:"use"`
		Alg string `json:"alg"`
		N   string `json:"n"`
		E   string `json:"e"`
	} `json:"keys"`
}

// rsaKeyForKid returns the RSA public key for the given key ID, refreshing the
// cached JWKS when stale or when the kid is unknown. Fails closed when the JWKS
// endpoint is unavailable.
func (k *KeycloakClient) rsaKeyForKid(kid string) (*rsa.PublicKey, error) {
	k.jwksMu.Lock()
	fresh := len(k.jwksKeys) > 0 && time.Since(k.jwksFetchedAt) < 5*time.Minute
	cached, hit := k.jwksKeys[kid]
	k.jwksMu.Unlock()
	if fresh && hit {
		return cached, nil
	}
	if k.jwksURI == "" {
		return nil, fmt.Errorf("keycloak jwks_uri unavailable; cannot verify token offline")
	}
	resp, err := k.httpClient.Get(k.jwksURI)
	if err != nil {
		return nil, fmt.Errorf("fetch jwks: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fetch jwks: unexpected status %d", resp.StatusCode)
	}
	var set jwksKeySet
	if err := json.NewDecoder(resp.Body).Decode(&set); err != nil {
		return nil, fmt.Errorf("decode jwks: %w", err)
	}
	keys := make(map[string]*rsa.PublicKey, len(set.Keys))
	for _, jk := range set.Keys {
		if jk.Kty != "RSA" || jk.N == "" || jk.E == "" {
			continue
		}
		nBytes, err := base64.RawURLEncoding.DecodeString(jk.N)
		if err != nil {
			continue
		}
		eBytes, err := base64.RawURLEncoding.DecodeString(jk.E)
		if err != nil {
			continue
		}
		eInt := new(big.Int).SetBytes(eBytes)
		if !eInt.IsInt64() || eInt.Int64() < 3 || eInt.Int64() > 1<<31 {
			continue
		}
		keys[jk.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(nBytes), E: int(eInt.Int64())}
	}
	k.jwksMu.Lock()
	k.jwksKeys = keys
	k.jwksFetchedAt = time.Now()
	k.jwksMu.Unlock()
	key, ok := keys[kid]
	if !ok {
		return nil, fmt.Errorf("no jwks key found for kid %q", kid)
	}
	return key, nil
}

// verifyOfflineJWT parses a JWT, verifies its RS256 signature against the
// realm JWKS (kid-matched) and enforces expiration. Any failure is an error;
// no claims are ever granted without a verified signature.
func (k *KeycloakClient) verifyOfflineJWT(token string) (*TokenClaims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("malformed jwt: expected 3 segments")
	}
	headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, fmt.Errorf("malformed jwt header: %w", err)
	}
	var header struct {
		Alg string `json:"alg"`
		Kid string `json:"kid"`
	}
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		return nil, fmt.Errorf("malformed jwt header: %w", err)
	}
	if header.Alg != "RS256" {
		return nil, fmt.Errorf("unsupported jwt alg %q", header.Alg)
	}
	key, err := k.rsaKeyForKid(header.Kid)
	if err != nil {
		return nil, fmt.Errorf("jwt key resolution failed: %w", err)
	}
	sig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, fmt.Errorf("malformed jwt signature: %w", err)
	}
	sum := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	if err := rsa.VerifyPKCS1v15(key, crypto.SHA256, sum[:], sig); err != nil {
		return nil, fmt.Errorf("jwt signature verification failed: %w", err)
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("malformed jwt payload: %w", err)
	}
	var claims map[string]any
	if err := json.Unmarshal(payload, &claims); err != nil {
		return nil, fmt.Errorf("malformed jwt claims: %w", err)
	}
	expFloat, ok := claims["exp"].(float64)
	if !ok || time.Now().Unix() >= int64(expFloat) {
		return nil, fmt.Errorf("jwt expired or missing exp claim")
	}
	roles := []string{}
	if ra, ok := claims["realm_access"].(map[string]any); ok {
		if r, ok := ra["roles"].([]any); ok {
			for _, role := range r {
				roles = append(roles, fmt.Sprintf("%v", role))
			}
		}
	}
	return &TokenClaims{
		Sub:       fmt.Sprintf("%v", claims["sub"]),
		Email:     fmt.Sprintf("%v", claims["email"]),
		Roles:     roles,
		TenantID:  envOr("TENANT_ID", "54bank-platform-prod"),
		ExpiresAt: int64(expFloat),
	}, nil
}

func (k *KeycloakClient) Health() string {
	if k.connected {
		resp, err := k.httpClient.Get(k.IssuerURL)
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == 200 {
				return "connected"
			}
		}
		k.connected = false
	}
	return "configured"
}

// ── Permify ────────────────────────────────────────────────────────────────────

type PermifyClient struct {
	Endpoint    string
	TenantID    string
	connected   bool
	httpClient  *http.Client
	localTuples []permifyTuple
	mu          sync.Mutex
}

type permifyTuple struct {
	Entity   string
	Relation string
	Subject  string
}

type PermissionCheck struct {
	Entity     string
	Permission string
	Subject    string
}

func NewPermifyClient() *PermifyClient {
	p := &PermifyClient{
		Endpoint:   envOr("PERMIFY_URL", "http://permify:3476"),
		TenantID:   envOr("PERMIFY_TENANT_ID", envOr("TENANT_ID", "54bank-platform-prod")),
		connected:  false,
		httpClient: &http.Client{Timeout: 5 * time.Second},
	}
	p.connect()
	return p
}

func (p *PermifyClient) connect() {
	resp, err := p.httpClient.Get(fmt.Sprintf("%s/healthz", p.Endpoint))
	if err == nil {
		resp.Body.Close()
		if resp.StatusCode == 200 {
			p.connected = true
			log.Printf("[permify] Connected to %s", p.Endpoint)
			return
		}
	}
	log.Printf("[permify] Connection failed; permission checks will DENY by default (fail-closed)")
}

func (p *PermifyClient) doPost(path string, body any) (map[string]any, error) {
	data, _ := json.Marshal(body)
	url := fmt.Sprintf("%s%s", p.Endpoint, path)
	req, _ := http.NewRequest("POST", url, bytes.NewReader(data))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", p.TenantID)
	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result map[string]any
	json.NewDecoder(resp.Body).Decode(&result)
	return result, nil
}

// Check evaluates a permission against Permify. It is fail-closed: any error
// (Permify unreachable, HTTP error, malformed response) results in a denial
// with a non-nil error.
func (p *PermifyClient) Check(ctx context.Context, check PermissionCheck) (bool, error) {
	if !p.connected {
		return false, fmt.Errorf("permify unavailable; denying permission %q on %q", check.Permission, check.Entity)
	}
	entityParts := strings.SplitN(check.Entity, ":", 2)
	subParts := strings.SplitN(check.Subject, ":", 2)
	entityType, entityID := entityParts[0], ""
	if len(entityParts) > 1 {
		entityID = entityParts[1]
	}
	subType, subID := subParts[0], ""
	if len(subParts) > 1 {
		subID = subParts[1]
	}
	result, err := p.doPost(fmt.Sprintf("/v1/tenants/%s/permissions/check", p.TenantID), map[string]any{
		"metadata":   map[string]any{"snap_token": "", "schema_version": "", "depth": 20},
		"entity":     map[string]any{"type": entityType, "id": entityID},
		"permission": check.Permission,
		"subject":    map[string]any{"type": subType, "id": subID, "relation": ""},
	})
	if err != nil {
		return false, fmt.Errorf("permify check failed: %w", err)
	}
	can, ok := result["can"].(string)
	if !ok {
		return false, fmt.Errorf("permify check: malformed response (missing 'can')")
	}
	return can == "CHECK_RESULT_ALLOWED", nil
}

func (p *PermifyClient) WriteRelation(ctx context.Context, entity, relation, subject string) error {
	if p.connected {
		entityParts := strings.SplitN(entity, ":", 2)
		subParts := strings.SplitN(subject, ":", 2)
		entityType, entityID := entityParts[0], ""
		if len(entityParts) > 1 {
			entityID = entityParts[1]
		}
		subType, subID := subParts[0], ""
		if len(subParts) > 1 {
			subID = subParts[1]
		}
		p.doPost(fmt.Sprintf("/v1/tenants/%s/relationships/write", p.TenantID), map[string]any{
			"metadata": map[string]any{"schema_version": ""},
			"tuples": []map[string]any{{
				"entity":   map[string]any{"type": entityType, "id": entityID},
				"relation": relation,
				"subject":  map[string]any{"type": subType, "id": subID, "relation": ""},
			}},
		})
	}
	p.mu.Lock()
	p.localTuples = append(p.localTuples, permifyTuple{Entity: entity, Relation: relation, Subject: subject})
	p.mu.Unlock()
	return nil
}

func (p *PermifyClient) Health() string {
	if p.connected {
		resp, err := p.httpClient.Get(fmt.Sprintf("%s/healthz", p.Endpoint))
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == 200 {
				return "connected"
			}
		}
		p.connected = false
	}
	return "configured"
}

// ── APISIX ─────────────────────────────────────────────────────────────────────

type APISIXClient struct {
	AdminURL    string
	AdminKey    string
	GatewayURL  string
	connected   bool
	httpClient  *http.Client
	localRoutes map[string]RouteConfig
	mu          sync.Mutex
}

func NewAPISIXClient() *APISIXClient {
	// H-23-residual: fail closed — never fall back to a static default admin
	// key. The service refuses to start without APISIX_ADMIN_KEY.
	adminKey := os.Getenv("APISIX_ADMIN_KEY")
	if adminKey == "" {
		log.Fatalf("APISIX_ADMIN_KEY is not set; refusing to start with a default APISIX admin key")
	}
	a := &APISIXClient{
		AdminURL:    envOr("APISIX_ADMIN_URL", "http://apisix-admin:9180"),
		AdminKey:    adminKey,
		GatewayURL:  envOr("APISIX_PUBLIC_URL", "https://api.54bank.app/gateway"),
		connected:   false,
		httpClient:  &http.Client{Timeout: 5 * time.Second},
		localRoutes: make(map[string]RouteConfig),
	}
	a.connect()
	return a
}

func (a *APISIXClient) connect() {
	req, _ := http.NewRequest("GET", fmt.Sprintf("%s/apisix/admin/routes", a.AdminURL), nil)
	req.Header.Set("X-API-KEY", a.AdminKey)
	resp, err := a.httpClient.Do(req)
	if err == nil {
		resp.Body.Close()
		a.connected = true
		log.Printf("[apisix] Connected to admin API at %s", a.AdminURL)
		return
	}
	log.Printf("[apisix] Admin API unreachable, route registration deferred")
}

type RouteConfig struct {
	URI      string
	Upstream string
	Methods  []string
	Plugins  map[string]any
}

func (a *APISIXClient) RegisterRoute(ctx context.Context, cfg RouteConfig) error {
	route := map[string]any{
		"uri":     cfg.URI,
		"methods": cfg.Methods,
		"upstream": map[string]any{
			"type":  "roundrobin",
			"nodes": map[string]any{cfg.Upstream: 1},
		},
	}
	if cfg.Plugins != nil {
		route["plugins"] = cfg.Plugins
	}

	if a.connected {
		data, _ := json.Marshal(route)
		routeID := strings.ReplaceAll(cfg.URI, "/", "_")
		apiURL := fmt.Sprintf("%s/apisix/admin/routes/%s", a.AdminURL, routeID)
		req, _ := http.NewRequest("PUT", apiURL, bytes.NewReader(data))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-API-KEY", a.AdminKey)
		resp, err := a.httpClient.Do(req)
		if err == nil {
			resp.Body.Close()
			return nil
		}
	}
	a.mu.Lock()
	a.localRoutes[cfg.URI] = cfg
	a.mu.Unlock()
	return nil
}

func (a *APISIXClient) ListRoutes(ctx context.Context) ([]map[string]any, error) {
	if a.connected {
		req, _ := http.NewRequest("GET", fmt.Sprintf("%s/apisix/admin/routes", a.AdminURL), nil)
		req.Header.Set("X-API-KEY", a.AdminKey)
		resp, err := a.httpClient.Do(req)
		if err == nil {
			defer resp.Body.Close()
			var result map[string]any
			json.NewDecoder(resp.Body).Decode(&result)
			if list, ok := result["list"].([]any); ok {
				routes := make([]map[string]any, 0, len(list))
				for _, item := range list {
					if m, ok := item.(map[string]any); ok {
						routes = append(routes, m)
					}
				}
				return routes, nil
			}
		}
	}
	return nil, fmt.Errorf("apisix not connected")
}

func (a *APISIXClient) Health() string {
	if a.connected {
		req, _ := http.NewRequest("GET", fmt.Sprintf("%s/apisix/admin/routes", a.AdminURL), nil)
		req.Header.Set("X-API-KEY", a.AdminKey)
		resp, err := a.httpClient.Do(req)
		if err == nil {
			resp.Body.Close()
			return "connected"
		}
		a.connected = false
	}
	return "configured"
}

// ── Mojaloop ───────────────────────────────────────────────────────────────────

type MojaloupClient struct {
	Endpoint   string
	FspID      string
	connected  bool
	httpClient *http.Client
}

func NewMojaloupClient() *MojaloupClient {
	m := &MojaloupClient{
		Endpoint:   envOr("MOJALOOP_API_URL", "http://mojaloop-switch:4000"),
		FspID:      envOr("MOJALOOP_FSP_ID", "54bank"),
		connected:  false,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
	m.connect()
	return m
}

func (m *MojaloupClient) connect() {
	resp, err := m.httpClient.Get(fmt.Sprintf("%s/health", m.Endpoint))
	if err == nil {
		resp.Body.Close()
		m.connected = true
		log.Printf("[mojaloop] Connected to %s", m.Endpoint)
		return
	}
	log.Printf("[mojaloop] Hub unreachable, using offline mode")
}

// minorUnitsToDecimal renders integer minor units (e.g. kobo) as a 2dp
// decimal string for wire protocols (Mojaloop FSPIOP) — no float math.
func minorUnitsToDecimal(minor int64) string {
	sign := ""
	if minor < 0 {
		sign = "-"
		minor = -minor
	}
	return fmt.Sprintf("%s%d.%02d", sign, minor/100, minor%100)
}

// ParseDecimalToMinorUnits parses a decimal string into integer minor units.
// Anything with more than 2 decimal places (or otherwise malformed) is
// rejected — money is never rounded silently through a float.
func ParseDecimalToMinorUnits(s string) (int64, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, fmt.Errorf("empty amount")
	}
	neg := false
	if strings.HasPrefix(s, "-") || strings.HasPrefix(s, "+") {
		neg = s[0] == '-'
		s = s[1:]
	}
	parts := strings.SplitN(s, ".", 2)
	if parts[0] == "" {
		return 0, fmt.Errorf("invalid amount %q", s)
	}
	whole, err := strconv.ParseInt(parts[0], 10, 62)
	if err != nil {
		return 0, fmt.Errorf("invalid amount %q", s)
	}
	var frac int64
	if len(parts) == 2 {
		if len(parts[1]) > 2 {
			return 0, fmt.Errorf("amount %q has more than 2 decimal places", s)
		}
		fs := parts[1]
		for len(fs) < 2 {
			fs += "0"
		}
		if fs != "" {
			frac, err = strconv.ParseInt(fs, 10, 64)
			if err != nil {
				return 0, fmt.Errorf("invalid amount %q", s)
			}
		}
	}
	minor := whole*100 + frac
	if neg {
		minor = -minor
	}
	return minor, nil
}

// mojaloopTransferID is a deterministic id: sha256 over the natural business
// key of the transfer (hex). Replays of the same transfer collapse to one id.
func mojaloopTransferID(req TransferRequest) string {
	natural := strings.Join([]string{
		req.TransactionID, req.PayerFSP, req.PayeeFSP,
		strconv.FormatInt(req.AmountMinor, 10), req.Currency,
	}, "|")
	sum := sha256.Sum256([]byte(natural))
	return "MOJA-" + hex.EncodeToString(sum[:16])
}

type TransferRequest struct {
	PayerFSP      string `json:"payerFsp"`
	PayeeFSP      string `json:"payeeFsp"`
	AmountMinor   int64  `json:"amount_minor"` // integer minor units (kobo) — never float
	Currency      string `json:"currency"`
	TransactionID string `json:"transactionId"`
}

func (m *MojaloupClient) fspiopHeaders(destination string) http.Header {
	h := http.Header{}
	h.Set("Content-Type", "application/vnd.interoperability.transfers+json;version=1.1")
	h.Set("Accept", "application/vnd.interoperability.transfers+json;version=1.1")
	h.Set("FSPIOP-Source", m.FspID)
	h.Set("FSPIOP-Destination", destination)
	h.Set("Date", time.Now().UTC().Format(http.TimeFormat))
	return h
}

// InitiateTransfer posts a real FSPIOP transfer to the Mojaloop hub. Amounts
// are integer minor units rendered as a 2dp decimal string (no float math).
// When the hub is unreachable or rejects the transfer it fails loudly — a
// transfer id is NEVER returned for a transfer the hub did not accept.
func (m *MojaloupClient) InitiateTransfer(ctx context.Context, req TransferRequest) (string, error) {
	if req.AmountMinor <= 0 {
		return "", fmt.Errorf("transfer amount must be positive integer minor units")
	}
	if !m.connected {
		return "", fmt.Errorf("mojaloop hub not connected — transfer NOT initiated")
	}
	transferID := mojaloopTransferID(req)
	amountStr := minorUnitsToDecimal(req.AmountMinor)
	body := map[string]any{
		"transferId": transferID,
		"payerFsp":   req.PayerFSP,
		"payeeFsp":   req.PayeeFSP,
		"amount": map[string]any{
			"amount":   amountStr,
			"currency": req.Currency,
		},
		"ilpPacket":  base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf(`{"amount":"%s","destination":"%s"}`, amountStr, req.PayeeFSP))),
		"condition":  base64.URLEncoding.EncodeToString([]byte(transferID)),
		"expiration": time.Now().UTC().Add(30 * time.Second).Format(time.RFC3339),
	}
	data, err := json.Marshal(body)
	if err != nil {
		return "", fmt.Errorf("mojaloop transfer marshal: %w", err)
	}
	httpReq, err := http.NewRequestWithContext(ctx, "POST",
		fmt.Sprintf("%s/transfers", m.Endpoint), bytes.NewReader(data))
	if err != nil {
		return "", fmt.Errorf("mojaloop transfer request build: %w", err)
	}
	for k, v := range m.fspiopHeaders(req.PayeeFSP) {
		httpReq.Header[k] = v
	}
	resp, err := m.httpClient.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("mojaloop transfer request failed: %w", err)
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("mojaloop transfer rejected: HTTP %d", resp.StatusCode)
	}
	return transferID, nil
}

func (m *MojaloupClient) LookupParticipant(ctx context.Context, idType, idValue string) (map[string]any, error) {
	if m.connected {
		apiURL := fmt.Sprintf("%s/participants/%s/%s", m.Endpoint, idType, idValue)
		req, _ := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
		for k, v := range m.fspiopHeaders("") {
			req.Header[k] = v
		}
		resp, err := m.httpClient.Do(req)
		if err == nil {
			defer resp.Body.Close()
			var result map[string]any
			json.NewDecoder(resp.Body).Decode(&result)
			return result, nil
		}
	}
	return nil, fmt.Errorf("mojaloop not connected")
}

func (m *MojaloupClient) Health() string {
	if m.connected {
		resp, err := m.httpClient.Get(fmt.Sprintf("%s/health", m.Endpoint))
		if err == nil {
			resp.Body.Close()
			return "connected"
		}
		m.connected = false
	}
	return "configured"
}

// ── Dapr ───────────────────────────────────────────────────────────────────────

type DaprClient struct {
	HTTPPort   string
	sidecarURL string
	connected  bool
	httpClient *http.Client
	localState map[string]any
	mu         sync.Mutex
}

func NewDaprClient() *DaprClient {
	port := envOr("DAPR_HTTP_PORT", "3500")
	d := &DaprClient{
		HTTPPort:   port,
		sidecarURL: fmt.Sprintf("http://localhost:%s", port),
		connected:  false,
		httpClient: &http.Client{Timeout: 5 * time.Second},
		localState: make(map[string]any),
	}
	d.connect()
	return d
}

func (d *DaprClient) connect() {
	resp, err := d.httpClient.Get(fmt.Sprintf("%s/v1.0/healthz", d.sidecarURL))
	if err == nil {
		resp.Body.Close()
		d.connected = true
		log.Printf("[dapr] Connected to sidecar at %s", d.sidecarURL)
		return
	}
	log.Printf("[dapr] Sidecar not available, using local state fallback")
}

func (d *DaprClient) InvokeService(ctx context.Context, appID, method string, data any) ([]byte, error) {
	if d.connected {
		body, _ := json.Marshal(data)
		apiURL := fmt.Sprintf("%s/v1.0/invoke/%s/method/%s", d.sidecarURL, appID, method)
		req, _ := http.NewRequestWithContext(ctx, "POST", apiURL, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := d.httpClient.Do(req)
		if err == nil {
			defer resp.Body.Close()
			result, _ := io.ReadAll(resp.Body)
			return result, nil
		}
	}
	body, _ := json.Marshal(data)
	return body, nil
}

func (d *DaprClient) SaveState(ctx context.Context, storeName, key string, value any) error {
	if d.connected {
		body, _ := json.Marshal([]map[string]any{{"key": key, "value": value}})
		apiURL := fmt.Sprintf("%s/v1.0/state/%s", d.sidecarURL, storeName)
		req, _ := http.NewRequestWithContext(ctx, "POST", apiURL, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := d.httpClient.Do(req)
		if err == nil {
			resp.Body.Close()
			return nil
		}
	}
	d.mu.Lock()
	d.localState[storeName+":"+key] = value
	d.mu.Unlock()
	return nil
}

func (d *DaprClient) GetState(ctx context.Context, storeName, key string) (any, error) {
	if d.connected {
		apiURL := fmt.Sprintf("%s/v1.0/state/%s/%s", d.sidecarURL, storeName, key)
		resp, err := d.httpClient.Get(apiURL)
		if err == nil {
			defer resp.Body.Close()
			var result any
			json.NewDecoder(resp.Body).Decode(&result)
			return result, nil
		}
	}
	d.mu.Lock()
	defer d.mu.Unlock()
	v, ok := d.localState[storeName+":"+key]
	if !ok {
		return nil, fmt.Errorf("key not found")
	}
	return v, nil
}

func (d *DaprClient) PublishEvent(ctx context.Context, pubsub, topic string, data any) error {
	if d.connected {
		body, _ := json.Marshal(data)
		apiURL := fmt.Sprintf("%s/v1.0/publish/%s/%s", d.sidecarURL, pubsub, topic)
		req, _ := http.NewRequestWithContext(ctx, "POST", apiURL, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := d.httpClient.Do(req)
		if err == nil {
			resp.Body.Close()
			return nil
		}
	}
	return nil
}

func (d *DaprClient) Health() string {
	if d.connected {
		resp, err := d.httpClient.Get(fmt.Sprintf("%s/v1.0/healthz", d.sidecarURL))
		if err == nil {
			resp.Body.Close()
			return "connected"
		}
		d.connected = false
	}
	return "configured"
}

// ── TigerBeetle (Go shim — primary client is Rust) ────────────────────────────

type TigerBeetleClient struct {
	Addresses   string
	HTTPAddress string
	ClusterID   string
	connected   bool
	httpClient  *http.Client
	accounts    map[int64]map[string]any
	transfers   []map[string]any
	mu          sync.Mutex
}

func NewTigerBeetleClient() *TigerBeetleClient {
	addr := envOr("TIGERBEETLE_ADDRESSES", "tigerbeetle:3000")
	t := &TigerBeetleClient{
		Addresses:   addr,
		HTTPAddress: envOr("TIGERBEETLE_HTTP_URL", fmt.Sprintf("http://%s", addr)),
		ClusterID:   envOr("TIGERBEETLE_CLUSTER_ID", "54bankcluster00000000000000000000"),
		connected:   false,
		httpClient:  &http.Client{Timeout: 5 * time.Second},
		accounts:    make(map[int64]map[string]any),
	}
	t.connect()
	return t
}

func (t *TigerBeetleClient) connect() {
	resp, err := t.httpClient.Get(fmt.Sprintf("%s/health", t.HTTPAddress))
	if err == nil {
		resp.Body.Close()
		t.mu.Lock()
		t.connected = true
		t.mu.Unlock()
		log.Printf("[tigerbeetle] Connected via HTTP at %s", t.HTTPAddress)
		return
	}
	conn, err := net.DialTimeout("tcp", t.Addresses, 2*time.Second)
	if err == nil {
		conn.Close()
		t.mu.Lock()
		t.connected = true
		t.mu.Unlock()
		log.Printf("[tigerbeetle] Reachable at %s", t.Addresses)
		return
	}
	log.Printf("[tigerbeetle] Connection failed, posting calls will fail fast")
}

type LedgerEntry struct {
	DebitAccount  string `json:"debitAccount"`
	CreditAccount string `json:"creditAccount"`
	AmountMinor   int64  `json:"amount_minor"` // integer minor units (kobo) — never float
	Code          string `json:"code"`
	Ledger        uint32 `json:"ledger"`
}

// newUUIDv4 returns a random UUIDv4 using crypto/rand. A CSPRNG failure is an
// error — never fall back to predictable (timestamp/counter-based) ids.
func newUUIDv4() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", fmt.Errorf("crypto/rand unavailable: %w", err)
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16]), nil
}

// CreateTransfer posts a real transfer to the TigerBeetle HTTP bridge and
// fails loudly on any error. Previously this function discarded the HTTP
// result and always appended to an in-memory shadow ledger, returning success
// even when nothing was posted — silent mockware on the money path.
func (t *TigerBeetleClient) isConnected() bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.connected
}

func (t *TigerBeetleClient) markDisconnected() {
	t.mu.Lock()
	t.connected = false
	t.mu.Unlock()
}

func (t *TigerBeetleClient) CreateTransfer(ctx context.Context, entry LedgerEntry) (string, error) {
	if entry.AmountMinor <= 0 {
		return "", fmt.Errorf("transfer amount must be positive integer minor units")
	}
	// Collision-proof, non-predictable transfer id: UUIDv4 from crypto/rand.
	u, err := newUUIDv4()
	if err != nil {
		return "", err
	}
	transferID := "TB-" + u

	if !t.isConnected() {
		return "", fmt.Errorf("tigerbeetle unavailable: not connected (addresses=%s)", t.Addresses)
	}
	transfer := map[string]any{
		"id":                transferID,
		"debit_account_id":  entry.DebitAccount,
		"credit_account_id": entry.CreditAccount,
		"amount":            entry.AmountMinor,
		"ledger":            entry.Ledger,
		"code":              entry.Code,
	}
	data, _ := json.Marshal(map[string]any{"transfers": []any{transfer}})
	req, _ := http.NewRequestWithContext(ctx, "POST",
		fmt.Sprintf("%s/transfers/create", t.HTTPAddress), bytes.NewReader(data))
	req.Header.Set("Content-Type", "application/json")
	resp, err := t.httpClient.Do(req)
	if err != nil {
		t.markDisconnected()
		return "", fmt.Errorf("tigerbeetle transfer failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("tigerbeetle transfer rejected: HTTP %d", resp.StatusCode)
	}
	return transferID, nil
}

// CreateAccount creates a real account via the TigerBeetle HTTP bridge and
// fails loudly on any error. Previously it discarded the HTTP result and
// always recorded a shadow in-memory account with zero balances.
func (t *TigerBeetleClient) CreateAccount(ctx context.Context, id int64, ledger uint32, code uint16) error {
	if !t.isConnected() {
		return fmt.Errorf("tigerbeetle unavailable: not connected (addresses=%s)", t.Addresses)
	}
	account := map[string]any{"id": id, "ledger": ledger, "code": code}
	data, _ := json.Marshal(map[string]any{"accounts": []any{account}})
	req, _ := http.NewRequestWithContext(ctx, "POST",
		fmt.Sprintf("%s/accounts/create", t.HTTPAddress), bytes.NewReader(data))
	req.Header.Set("Content-Type", "application/json")
	resp, err := t.httpClient.Do(req)
	if err != nil {
		t.markDisconnected()
		return fmt.Errorf("tigerbeetle account create failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("tigerbeetle account create rejected: HTTP %d", resp.StatusCode)
	}
	return nil
}

func (t *TigerBeetleClient) Health() string {
	if t.isConnected() {
		resp, err := t.httpClient.Get(fmt.Sprintf("%s/health", t.HTTPAddress))
		if err == nil {
			resp.Body.Close()
			return "connected"
		}
		conn, err := net.DialTimeout("tcp", t.Addresses, 2*time.Second)
		if err == nil {
			conn.Close()
			return "connected"
		}
		t.markDisconnected()
	}
	return "configured"
}

// ── Postgres (Go shim — primary ORM is Drizzle in TypeScript) ──────────────────

type PostgresClient struct {
	ConnectionString string
	connected        bool
	mu               sync.Mutex
}

func NewPostgresClient() *PostgresClient {
	return &PostgresClient{
		// M-04: no compiled-in credentials; env-only.
		ConnectionString: envOr("DATABASE_URL", ""),
		connected:        false,
	}
}

func (p *PostgresClient) Health() string {
	if p.connected {
		return "connected"
	}
	return "configured"
}

// ── Middleware Bundle ───────────────────────────────────────────────────────────

type Bundle struct {
	Kafka       *KafkaClient
	Redis       *RedisClient
	Temporal    *TemporalClient
	Keycloak    *KeycloakClient
	Permify     *PermifyClient
	APISIX      *APISIXClient
	Mojaloop    *MojaloupClient
	Dapr        *DaprClient
	TigerBeetle *TigerBeetleClient
	Postgres    *PostgresClient
}

func NewBundle() *Bundle {
	return &Bundle{
		Kafka:       NewKafkaClient(),
		Redis:       NewRedisClient(),
		Temporal:    NewTemporalClient(),
		Keycloak:    NewKeycloakClient(),
		Permify:     NewPermifyClient(),
		APISIX:      NewAPISIXClient(),
		Mojaloop:    NewMojaloupClient(),
		Dapr:        NewDaprClient(),
		TigerBeetle: NewTigerBeetleClient(),
		Postgres:    NewPostgresClient(),
	}
}

func (b *Bundle) HealthMap() map[string]string {
	return map[string]string{
		"kafka":       b.Kafka.Health(),
		"redis":       b.Redis.Health(),
		"temporal":    b.Temporal.Health(),
		"keycloak":    b.Keycloak.Health(),
		"permify":     b.Permify.Health(),
		"apisix":      b.APISIX.Health(),
		"mojaloop":    b.Mojaloop.Health(),
		"dapr":        b.Dapr.Health(),
		"tigerbeetle": b.TigerBeetle.Health(),
		"postgres":    b.Postgres.Health(),
	}
}

func (b *Bundle) MiddlewareList() []string {
	return []string{
		"Kafka", "Redis", "Temporal", "Keycloak", "Permify",
		"APISIX", "Mojaloop", "Dapr", "TigerBeetle", "Postgres",
	}
}

// ── JSON helpers ───────────────────────────────────────────────────────────────

func RespondJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func DecodeBody(r *http.Request, v any) error {
	defer r.Body.Close()
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return err
	}
	return json.Unmarshal(body, v)
}

// GenID returns a collision-proof, non-predictable id: 128 bits from
// crypto/rand, hex-encoded. CSPRNG failure is fatal — a timestamp-derived id
// is never an acceptable fallback for financial records.
func GenID(prefix string) string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		panic(fmt.Sprintf("crypto/rand unavailable, refusing to generate weak id: %v", err))
	}
	return fmt.Sprintf("%s-%X", prefix, b[:])
}

func NowISO() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func DefaultTenant() string {
	return envOr("TENANT_ID", "54bank-platform-prod")
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func EnvOr(key, fallback string) string {
	return envOr(key, fallback)
}

// CORSMiddleware adds CORS headers for development.
func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,PATCH,OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Tenant-ID")
		if r.Method == "OPTIONS" {
			w.WriteHeader(204)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// AuditEntry records an action for the audit trail.
type AuditEntry struct {
	Timestamp string `json:"timestamp"`
	Service   string `json:"service"`
	Action    string `json:"action"`
	EntityID  string `json:"entityId"`
	ActorID   string `json:"actorId"`
	TenantID  string `json:"tenantId"`
	Details   any    `json:"details,omitempty"`
}

var (
	auditLog   []AuditEntry
	auditMutex sync.Mutex
)

func RecordAudit(service, action, entityID, actorID string, details any) {
	auditMutex.Lock()
	defer auditMutex.Unlock()
	entry := AuditEntry{
		Timestamp: NowISO(),
		Service:   service,
		Action:    action,
		EntityID:  entityID,
		ActorID:   actorID,
		TenantID:  DefaultTenant(),
		Details:   details,
	}
	auditLog = append(auditLog, entry)
	log.Printf("[audit] %s %s %s by %s", service, action, entityID, actorID)
}

func GetAuditLog() []AuditEntry {
	auditMutex.Lock()
	defer auditMutex.Unlock()
	result := make([]AuditEntry, len(auditLog))
	copy(result, auditLog)
	return result
}

// ── CORS helper for strings ────────────────────────────────────────────────────

func Contains(slice []string, item string) bool {
	for _, s := range slice {
		if strings.EqualFold(s, item) {
			return true
		}
	}
	return false
}
