package main

import (
	"github.com/IBM/sarama"
	_ "github.com/lib/pq"
"context"
"os/signal"
"syscall"
"sync/atomic"

	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"net"

)

var serviceName = "safe-deposit-go"

var startTime = time.Now()

// ─── Domain Types ───────────────────────────────────────────────────────────

type BoxStatus string
type BoxSize string

const (
	BoxStatusOccupied    BoxStatus = "occupied"
	BoxStatusAvailable   BoxStatus = "available"
	BoxStatusMaintenance BoxStatus = "maintenance"

	BoxSizeSmall  BoxSize = "small"
	BoxSizeMedium BoxSize = "medium"
	BoxSizeLarge  BoxSize = "large"
)

type DepositBox struct {
	ID           string    `json:"id"`
	BoxSize      BoxSize   `json:"box_size"`
	CustomerName string    `json:"customer_name"`
	CustomerID   string    `json:"customer_id,omitempty"`
	Branch       string    `json:"branch"`
	AnnualRent   float64   `json:"annual_rent"`
	Currency     string    `json:"currency"`
	RenewalDate  string    `json:"renewal_date"`
	Status       BoxStatus `json:"status"`
	CreatedAt    string    `json:"created_at"`
	UpdatedAt    string    `json:"updated_at"`
	TenantID     string    `json:"tenant_id,omitempty"`
}

type DepositBoxListResponse struct {
	Items []DepositBox `json:"items"`
	Total int          `json:"total"`
}

type DepositBoxStats struct {
	TotalBoxes  int `json:"total_boxes"`
	Occupied    int `json:"occupied"`
	Available   int `json:"available"`
	Maintenance int `json:"maintenance"`
}

type AuditEntry struct {
	ID        string `json:"id"`
	Action    string `json:"action"`
	RecordID  string `json:"recordId"`
	Actor     string `json:"actor"`
	Timestamp string `json:"timestamp"`
	Details   string `json:"details"`
}

var (
	mu       sync.Mutex
	boxes    = []DepositBox{
		{ID: "BOX-0001", BoxSize: BoxSizeSmall, CustomerName: "Adebayo Okafor", CustomerID: "CUST-1001", Branch: "Lagos Island", AnnualRent: 45000, Currency: "NGN", RenewalDate: "2027-01-15", Status: BoxStatusOccupied, CreatedAt: "2025-01-15T09:00:00Z", UpdatedAt: "2025-01-15T09:00:00Z"},
		{ID: "BOX-0002", BoxSize: BoxSizeMedium, CustomerName: "Ngozi Eze", CustomerID: "CUST-1002", Branch: "Abuja Central", AnnualRent: 80000, Currency: "NGN", RenewalDate: "2027-03-20", Status: BoxStatusOccupied, CreatedAt: "2025-03-20T10:30:00Z", UpdatedAt: "2025-03-20T10:30:00Z"},
		{ID: "BOX-0003", BoxSize: BoxSizeLarge, CustomerName: "", CustomerID: "", Branch: "Port Harcourt", AnnualRent: 120000, Currency: "NGN", RenewalDate: "", Status: BoxStatusAvailable, CreatedAt: "2025-02-01T08:00:00Z", UpdatedAt: "2025-02-01T08:00:00Z"},
		{ID: "BOX-0004", BoxSize: BoxSizeSmall, CustomerName: "", CustomerID: "", Branch: "Lagos Island", AnnualRent: 45000, Currency: "NGN", RenewalDate: "", Status: BoxStatusMaintenance, CreatedAt: "2025-04-10T11:00:00Z", UpdatedAt: "2026-05-01T09:00:00Z"},
		{ID: "BOX-0005", BoxSize: BoxSizeMedium, CustomerName: "Emeka Chukwu", CustomerID: "CUST-1003", Branch: "Enugu", AnnualRent: 80000, Currency: "NGN", RenewalDate: "2026-11-30", Status: BoxStatusOccupied, CreatedAt: "2025-11-30T14:00:00Z", UpdatedAt: "2025-11-30T14:00:00Z"},
		{ID: "BOX-0006", BoxSize: BoxSizeLarge, CustomerName: "", CustomerID: "", Branch: "Abuja Central", AnnualRent: 120000, Currency: "NGN", RenewalDate: "", Status: BoxStatusAvailable, CreatedAt: "2025-06-15T10:00:00Z", UpdatedAt: "2025-06-15T10:00:00Z"},
	}
	auditLog = []AuditEntry{}
)

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Service", "safe-deposit-go")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

