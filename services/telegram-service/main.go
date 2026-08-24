// telegram-service — Telegram Bot API gateway for 54Bank
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
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var startTime = time.Now()

func getEnv(k, v string) string {
	if val := os.Getenv(k); val != "" {
		return val
	}
	return v
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

type Message struct {
	ID        string `json:"id"`
	ChatID    int64  `json:"chatId"`
	Direction string `json:"direction"`
	Text      string `json:"text"`
	Status    string `json:"status"`
	SentAt    string `json:"sentAt"`
}

type TGServer struct {
	mu      sync.RWMutex
	counter int
	msgs    []Message
}

var srv = &TGServer{
	msgs: []Message{
		{ID: "TG-001", ChatID: 1234567890, Direction: "inbound", Text: "/balance", Status: "processed", SentAt: "2026-05-09T10:00:00Z"},
		{ID: "TG-002", ChatID: 1234567890, Direction: "outbound", Text: "Your balance is ₦1,250,000.00", Status: "delivered", SentAt: "2026-05-09T10:00:01Z"},
	},
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
		if isProbePath(p) || p == "/v1/telegram/webhook" {
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
	port := getEnv("PORT", "9042")
	r := mux.NewRouter()
	r.HandleFunc("/healthz", healthz).Methods("GET")
	r.HandleFunc("/health", healthz).Methods("GET")
	r.Handle("/metrics", promhttp.Handler())
	r.Handle("/v1/telegram/webhook", webhookAuthMiddleware(http.HandlerFunc(webhook))).Methods("POST")
	r.HandleFunc("/v1/telegram/send", send).Methods("POST")
	r.HandleFunc("/v1/telegram/messages", messages).Methods("GET")
	r.HandleFunc("/v1/telegram/commands", commands).Methods("GET")
	r.HandleFunc("/v1/telegram/stats", stats).Methods("GET")
	log.Printf("[telegram-service] Telegram Bot API gateway on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, jwtAuthMiddleware(r)))
}

func healthz(w http.ResponseWriter, _ *http.Request) {
	respondJSON(w, 200, map[string]interface{}{
		"service": "telegram-service", "status": "healthy",
		"uptime_secs":   int(time.Since(startTime).Seconds()),
		"botApiVersion": "7.0",
		"capabilities":  []string{"webhook", "send_message", "banking_commands"},
	})
}

func webhook(w http.ResponseWriter, r *http.Request) {
	var update struct {
		UpdateID int64 `json:"update_id"`
		Message  *struct {
			Chat struct {
				ID int64 `json:"id"`
			} `json:"chat"`
			Text string `json:"text"`
		} `json:"message"`
	}
	json.NewDecoder(r.Body).Decode(&update)
	if update.Message == nil {
		respondJSON(w, 200, map[string]bool{"ok": true})
		return
	}
	srv.mu.Lock()
	srv.counter++
	srv.msgs = append(srv.msgs, Message{
		ID: fmt.Sprintf("TG-%03d", srv.counter), ChatID: update.Message.Chat.ID,
		Direction: "inbound", Text: update.Message.Text, Status: "received",
		SentAt: time.Now().UTC().Format(time.RFC3339),
	})
	reply := buildReply(update.Message.Chat.ID, update.Message.Text)
	srv.counter++
	srv.msgs = append(srv.msgs, reply)
	srv.mu.Unlock()
	respondJSON(w, 200, map[string]interface{}{"ok": true, "reply": reply.Text})
}

func buildReply(chatID int64, text string) Message {
	cmd := strings.ToLower(strings.SplitN(strings.TrimSpace(text), " ", 2)[0])
	var body string
	switch cmd {
	case "/balance":
		body = "💰 Balance: ₦1,250,000.00 | Available: ₦1,150,000.00\nAs at: " + time.Now().Format("02 Jan 2006 15:04")
	case "/statement":
		body = "📋 Last 5 Transactions:\n1. -₦5,000 Transfer\n2. +₦10,000 Deposit\n3. -₦500 Airtime\n4. -₦2,000 Bills\n5. +₦50,000 Salary"
	case "/transfer":
		body = "💸 Format: /transfer <10-digit account> <amount>"
	case "/airtime":
		body = "📱 Format: /airtime <phone> <amount>"
	default:
		body = "🏦 54Bank Telegram Banking\n/balance /transfer /statement /airtime /bills /help"
	}
	return Message{
		ID: fmt.Sprintf("TG-%03d", srv.counter), ChatID: chatID,
		Direction: "outbound", Text: body, Status: "queued",
		SentAt: time.Now().UTC().Format(time.RFC3339),
	}
}

func send(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ChatID int64  `json:"chatId"`
		Text   string `json:"text"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	srv.mu.Lock()
	srv.counter++
	msg := Message{
		ID: fmt.Sprintf("TG-%03d", srv.counter), ChatID: req.ChatID,
		Direction: "outbound", Text: req.Text, Status: "queued",
		SentAt: time.Now().UTC().Format(time.RFC3339),
	}
	srv.msgs = append(srv.msgs, msg)
	srv.mu.Unlock()
	respondJSON(w, 201, map[string]interface{}{"ok": true, "message": msg})
}

func messages(w http.ResponseWriter, _ *http.Request) {
	srv.mu.RLock()
	defer srv.mu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{"messages": srv.msgs, "total": len(srv.msgs)})
}

func commands(w http.ResponseWriter, _ *http.Request) {
	respondJSON(w, 200, map[string]interface{}{"commands": []map[string]string{
		{"command": "/balance", "description": "Check account balance"},
		{"command": "/transfer", "description": "Transfer funds"},
		{"command": "/statement", "description": "Mini statement"},
		{"command": "/airtime", "description": "Buy airtime"},
		{"command": "/bills", "description": "Pay bills"},
		{"command": "/help", "description": "Show commands"},
	}, "total": 6})
}

func stats(w http.ResponseWriter, _ *http.Request) {
	srv.mu.RLock()
	defer srv.mu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{
		"channel": "telegram", "totalMessages": len(srv.msgs),
		"botApiVersion": "7.0", "uptime_secs": int(time.Since(startTime).Seconds()),
	})
}
