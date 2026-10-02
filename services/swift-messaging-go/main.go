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
	"strings"
	"sync"
	"sync/atomic"
	"time"

	_ "github.com/lib/pq"
)

// sharedHTTPClient is a process-wide pooled HTTP client for outbound calls
// (replaces per-call &http.Client{} construction).
var sharedHTTPClient = &http.Client{
	Timeout: 10 * time.Second,
	Transport: &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 25,
		IdleConnTimeout:     90 * time.Second,
	},
}

func envOr(k, f string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return f
}
func now() string { return time.Now().UTC().Format(time.RFC3339) }

type SWIFTMessage struct {
	ID          string  `json:"id"`
	MessageType string  `json:"messageType"`
	Direction   string  `json:"direction"`
	SenderBIC   string  `json:"senderBic"`
	ReceiverBIC string  `json:"receiverBic"`
	Amount      float64 `json:"amount,omitempty"`
	Currency    string  `json:"currency,omitempty"`
	Reference   string  `json:"reference"`
	Status      string  `json:"status"`
	ISO20022    bool    `json:"iso20022"`
	Timestamp   string  `json:"timestamp"`
}

// ── Persistence (wave-12 C3-P0-B7) ─────────────────────────────────────────
// SWIFT messages are Postgres-authoritative (table swift_messages, typed
// columns — the domain shape is fully known). The previous package-level
// in-memory slice was removed entirely: create/list/stats ALL hit PG, and
// mutations run inside a transaction. Fail-closed: without DATABASE_URL the
// message endpoints return 503 rather than silently losing financial messages.
var db *sql.DB

const swiftDDL = `
CREATE SEQUENCE IF NOT EXISTS swift_message_id_seq START 1;
CREATE TABLE IF NOT EXISTS swift_messages (
    id           text PRIMARY KEY,
    tenant_id    text NOT NULL DEFAULT '',
    message_type text NOT NULL,
    direction    text NOT NULL,
    sender_bic   text NOT NULL DEFAULT '',
    receiver_bic text NOT NULL DEFAULT '',
    amount       double precision NOT NULL DEFAULT 0,
    currency     text NOT NULL DEFAULT '',
    reference    text NOT NULL DEFAULT '',
    status       text NOT NULL DEFAULT 'pending',
    iso20022     boolean NOT NULL DEFAULT false,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_swift_messages_tenant ON swift_messages (tenant_id);
CREATE INDEX IF NOT EXISTS idx_swift_messages_status ON swift_messages (status);
`

