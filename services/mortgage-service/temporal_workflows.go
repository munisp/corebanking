package main

import (
	"context"
	"fmt"
	"log"
	"time"
)

// Temporal workflow definitions for mortgage lifecycle management
// These workflows orchestrate the complex, long-running mortgage processes

// MortgageApplicationWorkflow orchestrates the mortgage application process
type MortgageApplicationWorkflow struct {
	ApplicationID string
	TenantID      string
	Status        string
	CurrentStep   string
	StartedAt     time.Time
	CompletedAt   *time.Time
	Error         string
}

// WorkflowStep represents a step in the workflow
type WorkflowStep struct {
	Name        string
	Status      string // pending, in_progress, completed, failed, skipped
	StartedAt   *time.Time
	CompletedAt *time.Time
	Error       string
	Retries     int
	MaxRetries  int
}

// MortgageOriginationWorkflow handles the full origination process
type MortgageOriginationWorkflow struct {
	ID            string
	ApplicationID string
	TenantID      string
	Steps         []WorkflowStep
	CurrentStep   int
	Status        string
	StartedAt     time.Time
	CompletedAt   *time.Time
}

// NewMortgageOriginationWorkflow creates a new origination workflow
func NewMortgageOriginationWorkflow(applicationID, tenantID string) *MortgageOriginationWorkflow {
	return &MortgageOriginationWorkflow{
		ID:            generateID("WF"),
		ApplicationID: applicationID,
		TenantID:      tenantID,
		Status:        "pending",
		StartedAt:     time.Now(),
		Steps: []WorkflowStep{
			{Name: "identity_verification", Status: "pending", MaxRetries: 3},
			{Name: "credit_check", Status: "pending", MaxRetries: 3},
			{Name: "income_verification", Status: "pending", MaxRetries: 3},
			{Name: "property_valuation", Status: "pending", MaxRetries: 2},
			{Name: "title_verification", Status: "pending", MaxRetries: 2},
			{Name: "underwriting", Status: "pending", MaxRetries: 1},
			{Name: "credit_committee_review", Status: "pending", MaxRetries: 1},
			{Name: "offer_generation", Status: "pending", MaxRetries: 3},
			{Name: "offer_acceptance", Status: "pending", MaxRetries: 1},
			{Name: "documentation", Status: "pending", MaxRetries: 3},
			{Name: "disbursement", Status: "pending", MaxRetries: 3},
		},
	}
}

// Execute runs the origination workflow
func (w *MortgageOriginationWorkflow) Execute(ctx context.Context) error {
	w.Status = "in_progress"

	for i, step := range w.Steps {
		w.CurrentStep = i
		now := time.Now()
		w.Steps[i].StartedAt = &now
		w.Steps[i].Status = "in_progress"

		log.Printf("Executing workflow step: %s for application %s", step.Name, w.ApplicationID)

		var err error
		switch step.Name {
		case "identity_verification":
			err = w.executeIdentityVerification(ctx)
		case "credit_check":
			err = w.executeCreditCheck(ctx)
		case "income_verification":
			err = w.executeIncomeVerification(ctx)
		case "property_valuation":
			err = w.executePropertyValuation(ctx)
		case "title_verification":
			err = w.executeTitleVerification(ctx)
		case "underwriting":
			err = w.executeUnderwriting(ctx)
		case "credit_committee_review":
			err = w.executeCreditCommitteeReview(ctx)
		case "offer_generation":
			err = w.executeOfferGeneration(ctx)
		case "offer_acceptance":
			err = w.executeOfferAcceptance(ctx)
		case "documentation":
			err = w.executeDocumentation(ctx)
		case "disbursement":
			err = w.executeDisbursement(ctx)
		}

		if err != nil {
			w.Steps[i].Status = "failed"
			w.Steps[i].Error = err.Error()
			w.Steps[i].Retries++

			if w.Steps[i].Retries < w.Steps[i].MaxRetries {
				log.Printf("Retrying step %s (attempt %d/%d)", step.Name, w.Steps[i].Retries, w.Steps[i].MaxRetries)
				i-- // Retry same step
				continue
			}

			w.Status = "failed"
			return fmt.Errorf("workflow failed at step %s: %w", step.Name, err)
		}

		completed := time.Now()
		w.Steps[i].CompletedAt = &completed
		w.Steps[i].Status = "completed"

		// Publish step completion event
		kafkaClient.PublishEvent("mortgages.workflows", MortgageEvent{
			Type:       fmt.Sprintf("mortgage.workflow.step.%s.completed", step.Name),
			MortgageID: w.ApplicationID,
			TenantID:   w.TenantID,
			Timestamp:  time.Now(),
			Metadata: map[string]interface{}{
				"workflow_id": w.ID,
				"step":        step.Name,
				"step_index":  i,
			},
		})
	}

	completed := time.Now()
	w.CompletedAt = &completed
	w.Status = "completed"

	// Publish workflow completion event
	kafkaClient.PublishEvent("mortgages.workflows", MortgageEvent{
		Type:       "mortgage.workflow.origination.completed",
		MortgageID: w.ApplicationID,
		TenantID:   w.TenantID,
		Timestamp:  time.Now(),
		Metadata: map[string]interface{}{
			"workflow_id": w.ID,
			"duration_ms": completed.Sub(w.StartedAt).Milliseconds(),
		},
	})

	return nil
}

