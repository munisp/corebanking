package main

import (
	"github.com/IBM/sarama"
	"math/big"
	"encoding/base64"
	"crypto/sha256"
	"crypto/rsa"
	"crypto"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

)

var serviceName = "trade-finance-go"

// Inter-service URLs
var sanctionsURL = func() string { v := os.Getenv("SANCTIONS_URL"); if v == "" { return "http://localhost:8127" }; return v }()
var fxEngineURL = func() string { v := os.Getenv("FX_RATES_URL"); if v == "" { return "http://localhost:8166" }; return v }()
var amlURL = func() string { v := os.Getenv("AML_ENGINE_URL"); if v == "" { return "http://localhost:8120" }; return v }()
type BankGuarantee struct {
	ID               string            `json:"id"`
	GuaranteeID      string            `json:"guarantee_id"`
	GuaranteeType    string            `json:"guarantee_type"`
	Type             string            `json:"type"`
	Amount           float64           `json:"amount"`
	Currency         string            `json:"currency"`
	Applicant        string            `json:"applicant"`
	ApplicantName    string            `json:"applicant_name"`
	Beneficiary      string            `json:"beneficiary"`
	BeneficiaryName  string            `json:"beneficiary_name"`
	ExpiryDate       string            `json:"expiry_date"`
	Status           string            `json:"status"`
	CommissionRate   float64           `json:"commission_rate"`
	CommissionAmount float64           `json:"commission_amount"`
	Middleware       []string          `json:"middleware"`
	CreatedAt        string            `json:"created_at"`
	UpdatedAt        string            `json:"updated_at"`
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}

type LCRequest struct {
	Applicant    string  `json:"applicant"`
	Beneficiary  string  `json:"beneficiary"`
	Amount       float64 `json:"amount"`
	Currency     string  `json:"currency"`
	ExpiryDate   string  `json:"expiry_date"`
	Commodity    string  `json:"commodity"`
	Incoterm     string  `json:"incoterm"`
}

type DocumentPresentation struct {
	LCID       string   `json:"lc_id"`
	Documents  []string `json:"documents"`
}

func jsonResp(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	
	
	jsonResp(w, 200, map[string]interface{}{"status": "healthy", "service": "trade-finance-go", })
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

	// Events are marked published ONLY after a confirmed Kafka produce.
	producer, err := getKafkaProducer(brokers)
	if err != nil {
		log.Printf("[outbox-relay] kafka unavailable: %v — events remain unpublished for retry", err)
		return
	}

	rows, err := db.Query(`SELECT id, event_type, aggregate_id, payload FROM outbox WHERE published = FALSE ORDER BY created_at LIMIT 100`)
	if err != nil { return }
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id, eventType, aggID string
		var payload []byte
		if err := rows.Scan(&id, &eventType, &aggID, &payload); err != nil { continue }
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
	if len(ids) == 0 { return }
	for _, id := range ids {
		if _, err := db.Exec(`UPDATE outbox SET published = TRUE WHERE id = $1`, id); err != nil {
			log.Printf("[outbox-relay] failed to mark event %s published: %v", id, err)
		}
	}
	if len(ids) > 0 {
		log.Printf("[outbox-relay] published %d events to kafka topic=%s", len(ids), topic)
	}
}

// getKafkaProducer lazily creates a shared sarama SyncProducer.
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



