package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"
)

// EscrowVANClient handles VAN operations for escrow service
type EscrowVANClient struct {
	baseURL    string
	httpClient *http.Client
}

// NewEscrowVANClient creates a new escrow VAN client
func NewEscrowVANClient(baseURL string) *EscrowVANClient {
	if baseURL == "" {
		baseURL = "http://virtual-account-service:8080"
	}
	return &EscrowVANClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// EscrowVAN represents a virtual account for escrow funding
type EscrowVAN struct {
	ID              string     `json:"id"`
	VAN             string     `json:"van"`
	EscrowID        string     `json:"escrow_id"`
	BankID          string     `json:"bank_id"`
	BuyerID         string     `json:"buyer_id"`
	ParentAccountID string     `json:"parent_account_id"`
	AccountName     string     `json:"account_name"`
	ExpectedAmount  float64    `json:"expected_amount"`
	TotalReceived   float64    `json:"total_received"`
	Status          string     `json:"status"`
	ExpiresAt       *time.Time `json:"expires_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
}

// CreateEscrowVANRequest represents a request to create a VAN for escrow
type CreateEscrowVANRequest struct {
	EscrowID        string     `json:"escrow_id"`
	BankID          string     `json:"bank_id"`
	BuyerID         string     `json:"buyer_id"`
	ParentAccountID string     `json:"parent_account_id"`
	ExpectedAmount  float64    `json:"expected_amount"`
	ExpiresAt       *time.Time `json:"expires_at,omitempty"`
	WebhookURL      string     `json:"webhook_url"`
}

// CreateEscrowVAN creates a virtual account for escrow funding
func (c *EscrowVANClient) CreateEscrowVAN(ctx context.Context, req *CreateEscrowVANRequest) (*EscrowVAN, error) {
	payload := map[string]interface{}{
		"bank_id":           req.BankID,
		"parent_account_id": req.ParentAccountID,
		"buyer_id":          req.BuyerID,
		"expected_amount":   req.ExpectedAmount,
		"webhook_url":       req.WebhookURL,
	}

	if req.ExpiresAt != nil {
		payload["expires_at"] = req.ExpiresAt.Format(time.RFC3339)
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/api/v1/virtual-accounts/escrow/%s", c.baseURL, req.EscrowID)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, strings.NewReader(string(jsonData)))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-Bank-ID", req.BankID)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("VAN service returned status %d", resp.StatusCode)
	}

	var van EscrowVAN
	if err := json.NewDecoder(resp.Body).Decode(&van); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	log.Printf("Created escrow VAN %s for escrow %s", van.VAN, req.EscrowID)
	return &van, nil
}

// GetEscrowVAN retrieves the VAN for an escrow
func (c *EscrowVANClient) GetEscrowVAN(ctx context.Context, bankID, escrowID string) (*EscrowVAN, error) {
	url := fmt.Sprintf("%s/api/v1/virtual-accounts/reference/escrow/%s", c.baseURL, escrowID)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-Bank-ID", bankID)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Accounts []EscrowVAN `json:"accounts"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if len(result.Accounts) == 0 {
		return nil, fmt.Errorf("no VAN found for escrow %s", escrowID)
	}

	return &result.Accounts[0], nil
}

// DeactivateEscrowVAN deactivates the VAN when escrow is completed or cancelled
func (c *EscrowVANClient) DeactivateEscrowVAN(ctx context.Context, van string) error {
	url := fmt.Sprintf("%s/api/v1/virtual-accounts/%s/status", c.baseURL, van)
	payload := map[string]string{"status": "closed"}
	jsonData, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, "PUT", url, strings.NewReader(string(jsonData)))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to deactivate VAN: status %d", resp.StatusCode)
	}

	log.Printf("Deactivated escrow VAN %s", van)
	return nil
}

// EscrowVANWebhookPayload represents the webhook payload for escrow VAN payments
type EscrowVANWebhookPayload struct {
	Event          string  `json:"event"`
	VANID          string  `json:"van_id"`
	VAN            string  `json:"van"`
	PaymentID      string  `json:"payment_id"`
	Amount         float64 `json:"amount"`
	Currency       string  `json:"currency"`
	SenderName     string  `json:"sender_name"`
	SenderAccount  string  `json:"sender_account"`
	SenderBank     string  `json:"sender_bank"`
	Narration      string  `json:"narration"`
	ReferenceID    string  `json:"reference_id"`   // Escrow ID
	ReferenceType  string  `json:"reference_type"` // "escrow"
	SessionID      string  `json:"session_id"`
	TransactionRef string  `json:"transaction_ref"`
	Timestamp      string  `json:"timestamp"`
}

