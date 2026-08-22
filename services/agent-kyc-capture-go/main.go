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

var serviceName = "agent-kyc-capture-go"

var startTime = time.Now()

// ─── Domain Types ───────────────────────────────────────────────────────────

type CaptureForm struct {
	ID             string   `json:"id"`
	AgentID        string   `json:"agentId"`
	CustomerName   string   `json:"customerName"`
	CustomerPhone  string   `json:"customerPhone"`
	BVN            string   `json:"bvn,omitempty"`
	NIN            string   `json:"nin,omitempty"`
	DocumentType   string   `json:"documentType"`
	PhotoCaptured  bool     `json:"photoCaptured"`
	GPSLat         float64  `json:"gpsLat"`
	GPSLon         float64  `json:"gpsLon"`
	GPSAccuracy    float64  `json:"gpsAccuracyMeters"`
	CaptureMode    string   `json:"captureMode"` // online, offline, ussd_fallback
	SyncStatus     string   `json:"syncStatus"`  // pending, synced, failed, retry
	RequestedTier  string   `json:"requestedTier"`
	DOB            string   `json:"dateOfBirth,omitempty"`
	Gender         string   `json:"gender,omitempty"`
	Address        string   `json:"address,omitempty"`
	DocsSubmitted  []string `json:"docsSubmitted"`
	OCRRouting     string   `json:"ocrRouting"`
	CreatedAt      string   `json:"createdAt"`
	SyncedAt       string   `json:"syncedAt,omitempty"`
}

type Agent struct {
	ID              string  `json:"id"`
	Name            string  `json:"name"`
	Phone           string  `json:"phone"`
	Region          string  `json:"region"`
	Status          string  `json:"status"` // active, suspended, offline
	DeviceID        string  `json:"deviceId"`
	CapturesTotal   int     `json:"capturesTotal"`
	CapturesSync    int     `json:"capturesSynced"`
	CapturesPending int     `json:"capturesPending"`
	LastActiveAt    string  `json:"lastActiveAt"`
	GPSEnabled      bool    `json:"gpsEnabled"`
	Rating          float64 `json:"rating"`
}

type SyncQueue struct {
	PendingTotal  int     `json:"pendingTotal"`
	SyncedToday   int     `json:"syncedToday"`
	FailedToday   int     `json:"failedToday"`
	AvgLatencyMs  int     `json:"avgLatencyMs"`
	LastSyncAt    string  `json:"lastSyncAt"`
}

var (
	mu      sync.Mutex
	forms   = []CaptureForm{}
	agents  = []Agent{
		{ID: "AGT-001", Name: "Ibrahim Musa", Phone: "08023456789", Region: "North-West",
			Status: "active", DeviceID: "DEV-TECNO-001", CapturesTotal: 245, CapturesSync: 240,
			CapturesPending: 5, LastActiveAt: "2026-05-09T10:00:00Z", GPSEnabled: true, Rating: 4.7},
		{ID: "AGT-002", Name: "Fatima Bello", Phone: "08034567890", Region: "North-East",
			Status: "active", DeviceID: "DEV-ITEL-002", CapturesTotal: 189, CapturesSync: 189,
			CapturesPending: 0, LastActiveAt: "2026-05-09T09:30:00Z", GPSEnabled: true, Rating: 4.9},
		{ID: "AGT-003", Name: "Emeka Obi", Phone: "07045678901", Region: "South-East",
			Status: "offline", DeviceID: "DEV-INFX-003", CapturesTotal: 312, CapturesSync: 300,
			CapturesPending: 12, LastActiveAt: "2026-05-08T18:00:00Z", GPSEnabled: false, Rating: 4.5},
	}
	syncQ = SyncQueue{PendingTotal: 17, SyncedToday: 156, FailedToday: 3, AvgLatencyMs: 2400, LastSyncAt: "2026-05-09T10:05:00Z"}
	stats = map[string]interface{}{
		"totalCaptures": 746, "pendingSync": 17, "syncedToday": 156,
		"failedSync": 3, "activeAgents": 2, "offlineAgents": 1,
		"avgCaptureTimeSec": 180, "gpsEnabledPct": 66.7,
		"capturesByMode": map[string]int{"online": 520, "offline": 198, "ussd_fallback": 28},
		"capturesByTier": map[string]int{"tier1": 420, "tier2": 280, "tier3": 46},
		"topRegions": []map[string]interface{}{
			{"region": "North-West", "count": 245},
			{"region": "South-East", "count": 312},
			{"region": "North-East", "count": 189},
		},
	}
)

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Service", "agent-kyc-capture-go")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

