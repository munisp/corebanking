package main

import (
	"bytes"
	"context"
	"crypto"
	"crypto/hmac"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"io"
	"log"
	"math/big"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

type ChatbotServer struct {
	router *mux.Router
	engine *ChatbotEngine
}

type ChatRequest struct {
	TenantID   string                 `json:"tenant_id"`
	CustomerID string                 `json:"customer_id"`
	SessionID  string                 `json:"session_id"`
	Message    string                 `json:"message"`
	Channel    string                 `json:"channel"` // web, mobile, whatsapp, telegram
	Context    map[string]interface{} `json:"context,omitempty"`
	Language   string                 `json:"language,omitempty"`
}

type ChatResponse struct {
	SessionID    string                 `json:"session_id"`
	Response     string                 `json:"response"`
	Intent       string                 `json:"intent"`
	Confidence   float64                `json:"confidence"`
	Actions      []ChatAction           `json:"actions,omitempty"`
	QuickReplies []string               `json:"quick_replies,omitempty"`
	Context      map[string]interface{} `json:"context,omitempty"`
}

type ChatAction struct {
	Type       string                 `json:"type"` // transfer, balance, statement, support
	Parameters map[string]interface{} `json:"parameters"`
	Confirmed  bool                   `json:"confirmed"`
}

type IntentConfig struct {
	Intent      string   `json:"intent"`
	Patterns    []string `json:"patterns"`
	Responses   []string `json:"responses"`
	Actions     []string `json:"actions,omitempty"`
	RequireAuth bool     `json:"require_auth"`
}

func NewChatbotServer() *ChatbotServer {
	server := &ChatbotServer{
		router: mux.NewRouter(),
		engine: NewChatbotEngine(),
	}
	server.setupRoutes()
	return server
}

func (s *ChatbotServer) setupRoutes() {
	s.router.HandleFunc("/health", s.healthHandler).Methods("GET")
	s.router.HandleFunc("/ready", s.readyHandler).Methods("GET")
	s.router.Handle("/metrics", promhttp.Handler())

	api := s.router.PathPrefix("/api/v1").Subrouter()

	// Chat endpoints
	api.HandleFunc("/chatbot/chat", s.chatHandler).Methods("POST")
	api.HandleFunc("/chatbot/session/{sessionId}", s.getSessionHandler).Methods("GET")
	api.HandleFunc("/chatbot/session/{sessionId}/end", s.endSessionHandler).Methods("POST")
	api.HandleFunc("/chatbot/session/{sessionId}/history", s.getHistoryHandler).Methods("GET")

	// Intent management
	api.HandleFunc("/chatbot/intents", s.getIntentsHandler).Methods("GET")
	api.HandleFunc("/chatbot/intents", s.createIntentHandler).Methods("POST")
	api.HandleFunc("/chatbot/intents/{intentId}", s.updateIntentHandler).Methods("PUT")
	api.HandleFunc("/chatbot/intents/{intentId}", s.deleteIntentHandler).Methods("DELETE")

	// Training
	api.HandleFunc("/chatbot/train", s.trainHandler).Methods("POST")
	api.HandleFunc("/chatbot/train/status", s.getTrainingStatusHandler).Methods("GET")

	// Analytics
	api.HandleFunc("/chatbot/analytics/conversations", s.getConversationAnalyticsHandler).Methods("GET")
	api.HandleFunc("/chatbot/analytics/intents", s.getIntentAnalyticsHandler).Methods("GET")
	api.HandleFunc("/chatbot/analytics/satisfaction", s.getSatisfactionHandler).Methods("GET")

	// Handoff to human
	api.HandleFunc("/chatbot/handoff", s.requestHandoffHandler).Methods("POST")
	api.HandleFunc("/chatbot/handoff/{sessionId}/accept", s.acceptHandoffHandler).Methods("POST")

	// Webhooks for external channels
	api.Handle("/chatbot/webhook/whatsapp", webhookAuthMiddleware(http.HandlerFunc(s.whatsappWebhookHandler))).Methods("POST")
	api.Handle("/chatbot/webhook/telegram", webhookAuthMiddleware(http.HandlerFunc(s.telegramWebhookHandler))).Methods("POST")
	api.Handle("/chatbot/webhook/facebook", webhookAuthMiddleware(http.HandlerFunc(s.facebookWebhookHandler))).Methods("POST")
}

func (s *ChatbotServer) healthHandler(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
}

func (s *ChatbotServer) readyHandler(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]bool{"ready": true})
}

func (s *ChatbotServer) chatHandler(w http.ResponseWriter, r *http.Request) {
	var req ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	response, err := s.engine.ProcessMessage(req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(response)
}

func (s *ChatbotServer) getSessionHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["sessionId"]

	session, err := s.engine.GetSession(sessionID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(session)
}

func (s *ChatbotServer) endSessionHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["sessionId"]

	err := s.engine.EndSession(sessionID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]bool{"ended": true})
}

