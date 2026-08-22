package main

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rand"
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
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/IBM/sarama"
	_ "github.com/lib/pq"
)

var db *sql.DB

var serviceName = "liveness-orchestrator-go"

// Inference engine URL (liveness-inference-py). Both env vars are honored;
// the default matches infrastructure/new/server/index.ts (LIVENESS_INFERENCE_URL).
func inferenceURL() string {
	if v := os.Getenv("INFERENCE_URL"); v != "" {
		return v
	}
	return getEnv("LIVENESS_INFERENCE_URL", "http://localhost:8230")
}

// ─── Domain Types ───────────────────────────────────────────────────────────

type Challenge struct {
	ID        string  `json:"id"`
	Type      string  `json:"type"`
	Status    string  `json:"status"` // pending | passed | failed
	Score     float64 `json:"score"`
	Attempts  int     `json:"attempts"`
	StartedAt string  `json:"startedAt,omitempty"`
	// Nonce is a single-use, CSPRNG-generated value bound to the session ID,
	// challenge ID and subject (H-19 replay protection). It is rotated after
	// every failed attempt.
	Nonce     string  `json:"nonce,omitempty"`
}

type LivenessSession struct {
	ID               string       `json:"id"`
	CustomerID       string       `json:"customerId"`
	TenantID         string       `json:"tenantId,omitempty"`
	Status           string       `json:"status"` // pending | in_progress | completed | failed
	Mode             string       `json:"mode"`   // active | passive | hybrid
	Challenges       []Challenge  `json:"challenges,omitempty"`
	ChallengesTotal  int          `json:"challengesTotal"`
	ChallengesPassed int          `json:"challengesPassed"`
	OverallScore     float64      `json:"overallScore"`
	IsLive           bool         `json:"isLive"`
	Verdict          string       `json:"verdict,omitempty"` // LIVE | SPOOF | UNKNOWN
	DevicePlatform   string       `json:"devicePlatform,omitempty"`
	DeviceModel      string       `json:"deviceModel,omitempty"`
	IPAddress        string       `json:"ipAddress,omitempty"`
	Attempts         int          `json:"attempts"`
	MaxAttempts      int          `json:"maxAttempts"`
	StartedAt        string       `json:"startedAt"`
	ExpiresAt        string       `json:"expiresAt,omitempty"`
	CompletedAt      string       `json:"completedAt,omitempty"`
	AntiSpoof        *AntiSpoofResult `json:"antiSpoof,omitempty"`
	KafkaEventID     string       `json:"kafkaEventId,omitempty"`
}

type AntiSpoofResult struct {
	IsSpoof   bool    `json:"isSpoof"`
	SpoofType string  `json:"spoofType"`
	Confidence float64 `json:"confidence"`
}

type FaceMatchRequest struct {
	CustomerID string `json:"customerId"`
	Image1     string `json:"image1"`
	Image2     string `json:"image2"`
	Purpose    string `json:"purpose,omitempty"`
}

type FaceMatchResponse struct {
	ID              string  `json:"id"`
	Matched         bool    `json:"matched"`
	SimilarityScore float64 `json:"similarityScore"`
	Confidence      float64 `json:"confidence"`
	Engine          string  `json:"engine"`
	CreatedAt       string  `json:"createdAt"`
}

type serviceStats struct {
	mu                sync.Mutex
	TotalSessions     int64 `json:"totalSessions"`
	TotalFaceMatches  int64 `json:"totalFaceMatches"`
	CompletedLive     int64 `json:"completedLive"`
	CompletedSpoof    int64 `json:"completedSpoof"`
	EngineErrors      int64 `json:"engineErrors"`
}

var stats serviceStats

const passThreshold = 0.55

var (
	sessionsMu sync.Mutex
	sessions   = map[string]*LivenessSession{} // active-session cache; Postgres is the system of record
)