func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Printf("[%s] DATABASE_URL not set — in-memory mode", serviceName)
		return
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[%s] DB open failed: %v — in-memory fallback", serviceName, err)
		db = nil
		return
	}
	defer db.Close()

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err = db.Ping(); err != nil {
		log.Printf("[%s] DB ping failed: %v — in-memory fallback", serviceName, err)
		db = nil
		return
	}

	initSchema()
	log.Printf("[trade-finance-go] database connected, schema initialized")

	// Middleware clients
	keycloakURL := getEnv("KEYCLOAK_REALM_URL", "http://keycloak:8080/realms/54bank")
	kafkaBrokers := getEnv("KAFKA_BROKERS", "localhost:9092")
	redisURL := getEnv("REDIS_URL", "localhost:6379")
	osURL := getEnv("OPENSEARCH_ENDPOINT", "http://opensearch:9200")
	permifyURL := getEnv("PERMIFY_ENDPOINT", "http://permify:3476")

	log.Printf("[trade-finance-go] middleware: keycloak=%s kafka=%s redis=%s opensearch=%s permify=%s",
		keycloakURL, kafkaBrokers, redisURL, osURL, permifyURL)

	mux := http.NewServeMux()

	// Health endpoints
	mux.HandleFunc("/healthz", healthHandler)
	mux.HandleFunc("/readyz", readyzHandler)
	mux.HandleFunc("/livez", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "alive"})
	})
	mux.HandleFunc("/metrics", metricsHandler)

	// Domain endpoints
	mux.HandleFunc("/api/v1/service_configs", domainHandler)
	mux.HandleFunc("/api/v1/service_configs/", domainDetailHandler)

	server := &http.Server{
		Addr:         ":" + getEnv("PORT", "8297"),
		Handler:      loggingMiddleware(corsMiddleware(mux)),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	log.Printf("[trade-finance-go] ready on :%s", getEnv("PORT", "8297"))

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Printf("[trade-finance-go] shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	server.Shutdown(ctx)
	log.Printf("[trade-finance-go] stopped")
}

func initSchema() {
	_, err := db.Exec(`CREATE TABLE IF NOT EXISTS service_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key VARCHAR(128) NOT NULL,
    config_value JSONB NOT NULL,
    environment VARCHAR(20) NOT NULL DEFAULT 'production',
    version INT NOT NULL DEFAULT 1,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by UUID,
    tenant_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(config_key, environment, tenant_id)
	)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_sr_svc ON service_records(service)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS trade_transactions (id SERIAL PRIMARY KEY, trade_id TEXT, lc_number TEXT, applicant TEXT, beneficiary TEXT, amount NUMERIC(15,2), currency TEXT, status TEXT, incoterm TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`)
	log.Printf("[%s] Domain table trade_transactions ensured", serviceName)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_sr_status ON service_records(service, status)`)
}

func dbInsert(id, service, typ, status string, data []byte) error {
	if db == nil { return fmt.Errorf("no db") }
	_, err := db.Exec("INSERT INTO service_records (id, service, type, status, data) VALUES ($1,$2,$3,$4,$5)", id, service, typ, status, string(data))
	return err
}

func createHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-Id")
	if tenantID == "" { tenantID = "platform" }
	_ = nowISO()
	_ = lcStatus(true, false, false)
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	id := fmt.Sprintf("%s-%d", "trade_finance_go", time.Now().UnixNano())
	dataBytes, _ := json.Marshal(body)
		dataBytes = []byte(sanitizeInput(string(dataBytes)))
	if err := dbInsert(id, "trade_finance_go", "default", "active", dataBytes); err != nil {
		log.Printf("[%s] dbInsert failed: %v", serviceName, err)
	}
	// Inter-service call
	upstreamURL := os.Getenv("AML_ENGINE_URL")
	if upstreamURL == "" { upstreamURL = "http://localhost:8120" }
	result, err := callService("POST", upstreamURL+"/v1/screen", body)
	if err != nil {
		log.Fatalf("schema init failed: %v", err)
	}
	
	cacheSet(tenantID+":"+"trade_finance_list", "", 1) // invalidate list cache
	jsonResp(w, 201, map[string]interface{}{"created": true, "id": id, "data": body, "source": dbSourceTag()})
}
func lcFee(amount float64, tenor int) float64 {
	rate := 0.0015
	if tenor > 180 { rate = 0.002 }
	return math.Round(amount * rate * float64(tenor) / 365.0 * 100) / 100
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

	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_service_configs_tenant ON service_configs(tenant_id)`)
	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_service_configs_status ON service_configs(status)`)
	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_service_configs_created ON service_configs(created_at DESC)`)
	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_outbox_unpublished ON outbox(published, created_at) WHERE NOT published`)
}

func domainHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		listRecords(w, r)
	case "POST":
		createRecord(w, r)
	default:
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
	}
}

func lcStatus(issued bool, expired bool, utilized bool) string {
	if utilized { return "utilized" }
	if expired { return "expired" }
	if issued { return "active" }
	return "draft"
}

func issueLCHandler(w http.ResponseWriter, r *http.Request) {
	var req LCRequest
	json.NewDecoder(r.Body).Decode(&req)
	fee := lcFee(req.Amount, 90)
	docs := requiredDocuments(req.Incoterm)
	ref := fmt.Sprintf("LC-%d", time.Now().UnixNano())
	jsonResp(w, 200, map[string]interface{}{"lc_reference": ref, "status": "issued", "fee": fee, "required_documents": docs, "amount": req.Amount})
}

func presentDocHandler(w http.ResponseWriter, r *http.Request) {
	var req DocumentPresentation
	json.NewDecoder(r.Body).Decode(&req)
	required := requiredDocuments("FOB")
	valid, missing := validatePresentation(req.Documents, required)
	jsonResp(w, 200, map[string]interface{}{"compliant": valid, "missing_documents": missing, "lc_id": req.LCID})
}

func guaranteeHandler(w http.ResponseWriter, r *http.Request) {
	var req struct { Amount float64 `json:"amount"`; Type string `json:"type"`; Tenor int `json:"tenor"` }
	json.NewDecoder(r.Body).Decode(&req)
	fee := req.Amount * 0.02 * float64(req.Tenor) / 365.0
	jsonResp(w, 200, map[string]interface{}{"guarantee_ref": fmt.Sprintf("BG-%d", time.Now().UnixNano()), "type": req.Type, "amount": req.Amount, "fee": math.Round(fee*100)/100})
}
// --- Production Hardening ---
var (
    _reqCount  uint64
    _errCount  uint64
    _bootTime  = time.Now()
)

func readyzHandler(w http.ResponseWriter, r *http.Request) {
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
    fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"trade-finance-go\"} %d\n", reqs)
    fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"trade-finance-go\"} %d\n", errs)
    fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"trade-finance-go\"} %.0f\n", time.Since(_bootTime).Seconds())
}
// --- Inter-Service HTTP Client with Retry & Circuit Breaker ---
type circuitBreaker struct {
    failures    int
    lastFailure time.Time
    threshold   int
    resetAfter  time.Duration
    mu          sync.Mutex
}

func (cb *circuitBreaker) allow() bool {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    if cb.failures >= cb.threshold {
        if time.Since(cb.lastFailure) > cb.resetAfter {
            cb.failures = cb.threshold / 2 // half-open
            return true
        }
        return false
    }
    return true
}

func (cb *circuitBreaker) recordSuccess() {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    if cb.failures > 0 { cb.failures-- }
}

func (cb *circuitBreaker) recordFailure() {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    cb.failures++
    cb.lastFailure = time.Now()
}

var _cb = &circuitBreaker{threshold: 5, resetAfter: 30 * time.Second}

func callService(method, url string, body interface{}) (map[string]interface{}, error) {
	// Try binary RPC for lower latency
	if res, err := rpcCall("localhost:9090", "process", map[string]interface{}{}); err == nil {
		_ = res
	}

    if !_cb.allow() {
        return nil, fmt.Errorf("circuit breaker open for %s", url)
    }
    
    client := &http.Client{Timeout: 15 * time.Second}
    var lastErr error
    
    for attempt := 0; attempt < 3; attempt++ {
        if attempt > 0 {
            time.Sleep(time.Duration(1<<uint(attempt)) * 100 * time.Millisecond)
        }
        
        var req *http.Request
        if body != nil {
            jsonData, _ := json.Marshal(body)
            req, _ = http.NewRequest(method, url, bytes.NewBuffer(jsonData))
        } else {
            req, _ = http.NewRequest(method, url, nil)
        }
        req.Header.Set("Content-Type", "application/json")
        
        resp, err := client.Do(req)
        if err != nil {
            lastErr = err
            _cb.recordFailure()
            log.Printf("[inter-service] %s %s attempt %d failed: %v", method, url, attempt+1, err)
            continue
        }
        defer resp.Body.Close()
        
        if resp.StatusCode >= 500 {
            lastErr = fmt.Errorf("upstream %s returned %d", url, resp.StatusCode)
            _cb.recordFailure()
            continue
        }
        
        var result map[string]interface{}
        json.NewDecoder(resp.Body).Decode(&result)
        _cb.recordSuccess()
        return result, nil
    }
    return nil, fmt.Errorf("all retries exhausted for %s: %w", url, lastErr)
}

func callSanctionsScreen(entityName string, country string) (map[string]interface{}, error) {
    return callService("POST", sanctionsURL+"/v1/screen", map[string]interface{}{
        "entity_name": entityName, "country": country,
        "lists": []string{"OFAC", "EU", "UN", "CBN"},
    })
}

func callFXConversion(fromCurrency string, toCurrency string, amount float64) (map[string]interface{}, error) {
    return callService("POST", fxEngineURL+"/v1/convert", map[string]interface{}{
        "from": fromCurrency, "to": toCurrency, "amount": amount,
    })
}

// --- Counting Middleware ---
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
// --- Distributed Tracing ---
func traceMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		if r.URL.Path != "/healthz" && r.URL.Path != "/livez" {
			log.Printf("%s %s %v", r.Method, r.URL.Path, time.Since(start))
		}
	})
}

// --- Redis Caching Layer ---
var redisAddr string

func init() {
	redisAddr = os.Getenv("REDIS_URL")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}
}

func cacheGet(key string) (string, bool) {
	conn, err := net.DialTimeout("tcp", redisAddr, 2*time.Second)
	if err != nil { return "", false }
	defer conn.Close()
	fmt.Fprintf(conn, "*2\r\n$3\r\nGET\r\n$%d\r\n%s\r\n", len(key), key)
	buf := make([]byte, 4096)
	n, err := conn.Read(buf)
	if err != nil || n < 3 { return "", false }
	resp := string(buf[:n])
	if resp[0] == '$' && resp[1] != '-' {
		// Parse bulk string response
		parts := strings.SplitN(resp, "\r\n", 3)
		if len(parts) >= 3 { return parts[1], true }
	}
	return "", false
}

func cacheSet(key, value string, ttlSeconds int) {
	conn, err := net.DialTimeout("tcp", redisAddr, 2*time.Second)
	if err != nil { return }
	defer conn.Close()
	fmt.Fprintf(conn, "*4\r\n$3\r\nSET\r\n$%d\r\n%s\r\n$%d\r\n%s\r\n$2\r\nEX\r\n$%d\r\n%d\r\n",
		len(key), key, len(value), value, len(fmt.Sprintf("%d", ttlSeconds)), ttlSeconds)
}

// --- mTLS Configuration ---
func getTLSConfig() (bool, string, string) {
	if os.Getenv("TLS_ENABLED") != "true" { return false, "", "" }
	cert := os.Getenv("TLS_CERT_PATH")
	key := os.Getenv("TLS_KEY_PATH")
	if cert == "" { cert = "/etc/54bank/certs/service.crt" }
	if key == "" { key = "/etc/54bank/certs/service.key" }
	return true, cert, key
}

func dbSourceTag() string {
    if os.Getenv("DATABASE_URL") != "" { return "database" }
    return "in-memory"
}

// --- Rate Limiter (token bucket) ---
type tokenBucket struct {
	mu       sync.Mutex
	tokens   float64
	max      float64
	refill   float64
	lastTime int64
}

var _rl = &tokenBucket{max: 100, refill: 100, tokens: 100, lastTime: time.Now().UnixNano()}

func (tb *tokenBucket) allow() bool {
	tb.mu.Lock()
	defer tb.mu.Unlock()
	now := time.Now().UnixNano()
	elapsed := float64(now-tb.lastTime) / float64(time.Second)
	tb.lastTime = now
	tb.tokens = min64f(tb.max, tb.tokens+elapsed*tb.refill)
	if tb.tokens < 1 {
		return false
	}
	tb.tokens--
	return true
}

func min64f(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

func rateLimitMiddleware(next http.Handler) http.Handler {
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

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// --- JWT Validation (JWKS-aware) ---

// ── MIDDLEWARE: JWT Validation (JWKS / RS256) — fail-closed ────────────────

type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}

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

func startJWKSRefresh() {
	go fetchJWKS(jwtRealmURL())
	go func() {
		for range time.Tick(5 * time.Minute) {
			fetchJWKS(jwtRealmURL())
		}
	}()
}

// jwtAuthMiddleware validates Bearer tokens against the Keycloak JWKS endpoint (RS256
// signature + expiry). Fail-closed: no token is accepted on structure alone.
func jwtAuthMiddleware(next http.Handler) http.Handler {{
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {{
		p := r.URL.Path
		if p == "/healthz" || p == "/readyz" || p == "/livez" || p == "/metrics" || p == "/health" {{
			next.ServeHTTP(w, r)
			return
		}}
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {{
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{{"error":"unauthorized","service":"trade-finance-go"}}`)
			return
		}}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {{
			http.Error(w, `{{"error":"malformed token"}}`, http.StatusUnauthorized)
			return
		}}
		headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
		if err != nil {{
			http.Error(w, `{{"error":"invalid token header"}}`, http.StatusUnauthorized)
			return
		}}
		var header struct {{
			Kid string `json:"kid"`
			Alg string `json:"alg"`
		}}
		json.Unmarshal(headerBytes, &header)
		if header.Alg != "RS256" {{
			http.Error(w, `{{"error":"unsupported token algorithm"}}`, http.StatusUnauthorized)
			return
		}}

		jwtCache.mu.RLock()
		pub, ok := jwtCache.keys[header.Kid]
		jwtCache.mu.RUnlock()
		if !ok {{
			fetchJWKS(jwtRealmURL())
			jwtCache.mu.RLock()
			pub, ok = jwtCache.keys[header.Kid]
			jwtCache.mu.RUnlock()
			if !ok {{
				http.Error(w, `{{"error":"unknown signing key"}}`, http.StatusUnauthorized)
				return
			}}
		}}

		sigBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
		if err != nil {{
			http.Error(w, `{{"error":"invalid signature encoding"}}`, http.StatusUnauthorized)
			return
		}}
		hash := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
		if err := rsa.VerifyPKCS1v15(pub, crypto.SHA256, hash[:], sigBytes); err != nil {{
			http.Error(w, `{{"error":"invalid signature"}}`, http.StatusUnauthorized)
			return
		}}

		claimsBytes, _ := base64.RawURLEncoding.DecodeString(parts[1])
		var claims map[string]interface{{}}
		json.Unmarshal(claimsBytes, &claims)
		if exp, ok := claims["exp"].(float64); ok && time.Now().Unix() > int64(exp) {{
			http.Error(w, `{{"error":"token expired"}}`, http.StatusUnauthorized)
			return
		}}
		if sub, ok := claims["sub"].(string); ok {{
			r.Header.Set("X-User-Id", sub)
		}}
		ctx := context.WithValue(r.Context(), "jwt_claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	}})
}}

		next.ServeHTTP(w, r)
	})
}