// ─── Handlers ───────────────────────────────────────────────────────────────

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{
		"service": "safe-deposit-go", "status": "healthy", "version": "2.0.0",
		"uptime_secs": int(time.Since(startTime).Seconds()),
		"domain": "Safe Deposit — Payments",
		"middleware": map[string]string{
			"kafka":      "safe-deposit.events, safe-deposit.audit",
			"postgres":   "safe_deposit_records",
			"redis":      "safe-deposit_cache",
			"temporal":   "SafeDepositWorkflow",
			"permify":    "safe-deposit:manage, safe-deposit:view",
			"opensearch": "safe-deposit-2026",
		},
	})
}

func handleList(w http.ResponseWriter, r *http.Request) {
	cacheKey := "safe_deposit_list"
	if cached, ok := cacheGet(cacheKey); ok {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Cache", "HIT")
		w.WriteHeader(200)
		w.Write([]byte(cached))
		return
	}
	mu.Lock()
	defer mu.Unlock()
	resp := DepositBoxListResponse{Items: boxes, Total: len(boxes)}
	if resp.Items == nil {
		resp.Items = []DepositBox{}
	}
	respondJSON(w, 200, resp)
}

func handleCreate(w http.ResponseWriter, r *http.Request) {
	cacheSet("safe_deposit_list", "", 1)
	if r.Method != "POST" { respondJSON(w, 405, map[string]string{"error": "POST required"}); return }

	var body struct {
		BoxSize      string  `json:"box_size"`
		Branch       string  `json:"branch"`
		AnnualRent   float64 `json:"annual_rent"`
		Currency     string  `json:"currency"`
		CustomerName string  `json:"customer_name"`
		CustomerID   string  `json:"customer_id"`
		RenewalDate  string  `json:"renewal_date"`
		TenantID     string  `json:"tenant_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondJSON(w, 400, map[string]string{"error": "invalid request body"}); return
	}
	if body.BoxSize == "" || body.Branch == "" {
		respondJSON(w, 400, map[string]string{"error": "box_size and branch are required"}); return
	}
	currency := body.Currency
	if currency == "" { currency = "NGN" }
	status := BoxStatusAvailable
	if body.CustomerID != "" || body.CustomerName != "" {
		status = BoxStatusOccupied
	}

	mu.Lock()
	defer mu.Unlock()

	now := time.Now().Format(time.RFC3339)
	box := DepositBox{
		ID:           fmt.Sprintf("BOX-%04d", len(boxes)+1),
		BoxSize:      BoxSize(body.BoxSize),
		Branch:       body.Branch,
		AnnualRent:   body.AnnualRent,
		Currency:     currency,
		CustomerName: body.CustomerName,
		CustomerID:   body.CustomerID,
		RenewalDate:  body.RenewalDate,
		Status:       status,
		TenantID:     body.TenantID,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	boxes = append(boxes, box)

	auditLog = append(auditLog, AuditEntry{
		ID: fmt.Sprintf("AUD-%08X", rand.Uint32()), Action: "create",
		RecordID: box.ID, Actor: body.CustomerID,
		Timestamp: now, Details: "Box created",
	})

	respondJSON(w, 201, map[string]interface{}{"created": true, "box": box})
}

// handleAssign assigns an existing available box to a customer.
func handleAssign(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" { respondJSON(w, 405, map[string]string{"error": "POST required"}); return }

	var body struct {
		ID           string  `json:"id"`
		CustomerName string  `json:"customer_name"`
		CustomerID   string  `json:"customer_id"`
		AnnualRent   float64 `json:"annual_rent"`
		RenewalDate  string  `json:"renewal_date"`
		UpdatedBy    string  `json:"updated_by"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondJSON(w, 400, map[string]string{"error": "invalid request body"}); return
	}
	if body.ID == "" || body.CustomerID == "" {
		respondJSON(w, 400, map[string]string{"error": "id and customer_id are required"}); return
	}

	mu.Lock()
	defer mu.Unlock()

	for i := range boxes {
		if boxes[i].ID == body.ID {
			if boxes[i].Status != BoxStatusAvailable {
				respondJSON(w, 409, map[string]string{"error": "box is not available for assignment"}); return
			}
			boxes[i].CustomerName = body.CustomerName
			boxes[i].CustomerID = body.CustomerID
			if body.AnnualRent > 0 { boxes[i].AnnualRent = body.AnnualRent }
			if body.RenewalDate != "" { boxes[i].RenewalDate = body.RenewalDate }
			boxes[i].Status = BoxStatusOccupied
			boxes[i].UpdatedAt = time.Now().Format(time.RFC3339)
			auditLog = append(auditLog, AuditEntry{
				ID: fmt.Sprintf("AUD-%08X", rand.Uint32()), Action: "assign",
				RecordID: body.ID, Actor: body.UpdatedBy,
				Timestamp: boxes[i].UpdatedAt, Details: "Box assigned to customer",
			})
			respondJSON(w, 200, map[string]interface{}{"updated": true, "box": boxes[i]})
			return
		}
	}
	respondJSON(w, 404, map[string]string{"error": "box not found: " + body.ID})
}

func handleUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" && r.Method != "PUT" { respondJSON(w, 405, map[string]string{"error": "POST/PUT required"}); return }

	var body struct {
		ID          string  `json:"id"`
		Status      string  `json:"status"`
		RenewalDate string  `json:"renewal_date"`
		AnnualRent  float64 `json:"annual_rent"`
		UpdatedBy   string  `json:"updated_by"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondJSON(w, 400, map[string]string{"error": "invalid request body"}); return
	}
	if body.ID == "" { respondJSON(w, 400, map[string]string{"error": "id is required"}); return }

	mu.Lock()
	defer mu.Unlock()

	for i := range boxes {
		if boxes[i].ID == body.ID {
			if body.Status != "" { boxes[i].Status = BoxStatus(body.Status) }
			if body.RenewalDate != "" { boxes[i].RenewalDate = body.RenewalDate }
			if body.AnnualRent > 0 { boxes[i].AnnualRent = body.AnnualRent }
			boxes[i].UpdatedAt = time.Now().Format(time.RFC3339)
			auditLog = append(auditLog, AuditEntry{
				ID: fmt.Sprintf("AUD-%08X", rand.Uint32()), Action: "update",
				RecordID: body.ID, Actor: body.UpdatedBy,
				Timestamp: boxes[i].UpdatedAt, Details: "Box updated",
			})
			respondJSON(w, 200, map[string]interface{}{"updated": true, "box": boxes[i]})
			return
		}
	}
	respondJSON(w, 404, map[string]string{"error": "box not found: " + body.ID})
}

func handleVacate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" { respondJSON(w, 405, map[string]string{"error": "POST required"}); return }

	var body struct {
		ID        string `json:"id"`
		UpdatedBy string `json:"updated_by"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondJSON(w, 400, map[string]string{"error": "invalid request body"}); return
	}
	if body.ID == "" { respondJSON(w, 400, map[string]string{"error": "id is required"}); return }

	mu.Lock()
	defer mu.Unlock()

	for i := range boxes {
		if boxes[i].ID == body.ID {
			boxes[i].CustomerName = ""
			boxes[i].CustomerID = ""
			boxes[i].RenewalDate = ""
			boxes[i].Status = BoxStatusAvailable
			boxes[i].UpdatedAt = time.Now().Format(time.RFC3339)
			auditLog = append(auditLog, AuditEntry{
				ID: fmt.Sprintf("AUD-%08X", rand.Uint32()), Action: "vacate",
				RecordID: body.ID, Actor: body.UpdatedBy,
				Timestamp: boxes[i].UpdatedAt, Details: "Box vacated",
			})
			respondJSON(w, 200, map[string]interface{}{"updated": true, "box": boxes[i]})
			return
		}
	}
	respondJSON(w, 404, map[string]string{"error": "box not found: " + body.ID})
}

func handleProcess(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{"message": "use /assign or /update for box operations"})
}

func handleAudit(w http.ResponseWriter, r *http.Request) {
	mu.Lock()
	defer mu.Unlock()
	respondJSON(w, 200, map[string]interface{}{"auditLog": auditLog, "total": len(auditLog)})
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	mu.Lock()
	defer mu.Unlock()
	stats := DepositBoxStats{}
	for _, b := range boxes {
		stats.TotalBoxes++
		switch b.Status {
		case BoxStatusOccupied:
			stats.Occupied++
		case BoxStatusAvailable:
			stats.Available++
		case BoxStatusMaintenance:
			stats.Maintenance++
		}
	}
	respondJSON(w, 200, stats)
}

func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok { return v }
	return ""
}



// --- Production Hardening ---
var (
    _reqCount  uint64
    _errCount  uint64
    _bootTime  = time.Now()
)

func readyzHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(200)
    fmt.Fprintf(w, `{"ready":true,"service":"safe-deposit-go"}`)
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
    fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"safe-deposit-go\"} %d\n", reqs)
    fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"safe-deposit-go\"} %d\n", errs)
    fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"safe-deposit-go\"} %.0f\n", time.Since(_bootTime).Seconds())
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



func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Printf("[safe-deposit-go] starting on :8472")

	// PostgreSQL connection
	dsn := getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/safe_deposit_go?sslmode=disable")
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
	log.Printf("[safe-deposit-go] database connected, schema initialized")

	// Middleware clients
	keycloakURL := getEnv("KEYCLOAK_REALM_URL", "http://keycloak:8080/realms/54bank")
	kafkaBrokers := getEnv("KAFKA_BROKERS", "localhost:9092")
	redisURL := getEnv("REDIS_URL", "localhost:6379")
	osURL := getEnv("OPENSEARCH_ENDPOINT", "http://opensearch:9200")
	permifyURL := getEnv("PERMIFY_ENDPOINT", "http://permify:3476")

	log.Printf("[safe-deposit-go] middleware: keycloak=%s kafka=%s redis=%s opensearch=%s permify=%s",
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
	mux.Handle("/api/v1/cards", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(domainHandler)))
	mux.Handle("/api/v1/cards/", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(domainDetailHandler)))

	server := &http.Server{
		Addr:         ":" + getEnv("PORT", "8472"),
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

	log.Printf("[safe-deposit-go] ready on :%s", getEnv("PORT", "8472"))

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Printf("[safe-deposit-go] shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	server.Shutdown(ctx)
	log.Printf("[safe-deposit-go] stopped")
}

func initSchema() {
	_, err := db.Exec(`CREATE TABLE IF NOT EXISTS cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_number_hash VARCHAR(64) NOT NULL,
    masked_pan VARCHAR(19) NOT NULL,
    customer_id UUID NOT NULL,
    account_id UUID NOT NULL,
    card_type VARCHAR(20) NOT NULL,
    scheme VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    expiry_month INT NOT NULL,
    expiry_year INT NOT NULL,
    daily_limit_kobo BIGINT NOT NULL DEFAULT 50000000,
    monthly_limit_kobo BIGINT NOT NULL DEFAULT 500000000,
    pin_retries INT DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    blocked_reason VARCHAR(100),
    tenant_id UUID NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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

	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_cards_tenant ON cards(tenant_id)`)
	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status)`)
	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_cards_created ON cards(created_at DESC)`)
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

func domainDetailHandler(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/v1/cards/"), "/")
	id := parts[0]
	if id == "" {
		http.Error(w, `{"error":"id required"}`, http.StatusBadRequest)
		return
	}

	switch r.Method {
	case "GET":
		getRecord(w, r, id)
	case "PUT", "PATCH":
		updateRecord(w, r, id)
	case "DELETE":
		deleteRecord(w, r, id)
	default:
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
	}
}

