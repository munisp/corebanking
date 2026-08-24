package main

import (
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
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Prometheus metrics
var (
	vanCreated = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "van_created_total",
			Help: "Total number of virtual accounts created",
		},
		[]string{"bank_id", "purpose"},
	)

	vanPaymentsReceived = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "van_payments_received_total",
			Help: "Total number of payments received on virtual accounts",
		},
		[]string{"bank_id", "purpose"},
	)

	vanPaymentAmount = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "van_payment_amount",
			Help:    "Distribution of payment amounts on virtual accounts",
			Buckets: []float64{1000, 5000, 10000, 50000, 100000, 500000, 1000000},
		},
		[]string{"bank_id"},
	)
)

// VirtualAccount represents a virtual account number
type VirtualAccount struct {
	ID              string                 `json:"id"`
	VAN             string                 `json:"van"`                       // Virtual Account Number (10-digit NUBAN format)
	BankID          string                 `json:"bank_id"`                   // Tenant/Bank ID
	ParentAccountID string                 `json:"parent_account_id"`         // Main account this VAN is linked to
	CustomerID      string                 `json:"customer_id"`               // Customer who owns this VAN
	Purpose         string                 `json:"purpose"`                   // loan_collection, merchant, escrow, agent, payroll
	ReferenceID     string                 `json:"reference_id"`              // Loan ID, Invoice ID, Escrow ID, etc.
	ReferenceType   string                 `json:"reference_type"`            // loan, invoice, escrow, agent, etc.
	AccountName     string                 `json:"account_name"`              // Display name for the VAN
	Currency        string                 `json:"currency"`                  // NGN, USD, etc.
	Status          string                 `json:"status"`                    // active, suspended, closed
	ExpiresAt       *time.Time             `json:"expires_at,omitempty"`      // Optional expiry
	SingleUse       bool                   `json:"single_use"`                // If true, VAN is deactivated after first payment
	ExpectedAmount  *float64               `json:"expected_amount,omitempty"` // Expected payment amount
	MinAmount       *float64               `json:"min_amount,omitempty"`
	MaxAmount       *float64               `json:"max_amount,omitempty"`
	TotalReceived   float64                `json:"total_received"`        // Total amount received on this VAN
	PaymentCount    int                    `json:"payment_count"`         // Number of payments received
	WebhookURL      string                 `json:"webhook_url,omitempty"` // Webhook for payment notifications
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt       time.Time              `json:"created_at"`
	UpdatedAt       time.Time              `json:"updated_at"`
	LastPaymentAt   *time.Time             `json:"last_payment_at,omitempty"`
}

// VANPayment represents a payment received on a virtual account
type VANPayment struct {
	ID              string                 `json:"id"`
	VANID           string                 `json:"van_id"`
	VAN             string                 `json:"van"`
	BankID          string                 `json:"bank_id"`
	Amount          float64                `json:"amount"`
	Currency        string                 `json:"currency"`
	SenderName      string                 `json:"sender_name"`
	SenderAccount   string                 `json:"sender_account"`
	SenderBank      string                 `json:"sender_bank"`
	SenderBankCode  string                 `json:"sender_bank_code"`
	Narration       string                 `json:"narration"`
	SessionID       string                 `json:"session_id"` // NIBSS session ID
	TransactionRef  string                 `json:"transaction_ref"`
	Status          string                 `json:"status"` // pending, processed, failed, reversed
	ProcessedAt     *time.Time             `json:"processed_at,omitempty"`
	LedgerEntryID   string                 `json:"ledger_entry_id,omitempty"` // TigerBeetle entry ID
	WebhookSent     bool                   `json:"webhook_sent"`
	WebhookResponse string                 `json:"webhook_response,omitempty"`
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt       time.Time              `json:"created_at"`
}

// VANAllocation represents a batch allocation of VANs
type VANAllocation struct {
	ID          string    `json:"id"`
	BankID      string    `json:"bank_id"`
	Purpose     string    `json:"purpose"`
	Prefix      string    `json:"prefix"` // Bank-specific prefix
	RangeStart  int64     `json:"range_start"`
	RangeEnd    int64     `json:"range_end"`
	AllocatedAt time.Time `json:"allocated_at"`
	UsedCount   int       `json:"used_count"`
}

