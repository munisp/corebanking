package main

import (
	"context"
	"fmt"
	"strings"
	// "time"
)

// SMS Escrow Service for Offline Notifications
// Supports feature phones and areas with no internet in Nigeria

// SMSProvider interface for SMS gateway integration
type SMSProvider interface {
	SendSMS(ctx context.Context, phone, message string) error
	SendBulkSMS(ctx context.Context, phones []string, message string) error
}

// SMSEscrowService handles SMS-based escrow notifications
type SMSEscrowService struct {
	provider      SMSProvider
	escrowService *EscrowService
	templates     map[string]SMSTemplate
}

// SMSTemplate represents an SMS message template
type SMSTemplate struct {
	Name      string
	Template  string
	MaxLength int
	Priority  string // high, normal, low
}

// NewSMSEscrowService creates a new SMS escrow service
func NewSMSEscrowService(provider SMSProvider, escrowSvc *EscrowService) *SMSEscrowService {
	svc := &SMSEscrowService{
		provider:      provider,
		escrowService: escrowSvc,
		templates:     make(map[string]SMSTemplate),
	}
	svc.initTemplates()
	return svc
}

func (s *SMSEscrowService) initTemplates() {
	s.templates = map[string]SMSTemplate{
		"escrow_created": {
			Name:      "Escrow Created",
			Template:  "54link-dev: Escrow %s created for N%.2f. %s. Fund by %s. Ref: %s",
			MaxLength: 160,
			Priority:  "high",
		},
		"escrow_funded": {
			Name:      "Escrow Funded",
			Template:  "54link-dev: Escrow %s funded with N%.2f. Seller can now proceed. Ref: %s",
			MaxLength: 160,
			Priority:  "high",
		},
		"escrow_released": {
			Name:      "Escrow Released",
			Template:  "54link-dev: N%.2f released from escrow %s. Check your account. Ref: %s",
			MaxLength: 160,
			Priority:  "high",
		},
		"escrow_refunded": {
			Name:      "Escrow Refunded",
			Template:  "54link-dev: N%.2f refunded from escrow %s. Check your account. Ref: %s",
			MaxLength: 160,
			Priority:  "high",
		},
		"dispute_raised": {
			Name:      "Dispute Raised",
			Template:  "54link-dev: Dispute raised on escrow %s. Submit evidence by %s. Dial *347*54# for details.",
			MaxLength: 160,
			Priority:  "high",
		},
		"dispute_resolved": {
			Name:      "Dispute Resolved",
			Template:  "54link-dev: Dispute on escrow %s resolved. %s. Amount: N%.2f. Ref: %s",
			MaxLength: 160,
			Priority:  "high",
		},
		"milestone_completed": {
			Name:      "Milestone Completed",
			Template:  "54link-dev: Milestone '%s' completed on escrow %s. N%.2f released. Ref: %s",
			MaxLength: 160,
			Priority:  "normal",
		},
		"funding_reminder": {
			Name:      "Funding Reminder",
			Template:  "54link-dev: Reminder - Escrow %s awaiting funding of N%.2f. Deadline: %s. Dial *347*54# to fund.",
			MaxLength: 160,
			Priority:  "normal",
		},
		"release_pending": {
			Name:      "Release Pending",
			Template:  "54link-dev: Escrow %s awaiting your approval to release N%.2f. Dial *347*54# to approve.",
			MaxLength: 160,
			Priority:  "high",
		},
		"evidence_reminder": {
			Name:      "Evidence Reminder",
			Template:  "54link-dev: Submit evidence for dispute %s by %s. Dial *347*54# or visit app.",
			MaxLength: 160,
			Priority:  "normal",
		},
		"auto_release_warning": {
			Name:      "Auto Release Warning",
			Template:  "54link-dev: Escrow %s will auto-release in %d days. Raise dispute if needed. Dial *347*54#.",
			MaxLength: 160,
			Priority:  "high",
		},
		"kyc_required": {
			Name:      "KYC Required",
			Template:  "54link-dev: Complete KYC to proceed with escrow %s (N%.2f). Visit nearest branch or app.",
			MaxLength: 160,
			Priority:  "high",
		},
		"otp_verification": {
			Name:      "OTP Verification",
			Template:  "54link-dev: Your escrow OTP is %s. Valid for 5 mins. Do not share. Ref: %s",
			MaxLength: 160,
			Priority:  "high",
		},
	}
}

