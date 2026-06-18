package main

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// USSD Escrow Service for Offline/Low-Connectivity Access
// Supports feature phones and 2G networks in Nigeria

// USSDSession represents a USSD session state
type USSDSession struct {
	SessionID    string                 `json:"session_id"`
	PhoneNumber  string                 `json:"phone_number"`
	UserID       string                 `json:"user_id"`
	TenantID     string                 `json:"tenant_id"`
	CurrentMenu  string                 `json:"current_menu"`
	MenuStack    []string               `json:"menu_stack"`
	Data         map[string]interface{} `json:"data"`
	CreatedAt    time.Time              `json:"created_at"`
	LastActivity time.Time              `json:"last_activity"`
}

// USSDRequest represents an incoming USSD request
type USSDRequest struct {
	SessionID   string `json:"session_id"`
	PhoneNumber string `json:"phone_number"`
	ServiceCode string `json:"service_code"`
	Input       string `json:"input"`
	NetworkCode string `json:"network_code"`
}

// USSDResponse represents a USSD response
type USSDResponse struct {
	SessionID  string `json:"session_id"`
	Message    string `json:"message"`
	EndSession bool   `json:"end_session"`
}

// USSDEscrowService handles USSD escrow operations
type USSDEscrowService struct {
	escrowService *EscrowService
	sessions      map[string]*USSDSession
}

// NewUSSDEscrowService creates a new USSD escrow service
func NewUSSDEscrowService(escrowSvc *EscrowService) *USSDEscrowService {
	return &USSDEscrowService{
		escrowService: escrowSvc,
		sessions:      make(map[string]*USSDSession),
	}
}

// USSD Menu Constants
const (
	MenuMain             = "main"
	MenuCheckBalance     = "check_balance"
	MenuViewEscrow       = "view_escrow"
	MenuApproveRelease   = "approve_release"
	MenuRaiseDispute     = "raise_dispute"
	MenuConfirmAction    = "confirm_action"
	MenuEnterPin         = "enter_pin"
	MenuSelectEscrow     = "select_escrow"
	MenuDisputeReason    = "dispute_reason"
	MenuCreateEscrow     = "create_escrow"
	MenuEnterAmount      = "enter_amount"
	MenuEnterSellerPhone = "enter_seller_phone"
	MenuEnterDescription = "enter_description"
)

// ProcessUSSD handles USSD requests
func (s *USSDEscrowService) ProcessUSSD(ctx context.Context, req USSDRequest) (*USSDResponse, error) {
	// Get or create session
	session, exists := s.sessions[req.SessionID]
	if !exists {
		// New session - authenticate user by phone
		user, err := s.authenticateByPhone(ctx, req.PhoneNumber)
		if err != nil {
			return &USSDResponse{
				SessionID:  req.SessionID,
				Message:    "END Phone number not registered. Please register at your nearest branch.",
				EndSession: true,
			}, nil
		}

		session = &USSDSession{
			SessionID:    req.SessionID,
			PhoneNumber:  req.PhoneNumber,
			UserID:       user.ID,
			TenantID:     user.TenantID,
			CurrentMenu:  MenuMain,
			MenuStack:    []string{},
			Data:         make(map[string]interface{}),
			CreatedAt:    time.Now(),
			LastActivity: time.Now(),
		}
		s.sessions[req.SessionID] = session
	}

	session.LastActivity = time.Now()

	// Handle back navigation
	if req.Input == "0" && len(session.MenuStack) > 0 {
		session.CurrentMenu = session.MenuStack[len(session.MenuStack)-1]
		session.MenuStack = session.MenuStack[:len(session.MenuStack)-1]
		return s.renderMenu(ctx, session)
	}

	// Process input based on current menu
	return s.processMenuInput(ctx, session, req.Input)
}

