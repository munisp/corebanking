package main

import (
	"fmt"
	"log"
	"math"
	"time"
)

// EducationLoanUnderwritingEngine handles loan underwriting decisions
type EducationLoanUnderwritingEngine struct {
	products map[EducationLoanType]*EducationLoanProductConfig

	// Underwriting limits
	maxLoanAmount      float64
	minGuarantorIncome float64
	minGuarantorCount  int
	maxDTI             float64 // Debt-to-Income ratio for guarantor
	minStudentAge      int
	maxStudentAge      int
	minProgramDuration int
	maxProgramDuration int
}

// EducationLoanProductConfig holds configuration for each loan product
type EducationLoanProductConfig struct {
	Code                string
	Name                string
	LoanType            EducationLoanType
	MinAmount           float64
	MaxAmount           float64
	BaseInterestRate    float64
	MaxInterestRate     float64
	MinMoratoriumMonths int
	MaxMoratoriumMonths int
	MinRepaymentMonths  int
	MaxRepaymentMonths  int
	RequiredGuarantors  int
	AllowedInstitutions []InstitutionType
	Description         string
}

// UnderwritingDecision represents the result of underwriting
type UnderwritingDecision struct {
	Decision             string    `json:"decision"` // approved, declined, referred
	ApprovedAmount       float64   `json:"approved_amount"`
	InterestRate         float64   `json:"interest_rate"`
	MoratoriumMonths     int       `json:"moratorium_months"`
	RepaymentTenorMonths int       `json:"repayment_tenor_months"`
	MonthlyPayment       float64   `json:"monthly_payment"`
	RiskScore            float64   `json:"risk_score"`
	RiskTier             string    `json:"risk_tier"`
	DecisionReasons      []string  `json:"decision_reasons"`
	Conditions           []string  `json:"conditions"`
	DecisionDate         time.Time `json:"decision_date"`
	ValidUntil           time.Time `json:"valid_until"`
}

// EligibilityResult represents eligibility check result
type EligibilityResult struct {
	Eligible           bool     `json:"eligible"`
	MaxLoanAmount      float64  `json:"max_loan_amount"`
	EstimatedRate      float64  `json:"estimated_rate"`
	RequiredGuarantors int      `json:"required_guarantors"`
	Reasons            []string `json:"reasons"`
	Recommendations    []string `json:"recommendations"`
}

// NewEducationLoanUnderwritingEngine creates a new underwriting engine
func NewEducationLoanUnderwritingEngine() *EducationLoanUnderwritingEngine {
	engine := &EducationLoanUnderwritingEngine{
		products:           make(map[EducationLoanType]*EducationLoanProductConfig),
		maxLoanAmount:      50000000, // 50 million NGN
		minGuarantorIncome: 100000,   // 100k NGN monthly
		minGuarantorCount:  1,
		maxDTI:             0.40, // 40% DTI
		minStudentAge:      16,
		maxStudentAge:      45,
		minProgramDuration: 1,
		maxProgramDuration: 7,
	}

	// Initialize products
	engine.initializeProducts()

	return engine
}