// SendEscrowCreatedSMS sends SMS when escrow is created
func (s *SMSEscrowService) SendEscrowCreatedSMS(ctx context.Context, contract *EscrowContract) error {
	template := s.templates["escrow_created"]

	// Format deadline
	deadline := "N/A"
	if contract.FundingDeadline != nil {
		deadline = contract.FundingDeadline.Format("02/01 15:04")
	}

	// Send to buyer
	for _, party := range contract.Parties {
		if party.Role == RoleBuyer && party.Phone != "" {
			msg := fmt.Sprintf(template.Template,
				contract.ContractNumber,
				contract.TotalAmount,
				contract.Title,
				deadline,
				contract.ID[:8])

			if err := s.provider.SendSMS(ctx, party.Phone, s.truncateMessage(msg, template.MaxLength)); err != nil {
				return err
			}
		}
	}

	// Notify seller
	for _, party := range contract.Parties {
		if party.Role == RoleSeller && party.Phone != "" {
			msg := fmt.Sprintf("54link-dev: New escrow %s for N%.2f from buyer. Awaiting funding. Ref: %s",
				contract.ContractNumber,
				contract.TotalAmount,
				contract.ID[:8])

			if err := s.provider.SendSMS(ctx, party.Phone, s.truncateMessage(msg, 160)); err != nil {
				return err
			}
		}
	}

	return nil
}

// SendEscrowFundedSMS sends SMS when escrow is funded
func (s *SMSEscrowService) SendEscrowFundedSMS(ctx context.Context, contract *EscrowContract, amount float64) error {
	template := s.templates["escrow_funded"]

	for _, party := range contract.Parties {
		if party.Phone == "" {
			continue
		}

		var msg string
		if party.Role == RoleBuyer {
			msg = fmt.Sprintf("54link-dev: Your escrow %s funded with N%.2f. Seller notified. Ref: %s",
				contract.ContractNumber, amount, contract.ID[:8])
		} else if party.Role == RoleSeller {
			msg = fmt.Sprintf(template.Template,
				contract.ContractNumber, amount, contract.ID[:8])
		}

		if msg != "" {
			if err := s.provider.SendSMS(ctx, party.Phone, s.truncateMessage(msg, template.MaxLength)); err != nil {
				return err
			}
		}
	}

	return nil
}

// SendEscrowReleasedSMS sends SMS when escrow is released
func (s *SMSEscrowService) SendEscrowReleasedSMS(ctx context.Context, contract *EscrowContract, amount float64) error {
	template := s.templates["escrow_released"]

	for _, party := range contract.Parties {
		if party.Phone == "" {
			continue
		}

		var msg string
		if party.Role == RoleSeller {
			msg = fmt.Sprintf(template.Template,
				amount, contract.ContractNumber, contract.ID[:8])
		} else if party.Role == RoleBuyer {
			msg = fmt.Sprintf("54link-dev: Escrow %s released. N%.2f sent to seller. Transaction complete. Ref: %s",
				contract.ContractNumber, amount, contract.ID[:8])
		}

		if msg != "" {
			if err := s.provider.SendSMS(ctx, party.Phone, s.truncateMessage(msg, template.MaxLength)); err != nil {
				return err
			}
		}
	}

	return nil
}

