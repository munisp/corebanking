package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gorilla/mux"
)

// ============================================================================
// PARTNER ECOSYSTEM AND PROGRAM CONFIGURATION
// Input suppliers, off-takers, warehouses, insurers, government programs
// ============================================================================

// Partner represents an ecosystem partner
type Partner struct {
	ID                string    `json:"id"`
	PartnerType       string    `json:"partner_type"` // input_supplier, off_taker, warehouse, insurer, logistics, agtech
	Name              string    `json:"name"`
	RegistrationNumber string   `json:"registration_number"`
	ContactPerson     string    `json:"contact_person"`
	Email             string    `json:"email"`
	Phone             string    `json:"phone"`
	Address           string    `json:"address"`
	State             string    `json:"state"`
	LGA               string    `json:"lga"`
	BankAccount       BankAccount `json:"bank_account"`
	ServicesOffered   []string  `json:"services_offered"`
	CoverageAreas     []string  `json:"coverage_areas"`
	Certifications    []string  `json:"certifications"`
	Rating            float64   `json:"rating"`
	TotalTransactions int       `json:"total_transactions"`
	TotalVolume       float64   `json:"total_volume"`
	Status            string    `json:"status"` // pending, active, suspended, inactive
	OnboardedAt       time.Time `json:"onboarded_at"`
	LastActivityAt    time.Time `json:"last_activity_at"`
}

// BankAccount for partner payments
type BankAccount struct {
	BankName      string `json:"bank_name"`
	AccountNumber string `json:"account_number"`
	AccountName   string `json:"account_name"`
}

// EcosystemInputSupplier extends Partner for input dealers
type EcosystemInputSupplier struct {
	Partner
	InputCategories   []string `json:"input_categories"` // fertilizer, seed, pesticide, equipment
	Brands            []string `json:"brands"`
	AcceptsVouchers   bool     `json:"accepts_vouchers"`
	HasPOS            bool     `json:"has_pos"`
	HasUSSD           bool     `json:"has_ussd"`
	CreditTermsDays   int      `json:"credit_terms_days"`
	MinOrderValue     float64  `json:"min_order_value"`
	DeliveryAvailable bool     `json:"delivery_available"`
}

// EcosystemOffTaker extends Partner for aggregators/processors
type EcosystemOffTaker struct {
	Partner
	CommoditiesBought []string `json:"commodities_bought"`
	ProcessingCapacity float64 `json:"processing_capacity_tonnes_day"`
	StorageCapacity   float64  `json:"storage_capacity_tonnes"`
	ExportLicense     bool     `json:"export_license"`
	QualityGrades     []string `json:"quality_grades_accepted"`
	PaymentTermsDays  int      `json:"payment_terms_days"`
	ContractFarming   bool     `json:"contract_farming"`
	MinPurchaseVolume float64  `json:"min_purchase_volume_tonnes"`
}

// Warehouse extends Partner for storage facilities
type Warehouse struct {
	Partner
	TotalCapacity     float64  `json:"total_capacity_tonnes"`
	AvailableCapacity float64  `json:"available_capacity_tonnes"`
	CommoditiesStored []string `json:"commodities_stored"`
	StorageTypes      []string `json:"storage_types"` // dry, cold, controlled_atmosphere
	CertifiedGrading  bool     `json:"certified_grading"`
	InsuranceCoverage bool     `json:"insurance_coverage"`
	ReceiptFinancing  bool     `json:"receipt_financing"`
	StorageRatePerDay float64  `json:"storage_rate_per_tonne_day"`
	HandlingFee       float64  `json:"handling_fee_per_tonne"`
}

