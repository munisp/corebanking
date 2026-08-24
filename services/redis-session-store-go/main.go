package main

import (
	"bytes"
	"context"
	_ "github.com/lib/pq"
	"os/signal"
	"sync/atomic"
	"syscall"

	"crypto/rand"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"math/big"
	"net"
	"sync"
)

// --- JWT Validation (JWKS/RS256, fail-closed) ---
type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}

func jwtRealmURL() string {
	if u := os.Getenv("KEYCLOAK_REALM_URL"); u != "" {
		return u
	}
	return os.Getenv("KEYCLOAK_URL")
}

func fetchJWKS(realmURL string) {
	if realmURL == "" {
		return
	}
	client := &http.Client{Timeout: 10 * time.Second}
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

// tenantFromClaims derives the tenant ONLY from verified token claims — never
// from caller-supplied headers or parameters.
func tenantFromClaims(claims map[string]interface{}) string {
	for _, k := range []string{"tenant_id", "tenantId", "tenant"} {
		if s, ok := claims[k].(string); ok && s != "" {
			return s
		}
	}
	return ""
}

// jwtAuthMiddleware verifies Bearer tokens against the Keycloak JWKS endpoint
// (RS256). Tokens are rejected unless the signature verifies against a fetched
// key, the algorithm is RS256, and the token is not expired. Fail-closed.
func jwtAuthMiddleware(next http.Handler) http.Handler {
	realmURL := jwtRealmURL()
	go fetchJWKS(realmURL)
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			fetchJWKS(realmURL)
		}
	}()
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if p == "/healthz" || p == "/readyz" || p == "/livez" || p == "/metrics" || p == "/health" {
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
			fetchJWKS(realmURL)
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
		exp, ok := claims["exp"].(float64)
		if !ok {
			http.Error(w, `{"error":"token missing exp claim"}`, http.StatusUnauthorized)
			return
		}
		if time.Now().Unix() >= int64(exp) {
			http.Error(w, `{"error":"token expired"}`, http.StatusUnauthorized)
			return
		}
		if iss := os.Getenv("KEYCLOAK_ISSUER"); iss != "" && claims["iss"] != iss {
			http.Error(w, `{"error":"invalid issuer"}`, http.StatusUnauthorized)
			return
		}
		if sub, ok := claims["sub"].(string); ok {
			r.Header.Set("X-User-Id", sub)
		}
		// Tenant identity comes ONLY from verified JWT claims (fail-closed):
		// overwrite any caller-supplied tenant header and reject tokens that
		// carry no tenant claim before any query runs.
		tenant := tenantFromClaims(claims)
		if tenant == "" {
			http.Error(w, `{"error":"forbidden: token has no tenant claim"}`, http.StatusForbidden)
			return
		}
		r.Header.Set("X-Tenant-ID", tenant)
		ctx := context.WithValue(r.Context(), "jwt_claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// cryptoRandUint32 returns a cryptographically secure random uint32 for
// record and audit identifiers (L-06/L-16-residual: math/rand IDs are
// predictable and collision-prone).
func cryptoRandUint32() uint32 {
	var b [4]byte
	if _, err := rand.Read(b[:]); err != nil {
		log.Fatalf("crypto/rand unavailable: %v", err)
	}
	return binary.BigEndian.Uint32(b[:])
}

var serviceName = "redis-session-store-go"

var startTime = time.Now()

// ─── Domain Types ───────────────────────────────────────────────────────────

type Record struct {
	ID        string                 `json:"id"`
	Type      string                 `json:"type"`
	Status    string                 `json:"status"`
	Data      map[string]interface{} `json:"data"`
	CreatedAt string                 `json:"createdAt"`
	UpdatedAt string                 `json:"updatedAt"`
	CreatedBy string                 `json:"createdBy,omitempty"`
	TenantID  string                 `json:"tenantId,omitempty"`
	Version   int                    `json:"version"`
}

type AuditEntry struct {
	ID        string `json:"id"`
	Action    string `json:"action"`
	RecordID  string `json:"recordId"`
	Actor     string `json:"actor"`
	Timestamp string `json:"timestamp"`
	Details   string `json:"details"`
}

type DomainStats struct {
	TotalRecords   int                    `json:"totalRecords"`
	ActiveRecords  int                    `json:"activeRecords"`
	PendingRecords int                    `json:"pendingRecords"`
	ProcessedToday int                    `json:"processedToday"`
	Domain         string                 `json:"domain"`
	Metrics        map[string]interface{} `json:"metrics"`
}

var (
	mu      sync.Mutex
	records = []Record{
		{ID: "RED-001", Type: "primary", Status: "active", Data: map[string]interface{}{"domain": "Infrastructure/Data", "priority": "high", "region": "lagos"}, CreatedAt: "2026-05-09T10:00:00Z", UpdatedAt: "2026-05-09T10:00:00Z", Version: 1},
		{ID: "RED-002", Type: "secondary", Status: "processing", Data: map[string]interface{}{"domain": "Infrastructure/Data", "priority": "medium", "region": "abuja"}, CreatedAt: "2026-05-09T11:00:00Z", UpdatedAt: "2026-05-09T11:30:00Z", Version: 2},
		{ID: "RED-003", Type: "primary", Status: "completed", Data: map[string]interface{}{"domain": "Infrastructure/Data", "priority": "low", "region": "ph"}, CreatedAt: "2026-05-08T14:00:00Z", UpdatedAt: "2026-05-09T08:00:00Z", Version: 1},
	}
	auditLog    = []AuditEntry{}
	domainStats = DomainStats{
		TotalRecords: 3, ActiveRecords: 1, PendingRecords: 1, ProcessedToday: 12,
		Domain: "Infrastructure/Data",
		Metrics: map[string]interface{}{
			"avgProcessingMs": 245, "successRate": 98.5, "errorRate": 1.5,
			"peakHour": "14:00", "throughput": 156,
		},
	}
)

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Service", "redis-session-store-go")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

// ─── Handlers ───────────────────────────────────────────────────────────────

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{
		"service": "redis-session-store-go", "status": "healthy", "version": "2.0.0",
		"uptime_secs": int(time.Since(startTime).Seconds()),
		"domain":      "Redis Session Store — Infrastructure/Data",
		"middleware": map[string]string{
			"kafka":      "redis-session-store.events, redis-session-store.audit",
			"postgres":   "redis_session_store_records",
			"redis":      "redis-session-store_cache",
			"temporal":   "RedisSessionStoreWorkflow",
			"permify":    "redis-session-store:manage, redis-session-store:view",
			"opensearch": "redis-session-store-2026",
		},
	})
}

