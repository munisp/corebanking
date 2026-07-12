package main

import (
	"fmt"
	"time"

	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
)

// Temporal Workflows for Escrow Service
// Handles long-running escrow lifecycle, milestone processing, and dispute resolution

// Workflow names
const (
	EscrowLifecycleWorkflowName     = "EscrowLifecycleWorkflow"
	MilestoneProcessingWorkflowName = "MilestoneProcessingWorkflow"
	DisputeResolutionWorkflowName   = "DisputeResolutionWorkflow"
	AutoReleaseWorkflowName         = "AutoReleaseWorkflow"
)

// Activity names
const (
	CreateEscrowAccountActivity      = "CreateEscrowAccount"
	FundEscrowActivity               = "FundEscrow"
	VerifyKYCActivity                = "VerifyKYC"
	PerformFraudCheckActivity        = "PerformFraudCheck"
	ReleaseFundsActivity             = "ReleaseFunds"
	RefundFundsActivity              = "RefundFunds"
	SendNotificationActivity         = "SendNotification"
	RecordAuditLogActivity           = "RecordAuditLog"
	VerifyMilestoneDocumentsActivity = "VerifyMilestoneDocuments"
	ProcessMilestoneReleaseActivity  = "ProcessMilestoneRelease"
	EscalateDisputeActivity          = "EscalateDispute"
	CalculateFeeActivity             = "CalculateFee"
)

// EscrowLifecycleInput contains input for escrow lifecycle workflow
type EscrowLifecycleInput struct {
	ContractID           string    `json:"contract_id"`
	TenantID             string    `json:"tenant_id"`
	UseCase              string    `json:"use_case"`
	TotalAmount          float64   `json:"total_amount"`
	Currency             string    `json:"currency"`
	BuyerID              string    `json:"buyer_id"`
	SellerID             string    `json:"seller_id"`
	FundingDeadline      time.Time `json:"funding_deadline"`
	FulfillmentDeadline  time.Time `json:"fulfillment_deadline"`
	DisputeWindowDays    int       `json:"dispute_window_days"`
	AutoReleaseAfterDays *int      `json:"auto_release_after_days,omitempty"`
	HasMilestones        bool      `json:"has_milestones"`
	MilestoneCount       int       `json:"milestone_count"`
}

// EscrowLifecycleResult contains the result of escrow lifecycle workflow
type EscrowLifecycleResult struct {
	ContractID          string     `json:"contract_id"`
	FinalStatus         string     `json:"final_status"`
	TotalFunded         float64    `json:"total_funded"`
	TotalReleased       float64    `json:"total_released"`
	TotalRefunded       float64    `json:"total_refunded"`
	FeeCollected        float64    `json:"fee_collected"`
	MilestonesCompleted int        `json:"milestones_completed"`
	DisputeRaised       bool       `json:"dispute_raised"`
	DisputeResolution   string     `json:"dispute_resolution,omitempty"`
	CompletedAt         *time.Time `json:"completed_at,omitempty"`
}

