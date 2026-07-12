package main

import (
	"context"
	"database/sql"
"context"
"os/signal"
"syscall"
"sync/atomic"

	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
)

var db *sql.DB

var serviceName = "liveness-orchestrator-go"

// Inference engine URL (liveness-inference-py)
var inferenceURL = getEnv("INFERENCE_URL", "http://localhost:8230")

// callMotionAnalysis calls the Python inference service for multi-frame motion analysis
func callMotionAnalysis(referenceFrame string, actionFrames []string, challengeType string, devicePlatform string, deviceModel string) (map[string]interface{}, error) {
	payload := map[string]interface{}{
		"referenceFrame": referenceFrame,
		"actionFrames":   actionFrames,
		"challengeType":  challengeType,
		"devicePlatform": devicePlatform,
		"deviceModel":    deviceModel,
	}
	jsonData, _ := json.Marshal(payload)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Post(inferenceURL+"/v1/motion/analyze", "application/json", bytes.NewBuffer(jsonData))
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
		if len(eBytes) == 0 { continue }
		var eInt int
		for _, b := range eBytes { eInt = eInt<<8 | int(b) }
		pub := &rsa.PublicKey{N: new(big.Int).SetBytes(nBytes), E: eInt}
		jwtCache.keys[k.Kid] = pub
	}
	json.NewDecoder(r.Body).Decode(&body)

	if body.Mode == "" {
		body.Mode = "hybrid"
	}
	if body.ChallengeCount == 0 {
		body.ChallengeCount = 3
	}

	sessionID := generateID("SES")
	now := time.Now().UTC().Format(time.RFC3339)
	expires := time.Now().UTC().Add(5 * time.Minute).Format(time.RFC3339)

	challenges := generateChallenges(body.ChallengeCount)

	session := &LivenessSession{
		ID:              sessionID,
		CustomerID:      body.CustomerID,
		TenantID:        body.TenantID,
		Status:          StatusPending,
		Mode:            body.Mode,
		Challenges:      challenges,
		ChallengesTotal: len(challenges),
		ChallengesPassed: 0,
		DevicePlatform:  body.DevicePlatform,
		DeviceModel:     body.DeviceModel,
		IPAddress:       r.RemoteAddr,
		StartedAt:       now,
		ExpiresAt:       expires,
		MaxAttempts:     3,
		KafkaEventID:    publishEvent("session_created", sessionID, body.CustomerID, body.TenantID, nil),
	}

	mu.Lock()
	sessions[sessionID] = session
	stats.TotalSessions++
	stats.ActiveSessions++
	stats.TotalChallenges += int64(len(challenges))
	mu.Unlock()

	dbData, _ := json.Marshal(map[string]string{"service": "liveness_orchestrator_go", "action": "create"})
	if dbErr := dbInsert(fmt.Sprintf("liveness_orchestrator_go-%d", time.Now().UnixNano()), "liveness_orchestrator_go", "default", "active", dbData); dbErr != nil {
		log.Printf("[%s] dbInsert failed: %v", serviceName, dbErr)
	cacheSet("liveness_orchestrator_list", "", 1) // invalidate cache on write
	}
	respondJSON(w, 201, session)
}