// ─── Handlers ───────────────────────────────────────────────────────────────

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{
		"service": "agent-kyc-capture-go", "status": "healthy", "version": "2.0.0",
		"uptime_secs": int(time.Since(startTime).Seconds()),
		"domain": "Agent KYC Capture — Offline Banking",
		"capabilities": []string{
			"offline_capture", "gps_tagged_forms", "photo_capture",
			"sync_queue", "ussd_fallback", "batch_submission",
			"agent_management", "device_tracking", "ocr_routing_paddleocr",
			"tier1_instant_onboard", "document_validation",
		},
		"capture_modes": []string{"online", "offline", "ussd_fallback"},
		"supported_devices": []string{"android_4.4+", "kaios", "ussd_any"},
		"middleware": map[string]string{
			"kafka":       "agent-kyc.captures, agent-kyc.sync, agent-kyc.audit",
			"postgres":    "agent_kyc_forms, agent_kyc_agents, agent_kyc_sync_queue",
			"redis":       "offline_queue (persistent), sync_lock",
			"temporal":    "AgentKYCSyncWorkflow, BatchSubmissionWorkflow",
			"permify":     "agent-kyc:capture, agent-kyc:sync, agent-kyc:admin",
			"opensearch":  "agent-kyc-2026",
		},
	})
}

func handleCaptures(w http.ResponseWriter, r *http.Request) {
	mu.Lock()
	defer mu.Unlock()
	respondJSON(w, 200, map[string]interface{}{
		"captures": forms, "total": len(forms),
	})
}

func handleCreateCapture(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)

	mu.Lock()
	defer mu.Unlock()

	mode := "online"
	if m, ok := body["captureMode"].(string); ok {
		mode = m
	}
	tier := "tier1"
	if t, ok := body["requestedTier"].(string); ok {
		tier = t
	}

	form := CaptureForm{
		ID:            fmt.Sprintf("CAP-%08X", rand.Uint32()),
		AgentID:       getString(body, "agentId"),
		CustomerName:  getString(body, "customerName"),
		CustomerPhone: getString(body, "customerPhone"),
		BVN:           getString(body, "bvn"),
		NIN:           getString(body, "nin"),
		DocumentType:  getString(body, "documentType"),
		PhotoCaptured: body["photoCaptured"] != nil,
		GPSLat:        getFloat(body, "gpsLat"),
		GPSLon:        getFloat(body, "gpsLon"),
		GPSAccuracy:   getFloat(body, "gpsAccuracy"),
		CaptureMode:   mode,
		SyncStatus:    "pending",
		RequestedTier: tier,
		DOB:           getString(body, "dateOfBirth"),
		Gender:        getString(body, "gender"),
		Address:       getString(body, "address"),
		DocsSubmitted: []string{},
		OCRRouting:    "paddleocr_v4",
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	forms = append(forms, form)
	syncQ.PendingTotal++

	// Persist to database
	if db != nil {
		id := fmt.Sprintf("%s-%d", serviceName, time.Now().UnixNano())
		if dataBytes, err := json.Marshal(body)
		dataBytes = []byte(sanitizeInput(string(dataBytes))); err == nil {
			dbInsert(id, serviceName, "default", "active", dataBytes)
		}
	}

	csURL := os.Getenv("KYC_ENGINE_URL")
	if csURL == "" { csURL = "http://kyc-engine-go:8080" }
	if _, csErr := callService("POST", csURL+"/v1/notify", map[string]interface{}{"source": "agent_kyc_capture_go", "action": "create"}); csErr != nil {
		log.Printf("[%s] upstream call failed: %v", serviceName, csErr)
	}
	respondJSON(w, 201, map[string]interface{}{
		"created": true, "capture": form,
		"next_steps": []string{"sync_to_server", "trigger_ocr", "verify_bvn"},
	})
}