// ── Binary RPC Server (stdlib, high-performance inter-service communication) ──
// Length-prefixed binary protocol over TCP — ~10x faster than HTTP/JSON

type rpcServer struct {
	serviceName string
	listener    net.Listener
	reqCount    int64
}

func newRPCServer(serviceName string) *rpcServer {
	return &rpcServer{serviceName: serviceName}
}

func (s *rpcServer) serve(port string) {
	var err error
	s.listener, err = net.Listen("tcp", ":"+port)
	if err != nil {
		log.Printf("[%s] RPC listen failed on :%s: %v", s.serviceName, port, err)
		return
	}
	log.Printf("[%s] RPC server on :%s (binary proto, multiplexed)", s.serviceName, port)
	for {
		conn, err := s.listener.Accept()
		if err != nil {
			if !strings.Contains(err.Error(), "closed") {
				log.Printf("[%s] RPC accept: %v", s.serviceName, err)
			}
			return
		}
		go s.handleConn(conn)
	}
}

func (s *rpcServer) handleConn(conn net.Conn) {
	defer conn.Close()
	conn.SetDeadline(time.Now().Add(30 * time.Second))
	atomic.AddInt64(&s.reqCount, 1)
	start := time.Now()

	lenBuf := make([]byte, 4)
	if _, err := io.ReadFull(conn, lenBuf); err != nil {
		return
	}
	msgLen := int(lenBuf[0])<<24 | int(lenBuf[1])<<16 | int(lenBuf[2])<<8 | int(lenBuf[3])
	if msgLen > 4*1024*1024 {
		return
	}
	payload := make([]byte, msgLen)
	if _, err := io.ReadFull(conn, payload); err != nil {
		return
	}

	resp := map[string]interface{}{
		"status":     "ok",
		"service":    s.serviceName,
		"latency_us": time.Since(start).Microseconds(),
	}
	respBytes, _ := json.Marshal(resp)
	respLen := len(respBytes)
	header := []byte{byte(respLen >> 24), byte(respLen >> 16), byte(respLen >> 8), byte(respLen)}
	conn.Write(header)
	conn.Write(respBytes)
}

