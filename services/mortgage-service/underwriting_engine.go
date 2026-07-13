package main

import (
	"fmt"
	"math"
	// "time"
)

// MortgageUnderwritingEngine handles mortgage credit assessment
type MortgageUnderwritingEngine struct {
	// CBN-compliant limits
	maxLTVOwnerOccupied float64
	maxLTVInvestment    float64
	maxLTVBuyToLet      float64
	maxDTI              float64
	maxDSTI             float64 // Debt Service to Income
	minCreditScore      int
	minEmploymentMonths int
	minNHFContribMonths int

	// Product-specific configs
	productConfigs map[MortgageProductType]*ProductConfig
}

// ProductConfig holds product-specific underwriting parameters
type ProductConfig struct {
	ProductType        MortgageProductType
	MinAmount          float64
	MaxAmount          float64
	MinTenorMonths     int
	MaxTenorMonths     int
	BaseRate           float64
	MaxLTV             float64
	MaxDTI             float64
	RequiresCollateral bool
	RequiresNHF        bool
	RequiresValuation  bool
}

// UnderwritingDecision represents the underwriting decision
type UnderwritingDecision struct {
	Decision        string   `json:"decision"` // APPROVED, DECLINED, REFER
	ApprovedAmount  float64  `json:"approved_amount"`
	ApprovedTenor   int      `json:"approved_tenor"`
	InterestRate    float64  `json:"interest_rate"`
	MonthlyPayment  float64  `json:"monthly_payment"`
	CreditScore     int      `json:"credit_score"`
	DTIRatio        float64  `json:"dti_ratio"`
	DSTIRatio       float64  `json:"dsti_ratio"`
	LTVRatio        float64  `json:"ltv_ratio"`
	RiskScore       float64  `json:"risk_score"`
	RiskGrade       string   `json:"risk_grade"`
	PD              float64  `json:"probability_of_default"`
	LGD             float64  `json:"loss_given_default"`
	EL              float64  `json:"expected_loss"`
	Conditions      []string `json:"conditions"`
	DeclineReasons  []string `json:"decline_reasons"`
	ReferReasons    []string `json:"refer_reasons"`
	Recommendations []string `json:"recommendations"`
}

// PreQualificationResult represents pre-qualification assessment
type PreQualificationResult struct {
	Qualified           bool     `json:"qualified"`
	MaxLoanAmount       float64  `json:"max_loan_amount"`
	MaxMonthlyPayment   float64  `json:"max_monthly_payment"`
	EstimatedRate       float64  `json:"estimated_rate"`
	EstimatedTenor      int      `json:"estimated_tenor"`
	RequiredDownPayment float64  `json:"required_down_payment"`
	Reasons             []string `json:"reasons"`
	NextSteps           []string `json:"next_steps"`
}

// NewMortgageUnderwritingEngine creates a new underwriting engine
func NewMortgageUnderwritingEngine() *MortgageUnderwritingEngine {
	engine := &MortgageUnderwritingEngine{
		// CBN guidelines for mortgage lending
		maxLTVOwnerOccupied: 0.80, // 80% LTV for owner-occupied
		maxLTVInvestment:    0.70, // 70% LTV for investment
		maxLTVBuyToLet:      0.65, // 65% LTV for buy-to-let
		maxDTI:              0.40, // 40% DTI
		maxDSTI:             0.33, // 33% DSTI (mortgage payment only)
		minCreditScore:      600,
		minEmploymentMonths: 12,
		minNHFContribMonths: 6,
		productConfigs:      make(map[MortgageProductType]*ProductConfig),
	}

	// Initialize product configs
	engine.initProductConfigs()

	return engine
}

