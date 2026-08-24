// ussd-gateway-service — USSD session gateway and Africa's Talking integration for 54Bank
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
	"errors"
	"fmt"
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
)

var startTime = time.Now()

const (
	sessionTTL  = 120 * time.Second
	maxBodySize = 1 << 20 // 1MB
)

func getEnv(k, v string) string {
	if val := os.Getenv(k); val != "" {
		return val
	}

	return v
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")

	w.WriteHeader(code)

	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("failed to encode response: %v", err)
	}
}

type USSDSession struct {
	ID           string    `json:"id"`
	SessionID    string    `json:"sessionId"`
	MSISDN       string    `json:"msisdn"`
	ServiceCode  string    `json:"serviceCode"`
	Text         string    `json:"text"`
	State        string    `json:"state"`
	MenuLevel    int       `json:"menuLevel"`
	StartedAt    time.Time `json:"startedAt"`
	LastActivity time.Time `json:"lastActivity"`
}

type USSDSummary struct {
	SessionsToday   int      `json:"sessionsToday"`
	CompletedToday  int      `json:"completedToday"`
	DroppedToday    int      `json:"droppedToday"`
	AvgSessionSteps float64  `json:"avgSessionSteps"`
	PopularMenus    []string `json:"popularMenus"`
}

var (
	mu      sync.RWMutex
	counter = 1

	sessions = map[string]*USSDSession{
		"session-001": {
			ID:           "USSD-001",
			SessionID:    "session-001",
			MSISDN:       "+2348012345678",
			ServiceCode:  "*737#",
			Text:         "1*1",
			State:        "active",
			MenuLevel:    2,
			StartedAt:    time.Now().UTC(),
			LastActivity: time.Now().UTC(),
		},
	}
)

// jwtAuthMiddleware validates Bearer tokens against the Keycloak JWKS endpoint
// (RS256 signature + required exp claim). Fail-closed: any verification
// problem yields 401. Identity headers (X-User-Id, X-Keycloak-ID, X-Tenant-ID,
// X-User-Role) are overwritten from verified claims — caller-supplied values
// are never trusted.
func jwtAuthMiddleware(next http.Handler) http.Handler {
	ensureJWKSRefresh()
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if isProbePath(p) || p == "/v1/ussd/callback" {
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
	port := getEnv("PORT", "9172")

	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", healthz)
	mux.HandleFunc("/health", healthz)

	mux.Handle("/v1/ussd/callback", webhookAuthMiddleware(http.HandlerFunc(ussdCallback)))
	mux.HandleFunc("/v1/ussd/sessions", getSessions)
	mux.HandleFunc("/v1/ussd/stats", getStats)

	server := &http.Server{
		Addr:              ":" + port,
		Handler:           loggingMiddleware(jwtAuthMiddleware(mux)),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       30 * time.Second,
	}

	go cleanupExpiredSessions()

	go func() {
		log.Printf(
			"[ussd-gateway-service] USSD gateway running on :%s",
			port,
		)

		if err := server.ListenAndServe(); err != nil &&
			!errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server failed: %v", err)
		}
	}()

	waitForShutdown(server)
}

func healthz(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(
			w,
			"method not allowed",
			http.StatusMethodNotAllowed,
		)

		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"service":        "ussd-gateway-service",
		"status":         "healthy",
		"provider":       "Africa's Talking USSD",
		"uptime_secs":    int(time.Since(startTime).Seconds()),
		"activeSessions": activeSessionCount(),
		"serviceCodes": []string{
			"*737#",
			"*737*1#",
		},
		"middleware": map[string]string{
			"redis": "session_store (TTL 120s)",
			"kafka": "ussd.sessions",
		},
	})
}