func listRecords(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	limit := 50
	offset := 0

	query := `SELECT id, status, created_at FROM cards WHERE ($1 = '' OR tenant_id::text = $1) ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	rows, err := db.QueryContext(r.Context(), query, tenantID, limit, offset)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var records []map[string]interface{}
	for rows.Next() {
		var id, status string
		var createdAt time.Time
		if err := rows.Scan(&id, &status, &createdAt); err != nil {
			continue
		}
		records = append(records, map[string]interface{}{"id": id, "status": status, "created_at": createdAt})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"data": records, "count": len(records)})
}

func createRecord(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "default"
	}
	body["tenant_id"] = tenantID

	payload, _ := json.Marshal(body)

	var id string
	err := db.QueryRowContext(r.Context(),
		`INSERT INTO cards (tenant_id, status) VALUES ($1, 'active') RETURNING id`,
		tenantID).Scan(&id)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	// Write to outbox for event publishing
	_, _ = db.ExecContext(r.Context(),
		`INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)`,
		"cards.created", id, string(payload))

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "status": "created"})
}

func getRecord(w http.ResponseWriter, r *http.Request, id string) {
	var status string
	var createdAt time.Time
	err := db.QueryRowContext(r.Context(),
		`SELECT status, created_at FROM cards WHERE id = $1`, id).Scan(&status, &createdAt)
	if err == sql.ErrNoRows {
		http.Error(w, `{"error":"not found"}`, http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "status": status, "created_at": createdAt})
}

func updateRecord(w http.ResponseWriter, r *http.Request, id string) {
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	status, _ := body["status"].(string)
	if status == "" {
		status = "updated"
	}

	_, err := db.ExecContext(r.Context(),
		`UPDATE cards SET status = $1, updated_at = NOW() WHERE id = $2`, status, id)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	payload, _ := json.Marshal(body)
	_, _ = db.ExecContext(r.Context(),
		`INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)`,
		"cards.updated", id, string(payload))

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "status": status})
}

func deleteRecord(w http.ResponseWriter, r *http.Request, id string) {
	_, err := db.ExecContext(r.Context(),
		`UPDATE cards SET status = 'deleted', updated_at = NOW() WHERE id = $1`, id)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	_, _ = db.ExecContext(r.Context(),
		`INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)`,
		"cards.deleted", id, `{"id":"`+id+`"}`)

	w.WriteHeader(http.StatusNoContent)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "healthy",
		"service": "safe-deposit-go",
		"version": "1.0.0",
	})
}

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
	var count int
	db.QueryRow(`SELECT COUNT(*) FROM cards`).Scan(&count)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service":       "safe-deposit-go",
		"total_records": count,
	})
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		if r.URL.Path != "/healthz" && r.URL.Path != "/livez" {
			log.Printf("%s %s %v", r.Method, r.URL.Path, time.Since(start))
		}
	})
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
	if nowr - atomic.LoadInt64(&_rlLastRefill) >= 1000 {
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


func validatePOSTransaction(amount float64, merchantID, terminalID string) (bool, string) {
	if amount <= 0 { return false, "Amount must be positive" }
	if amount > 5000000 { return false, "POS single transaction limit is ₦5M" }
	if merchantID == "" { return false, "Merchant ID required" }
	if terminalID == "" { return false, "Terminal ID required" }
	return true, "POS transaction approved"
}
func computePOSCharge(amount float64, isInterbank bool) float64 {
	mdr := amount * 0.005 // 0.5% MDR
	if mdr > 1000 { mdr = 1000 } // ₦1000 cap
	if isInterbank { mdr += 35 } // Interbank switching fee
	return mdr
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
    if cb.failures > 0 { cb.failures-- }
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

func max64(a, b uint64) uint64 { if a > b { return a }; return b }

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
        "service":        serviceName,
        "db_available":   _degrade.dbAvailable,
        "cache_available": _degrade.cacheAvailable,
        "upstreams":      _degrade.upstreamOK,
        "mode":           func() string { if _degrade.dbAvailable { return "normal" }; return "degraded" }(),
    })
}

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "9423" }
	initDB()
mux := http.NewServeMux()
	mux.HandleFunc("/readyz", readyzHandler)

	mux.HandleFunc("/livez", livezHandler)

	mux.HandleFunc("/metrics", metricsHandler)

	mux.Handle("/v1/alerts", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(alertsHandler)))
	mux.Handle("/v1/degradation", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(degradationStatusHandler)))
	mux.HandleFunc("/healthz", handleHealthz)
	mux.Handle("/v1/safe-deposit/list", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(handleList)))
	mux.Handle("/v1/safe-deposit/create", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(handleCreate)))
	mux.Handle("/v1/safe-deposit/assign", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(handleAssign)))
	mux.Handle("/v1/safe-deposit/update", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(handleUpdate)))
	mux.Handle("/v1/safe-deposit/vacate", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(handleVacate)))
	mux.Handle("/v1/safe-deposit/process", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(handleProcess)))
	mux.Handle("/v1/safe-deposit/audit", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(handleAudit)))
	mux.Handle("/v1/safe-deposit/stats", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(handleStats)))
	log.Printf("Safe Deposit v2.0 (Payments) on :%s", port)
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
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    go func() {
        if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            log.Fatalf("Server error: %v", err)
        }
    }()
    <-quit
    log.Println("[safe-deposit-go] Shutdown signal received")
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    _ = server.Shutdown(ctx)
    log.Println("[safe-deposit-go] Server stopped gracefully")
}

func jsonResp(w http.ResponseWriter, code int, data interface{}) { respondJSON(w, code, data) }

// jwtRealmURL resolves the Keycloak realm URL for jwtMiddleware (added by
// scripts/fix-go-wire-jwt.py).
func jwtRealmURL() string {
	if v := os.Getenv("KEYCLOAK_REALM_URL"); v != "" {
		return v
	}
	return "http://keycloak:8080/realms/54bank"
}
