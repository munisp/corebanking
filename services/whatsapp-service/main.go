// whatsapp-service — WhatsApp Business Cloud API v18.0 gateway for 54Bank
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

type WAMessage struct {
	ID           string `json:"id"`
	WAMessageID  string `json:"waMessageId"`
	PhoneNumber  string `json:"phoneNumber"`
	Direction    string `json:"direction"`
	TemplateName string `json:"templateName,omitempty"`
	MessageType  string `json:"messageType"`
	Content      string `json:"content"`
	Status       string `json:"status"`
	DeliveredAt  string `json:"deliveredAt,omitempty"`
	ReadAt       string `json:"readAt,omitempty"`
}

type WATemplate struct {
	Name       string                   `json:"name"`
	Language   string                   `json:"language"`
	Category   string                   `json:"category"`
	Status     string                   `json:"status"`
	Components []map[string]interface{} `json:"components"`
}

type WAServer struct {
	mu      sync.RWMutex
	counter int
	msgs    []WAMessage
	tpls    []WATemplate
}

var srv = &WAServer{
	msgs: []WAMessage{
		{ID: "WA-001", WAMessageID: "wamid.HBgLMjM0ODAxMjM0NTY3OBUCABEYEjVDRTU0", PhoneNumber: "+2348012345678", Direction: "outbound", TemplateName: "credit_alert_v2", MessageType: "template", Content: "Credit Alert: ₦500,000.00 from JOHN OKO", Status: "read", DeliveredAt: "2026-05-09T14:30:02Z", ReadAt: "2026-05-09T14:30:15Z"},
		{ID: "WA-002", WAMessageID: "wamid.HBgLMjM0ODA5ODc2NTQzMhUCABEYEjVDRTU1", PhoneNumber: "+2348098765432", Direction: "outbound", TemplateName: "debit_alert_v2", MessageType: "template", Content: "Debit Alert: ₦150,000.00 to Grace Okafor", Status: "delivered", DeliveredAt: "2026-05-09T15:00:01Z"},
	},
	tpls: []WATemplate{
		{Name: "credit_alert_v2", Language: "en", Category: "UTILITY", Status: "APPROVED", Components: []map[string]interface{}{{"type": "BODY", "text": "Credit Alert: {{1}} from {{2}}. Bal: {{3}}"}}},
		{Name: "debit_alert_v2", Language: "en", Category: "UTILITY", Status: "APPROVED", Components: []map[string]interface{}{{"type": "BODY", "text": "Debit Alert: {{1}} to {{2}}. Bal: {{3}}"}}},
		{Name: "otp_delivery_v1", Language: "en", Category: "AUTHENTICATION", Status: "APPROVED", Components: []map[string]interface{}{{"type": "BODY", "text": "Your OTP is {{1}}. Valid for {{2}} minutes."}}},
		{Name: "fraud_alert_v1", Language: "en", Category: "UTILITY", Status: "APPROVED", Components: []map[string]interface{}{{"type": "BODY", "text": "URGENT: Suspicious transaction {{1}} detected. Call 0800-54-BANK."}}},
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
		if isProbePath(p) || p == "/v1/whatsapp/webhook" {
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
	port := getEnv("PORT", "9141")
	r := mux.NewRouter()
	r.HandleFunc("/healthz", healthz).Methods("GET")
	r.HandleFunc("/health", healthz).Methods("GET")
	r.Handle("/metrics", promhttp.Handler())
	r.HandleFunc("/v1/whatsapp/send-template", sendTemplate).Methods("POST")
	r.Handle("/v1/whatsapp/webhook", webhookAuthMiddleware(http.HandlerFunc(webhook))).Methods("GET", "POST")
	r.HandleFunc("/v1/whatsapp/messages", messages).Methods("GET")
	r.HandleFunc("/v1/whatsapp/templates", templates).Methods("GET")
	r.HandleFunc("/v1/whatsapp/stats", stats).Methods("GET")
	log.Printf("[whatsapp-service] WhatsApp Business Cloud API v18.0 on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, jwtAuthMiddleware(r)))
}

func healthz(w http.ResponseWriter, _ *http.Request) {
	respondJSON(w, 200, map[string]interface{}{
		"service": "whatsapp-service", "status": "healthy",
		"apiVersion":   "v18.0",
		"uptime_secs":  int(time.Since(startTime).Seconds()),
		"capabilities": []string{"template_messages", "interactive_buttons", "media_messages", "delivery_webhooks"},
		"middleware": map[string]string{
			"kafka": "whatsapp.outbound, whatsapp.delivery_status",
			"redis": "message_dedup, rate_limit (80msg/s)",
		},
	})
}

func sendTemplate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PhoneNumber  string                   `json:"phoneNumber"`
		TemplateName string                   `json:"templateName"`
		Language     string                   `json:"language"`
		Parameters   []map[string]interface{} `json:"parameters"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	srv.mu.Lock()
	srv.counter++
	msg := WAMessage{
		ID: fmt.Sprintf("WA-%03d", srv.counter+2), WAMessageID: fmt.Sprintf("wamid.%d", time.Now().UnixNano()),
		PhoneNumber: req.PhoneNumber, Direction: "outbound",
		TemplateName: req.TemplateName, MessageType: "template",
		Content: "Template message sent", Status: "accepted",
	}
	srv.msgs = append(srv.msgs, msg)
	srv.mu.Unlock()
	respondJSON(w, 201, map[string]interface{}{"success": true, "message": msg})
}

func webhook(w http.ResponseWriter, r *http.Request) {
	if r.Method == "GET" {
		respondJSON(w, 200, map[string]string{"hub.challenge": r.URL.Query().Get("hub.challenge")})
		return
	}
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	respondJSON(w, 200, map[string]interface{}{"processed": true, "event": body})
}

func messages(w http.ResponseWriter, _ *http.Request) {
	srv.mu.RLock()
	defer srv.mu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{"messages": srv.msgs, "total": len(srv.msgs)})
}

func templates(w http.ResponseWriter, _ *http.Request) {
	respondJSON(w, 200, map[string]interface{}{"templates": srv.tpls, "total": len(srv.tpls)})
}

func stats(w http.ResponseWriter, _ *http.Request) {
	srv.mu.RLock()
	defer srv.mu.RUnlock()
	respondJSON(w, 200, map[string]interface{}{
		"channel": "whatsapp", "apiVersion": "v18.0",
		"sentToday": 95000, "deliveryRatePct": 99.4, "avgLatencyMs": 1200,
		"totalMessages": len(srv.msgs), "templates": len(srv.tpls),
	})
}
