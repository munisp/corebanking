package main

import (
	"fmt"
	"math"
	"time"
)

// ScheduleEntry represents a single repayment schedule entry
type ScheduleEntry struct {
	PaymentNumber       int        `json:"payment_number"`
	DueDate             time.Time  `json:"due_date"`
	PrincipalAmount     float64    `json:"principal_amount"`
	InterestAmount      float64    `json:"interest_amount"`
	EscrowAmount        float64    `json:"escrow_amount"`
	TotalAmount         float64    `json:"total_amount"`
	OpeningBalance      float64    `json:"opening_balance"`
	ClosingBalance      float64    `json:"closing_balance"`
	CumulativePrincipal float64    `json:"cumulative_principal"`
	CumulativeInterest  float64    `json:"cumulative_interest"`
	Status              string     `json:"status"`
	PaidDate            *time.Time `json:"paid_date,omitempty"`
	PaidAmount          float64    `json:"paid_amount,omitempty"`
}

// generateRepaymentSchedule generates a full amortization schedule
func generateRepaymentSchedule(app *MortgageApplication) []ScheduleEntry {
	principal := app.ApprovedAmount
	if principal == 0 {
		principal = app.RequestedAmount
	}

	tenor := app.ApprovedTenorMonths
	if tenor == 0 {
		tenor = app.RequestedTenorMonths
	}

	rate := app.InterestRate
	if rate == 0 {
		rate = 18.0 // Default rate
	}

	// Get escrow contribution
	escrowMonthly := 0.0
	if app.Property.PurchasePrice > 0 {
		// Property tax (~0.1% annually) + insurance
		escrowMonthly = (app.Property.PurchasePrice * 0.001 / 12) + (app.Property.InsurancePremium / 12)
	}

	return generateAmortizationSchedule(principal, rate, tenor, escrowMonthly, app.DisbursedAt)
}

// generateAmortizationSchedule creates a standard amortization schedule
func generateAmortizationSchedule(principal, annualRate float64, termMonths int, escrowMonthly float64, startDate *time.Time) []ScheduleEntry {
	schedule := make([]ScheduleEntry, termMonths)

	monthlyRate := annualRate / 12.0 / 100.0
	monthlyPayment := calculateMonthlyPayment(principal, annualRate, termMonths)

	balance := principal
	cumulativePrincipal := 0.0
	cumulativeInterest := 0.0

	start := time.Now()
	if startDate != nil {
		start = *startDate
	}

	for i := 0; i < termMonths; i++ {
		// Calculate interest for this period
		interestPayment := balance * monthlyRate

		// Calculate principal for this period
		principalPayment := monthlyPayment - interestPayment

		// Handle final payment rounding
		if i == termMonths-1 {
			principalPayment = balance
		}

		// Update cumulative totals
		cumulativePrincipal += principalPayment
		cumulativeInterest += interestPayment

		// Calculate due date (1st of each month)
		dueDate := start.AddDate(0, i+1, 0)
		dueDate = time.Date(dueDate.Year(), dueDate.Month(), 1, 0, 0, 0, 0, dueDate.Location())

		schedule[i] = ScheduleEntry{
			PaymentNumber:       i + 1,
			DueDate:             dueDate,
			PrincipalAmount:     roundToKobo(principalPayment),
			InterestAmount:      roundToKobo(interestPayment),
			EscrowAmount:        roundToKobo(escrowMonthly),
			TotalAmount:         roundToKobo(principalPayment + interestPayment + escrowMonthly),
			OpeningBalance:      roundToKobo(balance),
			ClosingBalance:      roundToKobo(balance - principalPayment),
			CumulativePrincipal: roundToKobo(cumulativePrincipal),
			CumulativeInterest:  roundToKobo(cumulativeInterest),
			Status:              "pending",
		}

		balance -= principalPayment
	}

	return schedule
}