// GovernmentProgram represents intervention programs
type GovernmentProgram struct {
	ID                  string    `json:"id"`
	ProgramCode         string    `json:"program_code"`
	Name                string    `json:"name"`
	Sponsor             string    `json:"sponsor"` // CBN, FGN, State, DFI
	Description         string    `json:"description"`
	ProgramType         string    `json:"program_type"` // credit, guarantee, subsidy, grant
	EligibilityCriteria []EligibilityCriterion `json:"eligibility_criteria"`
	Benefits            []ProgramBenefit `json:"benefits"`
	RequiredDocuments   []string  `json:"required_documents"`
	ApplicationProcess  []string  `json:"application_process"`
	MaxBenefitAmount    float64   `json:"max_benefit_amount"`
	InterestRate        float64   `json:"interest_rate,omitempty"`
	TenorMonths         int       `json:"tenor_months,omitempty"`
	GracePeriodMonths   int       `json:"grace_period_months,omitempty"`
	GuaranteePercent    float64   `json:"guarantee_percent,omitempty"`
	SubsidyPercent      float64   `json:"subsidy_percent,omitempty"`
	TargetBeneficiaries int       `json:"target_beneficiaries"`
	CurrentBeneficiaries int      `json:"current_beneficiaries"`
	TotalDisbursed      float64   `json:"total_disbursed"`
	BudgetAllocated     float64   `json:"budget_allocated"`
	BudgetUtilized      float64   `json:"budget_utilized"`
	StartDate           time.Time `json:"start_date"`
	EndDate             time.Time `json:"end_date"`
	Status              string    `json:"status"`
	MEDataRequired      []string  `json:"me_data_required"` // M&E data to collect
}

// EligibilityCriterion for program qualification
type EligibilityCriterion struct {
	Field       string      `json:"field"`
	Operator    string      `json:"operator"` // equals, in, between, min, max
	Value       interface{} `json:"value"`
	Description string      `json:"description"`
}

// ProgramBenefit describes what beneficiaries receive
type ProgramBenefit struct {
	Type        string  `json:"type"` // loan, grant, subsidy, guarantee, training
	Description string  `json:"description"`
	Value       float64 `json:"value,omitempty"`
	Unit        string  `json:"unit,omitempty"`
}