func (s *USSDEscrowService) processMenuInput(ctx context.Context, session *USSDSession, input string) (*USSDResponse, error) {
	switch session.CurrentMenu {
	case MenuMain:
		return s.handleMainMenu(ctx, session, input)
	case MenuCheckBalance:
		return s.handleCheckBalance(ctx, session, input)
	case MenuViewEscrow:
		return s.handleViewEscrow(ctx, session, input)
	case MenuSelectEscrow:
		return s.handleSelectEscrow(ctx, session, input)
	case MenuApproveRelease:
		return s.handleApproveRelease(ctx, session, input)
	case MenuRaiseDispute:
		return s.handleRaiseDispute(ctx, session, input)
	case MenuDisputeReason:
		return s.handleDisputeReason(ctx, session, input)
	case MenuEnterPin:
		return s.handleEnterPin(ctx, session, input)
	case MenuConfirmAction:
		return s.handleConfirmAction(ctx, session, input)
	case MenuCreateEscrow:
		return s.handleCreateEscrow(ctx, session, input)
	case MenuEnterAmount:
		// 	return s.handleEnterAmount(ctx, session, input)
		// case MenuEnterSellerPhone:
		return s.handleEnterSellerPhone(ctx, session, input)
	case MenuEnterDescription:
		return s.handleEnterDescription(ctx, session, input)
	default:
		return s.renderMainMenu(session)
	}
}

func (s *USSDEscrowService) handleMainMenu(ctx context.Context, session *USSDSession, input string) (*USSDResponse, error) {
	switch input {
	case "":
		return s.renderMainMenu(session)
	case "1":
		session.MenuStack = append(session.MenuStack, session.CurrentMenu)
		session.CurrentMenu = MenuCheckBalance
		return s.handleCheckBalance(ctx, session, "")
	case "2":
		session.MenuStack = append(session.MenuStack, session.CurrentMenu)
		session.CurrentMenu = MenuViewEscrow
		return s.handleViewEscrow(ctx, session, "")
	case "3":
		session.MenuStack = append(session.MenuStack, session.CurrentMenu)
		session.CurrentMenu = MenuCreateEscrow
		return s.handleCreateEscrow(ctx, session, "")
	case "4":
		session.MenuStack = append(session.MenuStack, session.CurrentMenu)
		session.CurrentMenu = MenuApproveRelease
		return s.handleApproveRelease(ctx, session, "")
	case "5":
		session.MenuStack = append(session.MenuStack, session.CurrentMenu)
		session.CurrentMenu = MenuRaiseDispute
		return s.handleRaiseDispute(ctx, session, "")
	default:
		return &USSDResponse{
			SessionID: session.SessionID,
			Message:   "CON Invalid option. Please try again.\n\n" + s.getMainMenuText(),
		}, nil
	}
}

func (s *USSDEscrowService) renderMainMenu(session *USSDSession) (*USSDResponse, error) {
	return &USSDResponse{
		SessionID: session.SessionID,
		Message:   "CON " + s.getMainMenuText(),
	}, nil
}

func (s *USSDEscrowService) getMainMenuText() string {
	return `54Bank Escrow Service
1. Check Escrow Balance
2. View My Escrows
3. Create New Escrow
4. Approve Release
5. Raise Dispute

0. Back`
}

func (s *USSDEscrowService) handleCheckBalance(ctx context.Context, session *USSDSession, input string) (*USSDResponse, error) {
	// Get user's escrow balances
	balances, err := s.getEscrowBalances(ctx, session.UserID, session.TenantID)
	if err != nil {
		return &USSDResponse{
			SessionID:  session.SessionID,
			Message:    "END Error retrieving balances. Please try again later.",
			EndSession: true,
		}, nil
	}

	if len(balances) == 0 {
		return &USSDResponse{
			SessionID:  session.SessionID,
			Message:    "END You have no active escrows.\n\nDial *347*54# to create one.",
			EndSession: true,
		}, nil
	}

	msg := "END Your Escrow Balances:\n\n"
	for _, b := range balances {
		msg += fmt.Sprintf("%s: N%.2f\n", b.ContractNumber, b.Balance)
	}
	msg += fmt.Sprintf("\nTotal: N%.2f", balances[0].TotalBalance)

	return &USSDResponse{
		SessionID:  session.SessionID,
		Message:    msg,
		EndSession: true,
	}, nil
}