// EscrowLifecycleWorkflow orchestrates the complete escrow lifecycle
func EscrowLifecycleWorkflow(ctx workflow.Context, input EscrowLifecycleInput) (*EscrowLifecycleResult, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting escrow lifecycle workflow", "contract_id", input.ContractID)

	// Configure activity options with retry
	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 5 * time.Minute,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    time.Minute,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	result := &EscrowLifecycleResult{
		ContractID:  input.ContractID,
		FinalStatus: "processing",
	}

	// Step 1: Verify KYC for both parties
	var kycResult KYCVerificationResult
	err := workflow.ExecuteActivity(ctx, VerifyKYCActivity, KYCInput{
		TenantID: input.TenantID,
		BuyerID:  input.BuyerID,
		SellerID: input.SellerID,
	}).Get(ctx, &kycResult)

	if err != nil {
		logger.Error("KYC verification failed", "error", err)
		return nil, err
	}

	if !kycResult.BuyerVerified || !kycResult.SellerVerified {
		result.FinalStatus = "kyc_failed"
		return result, nil
	}

	// Step 2: Perform fraud check
	var fraudResult FraudCheckResult
	err = workflow.ExecuteActivity(ctx, PerformFraudCheckActivity, FraudCheckInput{
		TenantID:   input.TenantID,
		ContractID: input.ContractID,
		BuyerID:    input.BuyerID,
		SellerID:   input.SellerID,
		Amount:     input.TotalAmount,
	}).Get(ctx, &fraudResult)

	if err != nil {
		logger.Error("Fraud check failed", "error", err)
		return nil, err
	}

	if fraudResult.BlockTransaction {
		result.FinalStatus = "blocked_fraud"
		_ = workflow.ExecuteActivity(ctx, SendNotificationActivity, NotificationInput{
			TenantID: input.TenantID,
			Type:     "escrow_blocked",
			UserIDs:  []string{input.BuyerID, input.SellerID},
			Message:  "Escrow blocked due to security concerns",
		})
		return result, nil
	}

	// Step 3: Wait for funding (with timeout)
	fundingSignal := workflow.GetSignalChannel(ctx, "escrow-funded")
	fundingTimeout := workflow.NewTimer(ctx, time.Until(input.FundingDeadline))

	var fundingReceived bool
	var fundingAmount float64

	selector := workflow.NewSelector(ctx)
	selector.AddReceive(fundingSignal, func(c workflow.ReceiveChannel, more bool) {
		var signal FundingSignal
		c.Receive(ctx, &signal)
		fundingReceived = true
		fundingAmount = signal.Amount
	})
	selector.AddFuture(fundingTimeout, func(f workflow.Future) {
		fundingReceived = false
	})
	selector.Select(ctx)

	if !fundingReceived {
		logger.Info("Funding deadline expired", "contract_id", input.ContractID)
		result.FinalStatus = "funding_expired"
		_ = workflow.ExecuteActivity(ctx, SendNotificationActivity, NotificationInput{
			TenantID: input.TenantID,
			Type:     "escrow_expired",
			UserIDs:  []string{input.BuyerID, input.SellerID},
			Message:  "Escrow funding deadline has expired",
		})
		return result, nil
	}

	result.TotalFunded = fundingAmount

	// Record audit log
	_ = workflow.ExecuteActivity(ctx, RecordAuditLogActivity, AuditLogInput{
		TenantID:   input.TenantID,
		EntityType: "escrow_contract",
		EntityID:   input.ContractID,
		Action:     "escrow_funded",
		Details: map[string]interface{}{
			"amount": fundingAmount,
		},
	})

	// Step 4: Process milestones or wait for fulfillment
	if input.HasMilestones {
		// Start milestone processing child workflow
		childCtx := workflow.WithChildOptions(ctx, workflow.ChildWorkflowOptions{
			WorkflowID: fmt.Sprintf("milestone-%s", input.ContractID),
		})

		var milestoneResult MilestoneProcessingResult
		err = workflow.ExecuteChildWorkflow(childCtx, MilestoneProcessingWorkflowName, MilestoneProcessingInput{
			ContractID:     input.ContractID,
			TenantID:       input.TenantID,
			TotalAmount:    input.TotalAmount,
			MilestoneCount: input.MilestoneCount,
		}).Get(ctx, &milestoneResult)

		if err != nil {
			logger.Error("Milestone processing failed", "error", err)
			return nil, err
		}

		result.MilestonesCompleted = milestoneResult.MilestonesCompleted
		result.TotalReleased = milestoneResult.TotalReleased
	} else {
		// Wait for fulfillment confirmation or dispute
		fulfillmentSignal := workflow.GetSignalChannel(ctx, "fulfillment-confirmed")
		disputeSignal := workflow.GetSignalChannel(ctx, "dispute-raised")

		var autoReleaseTimer workflow.Future
		if input.AutoReleaseAfterDays != nil {
			autoReleaseTimer = workflow.NewTimer(ctx, time.Duration(*input.AutoReleaseAfterDays)*24*time.Hour)
		} else {
			// Default: wait for fulfillment deadline
			autoReleaseTimer = workflow.NewTimer(ctx, time.Until(input.FulfillmentDeadline))
		}

		var fulfilled bool
		var disputed bool

		selector := workflow.NewSelector(ctx)
		selector.AddReceive(fulfillmentSignal, func(c workflow.ReceiveChannel, more bool) {
			var signal FulfillmentSignal
			c.Receive(ctx, &signal)
			fulfilled = true
		})
		selector.AddReceive(disputeSignal, func(c workflow.ReceiveChannel, more bool) {
			var signal DisputeSignal
			c.Receive(ctx, &signal)
			disputed = true
			result.DisputeRaised = true
		})
		selector.AddFuture(autoReleaseTimer, func(f workflow.Future) {
			// Auto-release if no dispute
			fulfilled = true
		})
		selector.Select(ctx)

		if disputed {
			// Start dispute resolution workflow
			childCtx := workflow.WithChildOptions(ctx, workflow.ChildWorkflowOptions{
				WorkflowID: fmt.Sprintf("dispute-%s", input.ContractID),
			})

			var disputeResult DisputeResolutionResult
			err = workflow.ExecuteChildWorkflow(childCtx, DisputeResolutionWorkflowName, DisputeResolutionInput{
				ContractID:        input.ContractID,
				TenantID:          input.TenantID,
				DisputedAmount:    input.TotalAmount,
				DisputeWindowDays: input.DisputeWindowDays,
			}).Get(ctx, &disputeResult)

			if err != nil {
				logger.Error("Dispute resolution failed", "error", err)
				return nil, err
			}

			result.DisputeResolution = disputeResult.Resolution
			result.TotalReleased = disputeResult.AmountToSeller
			result.TotalRefunded = disputeResult.AmountToBuyer
			result.FinalStatus = fmt.Sprintf("dispute_%s", disputeResult.Resolution)
		} else if fulfilled {
			// Release funds to seller
			var releaseResult ReleaseResult
			err = workflow.ExecuteActivity(ctx, ReleaseFundsActivity, ReleaseInput{
				ContractID: input.ContractID,
				TenantID:   input.TenantID,
				Amount:     input.TotalAmount,
				SellerID:   input.SellerID,
			}).Get(ctx, &releaseResult)

			if err != nil {
				logger.Error("Release failed", "error", err)
				return nil, err
			}

			result.TotalReleased = releaseResult.ReleasedAmount
			result.FeeCollected = releaseResult.FeeAmount
			result.FinalStatus = "released"
		}
	}

	// Calculate final fee
	var feeResult FeeResult
	_ = workflow.ExecuteActivity(ctx, CalculateFeeActivity, FeeInput{
		ContractID: input.ContractID,
		Amount:     result.TotalReleased,
	}).Get(ctx, &feeResult)
	result.FeeCollected = feeResult.FeeAmount

	// Record completion
	now := workflow.Now(ctx)
	result.CompletedAt = &now

	// Send completion notifications
	_ = workflow.ExecuteActivity(ctx, SendNotificationActivity, NotificationInput{
		TenantID: input.TenantID,
		Type:     "escrow_completed",
		UserIDs:  []string{input.BuyerID, input.SellerID},
		Message:  fmt.Sprintf("Escrow %s completed with status: %s", input.ContractID, result.FinalStatus),
	})

	logger.Info("Escrow lifecycle completed", "contract_id", input.ContractID, "status", result.FinalStatus)

	return result, nil
}