// ProgramEnrollment tracks farmer enrollment in programs
type ProgramEnrollment struct {
	ID              string    `json:"id"`
	ProgramID       string    `json:"program_id"`
	FarmerID        string    `json:"farmer_id"`
	CooperativeID   string    `json:"cooperative_id,omitempty"`
	ApplicationDate time.Time `json:"application_date"`
	Status          string    `json:"status"` // pending, approved, active, completed, rejected
	ApprovedAmount  float64   `json:"approved_amount"`
	DisbursedAmount float64   `json:"disbursed_amount"`
	RepaidAmount    float64   `json:"repaid_amount"`
	LinkedLoanID    string    `json:"linked_loan_id,omitempty"`
	MEData          map[string]interface{} `json:"me_data"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// PartnerTransaction records transactions with partners
type PartnerTransaction struct {
	ID              string    `json:"id"`
	PartnerID       string    `json:"partner_id"`
	PartnerType     string    `json:"partner_type"`
	FarmerID        string    `json:"farmer_id"`
	TransactionType string    `json:"transaction_type"` // voucher_redemption, purchase, delivery, storage
	Amount          float64   `json:"amount"`
	Quantity        float64   `json:"quantity,omitempty"`
	Unit            string    `json:"unit,omitempty"`
	Reference       string    `json:"reference"`
	Status          string    `json:"status"`
	Timestamp       time.Time `json:"timestamp"`
}

// Sample government programs
var governmentPrograms = []GovernmentProgram{
	{
		ID:          "PROG-ABP-001",
		ProgramCode: "ABP",
		Name:        "Anchor Borrowers Programme",
		Sponsor:     "CBN",
		Description: "Provides farm inputs and cash to smallholder farmers through anchor companies",
		ProgramType: "credit",
		EligibilityCriteria: []EligibilityCriterion{
			{Field: "farmer_type", Operator: "equals", Value: "smallholder", Description: "Must be a smallholder farmer"},
			{Field: "farm_size", Operator: "max", Value: 5.0, Description: "Maximum 5 hectares"},
			{Field: "has_bvn", Operator: "equals", Value: true, Description: "Must have valid BVN"},
			{Field: "linked_anchor", Operator: "equals", Value: true, Description: "Must be linked to approved anchor"},
		},
		Benefits: []ProgramBenefit{
			{Type: "loan", Description: "Input financing at concessionary rate", Value: 9.0, Unit: "percent_pa"},
			{Type: "subsidy", Description: "Input subsidy", Value: 50.0, Unit: "percent"},
			{Type: "guarantee", Description: "NIRSAL guarantee coverage", Value: 75.0, Unit: "percent"},
		},
		RequiredDocuments: []string{"BVN", "Farm registration", "Cooperative membership", "Anchor agreement"},
		MaxBenefitAmount:  500000,
		InterestRate:      9.0,
		TenorMonths:       12,
		GracePeriodMonths: 6,
		GuaranteePercent:  75,
		TargetBeneficiaries: 1000000,
		CurrentBeneficiaries: 450000,
		TotalDisbursed:    225000000000,
		BudgetAllocated:   500000000000,
		BudgetUtilized:    225000000000,
		StartDate:         time.Date(2015, 11, 1, 0, 0, 0, 0, time.UTC),
		EndDate:           time.Date(2025, 12, 31, 0, 0, 0, 0, time.UTC),
		Status:            "active",
		MEDataRequired:    []string{"yield_achieved", "income_generated", "repayment_status", "employment_created"},
	},
	{
		ID:          "PROG-AGSMEIS-001",
		ProgramCode: "AGSMEIS",
		Name:        "Agri-Business/Small and Medium Enterprise Investment Scheme",
		Sponsor:     "CBN",
		Description: "Supports agricultural SMEs with concessionary financing",
		ProgramType: "credit",
		EligibilityCriteria: []EligibilityCriterion{
			{Field: "business_type", Operator: "in", Value: []string{"agribusiness", "agro_processing"}, Description: "Must be agribusiness or agro-processing"},
			{Field: "has_cac", Operator: "equals", Value: true, Description: "Must be CAC registered"},
			{Field: "training_completed", Operator: "equals", Value: true, Description: "Must complete entrepreneurship training"},
		},
		Benefits: []ProgramBenefit{
			{Type: "loan", Description: "Business financing at 9% p.a.", Value: 9.0, Unit: "percent_pa"},
			{Type: "training", Description: "Free entrepreneurship training"},
		},
		RequiredDocuments: []string{"CAC certificate", "Business plan", "Training certificate", "BVN"},
		MaxBenefitAmount:  10000000,
		InterestRate:      9.0,
		TenorMonths:       84,
		GracePeriodMonths: 18,
		TargetBeneficiaries: 100000,
		CurrentBeneficiaries: 35000,
		TotalDisbursed:    175000000000,
		BudgetAllocated:   500000000000,
		BudgetUtilized:    175000000000,
		StartDate:         time.Date(2017, 1, 1, 0, 0, 0, 0, time.UTC),
		EndDate:           time.Date(2027, 12, 31, 0, 0, 0, 0, time.UTC),
		Status:            "active",
		MEDataRequired:    []string{"revenue_growth", "jobs_created", "export_value"},
	},
	{
		ID:          "PROG-CACS-001",
		ProgramCode: "CACS",
		Name:        "Commercial Agriculture Credit Scheme",
		Sponsor:     "CBN",
		Description: "Provides financing for large-scale commercial agriculture",
		ProgramType: "credit",
		EligibilityCriteria: []EligibilityCriterion{
			{Field: "farm_size", Operator: "min", Value: 50.0, Description: "Minimum 50 hectares"},
			{Field: "has_cac", Operator: "equals", Value: true, Description: "Must be CAC registered"},
			{Field: "collateral", Operator: "equals", Value: true, Description: "Must provide acceptable collateral"},
		},
		Benefits: []ProgramBenefit{
			{Type: "loan", Description: "Long-term financing at 9% p.a.", Value: 9.0, Unit: "percent_pa"},
		},
		RequiredDocuments: []string{"CAC certificate", "Feasibility study", "Collateral documents", "Financial statements"},
		MaxBenefitAmount:  2000000000,
		InterestRate:      9.0,
		TenorMonths:       84,
		GracePeriodMonths: 24,
		TargetBeneficiaries: 5000,
		CurrentBeneficiaries: 1200,
		TotalDisbursed:    600000000000,
		BudgetAllocated:   1000000000000,
		BudgetUtilized:    600000000000,
		StartDate:         time.Date(2009, 1, 1, 0, 0, 0, 0, time.UTC),
		EndDate:           time.Date(2025, 12, 31, 0, 0, 0, 0, time.UTC),
		Status:            "active",
		MEDataRequired:    []string{"production_volume", "employment", "export_earnings"},
	},
	{
		ID:          "PROG-ACGSF-001",
		ProgramCode: "ACGSF",
		Name:        "Agricultural Credit Guarantee Scheme Fund",
		Sponsor:     "CBN",
		Description: "Provides guarantee for agricultural loans from banks",
		ProgramType: "guarantee",
		EligibilityCriteria: []EligibilityCriterion{
			{Field: "activity", Operator: "in", Value: []string{"crop_production", "livestock", "fishery", "agro_processing"}, Description: "Must be agricultural activity"},
			{Field: "has_bvn", Operator: "equals", Value: true, Description: "Must have valid BVN"},
		},
		Benefits: []ProgramBenefit{
			{Type: "guarantee", Description: "75% guarantee coverage", Value: 75.0, Unit: "percent"},
		},
		RequiredDocuments: []string{"BVN", "Farm/business registration", "Loan application"},
		MaxBenefitAmount:  50000000,
		GuaranteePercent:  75,
		TargetBeneficiaries: 500000,
		CurrentBeneficiaries: 180000,
		TotalDisbursed:    90000000000,
		BudgetAllocated:   200000000000,
		BudgetUtilized:    90000000000,
		StartDate:         time.Date(1978, 1, 1, 0, 0, 0, 0, time.UTC),
		EndDate:           time.Date(2030, 12, 31, 0, 0, 0, 0, time.UTC),
		Status:            "active",
		MEDataRequired:    []string{"loan_performance", "default_rate"},
	},
}

// Sample partners
var samplePartners = []Partner{
	{
		ID:          "PART-INP-001",
		PartnerType: "input_supplier",
		Name:        "Notore Agro Dealers",
		State:       "Kano",
		LGA:         "Kano Municipal",
		ServicesOffered: []string{"fertilizer", "seed", "pesticide"},
		CoverageAreas: []string{"Kano", "Kaduna", "Katsina", "Jigawa"},
		Rating:      4.5,
		Status:      "active",
	},
	{
		ID:          "PART-OFF-001",
		PartnerType: "off_taker",
		Name:        "Olam Nigeria Limited",
		State:       "Lagos",
		ServicesOffered: []string{"rice_purchase", "processing", "export"},
		CoverageAreas: []string{"nationwide"},
		Rating:      4.8,
		Status:      "active",
	},
	{
		ID:          "PART-WH-001",
		PartnerType: "warehouse",
		Name:        "AFEX Commodities Exchange",
		State:       "Abuja",
		ServicesOffered: []string{"storage", "grading", "receipt_financing"},
		CoverageAreas: []string{"North Central", "North West"},
		Rating:      4.7,
		Status:      "active",
	},
}

// HTTP Handlers for Partner Ecosystem

func handleGetPartners(w http.ResponseWriter, r *http.Request) {
	partnerType := r.URL.Query().Get("type")
	state := r.URL.Query().Get("state")
	
	filtered := make([]Partner, 0)
	for _, p := range samplePartners {
		if partnerType != "" && p.PartnerType != partnerType {
			continue
		}
		if state != "" && p.State != state {
			continue
		}
		filtered = append(filtered, p)
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"partners": filtered,
		"count":    len(filtered),
	})
}

func handleOnboardPartner(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	var request struct {
		PartnerType        string   `json:"partner_type"`
		Name               string   `json:"name"`
		RegistrationNumber string   `json:"registration_number"`
		ContactPerson      string   `json:"contact_person"`
		Email              string   `json:"email"`
		Phone              string   `json:"phone"`
		Address            string   `json:"address"`
		State              string   `json:"state"`
		LGA                string   `json:"lga"`
		ServicesOffered    []string `json:"services_offered"`
		CoverageAreas      []string `json:"coverage_areas"`
		BankName           string   `json:"bank_name"`
		AccountNumber      string   `json:"account_number"`
		AccountName        string   `json:"account_name"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	partner := Partner{
		ID:                 fmt.Sprintf("PART-%s-%d", request.PartnerType[:3], time.Now().UnixNano()%100000),
		PartnerType:        request.PartnerType,
		Name:               request.Name,
		RegistrationNumber: request.RegistrationNumber,
		ContactPerson:      request.ContactPerson,
		Email:              request.Email,
		Phone:              request.Phone,
		Address:            request.Address,
		State:              request.State,
		LGA:                request.LGA,
		BankAccount: BankAccount{
			BankName:      request.BankName,
			AccountNumber: request.AccountNumber,
			AccountName:   request.AccountName,
		},
		ServicesOffered: request.ServicesOffered,
		CoverageAreas:   request.CoverageAreas,
		Rating:          0,
		Status:          "pending",
		OnboardedAt:     time.Now(),
	}
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"partner": partner,
		"message": "Partner onboarding initiated",
		"next_steps": []string{
			"Document verification in progress",
			"Bank account validation",
			"Site inspection (if applicable)",
			"Training on platform usage",
		},
	})
}