func (s *USSDEscrowService) handleViewEscrow(ctx context.Context, session *USSDSession, input string) (*USSDResponse, error) {
	// Get user's escrows
	escrows, err := s.getUserEscrows(ctx, session.UserID, session.TenantID)
	if err != nil {
		return &USSDResponse{
			SessionID:  session.SessionID,
			Message:    "END Error retrieving escrows. Please try again.",
			EndSession: true,
		}, nil
	}

	if len(escrows) == 0 {
		return &USSDResponse{
			SessionID:  session.SessionID,
			Message:    "END You have no escrows.\n\nDial *347*54# to create one.",
			EndSession: true,
		}, nil
	}

	// Store escrows in session for selection
	session.Data["escrows"] = escrows

	msg := "CON Your Escrows:\n\n"
	for i, e := range escrows {
		status := s.getStatusEmoji(e.Status)
		msg += fmt.Sprintf("%d. %s %s N%.2f\n", i+1, status, e.Title[:min(15, len(e.Title))], e.TotalAmount)
	}
	msg += "\n0. Back"

	session.CurrentMenu = MenuSelectEscrow
	return &USSDResponse{
		SessionID: session.SessionID,
		Message:   msg,
	}, nil
}

func (s *USSDEscrowService) handleSelectEscrow(ctx context.Context, session *USSDSession, input string) (*USSDResponse, error) {
	escrows, ok := session.Data["escrows"].([]EscrowSummary)
	if !ok {
		return s.handleViewEscrow(ctx, session, "")
	}

	idx, err := strconv.Atoi(input)
	if err != nil || idx < 1 || idx > len(escrows) {
		return &USSDResponse{
			SessionID: session.SessionID,
			Message:   "CON Invalid selection. Please enter a number from the list.",
		}, nil
	}

	escrow := escrows[idx-1]
	session.Data["selected_escrow"] = escrow

	msg := fmt.Sprintf(`END Escrow Details:

Contract: %s
Title: %s
Amount: N%.2f
Status: %s
Role: %s
Created: %s

Dial *347*54# for more options.`,
		escrow.ContractNumber,
		escrow.Title,
		escrow.TotalAmount,
		escrow.Status,
		escrow.UserRole,
		escrow.CreatedAt.Format("02/01/2006"))

	return &USSDResponse{
		SessionID:  session.SessionID,
		Message:    msg,
		EndSession: true,
	}, nil
}

func (s *USSDEscrowService) handleCreateEscrow(ctx context.Context, session *USSDSession, input string) (*USSDResponse, error) {
	if input == "" {
		return &USSDResponse{
			SessionID: session.SessionID,
			Message:   "CON Create New Escrow\n\nEnter amount (NGN):\n\n0. Back",
		}, nil
	}

	// Parse amount
	amount, err := strconv.ParseFloat(input, 64)
	if err != nil || amount < 1000 {
		return &USSDResponse{
			SessionID: session.SessionID,
			Message:   "CON Invalid amount. Minimum is N1,000.\n\nEnter amount (NGN):\n\n0. Back",
		}, nil
	}

	session.Data["escrow_amount"] = amount
	session.MenuStack = append(session.MenuStack, session.CurrentMenu)
	session.CurrentMenu = MenuEnterSellerPhone

	return &USSDResponse{
		SessionID: session.SessionID,
		Message:   "CON Enter seller's phone number:\n(e.g., 08012345678)\n\n0. Back",
	}, nil
}