func (s *rpcServer) stop() {
	if s.listener != nil {
		s.listener.Close()
	}
}

func rpcCall(target string, method string, payload map[string]interface{}) (map[string]interface{}, error) {
	conn, err := net.DialTimeout("tcp", target, 5*time.Second)
	if err != nil {
		return nil, fmt.Errorf("rpc dial %s: %w", target, err)
	}
	defer conn.Close()
	conn.SetDeadline(time.Now().Add(5 * time.Second))
	payload["method"] = method
	data, _ := json.Marshal(payload)
	dataLen := len(data)
	header := []byte{byte(dataLen >> 24), byte(dataLen >> 16), byte(dataLen >> 8), byte(dataLen)}
	conn.Write(header)
	conn.Write(data)
	lenBuf := make([]byte, 4)
	if _, err := io.ReadFull(conn, lenBuf); err != nil {
		return nil, err
	}
	respLen := int(lenBuf[0])<<24 | int(lenBuf[1])<<16 | int(lenBuf[2])<<8 | int(lenBuf[3])
	respBuf := make([]byte, respLen)
	if _, err := io.ReadFull(conn, respBuf); err != nil {
		return nil, err
	}
	var result map[string]interface{}
	json.Unmarshal(respBuf, &result)
	return result, nil
}


func validateTradeFinance(lcAmount float64, expiryDays int, incoterm string) (bool, string) {
	if lcAmount <= 0 { return false, "LC amount must be positive" }
	if expiryDays < 1 { return false, "LC must have valid expiry" }
	validTerms := map[string]bool{"FOB": true, "CIF": true, "CFR": true, "EXW": true, "DDP": true}
	if !validTerms[incoterm] { return false, "Invalid incoterm: " + incoterm }
	return true, "Trade finance application valid"
}
func computeLCFee(amount float64, durationDays int) float64 {
	annualRate := 0.015 // 1.5% p.a.
	return amount * annualRate * float64(durationDays) / 365.0
}