func (w *MortgageOriginationWorkflow) executeIdentityVerification(ctx context.Context) error {
	// Verify BVN and NIN
	log.Printf("Verifying identity for application %s", w.ApplicationID)
	
	// In production, this would call BVN/NIN verification APIs
	// Simulate verification delay
	time.Sleep(100 * time.Millisecond)
	
	return nil
}

func (w *MortgageOriginationWorkflow) executeCreditCheck(ctx context.Context) error {
	// Check credit bureau (CRC, FirstCentral, etc.)
	log.Printf("Running credit check for application %s", w.ApplicationID)
	
	// In production, this would call credit bureau APIs
	time.Sleep(100 * time.Millisecond)
	
	return nil
}

func (w *MortgageOriginationWorkflow) executeIncomeVerification(ctx context.Context) error {
	// Verify income through bank statements, payslips, etc.
	log.Printf("Verifying income for application %s", w.ApplicationID)
	
	time.Sleep(100 * time.Millisecond)
	
	return nil
}

func (w *MortgageOriginationWorkflow) executePropertyValuation(ctx context.Context) error {
	// Trigger property valuation
	log.Printf("Initiating property valuation for application %s", w.ApplicationID)
	
	// In production, this would integrate with valuation service
	time.Sleep(100 * time.Millisecond)
	
	return nil
}

func (w *MortgageOriginationWorkflow) executeTitleVerification(ctx context.Context) error {
	// Verify property title
	log.Printf("Verifying property title for application %s", w.ApplicationID)
	
	// In production, this would integrate with land registry
	time.Sleep(100 * time.Millisecond)
	
	return nil
}

func (w *MortgageOriginationWorkflow) executeUnderwriting(ctx context.Context) error {
	// Run underwriting engine
	log.Printf("Running underwriting for application %s", w.ApplicationID)
	
	app, err := fetchMortgageApplication(w.ApplicationID, w.TenantID)
	if err != nil {
		return err
	}
	
	engine := NewMortgageUnderwritingEngine()
	decision := engine.Underwrite(app)
	
	if decision.Decision == "DECLINED" {
		return fmt.Errorf("underwriting declined: %v", decision.DeclineReasons)
	}
	
	return nil
}

func (w *MortgageOriginationWorkflow) executeCreditCommitteeReview(ctx context.Context) error {
	// Submit to credit committee for review
	log.Printf("Submitting to credit committee for application %s", w.ApplicationID)
	
	// In production, this would create a task for credit committee
	// and wait for approval signal
	time.Sleep(100 * time.Millisecond)
	
	return nil
}

func (w *MortgageOriginationWorkflow) executeOfferGeneration(ctx context.Context) error {
	// Generate offer letter
	log.Printf("Generating offer letter for application %s", w.ApplicationID)
	
	app, err := fetchMortgageApplication(w.ApplicationID, w.TenantID)
	if err != nil {
		return err
	}
	
	_ = generateOfferLetter(app)
	
	return nil
}