func (s *USSDEscrowService) handleEnterSellerPhone(ctx context.Context, session *USSDSession, input string) (*USSDResponse, error) {
	// Validate Nigerian phone number
	phone := strings.TrimSpace(input)
	if !isValidNigerianPhone(phone) {
		return &USSDResponse{
			SessionID: session.SessionID,
			Message:   "CON Invalid phone number.\n\nEnter seller's phone:\n(e.g., 08012345678)\n\n0. Back",
		}, nil
	}

	session.Data["seller_phone"] = phone
	session.MenuStack = append(session.MenuStack, session.CurrentMenu)
	session.CurrentMenu = MenuEnterDescription

	return &USSDResponse{
		SessionID: session.SessionID,
		Message:   "CON Enter description:\n(e.g., iPhone 15 purchase)\n\n0. Back",
	}, nil
}

func (s *USSDEscrowService) handleEnterDescription(ctx context.Context, session *USSDSession, input string) (*USSDResponse, error) {
	if len(input) < 5 {
		return &USSDResponse{
			SessionID: session.SessionID,
			Message:   "CON Description too short.\n\nEnter description:\n\n0. Back",
		}, nil
	}

	session.Data["escrow_description"] = input
	session.MenuStack = append(session.MenuStack, session.CurrentMenu)
	session.CurrentMenu = MenuEnterPin

	amount := session.Data["escrow_amount"].(float64)
	sellerPhone := session.Data["seller_phone"].(string)

	return &USSDResponse{
		SessionID: session.SessionID,
		Message: fmt.Sprintf(`CON Confirm Escrow:

Amount: N%.2f
Seller: %s
Desc: %s

Enter PIN to confirm:

0. Cancel`, amount, sellerPhone, input),
	}, nil
}

func (s *USSDEscrowService) handleApproveRelease(ctx context.Context, session *USSDSession, input string) (*USSDResponse, error) {
	if input == "" {
		// Get escrows pending release approval
		escrows, err := s.getPendingReleaseEscrows(ctx, session.UserID, session.TenantID)
		if err != nil || len(escrows) == 0 {
			return &USSDResponse{
				SessionID:  session.SessionID,
				Message:    "END No escrows pending release approval.",
				EndSession: true,
			}, nil
		}

		session.Data["pending_escrows"] = escrows

		msg := "CON Escrows Pending Release:\n\n"
		for i, e := range escrows {
			msg += fmt.Sprintf("%d. %s N%.2f\n", i+1, e.Title[:min(12, len(e.Title))], e.TotalAmount)
		}
		msg += "\nSelect to approve:\n0. Back"

		return &USSDResponse{
			SessionID: session.SessionID,
			Message:   msg,
		}, nil
	}

	// Handle selection
	escrows, ok := session.Data["pending_escrows"].([]EscrowSummary)
	if !ok {
		return s.handleApproveRelease(ctx, session, "")
	}

	idx, err := strconv.Atoi(input)
	if err != nil || idx < 1 || idx > len(escrows) {
		return &USSDResponse{
			SessionID: session.SessionID,
			Message:   "CON Invalid selection.\n\n0. Back",
		}, nil
	}

	escrow := escrows[idx-1]
	session.Data["selected_escrow"] = escrow
	session.Data["action"] = "release"
	session.MenuStack = append(session.MenuStack, session.CurrentMenu)
	session.CurrentMenu = MenuEnterPin

	return &USSDResponse{
		SessionID: session.SessionID,
		Message: fmt.Sprintf(`CON Approve Release:

Contract: %s
Amount: N%.2f
Seller: %s

Enter PIN to approve:

0. Cancel`, escrow.ContractNumber, escrow.TotalAmount, escrow.SellerName),
	}, nil
}