func (e *MortgageUnderwritingEngine) initProductConfigs() {
	// Fixed Rate Mortgage
	e.productConfigs[ProductFixedRate] = &ProductConfig{
		ProductType:        ProductFixedRate,
		MinAmount:          5000000,   // 5M NGN
		MaxAmount:          500000000, // 500M NGN
		MinTenorMonths:     60,        // 5 years
		MaxTenorMonths:     300,       // 25 years
		BaseRate:           18.0,
		MaxLTV:             0.80,
		MaxDTI:             0.40,
		RequiresCollateral: true,
		RequiresValuation:  true,
	}

	// Variable Rate Mortgage
	e.productConfigs[ProductVariableRate] = &ProductConfig{
		ProductType:        ProductVariableRate,
		MinAmount:          5000000,
		MaxAmount:          500000000,
		MinTenorMonths:     60,
		MaxTenorMonths:     300,
		BaseRate:           16.0, // Lower base, but variable
		MaxLTV:             0.80,
		MaxDTI:             0.40,
		RequiresCollateral: true,
		RequiresValuation:  true,
	}

	// NHF-Backed Mortgage
	e.productConfigs[ProductNHFBacked] = &ProductConfig{
		ProductType:        ProductNHFBacked,
		MinAmount:          2000000,  // Lower minimum
		MaxAmount:          50000000, // 50M NGN (NHF limit)
		MinTenorMonths:     60,
		MaxTenorMonths:     360,  // 30 years
		BaseRate:           6.0,  // Subsidized rate
		MaxLTV:             0.90, // Higher LTV allowed
		MaxDTI:             0.45, // Slightly higher DTI
		RequiresCollateral: true,
		RequiresNHF:        true,
		RequiresValuation:  true,
	}

	// FMBN-Backed Mortgage
	e.productConfigs[ProductFMBNBacked] = &ProductConfig{
		ProductType:        ProductFMBNBacked,
		MinAmount:          2000000,
		MaxAmount:          100000000,
		MinTenorMonths:     60,
		MaxTenorMonths:     360,
		BaseRate:           9.0,
		MaxLTV:             0.85,
		MaxDTI:             0.45,
		RequiresCollateral: true,
		RequiresValuation:  true,
	}

	// Construction Loan
	e.productConfigs[ProductConstructionLoan] = &ProductConfig{
		ProductType:        ProductConstructionLoan,
		MinAmount:          10000000,
		MaxAmount:          1000000000,
		MinTenorMonths:     12,
		MaxTenorMonths:     36, // Shorter tenor
		BaseRate:           20.0,
		MaxLTV:             0.70,
		MaxDTI:             0.35,
		RequiresCollateral: true,
		RequiresValuation:  true,
	}

	// Equity Release
	e.productConfigs[ProductEquityRelease] = &ProductConfig{
		ProductType:        ProductEquityRelease,
		MinAmount:          5000000,
		MaxAmount:          200000000,
		MinTenorMonths:     60,
		MaxTenorMonths:     180,
		BaseRate:           19.0,
		MaxLTV:             0.60, // Lower LTV for equity release
		MaxDTI:             0.35,
		RequiresCollateral: true,
		RequiresValuation:  true,
	}

	// Buy-to-Let
	e.productConfigs[ProductBuyToLet] = &ProductConfig{
		ProductType:        ProductBuyToLet,
		MinAmount:          10000000,
		MaxAmount:          300000000,
		MinTenorMonths:     60,
		MaxTenorMonths:     240,
		BaseRate:           20.0,
		MaxLTV:             0.65,
		MaxDTI:             0.35,
		RequiresCollateral: true,
		RequiresValuation:  true,
	}
}

// Underwrite performs full underwriting assessment
func (e *MortgageUnderwritingEngine) Underwrite(app *MortgageApplication) *UnderwritingDecision {
	decision := &UnderwritingDecision{
		Conditions:      []string{},
		DeclineReasons:  []string{},
		ReferReasons:    []string{},
		Recommendations: []string{},
	}

	// Get product config
	config, ok := e.productConfigs[app.ProductType]
	if !ok {
		decision.Decision = "DECLINED"
		decision.DeclineReasons = append(decision.DeclineReasons, "Invalid product type")
		return decision
	}

	// Step 1: Identity Verification
	if !e.verifyIdentity(app, decision) {
		decision.Decision = "DECLINED"
		return decision
	}

	// Step 2: Credit Score Assessment
	decision.CreditScore = app.CreditScore
	if !e.assessCreditScore(app, decision) {
		decision.Decision = "DECLINED"
		return decision
	}

	// Step 3: Income and Affordability Assessment
	if !e.assessAffordability(app, config, decision) {
		decision.Decision = "DECLINED"
		return decision
	}

	// Step 4: Collateral and LTV Assessment
	if !e.assessCollateral(app, config, decision) {
		decision.Decision = "DECLINED"
		return decision
	}

	// Step 5: Employment Stability
	if !e.assessEmployment(app, decision) {
		decision.Decision = "REFER"
		decision.ReferReasons = append(decision.ReferReasons, "Employment stability requires review")
	}

	// Step 6: NHF Verification (if applicable)
	if config.RequiresNHF && !e.verifyNHF(app, decision) {
		decision.Decision = "DECLINED"
		return decision
	}

	// Step 7: Calculate Risk Metrics
	e.calculateRiskMetrics(app, config, decision)

	// Step 8: Determine Final Decision
	e.makeFinalDecision(app, config, decision)

	// Step 9: Calculate Pricing
	if decision.Decision == "APPROVED" || decision.Decision == "REFER" {
		e.calculatePricing(app, config, decision)
	}

	return decision
}