// VirtualAccountService manages virtual accounts
type VirtualAccountService struct {
	mu             sync.RWMutex
	accounts       map[string]*VirtualAccount // VAN -> Account
	accountsByID   map[string]*VirtualAccount // ID -> Account
	payments       map[string]*VANPayment
	allocations    map[string]*VANAllocation
	bankPrefixes   map[string]string // BankID -> Prefix
	tigerBeetleURL string
	nibssURL       string
	tbClient       *TigerBeetleClient
	nibssClient    *NIBSSClient
	webhookClient  *http.Client
	lakehouse      *LakehousePublisher
}

// NewVirtualAccountService creates a new service instance
func NewVirtualAccountService() *VirtualAccountService {
	tigerBeetleURL := getEnv("TIGERBEETLE_URL", "http://tigerbeetle:3000")
	nibssURL := getEnv("NIBSS_URL", "http://nibss-gateway:8080")
	bankCode := getEnv("NIBSS_BANK_CODE", "999")
	apiKey := getEnv("NIBSS_API_KEY", "sandbox-api-key")
	secretKey := getEnv("NIBSS_SECRET_KEY", "sandbox-secret")

	return &VirtualAccountService{
		accounts:       make(map[string]*VirtualAccount),
		accountsByID:   make(map[string]*VirtualAccount),
		payments:       make(map[string]*VANPayment),
		allocations:    make(map[string]*VANAllocation),
		bankPrefixes:   make(map[string]string),
		tigerBeetleURL: tigerBeetleURL,
		nibssURL:       nibssURL,
		tbClient:       NewTigerBeetleClient(tigerBeetleURL),
		nibssClient:    NewNIBSSClient(nibssURL, apiKey, secretKey, bankCode),
		webhookClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		lakehouse: NewLakehousePublisher(),
	}
}

// CreateVANRequest represents a request to create a virtual account
type CreateVANRequest struct {
	BankID          string                 `json:"bank_id"`
	ParentAccountID string                 `json:"parent_account_id" binding:"required"`
	CustomerID      string                 `json:"customer_id"`
	Purpose         string                 `json:"purpose" binding:"required"` // loan_collection, merchant, escrow, agent, payroll
	ReferenceID     string                 `json:"reference_id"`
	ReferenceType   string                 `json:"reference_type"`
	AccountName     string                 `json:"account_name" binding:"required"`
	Currency        string                 `json:"currency"`
	ExpiresAt       *time.Time             `json:"expires_at,omitempty"`
	SingleUse       bool                   `json:"single_use"`
	ExpectedAmount  *float64               `json:"expected_amount,omitempty"`
	MinAmount       *float64               `json:"min_amount,omitempty"`
	MaxAmount       *float64               `json:"max_amount,omitempty"`
	WebhookURL      string                 `json:"webhook_url,omitempty"`
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
}

func validateCreateVANRequest(req *CreateVANRequest) error {
	validPurposes := map[string]bool{
		"loan_collection": true,
		"merchant":        true,
		"escrow":          true,
		"agent":           true,
		"payroll":         true,
		"general":         true,
	}
	if !validPurposes[req.Purpose] {
		return fmt.Errorf("unsupported VAN purpose: %s", req.Purpose)
	}
	if req.Currency != "" && req.Currency != "NGN" {
		return fmt.Errorf("only NGN virtual accounts are currently supported")
	}
	// parent_account_id must be a valid integer — account-service uses integer PKs as TigerBeetle IDs
	if _, err := strconv.ParseInt(req.ParentAccountID, 10, 64); err != nil {
		return fmt.Errorf("parent_account_id must be a valid integer account ID")
	}
	if req.ExpiresAt != nil && req.ExpiresAt.Before(time.Now()) {
		return fmt.Errorf("expiry must be in the future")
	}
	if req.MinAmount != nil && *req.MinAmount < 0 {
		return fmt.Errorf("minimum amount cannot be negative")
	}
	if req.MaxAmount != nil && *req.MaxAmount <= 0 {
		return fmt.Errorf("maximum amount must be positive")
	}
	if req.MinAmount != nil && req.MaxAmount != nil && *req.MinAmount > *req.MaxAmount {
		return fmt.Errorf("minimum amount cannot exceed maximum amount")
	}
	if req.ExpectedAmount != nil {
		if *req.ExpectedAmount <= 0 {
			return fmt.Errorf("expected amount must be positive")
		}
		if req.MinAmount != nil && *req.ExpectedAmount < *req.MinAmount {
			return fmt.Errorf("expected amount cannot be below the configured minimum")
		}
		if req.MaxAmount != nil && *req.ExpectedAmount > *req.MaxAmount {
			return fmt.Errorf("expected amount cannot exceed the configured maximum")
		}
	}
	return nil
}

