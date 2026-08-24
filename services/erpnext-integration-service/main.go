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
	"github.com/joho/godotenv"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

const (
	ServiceName    = "erpnext-integration-service"
	ServiceVersion = "1.0.0"
)

var (
	integrationService *ERPNextIntegrationService
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
		if isProbePath(p) || strings.HasPrefix(p, "/webhooks/erpnext/") || strings.HasPrefix(p, "/webhooks/bank/") || p == "/api/v1/oauth/callback" {
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
	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: .env file not found, using environment variables")
	}

	log.Printf("Starting %s v%s", ServiceName, ServiceVersion)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var err error
	integrationService, err = NewERPNextIntegrationService(ctx)
	if err != nil {
		log.Fatalf("Failed to initialize service: %v", err)
	}
	defer integrationService.Close()

	router := mux.NewRouter()
	setupRoutes(router)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8118"
	}

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      jwtAuthMiddleware(router),
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		log.Printf("Server listening on port %s", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("Server shutdown error: %v", err)
	}

	log.Println("Server stopped")
}

func setupRoutes(router *mux.Router) {
	router.HandleFunc("/health", healthHandler).Methods("GET")
	router.HandleFunc("/ready", readyHandler).Methods("GET")
	router.Handle("/metrics", promhttp.Handler()).Methods("GET")

	// Dapr pub/sub endpoints
	router.HandleFunc("/dapr/subscribe", subscribeHandler).Methods("GET")
	router.HandleFunc("/events/transaction", handleTransactionEvent).Methods("POST")
	router.HandleFunc("/events/loan", handleLoanEvent).Methods("POST")
	router.HandleFunc("/events/account", handleAccountEvent).Methods("POST")
	router.HandleFunc("/events/payment", handlePaymentEvent).Methods("POST")
	router.HandleFunc("/events/savings", handleSavingsEvent).Methods("POST")
	router.HandleFunc("/events/mortgage", handleMortgageEvent).Methods("POST")
	router.HandleFunc("/events/lpo", handleLpoEvent).Methods("POST")

	api := router.PathPrefix("/api/v1").Subrouter()
	api.Use(TenantMiddleware)
	api.Use(AuthMiddleware)

	api.HandleFunc("/connections", listConnectionsHandler).Methods("GET")
	api.HandleFunc("/connections", createConnectionHandler).Methods("POST")
	api.HandleFunc("/connections/{id}", getConnectionHandler).Methods("GET")
	api.HandleFunc("/connections/{id}", updateConnectionHandler).Methods("PUT")
	api.HandleFunc("/connections/{id}", deleteConnectionHandler).Methods("DELETE")
	api.HandleFunc("/connections/{id}/test", testConnectionHandler).Methods("POST")
	api.HandleFunc("/connections/{id}/sync", triggerSyncHandler).Methods("POST")

	api.HandleFunc("/oauth/authorize", oauthAuthorizeHandler).Methods("GET")
	api.HandleFunc("/oauth/callback", oauthCallbackHandler).Methods("GET")
	api.HandleFunc("/oauth/token", oauthTokenHandler).Methods("POST")
	api.HandleFunc("/oauth/refresh", oauthRefreshHandler).Methods("POST")

	api.HandleFunc("/bank-accounts", listBankAccountsHandler).Methods("GET")
	api.HandleFunc("/bank-accounts/{id}/transactions", getBankTransactionsHandler).Methods("GET")
	api.HandleFunc("/bank-accounts/{id}/balance", getBankBalanceHandler).Methods("GET")

	api.HandleFunc("/reconciliation/auto", autoReconcileHandler).Methods("POST")
	api.HandleFunc("/reconciliation/manual", manualReconcileHandler).Methods("POST")
	api.HandleFunc("/reconciliation/status", reconciliationStatusHandler).Methods("GET")
	api.HandleFunc("/reconciliation/unmatched", unmatchedTransactionsHandler).Methods("GET")

	api.HandleFunc("/payments", listPaymentsHandler).Methods("GET")
	api.HandleFunc("/payments", initiatePaymentHandler).Methods("POST")
	api.HandleFunc("/payments/{id}", getPaymentHandler).Methods("GET")
	api.HandleFunc("/payments/{id}/status", getPaymentStatusHandler).Methods("GET")
	api.HandleFunc("/payments/bulk", bulkPaymentHandler).Methods("POST")

	api.HandleFunc("/invoices", listInvoicesHandler).Methods("GET")
	api.HandleFunc("/invoices/{id}/match", matchInvoicePaymentHandler).Methods("POST")
	api.HandleFunc("/invoices/auto-match", autoMatchInvoicesHandler).Methods("POST")

	api.HandleFunc("/loans", listLoansHandler).Methods("GET")
	api.HandleFunc("/loans/{id}", getLoanHandler).Methods("GET")
	api.HandleFunc("/loans/{id}/schedule", getLoanScheduleHandler).Methods("GET")
	api.HandleFunc("/loans/{id}/payment", makeLoanPaymentHandler).Methods("POST")

	api.HandleFunc("/cash-position", getCashPositionHandler).Methods("GET")
	api.HandleFunc("/cash-forecast", getCashForecastHandler).Methods("GET")

	api.HandleFunc("/webhooks", listWebhooksHandler).Methods("GET")
	api.HandleFunc("/webhooks", createWebhookHandler).Methods("POST")
	api.HandleFunc("/webhooks/{id}", deleteWebhookHandler).Methods("DELETE")

	webhooks := router.PathPrefix("/webhooks").Subrouter()
	webhooks.Handle("/erpnext/{connection_id}", webhookAuthMiddleware(http.HandlerFunc(erpnextWebhookHandler))).Methods("POST")
	webhooks.Handle("/bank/{connection_id}", webhookAuthMiddleware(http.HandlerFunc(bankWebhookHandler))).Methods("POST")

	api.HandleFunc("/sync/accounts", syncAccountsHandler).Methods("POST")
	api.HandleFunc("/sync/transactions", syncTransactionsHandler).Methods("POST")
	api.HandleFunc("/sync/invoices", syncInvoicesHandler).Methods("POST")
	api.HandleFunc("/sync/status", getSyncStatusHandler).Methods("GET")
	api.HandleFunc("/sync/history", getSyncHistoryHandler).Methods("GET")

	api.HandleFunc("/mappings/accounts", listAccountMappingsHandler).Methods("GET")
	api.HandleFunc("/mappings/accounts", createAccountMappingHandler).Methods("POST")
	api.HandleFunc("/mappings/accounts/{id}", updateAccountMappingHandler).Methods("PUT")
	api.HandleFunc("/mappings/accounts/{id}", deleteAccountMappingHandler).Methods("DELETE")

	api.HandleFunc("/reports/reconciliation", reconciliationReportHandler).Methods("GET")
	api.HandleFunc("/reports/cash-flow", cashFlowReportHandler).Methods("GET")
	api.HandleFunc("/reports/payment-summary", paymentSummaryReportHandler).Methods("GET")

	// Configuration management endpoints
	api.HandleFunc("/config/sync", getSyncConfigHandler).Methods("GET")
	api.HandleFunc("/config/sync", updateSyncConfigHandler).Methods("PUT")
	api.HandleFunc("/config/retry-policy", getRetryPolicyConfigHandler).Methods("GET")
	api.HandleFunc("/config/retry-policy", updateRetryPolicyConfigHandler).Methods("PUT")
	api.HandleFunc("/config/notifications", getNotificationConfigHandler).Methods("GET")
	api.HandleFunc("/config/notifications", updateNotificationConfigHandler).Methods("PUT")
	api.HandleFunc("/config/security", getSecurityConfigHandler).Methods("GET")
	api.HandleFunc("/config/security", updateSecurityConfigHandler).Methods("PUT")

	// Audit logs and monitoring
	api.HandleFunc("/audit-logs", getAuditLogsHandler).Methods("GET")
	api.HandleFunc("/dashboard/metrics", getDashboardMetricsHandler).Methods("GET")
	api.HandleFunc("/exceptions", listExceptionsHandler).Methods("GET")
	api.HandleFunc("/exceptions/{id}", updateExceptionHandler).Methods("PUT")
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "healthy",
		"service": ServiceName,
		"version": ServiceVersion,
	})
}

func readyHandler(w http.ResponseWriter, r *http.Request) {
	if integrationService == nil {
		http.Error(w, "Service not ready", http.StatusServiceUnavailable)
		return
	}

	health := integrationService.HealthCheck()
	w.Header().Set("Content-Type", "application/json")

	if !health.DatabaseHealthy {
		w.WriteHeader(http.StatusServiceUnavailable)
	} else {
		w.WriteHeader(http.StatusOK)
	}

	json.NewEncoder(w).Encode(health)
}

func TenantMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tenantID := r.Header.Get("X-Tenant-ID")
		if tenantID == "" {
			tenantID = "default"
		}
		ctx := context.WithValue(r.Context(), "tenant_id", tenantID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		customerID := r.Header.Get("X-Customer-ID")
		if customerID == "" {
			http.Error(w, "Customer ID required", http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), "customer_id", customerID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func getTenantID(ctx context.Context) string {
	if v := ctx.Value("tenant_id"); v != nil {
		return v.(string)
	}
	return "default"
}

func getCustomerID(ctx context.Context) string {
	if v := ctx.Value("customer_id"); v != nil {
		return v.(string)
	}
	return ""
}