func (w *MortgageOriginationWorkflow) executeOfferAcceptance(ctx context.Context) error {
	// Wait for offer acceptance
	log.Printf("Waiting for offer acceptance for application %s", w.ApplicationID)
	
	// In production, this would wait for customer acceptance signal
	time.Sleep(100 * time.Millisecond)
	
	return nil
}

func (w *MortgageOriginationWorkflow) executeDocumentation(ctx context.Context) error {
	// Verify all documentation is complete
	log.Printf("Verifying documentation for application %s", w.ApplicationID)
	
	time.Sleep(100 * time.Millisecond)
	
	return nil
}

func (w *MortgageOriginationWorkflow) executeDisbursement(ctx context.Context) error {
	// Execute disbursement
	log.Printf("Executing disbursement for application %s", w.ApplicationID)
	
	// In production, this would trigger the actual disbursement
	time.Sleep(100 * time.Millisecond)
	
	return nil
}

// MortgageServicingWorkflow handles ongoing mortgage servicing
type MortgageServicingWorkflow struct {
	ID         string
	MortgageID string
	TenantID   string
	Status     string
	StartedAt  time.Time
}

// NewMortgageServicingWorkflow creates a new servicing workflow
func NewMortgageServicingWorkflow(mortgageID, tenantID string) *MortgageServicingWorkflow {
	return &MortgageServicingWorkflow{
		ID:         generateID("SVC"),
		MortgageID: mortgageID,
		TenantID:   tenantID,
		Status:     "active",
		StartedAt:  time.Now(),
	}
}

// RunDailyServicing runs daily servicing tasks
func (w *MortgageServicingWorkflow) RunDailyServicing(ctx context.Context) error {
	log.Printf("Running daily servicing for mortgage %s", w.MortgageID)

	// 1. Accrue interest
	if err := w.accrueInterest(ctx); err != nil {
		log.Printf("Error accruing interest: %v", err)
	}

	// 2. Check for due payments
	if err := w.checkDuePayments(ctx); err != nil {
		log.Printf("Error checking due payments: %v", err)
	}

	// 3. Update arrears status
	if err := w.updateArrearsStatus(ctx); err != nil {
		log.Printf("Error updating arrears: %v", err)
	}

	// 4. Process escrow
	if err := w.processEscrow(ctx); err != nil {
		log.Printf("Error processing escrow: %v", err)
	}

	return nil
}

func (w *MortgageServicingWorkflow) accrueInterest(ctx context.Context) error {
	app, err := fetchMortgageApplication(w.MortgageID, w.TenantID)
	if err != nil {
		return err
	}

	// Get current principal balance
	balance, err := tbClient.GetAccountBalance(app.PrincipalAccountID)
	if err != nil {
		return err
	}

	// Calculate daily interest
	dailyRate := app.InterestRate / 365.0 / 100.0
	dailyInterest := balance * dailyRate

	// Accrue interest in TigerBeetle
	_, err = tbClient.AccrueInterest(
		w.TenantID,
		app.PrincipalAccountID,
		app.InterestAccountID,
		dailyInterest,
		w.MortgageID,
	)

	return err
}

func (w *MortgageServicingWorkflow) checkDuePayments(ctx context.Context) error {
	// Check for payments due today
	schedule, err := fetchRepaymentSchedule(w.MortgageID)
	if err != nil {
		return err
	}

	today := time.Now().Truncate(24 * time.Hour)

	for _, entry := range schedule {
		if entry.Status == "pending" && entry.DueDate.Truncate(24*time.Hour).Equal(today) {
			// Payment is due today - send reminder
			kafkaClient.PublishEvent("mortgages.notifications", MortgageEvent{
				Type:       "mortgage.payment.due",
				MortgageID: w.MortgageID,
				TenantID:   w.TenantID,
				Amount:     entry.TotalAmount,
				Timestamp:  time.Now(),
				Metadata: map[string]interface{}{
					"payment_number": entry.PaymentNumber,
					"due_date":       entry.DueDate,
				},
			})
		}
	}

	return nil
}