func (s *USSDEscrowService) handleRaiseDispute(ctx context.Context, session *USSDSession, input string) (*USSDResponse, error) {
	if input == "" {
		// Get escrows that can be disputed
		escrows, err := s.getDisputableEscrows(ctx, session.UserID, session.TenantID)
		if err != nil || len(escrows) == 0 {
			return &USSDResponse{
				SessionID:  session.SessionID,
				Message:    "END No escrows available for dispute.",
				EndSession: true,
			}, nil
		}

		session.Data["disputable_escrows"] = escrows

		msg := "CON Select Escrow to Dispute:\n\n"
		for i, e := range escrows {
			msg += fmt.Sprintf("%d. %s N%.2f\n", i+1, e.Title[:min(12, len(e.Title))], e.TotalAmount)
		}
		msg += "\n0. Back"

		return &USSDResponse{
			SessionID: session.SessionID,
			Message:   msg,
		}, nil
	}

	// Handle selection
	escrows, ok := session.Data["disputable_escrows"].([]EscrowSummary)
	if !ok {
		return s.handleRaiseDispute(ctx, session, "")
	}

	idx, err := strconv.Atoi(input)
	if err != nil || idx < 1 || idx > len(escrows) {
		return &USSDResponse{
			SessionID: session.SessionID,
			Message:   "CON Invalid selection.\n\n0. Back",
		}, nil
	}

	escrow := escrows[idx-1]
	session.Data["selected_escrow"] = escrow
	session.MenuStack = append(session.MenuStack, session.CurrentMenu)
	session.CurrentMenu = MenuDisputeReason

	return &USSDResponse{
		SessionID: session.SessionID,
		Message: `CON Select Dispute Reason:

1. Item not received
2. Item not as described
3. Damaged item
4. Wrong item
5. Seller not responding
6. Other

0. Back`,
	}, nil
}

func (s *USSDEscrowService) handleDisputeReason(ctx context.Context, session *USSDSession, input string) (*USSDResponse, error) {
	reasons := map[string]string{
		"1": "item_not_received",
		"2": "item_not_as_described",
		"3": "damaged_item",
		"4": "wrong_item",
		"5": "seller_not_responding",
		"6": "other",
	}

	reason, ok := reasons[input]
	if !ok {
		return &USSDResponse{
			SessionID: session.SessionID,
			Message:   "CON Invalid selection. Please choose 1-6.\n\n0. Back",
		}, nil
	}

	session.Data["dispute_reason"] = reason
	session.Data["action"] = "dispute"
	session.MenuStack = append(session.MenuStack, session.CurrentMenu)
	session.CurrentMenu = MenuEnterPin

	escrow := session.Data["selected_escrow"].(EscrowSummary)

	return &USSDResponse{
		SessionID: session.SessionID,
		Message: fmt.Sprintf(`CON Confirm Dispute:

Contract: %s
Amount: N%.2f
Reason: %s

Enter PIN to confirm:

0. Cancel`, escrow.ContractNumber, escrow.TotalAmount, s.getReasonText(reason)),
	}, nil
}

func (s *USSDEscrowService) handleEnterPin(ctx context.Context, session *USSDSession, input string) (*USSDResponse, error) {
	// Validate PIN (4-6 digits)
	if len(input) < 4 || len(input) > 6 {
		return &USSDResponse{
			SessionID: session.SessionID,
			Message:   "CON Invalid PIN. Please enter your 4-6 digit PIN:\n\n0. Cancel",
		}, nil
	}

	// Verify PIN
	valid, err := s.verifyPin(ctx, session.UserID, input)
	if err != nil || !valid {
		return &USSDResponse{
			SessionID: session.SessionID,
			Message:   "CON Incorrect PIN. Please try again:\n\n0. Cancel",
		}, nil
	}

	// Execute the action
	action := session.Data["action"].(string)
	switch action {
	case "release":
		return s.executeRelease(ctx, session)
	case "dispute":
		return s.executeDispute(ctx, session)
	case "create":
		return s.executeCreateEscrow(ctx, session)
	default:
		return &USSDResponse{
			SessionID:  session.SessionID,
			Message:    "END Invalid action. Please try again.",
			EndSession: true,
		}, nil
	}
}

func (s *USSDEscrowService) handleConfirmAction(ctx context.Context, session *USSDSession, input string) (*USSDResponse, error) {
	if input == "1" {
		session.CurrentMenu = MenuEnterPin
		return &USSDResponse{
			SessionID: session.SessionID,
			Message:   "CON Enter your PIN to confirm:\n\n0. Cancel",
		}, nil
	}
	return s.renderMainMenu(session)
}