func handleSyncCapture(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)

	captureID := getString(body, "captureId")
	mu.Lock()
	defer mu.Unlock()

	for i := range forms {
		if forms[i].ID == captureID {
			forms[i].SyncStatus = "synced"
			forms[i].SyncedAt = time.Now().Format(time.RFC3339)
			syncQ.PendingTotal--
			syncQ.SyncedToday++
			respondJSON(w, 200, map[string]interface{}{
				"synced": true, "capture": forms[i],
				"ocr_triggered": true, "ocr_engine": "paddleocr_v4",
			})
			return
		}
	}
	respondJSON(w, 404, map[string]string{"error": "Capture not found: " + captureID})
}

func handleBatchSync(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)

	mu.Lock()
	defer mu.Unlock()

	synced := 0
	for i := range forms {
		if forms[i].SyncStatus == "pending" {
			forms[i].SyncStatus = "synced"
			forms[i].SyncedAt = time.Now().Format(time.RFC3339)
			synced++
		}
	}
	syncQ.PendingTotal -= synced
	syncQ.SyncedToday += synced
	respondJSON(w, 200, map[string]interface{}{
		"batch_synced": synced, "remaining_pending": syncQ.PendingTotal,
	})
}

func handleUSSDCapture(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)

	mu.Lock()
	defer mu.Unlock()

	form := CaptureForm{
		ID:            fmt.Sprintf("USSD-%08X", rand.Uint32()),
		AgentID:       getString(body, "agentId"),
		CustomerName:  getString(body, "customerName"),
		CustomerPhone: getString(body, "customerPhone"),
		BVN:           getString(body, "bvn"),
		CaptureMode:   "ussd_fallback",
		SyncStatus:    "pending",
		RequestedTier: "tier1",
		OCRRouting:    "none",
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	forms = append(forms, form)

	respondJSON(w, 201, map[string]interface{}{
		"created": true, "capture": form,
		"ussd_response": "*901*1*" + form.CustomerPhone + "#",
		"note": "Tier 1 USSD capture — photo/document required for tier upgrade",
	})
}

func handleAgents(w http.ResponseWriter, r *http.Request) {
	active := 0
	for _, a := range agents {
		if a.Status == "active" {
			active++
		}
	}
	respondJSON(w, 200, map[string]interface{}{
		"agents": agents, "total": len(agents), "active": active,
	})
}

func handleSyncQueue(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, syncQ)
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, stats)
}

func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

func getFloat(m map[string]interface{}, key string) float64 {
	if v, ok := m[key].(float64); ok {
		return v
	}
	return 0
}


func agent_kyc_captureComputeScore(value float64, weight float64, threshold float64) float64 {
    score := value * weight
    if score > threshold { score = threshold }
    return score
}

func agent_kyc_captureValidateRequest(data map[string]interface{}) map[string]interface{} {
    errors := []string{}
    required := []string{"id", "type"}
    for _, field := range required {
        if _, ok := data[field]; !ok {
            errors = append(errors, field + " is required")
        }
    }
    return map[string]interface{}{"valid": len(errors) == 0, "errors": errors}
}

