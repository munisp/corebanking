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
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/mux"
)

type seedEnvelope struct {
	Records []map[string]interface{} `json:"records"`
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
		if isProbePath(p) {
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
	service := NewUnifiedSearchService()
	defer service.Stop()

	router := mux.NewRouter()
	router.HandleFunc("/health", healthHandler).Methods(http.MethodGet)
	router.HandleFunc("/ready", readyHandler(service)).Methods(http.MethodGet)
	router.HandleFunc("/bootstrap", bootstrapHandler(service)).Methods(http.MethodPost)
	service.RegisterRoutes(router)

	server := &http.Server{
		Addr:              ":" + getEnvOrDefault("PORT", "8094"),
		Handler:           jwtAuthMiddleware(router),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       20 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		log.Printf("search-service listening on %s", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("search-service failed: %v", err)
		}
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("search-service shutdown error: %v", err)
	}
}

func healthHandler(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":    "healthy",
		"service":   "search-service",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

func readyHandler(service *UnifiedSearchService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		_, statusCode, err := service.doOpenSearchRequest(ctx, http.MethodGet, "/", nil)
		dependencyState := "ready"
		ready := err == nil && statusCode < 500
		if !ready {
			dependencyState = "degraded"
		}

		response := map[string]interface{}{
			"status":            map[bool]string{true: "ready", false: "degraded"}[ready],
			"service":           "search-service",
			"opensearch_url":    service.opensearchURL,
			"opensearch_state":  dependencyState,
			"index_queue_depth": len(service.indexQueue),
			"timestamp":         time.Now().UTC().Format(time.RFC3339),
		}
		if err != nil {
			response["detail"] = err.Error()
		}

		status := http.StatusOK
		if !ready {
			status = http.StatusServiceUnavailable
		}
		writeJSON(w, status, response)
	}
}

func bootstrapHandler(service *UnifiedSearchService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		seedPath := getEnvOrDefault("SEED_FILE", filepath.Join(".", "seed_data.json"))
		payload, err := os.ReadFile(seedPath)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]interface{}{
				"status":  "seed-not-found",
				"service": "search-service",
				"detail":  err.Error(),
			})
			return
		}

		var envelope seedEnvelope
		if err := json.Unmarshal(payload, &envelope); err == nil && len(envelope.Records) > 0 {
			count := queueSeedRecords(service, envelope.Records)
			writeJSON(w, http.StatusAccepted, map[string]interface{}{
				"status":           "bootstrap-queued",
				"service":          "search-service",
				"queued_documents": count,
				"seed_file":        seedPath,
			})
			return
		}

		var generic map[string]interface{}
		if err := json.Unmarshal(payload, &generic); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{
				"status":  "invalid-seed",
				"service": "search-service",
				"detail":  err.Error(),
			})
			return
		}

		queued := 0
		for key, value := range generic {
			records, ok := value.([]interface{})
			if !ok {
				continue
			}
			indexName := normalizeSeedIndex(key)
			for _, raw := range records {
				doc, ok := raw.(map[string]interface{})
				if !ok {
					continue
				}
				id := extractDocumentID(doc)
				tenantID, _ := doc["tenant_id"].(string)
				if id == "" || tenantID == "" {
					continue
				}
				service.indexQueue <- &IndexRequest{Index: indexName, ID: id, TenantID: tenantID, Document: doc}
				queued++
			}
		}

		writeJSON(w, http.StatusAccepted, map[string]interface{}{
			"status":           "bootstrap-queued",
			"service":          "search-service",
			"queued_documents": queued,
			"seed_file":        seedPath,
		})
	}
}

func queueSeedRecords(service *UnifiedSearchService, records []map[string]interface{}) int {
	queued := 0
	for _, record := range records {
		indexName, _ := record["index"].(string)
		if indexName == "" {
			indexName = normalizeSeedIndex(stringValue(record["resource_type"]))
		}
		if indexName == "" {
			indexName = IndexDocuments
		}
		id := extractDocumentID(record)
		tenantID, _ := record["tenant_id"].(string)
		if id == "" || tenantID == "" {
			continue
		}
		doc := record
		if nested, ok := record["document"].(map[string]interface{}); ok {
			doc = nested
			if _, exists := doc["tenant_id"]; !exists {
				doc["tenant_id"] = tenantID
			}
		}
		service.indexQueue <- &IndexRequest{Index: indexName, ID: id, TenantID: tenantID, Document: doc}
		queued++
	}
	return queued
}

func extractDocumentID(document map[string]interface{}) string {
	candidates := []string{"id", "document_id", "customer_id", "account_id", "transaction_id", "loan_id", "ticket_number", "reference"}
	for _, candidate := range candidates {
		if value := stringValue(document[candidate]); value != "" {
			return value
		}
	}
	return ""
}

func normalizeSeedIndex(value string) string {
	value = strings.TrimSpace(strings.ToLower(value))
	value = strings.TrimSuffix(value, "_records")
	value = strings.TrimSuffix(value, "records")
	value = strings.ReplaceAll(value, "-", "_")
	value = strings.ReplaceAll(value, " ", "_")
	mapping := map[string]string{
		"customer":      IndexCustomers,
		"customers":     IndexCustomers,
		"account":       IndexAccounts,
		"accounts":      IndexAccounts,
		"transaction":   IndexTransactions,
		"transactions":  IndexTransactions,
		"loan":          IndexLoans,
		"loans":         IndexLoans,
		"dispute":       IndexDisputes,
		"disputes":      IndexDisputes,
		"document":      IndexDocuments,
		"documents":     IndexDocuments,
		"employee":      IndexEmployees,
		"employees":     IndexEmployees,
		"product":       IndexProducts,
		"products":      IndexProducts,
		"notification":  IndexNotifications,
		"notifications": IndexNotifications,
		"trade_finance": IndexTradeFinance,
		"tradefinance":  IndexTradeFinance,
	}
	if mapped, ok := mapping[value]; ok {
		return mapped
	}
	return value
}

func stringValue(value interface{}) string {
	if value == nil {
		return ""
	}
	if result, ok := value.(string); ok {
		return result
	}
	return ""
}

func writeJSON(w http.ResponseWriter, status int, payload map[string]interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