// recastRepaymentSchedule recalculates schedule after prepayment (same tenor, lower payment)
func recastRepaymentSchedule(app *MortgageApplication, prepaymentAmount float64) []ScheduleEntry {
	// Get current balance
	currentBalance, _ := tbClient.GetAccountBalance(app.PrincipalAccountID)
	newBalance := currentBalance - prepaymentAmount

	// Calculate remaining payments
	remainingPayments := calculateRemainingPayments(app)

	// Get escrow contribution
	escrowMonthly := 0.0
	if app.Property.PurchasePrice > 0 {
		escrowMonthly = (app.Property.PurchasePrice * 0.001 / 12) + (app.Property.InsurancePremium / 12)
	}

	// Generate new schedule with same tenor but lower payment
	return generateAmortizationSchedule(newBalance, app.InterestRate, remainingPayments, escrowMonthly, nil)
}

// curtailRepaymentSchedule recalculates schedule after prepayment (same payment, shorter tenor)
func curtailRepaymentSchedule(app *MortgageApplication, prepaymentAmount float64) []ScheduleEntry {
	// Get current balance
	currentBalance, _ := tbClient.GetAccountBalance(app.PrincipalAccountID)
	newBalance := currentBalance - prepaymentAmount

	// Calculate new tenor with same payment
	newTenor := calculateNewTenor(newBalance, app.InterestRate, app.MonthlyPayment)

	// Get escrow contribution
	escrowMonthly := 0.0
	if app.Property.PurchasePrice > 0 {
		escrowMonthly = (app.Property.PurchasePrice * 0.001 / 12) + (app.Property.InsurancePremium / 12)
	}

	// Generate new schedule with shorter tenor
	return generateAmortizationSchedule(newBalance, app.InterestRate, newTenor, escrowMonthly, nil)
}

// calculateRemainingPayments calculates remaining payments on a mortgage
func calculateRemainingPayments(app *MortgageApplication) int {
	if app.MaturityDate == nil {
		return app.ApprovedTenorMonths
	}

	now := time.Now()
	months := 0
	current := now

	for current.Before(*app.MaturityDate) {
		months++
		current = current.AddDate(0, 1, 0)
	}

	return months
}

// calculateNewTenor calculates new tenor given balance, rate, and payment
func calculateNewTenor(balance, annualRate, monthlyPayment float64) int {
	if monthlyPayment <= 0 || balance <= 0 {
		return 0
	}

	monthlyRate := annualRate / 12.0 / 100.0

	// n = -log(1 - (r * P) / M) / log(1 + r)
	// where P = principal, M = monthly payment, r = monthly rate
	if monthlyRate == 0 {
		return int(balance / monthlyPayment)
	}

	numerator := 1 - (monthlyRate * balance / monthlyPayment)
	if numerator <= 0 {
		return 360 // Max 30 years
	}

	tenor := -math.Log(numerator) / math.Log(1+monthlyRate)
	return int(math.Ceil(tenor))
}

// calculatePrepaymentFee calculates prepayment penalty
func calculatePrepaymentFee(app *MortgageApplication, prepaymentAmount float64) float64 {
	// Check if prepayment fee applies
	// Typically waived after certain period or for NHF loans
	if app.ProductType == ProductNHFBacked || app.ProductType == ProductFMBNBacked {
		return 0 // No prepayment fee for government-backed loans
	}

	// Check loan age
	if app.DisbursedAt != nil {
		loanAge := time.Since(*app.DisbursedAt)
		if loanAge > 3*365*24*time.Hour { // After 3 years
			return 0
		}
	}

	// Standard prepayment fee: 2% of prepayment amount in first year,
	// 1% in second year, 0.5% in third year
	feeRate := 0.02
	if app.DisbursedAt != nil {
		loanAge := time.Since(*app.DisbursedAt)
		if loanAge > 2*365*24*time.Hour {
			feeRate = 0.005
		} else if loanAge > 365*24*time.Hour {
			feeRate = 0.01
		}
	}

	return roundToKobo(prepaymentAmount * feeRate)
}