func agent_kyc_captureScoreHandler(w http.ResponseWriter, r *http.Request) {
    var req struct {
        Value     float64 `json:"value"`
        Weight    float64 `json:"weight"`
        Threshold float64 `json:"threshold"`
    }
    json.NewDecoder(r.Body).Decode(&req)
    score := agent_kyc_captureComputeScore(req.Value, req.Weight, req.Threshold)
    respondJSON(w, 200, map[string]interface{}{"score": score})
}

func agent_kyc_captureValidateRequestHandler(w http.ResponseWriter, r *http.Request) {
    var body map[string]interface{}
    json.NewDecoder(r.Body).Decode(&body)
    result := agent_kyc_captureValidateRequest(body)
    respondJSON(w, 200, result)
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
    fmt.Fprintf(w, `{"ready":true,"service":"agent-kyc-capture-go"}`)
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
    fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"agent-kyc-capture-go\"} %d\n", reqs)
    fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"agent-kyc-capture-go\"} %d\n", errs)
    fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"agent-kyc-capture-go\"} %.0f\n", time.Since(_bootTime).Seconds())
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
	log.Printf("[agent-kyc-capture-go] starting on :8032")

	// PostgreSQL connection
	dsn := getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/agent_kyc_capture_go?sslmode=disable")
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
	log.Printf("[agent-kyc-capture-go] database connected, schema initialized")

	// Middleware clients
	keycloakURL := getEnv("KEYCLOAK_REALM_URL", "http://keycloak:8080/realms/54bank")
	kafkaBrokers := getEnv("KAFKA_BROKERS", "localhost:9092")
	redisURL := getEnv("REDIS_URL", "localhost:6379")
	osURL := getEnv("OPENSEARCH_ENDPOINT", "http://opensearch:9200")
	permifyURL := getEnv("PERMIFY_ENDPOINT", "http://permify:3476")

	log.Printf("[agent-kyc-capture-go] middleware: keycloak=%s kafka=%s redis=%s opensearch=%s permify=%s",
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
	mux.Handle("/api/v1/kyc_records", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(domainHandler)))
	mux.Handle("/api/v1/kyc_records/", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(domainDetailHandler)))

	server := &http.Server{
		Addr:         ":" + getEnv("PORT", "8032"),
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

	log.Printf("[agent-kyc-capture-go] ready on :%s", getEnv("PORT", "8032"))

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Printf("[agent-kyc-capture-go] shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	server.Shutdown(ctx)
	log.Printf("[agent-kyc-capture-go] stopped")
}

func initSchema() {
	_, err := db.Exec(`CREATE TABLE IF NOT EXISTS kyc_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    verification_type VARCHAR(32) NOT NULL,
    document_type VARCHAR(32),
    document_number VARCHAR(64),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    risk_score INT DEFAULT 0,
    risk_level VARCHAR(20) DEFAULT 'low',
    bvn VARCHAR(11),
    nin VARCHAR(11),
    verified_name VARCHAR(200),
    date_of_birth DATE,
    address TEXT,
    lga VARCHAR(100),
    state VARCHAR(50),
    country VARCHAR(3) DEFAULT 'NGA',
    selfie_match_score REAL,
    document_match_score REAL,
    pep_check BOOLEAN DEFAULT FALSE,
    sanctions_check BOOLEAN DEFAULT FALSE,
    adverse_media_check BOOLEAN DEFAULT FALSE,
    reviewer_id UUID,
    reviewed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    tenant_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_kyc_records_tenant ON kyc_records(tenant_id)`)
	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_kyc_records_status ON kyc_records(status)`)
	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_kyc_records_created ON kyc_records(created_at DESC)`)
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
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/v1/kyc_records/"), "/")
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

	query := `SELECT id, status, created_at FROM kyc_records WHERE ($1 = '' OR tenant_id::text = $1) ORDER BY created_at DESC LIMIT $2 OFFSET $3`
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
		`INSERT INTO kyc_records (tenant_id, status) VALUES ($1, 'active') RETURNING id`,
		tenantID).Scan(&id)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	// Write to outbox for event publishing
	_, _ = db.ExecContext(r.Context(),
		`INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)`,
		"kyc_records.created", id, string(payload))

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "status": "created"})
}