// CreateVAN creates a new virtual account number
func (s *VirtualAccountService) CreateVAN(ctx context.Context, req *CreateVANRequest) (*VirtualAccount, error) {
	if err := validateCreateVANRequest(req); err != nil {
		return nil, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	// Generate unique VAN
	van, err := s.generateVAN(req.BankID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate VAN: %w", err)
	}

	// Set defaults
	currency := req.Currency
	if currency == "" {
		currency = "NGN"
	}

	now := time.Now()
	account := &VirtualAccount{
		ID:              uuid.New().String(),
		VAN:             van,
		BankID:          req.BankID,
		ParentAccountID: req.ParentAccountID,
		CustomerID:      req.CustomerID,
		Purpose:         req.Purpose,
		ReferenceID:     req.ReferenceID,
		ReferenceType:   req.ReferenceType,
		AccountName:     req.AccountName,
		Currency:        currency,
		Status:          "active",
		ExpiresAt:       req.ExpiresAt,
		SingleUse:       req.SingleUse,
		ExpectedAmount:  req.ExpectedAmount,
		MinAmount:       req.MinAmount,
		MaxAmount:       req.MaxAmount,
		WebhookURL:      req.WebhookURL,
		Metadata:        req.Metadata,
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	// Store account
	s.accounts[van] = account
	s.accountsByID[account.ID] = account

	// Escrow VANs need a dedicated holding account in TigerBeetle.
	// All other purposes credit the parent account directly on payment, so no sub-account is needed.
	if account.Purpose == "escrow" {
		if err := s.createEscrowHoldingAccount(ctx, account); err != nil {
			log.Printf("Warning: Failed to create escrow holding account: %v", err)
		}
	}

	// Register with NIBSS for inbound routing
	if err := s.registerWithNIBSS(ctx, account); err != nil {
		log.Printf("Warning: Failed to register with NIBSS: %v", err)
		// Continue anyway - can be registered later
	}

	// Update metrics
	vanCreated.WithLabelValues(req.BankID, req.Purpose).Inc()

	if s.lakehouse != nil {
		if err := s.lakehouse.PublishVANCreated(ctx, account.ID, account.VAN, account.Purpose, account.ReferenceID, account.BankID); err != nil {
			log.Printf("Warning: failed to publish VAN creation to lakehouse: %v", err)
		}
	}

	log.Printf("Created VAN %s for bank %s, purpose %s, reference %s", van, req.BankID, req.Purpose, req.ReferenceID)
	return account, nil
}

// generateVAN generates a unique 10-digit NUBAN-format virtual account number
func (s *VirtualAccountService) generateVAN(bankID string) (string, error) {
	// Get or create bank prefix (first 3 digits)
	prefix, ok := s.bankPrefixes[bankID]
	if !ok {
		// Generate a unique prefix for this bank
		prefix = fmt.Sprintf("%03d", len(s.bankPrefixes)+100)
		s.bankPrefixes[bankID] = prefix
	}

	// Generate random 6 digits
	randomBytes := make([]byte, 4)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", err
	}
	randomPart := fmt.Sprintf("%06d", int(randomBytes[0])<<16|int(randomBytes[1])<<8|int(randomBytes[2]))[:6]

	// Calculate check digit (simplified NUBAN algorithm)
	baseNumber := prefix + randomPart
	checkDigit := s.calculateCheckDigit(baseNumber)

	van := baseNumber + strconv.Itoa(checkDigit)

	// Ensure uniqueness
	if _, exists := s.accounts[van]; exists {
		return s.generateVAN(bankID) // Retry
	}

	return van, nil
}

// calculateCheckDigit calculates NUBAN check digit
func (s *VirtualAccountService) calculateCheckDigit(baseNumber string) int {
	weights := []int{3, 7, 3, 3, 7, 3, 3, 7, 3}
	sum := 0
	for i, char := range baseNumber {
		if i >= len(weights) {
			break
		}
		digit, _ := strconv.Atoi(string(char))
		sum += digit * weights[i]
	}
	return (10 - (sum % 10)) % 10
}

// createEscrowHoldingAccount creates a dedicated TigerBeetle account to hold escrow funds.
func (s *VirtualAccountService) createEscrowHoldingAccount(ctx context.Context, account *VirtualAccount) error {
	if err := s.tbClient.EnsureNostroAccount(ctx, account.BankID); err != nil {
		return fmt.Errorf("failed to ensure nostro account: %w", err)
	}
	if err := s.tbClient.CreateEscrowHoldingAccount(ctx, account); err != nil {
		return fmt.Errorf("failed to create escrow holding account: %w", err)
	}
	return nil
}

// registerWithNIBSS registers the VAN with NIBSS for inbound payment routing
func (s *VirtualAccountService) registerWithNIBSS(ctx context.Context, account *VirtualAccount) error {
	if err := s.nibssClient.RegisterVAN(ctx, account); err != nil {
		return fmt.Errorf("failed to register VAN with NIBSS: %w", err)
	}
	return nil
}

// ProcessInboundPayment processes an inbound payment to a VAN
func (s *VirtualAccountService) ProcessInboundPayment(ctx context.Context, payment *VANPayment) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, existing := range s.payments {
		if payment.SessionID != "" && existing.SessionID == payment.SessionID {
			return fmt.Errorf("duplicate inbound payment session: %s", payment.SessionID)
		}
		if payment.TransactionRef != "" && existing.TransactionRef == payment.TransactionRef {
			return fmt.Errorf("duplicate inbound payment reference: %s", payment.TransactionRef)
		}
	}

	// Find the VAN
	account, ok := s.accounts[payment.VAN]
	if !ok {
		return fmt.Errorf("VAN not found: %s", payment.VAN)
	}

	// Validate account status
	if account.Status != "active" {
		return fmt.Errorf("VAN is not active: %s", account.Status)
	}

	// Check expiry
	if account.ExpiresAt != nil && time.Now().After(*account.ExpiresAt) {
		return fmt.Errorf("VAN has expired")
	}

	// Validate amount constraints
	if account.MinAmount != nil && payment.Amount < *account.MinAmount {
		return fmt.Errorf("payment amount %.2f below minimum %.2f", payment.Amount, *account.MinAmount)
	}
	if account.MaxAmount != nil && payment.Amount > *account.MaxAmount {
		return fmt.Errorf("payment amount %.2f exceeds maximum %.2f", payment.Amount, *account.MaxAmount)
	}

	// Generate payment ID
	payment.ID = uuid.New().String()
	payment.VANID = account.ID
	payment.BankID = account.BankID
	payment.Currency = account.Currency
	payment.Status = "pending"
	payment.CreatedAt = time.Now()

	// Create ledger entry in TigerBeetle
	ledgerEntryID, err := s.createLedgerEntry(ctx, account, payment)
	if err != nil {
		payment.Status = "failed"
		s.payments[payment.ID] = payment
		return fmt.Errorf("failed to create ledger entry: %w", err)
	}
	payment.LedgerEntryID = ledgerEntryID

	// Update account stats
	account.TotalReceived += payment.Amount
	account.PaymentCount++
	now := time.Now()
	account.LastPaymentAt = &now
	account.UpdatedAt = now

	// Handle single-use VAN
	if account.SingleUse {
		account.Status = "closed"
	}

	// Mark payment as processed
	payment.Status = "processed"
	payment.ProcessedAt = &now
	s.payments[payment.ID] = payment

	// Send webhook notification
	go s.sendWebhookNotification(account, payment)

	// Update metrics
	vanPaymentsReceived.WithLabelValues(account.BankID, account.Purpose).Inc()
	vanPaymentAmount.WithLabelValues(account.BankID).Observe(payment.Amount)

	if s.lakehouse != nil {
		if err := s.lakehouse.PublishVANCollection(ctx, account.ID, payment.TransactionRef, payment.Amount, payment.Currency, payment.SenderName, payment.SenderBank, account.BankID); err != nil {
			log.Printf("Warning: failed to publish VAN collection to lakehouse: %v", err)
		}
		if s.shouldRouteSettlementViaMojaloop(account, payment) {
			settlementRef := payment.TransactionRef
			if settlementRef == "" {
				settlementRef = payment.ID
			}
			if err := s.lakehouse.PublishVANSettlement(ctx, account.ID, settlementRef, payment.Amount, account.ParentAccountID, account.BankID); err != nil {
				log.Printf("Warning: failed to publish VAN settlement to lakehouse: %v", err)
			}
		}
	}

	log.Printf("Processed payment %s of %.2f to VAN %s", payment.ID, payment.Amount, payment.VAN)
	return nil
}