// initializeProducts sets up all education loan products
func (e *EducationLoanUnderwritingEngine) initializeProducts() {
	e.products[LoanTypeUndergraduate] = &EducationLoanProductConfig{
		Code:                "EDU_UG",
		Name:                "Undergraduate Education Loan",
		LoanType:            LoanTypeUndergraduate,
		MinAmount:           500000,
		MaxAmount:           10000000,
		BaseInterestRate:    12.0,
		MaxInterestRate:     18.0,
		MinMoratoriumMonths: 12,
		MaxMoratoriumMonths: 60,
		MinRepaymentMonths:  24,
		MaxRepaymentMonths:  120,
		RequiredGuarantors:  1,
		AllowedInstitutions: []InstitutionType{
			InstitutionUniversity,
			InstitutionPolytechnic,
			InstitutionCollegeOfEd,
			InstitutionPrivate,
		},
		Description: "Loan for undergraduate degree programs at accredited institutions",
	}

	e.products[LoanTypePostgraduate] = &EducationLoanProductConfig{
		Code:                "EDU_PG",
		Name:                "Postgraduate Education Loan",
		LoanType:            LoanTypePostgraduate,
		MinAmount:           1000000,
		MaxAmount:           20000000,
		BaseInterestRate:    11.0,
		MaxInterestRate:     16.0,
		MinMoratoriumMonths: 6,
		MaxMoratoriumMonths: 36,
		MinRepaymentMonths:  24,
		MaxRepaymentMonths:  84,
		RequiredGuarantors:  1,
		AllowedInstitutions: []InstitutionType{
			InstitutionUniversity,
			InstitutionPrivate,
			InstitutionForeign,
		},
		Description: "Loan for Masters and PhD programs",
	}

	e.products[LoanTypeProfessional] = &EducationLoanProductConfig{
		Code:                "EDU_PROF",
		Name:                "Professional Education Loan",
		LoanType:            LoanTypeProfessional,
		MinAmount:           2000000,
		MaxAmount:           30000000,
		BaseInterestRate:    10.0,
		MaxInterestRate:     15.0,
		MinMoratoriumMonths: 12,
		MaxMoratoriumMonths: 72,
		MinRepaymentMonths:  36,
		MaxRepaymentMonths:  120,
		RequiredGuarantors:  2,
		AllowedInstitutions: []InstitutionType{
			InstitutionUniversity,
			InstitutionPrivate,
			InstitutionProfessional,
		},
		Description: "Loan for professional programs (Law, Medicine, Engineering, etc.)",
	}

	e.products[LoanTypeVocational] = &EducationLoanProductConfig{
		Code:                "EDU_VOC",
		Name:                "Vocational Training Loan",
		LoanType:            LoanTypeVocational,
		MinAmount:           100000,
		MaxAmount:           3000000,
		BaseInterestRate:    14.0,
		MaxInterestRate:     20.0,
		MinMoratoriumMonths: 3,
		MaxMoratoriumMonths: 12,
		MinRepaymentMonths:  12,
		MaxRepaymentMonths:  36,
		RequiredGuarantors:  1,
		AllowedInstitutions: []InstitutionType{
			InstitutionVocational,
			InstitutionMonotechnic,
			InstitutionPolytechnic,
		},
		Description: "Loan for vocational and technical training programs",
	}

	e.products[LoanTypeStudyAbroad] = &EducationLoanProductConfig{
		Code:                "EDU_ABROAD",
		Name:                "Study Abroad Loan",
		LoanType:            LoanTypeStudyAbroad,
		MinAmount:           5000000,
		MaxAmount:           50000000,
		BaseInterestRate:    9.0,
		MaxInterestRate:     14.0,
		MinMoratoriumMonths: 12,
		MaxMoratoriumMonths: 60,
		MinRepaymentMonths:  36,
		MaxRepaymentMonths:  180,
		RequiredGuarantors:  2,
		AllowedInstitutions: []InstitutionType{
			InstitutionForeign,
		},
		Description: "Loan for studying at foreign institutions",
	}

	e.products[LoanTypeTuitionOnly] = &EducationLoanProductConfig{
		Code:                "EDU_TUITION",
		Name:                "Tuition-Only Loan",
		LoanType:            LoanTypeTuitionOnly,
		MinAmount:           200000,
		MaxAmount:           5000000,
		BaseInterestRate:    13.0,
		MaxInterestRate:     18.0,
		MinMoratoriumMonths: 6,
		MaxMoratoriumMonths: 48,
		MinRepaymentMonths:  12,
		MaxRepaymentMonths:  60,
		RequiredGuarantors:  1,
		AllowedInstitutions: []InstitutionType{
			InstitutionUniversity,
			InstitutionPolytechnic,
			InstitutionCollegeOfEd,
			InstitutionPrivate,
			InstitutionVocational,
		},
		Description: "Loan covering tuition fees only, disbursed directly to institution",
	}

	e.products[LoanTypeComprehensive] = &EducationLoanProductConfig{
		Code:                "EDU_COMP",
		Name:                "Comprehensive Education Loan",
		LoanType:            LoanTypeComprehensive,
		MinAmount:           1000000,
		MaxAmount:           25000000,
		BaseInterestRate:    11.5,
		MaxInterestRate:     17.0,
		MinMoratoriumMonths: 12,
		MaxMoratoriumMonths: 60,
		MinRepaymentMonths:  24,
		MaxRepaymentMonths:  120,
		RequiredGuarantors:  2,
		AllowedInstitutions: []InstitutionType{
			InstitutionUniversity,
			InstitutionPolytechnic,
			InstitutionPrivate,
			InstitutionForeign,
		},
		Description: "Comprehensive loan covering tuition, accommodation, and living expenses",
	}

	e.products[LoanTypeTopUp] = &EducationLoanProductConfig{
		Code:                "EDU_TOPUP",
		Name:                "Education Loan Top-Up",
		LoanType:            LoanTypeTopUp,
		MinAmount:           100000,
		MaxAmount:           5000000,
		BaseInterestRate:    14.0,
		MaxInterestRate:     19.0,
		MinMoratoriumMonths: 3,
		MaxMoratoriumMonths: 24,
		MinRepaymentMonths:  12,
		MaxRepaymentMonths:  48,
		RequiredGuarantors:  1,
		AllowedInstitutions: []InstitutionType{
			InstitutionUniversity,
			InstitutionPolytechnic,
			InstitutionCollegeOfEd,
			InstitutionPrivate,
			InstitutionVocational,
			InstitutionForeign,
		},
		Description: "Additional funding for existing education loan borrowers",
	}
}

