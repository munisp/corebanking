package main

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var coaClient *CoAClient

// HTTPSMSProvider implements SMSProvider using HTTP API
type HTTPSMSProvider struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

// NewHTTPSMSProvider creates a new HTTP-based SMS provider
func NewHTTPSMSProvider(baseURL, apiKey string) *HTTPSMSProvider {
	return &HTTPSMSProvider{
		baseURL: baseURL,
		apiKey:  apiKey,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// SendSMS sends an SMS via HTTP API
func (p *HTTPSMSProvider) SendSMS(ctx context.Context, phone string, message string) error {
	payload := map[string]string{
		"to":      phone,
		"message": message,
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, "POST", p.baseURL+"/api/v1/sms/send", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.apiKey)

	resp, err := p.httpClient.Do(req)
	if err != nil {
		log.Printf("SMS send failed: %v", err)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("SMS API error: %d", resp.StatusCode)
	}
	return nil
}

type STKServer struct {
	router         *mux.Router
	db             *pgxpool.Pool
	bankingService *STKBankingService
	accountService string
	paymentService string
	ledgerService  string
	fraudService   string
	httpClient     *http.Client
}

const legacyDefaultPinSecret = "default-pin-secret-change-in-production"

// loadPinHMACSecret resolves the HMAC secret protecting customer PINs.
// Fail closed: the secret MUST come from the STK_PIN_HMAC_SECRET environment
// variable and must not equal the historical hardcoded default. In production
// the service refuses to boot otherwise; outside production an ephemeral
// random secret is generated with a loud warning so dev/test still boots
// without shipping a known secret.
func loadPinHMACSecret() string {
	secret := os.Getenv("STK_PIN_HMAC_SECRET")
	if secret != "" && secret != legacyDefaultPinSecret {
		return secret
	}
	env := strings.ToLower(getEnv("ENVIRONMENT", getEnv("APP_ENV", "production")))
	isProd := env == "production" || env == "prod"
	if secret == legacyDefaultPinSecret {
		if isProd {
			log.Fatal("[stk-service] FATAL: STK_PIN_HMAC_SECRET is set to the known insecure hardcoded default; refusing to start")
		}
		log.Printf("[stk-service] WARNING: STK_PIN_HMAC_SECRET equals the insecure default; generating ephemeral secret (non-production only)")
	} else if isProd {
		log.Fatal("[stk-service] FATAL: STK_PIN_HMAC_SECRET is not set; refusing to start in production")
	} else {
		log.Printf("[stk-service] WARNING: STK_PIN_HMAC_SECRET not set; generating ephemeral random secret (non-production only)")
	}
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		log.Fatalf("[stk-service] FATAL: cannot generate ephemeral PIN secret: %v", err)
	}
	return hex.EncodeToString(b)
}

func NewSTKServer(db *pgxpool.Pool) *STKServer {
	smsProvider := NewHTTPSMSProvider(
		getEnv("SMS_SERVICE_URL", "http://notification-service:8080"),
		getEnv("SMS_API_KEY", ""),
	)
	pinSecret := loadPinHMACSecret()

	server := &STKServer{
		router:         mux.NewRouter(),
		db:             db,
		bankingService: NewSTKBankingService(db, smsProvider, pinSecret),
		accountService: getEnv("ACCOUNT_SERVICE_URL", "http://account-service:8080"),
		paymentService: getEnv("PAYMENT_SERVICE_URL", "http://payment-service:8080"),
		ledgerService:  getEnv("LEDGER_SERVICE_URL", "http://ledger-service:8080"),
		fraudService:   getEnv("FRAUD_SERVICE_URL", "http://fraud-service:8080"),
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
	server.setupRoutes()
	return server
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func (s *STKServer) setupRoutes() {
	s.router.HandleFunc("/health", s.healthHandler).Methods("GET")
	s.router.HandleFunc("/ready", s.readyHandler).Methods("GET")
	s.router.Handle("/metrics", promhttp.Handler())

	api := s.router.PathPrefix("/api/v1").Subrouter()
	api.HandleFunc("/stk/push", s.stkPushHandler).Methods("POST")
	api.HandleFunc("/stk/callback", s.stkCallbackHandler).Methods("POST")
	api.HandleFunc("/stk/status/{transactionId}", s.stkStatusHandler).Methods("GET")
	// STK Banking command handler - processes SIM Toolkit menu commands
	api.HandleFunc("/stk/command", s.stkCommandHandler).Methods("POST")
}

func (s *STKServer) healthHandler(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
}

func (s *STKServer) readyHandler(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
}

type STKPushRequest struct {
	PhoneNumber     string  `json:"phoneNumber"`
	Amount          float64 `json:"amount"`
	AccountRef      string  `json:"accountRef"`
	TransactionDesc string  `json:"transactionDesc"`
	CallbackURL     string  `json:"callbackUrl"`
}

type STKPushResponse struct {
	TransactionID   string `json:"transactionId"`
	MerchantReqID   string `json:"merchantRequestId"`
	CheckoutReqID   string `json:"checkoutRequestId"`
	ResponseCode    string `json:"responseCode"`
	ResponseDesc    string `json:"responseDescription"`
	CustomerMessage string `json:"customerMessage"`
}

type STKCallback struct {
	TransactionID   string  `json:"transactionId"`
	ResultCode      int     `json:"resultCode"`
	ResultDesc      string  `json:"resultDesc"`
	Amount          float64 `json:"amount"`
	PhoneNumber     string  `json:"phoneNumber"`
	TransactionDate string  `json:"transactionDate"`
}

func (s *STKServer) stkPushHandler(w http.ResponseWriter, r *http.Request) {
	var req STKPushRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	transactionID := uuid.New().String()
	merchantReqID := fmt.Sprintf("MRQ%d", time.Now().UnixNano())
	checkoutReqID := fmt.Sprintf("CRQ%d", time.Now().UnixNano())

	response := STKPushResponse{
		TransactionID:   transactionID,
		MerchantReqID:   merchantReqID,
		CheckoutReqID:   checkoutReqID,
		ResponseCode:    "0",
		ResponseDesc:    "Success. Request accepted for processing",
		CustomerMessage: "Success. Request accepted for processing",
	}

	log.Printf("STK Push initiated: phone=%s, amount=%.2f, ref=%s, txn=%s",
		req.PhoneNumber, req.Amount, req.AccountRef, transactionID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (s *STKServer) stkCallbackHandler(w http.ResponseWriter, r *http.Request) {
	var callback STKCallback
	if err := json.NewDecoder(r.Body).Decode(&callback); err != nil {
		http.Error(w, "Invalid callback", http.StatusBadRequest)
		return
	}

	log.Printf("STK Callback received: txn=%s, result=%d, desc=%s",
		callback.TransactionID, callback.ResultCode, callback.ResultDesc)

	if callback.ResultCode == 0 {
		log.Printf("Payment successful: amount=%.2f, phone=%s", callback.Amount, callback.PhoneNumber)
	} else {
		log.Printf("Payment failed: %s", callback.ResultDesc)
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "received"})
}

func (s *STKServer) stkStatusHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	transactionID := vars["transactionId"]

	// Query actual transaction status from database
	var status string
	var amount float64
	var createdAt time.Time
	err := s.db.QueryRow(r.Context(), `
		SELECT status, amount, created_at
		FROM stk_transactions
		WHERE transaction_id = $1
	`, transactionID).Scan(&status, &amount, &createdAt)

	if err != nil {
		// Transaction not found - return pending status
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"transactionId": transactionID,
			"status":        "pending",
			"resultCode":    1,
			"resultDesc":    "Transaction not found or still processing",
			"timestamp":     time.Now().Format(time.RFC3339),
		})
		return
	}

	resultCode := 0
	resultDesc := "The service request is processed successfully."
	if status != "completed" {
		resultCode = 1
		resultDesc = "Transaction " + status
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"transactionId": transactionID,
		"status":        status,
		"resultCode":    resultCode,
		"resultDesc":    resultDesc,
		"amount":        amount,
		"timestamp":     createdAt.Format(time.RFC3339),
	})
}