func (e *MortgageUnderwritingEngine) verifyIdentity(app *MortgageApplication, decision *UnderwritingDecision) bool {
	if app.PrimaryApplicantBVN == "" {
		decision.DeclineReasons = append(decision.DeclineReasons, "BVN not provided")
		return false
	}
	if app.PrimaryApplicantNIN == "" {
		decision.DeclineReasons = append(decision.DeclineReasons, "NIN not provided")
		return false
	}
	decision.Conditions = append(decision.Conditions, "Identity verified via BVN/NIN")
	return true
}

func (e *MortgageUnderwritingEngine) assessCreditScore(app *MortgageApplication, decision *UnderwritingDecision) bool {
	if app.CreditScore < e.minCreditScore {
		decision.DeclineReasons = append(decision.DeclineReasons,
			fmt.Sprintf("Credit score %d below minimum %d", app.CreditScore, e.minCreditScore))
		return false
	}

	// Risk grade based on credit score
	switch {
	case app.CreditScore >= 750:
		decision.RiskGrade = "A"
		decision.Conditions = append(decision.Conditions, "Excellent credit score")
	case app.CreditScore >= 700:
		decision.RiskGrade = "B"
		decision.Conditions = append(decision.Conditions, "Good credit score")
	case app.CreditScore >= 650:
		decision.RiskGrade = "C"
		decision.Conditions = append(decision.Conditions, "Fair credit score - higher rate may apply")
	default:
		decision.RiskGrade = "D"
		decision.Conditions = append(decision.Conditions, "Below average credit score - additional conditions apply")
	}

	return true
}

func (e *MortgageUnderwritingEngine) assessAffordability(app *MortgageApplication, config *ProductConfig, decision *UnderwritingDecision) bool {
	// Calculate total monthly income (including joint applicants)
	totalIncome := app.TotalMonthlyIncome
	if totalIncome == 0 {
		totalIncome = app.MonthlyGrossIncome + app.OtherIncome
	}

	if totalIncome <= 0 {
		decision.DeclineReasons = append(decision.DeclineReasons, "Insufficient income information")
		return false
	}

	// Calculate estimated monthly payment
	estimatedPayment := calculateMonthlyPayment(app.RequestedAmount, config.BaseRate, app.RequestedTenorMonths)

	// Calculate DTI (all debts / income)
	totalObligations := app.TotalMonthlyObligations
	if totalObligations == 0 {
		totalObligations = app.ExistingLoanPayments + app.CreditCardPayments + app.OtherObligations
	}

	dti := (totalObligations + estimatedPayment) / totalIncome
	decision.DTIRatio = dti

	// Calculate DSTI (mortgage payment only / income)
	dsti := estimatedPayment / totalIncome
	decision.DSTIRatio = dsti

	// Check DTI limit
	if dti > config.MaxDTI {
		decision.DeclineReasons = append(decision.DeclineReasons,
			fmt.Sprintf("DTI ratio %.1f%% exceeds maximum %.1f%%", dti*100, config.MaxDTI*100))
		return false
	}

	// Check DSTI limit
	if dsti > e.maxDSTI {
		decision.DeclineReasons = append(decision.DeclineReasons,
			fmt.Sprintf("DSTI ratio %.1f%% exceeds maximum %.1f%%", dsti*100, e.maxDSTI*100))
		return false
	}

	// Stress test at higher rate (+2%)
	stressPayment := calculateMonthlyPayment(app.RequestedAmount, config.BaseRate+2.0, app.RequestedTenorMonths)
	stressDSTI := stressPayment / totalIncome
	if stressDSTI > 0.40 {
		decision.Conditions = append(decision.Conditions,
			fmt.Sprintf("Stress test warning: DSTI at +2%% rate would be %.1f%%", stressDSTI*100))
	}

	decision.Conditions = append(decision.Conditions,
		fmt.Sprintf("Affordability verified: DTI %.1f%%, DSTI %.1f%%", dti*100, dsti*100))

	return true
}