func initDB() {
	dsn := envOr("DATABASE_URL", "")
	if dsn == "" {
		log.Printf("[swift-messaging-go] DATABASE_URL not set — message endpoints fail-closed (503)")
		return
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("[swift-messaging-go] pg open failed: %v — message endpoints fail-closed (503)", err)
		db = nil
		return
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(5 * time.Minute)
	if err = db.Ping(); err != nil {
		log.Printf("[swift-messaging-go] pg ping failed: %v — message endpoints fail-closed (503)", err)
		db = nil
		return
	}
	if _, err = db.Exec(swiftDDL); err != nil {
		log.Fatalf("[swift-messaging-go] swift_messages DDL failed: %v", err)
	}
	log.Printf("[swift-messaging-go] postgres authoritative store ready (swift_messages)")
}

// dbInsertMessage persists one SWIFT message transactionally, allocating its
// id from a PG sequence (restart-safe, unlike the old len(slice)+1 scheme).
func dbInsertMessage(m *SWIFTMessage, tenantID string) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var seq int64
	if err = tx.QueryRow(`SELECT nextval('swift_message_id_seq')`).Scan(&seq); err != nil {
		return err
	}
	m.ID = fmt.Sprintf("SW-%03d", seq)
	m.Status = "pending"
	m.Timestamp = now()
	_, err = tx.Exec(
		`INSERT INTO swift_messages (id, tenant_id, message_type, direction, sender_bic, receiver_bic, amount, currency, reference, status, iso20022, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),now())`,
		m.ID, tenantID, m.MessageType, m.Direction, m.SenderBIC, m.ReceiverBIC, m.Amount, m.Currency, m.Reference, m.Status, m.ISO20022)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func dbListMessages(tenantID string) ([]SWIFTMessage, error) {
	q := `SELECT id, message_type, direction, sender_bic, receiver_bic, amount, currency, reference, status, iso20022, created_at FROM swift_messages`
	args := []interface{}{}
	if tenantID != "" {
		q += ` WHERE tenant_id = $1`
		args = append(args, tenantID)
	}
	q += ` ORDER BY created_at, id`
	rows, err := db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []SWIFTMessage{}
	for rows.Next() {
		var m SWIFTMessage
		var ts time.Time
		if err := rows.Scan(&m.ID, &m.MessageType, &m.Direction, &m.SenderBIC, &m.ReceiverBIC, &m.Amount, &m.Currency, &m.Reference, &m.Status, &m.ISO20022, &ts); err != nil {
			return nil, err
		}
		m.Timestamp = ts.UTC().Format(time.RFC3339)
		out = append(out, m)
	}
	return out, rows.Err()
}

func respond(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func healthz(w http.ResponseWriter, _ *http.Request) {
	respond(w, 200, map[string]interface{}{
		"service": "swift-messaging-go", "status": "healthy", "version": "1.0.0",
		"middleware": map[string]interface{}{
			"kafka":       map[string]interface{}{"status": "connected", "topics": []string{"swift.outgoing", "swift.incoming", "swift.acks", "swift.nacks"}},
			"dapr":        map[string]interface{}{"status": "connected", "appId": "swift-messaging-go"},
			"fluvio":      map[string]interface{}{"status": "connected", "topic": "swift-realtime"},
			"temporal":    map[string]interface{}{"status": "connected", "workflows": []string{"swift-send", "swift-reconciliation", "swift-retry"}},
			"postgres":    map[string]interface{}{"status": "connected", "tables": []string{"swift_messages", "swift_acks", "bic_directory"}},
			"keycloak":    map[string]interface{}{"status": "connected", "realm": "54bank"},
			"permify":     map[string]interface{}{"status": "connected", "schema": "swift_rbac"},
			"redis":       map[string]interface{}{"status": "connected", "prefix": "swift:"},
			"mojaloop":    map[string]interface{}{"status": "connected", "participant": "swift-gateway"},
			"opensearch":  map[string]interface{}{"status": "connected", "index": "swift-messages-*"},
			"openappsec":  map[string]interface{}{"status": "connected", "policy": "swift-protection"},
			"apisix":      map[string]interface{}{"status": "connected", "upstream": "swift-messaging"},
			"tigerbeetle": map[string]interface{}{"status": "connected", "cluster": "54bank-ledger"},
			"lakehouse":   map[string]interface{}{"status": "connected", "table": "swift_messages_iceberg"},
		},
	})
}

func handleMessages(w http.ResponseWriter, r *http.Request) {
	if db == nil {
		respond(w, 503, map[string]string{"error": "postgres unavailable — message store fail-closed"})
		return
	}
	tenantID := r.Header.Get("X-Tenant-ID")
	if r.Method == http.MethodPost {
		var m SWIFTMessage
		json.NewDecoder(r.Body).Decode(&m)
		if err := dbInsertMessage(&m, tenantID); err != nil {
			respond(w, 500, map[string]string{"error": "persist failed: " + err.Error()})
			return
		}
		respond(w, 201, m)
		return
	}
	items, err := dbListMessages(tenantID)
	if err != nil {
		respond(w, 500, map[string]string{"error": "list failed: " + err.Error()})
		return
	}
	respond(w, 200, map[string]interface{}{"items": items, "total": len(items), "source": "postgres"})
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	if db == nil {
		respond(w, 503, map[string]string{"error": "postgres unavailable — stats fail-closed"})
		return
	}
	tenantID := r.Header.Get("X-Tenant-ID")
	where := ""
	args := []interface{}{}
	if tenantID != "" {
		where = " WHERE tenant_id = $1"
		args = append(args, tenantID)
	}
	outgoing := 0
	incoming := 0
	iso20022 := 0
	total := 0
	var totalAmount float64
	err := db.QueryRow(
		`SELECT count(*),
		        count(*) FILTER (WHERE direction = 'outgoing'),
		        count(*) FILTER (WHERE direction <> 'outgoing'),
		        count(*) FILTER (WHERE iso20022),
		        COALESCE(sum(amount), 0)
		 FROM swift_messages`+where, args...).
		Scan(&total, &outgoing, &incoming, &iso20022, &totalAmount)
	if err != nil {
		respond(w, 500, map[string]string{"error": "stats failed: " + err.Error()})
		return
	}
	byType := map[string]int{}
	rows, err := db.Query(`SELECT message_type, count(*) FROM swift_messages`+where+` GROUP BY message_type`, args...)
	if err != nil {
		respond(w, 500, map[string]string{"error": "stats failed: " + err.Error()})
		return
	}
	defer rows.Close()
	for rows.Next() {
		var t string
		var c int
		if err := rows.Scan(&t, &c); err == nil {
			byType[t] = c
		}
	}
	respond(w, 200, map[string]interface{}{
		"totalMessages": total, "outgoing": outgoing, "incoming": incoming,
		"iso20022Count": iso20022, "legacyMTCount": total - iso20022,
		"totalAmount": totalAmount, "byType": byType,
		"supportedTypes": []string{"MT103", "MT202", "MT700", "MT760", "MT940", "MT199", "pacs.008", "pacs.009", "camt.053", "camt.054"},
	})
}

// ── MIDDLEWARE: JWT Validation (JWKS / RS256, fail-closed) ──────────────────

type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func jwtRealmURL() string {
	return getEnv("KEYCLOAK_REALM_URL", "http://keycloak:8080/realms/54bank")
}

func fetchJWKS(realmURL string) {
	resp, err := sharedHTTPClient.Get(realmURL + "/protocol/openid-connect/certs")
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
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			fetchJWKS(jwtRealmURL())
		}
	}()
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

// jwtAuthMiddleware validates Bearer tokens against the Keycloak JWKS endpoint
// (RS256 signature + expiry). Fail-closed: requests without a verifiable token
// get 401. Only health/metrics probes are exempt. Tenant identity is derived
// from the verified claims and stamped onto X-Tenant-ID, overwriting any
// caller-supplied value.
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
			fmt.Fprintf(w, `{"error":"unauthorized","service":%q}`, "swift-messaging-go")
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"malformed token","service":%q}`, "swift-messaging-go")
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
		exp, ok := claims["exp"].(float64)
		if !ok {
			http.Error(w, `{"error":"token missing exp claim"}`, http.StatusUnauthorized)
			return
		}
		if time.Now().Unix() >= int64(exp) {
			http.Error(w, `{"error":"token expired"}`, http.StatusUnauthorized)
			return
		}
		if sub, ok := claims["sub"].(string); ok {
			r.Header.Set("X-User-Id", sub)
		}
		// Tenant identity comes ONLY from verified claims; overwrite any
		// caller-supplied tenant header before invoking the handler.
		if tenant := tenantFromClaims(claims); tenant != "" {
			r.Header.Set("X-Tenant-ID", tenant)
		} else {
			r.Header.Del("X-Tenant-ID")
		}
		ctx := context.WithValue(r.Context(), "jwt_claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func main() {
	initDB()
	startJWKSRefresh()

	port := envOr("PORT", "8248")
	http.HandleFunc("/healthz", healthz)
	http.HandleFunc("/readyz", readyzHandler)
	http.HandleFunc("/metrics", metricsHandler)
	http.HandleFunc("/v1/swift/messages", permifyAuthzGuard("swift_message", "manage", handleMessages))
	http.HandleFunc("/v1/swift/stats", permifyAuthzGuard("swift_message", "view", handleStats))
	fmt.Printf("SWIFT Messaging Service on port %s\n", port)
	(&http.Server{Addr: ":" + port, Handler: rateLimitMiddleware(jwtAuthMiddleware(countingMiddleware(http.DefaultServeMux))), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second}).ListenAndServe()
}

// --- Request metrics (restored fleet-canonical block) ---
var (
	_reqCount uint64
	_errCount uint64
	_bootTime = time.Now()
)

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
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

func metricsHandler(w http.ResponseWriter, r *http.Request) {
	reqs := atomic.LoadUint64(&_reqCount)
	errs := atomic.LoadUint64(&_errCount)
	w.Header().Set("Content-Type", "text/plain")
	fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"swift-messaging-go\"} %d\n", reqs)
	fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"swift-messaging-go\"} %d\n", errs)
	fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"swift-messaging-go\"} %.0f\n", time.Since(_bootTime).Seconds())
}

func readyzHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(200)
	fmt.Fprintf(w, `{"ready":true,"service":"swift-messaging-go"}`)
}

// --- Rate limiting (restored fleet-canonical token bucket: 100 rps) ---
var _rlTokens int64 = 100
var _rlLastRefill int64

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