// MilestoneProcessingInput contains input for milestone processing workflow
type MilestoneProcessingInput struct {
	ContractID     string  `json:"contract_id"`
	TenantID       string  `json:"tenant_id"`
	TotalAmount    float64 `json:"total_amount"`
	MilestoneCount int     `json:"milestone_count"`
}

// MilestoneProcessingResult contains the result of milestone processing
type MilestoneProcessingResult struct {
	ContractID          string  `json:"contract_id"`
	MilestonesCompleted int     `json:"milestones_completed"`
	TotalReleased       float64 `json:"total_released"`
	TotalRefunded       float64 `json:"total_refunded"`
	FinalStatus         string  `json:"final_status"`
}

// MilestoneProcessingWorkflow handles milestone-based escrow releases
func MilestoneProcessingWorkflow(ctx workflow.Context, input MilestoneProcessingInput) (*MilestoneProcessingResult, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting milestone processing workflow", "contract_id", input.ContractID)

	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 10 * time.Minute,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    time.Minute,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	result := &MilestoneProcessingResult{
		ContractID:  input.ContractID,
		FinalStatus: "processing",
	}

	// Process each milestone
	for i := 1; i <= input.MilestoneCount; i++ {
		milestoneID := fmt.Sprintf("MS-%s-%d", input.ContractID, i)
		logger.Info("Processing milestone", "milestone_id", milestoneID)

		// Wait for milestone completion signal
		milestoneSignal := workflow.GetSignalChannel(ctx, fmt.Sprintf("milestone-complete-%d", i))
		disputeSignal := workflow.GetSignalChannel(ctx, "dispute-raised")

		// Milestone timeout (30 days default)
		milestoneTimeout := workflow.NewTimer(ctx, 30*24*time.Hour)

		var milestoneCompleted bool
		var disputed bool
		var milestoneData MilestoneCompletionSignal

		selector := workflow.NewSelector(ctx)
		selector.AddReceive(milestoneSignal, func(c workflow.ReceiveChannel, more bool) {
			c.Receive(ctx, &milestoneData)
			milestoneCompleted = true
		})
		selector.AddReceive(disputeSignal, func(c workflow.ReceiveChannel, more bool) {
			disputed = true
		})
		selector.AddFuture(milestoneTimeout, func(f workflow.Future) {
			// Timeout - milestone not completed
		})
		selector.Select(ctx)

		if disputed {
			result.FinalStatus = "disputed"
			return result, nil
		}

		if !milestoneCompleted {
			logger.Warn("Milestone timed out", "milestone_id", milestoneID)
			result.FinalStatus = "milestone_timeout"
			return result, nil
		}

		// Verify milestone documents
		var verifyResult MilestoneVerifyResult
		err := workflow.ExecuteActivity(ctx, VerifyMilestoneDocumentsActivity, MilestoneVerifyInput{
			ContractID:  input.ContractID,
			MilestoneID: milestoneID,
			DocumentIDs: milestoneData.DocumentIDs,
		}).Get(ctx, &verifyResult)

		if err != nil {
			logger.Error("Milestone verification failed", "error", err)
			continue
		}

		if !verifyResult.Verified {
			logger.Warn("Milestone documents not verified", "milestone_id", milestoneID)
			continue
		}

		// Release milestone funds
		var releaseResult MilestoneReleaseResult
		err = workflow.ExecuteActivity(ctx, ProcessMilestoneReleaseActivity, MilestoneReleaseInput{
			ContractID:  input.ContractID,
			MilestoneID: milestoneID,
			Amount:      milestoneData.Amount,
		}).Get(ctx, &releaseResult)

		if err != nil {
			logger.Error("Milestone release failed", "error", err)
			continue
		}

		result.MilestonesCompleted++
		result.TotalReleased += releaseResult.ReleasedAmount

		// Send notification
		_ = workflow.ExecuteActivity(ctx, SendNotificationActivity, NotificationInput{
			TenantID: input.TenantID,
			Type:     "milestone_released",
			Message:  fmt.Sprintf("Milestone %d released: %.2f", i, releaseResult.ReleasedAmount),
		})
	}

	if result.MilestonesCompleted == input.MilestoneCount {
		result.FinalStatus = "completed"
	} else {
		result.FinalStatus = "partial"
	}

	return result, nil
}