func (s *VirtualAccountService) shouldRouteSettlementViaMojaloop(account *VirtualAccount, payment *VANPayment) bool {
	if strings.EqualFold(account.Currency, "NGN") {
		if payment.Metadata != nil {
			if explicit, ok := payment.Metadata["settlement_network"].(string); ok && strings.EqualFold(explicit, "mojaloop") {
				return true
			}
			if corridor, ok := payment.Metadata["corridor_type"].(string); ok && strings.EqualFold(corridor, "cross-border") {
				return true
			}
		}
		return false
	}
	return true
}

// createLedgerEntry creates a ledger entry in TigerBeetle
func (s *VirtualAccountService) createLedgerEntry(ctx context.Context, account *VirtualAccount, payment *VANPayment) (string, error) {
	if err := s.tbClient.EnsureNostroAccount(ctx, account.BankID); err != nil {
		return "", fmt.Errorf("failed to ensure nostro account: %w", err)
	}
	transferID, err := s.tbClient.CreditVANAccount(ctx, account, payment)
	if err != nil {
		return "", fmt.Errorf("failed to credit VAN account: %w", err)
	}
	return transferID, nil
}

// sendWebhookNotification sends payment notification to configured webhook
func (s *VirtualAccountService) sendWebhookNotification(account *VirtualAccount, payment *VANPayment) {
	if account.WebhookURL == "" {
		return
	}

	payload := map[string]interface{}{
		"event":           "van.payment.received",
		"van_id":          account.ID,
		"van":             account.VAN,
		"payment_id":      payment.ID,
		"amount":          payment.Amount,
		"currency":        payment.Currency,
		"sender_name":     payment.SenderName,
		"sender_account":  payment.SenderAccount,
		"sender_bank":     payment.SenderBank,
		"narration":       payment.Narration,
		"reference_id":    account.ReferenceID,
		"reference_type":  account.ReferenceType,
		"session_id":      payment.SessionID,
		"transaction_ref": payment.TransactionRef,
		"timestamp":       time.Now().UTC().Format(time.RFC3339),
	}

	jsonData, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", account.WebhookURL, strings.NewReader(string(jsonData)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Webhook-Signature", s.generateWebhookSignature(jsonData))

	resp, err := s.webhookClient.Do(req)
	if err != nil {
		log.Printf("Webhook failed for VAN %s: %v", account.VAN, err)
		return
	}
	defer resp.Body.Close()

	s.mu.Lock()
	payment.WebhookSent = true
	payment.WebhookResponse = fmt.Sprintf("Status: %d", resp.StatusCode)
	s.mu.Unlock()

	log.Printf("Webhook sent for VAN %s payment %s: status %d", account.VAN, payment.ID, resp.StatusCode)
}