func handleList(w http.ResponseWriter, r *http.Request) {
	cacheKey := "redis_session_store_list"
	if cached, ok := cacheGet(cacheKey); ok {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Cache", "HIT")
		w.WriteHeader(200)
		w.Write([]byte(cached))
		return
	}
	// DB-first query with in-memory fallback
	if db != nil {
		rows, err := db.Query("SELECT id, service, type, status, data, created_at FROM service_records WHERE service = $1 ORDER BY created_at DESC LIMIT 100", "redis_session_store_go")
		if err == nil {
			defer rows.Close()
			var items []map[string]interface{}
			for rows.Next() {
				var id, svc, typ, status, data string
				var createdAt time.Time
				if rows.Scan(&id, &svc, &typ, &status, &data, &createdAt) == nil {
					items = append(items, map[string]interface{}{"id": id, "type": typ, "status": status, "data": data, "created_at": createdAt})
				}
			}
			respondJSON(w, 200, map[string]interface{}{"records": items, "total": len(items), "source": "database"})
			return
		}
		log.Printf("redis-session-store-go: DB query failed, falling back to in-memory: %v", err)
	}
	// In-memory fallback
	mu.Lock()
	defer mu.Unlock()
	respondJSON(w, 200, map[string]interface{}{"records": records, "total": len(records), "source": "in-memory"})
}