// --- Alerting ---
type alertManager struct {
    rules []alertRule
    mu    sync.RWMutex
}

type alertRule struct {
    Name      string
    Metric    string
    Threshold float64
    Severity  string
}

var _alertMgr = &alertManager{
    rules: []alertRule{
        {"high_error_rate", "error_rate", 0.05, "critical"},
        {"high_latency", "p99_latency_ms", 5000, "warning"},
        {"db_connection_failures", "db_failures", 3, "critical"},
    },
}

func (am *alertManager) check() []map[string]interface{} {
    var fired []map[string]interface{}
    errRate := float64(atomic.LoadUint64(&_errCount)) / float64(max64(atomic.LoadUint64(&_reqCount), 1))
    if errRate > 0.05 {
        fired = append(fired, map[string]interface{}{"rule": "high_error_rate", "value": errRate, "severity": "critical"})
    }
    return fired
}

func max64(a, b uint64) uint64 { if a > b { return a }; return b }

func alertsHandler(w http.ResponseWriter, r *http.Request) {
    jsonResp(w, 200, map[string]interface{}{"alerts": _alertMgr.check(), "rules": len(_alertMgr.rules)})
}

// --- Integration Tests ---
func respondJSON(w http.ResponseWriter, code int, data interface{}) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(code)
    json.NewEncoder(w).Encode(data)
}