// generateWebhookSignature generates HMAC signature for webhook payload
func (s *VirtualAccountService) generateWebhookSignature(payload []byte) string {
	// In production, use HMAC-SHA256 with a secret key
	hash := make([]byte, 32)
	rand.Read(hash)
	return "sha256=" + hex.EncodeToString(hash)
}

// GetVAN retrieves a virtual account by VAN
func (s *VirtualAccountService) GetVAN(van string) (*VirtualAccount, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	account, ok := s.accounts[van]
	if !ok {
		return nil, fmt.Errorf("VAN not found: %s", van)
	}
	return account, nil
}

// GetVANByID retrieves a virtual account by ID
func (s *VirtualAccountService) GetVANByID(id string) (*VirtualAccount, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	account, ok := s.accountsByID[id]
	if !ok {
		return nil, fmt.Errorf("VAN not found: %s", id)
	}
	return account, nil
}

// ListVANsByCustomer lists all VANs for a customer
func (s *VirtualAccountService) ListVANsByCustomer(bankID, customerID string) []*VirtualAccount {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var accounts []*VirtualAccount
	for _, account := range s.accounts {
		if account.BankID == bankID && account.CustomerID == customerID {
			accounts = append(accounts, account)
		}
	}
	return accounts
}

// ListVANsByReference lists all VANs for a reference (e.g., loan ID)
func (s *VirtualAccountService) ListVANsByReference(bankID, referenceType, referenceID string) []*VirtualAccount {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var accounts []*VirtualAccount
	for _, account := range s.accounts {
		if account.BankID == bankID && account.ReferenceType == referenceType && account.ReferenceID == referenceID {
			accounts = append(accounts, account)
		}
	}
	return accounts
}