func (s *ChatbotServer) getHistoryHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["sessionId"]

	history, err := s.engine.GetHistory(sessionID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(history)
}

func (s *ChatbotServer) getIntentsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")

	intents, err := s.engine.GetIntents(tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(intents)
}

func (s *ChatbotServer) createIntentHandler(w http.ResponseWriter, r *http.Request) {
	var req IntentConfig
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	tenantID := r.Header.Get("X-Tenant-ID")
	intent, err := s.engine.CreateIntent(tenantID, req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(intent)
}

func (s *ChatbotServer) updateIntentHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	intentID := vars["intentId"]

	var req IntentConfig
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	tenantID := r.Header.Get("X-Tenant-ID")
	intent, err := s.engine.UpdateIntent(tenantID, intentID, req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(intent)
}

func (s *ChatbotServer) deleteIntentHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	intentID := vars["intentId"]
	tenantID := r.Header.Get("X-Tenant-ID")

	err := s.engine.DeleteIntent(tenantID, intentID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s *ChatbotServer) trainHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")

	jobID, err := s.engine.StartTraining(tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"job_id": jobID, "status": "started"})
}

func (s *ChatbotServer) getTrainingStatusHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")

	status, err := s.engine.GetTrainingStatus(tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(status)
}

func (s *ChatbotServer) getConversationAnalyticsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")

	analytics, err := s.engine.GetConversationAnalytics(tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(analytics)
}

func (s *ChatbotServer) getIntentAnalyticsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")

	analytics, err := s.engine.GetIntentAnalytics(tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(analytics)
}

func (s *ChatbotServer) getSatisfactionHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")

	satisfaction, err := s.engine.GetSatisfactionMetrics(tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(satisfaction)
}

func (s *ChatbotServer) requestHandoffHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SessionID string `json:"session_id"`
		Reason    string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result, err := s.engine.RequestHandoff(req.SessionID, req.Reason)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(result)
}