// SendEscrowRefundedSMS sends SMS when escrow is refunded
func (s *SMSEscrowService) SendEscrowRefundedSMS(ctx context.Context, contract *EscrowContract, amount float64, reason string) error {
	template := s.templates["escrow_refunded"]

	for _, party := range contract.Parties {
		if party.Phone == "" {
			continue
		}

		var msg string
		if party.Role == RoleBuyer {
			msg = fmt.Sprintf(template.Template,
				amount, contract.ContractNumber, contract.ID[:8])
		} else if party.Role == RoleSeller {
			msg = fmt.Sprintf("54link-dev: Escrow %s refunded to buyer. Reason: %s. Ref: %s",
				contract.ContractNumber, reason, contract.ID[:8])
		}

		if msg != "" {
			if err := s.provider.SendSMS(ctx, party.Phone, s.truncateMessage(msg, template.MaxLength)); err != nil {
				return err
			}
		}
	}

	return nil
}

// SendDisputeRaisedSMS sends SMS when dispute is raised
func (s *SMSEscrowService) SendDisputeRaisedSMS(ctx context.Context, contract *EscrowContract, dispute *Dispute) error {
	template := s.templates["dispute_raised"]

	evidenceDeadline := "7 days"
	if dispute.EvidenceDeadline != nil {
		evidenceDeadline = dispute.EvidenceDeadline.Format("02/01")
	}

	for _, party := range contract.Parties {
		if party.Phone == "" {
			continue
		}

		msg := fmt.Sprintf(template.Template,
			contract.ContractNumber, evidenceDeadline)

		if err := s.provider.SendSMS(ctx, party.Phone, s.truncateMessage(msg, template.MaxLength)); err != nil {
			return err
		}
	}

	return nil
}

// SendDisputeResolvedSMS sends SMS when dispute is resolved
func (s *SMSEscrowService) SendDisputeResolvedSMS(ctx context.Context, contract *EscrowContract, dispute *Dispute) error {
	template := s.templates["dispute_resolved"]

	for _, party := range contract.Parties {
		if party.Phone == "" {
			continue
		}

		var resolution string
		var amount float64

		if party.Role == RoleBuyer {
			if dispute.ResolutionAmountBuyer != nil && *dispute.ResolutionAmountBuyer > 0 {
				resolution = "Refund to you"
				amount = *dispute.ResolutionAmountBuyer
			} else {
				resolution = "Released to seller"
				amount = dispute.DisputedAmount
			}
		} else if party.Role == RoleSeller {
			if dispute.ResolutionAmountSeller != nil && *dispute.ResolutionAmountSeller > 0 {
				resolution = "Released to you"
				amount = *dispute.ResolutionAmountSeller
			} else {
				resolution = "Refunded to buyer"
				amount = dispute.DisputedAmount
			}
		}

		msg := fmt.Sprintf(template.Template,
			contract.ContractNumber, resolution, amount, dispute.ID[:8])

		if err := s.provider.SendSMS(ctx, party.Phone, s.truncateMessage(msg, template.MaxLength)); err != nil {
			return err
		}
	}

	return nil
}

// SendMilestoneCompletedSMS sends SMS when milestone is completed
func (s *SMSEscrowService) SendMilestoneCompletedSMS(ctx context.Context, contract *EscrowContract, milestone *Milestone) error {
	template := s.templates["milestone_completed"]

	amount := float64(0)
	if milestone.Amount != nil {
		amount = *milestone.Amount
	}

	for _, party := range contract.Parties {
		if party.Phone == "" {
			continue
		}

		msg := fmt.Sprintf(template.Template,
			milestone.Name, contract.ContractNumber, amount, contract.ID[:8])

		if err := s.provider.SendSMS(ctx, party.Phone, s.truncateMessage(msg, template.MaxLength)); err != nil {
			return err
		}
	}

	return nil
}

// SendFundingReminderSMS sends funding reminder
func (s *SMSEscrowService) SendFundingReminderSMS(ctx context.Context, contract *EscrowContract) error {
	template := s.templates["funding_reminder"]

	deadline := "soon"
	if contract.FundingDeadline != nil {
		deadline = contract.FundingDeadline.Format("02/01 15:04")
	}

	// Send only to buyer
	for _, party := range contract.Parties {
		if party.Role == RoleBuyer && party.Phone != "" {
			msg := fmt.Sprintf(template.Template,
				contract.ContractNumber, contract.TotalAmount, deadline)

			if err := s.provider.SendSMS(ctx, party.Phone, s.truncateMessage(msg, template.MaxLength)); err != nil {
				return err
			}
		}
	}

	return nil
}

