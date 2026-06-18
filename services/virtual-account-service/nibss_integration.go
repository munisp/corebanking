package main

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"
)

// NIBSSClient handles communication with NIBSS for VAN registration and payment routing
type NIBSSClient struct {
	baseURL     string
	apiKey      string
	secretKey   string
	bankCode    string
	httpClient  *http.Client
}

// NewNIBSSClient creates a new NIBSS client
func NewNIBSSClient(baseURL, apiKey, secretKey, bankCode string) *NIBSSClient {
	return &NIBSSClient{
		baseURL:   baseURL,
		apiKey:    apiKey,
		secretKey: secretKey,
		bankCode:  bankCode,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// NIBSSVANRegistration represents a VAN registration request to NIBSS
type NIBSSVANRegistration struct {
	VirtualAccountNumber string `json:"virtual_account_number"`
	AccountName          string `json:"account_name"`
	BankCode             string `json:"bank_code"`
	ParentAccountNumber  string `json:"parent_account_number"`
	Status               string `json:"status"`
	ExpiryDate           string `json:"expiry_date,omitempty"`
	SingleUse            bool   `json:"single_use"`
	MinAmount            int64  `json:"min_amount,omitempty"`
	MaxAmount            int64  `json:"max_amount,omitempty"`
}

// NIBSSInboundPayment represents an inbound payment notification from NIBSS
type NIBSSInboundPayment struct {
	SessionID              string  `json:"session_id"`
	TransactionReference   string  `json:"transaction_reference"`
	BeneficiaryAccountNo   string  `json:"beneficiary_account_no"`
	BeneficiaryAccountName string  `json:"beneficiary_account_name"`
	BeneficiaryBankCode    string  `json:"beneficiary_bank_code"`
	OriginatorAccountNo    string  `json:"originator_account_no"`
	OriginatorAccountName  string  `json:"originator_account_name"`
	OriginatorBankCode     string  `json:"originator_bank_code"`
	OriginatorBankName     string  `json:"originator_bank_name"`
	Amount                 float64 `json:"amount"`
	Narration              string  `json:"narration"`
	PaymentDate            string  `json:"payment_date"`
	ChannelCode            string  `json:"channel_code"`
}

// NIBSSNameEnquiryRequest represents a name enquiry request
type NIBSSNameEnquiryRequest struct {
	AccountNumber string `json:"account_number"`
	BankCode      string `json:"bank_code"`
}

// NIBSSNameEnquiryResponse represents a name enquiry response
type NIBSSNameEnquiryResponse struct {
	AccountNumber string `json:"account_number"`
	AccountName   string `json:"account_name"`
	BankCode      string `json:"bank_code"`
	BVN           string `json:"bvn,omitempty"`
	KYCLevel      int    `json:"kyc_level"`
	ResponseCode  string `json:"response_code"`
	ResponseMsg   string `json:"response_message"`
}

// RegisterVAN registers a virtual account number with NIBSS
func (c *NIBSSClient) RegisterVAN(ctx context.Context, van *VirtualAccount) error {
	registration := NIBSSVANRegistration{
		VirtualAccountNumber: van.VAN,
		AccountName:          van.AccountName,
		BankCode:             c.bankCode,
		ParentAccountNumber:  van.ParentAccountID,
		Status:               "active",
		SingleUse:            van.SingleUse,
	}

	if van.ExpiresAt != nil {
		registration.ExpiryDate = van.ExpiresAt.Format("2006-01-02")
	}

	if van.MinAmount != nil {
		registration.MinAmount = int64(*van.MinAmount * 100)
	}

	if van.MaxAmount != nil {
		registration.MaxAmount = int64(*van.MaxAmount * 100)
	}

	return c.sendRequest(ctx, "POST", "/api/v1/van/register", registration)
}

// UpdateVANStatus updates the status of a VAN with NIBSS
func (c *NIBSSClient) UpdateVANStatus(ctx context.Context, van string, status string) error {
	payload := map[string]string{
		"virtual_account_number": van,
		"status":                 status,
	}

	return c.sendRequest(ctx, "PUT", "/api/v1/van/status", payload)
}

// DeactivateVAN deactivates a VAN with NIBSS
func (c *NIBSSClient) DeactivateVAN(ctx context.Context, van string) error {
	return c.UpdateVANStatus(ctx, van, "inactive")
}

// NameEnquiry performs a name enquiry for a VAN
func (c *NIBSSClient) NameEnquiry(ctx context.Context, accountNumber, bankCode string) (*NIBSSNameEnquiryResponse, error) {
	request := NIBSSNameEnquiryRequest{
		AccountNumber: accountNumber,
		BankCode:      bankCode,
	}

	jsonData, err := json.Marshal(request)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/api/v1/name-enquiry", strings.NewReader(string(jsonData)))
	if err != nil {
		return nil, err
	}

	c.addAuthHeaders(req, jsonData)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var response NIBSSNameEnquiryResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, err
	}

	return &response, nil
}

// sendRequest sends a request to NIBSS
func (c *NIBSSClient) sendRequest(ctx context.Context, method, path string, payload interface{}) error {
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, strings.NewReader(string(jsonData)))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	c.addAuthHeaders(req, jsonData)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("NIBSS returned status %d", resp.StatusCode)
	}

	log.Printf("NIBSS request successful: %s %s", method, path)
	return nil
}