func getRecord(w http.ResponseWriter, r *http.Request, id string) {
	var status string
	var createdAt time.Time
	err := db.QueryRowContext(r.Context(),
		`SELECT status, created_at FROM kyc_records WHERE id = $1`, id).Scan(&status, &createdAt)
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
		`UPDATE kyc_records SET status = $1, updated_at = NOW() WHERE id = $2`, status, id)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	payload, _ := json.Marshal(body)
	_, _ = db.ExecContext(r.Context(),
		`INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)`,
		"kyc_records.updated", id, string(payload))

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "status": status})
}

func deleteRecord(w http.ResponseWriter, r *http.Request, id string) {
	_, err := db.ExecContext(r.Context(),
		`UPDATE kyc_records SET status = 'deleted', updated_at = NOW() WHERE id = $1`, id)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	_, _ = db.ExecContext(r.Context(),
		`INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)`,
		"kyc_records.deleted", id, `{"id":"`+id+`"}`)

	w.WriteHeader(http.StatusNoContent)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "healthy",
		"service": "agent-kyc-capture-go",
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
	db.QueryRow(`SELECT COUNT(*) FROM kyc_records`).Scan(&count)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service":       "agent-kyc-capture-go",
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


func validateKYCCompleteness(documents map[string]bool, tier string) (bool, []string) {
	required := map[string][]string{
		"tier1": {"bvn"},
		"tier2": {"bvn", "nin", "utility_bill"},
		"tier3": {"bvn", "nin", "utility_bill", "reference_letter"},
	}
	missing := []string{}
	for _, doc := range required[tier] {
		if !documents[doc] { missing = append(missing, doc) }
	}
	return len(missing) == 0, missing
}
func computeKYCRiskScore(pepStatus bool, countryRisk string, sourceOfFunds string) float64 {
	score := 0.0
	if pepStatus { score += 40 }
	riskMap := map[string]float64{"high": 30, "medium": 15, "low": 5}
	score += riskMap[countryRisk]
	if sourceOfFunds == "unknown" { score += 25 }
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
	if port == "" {
		port = "9016"
	}
	initDB()
mux := http.NewServeMux()
	mux.HandleFunc("/readyz", readyzHandler)

	mux.HandleFunc("/livez", livezHandler)

	mux.HandleFunc("/metrics", metricsHandler)

	mux.Handle("/v1/alerts", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(alertsHandler)))
	mux.Handle("/v1/degradation", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(degradationStatusHandler)))
	mux.HandleFunc("/healthz", handleHealthz)
	mux.Handle("/v1/agent-kyc/captures", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(handleCaptures)))
	mux.Handle("/v1/agent-kyc/capture", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(handleCreateCapture)))
	mux.Handle("/v1/agent-kyc/sync", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(handleSyncCapture)))
	mux.Handle("/v1/agent-kyc/batch-sync", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(handleBatchSync)))
	mux.Handle("/v1/agent-kyc/ussd-capture", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(handleUSSDCapture)))
	mux.Handle("/v1/agent-kyc/agents", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(handleAgents)))
	mux.Handle("/v1/agent-kyc/sync-queue", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(handleSyncQueue)))
	mux.Handle("/v1/agent-kyc/stats", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(handleStats)))
	mux.Handle("/v1/agent-kyc-capture/score", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(agent_kyc_captureScoreHandler)))
	mux.Handle("/v1/agent-kyc-capture/validate", jwtMiddleware(jwtRealmURL(), http.HandlerFunc(agent_kyc_captureValidateRequestHandler)))
	log.Printf("Agent KYC Capture v2.0 (Go) on :%s", port)
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
    log.Println("[agent-kyc-capture-go] Shutdown signal received")
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    _ = server.Shutdown(ctx)
    log.Println("[agent-kyc-capture-go] Server stopped gracefully")
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
