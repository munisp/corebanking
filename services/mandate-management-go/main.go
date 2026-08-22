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

var port = getEnv("PORT", "8221")

var middlewareConfig = map[string]interface{}{
	"kafka":       map[string]string{"broker": getEnv("KAFKA_BROKER", "localhost:9092"), "topics": "mandate.created,mandate.activated,mandate.executed,mandate.cancelled"},
	"redis":       map[string]string{"url": getEnv("REDIS_URL", "redis://localhost:6379"), "purpose": "mandate-cache,execution-tracker"},
	"postgres":    map[string]string{"url": os.Getenv("DATABASE_URL"), "tables": "mandates,mandate_executions,mandate_disputes"},
	"opensearch":  map[string]string{"url": getEnv("OPENSEARCH_URL", "http://localhost:9200"), "index": "mandate-history"},
	"keycloak":    map[string]string{"url": getEnv("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "role": "operations-officer"},
	"permify":     map[string]string{"url": getEnv("PERMIFY_URL", "http://localhost:3476"), "schema": "mandate:create,mandate:activate,mandate:cancel,mandate:dispute"},
	"dapr":        map[string]string{"url": getEnv("DAPR_URL", "http://localhost:3500"), "pubsub": "mandate-events"},
	"fluvio":      map[string]string{"url": getEnv("FLUVIO_URL", "localhost:9003"), "topic": "mandate-executions"},
	"temporal":    map[string]string{"url": getEnv("TEMPORAL_URL", "localhost:7233"), "workflow": "MandateExecutionWorkflow"},
	"mojaloop":    map[string]string{"url": getEnv("MOJALOOP_URL", "http://localhost:4000"), "purpose": "nibss-mandate-sync"},
	"tigerbeetle": map[string]string{"url": getEnv("TIGERBEETLE_URL", "localhost:3000"), "purpose": "mandate-debit-ledger"},
	"lakehouse":   map[string]string{"url": getEnv("LAKEHOUSE_URL", "http://localhost:8206"), "tables": "mandate_analytics"},
	"apisix":      map[string]string{"url": getEnv("APISIX_URL", "http://localhost:9080"), "route": "/mandates/*"},
	"openappsec":  map[string]string{"url": getEnv("OPENAPPSEC_URL", "http://localhost:8090")},
}

type Mandate struct {
	ID           string  `json:"id"`
	AccountNo    string  `json:"accountNumber"`
	AccountName  string  `json:"accountName"`
	Beneficiary  string  `json:"beneficiary"`
	MandateRef   string  `json:"nibssMandateRef"`
	Type         string  `json:"type"`
	Amount       float64 `json:"amount"`
	Currency     string  `json:"currency"`
	Frequency    string  `json:"frequency"`
	Status       string  `json:"status"`
	StartDate    string  `json:"startDate"`
	EndDate      string  `json:"endDate"`
	NextExec     string  `json:"nextExecutionDate"`
	TotalExec    int     `json:"totalExecutions"`
	TotalDebited float64 `json:"totalDebited"`
}

var (
	mandates []Mandate
	mu       sync.RWMutex
)

func init() {
	mandates = []Mandate{}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func jsonResponse(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Service", "mandate-management")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

// ── MIDDLEWARE: JWT Validation (JWKS / RS256, fail-closed) ──────────────────

type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}

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
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
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
			fmt.Fprintf(w, `{"error":"unauthorized","service":%q}`, "mandate-management-go")
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"malformed token","service":%q}`, "mandate-management-go")
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
		exp, ok := claims["exp"].(float64)
		if !ok {
			http.Error(w, `{"error":"token missing exp claim"}`, http.StatusUnauthorized)
			return
		}
		if time.Now().Unix() >= int64(exp) {
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

	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		active := 0
		for _, m := range mandates {
			if m.Status == "active" {
				active++
			}
		}
		jsonResponse(w, 200, map[string]interface{}{
			"status": "healthy", "service": "mandate-management",
			"mandates":   map[string]int{"total": len(mandates), "active": active},
			"middleware": middlewareConfig,
		})
	})
	mux.HandleFunc("/v1/mandates", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, 200, map[string]interface{}{"items": mandates, "total": len(mandates)})
	})
	mux.HandleFunc("/v1/stats", func(w http.ResponseWriter, r *http.Request) {
		active, suspended := 0, 0
		totalDebited := 0.0
		totalExec := 0
		for _, m := range mandates {
			if m.Status == "active" {
				active++
			}
			if m.Status == "suspended" {
				suspended++
			}
			totalDebited += m.TotalDebited
			totalExec += m.TotalExec
		}
		jsonResponse(w, 200, map[string]interface{}{
			"totalMandates": len(mandates), "active": active, "suspended": suspended,
			"totalDebited": totalDebited, "totalExecutions": totalExec,
			"types": map[string]int{"direct-debit": 5, "standing-order": 1},
		})
	})

	log.Printf("[mandate-management] Listening on :%s with %d mandates\n", port, len(mandates))
	log.Fatal(http.ListenAndServe(":"+port, jwtAuthMiddleware(mux)))
}