// Underwrite performs full underwriting assessment
func (e *EducationLoanUnderwritingEngine) Underwrite(app *EducationLoanApplication) *UnderwritingDecision {
	decision := &UnderwritingDecision{
		DecisionDate: time.Now(),
		ValidUntil:   time.Now().AddDate(0, 0, 30), // Valid for 30 days
	}

	// Get product configuration
	product, ok := e.products[app.LoanType]
	if !ok {
		decision.Decision = "declined"
		decision.DecisionReasons = append(decision.DecisionReasons, "Invalid loan type")
		return decision
	}

	// Validate basic eligibility
	eligibilityReasons := e.validateEligibility(app, product)
	if len(eligibilityReasons) > 0 {
		decision.Decision = "declined"
		decision.DecisionReasons = eligibilityReasons
		return decision
	}

	// Calculate risk score
	riskScore := e.calculateRiskScore(app, product)
	decision.RiskScore = riskScore
	decision.RiskTier = e.getRiskTier(riskScore)

	// Determine approval based on risk
	if riskScore > 0.7 {
		decision.Decision = "declined"
		decision.DecisionReasons = append(decision.DecisionReasons, "Risk score too high")
		return decision
	}

	if riskScore > 0.5 {
		decision.Decision = "referred"
		decision.DecisionReasons = append(decision.DecisionReasons, "Requires manual review due to elevated risk")
	} else {
		decision.Decision = "approved"
	}

	// Calculate approved amount
	decision.ApprovedAmount = e.calculateApprovedAmount(app, product, riskScore)

	// Calculate interest rate
	decision.InterestRate = e.calculateInterestRate(app, product, riskScore)

	// Calculate moratorium period
	decision.MoratoriumMonths = e.calculateMoratoriumPeriod(app, product)

	// Calculate repayment tenor
	decision.RepaymentTenorMonths = e.calculateRepaymentTenor(app, product)

	// Calculate monthly payment
	decision.MonthlyPayment = e.calculateMonthlyPayment(
		decision.ApprovedAmount,
		decision.InterestRate,
		decision.MoratoriumMonths,
		decision.RepaymentTenorMonths,
	)

	// Add conditions
	decision.Conditions = e.generateConditions(app, product, riskScore)

	log.Printf("Underwriting decision for %s: %s, amount: %.2f, rate: %.2f%%",
		app.ID, decision.Decision, decision.ApprovedAmount, decision.InterestRate)

	return decision
}

