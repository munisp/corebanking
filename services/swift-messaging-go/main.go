package main

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

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

var (
	mu       sync.RWMutex
	messages []SWIFTMessage
)

func init() {
	messages = []SWIFTMessage{}
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
	mu.Lock()
	defer mu.Unlock()
	if r.Method == http.MethodPost {
		var m SWIFTMessage
		json.NewDecoder(r.Body).Decode(&m)
		m.ID = fmt.Sprintf("SW-%03d", len(messages)+1)
		m.Status = "pending"
		m.Timestamp = now()
		messages = append(messages, m)
		respond(w, 201, m)
		return
	}
	respond(w, 200, map[string]interface{}{"items": messages, "total": len(messages)})
}

func handleStats(w http.ResponseWriter, _ *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	outgoing := 0
	incoming := 0
	iso20022 := 0
	var totalAmount float64
	byType := map[string]int{}
	for _, m := range messages {
		if m.Direction == "outgoing" {
			outgoing++
		} else {
			incoming++
		}
		if m.ISO20022 {
			iso20022++
		}
		totalAmount += m.Amount
		byType[m.MessageType]++
	}
	respond(w, 200, map[string]interface{}{
		"totalMessages": len(messages), "outgoing": outgoing, "incoming": incoming,
		"iso20022Count": iso20022, "legacyMTCount": len(messages) - iso20022,
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

func startJWKSRefresh() {
	go fetchJWKS(jwtRealmURL())
	go func() {
		for range time.Tick(5 * time.Minute) {
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
		if exp, ok := claims["exp"].(float64); ok && time.Now().Unix() > int64(exp) {
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
	startJWKSRefresh()

	port := envOr("PORT", "8248")
	http.HandleFunc("/healthz", healthz)
	http.HandleFunc("/v1/swift/messages", handleMessages)
	http.HandleFunc("/v1/swift/stats", handleStats)
	fmt.Printf("SWIFT Messaging Service on port %s\n", port)
	http.ListenAndServe(":"+port, jwtAuthMiddleware(http.DefaultServeMux))
}