func handleGetGovernmentPrograms(w http.ResponseWriter, r *http.Request) {
	programType := r.URL.Query().Get("type")
	status := r.URL.Query().Get("status")
	
	filtered := make([]GovernmentProgram, 0)
	for _, p := range governmentPrograms {
		if programType != "" && p.ProgramType != programType {
			continue
		}
		if status != "" && p.Status != status {
			continue
		}
		filtered = append(filtered, p)
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"programs": filtered,
		"count":    len(filtered),
		"summary": map[string]interface{}{
			"total_budget":        func() float64 { t := 0.0; for _, p := range filtered { t += p.BudgetAllocated }; return t }(),
			"total_utilized":      func() float64 { t := 0.0; for _, p := range filtered { t += p.BudgetUtilized }; return t }(),
			"total_beneficiaries": func() int { t := 0; for _, p := range filtered { t += p.CurrentBeneficiaries }; return t }(),
		},
	})
}

func handleCheckProgramEligibility(w http.ResponseWriter, r *http.Request) {
	farmerID := r.URL.Query().Get("farmer_id")
	if farmerID == "" {
		http.Error(w, "farmer_id is required", http.StatusBadRequest)
		return
	}
	
	// Mock farmer data - in production, this would query the database
	farmerData := map[string]interface{}{
		"farmer_type":        "smallholder",
		"farm_size":          3.5,
		"has_bvn":            true,
		"linked_anchor":      true,
		"has_cac":            false,
		"training_completed": true,
		"activity":           "crop_production",
	}
	
	eligiblePrograms := []map[string]interface{}{}
	
	for _, program := range governmentPrograms {
		eligible := true
		criteriaResults := []map[string]interface{}{}
		
		for _, criterion := range program.EligibilityCriteria {
			met := false
			farmerValue := farmerData[criterion.Field]
			
			switch criterion.Operator {
			case "equals":
				met = farmerValue == criterion.Value
			case "min":
				if fv, ok := farmerValue.(float64); ok {
					if cv, ok := criterion.Value.(float64); ok {
						met = fv >= cv
					}
				}
			case "max":
				if fv, ok := farmerValue.(float64); ok {
					if cv, ok := criterion.Value.(float64); ok {
						met = fv <= cv
					}
				}
			case "in":
				if values, ok := criterion.Value.([]string); ok {
					if fv, ok := farmerValue.(string); ok {
						for _, v := range values {
							if v == fv {
								met = true
								break
							}
						}
					}
				}
			}
			
			criteriaResults = append(criteriaResults, map[string]interface{}{
				"criterion":   criterion.Description,
				"met":         met,
				"your_value":  farmerValue,
				"required":    criterion.Value,
			})
			
			if !met {
				eligible = false
			}
		}
		
		if eligible {
			eligiblePrograms = append(eligiblePrograms, map[string]interface{}{
				"program_id":      program.ID,
				"program_name":    program.Name,
				"sponsor":         program.Sponsor,
				"max_benefit":     program.MaxBenefitAmount,
				"interest_rate":   program.InterestRate,
				"criteria_check":  criteriaResults,
				"apply_now":       true,
			})
		}
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"farmer_id":         farmerID,
		"eligible_programs": eligiblePrograms,
		"total_eligible":    len(eligiblePrograms),
		"recommendation":    "ABP recommended for smallholder farmers with anchor linkage",
	})
}