func (e *MortgageUnderwritingEngine) assessCollateral(app *MortgageApplication, config *ProductConfig, decision *UnderwritingDecision) bool {
	if !config.RequiresCollateral {
		return true
	}

	propertyValue := app.Property.MarketValue
	if propertyValue == 0 {
		propertyValue = app.Property.PurchasePrice
	}

	if propertyValue <= 0 {
		decision.DeclineReasons = append(decision.DeclineReasons, "Property valuation required")
		return false
	}

	// Calculate LTV
	effectiveLoan := app.RequestedAmount
	if app.DownPayment > 0 {
		effectiveLoan = propertyValue - app.DownPayment
	}

	ltv := effectiveLoan / propertyValue
	decision.LTVRatio = ltv

	// Determine max LTV based on occupancy type
	maxLTV := config.MaxLTV
	switch app.Property.OccupancyType {
	case OccupancyInvestment:
		maxLTV = e.maxLTVInvestment
	case OccupancyBuyToLet:
		maxLTV = e.maxLTVBuyToLet
	}

	if ltv > maxLTV {
		decision.DeclineReasons = append(decision.DeclineReasons,
			fmt.Sprintf("LTV ratio %.1f%% exceeds maximum %.1f%%", ltv*100, maxLTV*100))
		return false
	}

	// Check title status
	if app.Property.TitleStatus == TitleDisputed {
		decision.DeclineReasons = append(decision.DeclineReasons, "Property title is disputed")
		return false
	}

	if app.Property.TitleStatus != TitleVerified && app.Property.TitleStatus != TitleCofO {
		decision.Conditions = append(decision.Conditions, "Title verification required before disbursement")
	}

	// PMI requirement for high LTV
	if ltv > 0.80 {
		decision.Conditions = append(decision.Conditions, "Mortgage insurance (PMI) required")
	}

	decision.Conditions = append(decision.Conditions,
		fmt.Sprintf("Collateral verified: LTV %.1f%%", ltv*100))

	return true
}

func (e *MortgageUnderwritingEngine) assessEmployment(app *MortgageApplication, decision *UnderwritingDecision) bool {
	if app.EmploymentType == "unemployed" {
		decision.DeclineReasons = append(decision.DeclineReasons, "Applicant is unemployed")
		return false
	}

	if app.EmploymentDuration < e.minEmploymentMonths {
		decision.ReferReasons = append(decision.ReferReasons,
			fmt.Sprintf("Employment duration %d months below minimum %d months",
				app.EmploymentDuration, e.minEmploymentMonths))
		return false
	}

	// Self-employed requires additional documentation
	if app.EmploymentType == "self_employed" {
		decision.Conditions = append(decision.Conditions,
			"Self-employed: 2 years audited accounts required")
	}

	if app.EmploymentDuration >= 36 {
		decision.Conditions = append(decision.Conditions, "Stable employment history (3+ years)")
	}

	return true
}

func (e *MortgageUnderwritingEngine) verifyNHF(app *MortgageApplication, decision *UnderwritingDecision) bool {
	if !app.NHFContributor {
		decision.DeclineReasons = append(decision.DeclineReasons,
			"NHF contribution required for this product")
		return false
	}

	if app.NHFContributionMonths < e.minNHFContribMonths {
		decision.DeclineReasons = append(decision.DeclineReasons,
			fmt.Sprintf("NHF contribution %d months below minimum %d months",
				app.NHFContributionMonths, e.minNHFContribMonths))
		return false
	}

	// Check NHF loan limit (typically 3x contribution)
	maxNHFLoan := app.NHFBalance * 3
	if app.RequestedAmount > maxNHFLoan {
		decision.Conditions = append(decision.Conditions,
			fmt.Sprintf("Requested amount exceeds NHF limit of %.2f NGN", maxNHFLoan))
	}

	decision.Conditions = append(decision.Conditions,
		fmt.Sprintf("NHF verified: %d months contribution, balance %.2f NGN",
			app.NHFContributionMonths, app.NHFBalance))

	return true
}

