package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
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
	router          *mux.Router
	db              *pgxpool.Pool
	bankingService  *STKBankingService
	accountService  string
	paymentService  string
	ledgerService   string
	fraudService    string
	httpClient      *http.Client
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
	TransactionID string  `json:"transactionId"`
	ResultCode    int     `json:"resultCode"`
	ResultDesc    string  `json:"resultDesc"`
	Amount        float64 `json:"amount"`
	PhoneNumber   string  `json:"phoneNumber"`
	TransactionDate string `json:"transactionDate"`
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

func main() {
	port := getEnv("PORT", "8080")
	dbURL := getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/stk_service?sslmode=disable")

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
		Handler:      server.router,
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