// DisputeResolutionInput contains input for dispute resolution workflow
type DisputeResolutionInput struct {
	ContractID        string  `json:"contract_id"`
	TenantID          string  `json:"tenant_id"`
	DisputeID         string  `json:"dispute_id"`
	DisputedAmount    float64 `json:"disputed_amount"`
	DisputeWindowDays int     `json:"dispute_window_days"`
}

// DisputeResolutionResult contains the result of dispute resolution
type DisputeResolutionResult struct {
	DisputeID      string  `json:"dispute_id"`
	Resolution     string  `json:"resolution"` // buyer, seller, partial
	AmountToBuyer  float64 `json:"amount_to_buyer"`
	AmountToSeller float64 `json:"amount_to_seller"`
	ResolvedBy     string  `json:"resolved_by"`
}

// DisputeResolutionWorkflow handles dispute resolution process
func DisputeResolutionWorkflow(ctx workflow.Context, input DisputeResolutionInput) (*DisputeResolutionResult, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting dispute resolution workflow", "contract_id", input.ContractID)

	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 5 * time.Minute,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    time.Minute,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	result := &DisputeResolutionResult{
		DisputeID: input.DisputeID,
	}

	// Step 1: Evidence collection period (7 days)
	evidenceDeadline := workflow.NewTimer(ctx, 7*24*time.Hour)
	buyerEvidenceSignal := workflow.GetSignalChannel(ctx, "buyer-evidence")
	sellerEvidenceSignal := workflow.GetSignalChannel(ctx, "seller-evidence")

	var buyerEvidence []string
	var sellerEvidence []string

	// Collect evidence until deadline
	for {
		selector := workflow.NewSelector(ctx)
		var done bool

		selector.AddReceive(buyerEvidenceSignal, func(c workflow.ReceiveChannel, more bool) {
			var evidence EvidenceSignal
			c.Receive(ctx, &evidence)
			buyerEvidence = append(buyerEvidence, evidence.DocumentIDs...)
		})
		selector.AddReceive(sellerEvidenceSignal, func(c workflow.ReceiveChannel, more bool) {
			var evidence EvidenceSignal
			c.Receive(ctx, &evidence)
			sellerEvidence = append(sellerEvidence, evidence.DocumentIDs...)
		})
		selector.AddFuture(evidenceDeadline, func(f workflow.Future) {
			done = true
		})
		selector.Select(ctx)

		if done {
			break
		}
	}

	logger.Info("Evidence collection complete",
		"buyer_evidence_count", len(buyerEvidence),
		"seller_evidence_count", len(sellerEvidence))

	// Step 2: Wait for resolution decision (7 more days)
	resolutionSignal := workflow.GetSignalChannel(ctx, "dispute-resolution")
	resolutionDeadline := workflow.NewTimer(ctx, 7*24*time.Hour)

	var resolutionReceived bool
	var resolution ResolutionSignal

	selector := workflow.NewSelector(ctx)
	selector.AddReceive(resolutionSignal, func(c workflow.ReceiveChannel, more bool) {
		c.Receive(ctx, &resolution)
		resolutionReceived = true
	})
	selector.AddFuture(resolutionDeadline, func(f workflow.Future) {
		// Auto-escalate if no resolution
	})
	selector.Select(ctx)

	if !resolutionReceived {
		// Escalate dispute
		logger.Info("Escalating dispute due to no resolution", "dispute_id", input.DisputeID)
		_ = workflow.ExecuteActivity(ctx, EscalateDisputeActivity, EscalateInput{
			ContractID: input.ContractID,
			DisputeID:  input.DisputeID,
			Reason:     "Resolution deadline expired",
		})

		// Wait for escalated resolution (additional 14 days)
		escalatedDeadline := workflow.NewTimer(ctx, 14*24*time.Hour)
		selector := workflow.NewSelector(ctx)
		selector.AddReceive(resolutionSignal, func(c workflow.ReceiveChannel, more bool) {
			c.Receive(ctx, &resolution)
			resolutionReceived = true
		})
		selector.AddFuture(escalatedDeadline, func(f workflow.Future) {
			// Default to split if still no resolution
			resolution = ResolutionSignal{
				Type:           "partial",
				AmountToBuyer:  input.DisputedAmount / 2,
				AmountToSeller: input.DisputedAmount / 2,
				ResolvedBy:     "system_default",
			}
			resolutionReceived = true
		})
		selector.Select(ctx)
	}

	// Step 3: Execute resolution
	result.Resolution = resolution.Type
	result.AmountToBuyer = resolution.AmountToBuyer
	result.AmountToSeller = resolution.AmountToSeller
	result.ResolvedBy = resolution.ResolvedBy

	// Process fund transfers based on resolution
	if resolution.AmountToBuyer > 0 {
		_ = workflow.ExecuteActivity(ctx, RefundFundsActivity, RefundInput{
			ContractID: input.ContractID,
			Amount:     resolution.AmountToBuyer,
			Reason:     "Dispute resolution - buyer portion",
		})
	}

	if resolution.AmountToSeller > 0 {
		_ = workflow.ExecuteActivity(ctx, ReleaseFundsActivity, ReleaseInput{
			ContractID: input.ContractID,
			Amount:     resolution.AmountToSeller,
		})
	}

	// Record audit log
	_ = workflow.ExecuteActivity(ctx, RecordAuditLogActivity, AuditLogInput{
		TenantID:   input.TenantID,
		EntityType: "escrow_dispute",
		EntityID:   input.DisputeID,
		Action:     "dispute_resolved",
		Details: map[string]interface{}{
			"resolution":       resolution.Type,
			"amount_to_buyer":  resolution.AmountToBuyer,
			"amount_to_seller": resolution.AmountToSeller,
			"resolved_by":      resolution.ResolvedBy,
		},
	})

	// Send notifications
	_ = workflow.ExecuteActivity(ctx, SendNotificationActivity, NotificationInput{
		TenantID: input.TenantID,
		Type:     "dispute_resolved",
		Message:  fmt.Sprintf("Dispute resolved: %s", resolution.Type),
	})

	logger.Info("Dispute resolution completed", "dispute_id", input.DisputeID, "resolution", result.Resolution)

	return result, nil
}