// generateOfferLetter generates a mortgage offer letter
func generateOfferLetter(app *MortgageApplication) *OfferLetter {
	// Calculate monthly payment
	monthlyPayment := calculateMonthlyPayment(app.ApprovedAmount, app.InterestRate, app.ApprovedTenorMonths)

	// Calculate total repayment
	totalRepayment := monthlyPayment * float64(app.ApprovedTenorMonths)

	// Calculate total interest
	totalInterest := totalRepayment - app.ApprovedAmount

	// Calculate maturity date
	maturityDate := time.Now().AddDate(0, app.ApprovedTenorMonths, 0)

	// Offer validity (30 days)
	offerExpiry := time.Now().AddDate(0, 0, 30)

	offer := &OfferLetter{
		ID:                generateID("OFR"),
		ApplicationID:     app.ID,
		ApplicationNumber: app.ApplicationNumber,
		ApplicantName:     app.PrimaryApplicantName,
		ProductType:       app.ProductType,

		// Loan Terms
		ApprovedAmount:   app.ApprovedAmount,
		InterestRate:     app.InterestRate,
		InterestRateType: app.InterestRateType,
		TenorMonths:      app.ApprovedTenorMonths,
		MonthlyPayment:   roundToKobo(monthlyPayment),
		TotalRepayment:   roundToKobo(totalRepayment),
		TotalInterest:    roundToKobo(totalInterest),

		// Property
		PropertyAddress: app.Property.Address,
		PropertyValue:   app.Property.MarketValue,
		LTVRatio:        app.LTVRatio,

		// Dates
		OfferDate:        time.Now(),
		OfferExpiry:      offerExpiry,
		ExpectedMaturity: maturityDate,

		// Conditions
		Conditions: generateOfferConditions(app),

		// Fees
		ProcessingFee:    roundToKobo(app.ApprovedAmount * 0.01),  // 1% processing fee
		LegalFee:         roundToKobo(app.ApprovedAmount * 0.005), // 0.5% legal fee
		ValuationFee:     50000,                                   // Fixed valuation fee
		InsurancePremium: app.Property.InsurancePremium,

		Status: "issued",
	}

	return offer
}

// OfferLetter represents a mortgage offer letter
type OfferLetter struct {
	ID                string              `json:"id"`
	ApplicationID     string              `json:"application_id"`
	ApplicationNumber string              `json:"application_number"`
	ApplicantName     string              `json:"applicant_name"`
	ProductType       MortgageProductType `json:"product_type"`

	// Loan Terms
	ApprovedAmount   float64 `json:"approved_amount"`
	InterestRate     float64 `json:"interest_rate"`
	InterestRateType string  `json:"interest_rate_type"`
	TenorMonths      int     `json:"tenor_months"`
	MonthlyPayment   float64 `json:"monthly_payment"`
	TotalRepayment   float64 `json:"total_repayment"`
	TotalInterest    float64 `json:"total_interest"`

	// Property
	PropertyAddress string  `json:"property_address"`
	PropertyValue   float64 `json:"property_value"`
	LTVRatio        float64 `json:"ltv_ratio"`

	// Dates
	OfferDate        time.Time `json:"offer_date"`
	OfferExpiry      time.Time `json:"offer_expiry"`
	ExpectedMaturity time.Time `json:"expected_maturity"`

	// Conditions
	Conditions []string `json:"conditions"`

	// Fees
	ProcessingFee    float64 `json:"processing_fee"`
	LegalFee         float64 `json:"legal_fee"`
	ValuationFee     float64 `json:"valuation_fee"`
	InsurancePremium float64 `json:"insurance_premium"`
	TotalFees        float64 `json:"total_fees"`

	Status string `json:"status"`
}