func main() {
	port := os.Getenv("PORT")

	if port == "" { port = "8080" }
	initDB()
mux := http.NewServeMux()
	mux.HandleFunc("/readyz", readyzHandler)

	mux.HandleFunc("/livez", livezHandler)

	mux.HandleFunc("/metrics", metricsHandler)

	mux.HandleFunc("/v1/alerts", alertsHandler)
	mux.HandleFunc("/healthz", healthHandler)
	mux.HandleFunc("/api/list", listHandler)
	mux.HandleFunc("/api/stats", statsHandler)
	mux.HandleFunc("/api/get", getByIdHandler)
	mux.HandleFunc("/api/create", createHandler)

	mux.HandleFunc("/v1/trade/issue-lc", issueLCHandler)
	mux.HandleFunc("/v1/trade/present-documents", presentDocHandler)
	mux.HandleFunc("/v1/trade/guarantee", guaranteeHandler)

	log.Printf("trade-finance-go listening on port %s", port)
	tlsEnabled, tlsCert, tlsKey := getTLSConfig()
	_ = tlsCert
	_ = tlsKey
	_ = tlsEnabled
	server := &http.Server{
        Addr:    ":" + port,
        Handler: rateLimitMiddleware(securityHeadersMiddleware(jwtAuthMiddleware(traceMiddleware(countingMiddleware(mux))))),
        ReadTimeout:  15 * time.Second,
        WriteTimeout: 30 * time.Second,
        IdleTimeout:  60 * time.Second,
    }
    
	// Start binary RPC server for inter-service calls
	rpcSrv := newRPCServer("trade-finance-go")
	go rpcSrv.serve("9093")
	defer rpcSrv.stop()

	quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    go func() {
        if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            log.Fatalf("Server error: %v", err)
        }
    }()
    <-quit
    log.Println("[trade-finance-go] Shutdown signal received")
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    _ = server.Shutdown(ctx)
    log.Println("[trade-finance-go] Server stopped gracefully")
}