func handleEnrollInProgram(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	var request struct {
		ProgramID     string  `json:"program_id"`
		FarmerID      string  `json:"farmer_id"`
		CooperativeID string  `json:"cooperative_id,omitempty"`
		RequestedAmount float64 `json:"requested_amount"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	enrollment := ProgramEnrollment{
		ID:              fmt.Sprintf("ENR-%d", time.Now().UnixNano()),
		ProgramID:       request.ProgramID,
		FarmerID:        request.FarmerID,
		CooperativeID:   request.CooperativeID,
		ApplicationDate: time.Now(),
		Status:          "pending",
		ApprovedAmount:  0,
		DisbursedAmount: 0,
		RepaidAmount:    0,
		MEData:          map[string]interface{}{},
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"enrollment": enrollment,
		"message":    "Program enrollment submitted",
		"next_steps": []string{
			"Application under review",
			"Document verification",
			"Approval notification via SMS",
		},
	})
}

func handleConfigureProgram(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	var request struct {
		ProgramCode         string                 `json:"program_code"`
		Name                string                 `json:"name"`
		Sponsor             string                 `json:"sponsor"`
		ProgramType         string                 `json:"program_type"`
		EligibilityCriteria []EligibilityCriterion `json:"eligibility_criteria"`
		Benefits            []ProgramBenefit       `json:"benefits"`
		MaxBenefitAmount    float64                `json:"max_benefit_amount"`
		InterestRate        float64                `json:"interest_rate,omitempty"`
		TenorMonths         int                    `json:"tenor_months,omitempty"`
		GracePeriodMonths   int                    `json:"grace_period_months,omitempty"`
		BudgetAllocated     float64                `json:"budget_allocated"`
		StartDate           string                 `json:"start_date"`
		EndDate             string                 `json:"end_date"`
		MEDataRequired      []string               `json:"me_data_required"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	startDate, _ := time.Parse("2006-01-02", request.StartDate)
	endDate, _ := time.Parse("2006-01-02", request.EndDate)
	
	program := GovernmentProgram{
		ID:                  fmt.Sprintf("PROG-%s-%d", request.ProgramCode, time.Now().UnixNano()%10000),
		ProgramCode:         request.ProgramCode,
		Name:                request.Name,
		Sponsor:             request.Sponsor,
		ProgramType:         request.ProgramType,
		EligibilityCriteria: request.EligibilityCriteria,
		Benefits:            request.Benefits,
		MaxBenefitAmount:    request.MaxBenefitAmount,
		InterestRate:        request.InterestRate,
		TenorMonths:         request.TenorMonths,
		GracePeriodMonths:   request.GracePeriodMonths,
		BudgetAllocated:     request.BudgetAllocated,
		StartDate:           startDate,
		EndDate:             endDate,
		Status:              "draft",
		MEDataRequired:      request.MEDataRequired,
	}
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"program": program,
		"message": "Program configured successfully",
		"note":    "Program is in draft status. Activate when ready to accept applications.",
	})
}