func (w *MortgageServicingWorkflow) updateArrearsStatus(ctx context.Context) error {
	// Calculate arrears based on missed payments
	schedule, err := fetchRepaymentSchedule(w.MortgageID)
	if err != nil {
		return err
	}

	today := time.Now()
	var arrearsAmount float64
	var daysPastDue int

	for _, entry := range schedule {
		if entry.Status == "pending" && entry.DueDate.Before(today) {
			arrearsAmount += entry.TotalAmount
			days := int(today.Sub(entry.DueDate).Hours() / 24)
			if days > daysPastDue {
				daysPastDue = days
			}
		}
	}

	if arrearsAmount > 0 {
		// Update arrears status
		app, _ := fetchMortgageApplication(w.MortgageID, w.TenantID)
		
		// Determine bucket
		var bucket string
		switch {
		case daysPastDue >= 90:
			bucket = "90+"
			updateMortgageStatus(w.MortgageID, w.TenantID, StatusDefault)
		case daysPastDue >= 60:
			bucket = "61-90"
			updateMortgageStatus(w.MortgageID, w.TenantID, StatusInArrears)
		case daysPastDue >= 30:
			bucket = "31-60"
			updateMortgageStatus(w.MortgageID, w.TenantID, StatusInArrears)
		default:
			bucket = "1-30"
		}

		// Publish arrears event
		kafkaClient.PublishEvent("mortgages.arrears", MortgageEvent{
			Type:       "mortgage.arrears.detected",
			MortgageID: w.MortgageID,
			TenantID:   w.TenantID,
			Amount:     arrearsAmount,
			Timestamp:  time.Now(),
			Metadata: map[string]interface{}{
				"days_past_due": daysPastDue,
				"bucket":        bucket,
			},
		})

		// Update IFRS 9 classification
		_ = classifyMortgageIFRS9(app, daysPastDue)
	}

	return nil
}

func (w *MortgageServicingWorkflow) processEscrow(ctx context.Context) error {
	escrow, err := fetchEscrowAccount(w.MortgageID)
	if err != nil {
		return err
	}

	today := time.Now()

	// Check if property tax is due
	if escrow.NextTaxDueDate.Before(today) || escrow.NextTaxDueDate.Equal(today) {
		// Disburse property tax from escrow
		_, err := tbClient.CreateEscrowDisbursement(
			w.TenantID,
			escrow.TigerBeetleAccountID,
			"TAX_AUTHORITY_ACCOUNT", // Would be actual tax authority account
			escrow.PropertyTaxAmount,
			w.MortgageID,
			"tax",
		)
		if err != nil {
			return err
		}

		// Update next tax due date
		// In production, update database
	}

	// Check if insurance is due
	if escrow.NextInsuranceDueDate.Before(today) || escrow.NextInsuranceDueDate.Equal(today) {
		// Disburse insurance premium from escrow
		_, err := tbClient.CreateEscrowDisbursement(
			w.TenantID,
			escrow.TigerBeetleAccountID,
			"INSURANCE_PROVIDER_ACCOUNT", // Would be actual insurance provider account
			escrow.InsurancePremium,
			w.MortgageID,
			"insurance",
		)
		if err != nil {
			return err
		}

		// Update next insurance due date
		// In production, update database
	}

	return nil
}

// MortgageCollectionsWorkflow handles collections for delinquent mortgages
type MortgageCollectionsWorkflow struct {
	ID         string
	MortgageID string
	TenantID   string
	Status     string
	Stage      int // 1-4 escalation stages
	StartedAt  time.Time
}

// NewMortgageCollectionsWorkflow creates a new collections workflow
func NewMortgageCollectionsWorkflow(mortgageID, tenantID string) *MortgageCollectionsWorkflow {
	return &MortgageCollectionsWorkflow{
		ID:         generateID("COL"),
		MortgageID: mortgageID,
		TenantID:   tenantID,
		Status:     "active",
		Stage:      1,
		StartedAt:  time.Now(),
	}
}