func (s *USSDEscrowService) executeRelease(ctx context.Context, session *USSDSession) (*USSDResponse, error) {
	escrow := session.Data["selected_escrow"].(EscrowSummary)

	// Call escrow service to release
	_, err := s.escrowService.ReleaseContract(ctx, escrow.ContractID, session.UserID, "Released via USSD")
	if err != nil {
		return &USSDResponse{
			SessionID:  session.SessionID,
			Message:    fmt.Sprintf("END Release failed: %s\n\nPlease try again or contact support.", err.Error()),
			EndSession: true,
		}, nil
	}

	return &USSDResponse{
		SessionID: session.SessionID,
		Message: fmt.Sprintf(`END Release Successful!

Contract: %s
Amount: N%.2f

Funds released to seller.
Reference: %s

Thank you for using 54Bank Escrow.`, escrow.ContractNumber, escrow.TotalAmount, fmt.Sprintf("REL%d", time.Now().Unix())),
		EndSession: true,
	}, nil
}

func (s *USSDEscrowService) executeDispute(ctx context.Context, session *USSDSession) (*USSDResponse, error) {
	escrow := session.Data["selected_escrow"].(EscrowSummary)
	reason := session.Data["dispute_reason"].(string)

	// Call escrow service to raise dispute
	dispute, err := s.escrowService.RaiseDispute(ctx, RaiseDisputeInput{
		ContractID:        escrow.ContractID,
		InitiatedBy:       session.UserID,
		InitiatedByRole:   RoleBuyer,
		ReasonCategory:    reason,
		ReasonDescription: s.getReasonText(reason),
		DisputedAmount:    escrow.TotalAmount,
	})

	if err != nil {
		return &USSDResponse{
			SessionID:  session.SessionID,
			Message:    fmt.Sprintf("END Dispute failed: %s\n\nPlease try again.", err.Error()),
			EndSession: true,
		}, nil
	}

	return &USSDResponse{
		SessionID: session.SessionID,
		Message: fmt.Sprintf(`END Dispute Raised!

Dispute #: %s
Contract: %s
Amount: N%.2f

Our team will review within 7 days.
You will receive SMS updates.

Reference: %s`, dispute.DisputeNumber, escrow.ContractNumber, escrow.TotalAmount, dispute.ID[:8]),
		EndSession: true,
	}, nil
}

func (s *USSDEscrowService) executeCreateEscrow(ctx context.Context, session *USSDSession) (*USSDResponse, error) {
	amount := session.Data["escrow_amount"].(float64)
	sellerPhone := session.Data["seller_phone"].(string)
	description := session.Data["escrow_description"].(string)

	// Look up seller by phone
	seller, err := s.getUserByPhone(ctx, sellerPhone)
	if err != nil {
		return &USSDResponse{
			SessionID:  session.SessionID,
			Message:    "END Seller not found. They must register first.\n\nDial *347*54# to try again.",
			EndSession: true,
		}, nil
	}

	// Create escrow contract
	contract, err := s.escrowService.CreateContract(ctx, CreateContractInput{
		TenantID:    session.TenantID,
		UseCase:     UseCaseEcommerce,
		Title:       description,
		Description: description,
		TotalAmount: amount,
		Currency:    "NGN",
		Parties: []CreatePartyInput{
			{
				Role:   RoleBuyer,
				UserID: &session.UserID,
				Name:   "Buyer",
				Phone:  session.PhoneNumber,
			},
			{
				Role:   RoleSeller,
				UserID: &seller.ID,
				Name:   seller.Name,
				Phone:  sellerPhone,
			},
		},
		CreatedBy: session.UserID,
	})

	if err != nil {
		return &USSDResponse{
			SessionID:  session.SessionID,
			Message:    fmt.Sprintf("END Escrow creation failed: %s", err.Error()),
			EndSession: true,
		}, nil
	}

	return &USSDResponse{
		SessionID: session.SessionID,
		Message: fmt.Sprintf(`END Escrow Created!

Contract: %s
Amount: N%.2f
Seller: %s

Fund via:
- Bank Transfer
- Card Payment
- USSD: *347*54*2#

Ref: %s`, contract.ContractNumber, amount, sellerPhone, contract.ID[:8]),
		EndSession: true,
	}, nil
}

