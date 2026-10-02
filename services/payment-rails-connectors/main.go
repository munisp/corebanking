// payment-rails-connectors — adapters for NIP, NEFT, RTGS, SWIFT and other payment rails
package main

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"log"
	"math/big"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
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

// ---------------------------------------------------------------------------
// JWT validation (RS256 via Keycloak JWKS) — W12-B5-P0-A
// Mutating routes on this service were reachable with no authentication at
// all (w12 findings/b3-exposure.json). Every route except the probe/health
// endpoints now requires a verified Keycloak bearer token; the middleware
// fails closed on any verification error.
// Canonical pattern: services/permify-authz-go/main.go (JWKS cache +
// jwtMiddleware) and services/acgsf-guarantee-go/main.go (jwtAuthMiddleware).
// ---------------------------------------------------------------------------

// jwksRefreshOnce ensures the shared JWKS poller is started exactly once.
var jwksRefreshOnce sync.Once

// ensureJWKSRefresh starts the initial JWKS fetch and the 5-minute refresher
// exactly once per process, no matter how many routes register the middleware
// (GPT-10: was one poller goroutine pair per route registration).
func ensureJWKSRefresh(realmURL string) {
	jwksRefreshOnce.Do(func() {
		go fetchJWKS(realmURL)
		go func() {
			ticker := time.NewTicker(5 * time.Minute)
			defer ticker.Stop()
			for range ticker.C {
				fetchJWKS(realmURL)
			}
		}()
	})
}

type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}
var jwksHTTPClient = &http.Client{Timeout: 5 * time.Second}

func jwtRealmURL() string {
	if v := os.Getenv("KEYCLOAK_REALM_URL"); v != "" {
		return v
	}
	return "http://keycloak:8080/realms/54bank"
}

func fetchJWKS(realmURL string) {
	resp, err := jwksHTTPClient.Get(realmURL + "/protocol/openid-connect/certs")
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
		pub := &rsa.PublicKey{N: new(big.Int).SetBytes(nBytes), E: eInt}
		jwtCache.keys[k.Kid] = pub
	}
	jwtCache.updated = time.Now()
	log.Printf("[middleware] JWKS refreshed: %d keys", len(jwtCache.keys))
}

// jwtAuthMiddleware enforces a verified RS256 Keycloak bearer token on every
// route except the probe/health endpoints (canonical fleet template).
func jwtAuthMiddleware(next http.Handler) http.Handler {
	realmURL := jwtRealmURL()
	// Single shared JWKS poller per process (started once, not per route)
	ensureJWKSRefresh(realmURL)
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
		var header struct {
			Kid string `json:"kid"`
		}
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
		exp, ok := claims["exp"].(float64)
		if !ok {
			http.Error(w, `{"error":"token missing exp claim"}`, http.StatusUnauthorized)
			return
		}
		if time.Now().Unix() >= int64(exp) {
			http.Error(w, `{"error":"token expired"}`, http.StatusUnauthorized)
			return
		}
		// Pass claims in context
		ctx := context.WithValue(r.Context(), "jwt_claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func main() {
	port := getEnv("PORT", "9170")
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"service":     "payment-rails-connectors",
			"status":      "healthy",
			"uptime_secs": int(time.Since(startTime).Seconds()),
			"rails": map[string]string{
				"NIP":   "active",
				"NEFT":  "active",
				"RTGS":  "active",
				"SWIFT": "active",
				"SEPA":  "active",
			},
		})
	})

	mux.HandleFunc("/v1/rails/status", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"rails": []map[string]interface{}{
				{"name": "NIP", "provider": "NIBSS", "status": "operational", "latencyMs": 2800, "uptimePct": 99.98},
				{"name": "NEFT", "provider": "CBN", "status": "operational", "latencyMs": 18000, "uptimePct": 99.95},
				{"name": "RTGS", "provider": "CBN", "status": "operational", "latencyMs": 5000, "uptimePct": 99.99},
				{"name": "SWIFT", "provider": "SWIFT-GPI", "status": "operational", "latencyMs": 14400000, "uptimePct": 99.9},
				{"name": "SEPA", "provider": "EBA-CLEARING", "status": "operational", "latencyMs": 3600000, "uptimePct": 99.92},
			},
		})
	})

	mux.HandleFunc("/v1/rails/nip/submit", permifyAuthzGuard("payment_order", "submit", func(w http.ResponseWriter, r *http.Request) {
		var req map[string]interface{}
		json.NewDecoder(r.Body).Decode(&req)
		respondJSON(w, 202, map[string]interface{}{
			"rail":        "NIP",
			"sessionCode": "999999" + time.Now().Format("20060102150405"),
			"status":      "processing",
		})
	}))

	mux.HandleFunc("/v1/rails/stats", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, 200, map[string]interface{}{
			"totalRoutedToday":     48200,
			"nipVolume":            38000,
			"neftVolume":           4200,
			"rtgsVolume":           200,
			"swiftVolume":          12,
			"avgRoutingDecisionMs": 8,
		})
	})

	log.Printf("[payment-rails-connectors] Payment rails adapter on :%s", port)
	log.Fatal((&http.Server{Addr: ":" + port, Handler: jwtAuthMiddleware(mux), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second}).ListenAndServe())
}