func handleRecordPartnerTransaction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	var request struct {
		PartnerID       string  `json:"partner_id"`
		PartnerType     string  `json:"partner_type"`
		FarmerID        string  `json:"farmer_id"`
		TransactionType string  `json:"transaction_type"`
		Amount          float64 `json:"amount"`
		Quantity        float64 `json:"quantity,omitempty"`
		Unit            string  `json:"unit,omitempty"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	transaction := PartnerTransaction{
		ID:              fmt.Sprintf("TXN-%d", time.Now().UnixNano()),
		PartnerID:       request.PartnerID,
		PartnerType:     request.PartnerType,
		FarmerID:        request.FarmerID,
		TransactionType: request.TransactionType,
		Amount:          request.Amount,
		Quantity:        request.Quantity,
		Unit:            request.Unit,
		Reference:       fmt.Sprintf("REF%d", time.Now().UnixNano()%1000000),
		Status:          "completed",
		Timestamp:       time.Now(),
	}
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"transaction": transaction,
		"message":     "Transaction recorded successfully",
	})
}

// RegisterPartnerEcosystemRoutes registers all partner ecosystem routes
func RegisterPartnerEcosystemRoutes(r *mux.Router) {
	// NOTE: GET /api/v1/agriculture/partners and GET /api/v1/agriculture/programs are
	// registered by AgriculturalService.RegisterRoutes — only sub-routes are added here.
	r.HandleFunc("/api/v1/agriculture/partners/onboard", handleOnboardPartner).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/partners/transactions", handleRecordPartnerTransaction).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/programs/check-eligibility", handleCheckProgramEligibility).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/programs/enroll", handleEnrollInProgram).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/programs/configure", handleConfigureProgram).Methods("POST")
}