// EscrowFundingHandler handles escrow funding via VAN
type EscrowFundingHandler struct {
	vanClient *EscrowVANClient
}

// NewEscrowFundingHandler creates a new escrow funding handler
func NewEscrowFundingHandler(vanClient *EscrowVANClient) *EscrowFundingHandler {
	return &EscrowFundingHandler{vanClient: vanClient}
}

// HandleVANPayment processes a VAN payment webhook for escrow funding.
//
// W7-C-03: this handler previously logged the payment and returned nil
// (silent success) without ever crediting the escrow. That is unacceptable on
// a real-money funding path, so it now FAILS CLOSED.
//
// MISSING BUSINESS RULE (must be supplied by the escrow product/ledger owners
// before this handler may be enabled): the authoritative crediting semantics
// for VAN funding — i.e. which ledger account is debited/credited, how
// partial vs. exact vs. over-payment amounts map to FundedAmount, when the
// escrow transitions to "funded", and which notification/workflow signal
// fires on completion. Until that rule is implemented here, every call
// returns an explicit error and the caller (the currently-unregistered
// webhook endpoint, see the commented block below) must surface it as a 503.
// The webhook route must remain UNREGISTERED until crediting is implemented
// and webhook-signature verification is in place.
func (h *EscrowFundingHandler) HandleVANPayment(ctx context.Context, payload *EscrowVANWebhookPayload) error {
	if payload.ReferenceType != "escrow" {
		return fmt.Errorf("invalid reference type: %s", payload.ReferenceType)
	}

	escrowID := payload.ReferenceID
	amount := payload.Amount

	log.Printf("VAN funding webhook received but NOT credited (crediting rule unimplemented): escrow=%s, amount=%.2f, payment=%s, txn=%s",
		escrowID, amount, payload.PaymentID, payload.TransactionRef)

	return fmt.Errorf("van_funding_not_configured: escrow %s VAN payment %.2f (%s) cannot be credited — authoritative escrow crediting rule is not implemented", escrowID, amount, payload.TransactionRef)
}

// EscrowDetails represents escrow information needed for VAN creation
type EscrowDetails struct {
	ID              string     `json:"id"`
	BankID          string     `json:"bank_id"`
	BuyerID         string     `json:"buyer_id"`
	SellerID        string     `json:"seller_id"`
	EscrowAccountID string     `json:"escrow_account_id"`
	Amount          float64    `json:"amount"`
	Currency        string     `json:"currency"`
	Status          string     `json:"status"`
	ExpiresAt       *time.Time `json:"expires_at,omitempty"`
}

// CreateVANOnEscrowCreation creates a VAN when an escrow is created
func CreateVANOnEscrowCreation(ctx context.Context, vanClient *EscrowVANClient, escrow *EscrowDetails) (*EscrowVAN, error) {
	webhookURL := "http://escrow-service:8080/api/v1/webhooks/van-payment"

	req := &CreateEscrowVANRequest{
		EscrowID:        escrow.ID,
		BankID:          escrow.BankID,
		BuyerID:         escrow.BuyerID,
		ParentAccountID: escrow.EscrowAccountID,
		ExpectedAmount:  escrow.Amount,
		ExpiresAt:       escrow.ExpiresAt,
		WebhookURL:      webhookURL,
	}

	return vanClient.CreateEscrowVAN(ctx, req)
}

// MultiPartyEscrowVAN represents VANs for multi-party escrow
type MultiPartyEscrowVAN struct {
	EscrowID    string     `json:"escrow_id"`
	PartyVANs   []PartyVAN `json:"party_vans"`
	TotalAmount float64    `json:"total_amount"`
	Status      string     `json:"status"`
}

// PartyVAN represents a VAN for a specific party in multi-party escrow
type PartyVAN struct {
	PartyID        string  `json:"party_id"`
	PartyRole      string  `json:"party_role"` // buyer, co-buyer, guarantor
	VAN            string  `json:"van"`
	ExpectedAmount float64 `json:"expected_amount"`
	ReceivedAmount float64 `json:"received_amount"`
	Status         string  `json:"status"`
}

