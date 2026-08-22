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

type POSTerminal struct {
	ID              string  `json:"id"`
	TerminalID      string  `json:"terminalId"`
	MerchantName    string  `json:"merchantName"`
	MerchantID      string  `json:"merchantId"`
	Location        string  `json:"location"`
	State           string  `json:"state"`
	Category        string  `json:"category"`
	Model           string  `json:"model"`
	Status          string  `json:"status"`
	DailyTxnCount   int     `json:"dailyTransactionCount"`
	DailyVolume     float64 `json:"dailyVolume"`
	MonthlyVolume   float64 `json:"monthlyVolume"`
	LastTransaction string  `json:"lastTransaction"`
	CommissionRate  float64 `json:"commissionRate"`
	DeployedDate    string  `json:"deployedDate"`
}

type POSTransaction struct {
	ID           string  `json:"id"`
	TerminalID   string  `json:"terminalId"`
	MerchantName string  `json:"merchantName"`
	Type         string  `json:"type"`
	Amount       float64 `json:"amount"`
	Currency     string  `json:"currency"`
	CardScheme   string  `json:"cardScheme"`
	ResponseCode string  `json:"responseCode"`
	RRN          string  `json:"rrn"`
	Timestamp    string  `json:"timestamp"`
	Status       string  `json:"status"`
}

var (
	mu           sync.Mutex
	terminals    []POSTerminal
	transactions []POSTransaction
)

func init() {
	terminals = []POSTerminal{}
	transactions = []POSTransaction{}
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	if err := json.NewEncoder(w).Encode(data); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

// CORS middleware
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

		// Allow frontend origins
		// R3-NEW-6: no wildcard origin — echo the request Origin only when it is
		// on the CORS_ALLOWED_ORIGINS allowlist (comma-separated; restrictive default).
		allowedOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
		if allowedOrigins == "" {
			allowedOrigins = "https://dashboard.54bank.ng"
		}
		origin := r.Header.Get("Origin")
		for _, allowed := range strings.Split(allowedOrigins, ",") {
			if strings.TrimSpace(allowed) == origin && origin != "" {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
				break
			}
		}

		// Allowed methods
		w.Header().Set(
			"Access-Control-Allow-Methods",
			"GET, POST, PUT, PATCH, DELETE, OPTIONS",
		)

		// Allowed headers
		w.Header().Set(
			"Access-Control-Allow-Headers",
			"Content-Type, Authorization",
		)

		// Handle preflight request
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
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
			fmt.Fprintf(w, `{"error":"unauthorized","service":%q}`, "pos-terminal-go")
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"malformed token","service":%q}`, "pos-terminal-go")
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

	// Health endpoint
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"status":  "ok",
			"service": "pos-terminal-management",
		})
	})

	// Terminals — GET list / POST create
	mux.HandleFunc("/v1/pos/terminals", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			mu.Lock()
			defer mu.Unlock()
			respondJSON(w, http.StatusOK, map[string]interface{}{
				"items": terminals,
				"total": len(terminals),
			})

		case http.MethodPost:
			var t POSTerminal
			if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
				http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
				return
			}
			if t.TerminalID == "" || t.MerchantName == "" || t.MerchantID == "" {
				http.Error(w, `{"error":"terminalId, merchantName and merchantId are required"}`, http.StatusBadRequest)
				return
			}
			if t.Status == "" {
				t.Status = "active"
			}
			t.ID = fmt.Sprintf("POS-%04d", len(terminals)+1)
			mu.Lock()
			terminals = append(terminals, t)
			mu.Unlock()
			respondJSON(w, http.StatusCreated, t)

		default:
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		}
	})

	// Transactions — GET list / POST create
	mux.HandleFunc("/v1/pos/transactions", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			mu.Lock()
			defer mu.Unlock()
			respondJSON(w, http.StatusOK, map[string]interface{}{
				"items": transactions,
				"total": len(transactions),
			})

		case http.MethodPost:
			var tx POSTransaction
			if err := json.NewDecoder(r.Body).Decode(&tx); err != nil {
				http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
				return
			}
			if tx.TerminalID == "" || tx.Amount <= 0 || tx.Type == "" {
				http.Error(w, `{"error":"terminalId, type and amount are required"}`, http.StatusBadRequest)
				return
			}
			if tx.Currency == "" {
				tx.Currency = "NGN"
			}
			if tx.Status == "" {
				tx.Status = "pending"
			}
			tx.ID = fmt.Sprintf("PTX-%04d", len(transactions)+1)
			mu.Lock()
			transactions = append(transactions, tx)
			mu.Unlock()
			respondJSON(w, http.StatusCreated, tx)

		default:
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		}
	})

	// Stats endpoint
	mux.HandleFunc("/v1/pos/stats", func(w http.ResponseWriter, _ *http.Request) {
		mu.Lock()

		byCategory := map[string]int{}
		byStatus := map[string]int{}
		totalVolume := 0.0
		totalTxns := 0

		for _, t := range terminals {
			byCategory[t.Category]++
			byStatus[t.Status]++
			totalVolume += t.DailyVolume
			totalTxns += t.DailyTxnCount
		}

		approvedTxns := 0
		declinedTxns := 0

		for _, tx := range transactions {
			if tx.Status == "approved" {
				approvedTxns++
			} else {
				declinedTxns++
			}
		}

		mu.Unlock()

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"totalTerminals":    len(terminals),
			"dailyTransactions": totalTxns,
			"dailyVolume":       totalVolume,
			"approvedTxns":      approvedTxns,
			"declinedTxns":      declinedTxns,
			"byCategory":        byCategory,
			"byStatus":          byStatus,
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "9297"
	}
	addr := ":" + port

	fmt.Printf("pos-terminal-management listening on %s\n", addr)

	// Wrap mux with CORS middleware
	handler := corsMiddleware(mux)

	if err := http.ListenAndServe(addr, jwtAuthMiddleware(handler)); err != nil {
		fmt.Fprintf(os.Stderr, "server error: %v\n", err)
		os.Exit(1)
	}
}