func generateOfferConditions(app *MortgageApplication) []string {
	conditions := []string{
		"Valid government-issued ID required",
		"Proof of income (3 months payslips or audited accounts)",
		"Bank statements for the last 6 months",
		"Property insurance must be maintained throughout the loan term",
		"The property must be used as collateral for this loan",
	}

	// Property-specific conditions
	if app.Property.TitleStatus != TitleVerified {
		conditions = append(conditions, "Title verification must be completed before disbursement")
	}

	if app.Property.TitleStatus != TitleCofO && app.Property.TitleStatus != TitleGovernorConsent {
		conditions = append(conditions, "Certificate of Occupancy or Governor's Consent required")
	}

	// NHF-specific conditions
	if app.ProductType == ProductNHFBacked {
		conditions = append(conditions, "NHF contribution verification required")
		conditions = append(conditions, "Property must be for owner-occupation only")
	}

	// LTV-specific conditions
	if app.LTVRatio > 0.80 {
		conditions = append(conditions, "Mortgage insurance (PMI) required due to LTV > 80%")
	}

	// Employment-specific conditions
	if app.EmploymentType == "self_employed" {
		conditions = append(conditions, "2 years audited financial statements required")
		conditions = append(conditions, "Business registration documents required")
	}

	return conditions
}

// NHF Integration
type NHFVerificationResult struct {
	IsContributor        bool      `json:"is_contributor"`
	AccountNumber        string    `json:"account_number"`
	ContributionMonths   int       `json:"contribution_months"`
	Balance              float64   `json:"balance"`
	EmployerName         string    `json:"employer_name"`
	EmployerCode         string    `json:"employer_code"`
	LastContributionDate time.Time `json:"last_contribution_date"`
	EligibleLoanAmount   float64   `json:"eligible_loan_amount"`
	Message              string    `json:"message"`
}

// verifyNHFContributionExternal simulates NHF verification API call
func verifyNHFContributionExternal(accountNumber, employerCode string) *NHFVerificationResult {
	// In production, this would call the actual NHF API
	// For now, simulate a successful verification

	// Simulate contribution history
	contributionMonths := 24       // 2 years of contributions
	monthlyContribution := 25000.0 // Average monthly contribution
	balance := monthlyContribution * float64(contributionMonths)

	// NHF typically allows 3x contribution as loan
	eligibleAmount := balance * 3

	return &NHFVerificationResult{
		IsContributor:        true,
		AccountNumber:        accountNumber,
		ContributionMonths:   contributionMonths,
		Balance:              balance,
		EmployerName:         "Sample Employer Ltd",
		EmployerCode:         employerCode,
		LastContributionDate: time.Now().AddDate(0, -1, 0),
		EligibleLoanAmount:   eligibleAmount,
		Message:              "NHF contribution verified successfully",
	}
}

// Helper functions
func roundToKobo(amount float64) float64 {
	return math.Round(amount*100) / 100
}

// Interest rate calculation for variable rate mortgages
type RateChangeEvent struct {
	ID            string    `json:"id"`
	MortgageID    string    `json:"mortgage_id"`
	OldRate       float64   `json:"old_rate"`
	NewRate       float64   `json:"new_rate"`
	EffectiveDate time.Time `json:"effective_date"`
	Reason        string    `json:"reason"`
	BaseRate      float64   `json:"base_rate"`
	Margin        float64   `json:"margin"`
}

// calculateVariableRate calculates rate for variable rate mortgages
func calculateVariableRate(baseRate, margin float64) float64 {
	return baseRate + margin
}