// SendReleasePendingSMS sends release pending notification
func (s *SMSEscrowService) SendReleasePendingSMS(ctx context.Context, contract *EscrowContract) error {
	template := s.templates["release_pending"]

	// Send only to buyer (who needs to approve)
	for _, party := range contract.Parties {
		if party.Role == RoleBuyer && party.Phone != "" {
			msg := fmt.Sprintf(template.Template,
				contract.ContractNumber, contract.TotalAmount)

			if err := s.provider.SendSMS(ctx, party.Phone, s.truncateMessage(msg, template.MaxLength)); err != nil {
				return err
			}
		}
	}

	return nil
}

// SendAutoReleaseWarningSMS sends auto-release warning
func (s *SMSEscrowService) SendAutoReleaseWarningSMS(ctx context.Context, contract *EscrowContract, daysRemaining int) error {
	template := s.templates["auto_release_warning"]

	// Send only to buyer
	for _, party := range contract.Parties {
		if party.Role == RoleBuyer && party.Phone != "" {
			msg := fmt.Sprintf(template.Template,
				contract.ContractNumber, daysRemaining)

			if err := s.provider.SendSMS(ctx, party.Phone, s.truncateMessage(msg, template.MaxLength)); err != nil {
				return err
			}
		}
	}

	return nil
}

// SendOTPSMS sends OTP for escrow verification
func (s *SMSEscrowService) SendOTPSMS(ctx context.Context, phone, otp, reference string) error {
	template := s.templates["otp_verification"]

	msg := fmt.Sprintf(template.Template, otp, reference)

	return s.provider.SendSMS(ctx, phone, s.truncateMessage(msg, template.MaxLength))
}

// SendKYCRequiredSMS sends KYC requirement notification
func (s *SMSEscrowService) SendKYCRequiredSMS(ctx context.Context, contract *EscrowContract, partyID string) error {
	template := s.templates["kyc_required"]

	for _, party := range contract.Parties {
		if party.ID == partyID && party.Phone != "" {
			msg := fmt.Sprintf(template.Template,
				contract.ContractNumber, contract.TotalAmount)

			return s.provider.SendSMS(ctx, party.Phone, s.truncateMessage(msg, template.MaxLength))
		}
	}

	return nil
}

// Helper methods

func (s *SMSEscrowService) truncateMessage(msg string, maxLength int) string {
	if len(msg) <= maxLength {
		return msg
	}
	return msg[:maxLength-3] + "..."
}

// SMSCommand represents an SMS command for escrow operations
type SMSCommand struct {
	Command     string
	ContractRef string
	Amount      float64
	PIN         string
	Extra       string
}

// ParseSMSCommand parses incoming SMS commands
// Format: ESCROW <command> <contract_ref> [amount] [pin]
// Examples:
//
//	ESCROW STATUS ESC123
//	ESCROW APPROVE ESC123 1234
//	ESCROW DISPUTE ESC123 1234
func (s *SMSEscrowService) ParseSMSCommand(message string) (*SMSCommand, error) {
	parts := strings.Fields(strings.ToUpper(message))

	if len(parts) < 2 {
		return nil, fmt.Errorf("invalid command format")
	}

	if parts[0] != "ESCROW" {
		return nil, fmt.Errorf("not an escrow command")
	}

	cmd := &SMSCommand{
		Command: parts[1],
	}

	if len(parts) > 2 {
		cmd.ContractRef = parts[2]
	}

	if len(parts) > 3 {
		// Try to parse as amount first
		if amount, err := parseAmount(parts[3]); err == nil {
			cmd.Amount = amount
		} else {
			cmd.PIN = parts[3]
		}
	}

	if len(parts) > 4 {
		cmd.PIN = parts[4]
	}

	if len(parts) > 5 {
		cmd.Extra = strings.Join(parts[5:], " ")
	}

	return cmd, nil
}