// addAuthHeaders adds authentication headers to the request
func (c *NIBSSClient) addAuthHeaders(req *http.Request, payload []byte) {
	timestamp := time.Now().UTC().Format("20060102150405")
	signature := c.generateSignature(payload, timestamp)

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", c.apiKey)
	req.Header.Set("X-Timestamp", timestamp)
	req.Header.Set("X-Signature", signature)
	req.Header.Set("X-Bank-Code", c.bankCode)
}

// generateSignature generates HMAC-SHA256 signature for NIBSS requests
func (c *NIBSSClient) generateSignature(payload []byte, timestamp string) string {
	message := fmt.Sprintf("%s%s%s", c.apiKey, timestamp, string(payload))
	h := hmac.New(sha256.New, []byte(c.secretKey))
	h.Write([]byte(message))
	return hex.EncodeToString(h.Sum(nil))
}

// ValidateInboundPayment validates an inbound payment notification from NIBSS
func (c *NIBSSClient) ValidateInboundPayment(payment *NIBSSInboundPayment, signature string) bool {
	// Reconstruct the signature from the payment data
	payloadJSON, _ := json.Marshal(payment)
	expectedSignature := c.generateSignature(payloadJSON, payment.PaymentDate)
	
	return hmac.Equal([]byte(signature), []byte(expectedSignature))
}

// ConvertToVANPayment converts NIBSS inbound payment to internal VANPayment
func ConvertToVANPayment(nibssPayment *NIBSSInboundPayment) *VANPayment {
	return &VANPayment{
		VAN:            nibssPayment.BeneficiaryAccountNo,
		Amount:         nibssPayment.Amount,
		Currency:       "NGN",
		SenderName:     nibssPayment.OriginatorAccountName,
		SenderAccount:  nibssPayment.OriginatorAccountNo,
		SenderBank:     nibssPayment.OriginatorBankName,
		SenderBankCode: nibssPayment.OriginatorBankCode,
		Narration:      nibssPayment.Narration,
		SessionID:      nibssPayment.SessionID,
		TransactionRef: nibssPayment.TransactionReference,
		Status:         "pending",
		CreatedAt:      time.Now(),
	}
}

// NIBSSWebhookHandler handles incoming NIBSS payment notifications
type NIBSSWebhookHandler struct {
	nibssClient *NIBSSClient
	vanService  *VirtualAccountService
}

// NewNIBSSWebhookHandler creates a new webhook handler
func NewNIBSSWebhookHandler(nibssClient *NIBSSClient, vanService *VirtualAccountService) *NIBSSWebhookHandler {
	return &NIBSSWebhookHandler{
		nibssClient: nibssClient,
		vanService:  vanService,
	}
}