// validateEligibility checks basic eligibility criteria
func (e *EducationLoanUnderwritingEngine) validateEligibility(app *EducationLoanApplication, product *EducationLoanProductConfig) []string {
	var reasons []string

	// Check amount limits
	if app.RequestedAmount < product.MinAmount {
		reasons = append(reasons, fmt.Sprintf("Requested amount below minimum (%.2f)", product.MinAmount))
	}
	if app.RequestedAmount > product.MaxAmount {
		reasons = append(reasons, fmt.Sprintf("Requested amount exceeds maximum (%.2f)", product.MaxAmount))
	}

	// Check program duration
	if app.ProgramDuration < e.minProgramDuration || app.ProgramDuration > e.maxProgramDuration {
		reasons = append(reasons, fmt.Sprintf("Program duration must be between %d and %d years", e.minProgramDuration, e.maxProgramDuration))
	}

	// Check guarantor count
	if len(app.Guarantors) < product.RequiredGuarantors {
		reasons = append(reasons, fmt.Sprintf("Requires at least %d guarantor(s)", product.RequiredGuarantors))
	}

	// Check guarantor verification
	verifiedGuarantors := 0
	for _, g := range app.Guarantors {
		if g.VerificationStatus == "verified" {
			verifiedGuarantors++
		}
	}
	if verifiedGuarantors < product.RequiredGuarantors {
		reasons = append(reasons, "All required guarantors must be verified")
	}

	// Check institution type
	if !e.isInstitutionAllowed(app.Institution.Type, product.AllowedInstitutions) {
		reasons = append(reasons, "Institution type not eligible for this loan product")
	}

	// Check institution accreditation
	if !app.Institution.NUCAccredited && app.Institution.Type != InstitutionForeign {
		reasons = append(reasons, "Institution must be NUC accredited")
	}

	// Check admission verification
	if app.AdmissionNumber == "" {
		reasons = append(reasons, "Admission must be verified")
	}

	return reasons
}

// calculateRiskScore calculates overall risk score (0-1, lower is better)
func (e *EducationLoanUnderwritingEngine) calculateRiskScore(app *EducationLoanApplication, product *EducationLoanProductConfig) float64 {
	var totalScore float64
	var weights float64

	// Institution risk (weight: 25%)
	institutionRisk := e.getInstitutionRisk(app.Institution.Type)
	totalScore += institutionRisk * 0.25
	weights += 0.25

	// Guarantor strength (weight: 30%)
	guarantorRisk := e.getGuarantorRisk(app.Guarantors, app.RequestedAmount)
	totalScore += guarantorRisk * 0.30
	weights += 0.30

	// Program risk (weight: 15%)
	programRisk := e.getProgramRisk(app.ProgramDuration, app.CurrentYear)
	totalScore += programRisk * 0.15
	weights += 0.15

	// Amount risk (weight: 20%)
	amountRisk := e.getAmountRisk(app.RequestedAmount, product.MaxAmount)
	totalScore += amountRisk * 0.20
	weights += 0.20

	// Loan type risk (weight: 10%)
	loanTypeRisk := e.getLoanTypeRisk(app.LoanType)
	totalScore += loanTypeRisk * 0.10
	weights += 0.10

	return totalScore / weights
}

// getInstitutionRisk returns risk score based on institution type
func (e *EducationLoanUnderwritingEngine) getInstitutionRisk(instType InstitutionType) float64 {
	switch instType {
	case InstitutionUniversity:
		return 0.2
	case InstitutionPolytechnic:
		return 0.25
	case InstitutionCollegeOfEd:
		return 0.3
	case InstitutionPrivate:
		return 0.35
	case InstitutionForeign:
		return 0.15 // Lower risk for foreign institutions (usually better outcomes)
	case InstitutionVocational:
		return 0.4
	case InstitutionProfessional:
		return 0.2
	default:
		return 0.5
	}
}