// Execute runs the collections workflow
func (w *MortgageCollectionsWorkflow) Execute(ctx context.Context, daysPastDue int) error {
	log.Printf("Running collections workflow for mortgage %s (DPD: %d)", w.MortgageID, daysPastDue)

	// Determine stage based on days past due
	switch {
	case daysPastDue < 30:
		w.Stage = 1
		return w.executeStage1(ctx) // Soft reminder
	case daysPastDue < 60:
		w.Stage = 2
		return w.executeStage2(ctx) // Formal notice
	case daysPastDue < 90:
		w.Stage = 3
		return w.executeStage3(ctx) // Legal notice
	default:
		w.Stage = 4
		return w.executeStage4(ctx) // Foreclosure initiation
	}
}

func (w *MortgageCollectionsWorkflow) executeStage1(ctx context.Context) error {
	// Stage 1: Soft reminder (SMS, Email, Push notification)
	kafkaClient.PublishEvent("mortgages.collections", MortgageEvent{
		Type:       "mortgage.collections.reminder",
		MortgageID: w.MortgageID,
		TenantID:   w.TenantID,
		Timestamp:  time.Now(),
		Metadata: map[string]interface{}{
			"stage":   1,
			"action":  "soft_reminder",
			"channel": []string{"sms", "email", "push"},
		},
	})
	return nil
}

func (w *MortgageCollectionsWorkflow) executeStage2(ctx context.Context) error {
	// Stage 2: Formal notice + phone call
	kafkaClient.PublishEvent("mortgages.collections", MortgageEvent{
		Type:       "mortgage.collections.formal_notice",
		MortgageID: w.MortgageID,
		TenantID:   w.TenantID,
		Timestamp:  time.Now(),
		Metadata: map[string]interface{}{
			"stage":   2,
			"action":  "formal_notice",
			"channel": []string{"letter", "phone"},
		},
	})
	return nil
}

func (w *MortgageCollectionsWorkflow) executeStage3(ctx context.Context) error {
	// Stage 3: Legal notice + demand letter
	kafkaClient.PublishEvent("mortgages.collections", MortgageEvent{
		Type:       "mortgage.collections.legal_notice",
		MortgageID: w.MortgageID,
		TenantID:   w.TenantID,
		Timestamp:  time.Now(),
		Metadata: map[string]interface{}{
			"stage":   3,
			"action":  "legal_notice",
			"channel": []string{"legal_letter", "registered_mail"},
		},
	})
	return nil
}

func (w *MortgageCollectionsWorkflow) executeStage4(ctx context.Context) error {
	// Stage 4: Foreclosure initiation
	updateMortgageStatus(w.MortgageID, w.TenantID, StatusForeclosure)

	kafkaClient.PublishEvent("mortgages.collections", MortgageEvent{
		Type:       "mortgage.foreclosure.initiated",
		MortgageID: w.MortgageID,
		TenantID:   w.TenantID,
		Timestamp:  time.Now(),
		Metadata: map[string]interface{}{
			"stage":  4,
			"action": "foreclosure_initiation",
		},
	})
	return nil
}

// MortgageRateResetWorkflow handles rate resets for variable rate mortgages
type MortgageRateResetWorkflow struct {
	ID         string
	MortgageID string
	TenantID   string
	Status     string
}

// Execute runs the rate reset workflow
func (w *MortgageRateResetWorkflow) Execute(ctx context.Context, newBaseRate float64) error {
	app, err := fetchMortgageApplication(w.MortgageID, w.TenantID)
	if err != nil {
		return err
	}

	// Only apply to variable rate mortgages
	if app.ProductType != ProductVariableRate {
		return nil
	}

	// Apply rate change
	event, err := applyRateChange(app, newBaseRate)
	if err != nil {
		return err
	}

	// Regenerate repayment schedule
	newSchedule := generateRepaymentSchedule(app)
	saveRepaymentSchedule(w.MortgageID, newSchedule)

	// Notify customer
	kafkaClient.PublishEvent("mortgages.rate-changes", MortgageEvent{
		Type:       "mortgage.rate.changed",
		MortgageID: w.MortgageID,
		TenantID:   w.TenantID,
		Timestamp:  time.Now(),
		Metadata: map[string]interface{}{
			"old_rate":        event.OldRate,
			"new_rate":        event.NewRate,
			"effective_date":  event.EffectiveDate,
			"new_payment":     app.MonthlyPayment,
		},
	})

	return nil
}