// stkCommandHandler processes STK menu commands from feature phones
func (s *STKServer) stkCommandHandler(w http.ResponseWriter, r *http.Request) {
	var cmd STKCommand
	if err := json.NewDecoder(r.Body).Decode(&cmd); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if cmd.Timestamp.IsZero() {
		cmd.Timestamp = time.Now()
	}
	if cmd.CommandID == "" {
		cmd.CommandID = uuid.New().String()
	}

	response, err := s.bankingService.ProcessSTKCommand(r.Context(), &cmd)
	if err != nil {
		log.Printf("STK command error: %v", err)
		http.Error(w, "Processing error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
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
	port := getEnv("PORT", "8080")
	// DATABASE_URL is REQUIRED — no credential-bearing default. Fail fast at startup.
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatalf("[stk-service] DATABASE_URL env var is required; refusing to start with default database credentials")
	}

	// Initialize database connection
	ctx := context.Background()
	dbConfig, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		log.Fatalf("Failed to parse database URL: %v", err)
	}
	dbConfig.MaxConns = 20
	dbConfig.MinConns = 5

	db, err := pgxpool.NewWithConfig(ctx, dbConfig)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Verify database connection
	if err := db.Ping(ctx); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	log.Println("Database connection established")

	// Initialize CoA Client
	coaClient = NewCoAClient()

	server := NewSTKServer(db)

	httpServer := &http.Server{
		Addr:         ":" + port,
		Handler:      jwtAuthMiddleware(server.router),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	go func() {
		log.Printf("STK Push service starting on port %s", port)
		log.Printf("Connected to: account=%s, payment=%s, ledger=%s, fraud=%s",
			server.accountService, server.paymentService, server.ledgerService, server.fraudService)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down STK Push service...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	httpServer.Shutdown(shutdownCtx)
}