// getGuarantorRisk returns risk score based on guarantor strength
func (e *EducationLoanUnderwritingEngine) getGuarantorRisk(guarantors []Guarantor, loanAmount float64) float64 {
	if len(guarantors) == 0 {
		return 1.0
	}

	totalIncome := 0.0
	totalGuaranteeAmount := 0.0
	verifiedCount := 0

	for _, g := range guarantors {
		totalIncome += g.MonthlyIncome
		totalGuaranteeAmount += g.GuaranteeAmount
		if g.VerificationStatus == "verified" {
			verifiedCount++
		}
	}

	// Check if guarantors can cover the loan
	coverageRatio := totalGuaranteeAmount / loanAmount
	incomeRatio := (totalIncome * 12) / loanAmount // Annual income vs loan

	risk := 0.5

	// Better coverage = lower risk
	if coverageRatio >= 1.5 {
		risk -= 0.2
	} else if coverageRatio >= 1.0 {
		risk -= 0.1
	} else if coverageRatio < 0.5 {
		risk += 0.2
	}

	// Better income ratio = lower risk
	if incomeRatio >= 3.0 {
		risk -= 0.15
	} else if incomeRatio >= 2.0 {
		risk -= 0.1
	} else if incomeRatio < 1.0 {
		risk += 0.15
	}

	// More guarantors = lower risk
	if len(guarantors) >= 2 {
		risk -= 0.1
	}

	// Verification status
	if verifiedCount < len(guarantors) {
		risk += 0.1
	}

	return math.Max(0, math.Min(1, risk))
}

// getProgramRisk returns risk based on program characteristics
func (e *EducationLoanUnderwritingEngine) getProgramRisk(duration, currentYear int) float64 {
	risk := 0.3

	// Longer programs = higher risk
	if duration > 5 {
		risk += 0.15
	} else if duration > 4 {
		risk += 0.1
	}

	// Students further along = lower risk (more likely to complete)
	if currentYear > 1 {
		risk -= float64(currentYear-1) * 0.05
	}

	return math.Max(0, math.Min(1, risk))
}

// getAmountRisk returns risk based on loan amount
func (e *EducationLoanUnderwritingEngine) getAmountRisk(requested, maxAllowed float64) float64 {
	ratio := requested / maxAllowed

	if ratio > 0.8 {
		return 0.5
	} else if ratio > 0.6 {
		return 0.35
	} else if ratio > 0.4 {
		return 0.25
	}
	return 0.15
}

// getLoanTypeRisk returns risk based on loan type
func (e *EducationLoanUnderwritingEngine) getLoanTypeRisk(loanType EducationLoanType) float64 {
	switch loanType {
	case LoanTypeProfessional:
		return 0.15 // Professional programs have good outcomes
	case LoanTypePostgraduate:
		return 0.2
	case LoanTypeStudyAbroad:
		return 0.2
	case LoanTypeUndergraduate:
		return 0.3
	case LoanTypeComprehensive:
		return 0.35
	case LoanTypeTuitionOnly:
		return 0.25
	case LoanTypeVocational:
		return 0.4
	case LoanTypeTopUp:
		return 0.45
	default:
		return 0.5
	}
}

// getRiskTier returns risk tier based on score
func (e *EducationLoanUnderwritingEngine) getRiskTier(score float64) string {
	switch {
	case score <= 0.2:
		return "very_low"
	case score <= 0.35:
		return "low"
	case score <= 0.5:
		return "medium"
	case score <= 0.65:
		return "high"
	default:
		return "very_high"
	}
}

// calculateApprovedAmount determines the approved loan amount
func (e *EducationLoanUnderwritingEngine) calculateApprovedAmount(app *EducationLoanApplication, product *EducationLoanProductConfig, riskScore float64) float64 {
	// Start with requested amount
	approved := app.RequestedAmount

	// Cap at product maximum
	if approved > product.MaxAmount {
		approved = product.MaxAmount
	}

	// Reduce based on risk
	if riskScore > 0.5 {
		approved *= 0.8 // 20% reduction for high risk
	} else if riskScore > 0.35 {
		approved *= 0.9 // 10% reduction for medium risk
	}

	// Ensure minimum
	if approved < product.MinAmount {
		approved = product.MinAmount
	}

	return math.Round(approved*100) / 100
}