func generateID(prefix string) string {
	return fmt.Sprintf("%s-%d", prefix, time.Now().UnixNano())
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Service", serviceName)
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// ─── Inference Engine Client ────────────────────────────────────────────────
//
// All liveness/face-match verdicts come from the real inference engine.
// This service is fail-closed: any engine error yields isLive=false /
// matched=false plus HTTP 503. Similarity and liveness scores are NEVER
// synthesized locally.

var engineClient = &http.Client{Timeout: 30 * time.Second}

func callEngine(path string, payload map[string]interface{}) (map[string]interface{}, error) {
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	url := inferenceURL() + path
	resp, err := engineClient.Post(url, "application/json", bytes.NewReader(jsonData))
	if err != nil {
		return nil, fmt.Errorf("inference engine call %s failed: %w", path, err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 16<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("inference engine %s returned status %d", path, resp.StatusCode)
	}
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("inference engine %s returned invalid JSON: %w", path, err)
	}
	return result, nil
}

func engineBool(m map[string]interface{}, keys ...string) (bool, bool) {
	for _, k := range keys {
		if v, ok := m[k].(bool); ok {
			return v, true
		}
	}
	return false, false
}

func engineFloat(m map[string]interface{}, keys ...string) (float64, bool) {
	for _, k := range keys {
		if v, ok := m[k].(float64); ok {
			return v, true
		}
	}
	return 0, false
}

func generateChallenges(count int) []Challenge {
	pool := []string{"blink", "turn_left", "turn_right", "smile", "nod"}
	if count <= 0 {
		count = 3
	}
	if count > len(pool) {
		count = len(pool)
	}
	out := make([]Challenge, 0, count)
	for i := 0; i < count; i++ {
		out = append(out, Challenge{
			ID:     fmt.Sprintf("CH-%d-%d", time.Now().UnixNano(), i),
			Type:   pool[i],
			Status: "pending",
			Nonce:  generateNonce(),
		})
	}
	return out
}

// ─── Challenge nonce binding (H-19 replay protection) ───────────────────────
//
// Every challenge carries a single-use nonce bound to (session ID, challenge
// ID, subject). The nonce is stored at challenge creation and consumed
// atomically at submission; reuse is rejected. Postgres is the store of
// record (multi-replica safe). When no database is configured (single-process
// mode) an in-memory binding map provides the same guarantee locally.

var (
	noncesMu      sync.Mutex
	nonceBindings = map[string]string{} // nonce -> sessionID|challengeID|customerID (db == nil mode only)
)

func generateNonce() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		log.Fatalf("[%s] crypto/rand unavailable: %v", serviceName, err)
	}
	return base64.RawURLEncoding.EncodeToString(b)
}

func nonceBinding(sessionID, challengeID, customerID string) string {
	return sessionID + "|" + challengeID + "|" + customerID
}