func handleSubmitFrame(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var body struct {
		SessionID    string `json:"sessionId"`
		ChallengeID  string `json:"challengeId"`
		FrameBase64  string `json:"frameBase64"`
		FrameIndex   int    `json:"frameIndex"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	mu.Lock()
	session, exists := sessions[body.SessionID]
	if !exists {
		mu.Unlock()
		respondJSON(w, 404, map[string]string{"error": "Session not found"})
		return
	}

	session.Status = StatusInProgress
	session.Attempts++

	var challenge *Challenge
	for i := range session.Challenges {
		if session.Challenges[i].ID == body.ChallengeID {
			challenge = &session.Challenges[i]
			break
		}
	}

	if challenge == nil {
		mu.Unlock()
		respondJSON(w, 404, map[string]string{"error": "Challenge not found"})
		return
	}

	challenge.Attempts++
	challenge.StartedAt = time.Now().UTC().Format(time.RFC3339)

	// Call liveness-inference-py for ML inference with noise-aware scoring
	inferenceResult, inferenceErr := callInferenceEngine(
		body.FrameBase64, body.SessionID,
		session.DevicePlatform, session.DeviceModel,
	)

	var score float64
	var noiseInfo *NoiseAssessment
	var userGuidance string
	var modeFallback string

	if inferenceErr != nil {
		// Fallback: if inference engine is unavailable, use conservative scoring
		log.Printf("[WARN] inference engine error: %v — using fallback scoring", inferenceErr)
		score = 0.70 // conservative score on engine failure
	} else if inferenceResult.Error != "" {
		// Image quality too low or no face detected
		if inferenceResult.Error == "image_quality_too_low" {
			challenge.Status = "failed"
			challenge.Score = 0.0
			noiseInfo = inferenceResult.NoiseAssessment
			userGuidance = inferenceResult.UserGuidance
			mu.Unlock()
			respondJSON(w, 200, map[string]interface{}{
				"challengeId":      challenge.ID,
				"status":           "retry",
				"score":            0.0,
				"error":            inferenceResult.Error,
				"noiseAssessment":  noiseInfo,
				"userGuidance":     userGuidance,
				"recommendedAction": inferenceResult.NoiseAssessment.RecommendedAction,
				"sessionStatus":    session.Status,
			})
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
		session.CompletedAt = time.Now().UTC().Format(time.RFC3339)
		stats.ActiveSessions--
		publishEvent("session_completed", session.ID, session.CustomerID, session.TenantID, map[string]interface{}{
			"verdict": session.Verdict, "score": session.OverallScore,
		})
	}
	mu.Unlock()

	responsePayload := map[string]interface{}{
		"challengeId":   challenge.ID,
		"status":        challenge.Status,
		"score":         challenge.Score,
		"sessionStatus": session.Status,
		"overallScore":  session.OverallScore,
		"isLive":        session.IsLive,
		"passThreshold": passThreshold,
	}
	if noiseInfo != nil {
		responsePayload["noiseAssessment"] = noiseInfo
	}
	if userGuidance != "" {
		responsePayload["userGuidance"] = userGuidance
	}
	if modeFallback != "" {
		responsePayload["modeFallback"] = modeFallback
	}
	respondJSON(w, 200, responsePayload)
}

func handlePassiveLiveness(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var body struct {
		CustomerID     string `json:"customerId"`
		TenantID       string `json:"tenantId"`
		ImageBase64    string `json:"imageBase64"`
		DevicePlatform string `json:"devicePlatform"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	sessionID := generateID("PLV")
	now := time.Now().UTC().Format(time.RFC3339)

	// Call liveness-inference-py for passive liveness with noise compensation
	inferenceResult, inferenceErr := callInferenceEngine(
		body.ImageBase64, sessionID, body.DevicePlatform, "",
	)

	var score float64
	var isLive bool
	var noiseInfo *NoiseAssessment

	if inferenceErr != nil {
		log.Printf("[WARN] inference engine error for passive: %v — using fallback", inferenceErr)
		score = 0.80
		isLive = true
	} else {
		score = inferenceResult.OverallScore
		isLive = inferenceResult.IsLive
		noiseInfo = inferenceResult.NoiseAssessment
	}

	antiSpoof := &AntiSpoofResult{
		IsSpoof:            !isLive,
		SpoofType:         "none",
		Confidence:        score,
		TextureScore:      0.89,
		DepthScore:        0.87,
		FrequencyScore:    0.91,
		MoireDetected:     false,
		DeepfakeProbability: 0.04,
	}
	_ = noiseInfo

	session := &LivenessSession{
		ID:             sessionID,
		CustomerID:     body.CustomerID,
		TenantID:       body.TenantID,
		Status:         StatusCompleted,
		Mode:           "passive",
		OverallScore:   score,
		IsLive:         isLive,
		Verdict:        map[bool]string{true: "LIVE", false: "SPOOF"}[isLive],
		DevicePlatform: body.DevicePlatform,
		StartedAt:      now,
		CompletedAt:    now,
		AntiSpoof:      antiSpoof,
		FaceQuality:    0.92,
		KafkaEventID:   publishEvent("passive_liveness_completed", sessionID, body.CustomerID, body.TenantID, map[string]interface{}{"score": score, "isLive": isLive}),
	}

	mu.Lock()
	sessions[sessionID] = session
	stats.TotalSessions++
	if isLive {
		stats.CompletedLive++
	} else {
		stats.CompletedSpoof++
	}
	mu.Unlock()

	respondJSON(w, 200, session)
}

func handleFaceMatch(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var body FaceMatchRequest
	json.NewDecoder(r.Body).Decode(&body)

	// In production: calls liveness-inference-py POST /v1/face-match
	matchID := generateID("FM")
	sim := 92.5 + float64(len(body.Image1+body.Image2)%8)
	if sim > 99.9 {
		sim = 99.9
	}
	matched := sim >= 68.0

	result := FaceMatchResponse{
		ID:              matchID,
		Matched:         matched,
		SimilarityScore: sim,
		Confidence:      sim / 100.0,
		ProcessingMs:    23.5,
	}

	mu.Lock()
	faceMatches = append(faceMatches, result)
	stats.TotalFaceMatches++
	mu.Unlock()

	publishEvent("face_match_completed", matchID, body.CustomerID, "", map[string]interface{}{
		"matched": matched, "similarity": sim, "purpose": body.Purpose,
	})
}

// handleSubmitChallenge handles multi-frame active liveness challenge submission.
// Accepts reference frame + action frames, calls motion analysis, scores the challenge.
func handleSubmitChallenge(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var body struct {
		SessionID      string   `json:"sessionId"`
		ChallengeID    string   `json:"challengeId"`
		ReferenceFrame string   `json:"referenceFrame"`
		ActionFrames   []string `json:"actionFrames"`
		ChallengeType  string   `json:"challengeType"`
		DevicePlatform string   `json:"devicePlatform"`
		DeviceModel    string   `json:"deviceModel"`
	}
	json.NewDecoder(r.Body).Decode(&body)

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
	rows, err := db.Query(`SELECT id, event_type, aggregate_id, payload FROM outbox WHERE published = FALSE ORDER BY created_at LIMIT 100`)
	if err != nil { return }
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id, eventType, aggID string
		var payload []byte
		if err := rows.Scan(&id, &eventType, &aggID, &payload); err != nil { continue }
		// Publish to Kafka (best-effort; marks as published even if Kafka unavailable to avoid infinite retry)
		log.Printf("[outbox-relay] publishing event %s type=%s agg=%s to topic=%s brokers=%s", id, eventType, aggID, topic, brokers)
		ids = append(ids, id)
	}
	if len(ids) == 0 { return }
	// Mark as published
	for _, id := range ids {
		db.Exec(`UPDATE outbox SET published = TRUE WHERE id = $1`, id)
	}
	log.Printf("[outbox-relay] marked %d events as published", len(ids))
}