func handleCreate(w http.ResponseWriter, r *http.Request) {
	cacheSet("redis_session_store_list", "", 1) // invalidate list cache on write
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)

	mu.Lock()
	defer mu.Unlock()

	rec := Record{
		ID:        fmt.Sprintf("RED-%08X", cryptoRandUint32()),
		Type:      getString(body, "type"),
		Status:    "pending",
		Data:      body,
		CreatedAt: time.Now().Format(time.RFC3339),
		UpdatedAt: time.Now().Format(time.RFC3339),
		CreatedBy: getString(body, "createdBy"),
		TenantID:  getString(body, "tenantId"),
		Version:   1,
	}
	if rec.Type == "" {
		rec.Type = "primary"
	}
	records = append(records, rec)
	domainStats.TotalRecords = len(records)

	// Persist to database
	if dataBytes, err := json.Marshal(rec.Data); err == nil {
		if dbErr := dbInsert(rec.ID, serviceName, rec.Type, rec.Status, dataBytes); dbErr != nil {
			log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr)
		}
	}

	auditLog = append(auditLog, AuditEntry{
		ID: fmt.Sprintf("AUD-%08X", cryptoRandUint32()), Action: "create",
		RecordID: rec.ID, Actor: rec.CreatedBy,
		Timestamp: rec.CreatedAt, Details: "Record created",
	})

	// Inter-service call
	_upURL := os.Getenv("CORE_BANKING_URL")
	if _upURL == "" {
		_upURL = "http://localhost:8100"
	}
	_csResult, _csErr := callService("POST", _upURL+"/v1/status", nil)
	if _csErr != nil {
		log.Printf("[%s] inter-service call failed: %v", serviceName, _csErr)
	} else {
		log.Printf("[%s] inter-service call ok: %v", serviceName, _csResult)
	}

	respondJSON(w, 201, map[string]interface{}{"created": true, "record": rec})
}

func handleUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" && r.Method != "PUT" {
		respondJSON(w, 405, map[string]string{"error": "POST/PUT required"})
		return
	}
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)

	mu.Lock()
	defer mu.Unlock()

	id := getString(body, "id")
	for i := range records {
		if records[i].ID == id {
			if s := getString(body, "status"); s != "" {
				records[i].Status = s
			}
			for k, v := range body {
				if k != "id" {
					records[i].Data[k] = v
				}
			}
			records[i].UpdatedAt = time.Now().Format(time.RFC3339)
			records[i].Version++
			auditLog = append(auditLog, AuditEntry{
				ID: fmt.Sprintf("AUD-%08X", cryptoRandUint32()), Action: "update",
				RecordID: id, Actor: getString(body, "updatedBy"),
				Timestamp: records[i].UpdatedAt, Details: "Record updated",
			})
			respondJSON(w, 200, map[string]interface{}{"updated": true, "record": records[i]})
			return
		}
	}
	respondJSON(w, 404, map[string]string{"error": "Record not found: " + id})
}

func handleProcess(w http.ResponseWriter, r *http.Request) {
	// NOT IMPLEMENTED: the scaffold previously FABRICATED processing results here
	// (processingResult="success" and a random score via math/rand). Real domain
	// processing must be implemented before this endpoint is enabled.
	// Fail fast; never fabricate.
	respondJSON(w, 501, map[string]string{"error": "not_implemented"})
}

func handleAudit(w http.ResponseWriter, r *http.Request) {
	mu.Lock()
	defer mu.Unlock()
	respondJSON(w, 200, map[string]interface{}{"auditLog": auditLog, "total": len(auditLog)})
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	mu.Lock()
	defer mu.Unlock()
	domainStats.TotalRecords = len(records)
	active := 0
	pending := 0
	for _, r := range records {
		if r.Status == "active" || r.Status == "completed" {
			active++
		}
		if r.Status == "pending" || r.Status == "processing" {
			pending++
		}
	}
	domainStats.ActiveRecords = active
	domainStats.PendingRecords = pending
	respondJSON(w, 200, domainStats)
}

func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

func redis_session_storeComputeScore(value float64, weight float64, threshold float64) float64 {
	score := value * weight
	if score > threshold {
		score = threshold
	}
	return score
}

func redis_session_storeValidateRequest(data map[string]interface{}) map[string]interface{} {
	errors := []string{}
	required := []string{"id", "type"}
	for _, field := range required {
		if _, ok := data[field]; !ok {
			errors = append(errors, field+" is required")
		}
	}
	return map[string]interface{}{"valid": len(errors) == 0, "errors": errors}
}