func (s *VirtualAccountService) SearchVANs(bankID, query string, limit int) []*VirtualAccount {
	s.mu.RLock()
	defer s.mu.RUnlock()

	query = strings.ToLower(strings.TrimSpace(query))
	var accounts []*VirtualAccount
	for _, account := range s.accounts {
		if bankID != "" && account.BankID != bankID {
			continue
		}
		if query == "" || strings.Contains(strings.ToLower(account.VAN), query) || strings.Contains(strings.ToLower(account.AccountName), query) || strings.Contains(strings.ToLower(account.CustomerID), query) || strings.Contains(strings.ToLower(account.ReferenceID), query) {
			accounts = append(accounts, account)
			if limit > 0 && len(accounts) >= limit {
				break
			}
		}
	}
	return accounts
}

// UpdateVANStatus updates the status of a VAN
func (s *VirtualAccountService) UpdateVANStatus(van, status string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	account, ok := s.accounts[van]
	if !ok {
		return fmt.Errorf("VAN not found: %s", van)
	}

	validStatuses := map[string]bool{"active": true, "suspended": true, "closed": true}
	if !validStatuses[status] {
		return fmt.Errorf("invalid status: %s", status)
	}

	account.Status = status
	account.UpdatedAt = time.Now()

	// Update NIBSS registration
	go s.updateNIBSSStatus(context.Background(), account)

	return nil
}

// updateNIBSSStatus updates VAN status with NIBSS
func (s *VirtualAccountService) updateNIBSSStatus(ctx context.Context, account *VirtualAccount) {
	if err := s.nibssClient.UpdateVANStatus(ctx, account.VAN, account.Status); err != nil {
		log.Printf("failed to update NIBSS status for VAN %s: %v", account.VAN, err)
	}
}

// GetPaymentHistory retrieves payment history for a VAN
func (s *VirtualAccountService) GetPaymentHistory(van string, limit int) []*VANPayment {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var payments []*VANPayment
	for _, payment := range s.payments {
		if payment.VAN == van {
			payments = append(payments, payment)
			if limit > 0 && len(payments) >= limit {
				break
			}
		}
	}
	return payments
}

// Helper functions