// Signal types
type FundingSignal struct {
	Amount    float64 `json:"amount"`
	Reference string  `json:"reference"`
	Source    string  `json:"source"`
}

type FulfillmentSignal struct {
	ConfirmedBy string   `json:"confirmed_by"`
	DocumentIDs []string `json:"document_ids,omitempty"`
	Notes       string   `json:"notes,omitempty"`
}

type DisputeSignal struct {
	DisputeID   string `json:"dispute_id"`
	InitiatedBy string `json:"initiated_by"`
	Reason      string `json:"reason"`
}

type MilestoneCompletionSignal struct {
	MilestoneID string   `json:"milestone_id"`
	Amount      float64  `json:"amount"`
	DocumentIDs []string `json:"document_ids"`
	CompletedBy string   `json:"completed_by"`
}

type EvidenceSignal struct {
	SubmittedBy string   `json:"submitted_by"`
	DocumentIDs []string `json:"document_ids"`
	Description string   `json:"description"`
}

type ResolutionSignal struct {
	Type           string  `json:"type"` // buyer, seller, partial
	AmountToBuyer  float64 `json:"amount_to_buyer"`
	AmountToSeller float64 `json:"amount_to_seller"`
	ResolvedBy     string  `json:"resolved_by"`
	Notes          string  `json:"notes"`
}