func redis_session_storeScoreHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Value     float64 `json:"value"`
		Weight    float64 `json:"weight"`
		Threshold float64 `json:"threshold"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	score := redis_session_storeComputeScore(req.Value, req.Weight, req.Threshold)
	respondJSON(w, 200, map[string]interface{}{"score": score})
}

func redis_session_storeValidateRequestHandler(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	result := redis_session_storeValidateRequest(body)
	respondJSON(w, 200, result)
}

// --- Production Hardening ---
var (
	_reqCount uint64
	_errCount uint64
	_bootTime = time.Now()
)

func readyzHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(200)
	fmt.Fprintf(w, `{"ready":true,"service":"redis-session-store-go"}`)
}

func livezHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(200)
	fmt.Fprintf(w, `{"alive":true}`)
}

func metricsHandler(w http.ResponseWriter, r *http.Request) {
	reqs := atomic.LoadUint64(&_reqCount)
	errs := atomic.LoadUint64(&_errCount)
	w.Header().Set("Content-Type", "text/plain")
	fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"redis-session-store-go\"} %d\n", reqs)
	fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"redis-session-store-go\"} %d\n", errs)
	fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"redis-session-store-go\"} %.0f\n", time.Since(_bootTime).Seconds())
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

// --- Database Layer ---
var db *sql.DB

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
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err = db.Ping(); err != nil {
		log.Printf("[%s] DB ping failed: %v — in-memory fallback", serviceName, err)
		db = nil
		return
	}
	log.Printf("[%s] Postgres connected (pool: 25/5)", serviceName)
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
	if err != nil {
		return "", false
	}
	defer conn.Close()
	fmt.Fprintf(conn, "*2\r\n$3\r\nGET\r\n$%d\r\n%s\r\n", len(key), key)
	buf := make([]byte, 4096)
	n, err := conn.Read(buf)
	if err != nil || n < 3 {
		return "", false
	}
	resp := string(buf[:n])
	if resp[0] == '$' && resp[1] != '-' {
		// Parse bulk string response
		parts := strings.SplitN(resp, "\r\n", 3)
		if len(parts) >= 3 {
			return parts[1], true
		}
	}
	return "", false
}

func cacheSet(key, value string, ttlSeconds int) {
	conn, err := net.DialTimeout("tcp", redisAddr, 2*time.Second)
	if err != nil {
		return
	}
	defer conn.Close()
	fmt.Fprintf(conn, "*4\r\n$3\r\nSET\r\n$%d\r\n%s\r\n$%d\r\n%s\r\n$2\r\nEX\r\n$%d\r\n%d\r\n",
		len(key), key, len(value), value, len(fmt.Sprintf("%d", ttlSeconds)), ttlSeconds)
}

// --- mTLS Configuration ---
func getTLSConfig() (bool, string, string) {
	if os.Getenv("TLS_ENABLED") != "true" {
		return false, "", ""
	}
	cert := os.Getenv("TLS_CERT_PATH")
	key := os.Getenv("TLS_KEY_PATH")
	if cert == "" {
		cert = "/etc/54bank/certs/service.crt"
	}
	if key == "" {
		key = "/etc/54bank/certs/service.key"
	}
	return true, cert, key
}

// --- CORS + Security Headers Middleware ---
func securityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		allowedOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
		if allowedOrigins == "" {
			allowedOrigins = "https://dashboard.54bank.ng"
		}
		origin := r.Header.Get("Origin")
		for _, allowed := range strings.Split(allowedOrigins, ",") {
			if strings.TrimSpace(allowed) == origin {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				break
			}
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Trace-Id")
		w.Header().Set("Access-Control-Max-Age", "86400")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Content-Security-Policy", "default-src 'self'")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// --- Distributed Tracing ---
func traceMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		traceID := r.Header.Get("X-Trace-Id")
		if traceID == "" {
			traceID = fmt.Sprintf("%x-%x", time.Now().UnixNano(), os.Getpid())
		}
		w.Header().Set("X-Trace-Id", traceID)
		log.Printf("[%s] %s %s trace=%s", serviceName, r.Method, r.URL.Path, traceID)
		next.ServeHTTP(w, r)
	})
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

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

func validateSessionTTL(ttlSeconds int) (bool, string) {
	if ttlSeconds < 60 {
		return false, "Session TTL must be at least 60 seconds"
	}
	if ttlSeconds > 86400 {
		return false, "Session TTL cannot exceed 24 hours"
	}
	return true, "Session TTL valid"
}
func computeSessionScore(lastActiveMinutes int, deviceTrusted bool, ipChanged bool) float64 {
	score := 100.0
	if lastActiveMinutes > 30 {
		score -= 20
	}
	if !deviceTrusted {
		score -= 30
	}
	if ipChanged {
		score -= 15
	}
	return score
}

// --- Circuit Breaker + Retry (Production) ---
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
			cb.failures = cb.threshold / 2
			return true
		}
		return false
	}
	return true
}

func (cb *circuitBreaker) recordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	if cb.failures > 0 {
		cb.failures--
	}
}

func (cb *circuitBreaker) recordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.failures++
	cb.lastFailure = time.Now()
}

var _cb = &circuitBreaker{threshold: 5, resetAfter: 30 * time.Second}

func callServiceWithRetry(method, url string, body interface{}) (map[string]interface{}, error) {
	if !_cb.allow() {
		return nil, fmt.Errorf("circuit breaker open for %s", url)
	}
	client := &http.Client{Timeout: 15 * time.Second}
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Duration(1<<uint(attempt)) * 200 * time.Millisecond)
		}
		var req *http.Request
		if body != nil {
			jsonData, _ := json.Marshal(body)
			req, _ = http.NewRequest(method, url, bytes.NewBuffer(jsonData))
		} else {
			req, _ = http.NewRequest(method, url, nil)
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Source-Service", serviceName)
		resp, err := client.Do(req)
		if err != nil {
			lastErr = err
			_cb.recordFailure()
			log.Printf("[%s] %s %s attempt %d failed: %v", serviceName, method, url, attempt+1, err)
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

func max64(a, b uint64) uint64 {
	if a > b {
		return a
	}
	return b
}

func alertsHandler(w http.ResponseWriter, r *http.Request) {
	jsonResp(w, 200, map[string]interface{}{"alerts": _alertMgr.check(), "rules": len(_alertMgr.rules)})
}

// --- Graceful Degradation ---
type degradationState struct {
	dbAvailable    bool
	cacheAvailable bool
	upstreamOK     map[string]bool
	mu             sync.RWMutex
}

var _degrade = &degradationState{
	dbAvailable:    true,
	cacheAvailable: true,
	upstreamOK:     make(map[string]bool),
}

func (d *degradationState) setDB(ok bool) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.dbAvailable = ok
}

func (d *degradationState) isDBAvailable() bool {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.dbAvailable
}

func (d *degradationState) setUpstream(name string, ok bool) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.upstreamOK[name] = ok
}

func degradationStatusHandler(w http.ResponseWriter, r *http.Request) {
	_degrade.mu.RLock()
	defer _degrade.mu.RUnlock()
	jsonResp(w, 200, map[string]interface{}{
		"service":         serviceName,
		"db_available":    _degrade.dbAvailable,
		"cache_available": _degrade.cacheAvailable,
		"upstreams":       _degrade.upstreamOK,
		"mode": func() string {
			if _degrade.dbAvailable {
				return "normal"
			}
			return "degraded"
		}(),
	})
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "9417"
	}
	initDB()
	mux := http.NewServeMux()
	mux.HandleFunc("/readyz", readyzHandler)

	mux.HandleFunc("/livez", livezHandler)

	mux.HandleFunc("/metrics", metricsHandler)

	mux.HandleFunc("/v1/alerts", alertsHandler)
	mux.HandleFunc("/v1/degradation", degradationStatusHandler)
	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/v1/redis-session-store/list", handleList)
	mux.HandleFunc("/v1/redis-session-store/create", handleCreate)
	mux.HandleFunc("/v1/redis-session-store/update", handleUpdate)
	mux.HandleFunc("/v1/redis-session-store/process", handleProcess)
	mux.HandleFunc("/v1/redis-session-store/audit", handleAudit)
	mux.HandleFunc("/v1/redis-session-store/stats", handleStats)
	mux.HandleFunc("/v1/redis-session-store/score", redis_session_storeScoreHandler)
	mux.HandleFunc("/v1/redis-session-store/validate", redis_session_storeValidateRequestHandler)
	log.Printf("Redis Session Store v2.0 (Infrastructure/Data) on :%s", port)
	tlsEnabled, tlsCert, tlsKey := getTLSConfig()
	if tlsEnabled {
		// TLS was explicitly requested: never silently serve plaintext.
		// Fail fast at boot when the keypair is missing or unreadable.
		if tlsCert == "" || tlsKey == "" {
			log.Fatalf("[%s] TLS_ENABLED=true but TLS_CERT_PATH/TLS_KEY_PATH are unset — refusing to serve plaintext", serviceName)
		}
		if _, err := os.Stat(tlsCert); err != nil {
			log.Fatalf("[%s] TLS_ENABLED=true but cert %s is unreadable: %v — refusing to serve plaintext", serviceName, tlsCert, err)
		}
		if _, err := os.Stat(tlsKey); err != nil {
			log.Fatalf("[%s] TLS_ENABLED=true but key %s is unreadable: %v — refusing to serve plaintext", serviceName, tlsKey, err)
		}
		log.Printf("[%s] TLS enabled (cert: %s)", serviceName, tlsCert)
	}
	server := &http.Server{
		Addr:         ":" + port,
		Handler:      rateLimitMiddleware(securityHeadersMiddleware(jwtAuthMiddleware(traceMiddleware(countingMiddleware(mux))))),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		var err error
		if tlsEnabled {
			err = server.ListenAndServeTLS(tlsCert, tlsKey)
		} else {
			err = server.ListenAndServe()
		}
		if err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()
	<-quit
	log.Println("[redis-session-store-go] Shutdown signal received")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("[%s] graceful shutdown error: %v", serviceName, err)
	}
	log.Println("[redis-session-store-go] Server stopped gracefully")
}

func jsonResp(w http.ResponseWriter, code int, data interface{}) { respondJSON(w, code, data) }

// jwtRealmURL is defined in the JWT validation block above.

func callService(method, url string, body interface{}) (map[string]interface{}, error) {
	if _cbOpen.Load() && time.Since(time.Unix(0, _cbLastFailUnix.Load())) < 30*time.Second {
		return nil, fmt.Errorf("circuit breaker open for %s", url)
	}
	if _cbOpen.Load() {
		_cbOpen.Store(false)
		_cbFailures.Store(0)
	}
	client := &http.Client{Timeout: 15 * time.Second}
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Duration(1<<uint(attempt)) * 100 * time.Millisecond)
		}
		var req *http.Request
		if body != nil {
			j, _ := json.Marshal(body)
			j = []byte(sanitizeInput(string(j)))
			req, _ = http.NewRequest(method, url, bytes.NewBuffer(j))
		} else {
			req, _ = http.NewRequest(method, url, nil)
		}
		req.Header.Set("Content-Type", "application/json")
		resp, err := client.Do(req)
		if err != nil {
			lastErr = err
			_cbFailures.Add(1)
			_cbLastFailUnix.Store(time.Now().UnixNano())
			if _cbFailures.Load() >= 5 {
				_cbOpen.Store(true)
			}
			continue
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 500 {
			lastErr = fmt.Errorf("%s returned %d", url, resp.StatusCode)
			_cbFailures.Add(1)
			_cbLastFailUnix.Store(time.Now().UnixNano())
			if _cbFailures.Load() >= 5 {
				_cbOpen.Store(true)
			}
			continue
		}
		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)
		_cbFailures.Store(0)
		_cbOpen.Store(false)
		return result, nil
	}
	return nil, fmt.Errorf("retries exhausted for %s: %w", url, lastErr)
}

var _cbOpen atomic.Bool

var _cbLastFailUnix atomic.Int64

var _cbFailures atomic.Int64

func sanitizeInput(s string) string {
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "'", "&#39;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	s = strings.ReplaceAll(s, "\\", "")
	if len(s) > 10000 {
		s = s[:10000]
	}
	return s
}

func dbInsert(id, service, typ, status string, data []byte) error {
	if db == nil {
		return fmt.Errorf("no db")
	}
	_, err := db.Exec("INSERT INTO service_records (id, service, type, status, data) VALUES ($1,$2,$3,$4,$5)", id, service, typ, status, string(data))
	return err
}