// storeChallengeNonce records a freshly issued nonce. With a database, the
// primary key guarantees global uniqueness; a collision is an error.
func storeChallengeNonce(nonce, sessionID, challengeID, customerID string) error {
	if db == nil {
		noncesMu.Lock()
		nonceBindings[nonce] = nonceBinding(sessionID, challengeID, customerID)
		noncesMu.Unlock()
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.ExecContext(ctx,
		`INSERT INTO liveness_challenge_nonces (nonce, session_id, challenge_id, customer_id) VALUES ($1,$2,$3,$4)`,
		nonce, sessionID, challengeID, customerID)
	return err
}

// consumeChallengeNonce atomically marks a nonce used, enforcing single-use
// and binding to session ID + challenge ID + subject. Returns false on
// replay, unknown nonce, or binding mismatch (fail closed on store errors).
func consumeChallengeNonce(nonce, sessionID, challengeID, customerID string) bool {
	if nonce == "" {
		return false
	}
	if db == nil {
		key := nonceBinding(sessionID, challengeID, customerID)
		noncesMu.Lock()
		defer noncesMu.Unlock()
		binding, ok := nonceBindings[nonce]
		if !ok || binding != key {
			return false
		}
		delete(nonceBindings, nonce)
		return true
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	res, err := db.ExecContext(ctx,
		`UPDATE liveness_challenge_nonces SET consumed_at = NOW()
		 WHERE nonce = $1 AND session_id = $2 AND challenge_id = $3 AND customer_id = $4 AND consumed_at IS NULL`,
		nonce, sessionID, challengeID, customerID)
	if err != nil {
		log.Printf("[%s] nonce consume failed (fail closed): %v", serviceName, err)
		return false
	}
	n, err := res.RowsAffected()
	if err != nil || n != 1 {
		return false
	}
	return true
}

// rotateChallengeNonce issues a fresh single-use nonce for a challenge after
// a failed attempt so legitimate retries remain possible while replays of a
// consumed nonce stay rejected. Fail closed: on store error the challenge is
// left without a usable nonce and the submission is rejected.
func rotateChallengeNonce(session *LivenessSession, challengeIdx int) (string, bool) {
	newNonce := generateNonce()
	if err := storeChallengeNonce(newNonce, session.ID, session.Challenges[challengeIdx].ID, session.CustomerID); err != nil {
		log.Printf("[%s] nonce rotation failed: %v", serviceName, err)
		return "", false
	}
	session.Challenges[challengeIdx].Nonce = newNonce
	return newNonce, true
}

// ─── Event Publishing (outbox; relay publishes to Kafka) ────────────────────

func publishEvent(eventType, aggregateID, customerID, tenantID string, data map[string]interface{}) string {
	eventID := generateID("EVT")
	if db == nil {
		log.Printf("[%s] publishEvent %s: no db — event NOT recorded", serviceName, eventType)
		return ""
	}
	payload, err := json.Marshal(map[string]interface{}{
		"eventId": eventID, "type": eventType, "customerId": customerID,
		"tenantId": tenantID, "data": data, "timestamp": time.Now().UTC().Format(time.RFC3339),
	})
	if err != nil {
		return ""
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if _, err := db.ExecContext(ctx,
		`INSERT INTO outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)`,
		eventType, aggregateID, string(payload)); err != nil {
		log.Printf("[%s] outbox insert failed for %s: %v", serviceName, eventType, err)
		return ""
	}
	return eventID
}

// ─── Session Persistence ────────────────────────────────────────────────────

func persistSession(s *LivenessSession) {
	if db == nil {
		return
	}
	payload, err := json.Marshal(s)
	if err != nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err = db.ExecContext(ctx,
		`INSERT INTO liveness_sessions (id, customer_id, tenant_id, status, mode, is_live, verdict, overall_score, payload, started_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, NOW())
		 ON CONFLICT (id) DO UPDATE SET status=$4, is_live=$6, verdict=$7, overall_score=$8, payload=$9, updated_at=NOW()`,
		s.ID, s.CustomerID, s.TenantID, s.Status, s.Mode, s.IsLive, s.Verdict, s.OverallScore, string(payload))
	if err != nil {
		log.Printf("[%s] persist session %s failed: %v", serviceName, s.ID, err)
	}
}

// ─── Handlers ───────────────────────────────────────────────────────────────

func healthHandler(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{
		"status": "healthy", "service": serviceName, "version": "2.0.0",
		"inferenceEngine": inferenceURL(),
	})
}

func livezHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "alive"})
}