// Activity input/output types
type KYCInput struct {
	TenantID string `json:"tenant_id"`
	BuyerID  string `json:"buyer_id"`
	SellerID string `json:"seller_id"`
}

type KYCVerificationResult struct {
	BuyerVerified  bool `json:"buyer_verified"`
	SellerVerified bool `json:"seller_verified"`
	BuyerLevel     int  `json:"buyer_level"`
	SellerLevel    int  `json:"seller_level"`
}

type FraudCheckInput struct {
	TenantID   string  `json:"tenant_id"`
	ContractID string  `json:"contract_id"`
	BuyerID    string  `json:"buyer_id"`
	SellerID   string  `json:"seller_id"`
	Amount     float64 `json:"amount"`
}

type FraudCheckResult struct {
	RiskScore        float64  `json:"risk_score"`
	BlockTransaction bool     `json:"block_transaction"`
	Alerts           []string `json:"alerts,omitempty"`
}

type ReleaseInput struct {
	ContractID string  `json:"contract_id"`
	TenantID   string  `json:"tenant_id"`
	Amount     float64 `json:"amount"`
	SellerID   string  `json:"seller_id"`
}

type ReleaseResult struct {
	ReleasedAmount float64 `json:"released_amount"`
	FeeAmount      float64 `json:"fee_amount"`
	TransactionID  string  `json:"transaction_id"`
}

type RefundInput struct {
	ContractID string  `json:"contract_id"`
	Amount     float64 `json:"amount"`
	Reason     string  `json:"reason"`
}

type NotificationInput struct {
	TenantID string   `json:"tenant_id"`
	Type     string   `json:"type"`
	UserIDs  []string `json:"user_ids,omitempty"`
	Message  string   `json:"message"`
}

type AuditLogInput struct {
	TenantID   string                 `json:"tenant_id"`
	EntityType string                 `json:"entity_type"`
	EntityID   string                 `json:"entity_id"`
	Action     string                 `json:"action"`
	ActorID    string                 `json:"actor_id"`
	Details    map[string]interface{} `json:"details"`
}

type MilestoneVerifyInput struct {
	ContractID  string   `json:"contract_id"`
	MilestoneID string   `json:"milestone_id"`
	DocumentIDs []string `json:"document_ids"`
}

type MilestoneVerifyResult struct {
	Verified         bool     `json:"verified"`
	MissingDocuments []string `json:"missing_documents,omitempty"`
}

type MilestoneReleaseInput struct {
	ContractID  string  `json:"contract_id"`
	MilestoneID string  `json:"milestone_id"`
	Amount      float64 `json:"amount"`
}

type MilestoneReleaseResult struct {
	ReleasedAmount float64 `json:"released_amount"`
	TransactionID  string  `json:"transaction_id"`
}

type EscalateInput struct {
	ContractID string `json:"contract_id"`
	DisputeID  string `json:"dispute_id"`
	Reason     string `json:"reason"`
}

type FeeInput struct {
	ContractID string  `json:"contract_id"`
	Amount     float64 `json:"amount"`
}

type FeeResult struct {
	FeeAmount float64 `json:"fee_amount"`
	FeeType   string  `json:"fee_type"`
}