func (e *MortgageUnderwritingEngine) calculateRiskMetrics(app *MortgageApplication, config *ProductConfig, decision *UnderwritingDecision) {
	// Calculate composite risk score (0-1 scale)
	creditScoreRisk := 1.0 - ((float64(app.CreditScore) - 300.0) / 550.0)
	dtiRisk := decision.DTIRatio / config.MaxDTI
	ltvRisk := decision.LTVRatio / config.MaxLTV
	employmentRisk := 1.0 - math.Min(float64(app.EmploymentDuration)/36.0, 1.0)

	// Weighted risk score
	riskScore := (creditScoreRisk * 0.35) +
		(dtiRisk * 0.25) +
		(ltvRisk * 0.25) +
		(employmentRisk * 0.15)

	decision.RiskScore = math.Min(riskScore, 1.0)

	// Calculate Probability of Default (PD) using logistic function
	decision.PD = 1.0 / (1.0 + math.Exp(-8.0*(decision.RiskScore-0.4)))

	// Calculate Loss Given Default (LGD) based on LTV
	// Higher LTV = higher LGD
	decision.LGD = math.Min(decision.LTVRatio*0.8, 0.60) // Cap at 60%

	// Calculate Expected Loss (EL = PD * LGD * EAD)
	decision.EL = decision.PD * decision.LGD * app.RequestedAmount
}

func (e *MortgageUnderwritingEngine) makeFinalDecision(app *MortgageApplication, config *ProductConfig, decision *UnderwritingDecision) {
	// If already declined, return
	if decision.Decision == "DECLINED" {
		return
	}

	// Check for refer conditions
	if len(decision.ReferReasons) > 0 {
		decision.Decision = "REFER"
		decision.Recommendations = append(decision.Recommendations,
			"Manual review required by credit committee")
		return
	}

	// Risk-based decision
	switch {
	case decision.RiskScore < 0.25:
		decision.Decision = "APPROVED"
		decision.ApprovedAmount = app.RequestedAmount
		decision.ApprovedTenor = app.RequestedTenorMonths
	case decision.RiskScore < 0.40:
		decision.Decision = "APPROVED"
		decision.ApprovedAmount = app.RequestedAmount * 0.90 // 10% reduction
		decision.ApprovedTenor = app.RequestedTenorMonths
		decision.Conditions = append(decision.Conditions, "Loan amount reduced by 10% due to risk assessment")
	case decision.RiskScore < 0.55:
		decision.Decision = "REFER"
		decision.ApprovedAmount = app.RequestedAmount * 0.80
		decision.ApprovedTenor = app.RequestedTenorMonths
		decision.ReferReasons = append(decision.ReferReasons, "Elevated risk score requires committee review")
	default:
		decision.Decision = "DECLINED"
		decision.DeclineReasons = append(decision.DeclineReasons, "Risk score exceeds acceptable threshold")
	}

	// Validate against product limits
	if decision.ApprovedAmount < config.MinAmount {
		decision.Decision = "DECLINED"
		decision.DeclineReasons = append(decision.DeclineReasons,
			fmt.Sprintf("Approved amount below minimum %.2f NGN", config.MinAmount))
	}
	if decision.ApprovedAmount > config.MaxAmount {
		decision.ApprovedAmount = config.MaxAmount
		decision.Conditions = append(decision.Conditions,
			fmt.Sprintf("Amount capped at product maximum %.2f NGN", config.MaxAmount))
	}
}

func (e *MortgageUnderwritingEngine) calculatePricing(app *MortgageApplication, config *ProductConfig, decision *UnderwritingDecision) {
	baseRate := config.BaseRate

	// Risk-based pricing adjustment
	var riskPremium float64
	switch decision.RiskGrade {
	case "A":
		riskPremium = 0
	case "B":
		riskPremium = 0.5
	case "C":
		riskPremium = 1.5
	case "D":
		riskPremium = 3.0
	}

	// LTV adjustment
	var ltvPremium float64
	if decision.LTVRatio > 0.80 {
		ltvPremium = 0.5
	} else if decision.LTVRatio > 0.70 {
		ltvPremium = 0.25
	}

	// Tenor adjustment (longer tenor = slightly higher rate)
	var tenorPremium float64
	if decision.ApprovedTenor > 240 {
		tenorPremium = 0.5
	} else if decision.ApprovedTenor > 180 {
		tenorPremium = 0.25
	}

	// Final rate
	decision.InterestRate = baseRate + riskPremium + ltvPremium + tenorPremium

	// Cap rate
	decision.InterestRate = math.Max(6.0, math.Min(decision.InterestRate, 30.0))

	// Calculate monthly payment
	decision.MonthlyPayment = calculateMonthlyPayment(
		decision.ApprovedAmount,
		decision.InterestRate,
		decision.ApprovedTenor,
	)
}