// Helper methods

func (s *USSDEscrowService) renderMenu(ctx context.Context, session *USSDSession) (*USSDResponse, error) {
	return s.processMenuInput(ctx, session, "")
}

func (s *USSDEscrowService) authenticateByPhone(ctx context.Context, phone string) (*User, error) {
	// Implementation would query user by phone
	return &User{ID: "user-123", TenantID: "tenant-123", Phone: phone}, nil
}

func (s *USSDEscrowService) verifyPin(ctx context.Context, userID, pin string) (bool, error) {
	// Implementation would verify PIN against stored hash
	return true, nil
}

func (s *USSDEscrowService) getEscrowBalances(ctx context.Context, userID, tenantID string) ([]EscrowBalance, error) {
	// Implementation would query escrow balances
	return []EscrowBalance{}, nil
}

func (s *USSDEscrowService) getUserEscrows(ctx context.Context, userID, tenantID string) ([]EscrowSummary, error) {
	// Implementation would query user's escrows
	return []EscrowSummary{}, nil
}

func (s *USSDEscrowService) getPendingReleaseEscrows(ctx context.Context, userID, tenantID string) ([]EscrowSummary, error) {
	// Implementation would query escrows pending release
	return []EscrowSummary{}, nil
}

func (s *USSDEscrowService) getDisputableEscrows(ctx context.Context, userID, tenantID string) ([]EscrowSummary, error) {
	// Implementation would query disputable escrows
	return []EscrowSummary{}, nil
}

func (s *USSDEscrowService) getUserByPhone(ctx context.Context, phone string) (*User, error) {
	// Implementation would query user by phone
	return &User{ID: "seller-123", Name: "Seller Name"}, nil
}

func (s *USSDEscrowService) getStatusEmoji(status string) string {
	switch status {
	case "funded":
		return "[F]"
	case "released":
		return "[R]"
	case "disputed":
		return "[D]"
	case "awaiting_funding":
		return "[W]"
	default:
		return "[?]"
	}
}

func (s *USSDEscrowService) getReasonText(reason string) string {
	texts := map[string]string{
		"item_not_received":     "Item not received",
		"item_not_as_described": "Item not as described",
		"damaged_item":          "Damaged item",
		"wrong_item":            "Wrong item",
		"seller_not_responding": "Seller not responding",
		"other":                 "Other",
	}
	if text, ok := texts[reason]; ok {
		return text
	}
	return reason
}

func isValidNigerianPhone(phone string) bool {
	// Remove spaces and dashes
	phone = strings.ReplaceAll(phone, " ", "")
	phone = strings.ReplaceAll(phone, "-", "")

	// Check for valid Nigerian phone formats
	if len(phone) == 11 && strings.HasPrefix(phone, "0") {
		return true
	}
	if len(phone) == 13 && strings.HasPrefix(phone, "234") {
		return true
	}
	if len(phone) == 14 && strings.HasPrefix(phone, "+234") {
		return true
	}
	return false
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// Data types for USSD

type User struct {
	ID       string `json:"id"`
	TenantID string `json:"tenant_id"`
	Name     string `json:"name"`
	Phone    string `json:"phone"`
}

type EscrowBalance struct {
	ContractID     string  `json:"contract_id"`
	ContractNumber string  `json:"contract_number"`
	Balance        float64 `json:"balance"`
	TotalBalance   float64 `json:"total_balance"`
}

type EscrowSummary struct {
	ContractID     string    `json:"contract_id"`
	ContractNumber string    `json:"contract_number"`
	Title          string    `json:"title"`
	TotalAmount    float64   `json:"total_amount"`
	Status         string    `json:"status"`
	UserRole       string    `json:"user_role"`
	SellerName     string    `json:"seller_name"`
	CreatedAt      time.Time `json:"created_at"`
}