// calculateInterestRate determines the interest rate
func (e *EducationLoanUnderwritingEngine) calculateInterestRate(app *EducationLoanApplication, product *EducationLoanProductConfig, riskScore float64) float64 {
	// Start with base rate
	rate := product.BaseInterestRate

	// Add risk premium
	riskPremium := (product.MaxInterestRate - product.BaseInterestRate) * riskScore
	rate += riskPremium

	// Institution discount
	if app.Institution.Type == InstitutionForeign {
		rate -= 0.5 // 0.5% discount for foreign institutions
	} else if app.Institution.Type == InstitutionUniversity && app.Institution.NUCAccredited {
		rate -= 0.25 // 0.25% discount for accredited universities
	}

	// Guarantor discount
	if len(app.Guarantors) >= 2 {
		rate -= 0.5 // 0.5% discount for multiple guarantors
	}

	// Ensure within bounds
	rate = math.Max(product.BaseInterestRate, math.Min(product.MaxInterestRate, rate))

	return math.Round(rate*100) / 100
}

// calculateMoratoriumPeriod determines the moratorium period
func (e *EducationLoanUnderwritingEngine) calculateMoratoriumPeriod(app *EducationLoanApplication, product *EducationLoanProductConfig) int {
	// Base moratorium = remaining study period + 6 months grace
	remainingYears := app.ProgramDuration - app.CurrentYear + 1
	moratorium := (remainingYears * 12) + 6

	// Cap at product limits
	if moratorium < product.MinMoratoriumMonths {
		moratorium = product.MinMoratoriumMonths
	}
	if moratorium > product.MaxMoratoriumMonths {
		moratorium = product.MaxMoratoriumMonths
	}

	return moratorium
}

// calculateRepaymentTenor determines the repayment period
func (e *EducationLoanUnderwritingEngine) calculateRepaymentTenor(app *EducationLoanApplication, product *EducationLoanProductConfig) int {
	// Base tenor based on loan amount
	tenor := 60 // Default 5 years

	if app.RequestedAmount > 20000000 {
		tenor = 120 // 10 years for large loans
	} else if app.RequestedAmount > 10000000 {
		tenor = 84 // 7 years
	} else if app.RequestedAmount > 5000000 {
		tenor = 72 // 6 years
	}

	// Cap at product limits
	if tenor < product.MinRepaymentMonths {
		tenor = product.MinRepaymentMonths
	}
	if tenor > product.MaxRepaymentMonths {
		tenor = product.MaxRepaymentMonths
	}

	return tenor
}

// calculateMonthlyPayment calculates the monthly payment amount
func (e *EducationLoanUnderwritingEngine) calculateMonthlyPayment(principal, annualRate float64, moratoriumMonths, repaymentMonths int) float64 {
	// Calculate interest accrued during moratorium
	monthlyRate := annualRate / 12.0 / 100.0
	moratoriumInterest := principal * monthlyRate * float64(moratoriumMonths)
	totalPrincipal := principal + moratoriumInterest

	// Calculate monthly payment using amortization formula
	if monthlyRate == 0 {
		return totalPrincipal / float64(repaymentMonths)
	}

	payment := totalPrincipal * (monthlyRate * math.Pow(1+monthlyRate, float64(repaymentMonths))) /
		(math.Pow(1+monthlyRate, float64(repaymentMonths)) - 1)

	return math.Round(payment*100) / 100
}

// generateConditions generates loan conditions
func (e *EducationLoanUnderwritingEngine) generateConditions(app *EducationLoanApplication, product *EducationLoanProductConfig, riskScore float64) []string {
	var conditions []string

	// Standard conditions
	conditions = append(conditions, "Maintain satisfactory academic progress (minimum 2.0 GPA)")
	conditions = append(conditions, "Remain enrolled as a full-time student")
	conditions = append(conditions, "Notify lender of any change in enrollment status")
	conditions = append(conditions, "Provide academic transcripts each semester")

	// Risk-based conditions
	if riskScore > 0.4 {
		conditions = append(conditions, "Provide additional guarantor if academic performance drops below 2.5 GPA")
	}

	// Loan type specific conditions
	if app.LoanType == LoanTypeStudyAbroad {
		conditions = append(conditions, "Maintain valid student visa")
		conditions = append(conditions, "Provide proof of enrollment each semester")
	}

	if app.LoanType == LoanTypeComprehensive {
		conditions = append(conditions, "Submit accommodation receipts for living expense disbursements")
	}

	// Institution specific
	if app.Institution.Type == InstitutionVocational {
		conditions = append(conditions, "Complete program within specified duration")
		conditions = append(conditions, "Obtain certification upon completion")
	}

	return conditions
}