func (s *ChatbotServer) acceptHandoffHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["sessionId"]

	var req struct {
		AgentID string `json:"agent_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result, err := s.engine.AcceptHandoff(sessionID, req.AgentID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(result)
}

func (s *ChatbotServer) whatsappWebhookHandler(w http.ResponseWriter, r *http.Request) {
	var payload map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	err := s.engine.ProcessWhatsAppMessage(payload)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]bool{"received": true})
}

func (s *ChatbotServer) telegramWebhookHandler(w http.ResponseWriter, r *http.Request) {
	var payload map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	err := s.engine.ProcessTelegramMessage(payload)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]bool{"received": true})
}

func (s *ChatbotServer) facebookWebhookHandler(w http.ResponseWriter, r *http.Request) {
	var payload map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	err := s.engine.ProcessFacebookMessage(payload)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]bool{"received": true})
}

// jwtAuthMiddleware validates Bearer tokens against the Keycloak JWKS endpoint
// (RS256 signature + required exp claim). Fail-closed: any verification
// problem yields 401. Identity headers (X-User-Id, X-Keycloak-ID, X-Tenant-ID,
// X-User-Role) are overwritten from verified claims — caller-supplied values
// are never trusted.
func jwtAuthMiddleware(next http.Handler) http.Handler {
	ensureJWKSRefresh()
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if isProbePath(p) || strings.HasPrefix(p, "/api/v1/chatbot/webhook/") {
			next.ServeHTTP(w, r)
			return
		}
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			http.Error(w, `{"error":"missing bearer token"}`, http.StatusUnauthorized)
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
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
		if err := json.Unmarshal(headerBytes, &header); err != nil || header.Kid == "" {
			http.Error(w, `{"error":"invalid token header"}`, http.StatusUnauthorized)
			return
		}
		if header.Alg != "RS256" {
			http.Error(w, `{"error":"unsupported token algorithm"}`, http.StatusUnauthorized)
			return
		}
		jwtCache.mu.RLock()
		pub, ok := jwtCache.keys[header.Kid]
		jwtCache.mu.RUnlock()
		if !ok {
			// Unknown key — refresh once and retry (key rotation).
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
		claimsBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
		if err != nil {
			http.Error(w, `{"error":"invalid claims encoding"}`, http.StatusUnauthorized)
			return
		}
		var claims map[string]interface{}
		if err := json.Unmarshal(claimsBytes, &claims); err != nil {
			http.Error(w, `{"error":"invalid claims"}`, http.StatusUnauthorized)
			return
		}
		exp, ok := claims["exp"].(float64)
		if !ok {
			http.Error(w, `{"error":"token missing exp claim"}`, http.StatusUnauthorized)
			return
		}
		if time.Now().Unix() >= int64(exp) {
			http.Error(w, `{"error":"token expired"}`, http.StatusUnauthorized)
			return
		}
		// Identity headers come ONLY from verified claims; overwrite or drop any
		// caller-supplied values before invoking the handler.
		if sub, ok := claims["sub"].(string); ok && sub != "" {
			r.Header.Set("X-User-Id", sub)
			r.Header.Set("X-Keycloak-ID", sub)
		} else {
			r.Header.Del("X-User-Id")
			r.Header.Del("X-Keycloak-ID")
		}
		if tenant := tenantFromClaims(claims); tenant != "" {
			r.Header.Set("X-Tenant-ID", tenant)
		} else {
			r.Header.Del("X-Tenant-ID")
		}
		r.Header.Del("X-User-Role")
		if ra, ok := claims["realm_access"].(map[string]interface{}); ok {
			if roleList, ok := ra["roles"].([]interface{}); ok {
				roles := make([]string, 0, len(roleList))
				for _, v := range roleList {
					if s, ok := v.(string); ok {
						roles = append(roles, s)
					}
				}
				if len(roles) > 0 {
					r.Header.Set("X-User-Role", strings.Join(roles, ","))
				}
			}
		}
		ctx := context.WithValue(r.Context(), "jwt_claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// --- Webhook HMAC verification (fail-closed) ---
// Provider webhooks are server-to-server calls: no end-user JWT exists.
// They are authenticated with a shared-secret HMAC-SHA256 signature over the
// raw request body (X-Webhook-Signature hex header, or the Meta-style
// X-Hub-Signature-256 "sha256=<hex>" header). WEBHOOK_SECRET is REQUIRED
// (no default): the process refuses to start without it.
var webhookHMACSecret = func() []byte {
	s := os.Getenv("WEBHOOK_SECRET")
	if s == "" {
		log.Fatalf("WEBHOOK_SECRET is not set; refusing to start a webhook receiver without a shared secret (fail-closed)")
	}
	return []byte(s)
}()

// webhookAuthMiddleware enforces HMAC-SHA256 body signatures on provider
// webhook endpoints. GET (provider verification handshake) requires the
// hub.verify_token query parameter to match the shared secret.
func webhookAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			if subtle.ConstantTimeCompare([]byte(r.URL.Query().Get("hub.verify_token")), webhookHMACSecret) != 1 {
				http.Error(w, `{"error":"invalid webhook verification token"}`, http.StatusUnauthorized)
				return
			}
			next.ServeHTTP(w, r)
			return
		}
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, `{"error":"webhook body read failed"}`, http.StatusBadRequest)
			return
		}
		r.Body = io.NopCloser(bytes.NewReader(body))
		sig := r.Header.Get("X-Webhook-Signature")
		if sig == "" {
			sig = strings.TrimPrefix(r.Header.Get("X-Hub-Signature-256"), "sha256=")
		}
		provided, err := hex.DecodeString(sig)
		if err != nil {
			http.Error(w, `{"error":"invalid webhook signature encoding"}`, http.StatusUnauthorized)
			return
		}
		mac := hmac.New(sha256.New, webhookHMACSecret)
		mac.Write(body)
		if !hmac.Equal(provided, mac.Sum(nil)) {
			http.Error(w, `{"error":"invalid webhook signature"}`, http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// --- JWT Validation (Keycloak JWKS, RS256, fail-closed) ---

type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}

var jwksRefreshOnce sync.Once

// jwtRealmURL returns the Keycloak realm base URL used to fetch JWKS keys.
func jwtRealmURL() string {
	if v := os.Getenv("KEYCLOAK_REALM_URL"); v != "" {
		return v
	}
	return "http://keycloak:8080/realms/54bank"
}

// fetchJWKS refreshes the RSA public keys used to verify Bearer tokens.
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
		nBytes, err := base64.RawURLEncoding.DecodeString(k.N)
		if err != nil || len(nBytes) == 0 {
			continue
		}
		eBytes, err := base64.RawURLEncoding.DecodeString(k.E)
		if err != nil || len(eBytes) == 0 {
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

// ensureJWKSRefresh starts the initial JWKS fetch and the 5-minute refresher
// exactly once per process.
func ensureJWKSRefresh() {
	jwksRefreshOnce.Do(func() {
		go fetchJWKS(jwtRealmURL())
		go func() {
			ticker := time.NewTicker(5 * time.Minute)
			defer ticker.Stop()
			for range ticker.C {
				fetchJWKS(jwtRealmURL())
			}
		}()
	})
}

// isProbePath reports whether p is a health/metrics endpoint that must remain
// unauthenticated for orchestrators (exact or suffixed probe paths).
func isProbePath(p string) bool {
	switch p {
	case "/healthz", "/health", "/readyz", "/ready", "/livez", "/live", "/metrics", "/ping":
		return true
	}
	for _, s := range []string{"/healthz", "/health", "/readyz", "/ready", "/livez", "/live", "/metrics"} {
		if strings.HasSuffix(p, s) {
			return true
		}
	}
	return false
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

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	server := NewChatbotServer()

	httpServer := &http.Server{
		Addr:         ":" + port,
		Handler:      jwtAuthMiddleware(server.router),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("Chatbot service starting on port %s", port)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down chatbot service...")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Chatbot service stopped")
}

// ChatbotEngine stub - integrates with chatbot.go
type ChatbotEngine struct{}

func NewChatbotEngine() *ChatbotEngine {
	return &ChatbotEngine{}
}

func (e *ChatbotEngine) ProcessMessage(req ChatRequest) (*ChatResponse, error) {
	intent := "balance_inquiry"
	response := "Your current balance is NGN 50,000.00"

	if req.Message == "" {
		response = "Hello! How can I help you today?"
		intent = "greeting"
	}

	return &ChatResponse{
		SessionID:    req.SessionID,
		Response:     response,
		Intent:       intent,
		Confidence:   0.95,
		QuickReplies: []string{"Check Balance", "Transfer Money", "Pay Bills", "Talk to Agent"},
	}, nil
}

func (e *ChatbotEngine) GetSession(sessionID string) (map[string]interface{}, error) {
	return map[string]interface{}{
		"session_id": sessionID,
		"started_at": time.Now().Add(-10 * time.Minute).Format(time.RFC3339),
		"status":     "active",
	}, nil
}

func (e *ChatbotEngine) EndSession(sessionID string) error {
	return nil
}

func (e *ChatbotEngine) GetHistory(sessionID string) ([]map[string]interface{}, error) {
	return []map[string]interface{}{
		{"role": "user", "message": "Hello", "timestamp": time.Now().Format(time.RFC3339)},
		{"role": "bot", "message": "Hello! How can I help you?", "timestamp": time.Now().Format(time.RFC3339)},
	}, nil
}

func (e *ChatbotEngine) GetIntents(tenantID string) ([]IntentConfig, error) {
	return []IntentConfig{
		{Intent: "balance_inquiry", Patterns: []string{"balance", "how much"}},
		{Intent: "transfer", Patterns: []string{"send money", "transfer"}},
	}, nil
}

func (e *ChatbotEngine) CreateIntent(tenantID string, config IntentConfig) (*IntentConfig, error) {
	return &config, nil
}

func (e *ChatbotEngine) UpdateIntent(tenantID, intentID string, config IntentConfig) (*IntentConfig, error) {
	return &config, nil
}

func (e *ChatbotEngine) DeleteIntent(tenantID, intentID string) error {
	return nil
}

func (e *ChatbotEngine) StartTraining(tenantID string) (string, error) {
	return "job_" + tenantID, nil
}

func (e *ChatbotEngine) GetTrainingStatus(tenantID string) (map[string]interface{}, error) {
	return map[string]interface{}{"status": "completed", "accuracy": 0.92}, nil
}

func (e *ChatbotEngine) GetConversationAnalytics(tenantID string) (map[string]interface{}, error) {
	return map[string]interface{}{
		"total_conversations":  1000,
		"avg_duration_seconds": 120,
		"resolution_rate":      0.85,
	}, nil
}

func (e *ChatbotEngine) GetIntentAnalytics(tenantID string) (map[string]interface{}, error) {
	return map[string]interface{}{
		"top_intents": []string{"balance_inquiry", "transfer", "bill_payment"},
	}, nil
}

func (e *ChatbotEngine) GetSatisfactionMetrics(tenantID string) (map[string]interface{}, error) {
	return map[string]interface{}{"csat_score": 4.2, "nps": 45}, nil
}

func (e *ChatbotEngine) RequestHandoff(sessionID, reason string) (map[string]interface{}, error) {
	return map[string]interface{}{"handoff_id": "hoff_" + sessionID, "status": "pending"}, nil
}

func (e *ChatbotEngine) AcceptHandoff(sessionID, agentID string) (map[string]interface{}, error) {
	return map[string]interface{}{"status": "accepted", "agent_id": agentID}, nil
}

func (e *ChatbotEngine) ProcessWhatsAppMessage(payload map[string]interface{}) error {
	return nil
}

func (e *ChatbotEngine) ProcessTelegramMessage(payload map[string]interface{}) error {
	return nil
}

func (e *ChatbotEngine) ProcessFacebookMessage(payload map[string]interface{}) error {
	return nil
}