// applyRateChange applies a rate change to a mortgage
func applyRateChange(app *MortgageApplication, newBaseRate float64) (*RateChangeEvent, error) {
	oldRate := app.InterestRate
	newRate := calculateVariableRate(newBaseRate, app.Margin)

	event := &RateChangeEvent{
		ID:            generateID("RCE"),
		MortgageID:    app.ID,
		OldRate:       oldRate,
		NewRate:       newRate,
		EffectiveDate: time.Now(),
		Reason:        "Base rate adjustment",
		BaseRate:      newBaseRate,
		Margin:        app.Margin,
	}

	// Update application
	app.InterestRate = newRate
	app.BaseRate = newBaseRate

	// Recalculate monthly payment
	balance, _ := tbClient.GetAccountBalance(app.PrincipalAccountID)
	remainingPayments := calculateRemainingPayments(app)
	app.MonthlyPayment = calculateMonthlyPayment(balance, newRate, remainingPayments)

	return event, nil
}

// IFRS 9 Staging for mortgage portfolio
type IFRS9Stage int

const (
	Stage1 IFRS9Stage = 1 // Performing
	Stage2 IFRS9Stage = 2 // Underperforming (significant increase in credit risk)
	Stage3 IFRS9Stage = 3 // Non-performing (credit impaired)
)

// MortgageIFRS9Classification represents IFRS 9 classification
type MortgageIFRS9Classification struct {
	MortgageID           string     `json:"mortgage_id"`
	Stage                IFRS9Stage `json:"stage"`
	DaysPastDue          int        `json:"days_past_due"`
	ProbabilityOfDefault float64    `json:"probability_of_default"`
	LossGivenDefault     float64    `json:"loss_given_default"`
	ExposureAtDefault    float64    `json:"exposure_at_default"`
	ExpectedCreditLoss   float64    `json:"expected_credit_loss"`
	ClassificationDate   time.Time  `json:"classification_date"`
	Reason               string     `json:"reason"`
}

// classifyMortgageIFRS9 classifies a mortgage under IFRS 9. The exposure at
// default is read from the real ledger; when the balance cannot be read the
// classification is refused (error) rather than computed against a fabricated
// zero exposure.
func classifyMortgageIFRS9(app *MortgageApplication, daysPastDue int) (*MortgageIFRS9Classification, error) {
	classification := &MortgageIFRS9Classification{
		MortgageID:         app.ID,
		DaysPastDue:        daysPastDue,
		ClassificationDate: time.Now(),
	}

	// Determine stage based on days past due and other factors
	switch {
	case daysPastDue >= 90:
		classification.Stage = Stage3
		classification.Reason = "Credit impaired - 90+ days past due"
		classification.ProbabilityOfDefault = 0.50
		classification.LossGivenDefault = 0.45
	case daysPastDue >= 30 || app.RiskScore > 0.5:
		classification.Stage = Stage2
		classification.Reason = "Significant increase in credit risk"
		classification.ProbabilityOfDefault = 0.15
		classification.LossGivenDefault = 0.35
	default:
		classification.Stage = Stage1
		classification.Reason = "Performing"
		classification.ProbabilityOfDefault = app.RiskScore * 0.1
		classification.LossGivenDefault = 0.25
	}

	// Calculate EAD (Exposure at Default) — a financial read; errors propagate.
	balance, err := tbClient.GetAccountBalance(app.PrincipalAccountID)
	if err != nil {
		return nil, fmt.Errorf("ifrs9 classification: read exposure for %s: %w", app.ID, err)
	}
	classification.ExposureAtDefault = balance

	// Calculate ECL (Expected Credit Loss)
	// For Stage 1: 12-month ECL
	// For Stage 2 & 3: Lifetime ECL
	if classification.Stage == Stage1 {
		// 12-month ECL
		classification.ExpectedCreditLoss = classification.ExposureAtDefault *
			classification.ProbabilityOfDefault *
			classification.LossGivenDefault
	} else {
		// Lifetime ECL (simplified - multiply by remaining years)
		remainingYears := float64(calculateRemainingPayments(app)) / 12.0
		classification.ExpectedCreditLoss = classification.ExposureAtDefault *
			classification.ProbabilityOfDefault *
			classification.LossGivenDefault *
			remainingYears
	}

	return classification, nil
}