// HandleInboundPayment handles an inbound payment notification
func (h *NIBSSWebhookHandler) HandleInboundPayment(ctx context.Context, payment *NIBSSInboundPayment, signature string) error {
	// Validate signature
	if !h.nibssClient.ValidateInboundPayment(payment, signature) {
		return fmt.Errorf("invalid signature")
	}

	// Convert to internal payment format
	vanPayment := ConvertToVANPayment(payment)

	// Process the payment
	return h.vanService.ProcessInboundPayment(ctx, vanPayment)
}

// NIBSSBatchRegistration represents a batch VAN registration
type NIBSSBatchRegistration struct {
	BatchID       string                 `json:"batch_id"`
	BankCode      string                 `json:"bank_code"`
	Registrations []NIBSSVANRegistration `json:"registrations"`
}

// RegisterVANBatch registers multiple VANs with NIBSS in a batch
func (c *NIBSSClient) RegisterVANBatch(ctx context.Context, vans []*VirtualAccount) error {
	batch := NIBSSBatchRegistration{
		BatchID:       fmt.Sprintf("batch-%d", time.Now().UnixNano()),
		BankCode:      c.bankCode,
		Registrations: make([]NIBSSVANRegistration, len(vans)),
	}

	for i, van := range vans {
		batch.Registrations[i] = NIBSSVANRegistration{
			VirtualAccountNumber: van.VAN,
			AccountName:          van.AccountName,
			BankCode:             c.bankCode,
			ParentAccountNumber:  van.ParentAccountID,
			Status:               "active",
			SingleUse:            van.SingleUse,
		}
	}

	return c.sendRequest(ctx, "POST", "/api/v1/van/batch-register", batch)
}

// NIBSSPaymentConfirmation represents a payment confirmation to NIBSS
type NIBSSPaymentConfirmation struct {
	SessionID      string `json:"session_id"`
	ResponseCode   string `json:"response_code"`
	ResponseMsg    string `json:"response_message"`
	ProcessedAt    string `json:"processed_at"`
	LedgerEntryID  string `json:"ledger_entry_id,omitempty"`
}

// ConfirmPayment sends payment confirmation to NIBSS
func (c *NIBSSClient) ConfirmPayment(ctx context.Context, sessionID, responseCode, responseMsg, ledgerEntryID string) error {
	confirmation := NIBSSPaymentConfirmation{
		SessionID:     sessionID,
		ResponseCode:  responseCode,
		ResponseMsg:   responseMsg,
		ProcessedAt:   time.Now().UTC().Format(time.RFC3339),
		LedgerEntryID: ledgerEntryID,
	}

	return c.sendRequest(ctx, "POST", "/api/v1/payment/confirm", confirmation)
}

// NIBSSReversalRequest represents a payment reversal request
type NIBSSReversalRequest struct {
	OriginalSessionID string  `json:"original_session_id"`
	ReversalReason    string  `json:"reversal_reason"`
	Amount            float64 `json:"amount"`
	RequestedBy       string  `json:"requested_by"`
}

// RequestReversal requests a payment reversal from NIBSS
func (c *NIBSSClient) RequestReversal(ctx context.Context, originalSessionID, reason string, amount float64, requestedBy string) error {
	request := NIBSSReversalRequest{
		OriginalSessionID: originalSessionID,
		ReversalReason:    reason,
		Amount:            amount,
		RequestedBy:       requestedBy,
	}

	return c.sendRequest(ctx, "POST", "/api/v1/payment/reversal", request)
}

// GetVANStatus retrieves the status of a VAN from NIBSS
func (c *NIBSSClient) GetVANStatus(ctx context.Context, van string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/api/v1/van/"+van+"/status", nil)
	if err != nil {
		return "", err
	}

	c.addAuthHeaders(req, nil)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	return result.Status, nil
}