// ProcessSMSCommand processes an incoming SMS command
func (s *SMSEscrowService) ProcessSMSCommand(ctx context.Context, phone, message string) (string, error) {
	cmd, err := s.ParseSMSCommand(message)
	if err != nil {
		return "Invalid command. Send ESCROW HELP for instructions.", nil
	}

	// Authenticate user by phone
	user, err := s.authenticateByPhone(ctx, phone)
	if err != nil {
		return "Phone not registered. Visit branch to register.", nil
	}

	switch cmd.Command {
	case "HELP":
		return s.getHelpMessage(), nil
	case "STATUS":
		return s.handleStatusCommand(ctx, user, cmd)
	case "BALANCE":
		return s.handleBalanceCommand(ctx, user)
	case "APPROVE":
		return s.handleApproveCommand(ctx, user, cmd)
	case "DISPUTE":
		return s.handleDisputeCommand(ctx, user, cmd)
	case "LIST":
		return s.handleListCommand(ctx, user)
	default:
		return "Unknown command. Send ESCROW HELP for instructions.", nil
	}
}

func (s *SMSEscrowService) getHelpMessage() string {
	return `54link-dev Escrow SMS Commands:
ESCROW STATUS <ref> - Check escrow status
ESCROW BALANCE - View all balances
ESCROW LIST - List your escrows
ESCROW APPROVE <ref> <pin> - Approve release
ESCROW DISPUTE <ref> <pin> - Raise dispute
Dial *347*54# for full menu.`
}

func (s *SMSEscrowService) handleStatusCommand(ctx context.Context, user *User, cmd *SMSCommand) (string, error) {
	if cmd.ContractRef == "" {
		return "Please provide contract reference. Example: ESCROW STATUS ESC123", nil
	}

	contract, err := s.getContractByRef(ctx, user.TenantID, cmd.ContractRef)
	if err != nil {
		return fmt.Sprintf("Escrow %s not found.", cmd.ContractRef), nil
	}

	return fmt.Sprintf(`Escrow %s:
Amount: N%.2f
Status: %s
Created: %s
Role: %s`,
		contract.ContractNumber,
		contract.TotalAmount,
		contract.Status,
		contract.CreatedAt.Format("02/01/2006"),
		s.getUserRole(contract, user.ID)), nil
}

func (s *SMSEscrowService) handleBalanceCommand(ctx context.Context, user *User) (string, error) {
	balances, err := s.getEscrowBalances(ctx, user.ID, user.TenantID)
	if err != nil || len(balances) == 0 {
		return "No active escrows found.", nil
	}

	var total float64
	msg := "Your Escrow Balances:\n"
	for _, b := range balances {
		msg += fmt.Sprintf("%s: N%.2f\n", b.ContractNumber, b.Balance)
		total += b.Balance
	}
	msg += fmt.Sprintf("Total: N%.2f", total)

	return msg, nil
}

func (s *SMSEscrowService) handleApproveCommand(ctx context.Context, user *User, cmd *SMSCommand) (string, error) {
	if cmd.ContractRef == "" || cmd.PIN == "" {
		return "Format: ESCROW APPROVE <ref> <pin>", nil
	}

	// Verify PIN
	valid, err := s.verifyPin(ctx, user.ID, cmd.PIN)
	if err != nil || !valid {
		return "Invalid PIN. Please try again.", nil
	}

	contract, err := s.getContractByRef(ctx, user.TenantID, cmd.ContractRef)
	if err != nil {
		return fmt.Sprintf("Escrow %s not found.", cmd.ContractRef), nil
	}

	// Check if user is buyer
	if s.getUserRole(contract, user.ID) != "buyer" {
		return "Only buyer can approve release.", nil
	}

	// Release escrow
	_, err = s.escrowService.ReleaseContract(ctx, contract.ID, user.ID, "Approved via SMS")
	if err != nil {
		return fmt.Sprintf("Release failed: %s", err.Error()), nil
	}

	return fmt.Sprintf("Escrow %s released! N%.2f sent to seller. Ref: %s",
		contract.ContractNumber, contract.TotalAmount, contract.ID[:8]), nil
}