func handleCreateSession(w http.ResponseWriter, r *http.Request) {
	var body struct {
		CustomerID     string `json:"customerId"`
		TenantID       string `json:"tenantId"`
		Mode           string `json:"mode"`
		ChallengeCount int    `json:"challengeCount"`
		DevicePlatform string `json:"devicePlatform"`
		DeviceModel    string `json:"deviceModel"`
	}
	json.NewDecoder(r.Body).Decode(&body)
	if body.CustomerID == "" {
		respondJSON(w, 400, map[string]string{"error": "customerId is required"})
		return
	}
	if body.Mode == "" {
		body.Mode = "hybrid"
	}
	if body.ChallengeCount == 0 {
		body.ChallengeCount = 3
	}

	now := time.Now().UTC()
	session := &LivenessSession{
		ID:              generateID("SES"),
		CustomerID:      body.CustomerID,
		TenantID:        body.TenantID,
		Status:          "pending",
		Mode:            body.Mode,
		Challenges:      generateChallenges(body.ChallengeCount),
		DevicePlatform:  body.DevicePlatform,
		DeviceModel:     body.DeviceModel,
		IPAddress:       r.RemoteAddr,
		StartedAt:       now.Format(time.RFC3339),
		ExpiresAt:       now.Add(5 * time.Minute).Format(time.RFC3339),
		MaxAttempts:     3,
	}
	session.ChallengesTotal = len(session.Challenges)
	session.KafkaEventID = publishEvent("session_created", session.ID, body.CustomerID, body.TenantID, nil)

	// H-19: bind each challenge nonce to this session + subject. Fail closed:
	// if the nonce store is unavailable the session is not usable.
	for i := range session.Challenges {
		if err := storeChallengeNonce(session.Challenges[i].Nonce, session.ID, session.Challenges[i].ID, session.CustomerID); err != nil {
			log.Printf("[%s] failed to store challenge nonce: %v", serviceName, err)
			respondJSON(w, 503, map[string]string{"error": "challenge nonce store unavailable"})
			return
		}
	}

	sessionsMu.Lock()
	sessions[session.ID] = session
	sessionsMu.Unlock()
	stats.mu.Lock()
	stats.TotalSessions++
	stats.mu.Unlock()
	persistSession(session)

	respondJSON(w, 201, session)
}

func handleListSessions(w http.ResponseWriter, r *http.Request) {
	listHandler(w, r)
}

// listHandler reads persisted liveness sessions from Postgres.
func listHandler(w http.ResponseWriter, r *http.Request) {
	if db == nil {
		respondJSON(w, 503, map[string]string{"error": "database unavailable"})
		return
	}
	rows, err := db.QueryContext(r.Context(),
		`SELECT payload FROM liveness_sessions ORDER BY started_at DESC LIMIT 100`)
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
	respondJSON(w, 200, map[string]interface{}{"sessions": out, "total": len(out)})
}

func handleGetSession(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/v1/sessions/")
	if id == "" || id == r.URL.Path {
		respondJSON(w, 400, map[string]string{"error": "session id required"})
		return
	}
	sessionsMu.Lock()
	s, ok := sessions[id]
	sessionsMu.Unlock()
	if ok {
		respondJSON(w, 200, s)
		return
	}
	if db != nil {
		var payload string
		err := db.QueryRowContext(r.Context(),
			`SELECT payload FROM liveness_sessions WHERE id = $1`, id).Scan(&payload)
		if err == nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(200)
			w.Write([]byte(payload))
			return
		}
	}
	respondJSON(w, 404, map[string]string{"error": "session not found"})
}