func ussdCallback(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(
			w,
			"method not allowed",
			http.StatusMethodNotAllowed,
		)

		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxBodySize)

	if err := r.ParseForm(); err != nil {
		http.Error(
			w,
			"invalid form payload",
			http.StatusBadRequest,
		)

		return
	}

	sessionID := strings.TrimSpace(r.FormValue("sessionId"))
	msisdn := strings.TrimSpace(r.FormValue("phoneNumber"))
	serviceCode := strings.TrimSpace(r.FormValue("serviceCode"))
	text := strings.TrimSpace(r.FormValue("text"))

	if sessionID == "" ||
		msisdn == "" ||
		serviceCode == "" {

		http.Error(
			w,
			"missing required fields",
			http.StatusBadRequest,
		)

		return
	}

	now := time.Now().UTC()

	mu.Lock()

	existing, exists := sessions[sessionID]

	if exists {
		existing.Text = text
		existing.LastActivity = now
		existing.MenuLevel = calculateMenuLevel(text)
	} else {
		counter++

		sessions[sessionID] = &USSDSession{
			ID:           fmt.Sprintf("USSD-%03d", counter),
			SessionID:    sessionID,
			MSISDN:       msisdn,
			ServiceCode:  serviceCode,
			Text:         text,
			State:        "active",
			MenuLevel:    calculateMenuLevel(text),
			StartedAt:    now,
			LastActivity: now,
		}
	}

	mu.Unlock()

	response := buildUSSDResponse(text)

	w.Header().Set("Content-Type", "text/plain")

	if _, err := w.Write([]byte(response)); err != nil {
		log.Printf("failed to write response: %v", err)
	}
}

func getSessions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(
			w,
			"method not allowed",
			http.StatusMethodNotAllowed,
		)

		return
	}

	mu.RLock()

	sessionList := make([]USSDSession, 0, len(sessions))

	for _, session := range sessions {
		sessionList = append(sessionList, *session)
	}

	mu.RUnlock()

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"sessions": sessionList,
		"total":    len(sessionList),
	})
}

func getStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(
			w,
			"method not allowed",
			http.StatusMethodNotAllowed,
		)

		return
	}

	stats := USSDSummary{
		SessionsToday:   28400,
		CompletedToday:  27900,
		DroppedToday:    500,
		AvgSessionSteps: 3.2,
		PopularMenus: []string{
			"balance",
			"transfer",
			"airtime",
		},
	}

	respondJSON(w, http.StatusOK, stats)
}

func calculateMenuLevel(text string) int {
	if text == "" {
		return 0
	}

	return len(strings.Split(text, "*"))
}

func buildUSSDResponse(text string) string {
	switch text {

	case "":
		return `CON Welcome to 54Bank
1. Check Balance
2. Transfer Funds
3. Buy Airtime
4. Pay Bills
0. Exit`

	case "1":
		return `END Your account balance is ₦1,250,000.00`

	case "2":
		return `CON Enter recipient account number`

	case "3":
		return `CON Enter phone number for airtime purchase`

	case "4":
		return `CON Select bill type
1. Electricity
2. Cable TV
3. Internet`

	case "0":
		return `END Thank you for using 54Bank`

	default:
		return `END Invalid option selected`
	}
}

func cleanupExpiredSessions() {
	ticker := time.NewTicker(30 * time.Second)

	defer ticker.Stop()

	for range ticker.C {
		now := time.Now().UTC()

		mu.Lock()

		for key, session := range sessions {
			if now.Sub(session.LastActivity) > sessionTTL {
				delete(sessions, key)
			}
		}

		mu.Unlock()
	}
}

func activeSessionCount() int {
	mu.RLock()
	defer mu.RUnlock()

	return len(sessions)
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		next.ServeHTTP(w, r)

		log.Printf(
			"%s %s %s",
			r.Method,
			r.URL.Path,
			time.Since(start),
		)
	})
}

func waitForShutdown(server *http.Server) {
	stop := make(chan os.Signal, 1)

	signal.Notify(
		stop,
		syscall.SIGINT,
		syscall.SIGTERM,
	)

	<-stop

	log.Println("shutting down ussd-gateway-service...")

	ctx, cancel := context.WithTimeout(
		context.Background(),
		10*time.Second,
	)

	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Printf("graceful shutdown failed: %v", err)
	}

	log.Println("ussd-gateway-service stopped")
}