// CreateMultiPartyEscrowVANs creates VANs for all parties in a multi-party escrow
func (c *EscrowVANClient) CreateMultiPartyEscrowVANs(ctx context.Context, escrow *EscrowDetails, parties []EscrowParty) (*MultiPartyEscrowVAN, error) {
	result := &MultiPartyEscrowVAN{
		EscrowID:    escrow.ID,
		PartyVANs:   make([]PartyVAN, 0, len(parties)),
		TotalAmount: escrow.Amount,
		Status:      "pending",
	}

	for _, party := range parties {
		// Use ID for PartyID, Role for PartyRole, and SplitAmount for ContributionAmount
		expectedAmount := 0.0
		if party.SplitAmount != nil {
			expectedAmount = *party.SplitAmount
		}
		req := &CreateEscrowVANRequest{
			EscrowID:        fmt.Sprintf("%s-%s", escrow.ID, party.ID),
			BankID:          escrow.BankID,
			BuyerID:         party.ID,
			ParentAccountID: escrow.EscrowAccountID,
			ExpectedAmount:  expectedAmount,
			ExpiresAt:       escrow.ExpiresAt,
			WebhookURL:      "http://escrow-service:8080/api/v1/webhooks/van-payment",
		}

		van, err := c.CreateEscrowVAN(ctx, req)
		if err != nil {
			log.Printf("Warning: Failed to create VAN for party %s: %v", party.ID, err)
			continue
		}

		result.PartyVANs = append(result.PartyVANs, PartyVAN{
			PartyID:        party.ID,
			PartyRole:      string(party.Role),
			VAN:            van.VAN,
			ExpectedAmount: expectedAmount,
			ReceivedAmount: 0,
			Status:         "pending",
		})
	}

	return result, nil
}

// EscrowParty represents a party in a multi-party escrow
// Use EscrowParty from escrow_service.go

// Example usage in escrow service:
/*
func (s *EscrowService) CreateEscrow(ctx context.Context, req *CreateEscrowRequest) (*Escrow, error) {
    // Create escrow record
    escrow := &Escrow{
        ID:              uuid.New().String(),
        BankID:          req.BankID,
        BuyerID:         req.BuyerID,
        SellerID:        req.SellerID,
        Amount:          req.Amount,
        Status:          "pending_funding",
        EscrowAccountID: s.getEscrowPoolAccount(req.BankID),
    }

    if err := s.saveEscrow(ctx, escrow); err != nil {
        return nil, err
    }

    // Create VAN for escrow funding
    escrowDetails := &EscrowDetails{
        ID:              escrow.ID,
        BankID:          escrow.BankID,
        BuyerID:         escrow.BuyerID,
        SellerID:        escrow.SellerID,
        EscrowAccountID: escrow.EscrowAccountID,
        Amount:          escrow.Amount,
    }

    van, err := CreateVANOnEscrowCreation(ctx, s.vanClient, escrowDetails)
    if err != nil {
        log.Printf("Warning: Failed to create VAN for escrow %s: %v", escrow.ID, err)
    } else {
        escrow.FundingVAN = van.VAN
        s.updateEscrow(ctx, escrow)

        // Notify buyer of funding VAN
        s.notifyBuyer(ctx, escrow.BuyerID, fmt.Sprintf(
            "Escrow created. Fund your escrow by transferring %.2f to account: %s",
            escrow.Amount, van.VAN))
    }

    return escrow, nil
}

// Webhook handler for VAN payments
func (s *EscrowService) HandleVANPaymentWebhook(c *gin.Context) {
    var payload EscrowVANWebhookPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		utils.SendError(c, utils.ErrorCodes["bad_request"], "Invalid payload", 400, gin.H{"error": err.Error()})
		return
	}

    handler := NewEscrowFundingHandler(s.vanClient)
	if err := handler.HandleVANPayment(c.Request.Context(), &payload); err != nil {
		utils.SendError(c, utils.ErrorCodes["internal_error"], "Failed to process VAN payment", 500, gin.H{"error": err.Error()})
		return
	}

    // Check if escrow is fully funded
    escrow, _ := s.GetEscrow(c.Request.Context(), payload.ReferenceID)
    if escrow != nil && escrow.FundedAmount >= escrow.Amount {
        escrow.Status = "funded"
        s.updateEscrow(c.Request.Context(), escrow)

        // Notify seller
        s.notifySeller(c.Request.Context(), escrow.SellerID,
            "Escrow has been funded. You can now proceed with delivery.")
    }

    c.JSON(200, gin.H{"message": "payment processed"})
}
*/