// isInstitutionAllowed checks if institution type is allowed for product
func (e *EducationLoanUnderwritingEngine) isInstitutionAllowed(instType InstitutionType, allowed []InstitutionType) bool {
	for _, a := range allowed {
		if a == instType {
			return true
		}
	}
	return false
}

// CheckEligibility performs quick eligibility check
func (e *EducationLoanUnderwritingEngine) CheckEligibility(studentAge int, institutionType InstitutionType, programDuration int, requestedAmount, guarantorIncome float64, guarantorCount int) *EligibilityResult {
	result := &EligibilityResult{
		Eligible: true,
	}

	// Age check
	if studentAge < e.minStudentAge {
		result.Eligible = false
		result.Reasons = append(result.Reasons, fmt.Sprintf("Student must be at least %d years old", e.minStudentAge))
	}
	if studentAge > e.maxStudentAge {
		result.Eligible = false
		result.Reasons = append(result.Reasons, fmt.Sprintf("Student must be under %d years old", e.maxStudentAge))
	}

	// Find applicable products
	var maxAmount float64
	var minRate float64 = 100
	var requiredGuarantors int

	for _, product := range e.products {
		if e.isInstitutionAllowed(institutionType, product.AllowedInstitutions) {
			if product.MaxAmount > maxAmount {
				maxAmount = product.MaxAmount
			}
			if product.BaseInterestRate < minRate {
				minRate = product.BaseInterestRate
			}
			if product.RequiredGuarantors > requiredGuarantors {
				requiredGuarantors = product.RequiredGuarantors
			}
		}
	}

	result.MaxLoanAmount = maxAmount
	result.EstimatedRate = minRate
	result.RequiredGuarantors = requiredGuarantors

	// Amount check
	if requestedAmount > maxAmount {
		result.Eligible = false
		result.Reasons = append(result.Reasons, fmt.Sprintf("Maximum loan amount for this institution type is %.2f", maxAmount))
	}

	// Guarantor check
	if guarantorCount < requiredGuarantors {
		result.Eligible = false
		result.Reasons = append(result.Reasons, fmt.Sprintf("At least %d guarantor(s) required", requiredGuarantors))
	}

	// Guarantor income check
	if guarantorIncome < e.minGuarantorIncome {
		result.Eligible = false
		result.Reasons = append(result.Reasons, fmt.Sprintf("Guarantor income must be at least %.2f per month", e.minGuarantorIncome))
	}

	// DTI check
	if guarantorIncome > 0 {
		monthlyPayment := requestedAmount / 60 // Rough estimate
		dti := monthlyPayment / guarantorIncome
		if dti > e.maxDTI {
			result.Eligible = false
			result.Reasons = append(result.Reasons, "Guarantor debt-to-income ratio exceeds maximum")
		}
	}

	// Recommendations
	if result.Eligible {
		result.Recommendations = append(result.Recommendations, "Consider adding additional guarantor for better terms")
		if institutionType == InstitutionVocational {
			result.Recommendations = append(result.Recommendations, "Vocational loans have shorter repayment periods")
		}
	}

	return result
}

// GetProduct returns product configuration by loan type
func (e *EducationLoanUnderwritingEngine) GetProduct(loanType EducationLoanType) *EducationLoanProductConfig {
	return e.products[loanType]
}

// GetAllProducts returns all product configurations
func (e *EducationLoanUnderwritingEngine) GetAllProducts() []*EducationLoanProductConfig {
	var products []*EducationLoanProductConfig
	for _, p := range e.products {
		products = append(products, p)
	}
	return products
}