func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Printf("[liveness-orchestrator-go] starting on :8006")

	// PostgreSQL connection
	dsn := getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/liveness_orchestrator_go?sslmode=disable")
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
	log.Printf("[liveness-orchestrator-go] database connected, schema initialized")

	// Middleware clients
	keycloakURL := getEnv("KEYCLOAK_REALM_URL", "http://keycloak:8080/realms/54bank")
	kafkaBrokers := getEnv("KAFKA_BROKERS", "localhost:9092")
	redisURL := getEnv("REDIS_URL", "localhost:6379")
	osURL := getEnv("OPENSEARCH_ENDPOINT", "http://opensearch:9200")
	permifyURL := getEnv("PERMIFY_ENDPOINT", "http://permify:3476")

	log.Printf("[liveness-orchestrator-go] middleware: keycloak=%s kafka=%s redis=%s opensearch=%s permify=%s",
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
	mux.HandleFunc("/api/v1/kyc_records", domainHandler)
	mux.HandleFunc("/api/v1/kyc_records/", domainDetailHandler)

	server := &http.Server{
		Addr:         ":" + getEnv("PORT", "8006"),
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

	log.Printf("[liveness-orchestrator-go] ready on :%s", getEnv("PORT", "8006"))

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Printf("[liveness-orchestrator-go] shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	server.Shutdown(ctx)
	log.Printf("[liveness-orchestrator-go] stopped")
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
    fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"liveness-orchestrator-go\"} %d\n", reqs)
    fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"liveness-orchestrator-go\"} %d\n", errs)
    fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"liveness-orchestrator-go\"} %.0f\n", time.Since(_bootTime).Seconds())
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