// scoreActiveChallenge submits frames to the inference engine for a real
// verdict. Fail-closed: engine errors fail the challenge and mark the session
// not-live; no local score synthesis.
func handleSubmitFrame(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var body struct {
		SessionID   string `json:"sessionId"`
		ChallengeID string `json:"challengeId"`
		Nonce       string `json:"nonce"`
		FrameBase64 string `json:"frameBase64"`
		FrameIndex  int    `json:"frameIndex"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	sessionsMu.Lock()
	session, exists := sessions[body.SessionID]
	sessionsMu.Unlock()
	if !exists {
		respondJSON(w, 404, map[string]string{"error": "session not found"})
		return
	}

	// H-19: locate the challenge and consume the single-use nonce BEFORE any
	// engine work. Replay, unknown nonce, or session/subject mismatch => reject.
	challengeIdx := -1
	for i := range session.Challenges {
		if session.Challenges[i].ID == body.ChallengeID {
			challengeIdx = i
			break
		}
	}
	if challengeIdx < 0 {
		respondJSON(w, 404, map[string]string{"error": "challenge not found"})
		return
	}
	if session.Challenges[challengeIdx].Status != "pending" {
		respondJSON(w, 409, map[string]string{"error": "challenge already completed"})
		return
	}
	if !consumeChallengeNonce(body.Nonce, session.ID, body.ChallengeID, session.CustomerID) {
		log.Printf("[%s] rejected replayed/invalid nonce for session=%s challenge=%s", serviceName, session.ID, body.ChallengeID)
		respondJSON(w, 401, map[string]string{"error": "invalid_or_reused_nonce"})
		return
	}

	engineResp, err := callEngine("/v1/liveness/check", map[string]interface{}{
		"image":          body.FrameBase64,
		"frameBase64":    body.FrameBase64,
		"sessionId":      body.SessionID,
		"challengeId":    body.ChallengeID,
		"devicePlatform": session.DevicePlatform,
		"deviceModel":    session.DeviceModel,
	})
	if err != nil {
		stats.mu.Lock()
		stats.EngineErrors++
		stats.mu.Unlock()
		log.Printf("[%s] inference engine error: %v", serviceName, err)
		// The submitted nonce is consumed; rotate so a legitimate retry is
		// still possible with a fresh single-use nonce.
		sessionsMu.Lock()
		nextNonce, _ := rotateChallengeNonce(session, challengeIdx)
		sessionsMu.Unlock()
		respondJSON(w, 503, map[string]interface{}{
			"error": "inference_engine_unavailable", "isLive": false,
			"sessionStatus": "failed", "detail": err.Error(),
			"nextNonce": nextNonce,
		})
		return
	}

	isLive, _ := engineBool(engineResp, "isLive", "is_live")
	score, _ := engineFloat(engineResp, "score", "overallScore", "overall_score")

	sessionsMu.Lock()
	session.Status = "in_progress"
	session.Attempts++
	for i := range session.Challenges {
		if session.Challenges[i].ID == body.ChallengeID {
			session.Challenges[i].Attempts++
			session.Challenges[i].Score = score
			if isLive {
				session.Challenges[i].Status = "passed"
				session.ChallengesPassed++
			} else {
				session.Challenges[i].Status = "failed"
			}
		}
	}
	if session.ChallengesTotal > 0 && session.ChallengesPassed == session.ChallengesTotal {
		session.Status = "completed"
		session.IsLive = true
		session.Verdict = "LIVE"
		session.OverallScore = score
		session.CompletedAt = time.Now().UTC().Format(time.RFC3339)
	} else if session.Attempts >= session.MaxAttempts*max(session.ChallengesTotal, 1) {
		session.Status = "failed"
		session.IsLive = false
		session.Verdict = "SPOOF"
		session.CompletedAt = time.Now().UTC().Format(time.RFC3339)
	}
	// H-19: failed attempts consume the submitted nonce; rotate so the next
	// legitimate attempt uses a fresh single-use nonce and replays stay dead.
	var nextNonce string
	if session.Challenges[challengeIdx].Status == "pending" {
		if n, ok := rotateChallengeNonce(session, challengeIdx); ok {
			nextNonce = n
		}
	}
	respSession := *session
	sessionsMu.Unlock()

	persistSession(&respSession)
	if respSession.Status == "completed" || respSession.Status == "failed" {
		publishEvent("session_completed", respSession.ID, respSession.CustomerID, respSession.TenantID,
			map[string]interface{}{"verdict": respSession.Verdict, "score": respSession.OverallScore})
	}

	respondJSON(w, 200, map[string]interface{}{
		"challengeId":   body.ChallengeID,
		"isLive":        isLive,
		"score":         score,
		"sessionStatus": respSession.Status,
		"overallScore":  respSession.OverallScore,
		"passThreshold": passThreshold,
		"nextNonce":     nextNonce,
	})
}

func handleSubmitChallenge(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var body struct {
		SessionID      string   `json:"sessionId"`
		ChallengeID    string   `json:"challengeId"`
		Nonce          string   `json:"nonce"`
		ReferenceFrame string   `json:"referenceFrame"`
		ActionFrames   []string `json:"actionFrames"`
		ChallengeType  string   `json:"challengeType"`
		DevicePlatform string   `json:"devicePlatform"`
		DeviceModel    string   `json:"deviceModel"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	sessionsMu.Lock()
	session, exists := sessions[body.SessionID]
	sessionsMu.Unlock()
	if !exists {
		respondJSON(w, 404, map[string]string{"error": "session not found"})
		return
	}

	// H-19: the challenge must belong to this session, be pending, and carry a
	// valid single-use nonce bound to session ID + subject.
	challengeIdx := -1
	for i := range session.Challenges {
		if session.Challenges[i].ID == body.ChallengeID {
			challengeIdx = i
			break
		}
	}
	if challengeIdx < 0 {
		respondJSON(w, 404, map[string]string{"error": "challenge not found"})
		return
	}
	if session.Challenges[challengeIdx].Status != "pending" {
		respondJSON(w, 409, map[string]string{"error": "challenge already completed"})
		return
	}
	if !consumeChallengeNonce(body.Nonce, session.ID, body.ChallengeID, session.CustomerID) {
		log.Printf("[%s] rejected replayed/invalid nonce for session=%s challenge=%s", serviceName, session.ID, body.ChallengeID)
		respondJSON(w, 401, map[string]string{"error": "invalid_or_reused_nonce"})
		return
	}

	// Real multi-frame motion analysis by the inference engine.
	engineResp, err := callEngine("/v1/motion/analyze", map[string]interface{}{
		"referenceFrame": body.ReferenceFrame,
		"actionFrames":   body.ActionFrames,
		"challengeType":  body.ChallengeType,
		"devicePlatform": body.DevicePlatform,
		"deviceModel":    body.DeviceModel,
	})
	if err != nil {
		stats.mu.Lock()
		stats.EngineErrors++
		stats.mu.Unlock()
		log.Printf("[%s] motion analysis error: %v", serviceName, err)
		// Rotate the consumed nonce so a legitimate retry can use a fresh one.
		sessionsMu.Lock()
		nextNonce, _ := rotateChallengeNonce(session, challengeIdx)
		sessionsMu.Unlock()
		respondJSON(w, 503, map[string]interface{}{
			"error": "inference_engine_unavailable", "isLive": false, "detail": err.Error(),
			"nextNonce": nextNonce,
		})
		return
	}
	isLive, _ := engineBool(engineResp, "isLive", "is_live", "passed")
	score, _ := engineFloat(engineResp, "score", "motionScore", "motion_score")

	// H-19: rotate the nonce after every submission; the consumed value can
	// never be replayed.
	sessionsMu.Lock()
	nextNonce, _ := rotateChallengeNonce(session, challengeIdx)
	sessionsMu.Unlock()

	respondJSON(w, 200, map[string]interface{}{
		"challengeId": body.ChallengeID,
		"isLive":      isLive,
		"score":       score,
		"nextNonce":   nextNonce,
	})
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
	if body.ImageBase64 == "" {
		respondJSON(w, 400, map[string]string{"error": "imageBase64 is required"})
		return
	}

	// Fail-closed: engine error means isLive=false and HTTP 503. Never fall
	// back to a synthesized score.
	engineResp, err := callEngine("/v1/liveness/passive", map[string]interface{}{
		"image":          body.ImageBase64,
		"imageBase64":    body.ImageBase64,
		"customerId":     body.CustomerID,
		"devicePlatform": body.DevicePlatform,
	})
	if err != nil {
		stats.mu.Lock()
		stats.EngineErrors++
		stats.mu.Unlock()
		log.Printf("[%s] passive liveness engine error: %v", serviceName, err)
		respondJSON(w, 503, map[string]interface{}{
			"error": "inference_engine_unavailable", "isLive": false, "verdict": "UNKNOWN",
			"detail": err.Error(),
		})
		return
	}

	isLive, _ := engineBool(engineResp, "isLive", "is_live")
	score, _ := engineFloat(engineResp, "score", "overallScore", "overall_score")
	verdict := "SPOOF"
	if isLive {
		verdict = "LIVE"
	}

	now := time.Now().UTC().Format(time.RFC3339)
	session := &LivenessSession{
		ID:             generateID("PLV"),
		CustomerID:     body.CustomerID,
		TenantID:       body.TenantID,
		Status:         "completed",
		Mode:           "passive",
		OverallScore:   score,
		IsLive:         isLive,
		Verdict:        verdict,
		DevicePlatform: body.DevicePlatform,
		StartedAt:      now,
		CompletedAt:    now,
		AntiSpoof:      &AntiSpoofResult{IsSpoof: !isLive, SpoofType: "none", Confidence: score},
	}
	session.KafkaEventID = publishEvent("passive_liveness_completed", session.ID, body.CustomerID, body.TenantID,
		map[string]interface{}{"score": score, "isLive": isLive})

	stats.mu.Lock()
	stats.TotalSessions++
	if isLive {
		stats.CompletedLive++
	} else {
		stats.CompletedSpoof++
	}
	stats.mu.Unlock()
	sessionsMu.Lock()
	sessions[session.ID] = session
	sessionsMu.Unlock()
	persistSession(session)

	respondJSON(w, 200, session)
}

func handleFaceMatch(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondJSON(w, 405, map[string]string{"error": "POST required"})
		return
	}
	var body FaceMatchRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondJSON(w, 400, map[string]string{"error": "invalid JSON body"})
		return
	}
	if body.Image1 == "" || body.Image2 == "" {
		respondJSON(w, 400, map[string]string{"error": "image1 and image2 are required"})
		return
	}

	// Real face-match via the inference engine. Similarity is NEVER synthesized.
	engineResp, err := callEngine("/v1/face-match", map[string]interface{}{
		"image1":     body.Image1,
		"image2":     body.Image2,
		"customerId": body.CustomerID,
		"purpose":    body.Purpose,
	})
	if err != nil {
		stats.mu.Lock()
		stats.EngineErrors++
		stats.mu.Unlock()
		log.Printf("[%s] face-match engine error: %v", serviceName, err)
		respondJSON(w, 503, map[string]interface{}{
			"error": "face_match_engine_unavailable", "matched": false, "detail": err.Error(),
		})
		return
	}

	sim, simOK := engineFloat(engineResp, "similarity_score", "similarityScore", "similarity")
	matched, matchedOK := engineBool(engineResp, "matched", "match")
	if !matchedOK {
		if !simOK {
			respondJSON(w, 502, map[string]interface{}{
				"error": "face_match_engine_invalid_response", "matched": false,
				"detail": "engine returned neither a match verdict nor a similarity score",
			})
			return
		}
		matched = sim >= 68.0
	}

	result := FaceMatchResponse{
		ID:              generateID("FM"),
		Matched:         matched,
		SimilarityScore: sim,
		Confidence:      sim / 100.0,
		Engine:          inferenceURL(),
		CreatedAt:       time.Now().UTC().Format(time.RFC3339),
	}

	stats.mu.Lock()
	stats.TotalFaceMatches++
	stats.mu.Unlock()
	if db != nil {
		payload, _ := json.Marshal(result)
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		if _, err := db.ExecContext(ctx,
			`INSERT INTO face_matches (id, customer_id, matched, similarity_score, payload)
			 VALUES ($1,$2,$3,$4,$5)`, result.ID, body.CustomerID, matched, sim, string(payload)); err != nil {
			log.Printf("[%s] persist face-match failed: %v", serviceName, err)
		}
		cancel()
	}
	publishEvent("face_match_completed", result.ID, body.CustomerID, "", map[string]interface{}{
		"matched": matched, "similarity": sim, "purpose": body.Purpose,
	})

	respondJSON(w, 200, result)
}