func (s *SMSEscrowService) handleDisputeCommand(ctx context.Context, user *User, cmd *SMSCommand) (string, error) {
	if cmd.ContractRef == "" || cmd.PIN == "" {
		return "Format: ESCROW DISPUTE <ref> <pin>", nil
	}

	// Verify PIN
	valid, err := s.verifyPin(ctx, user.ID, cmd.PIN)
	if err != nil || !valid {
		return "Invalid PIN. Please try again.", nil
	}

	contract, err := s.getContractByRef(ctx, user.TenantID, cmd.ContractRef)
	if err != nil {
		return fmt.Sprintf("Escrow %s not found.", cmd.ContractRef), nil
	}

	// Raise dispute
	dispute, err := s.escrowService.RaiseDispute(ctx, RaiseDisputeInput{
		ContractID:        contract.ID,
		InitiatedBy:       user.ID,
		InitiatedByRole:   PartyRole(s.getUserRole(contract, user.ID)),
		ReasonCategory:    "sms_dispute",
		ReasonDescription: "Dispute raised via SMS",
		DisputedAmount:    contract.TotalAmount,
	})

	if err != nil {
		return fmt.Sprintf("Dispute failed: %s", err.Error()), nil
	}

	return fmt.Sprintf("Dispute raised on %s. Ref: %s. Submit evidence via app or *347*54#.",
		contract.ContractNumber, dispute.ID[:8]), nil
}

func (s *SMSEscrowService) handleListCommand(ctx context.Context, user *User) (string, error) {
	escrows, err := s.getUserEscrows(ctx, user.ID, user.TenantID)
	if err != nil || len(escrows) == 0 {
		return "No escrows found.", nil
	}

	msg := "Your Escrows:\n"
	for i, e := range escrows {
		if i >= 5 {
			msg += fmt.Sprintf("...and %d more. Dial *347*54# to view all.", len(escrows)-5)
			break
		}
		msg += fmt.Sprintf("%s N%.2f [%s]\n", e.ContractNumber, e.TotalAmount, e.Status)
	}

	return msg, nil
}

// Helper methods

func (s *SMSEscrowService) authenticateByPhone(ctx context.Context, phone string) (*User, error) {
	// Implementation would query user by phone
	return &User{ID: "user-123", TenantID: "tenant-123", Phone: phone}, nil
}

func (s *SMSEscrowService) verifyPin(ctx context.Context, userID, pin string) (bool, error) {
	// Implementation would verify PIN
	return true, nil
}

func (s *SMSEscrowService) getContractByRef(ctx context.Context, tenantID, ref string) (*EscrowContract, error) {
	// Implementation would query contract by reference
	return nil, fmt.Errorf("not implemented")
}

func (s *SMSEscrowService) getEscrowBalances(ctx context.Context, userID, tenantID string) ([]EscrowBalance, error) {
	// Implementation would query balances
	return []EscrowBalance{}, nil
}

func (s *SMSEscrowService) getUserEscrows(ctx context.Context, userID, tenantID string) ([]EscrowSummary, error) {
	// Implementation would query escrows
	return []EscrowSummary{}, nil
}

func (s *SMSEscrowService) getUserRole(contract *EscrowContract, userID string) string {
	for _, party := range contract.Parties {
		if party.UserID != nil && *party.UserID == userID {
			return string(party.Role)
		}
	}
	return "unknown"
}

func parseAmount(s string) (float64, error) {
	// Remove currency symbols and commas
	s = strings.ReplaceAll(s, "N", "")
	s = strings.ReplaceAll(s, ",", "")
	s = strings.ReplaceAll(s, "NGN", "")
	s = strings.TrimSpace(s)

	var amount float64
	_, err := fmt.Sscanf(s, "%f", &amount)
	return amount, err
}