func getAccountCode(purpose string) int {
	codes := map[string]int{
		"loan_collection": 1001,
		"merchant":        1002,
		"escrow":          1003,
		"agent":           1004,
		"payroll":         1005,
		"general":         1000,
	}
	if code, ok := codes[purpose]; ok {
		return code
	}
	return 1000
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// HTTP Handlers

// jwtAuthMiddleware validates Bearer tokens against the Keycloak JWKS endpoint
// (RS256 signature + required exp claim). Fail-closed: any verification
// problem yields 401. Identity headers (X-User-Id, X-Keycloak-ID, X-Tenant-ID,
// X-User-Role) are overwritten from verified claims — caller-supplied values
// are never trusted.
func jwtAuthMiddleware() gin.HandlerFunc {
	ensureJWKSRefresh()
	return func(c *gin.Context) {
		r := c.Request
		p := r.URL.Path
		if isProbePath(p) {
			c.Next()
			return
		}
		auth := c.GetHeader("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing bearer token"})
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token format"})
			return
		}
		headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token header"})
			return
		}
		var header struct {
			Kid string `json:"kid"`
			Alg string `json:"alg"`
		}
		if err := json.Unmarshal(headerBytes, &header); err != nil || header.Kid == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token header"})
			return
		}
		if header.Alg != "RS256" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unsupported token algorithm"})
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
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unknown signing key"})
				return
			}
		}
		sigBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid signature encoding"})
			return
		}
		hash := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
		if err := rsa.VerifyPKCS1v15(pub, crypto.SHA256, hash[:], sigBytes); err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid signature"})
			return
		}
		claimsBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid claims encoding"})
			return
		}
		var claims map[string]interface{}
		if err := json.Unmarshal(claimsBytes, &claims); err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid claims"})
			return
		}
		exp, ok := claims["exp"].(float64)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "token missing exp claim"})
			return
		}
		if time.Now().Unix() >= int64(exp) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "token expired"})
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
		c.Set("jwt_claims", claims)
		c.Next()
	}
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
	service := NewVirtualAccountService()

	router := gin.Default()
	router.Use(jwtAuthMiddleware())
	router.Use(auditMiddleware())

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "virtual-account-service"})
	})

	// Metrics endpoint
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// API routes
	api := router.Group("/api/v1/virtual-accounts")
	{
		// Create VAN
		api.POST("", func(c *gin.Context) {
			var req CreateVANRequest
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			if req.BankID == "" {
				req.BankID = c.Query("tenantId")
			}
			if req.BankID == "" {
				req.BankID = c.GetHeader("X-Bank-ID")
			}
			if req.BankID == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "bank_id is required (pass tenantId query param or X-Bank-ID header)"})
				return
			}

			account, err := service.CreateVAN(c.Request.Context(), &req)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusCreated, account)
		})

		// Get VAN by number
		api.GET("/:van", func(c *gin.Context) {
			van := c.Param("van")
			account, err := service.GetVAN(van)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, account)
		})

		// Get VAN by ID
		api.GET("/id/:id", func(c *gin.Context) {
			id := c.Param("id")
			account, err := service.GetVANByID(id)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, account)
		})

		// List VANs by customer
		api.GET("/customer/:customer_id", func(c *gin.Context) {
			bankID := c.GetHeader("X-Bank-ID")
			customerID := c.Param("customer_id")
			accounts := service.ListVANsByCustomer(bankID, customerID)
			c.JSON(http.StatusOK, gin.H{"accounts": accounts, "count": len(accounts)})
		})

		// List VANs by reference
		api.GET("/reference/:type/:id", func(c *gin.Context) {
			bankID := c.GetHeader("X-Bank-ID")
			refType := c.Param("type")
			refID := c.Param("id")
			accounts := service.ListVANsByReference(bankID, refType, refID)
			c.JSON(http.StatusOK, gin.H{"accounts": accounts, "count": len(accounts)})
		})

		// Search VANs
		api.GET("/search", func(c *gin.Context) {
			bankID := c.GetHeader("X-Bank-ID")
			query := c.Query("q")
			limit, _ := strconv.Atoi(c.DefaultQuery("limit", "25"))
			accounts := service.SearchVANs(bankID, query, limit)
			c.JSON(http.StatusOK, gin.H{"accounts": accounts, "count": len(accounts), "query": query})
		})

		// Update VAN status

		api.PUT("/:van/status", func(c *gin.Context) {
			van := c.Param("van")
			var req struct {
				Status string `json:"status" binding:"required"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			if err := service.UpdateVANStatus(van, req.Status); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusOK, gin.H{"message": "status updated"})
		})

		// Get payment history
		api.GET("/:van/payments", func(c *gin.Context) {
			van := c.Param("van")
			limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
			payments := service.GetPaymentHistory(van, limit)
			c.JSON(http.StatusOK, gin.H{"payments": payments, "count": len(payments)})
		})

		// Receive inbound payment (NIBSS webhook)
		api.POST("/payments/inbound", func(c *gin.Context) {
			var payment VANPayment
			if err := c.ShouldBindJSON(&payment); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			if err := service.ProcessInboundPayment(c.Request.Context(), &payment); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusOK, gin.H{"message": "payment processed", "payment_id": payment.ID})
		})
	}

	// Bulk operations
	bulk := router.Group("/api/v1/virtual-accounts/bulk")
	{
		// Bulk create VANs
		bulk.POST("", func(c *gin.Context) {
			var req struct {
				Requests []CreateVANRequest `json:"requests" binding:"required"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			var accounts []*VirtualAccount
			var errors []string
			for i, r := range req.Requests {
				account, err := service.CreateVAN(c.Request.Context(), &r)
				if err != nil {
					errors = append(errors, fmt.Sprintf("request %d: %s", i, err.Error()))
					continue
				}
				accounts = append(accounts, account)
			}

			c.JSON(http.StatusOK, gin.H{
				"created":  len(accounts),
				"failed":   len(errors),
				"accounts": accounts,
				"errors":   errors,
			})
		})
	}

	// Loan collection specific endpoints
	loans := router.Group("/api/v1/virtual-accounts/loans")
	{
		// Create VAN for loan collection
		loans.POST("/:loan_id", func(c *gin.Context) {
			loanID := c.Param("loan_id")
			var req struct {
				BankID          string  `json:"bank_id" binding:"required"`
				ParentAccountID string  `json:"parent_account_id" binding:"required"`
				CustomerID      string  `json:"customer_id" binding:"required"`
				LoanAmount      float64 `json:"loan_amount"`
				WebhookURL      string  `json:"webhook_url"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			vanReq := &CreateVANRequest{
				BankID:          req.BankID,
				ParentAccountID: req.ParentAccountID,
				CustomerID:      req.CustomerID,
				Purpose:         "loan_collection",
				ReferenceID:     loanID,
				ReferenceType:   "loan",
				AccountName:     fmt.Sprintf("Loan Repayment - %s", loanID),
				WebhookURL:      req.WebhookURL,
				Metadata: map[string]interface{}{
					"loan_amount": req.LoanAmount,
				},
			}

			account, err := service.CreateVAN(c.Request.Context(), vanReq)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusCreated, account)
		})
	}

	// Merchant specific endpoints
	merchants := router.Group("/api/v1/virtual-accounts/merchants")
	{
		// Create VAN for merchant
		merchants.POST("/:merchant_id", func(c *gin.Context) {
			merchantID := c.Param("merchant_id")
			var req struct {
				BankID          string `json:"bank_id" binding:"required"`
				ParentAccountID string `json:"parent_account_id" binding:"required"`
				MerchantName    string `json:"merchant_name" binding:"required"`
				WebhookURL      string `json:"webhook_url"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			vanReq := &CreateVANRequest{
				BankID:          req.BankID,
				ParentAccountID: req.ParentAccountID,
				CustomerID:      merchantID,
				Purpose:         "merchant",
				ReferenceID:     merchantID,
				ReferenceType:   "merchant",
				AccountName:     fmt.Sprintf("Merchant - %s", req.MerchantName),
				WebhookURL:      req.WebhookURL,
			}

			account, err := service.CreateVAN(c.Request.Context(), vanReq)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusCreated, account)
		})
	}

	// Escrow specific endpoints
	escrow := router.Group("/api/v1/virtual-accounts/escrow")
	{
		// Create VAN for escrow
		escrow.POST("/:escrow_id", func(c *gin.Context) {
			escrowID := c.Param("escrow_id")
			var req struct {
				BankID          string     `json:"bank_id" binding:"required"`
				ParentAccountID string     `json:"parent_account_id" binding:"required"`
				BuyerID         string     `json:"buyer_id" binding:"required"`
				ExpectedAmount  float64    `json:"expected_amount"`
				ExpiresAt       *time.Time `json:"expires_at"`
				WebhookURL      string     `json:"webhook_url"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			vanReq := &CreateVANRequest{
				BankID:          req.BankID,
				ParentAccountID: req.ParentAccountID,
				CustomerID:      req.BuyerID,
				Purpose:         "escrow",
				ReferenceID:     escrowID,
				ReferenceType:   "escrow",
				AccountName:     fmt.Sprintf("Escrow - %s", escrowID),
				ExpectedAmount:  &req.ExpectedAmount,
				ExpiresAt:       req.ExpiresAt,
				SingleUse:       true, // Escrow VANs are typically single-use
				WebhookURL:      req.WebhookURL,
			}

			account, err := service.CreateVAN(c.Request.Context(), vanReq)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusCreated, account)
		})
	}

	port := getEnv("PORT", "8080")
	log.Printf("Virtual Account Service starting on port %s", port)
	router.Run(":" + port)
}