func handleGetFaceMatches(w http.ResponseWriter, r *http.Request) {
	if db == nil {
		respondJSON(w, 503, map[string]string{"error": "database unavailable"})
		return
	}
	rows, err := db.QueryContext(r.Context(),
		`SELECT payload FROM face_matches ORDER BY created_at DESC LIMIT 100`)
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
	respondJSON(w, 200, map[string]interface{}{"faceMatches": out, "total": len(out)})
}

func handleGetEvents(w http.ResponseWriter, r *http.Request) {
	if db == nil {
		respondJSON(w, 503, map[string]string{"error": "database unavailable"})
		return
	}
	rows, err := db.QueryContext(r.Context(),
		`SELECT event_type, aggregate_id, published, created_at FROM outbox ORDER BY created_at DESC LIMIT 100`)
	if err != nil {
		respondJSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()
	var out []map[string]interface{}
	for rows.Next() {
		var et, agg string
		var pub bool
		var created time.Time
		if err := rows.Scan(&et, &agg, &pub, &created); err != nil {
			continue
		}
		out = append(out, map[string]interface{}{
			"eventType": et, "aggregateId": agg, "published": pub, "createdAt": created,
		})
	}
	respondJSON(w, 200, map[string]interface{}{"events": out, "total": len(out)})
}

func handleGetStats(w http.ResponseWriter, r *http.Request) {
	stats.mu.Lock()
	defer stats.mu.Unlock()
	respondJSON(w, 200, map[string]interface{}{
		"totalSessions":    stats.TotalSessions,
		"totalFaceMatches": stats.TotalFaceMatches,
		"completedLive":    stats.CompletedLive,
		"completedSpoof":   stats.CompletedSpoof,
		"engineErrors":     stats.EngineErrors,
	})
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
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
// (RS256 signature + expiry). Fail-closed: no token is accepted on structure
// alone.
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
			fmt.Fprintf(w, `{"error":"unauthorized","service":%q}`, serviceName)
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
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
// Events are marked published ONLY after a confirmed Kafka produce. On Kafka
// failure rows stay unpublished and are retried — nothing is silently lost.

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
	fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"liveness-orchestrator-go\"} %d\n", reqs)
	fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"liveness-orchestrator-go\"} %d\n", errs)
	fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"liveness-orchestrator-go\"} %.0f\n", time.Since(_bootTime).Seconds())
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