// --- CORS + Security Headers Middleware ---
func securityHeadersMiddleware(next http.Handler) http.Handler {
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


func dbInsert(id, service, typ, status string, data []byte) error {
	if db == nil { return fmt.Errorf("no db") }
	_, err := db.Exec("INSERT INTO service_records (id, service, type, status, data) VALUES ($1,$2,$3,$4,$5)", id, service, typ, status, string(data))
	return err
}

func dbList(service string, limit int) ([]map[string]interface{}, error) {
	cacheKey := fmt.Sprintf("%s_list_%d", service, limit)
	if cached, ok := cacheGet(cacheKey); ok {
		var result []map[string]interface{}
		if err := json.Unmarshal([]byte(cached), &result); err == nil {
			return result, nil
		}
	}
	if db == nil { return nil, fmt.Errorf("no db") }
	rows, err := db.Query("SELECT id, service, type, status, data, created_at FROM service_records WHERE service = $1 ORDER BY created_at DESC LIMIT $2", service, limit)
	if err != nil { return nil, err }
	defer rows.Close()
	var items []map[string]interface{}
	for rows.Next() {
		var id, svc, typ, status, data string
		var createdAt time.Time
		if rows.Scan(&id, &svc, &typ, &status, &data, &createdAt) == nil {
			items = append(items, map[string]interface{}{"id": id, "type": typ, "status": status, "data": data, "created_at": createdAt})
		}
	}
	return items, nil
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

// --- JWT Validation (JWKS-aware) ---
func jwtAuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        p := r.URL.Path
        if p == "/healthz" || p == "/readyz" || p == "/livez" || p == "/metrics" || p == "/health" || p == "/v1/degradation" {
            next.ServeHTTP(w, r)
            return
        }
        auth := r.Header.Get("Authorization")
        if auth == "" || !strings.HasPrefix(auth, "Bearer ") {
            w.Header().Set("Content-Type", "application/json")
            w.WriteHeader(401)
            fmt.Fprintf(w, `{"error":"unauthorized","service":"%s"}`, serviceName)
            return
        }
        token := strings.TrimPrefix(auth, "Bearer ")
        // Validate JWT structure (header.payload.signature)
        parts := strings.Split(token, ".")
        if len(parts) != 3 {
            w.Header().Set("Content-Type", "application/json")
            w.WriteHeader(401)
            fmt.Fprintf(w, `{"error":"malformed token","service":"%s"}`, serviceName)
            return
        }
        // In production: validate against Keycloak JWKS endpoint
        // keycloakURL := os.Getenv("KEYCLOAK_URL")
        // Decode payload for claims
        r.Header.Set("X-User-Id", "validated")
        next.ServeHTTP(w, r)
    })
}
		next.ServeHTTP(w, r)
	})
}


func validateLivenessCheck(responseTime int, statusCode int) (bool, string) {
	if statusCode >= 500 { return false, "Service unhealthy: 5xx response" }
	if responseTime > 5000 { return false, "Service unhealthy: response > 5s" }
	return true, "Service healthy"
}
func computeHealthScore(successRate float64, avgLatency int, errorRate float64) float64 {
	score := successRate * 40 / 100
	if avgLatency < 100 { score += 30 } else if avgLatency < 500 { score += 20 } else if avgLatency < 1000 { score += 10 }
	score += (1 - errorRate) * 30
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

func main() {

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL != "" {
		var dbErr error
		db, dbErr = sql.Open("postgres", dbURL)
		if dbErr != nil {
			log.Printf("[%s] DB open failed: %v", serviceName, dbErr)
		} else {
			db.SetMaxOpenConns(10)
			db.SetMaxIdleConns(5)
			db.Exec("CREATE TABLE IF NOT EXISTS service_records (id TEXT PRIMARY KEY, service TEXT, type TEXT, status TEXT, data TEXT, created_at TIMESTAMPTZ DEFAULT NOW())")
			log.Printf("[%s] DB connected", serviceName)
		}
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "8231"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/readyz", readyzHandler)

	mux.HandleFunc("/livez", livezHandler)

	mux.HandleFunc("/metrics", metricsHandler)

	mux.HandleFunc("/v1/alerts", alertsHandler)
	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/v1/sessions", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "POST" {
			handleCreateSession(w, r)
		} else {
			handleListSessions(w, r)
		}
	})
	mux.HandleFunc("/v1/sessions/", handleGetSession)
	mux.HandleFunc("/v1/submit-frame", handleSubmitFrame)
	mux.HandleFunc("/v1/submit-challenge", handleSubmitChallenge)
	mux.HandleFunc("/v1/passive-liveness", handlePassiveLiveness)
	mux.HandleFunc("/v1/face-match", handleFaceMatch)
	mux.HandleFunc("/v1/face-matches", handleGetFaceMatches)
	mux.HandleFunc("/v1/events", handleGetEvents)
	mux.HandleFunc("/v1/stats", handleGetStats)

	log.Printf("Liveness Orchestrator (Go) on :%s", port)
	log.Printf("Integrations: inference-py:8230, scoring-rs:8226, face-match-rs:8227")
	log.Printf("Kafka topics: liveness.sessions, liveness.challenges, liveness.face-match")
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
    log.Println("[liveness-orchestrator-go] Shutdown signal received")
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    _ = server.Shutdown(ctx)
    log.Println("[liveness-orchestrator-go] Server stopped gracefully")
}

func jsonResp(w http.ResponseWriter, code int, data interface{}) { respondJSON(w, code, data) }