// PreQualify performs quick pre-qualification assessment
func (e *MortgageUnderwritingEngine) PreQualify(app *MortgageApplication) *PreQualificationResult {
	result := &PreQualificationResult{
		Qualified: true,
		Reasons:   []string{},
		NextSteps: []string{},
	}

	config, ok := e.productConfigs[app.ProductType]
	if !ok {
		result.Qualified = false
		result.Reasons = append(result.Reasons, "Invalid product type")
		return result
	}

	// Quick income check
	totalIncome := app.MonthlyGrossIncome + app.OtherIncome
	if totalIncome <= 0 {
		result.Qualified = false
		result.Reasons = append(result.Reasons, "Income information required")
		return result
	}

	// Calculate max affordable payment (using DSTI limit)
	maxPayment := totalIncome * e.maxDSTI
	result.MaxMonthlyPayment = maxPayment

	// Calculate max loan amount
	result.EstimatedRate = config.BaseRate
	result.EstimatedTenor = app.RequestedTenorMonths
	if result.EstimatedTenor == 0 {
		result.EstimatedTenor = 240 // Default 20 years
	}

	result.MaxLoanAmount = calculateMaxLoanAmount(maxPayment, result.EstimatedRate, result.EstimatedTenor)

	// Check if requested amount is within limit
	if app.RequestedAmount > result.MaxLoanAmount {
		result.Qualified = false
		result.Reasons = append(result.Reasons,
			fmt.Sprintf("Requested amount %.2f exceeds maximum affordable %.2f",
				app.RequestedAmount, result.MaxLoanAmount))
	}

	// Calculate required down payment
	if app.Property.PurchasePrice > 0 {
		minEquity := app.Property.PurchasePrice * (1 - config.MaxLTV)
		result.RequiredDownPayment = minEquity

		if app.DownPayment < minEquity {
			result.Reasons = append(result.Reasons,
				fmt.Sprintf("Down payment %.2f below required %.2f", app.DownPayment, minEquity))
		}
	}

	// Next steps
	if result.Qualified {
		result.NextSteps = append(result.NextSteps, "Submit full application with supporting documents")
		result.NextSteps = append(result.NextSteps, "Provide property details and valuation")
		if config.RequiresNHF {
			result.NextSteps = append(result.NextSteps, "Verify NHF contribution status")
		}
	} else {
		result.NextSteps = append(result.NextSteps, "Consider lower loan amount or longer tenor")
		result.NextSteps = append(result.NextSteps, "Increase down payment to reduce loan amount")
	}

	return result
}

// Helper function to perform pre-qualification
func performPreQualification(app *MortgageApplication) *PreQualificationResult {
	engine := NewMortgageUnderwritingEngine()
	return engine.PreQualify(app)
}

// calculateMonthlyPayment calculates monthly payment using amortization formula
func calculateMonthlyPayment(principal, annualRate float64, termMonths int) float64 {
	if termMonths <= 0 || principal <= 0 {
		return 0
	}

	monthlyRate := annualRate / 12.0 / 100.0
	if monthlyRate == 0 {
		return principal / float64(termMonths)
	}

	// M = P * [r(1+r)^n] / [(1+r)^n - 1]
	payment := principal * (monthlyRate * math.Pow(1+monthlyRate, float64(termMonths))) /
		(math.Pow(1+monthlyRate, float64(termMonths)) - 1)

	return payment
}

// calculateMaxLoanAmount calculates maximum loan amount for given payment
func calculateMaxLoanAmount(maxPayment, annualRate float64, termMonths int) float64 {
	if termMonths <= 0 || maxPayment <= 0 {
		return 0
	}

	monthlyRate := annualRate / 12.0 / 100.0
	if monthlyRate == 0 {
		return maxPayment * float64(termMonths)
	}

	// P = M * [(1+r)^n - 1] / [r(1+r)^n]
	principal := maxPayment * (math.Pow(1+monthlyRate, float64(termMonths)) - 1) /
		(monthlyRate * math.Pow(1+monthlyRate, float64(termMonths)))

	return principal
}