func initSchema() {
	_, err := db.Exec(`CREATE TABLE IF NOT EXISTS liveness_sessions (
		id VARCHAR(64) PRIMARY KEY,
		customer_id VARCHAR(128),
		tenant_id VARCHAR(128),
		status VARCHAR(20) NOT NULL DEFAULT 'pending',
		mode VARCHAR(20),
		is_live BOOLEAN DEFAULT FALSE,
		verdict VARCHAR(16),
		overall_score REAL,
		payload JSONB,
		started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`)
	if err != nil {
		log.Fatalf("schema init failed: %v", err)
	}

	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS face_matches (
		id VARCHAR(64) PRIMARY KEY,
		customer_id VARCHAR(128),
		matched BOOLEAN NOT NULL,
		similarity_score REAL,
		payload JSONB,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`)
	if err != nil {
		log.Fatalf("schema init failed: %v", err)
	}

	// Single-use challenge nonces (H-19 replay protection)
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS liveness_challenge_nonces (
		nonce VARCHAR(64) PRIMARY KEY,
		session_id VARCHAR(64) NOT NULL,
		challenge_id VARCHAR(64) NOT NULL,
		customer_id VARCHAR(128) NOT NULL,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		consumed_at TIMESTAMPTZ
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

	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_liveness_sessions_started ON liveness_sessions(started_at DESC)`)
	_, _ = db.Exec(`CREATE INDEX IF NOT EXISTS idx_outbox_unpublished ON outbox(published, created_at) WHERE NOT published`)
}

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Printf("[%s] starting", serviceName)

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
	log.Printf("[%s] database connected, schema initialized", serviceName)

	kafkaBrokers := getEnv("KAFKA_BROKERS", "localhost:9092")
	log.Printf("[%s] inference engine: %s", serviceName, inferenceURL())
	log.Printf("[%s] middleware: keycloak=%s kafka=%s", serviceName, jwtRealmURL(), kafkaBrokers)

	startJWKSRefresh()

	relayCtx, stopRelay := context.WithCancel(context.Background())
	defer stopRelay()
	startOutboxRelay(relayCtx, kafkaBrokers, "liveness.sessions")

	port := getEnv("PORT", "8231")

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthHandler)
	mux.HandleFunc("/readyz", readyzHandler)
	mux.HandleFunc("/livez", livezHandler)
	mux.HandleFunc("/metrics", metricsHandler)
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

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      rateLimitMiddleware(securityHeadersMiddleware(jwtAuthMiddleware(countingMiddleware(mux)))),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		log.Printf("[%s] ready on :%s", serviceName, port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()
	<-quit
	log.Printf("[%s] shutdown signal received", serviceName)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	_ = server.Shutdown(ctx)
	log.Printf("[%s] stopped", serviceName)
}
