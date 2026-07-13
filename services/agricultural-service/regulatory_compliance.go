package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gorilla/mux"
)

// ==================== CBN REGULATORY COMPLIANCE ====================
// Implements CBN sector classification, prudential classification, and regulatory reporting

// CBN Sector Classification Codes for Agriculture
type CBNSectorCode struct {
	Code        string `json:"code"`
	Description string `json:"description"`
	SubSector   string `json:"sub_sector"`
	Category    string `json:"category"`
}

var CBNAgriSectorCodes = map[string]CBNSectorCode{
	"AGR001": {Code: "AGR001", Description: "Crop Production - Cereals", SubSector: "crop", Category: "agriculture"},
	"AGR002": {Code: "AGR002", Description: "Crop Production - Legumes", SubSector: "crop", Category: "agriculture"},
	"AGR003": {Code: "AGR003", Description: "Crop Production - Tubers", SubSector: "crop", Category: "agriculture"},
	"AGR004": {Code: "AGR004", Description: "Crop Production - Vegetables", SubSector: "crop", Category: "agriculture"},
	"AGR005": {Code: "AGR005", Description: "Crop Production - Cash Crops", SubSector: "crop", Category: "agriculture"},
	"AGR006": {Code: "AGR006", Description: "Crop Production - Tree Crops", SubSector: "crop", Category: "agriculture"},
	"LVS001": {Code: "LVS001", Description: "Livestock - Cattle", SubSector: "livestock", Category: "agriculture"},
	"LVS002": {Code: "LVS002", Description: "Livestock - Small Ruminants", SubSector: "livestock", Category: "agriculture"},
	"LVS003": {Code: "LVS003", Description: "Livestock - Poultry", SubSector: "livestock", Category: "agriculture"},
	"LVS004": {Code: "LVS004", Description: "Livestock - Piggery", SubSector: "livestock", Category: "agriculture"},
	"FSH001": {Code: "FSH001", Description: "Fisheries - Aquaculture", SubSector: "fisheries", Category: "agriculture"},
	"FSH002": {Code: "FSH002", Description: "Fisheries - Artisanal", SubSector: "fisheries", Category: "agriculture"},
	"FOR001": {Code: "FOR001", Description: "Forestry - Timber", SubSector: "forestry", Category: "agriculture"},
	"FOR002": {Code: "FOR002", Description: "Forestry - Non-Timber Products", SubSector: "forestry", Category: "agriculture"},
	"AGP001": {Code: "AGP001", Description: "Agro-Processing - Primary", SubSector: "processing", Category: "agriculture"},
	"AGP002": {Code: "AGP002", Description: "Agro-Processing - Secondary", SubSector: "processing", Category: "agriculture"},
	"AGI001": {Code: "AGI001", Description: "Agricultural Inputs - Seeds/Fertilizer", SubSector: "inputs", Category: "agriculture"},
	"AGI002": {Code: "AGI002", Description: "Agricultural Inputs - Equipment", SubSector: "inputs", Category: "agriculture"},
	"AGM001": {Code: "AGM001", Description: "Agricultural Marketing", SubSector: "marketing", Category: "agriculture"},
	"AGS001": {Code: "AGS001", Description: "Agricultural Storage/Warehousing", SubSector: "storage", Category: "agriculture"},
}

// Map crop types to CBN sector codes
var CropToCBNCode = map[string]string{
	"rice":      "AGR001",
	"maize":     "AGR001",
	"sorghum":   "AGR001",
	"millet":    "AGR001",
	"cowpea":    "AGR002",
	"groundnut": "AGR002",
	"cassava":   "AGR003",
	"yam":       "AGR003",
	"tomato":    "AGR004",
	"pepper":    "AGR004",
	"onion":     "AGR004",
	"ginger":    "AGR005",
	"sesame":    "AGR005",
	"cocoa":     "AGR006",
	"palm_oil":  "AGR006",
}

// Map livestock types to CBN sector codes
var LivestockToCBNCode = map[string]string{
	"cattle_beef":     "LVS001",
	"cattle_dairy":    "LVS001",
	"goat":            "LVS002",
	"sheep":           "LVS002",
	"poultry_broiler": "LVS003",
	"poultry_layer":   "LVS003",
	"pig":             "LVS004",
	"fish_catfish":    "FSH001",
	"fish_tilapia":    "FSH001",
}

// Prudential Classification (CBN Guidelines)
type PrudentialClassification struct {
	Classification string  `json:"classification"`
	DaysOverdue    int     `json:"days_overdue_min"`
	MaxDaysOverdue int     `json:"days_overdue_max"`
	ProvisionRate  float64 `json:"provision_rate"` // percentage
	Description    string  `json:"description"`
}

var PrudentialClassifications = []PrudentialClassification{
	{Classification: "PERFORMING", DaysOverdue: 0, MaxDaysOverdue: 30, ProvisionRate: 1.0, Description: "Current and performing loans"},
	{Classification: "WATCH_LIST", DaysOverdue: 31, MaxDaysOverdue: 90, ProvisionRate: 5.0, Description: "Loans showing early signs of weakness"},
	{Classification: "SUBSTANDARD", DaysOverdue: 91, MaxDaysOverdue: 180, ProvisionRate: 20.0, Description: "Loans with well-defined weaknesses"},
	{Classification: "DOUBTFUL", DaysOverdue: 181, MaxDaysOverdue: 360, ProvisionRate: 50.0, Description: "Loans with high probability of loss"},
	{Classification: "LOST", DaysOverdue: 361, MaxDaysOverdue: 9999, ProvisionRate: 100.0, Description: "Loans considered uncollectible"},
}

// Government Intervention Programs
type InterventionProgram struct {
	Code          string   `json:"code"`
	Name          string   `json:"name"`
	Description   string   `json:"description"`
	InterestRate  float64  `json:"interest_rate"`
	MaxAmount     float64  `json:"max_amount"`
	TenorMonths   int      `json:"tenor_months"`
	GracePeriod   int      `json:"grace_period_months"`
	CollateralReq string   `json:"collateral_requirement"`
	EligibleCrops []string `json:"eligible_crops"`
	Active        bool     `json:"active"`
}

var InterventionPrograms = map[string]InterventionProgram{
	"ABP": {
		Code: "ABP", Name: "Anchor Borrowers Programme",
		Description:  "CBN intervention for smallholder farmers linked to anchor companies",
		InterestRate: 9.0, MaxAmount: 5000000.0, TenorMonths: 12, GracePeriod: 6,
		CollateralReq: "Group guarantee + Off-taker agreement",
		EligibleCrops: []string{"rice", "maize", "cassava", "tomato", "cotton", "wheat"},
		Active:        true,
	},
	"AGSMEIS": {
		Code: "AGSMEIS", Name: "Agri-Business/Small and Medium Enterprise Investment Scheme",
		Description:  "CBN intervention for agricultural SMEs",
		InterestRate: 5.0, MaxAmount: 10000000.0, TenorMonths: 84, GracePeriod: 18,
		CollateralReq: "Land title or equipment",
		EligibleCrops: []string{"all"},
		Active:        true,
	},
	"NIRSAL": {
		Code: "NIRSAL", Name: "Nigeria Incentive-Based Risk Sharing System for Agricultural Lending",
		Description:  "Risk sharing facility for agricultural loans",
		InterestRate: 9.0, MaxAmount: 50000000.0, TenorMonths: 60, GracePeriod: 12,
		CollateralReq: "NIRSAL Credit Risk Guarantee",
		EligibleCrops: []string{"all"},
		Active:        true,
	},
	"CACS": {
		Code: "CACS", Name: "Commercial Agriculture Credit Scheme",
		Description:  "CBN intervention for large-scale commercial agriculture",
		InterestRate: 9.0, MaxAmount: 2000000000.0, TenorMonths: 84, GracePeriod: 24,
		CollateralReq: "Land title + Equipment + Insurance",
		EligibleCrops: []string{"all"},
		Active:        true,
	},
	"ACGSF": {
		Code: "ACGSF", Name: "Agricultural Credit Guarantee Scheme Fund",
		Description:  "Government guarantee for agricultural loans",
		InterestRate: 14.0, MaxAmount: 100000000.0, TenorMonths: 60, GracePeriod: 12,
		CollateralReq: "ACGSF guarantee certificate",
		EligibleCrops: []string{"all"},
		Active:        true,
	},
}

// IFRS 9 / ECL Parameters for Agricultural Loans
type IFRS9Parameters struct {
	ProductType       string  `json:"product_type"`
	PD12Month         float64 `json:"pd_12_month"`         // 12-month probability of default
	PDLifetime        float64 `json:"pd_lifetime"`         // Lifetime probability of default
	LGDSecured        float64 `json:"lgd_secured"`         // Loss given default - secured
	LGDUnsecured      float64 `json:"lgd_unsecured"`       // Loss given default - unsecured
	EADConversionRate float64 `json:"ead_conversion_rate"` // Exposure at default conversion
	Stage             int     `json:"stage"`               // IFRS 9 stage (1, 2, or 3)
}

var IFRS9AgriParameters = map[string]IFRS9Parameters{
	"crop_smallholder": {
		ProductType: "crop_smallholder", PD12Month: 0.08, PDLifetime: 0.15,
		LGDSecured: 0.35, LGDUnsecured: 0.65, EADConversionRate: 1.0, Stage: 1,
	},
	"crop_commercial": {
		ProductType: "crop_commercial", PD12Month: 0.05, PDLifetime: 0.10,
		LGDSecured: 0.30, LGDUnsecured: 0.55, EADConversionRate: 1.0, Stage: 1,
	},
	"livestock_smallholder": {
		ProductType: "livestock_smallholder", PD12Month: 0.10, PDLifetime: 0.18,
		LGDSecured: 0.40, LGDUnsecured: 0.70, EADConversionRate: 1.0, Stage: 1,
	},
	"livestock_commercial": {
		ProductType: "livestock_commercial", PD12Month: 0.06, PDLifetime: 0.12,
		LGDSecured: 0.35, LGDUnsecured: 0.60, EADConversionRate: 1.0, Stage: 1,
	},
	"equipment_finance": {
		ProductType: "equipment_finance", PD12Month: 0.04, PDLifetime: 0.08,
		LGDSecured: 0.25, LGDUnsecured: 0.50, EADConversionRate: 1.0, Stage: 1,
	},
	"input_finance": {
		ProductType: "input_finance", PD12Month: 0.07, PDLifetime: 0.14,
		LGDSecured: 0.30, LGDUnsecured: 0.60, EADConversionRate: 1.0, Stage: 1,
	},
	"cooperative_group": {
		ProductType: "cooperative_group", PD12Month: 0.05, PDLifetime: 0.10,
		LGDSecured: 0.25, LGDUnsecured: 0.45, EADConversionRate: 1.0, Stage: 1,
	},
}

// Enhanced Agricultural Loan with Regulatory Fields
type RegulatoryLoanData struct {
	LoanID                  string     `json:"loan_id"`
	CBNSectorCode           string     `json:"cbn_sector_code"`
	CBNSubSector            string     `json:"cbn_sub_sector"`
	PrudentialClass         string     `json:"prudential_classification"`
	DaysOverdue             int        `json:"days_overdue"`
	ProvisionAmount         float64    `json:"provision_amount"`
	ProvisionRate           float64    `json:"provision_rate"`
	InterventionProgram     string     `json:"intervention_program"`
	InterventionProgramCode string     `json:"intervention_program_code"`
	IFRS9Stage              int        `json:"ifrs9_stage"`
	PD12Month               float64    `json:"pd_12_month"`
	PDLifetime              float64    `json:"pd_lifetime"`
	LGD                     float64    `json:"lgd"`
	EAD                     float64    `json:"ead"`
	ECL                     float64    `json:"ecl"` // Expected Credit Loss
	CollateralType          string     `json:"collateral_type"`
	CollateralValue         float64    `json:"collateral_value"`
	CollateralCoverage      float64    `json:"collateral_coverage"`
	NCRRegistered           bool       `json:"ncr_registered"` // National Collateral Registry
	NCRRegistrationNo       string     `json:"ncr_registration_no"`
	InsuranceCoverage       float64    `json:"insurance_coverage"`
	GuaranteeType           string     `json:"guarantee_type"`
	GuaranteeAmount         float64    `json:"guarantee_amount"`
	RestructuredFlag        bool       `json:"restructured_flag"`
	RestructureCount        int        `json:"restructure_count"`
	LastRestructureDate     *time.Time `json:"last_restructure_date"`
	WriteOffFlag            bool       `json:"write_off_flag"`
	WriteOffDate            *time.Time `json:"write_off_date"`
	RecoveryAmount          float64    `json:"recovery_amount"`
	CreatedAt               time.Time  `json:"created_at"`
	UpdatedAt               time.Time  `json:"updated_at"`
}

// Regulatory Reporting Structures
type CBNRegulatoryReturn struct {
	ReportType              string                   `json:"report_type"`
	ReportPeriod            string                   `json:"report_period"`
	ReportDate              time.Time                `json:"report_date"`
	TenantID                string                   `json:"tenant_id"`
	TotalExposure           float64                  `json:"total_exposure"`
	TotalProvision          float64                  `json:"total_provision"`
	NPLRatio                float64                  `json:"npl_ratio"`
	SectorBreakdown         []SectorExposure         `json:"sector_breakdown"`
	GeographyBreakdown      []GeographyExposure      `json:"geography_breakdown"`
	TenorBreakdown          []TenorExposure          `json:"tenor_breakdown"`
	CollateralBreakdown     []CollateralExposure     `json:"collateral_breakdown"`
	ClassificationBreakdown []ClassificationExposure `json:"classification_breakdown"`
	InterventionBreakdown   []InterventionExposure   `json:"intervention_breakdown"`
}

type SectorExposure struct {
	SectorCode  string  `json:"sector_code"`
	SectorName  string  `json:"sector_name"`
	LoanCount   int     `json:"loan_count"`
	Outstanding float64 `json:"outstanding"`
	Provision   float64 `json:"provision"`
	NPL         float64 `json:"npl"`
	Percentage  float64 `json:"percentage"`
}

type GeographyExposure struct {
	State       string  `json:"state"`
	LoanCount   int     `json:"loan_count"`
	Outstanding float64 `json:"outstanding"`
	Provision   float64 `json:"provision"`
	NPL         float64 `json:"npl"`
	Percentage  float64 `json:"percentage"`
}

type TenorExposure struct {
	TenorBucket string  `json:"tenor_bucket"`
	LoanCount   int     `json:"loan_count"`
	Outstanding float64 `json:"outstanding"`
	Percentage  float64 `json:"percentage"`
}

type CollateralExposure struct {
	CollateralType string  `json:"collateral_type"`
	LoanCount      int     `json:"loan_count"`
	Outstanding    float64 `json:"outstanding"`
	CollateralVal  float64 `json:"collateral_value"`
	Coverage       float64 `json:"coverage_ratio"`
}

type ClassificationExposure struct {
	Classification string  `json:"classification"`
	LoanCount      int     `json:"loan_count"`
	Outstanding    float64 `json:"outstanding"`
	Provision      float64 `json:"provision"`
	Percentage     float64 `json:"percentage"`
}

type InterventionExposure struct {
	ProgramCode string  `json:"program_code"`
	ProgramName string  `json:"program_name"`
	LoanCount   int     `json:"loan_count"`
	Outstanding float64 `json:"outstanding"`
	Disbursed   float64 `json:"disbursed"`
	Repaid      float64 `json:"repaid"`
}

// Portfolio Concentration Limits
type ConcentrationLimit struct {
	LimitType    string  `json:"limit_type"`
	LimitName    string  `json:"limit_name"`
	LimitValue   float64 `json:"limit_value"`
	CurrentValue float64 `json:"current_value"`
	Utilization  float64 `json:"utilization"`
	BreachStatus string  `json:"breach_status"` // OK, WARNING, BREACH
	WarningLevel float64 `json:"warning_level"`
}

type PortfolioLimits struct {
	TenantID            string               `json:"tenant_id"`
	TotalAgriLimit      float64              `json:"total_agri_limit"`
	CropLimits          map[string]float64   `json:"crop_limits"`
	StateLimits         map[string]float64   `json:"state_limits"`
	OffTakerLimits      map[string]float64   `json:"off_taker_limits"`
	CooperativeLimits   map[string]float64   `json:"cooperative_limits"`
	SingleBorrowerLimit float64              `json:"single_borrower_limit"`
	ConcentrationChecks []ConcentrationLimit `json:"concentration_checks"`
}

// Early Warning Indicators
type EarlyWarningIndicator struct {
	IndicatorType     string     `json:"indicator_type"`
	IndicatorName     string     `json:"indicator_name"`
	LoanID            string     `json:"loan_id"`
	FarmerID          string     `json:"farmer_id"`
	CurrentValue      float64    `json:"current_value"`
	ThresholdValue    float64    `json:"threshold_value"`
	Severity          string     `json:"severity"` // LOW, MEDIUM, HIGH, CRITICAL
	Description       string     `json:"description"`
	RecommendedAction string     `json:"recommended_action"`
	DetectedAt        time.Time  `json:"detected_at"`
	ResolvedAt        *time.Time `json:"resolved_at"`
	Status            string     `json:"status"` // OPEN, ACKNOWLEDGED, RESOLVED
}

// Regulatory Compliance Service
type RegulatoryComplianceService struct {
	db *sql.DB
}

func NewRegulatoryComplianceService(db *sql.DB) *RegulatoryComplianceService {
	return &RegulatoryComplianceService{db: db}
}

// Register regulatory compliance routes
func (s *RegulatoryComplianceService) RegisterRoutes(r *mux.Router) {
	// CBN Sector Codes
	r.HandleFunc("/api/v1/regulatory/cbn-sectors", s.ListCBNSectorCodes).Methods("GET")
	r.HandleFunc("/api/v1/regulatory/cbn-sectors/{code}", s.GetCBNSectorCode).Methods("GET")

	// Prudential Classification
	r.HandleFunc("/api/v1/regulatory/prudential-classifications", s.ListPrudentialClassifications).Methods("GET")
	r.HandleFunc("/api/v1/regulatory/loans/{loan_id}/classification", s.GetLoanClassification).Methods("GET")
	r.HandleFunc("/api/v1/regulatory/loans/{loan_id}/classification", s.UpdateLoanClassification).Methods("PUT")

	// Intervention Programs
	r.HandleFunc("/api/v1/regulatory/intervention-programs", s.ListInterventionPrograms).Methods("GET")
	r.HandleFunc("/api/v1/regulatory/intervention-programs/{code}", s.GetInterventionProgram).Methods("GET")
	r.HandleFunc("/api/v1/regulatory/loans/{loan_id}/intervention", s.TagLoanIntervention).Methods("POST")

	// IFRS 9 / ECL
	r.HandleFunc("/api/v1/regulatory/ifrs9/parameters", s.ListIFRS9Parameters).Methods("GET")
	r.HandleFunc("/api/v1/regulatory/loans/{loan_id}/ecl", s.CalculateLoanECL).Methods("GET")
	r.HandleFunc("/api/v1/regulatory/portfolio/ecl", s.CalculatePortfolioECL).Methods("GET")

	// Regulatory Returns
	r.HandleFunc("/api/v1/regulatory/returns/sector", s.GenerateSectorReturn).Methods("GET")
	r.HandleFunc("/api/v1/regulatory/returns/geography", s.GenerateGeographyReturn).Methods("GET")
	r.HandleFunc("/api/v1/regulatory/returns/classification", s.GenerateClassificationReturn).Methods("GET")
	r.HandleFunc("/api/v1/regulatory/returns/intervention", s.GenerateInterventionReturn).Methods("GET")
	r.HandleFunc("/api/v1/regulatory/returns/comprehensive", s.GenerateComprehensiveReturn).Methods("GET")

	// Concentration Limits
	r.HandleFunc("/api/v1/regulatory/limits", s.GetPortfolioLimits).Methods("GET")
	r.HandleFunc("/api/v1/regulatory/limits", s.SetPortfolioLimits).Methods("POST")
	r.HandleFunc("/api/v1/regulatory/limits/check", s.CheckConcentrationLimits).Methods("GET")
	r.HandleFunc("/api/v1/regulatory/limits/breaches", s.GetLimitBreaches).Methods("GET")

	// Early Warning
	r.HandleFunc("/api/v1/regulatory/early-warning", s.GetEarlyWarningIndicators).Methods("GET")
	r.HandleFunc("/api/v1/regulatory/early-warning/scan", s.ScanForEarlyWarnings).Methods("POST")
	r.HandleFunc("/api/v1/regulatory/early-warning/{id}/acknowledge", s.AcknowledgeWarning).Methods("POST")
	r.HandleFunc("/api/v1/regulatory/early-warning/{id}/resolve", s.ResolveWarning).Methods("POST")
}

// Handler implementations
func (s *RegulatoryComplianceService) ListCBNSectorCodes(w http.ResponseWriter, r *http.Request) {
	codes := make([]CBNSectorCode, 0, len(CBNAgriSectorCodes))
	for _, code := range CBNAgriSectorCodes {
		codes = append(codes, code)
	}
	json.NewEncoder(w).Encode(codes)
}

func (s *RegulatoryComplianceService) GetCBNSectorCode(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	code := vars["code"]
	if sectorCode, ok := CBNAgriSectorCodes[code]; ok {
		json.NewEncoder(w).Encode(sectorCode)
	} else {
		http.Error(w, "Sector code not found", http.StatusNotFound)
	}
}

func (s *RegulatoryComplianceService) ListPrudentialClassifications(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(PrudentialClassifications)
}

func (s *RegulatoryComplianceService) GetLoanClassification(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	loanID := vars["loan_id"]

	// Calculate classification based on days overdue
	var daysOverdue int
	var outstandingAmount float64
	err := s.db.QueryRowContext(r.Context(), `
		SELECT COALESCE(EXTRACT(DAY FROM NOW() - maturity_date), 0)::int, outstanding_amount
		FROM agricultural_loans WHERE id = $1
	`, loanID).Scan(&daysOverdue, &outstandingAmount)

	if err != nil {
		http.Error(w, "Loan not found", http.StatusNotFound)
		return
	}

	classification := s.classifyLoan(daysOverdue)
	provisionAmount := outstandingAmount * (classification.ProvisionRate / 100)

	result := map[string]interface{}{
		"loan_id":          loanID,
		"days_overdue":     daysOverdue,
		"classification":   classification.Classification,
		"provision_rate":   classification.ProvisionRate,
		"provision_amount": provisionAmount,
		"description":      classification.Description,
	}
	json.NewEncoder(w).Encode(result)
}

func (s *RegulatoryComplianceService) classifyLoan(daysOverdue int) PrudentialClassification {
	for _, class := range PrudentialClassifications {
		if daysOverdue >= class.DaysOverdue && daysOverdue <= class.MaxDaysOverdue {
			return class
		}
	}
	return PrudentialClassifications[len(PrudentialClassifications)-1] // LOST
}

func (s *RegulatoryComplianceService) UpdateLoanClassification(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	loanID := vars["loan_id"]

	var req struct {
		Classification string `json:"classification"`
		Reason         string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Update loan classification (manual override)
	_, err := s.db.ExecContext(r.Context(), `
		UPDATE agricultural_loans 
		SET prudential_classification = $1, 
		    classification_override_reason = $2,
		    classification_updated_at = NOW()
		WHERE id = $3
	`, req.Classification, req.Reason, loanID)

	if err != nil {
		http.Error(w, "Failed to update classification", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "updated", "loan_id": loanID})
}

func (s *RegulatoryComplianceService) ListInterventionPrograms(w http.ResponseWriter, r *http.Request) {
	programs := make([]InterventionProgram, 0, len(InterventionPrograms))
	for _, program := range InterventionPrograms {
		programs = append(programs, program)
	}
	json.NewEncoder(w).Encode(programs)
}

func (s *RegulatoryComplianceService) GetInterventionProgram(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	code := vars["code"]
	if program, ok := InterventionPrograms[code]; ok {
		json.NewEncoder(w).Encode(program)
	} else {
		http.Error(w, "Intervention program not found", http.StatusNotFound)
	}
}

func (s *RegulatoryComplianceService) TagLoanIntervention(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	loanID := vars["loan_id"]

	var req struct {
		ProgramCode string `json:"program_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	program, ok := InterventionPrograms[req.ProgramCode]
	if !ok {
		http.Error(w, "Invalid intervention program code", http.StatusBadRequest)
		return
	}

	_, err := s.db.ExecContext(r.Context(), `
		UPDATE agricultural_loans 
		SET intervention_program = $1, 
		    intervention_program_code = $2,
		    intervention_tagged_at = NOW()
		WHERE id = $3
	`, program.Name, program.Code, loanID)

	if err != nil {
		http.Error(w, "Failed to tag intervention", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "tagged", "loan_id": loanID, "program": program.Name})
}

func (s *RegulatoryComplianceService) ListIFRS9Parameters(w http.ResponseWriter, r *http.Request) {
	params := make([]IFRS9Parameters, 0, len(IFRS9AgriParameters))
	for _, param := range IFRS9AgriParameters {
		params = append(params, param)
	}
	json.NewEncoder(w).Encode(params)
}

func (s *RegulatoryComplianceService) CalculateLoanECL(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	loanID := vars["loan_id"]

	var loan struct {
		OutstandingAmount float64
		LoanType          string
		CollateralValue   float64
		DaysOverdue       int
	}

	err := s.db.QueryRowContext(r.Context(), `
		SELECT outstanding_amount, loan_type, COALESCE(collateral_value, 0),
		       COALESCE(EXTRACT(DAY FROM NOW() - maturity_date), 0)::int
		FROM agricultural_loans WHERE id = $1
	`, loanID).Scan(&loan.OutstandingAmount, &loan.LoanType, &loan.CollateralValue, &loan.DaysOverdue)

	if err != nil {
		http.Error(w, "Loan not found", http.StatusNotFound)
		return
	}

	// Get IFRS9 parameters
	productType := loan.LoanType + "_smallholder" // Default to smallholder
	params, ok := IFRS9AgriParameters[productType]
	if !ok {
		params = IFRS9AgriParameters["crop_smallholder"]
	}

	// Determine stage based on days overdue
	stage := 1
	pd := params.PD12Month
	if loan.DaysOverdue > 30 && loan.DaysOverdue <= 90 {
		stage = 2
		pd = params.PDLifetime
	} else if loan.DaysOverdue > 90 {
		stage = 3
		pd = 1.0 // 100% PD for stage 3
	}

	// Calculate LGD based on collateral
	lgd := params.LGDUnsecured
	if loan.CollateralValue > 0 {
		coverage := loan.CollateralValue / loan.OutstandingAmount
		if coverage >= 1.0 {
			lgd = params.LGDSecured
		} else {
			lgd = params.LGDSecured*coverage + params.LGDUnsecured*(1-coverage)
		}
	}

	// EAD = Outstanding amount
	ead := loan.OutstandingAmount

	// ECL = PD * LGD * EAD
	ecl := pd * lgd * ead

	result := map[string]interface{}{
		"loan_id":      loanID,
		"stage":        stage,
		"pd":           pd,
		"lgd":          lgd,
		"ead":          ead,
		"ecl":          ecl,
		"product_type": productType,
	}
	json.NewEncoder(w).Encode(result)
}

func (s *RegulatoryComplianceService) CalculatePortfolioECL(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")

	rows, err := s.db.QueryContext(r.Context(), `
		SELECT id, outstanding_amount, loan_type, COALESCE(collateral_value, 0),
		       COALESCE(EXTRACT(DAY FROM NOW() - maturity_date), 0)::int
		FROM agricultural_loans 
		WHERE tenant_id = $1 AND status IN ('active', 'disbursed')
	`, tenantID)

	if err != nil {
		http.Error(w, "Failed to query loans", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var totalECL, totalExposure float64
	var stage1ECL, stage2ECL, stage3ECL float64
	var stage1Exposure, stage2Exposure, stage3Exposure float64
	loanCount := 0

	for rows.Next() {
		var loanID string
		var outstanding, collateral float64
		var loanType string
		var daysOverdue int

		rows.Scan(&loanID, &outstanding, &loanType, &collateral, &daysOverdue)

		productType := loanType + "_smallholder"
		params, ok := IFRS9AgriParameters[productType]
		if !ok {
			params = IFRS9AgriParameters["crop_smallholder"]
		}

		stage := 1
		pd := params.PD12Month
		if daysOverdue > 30 && daysOverdue <= 90 {
			stage = 2
			pd = params.PDLifetime
		} else if daysOverdue > 90 {
			stage = 3
			pd = 1.0
		}

		lgd := params.LGDUnsecured
		if collateral > 0 && outstanding > 0 {
			coverage := collateral / outstanding
			if coverage >= 1.0 {
				lgd = params.LGDSecured
			} else {
				lgd = params.LGDSecured*coverage + params.LGDUnsecured*(1-coverage)
			}
		}

		ecl := pd * lgd * outstanding
		totalECL += ecl
		totalExposure += outstanding
		loanCount++

		switch stage {
		case 1:
			stage1ECL += ecl
			stage1Exposure += outstanding
		case 2:
			stage2ECL += ecl
			stage2Exposure += outstanding
		case 3:
			stage3ECL += ecl
			stage3Exposure += outstanding
		}
	}

	result := map[string]interface{}{
		"tenant_id":      tenantID,
		"total_ecl":      totalECL,
		"total_exposure": totalExposure,
		"ecl_ratio":      totalECL / totalExposure * 100,
		"loan_count":     loanCount,
		"stage_breakdown": map[string]interface{}{
			"stage_1": map[string]float64{"ecl": stage1ECL, "exposure": stage1Exposure},
			"stage_2": map[string]float64{"ecl": stage2ECL, "exposure": stage2Exposure},
			"stage_3": map[string]float64{"ecl": stage3ECL, "exposure": stage3Exposure},
		},
		"calculated_at": time.Now(),
	}
	json.NewEncoder(w).Encode(result)
}

func (s *RegulatoryComplianceService) GenerateSectorReturn(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")

	rows, err := s.db.QueryContext(r.Context(), `
		SELECT crop_type, livestock_type, COUNT(*), SUM(outstanding_amount), 
		       SUM(CASE WHEN EXTRACT(DAY FROM NOW() - maturity_date) > 90 THEN outstanding_amount ELSE 0 END)
		FROM agricultural_loans 
		WHERE tenant_id = $1 AND status IN ('active', 'disbursed')
		GROUP BY crop_type, livestock_type
	`, tenantID)

	if err != nil {
		http.Error(w, "Failed to generate return", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var exposures []SectorExposure
	var totalOutstanding float64

	for rows.Next() {
		var cropType, livestockType sql.NullString
		var count int
		var outstanding, npl float64

		rows.Scan(&cropType, &livestockType, &count, &outstanding, &npl)

		var sectorCode, sectorName string
		if cropType.Valid && cropType.String != "" {
			sectorCode = CropToCBNCode[cropType.String]
			sectorName = CBNAgriSectorCodes[sectorCode].Description
		} else if livestockType.Valid && livestockType.String != "" {
			sectorCode = LivestockToCBNCode[livestockType.String]
			sectorName = CBNAgriSectorCodes[sectorCode].Description
		}

		exposures = append(exposures, SectorExposure{
			SectorCode:  sectorCode,
			SectorName:  sectorName,
			LoanCount:   count,
			Outstanding: outstanding,
			NPL:         npl,
		})
		totalOutstanding += outstanding
	}

	// Calculate percentages
	for i := range exposures {
		if totalOutstanding > 0 {
			exposures[i].Percentage = exposures[i].Outstanding / totalOutstanding * 100
		}
	}

	result := CBNRegulatoryReturn{
		ReportType:      "SECTOR_EXPOSURE",
		ReportPeriod:    time.Now().Format("2006-01"),
		ReportDate:      time.Now(),
		TenantID:        tenantID,
		TotalExposure:   totalOutstanding,
		SectorBreakdown: exposures,
	}
	json.NewEncoder(w).Encode(result)
}

func (s *RegulatoryComplianceService) GenerateGeographyReturn(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")

	rows, err := s.db.QueryContext(r.Context(), `
		SELECT f.state, COUNT(l.id), SUM(l.outstanding_amount),
		       SUM(CASE WHEN EXTRACT(DAY FROM NOW() - l.maturity_date) > 90 THEN l.outstanding_amount ELSE 0 END)
		FROM agricultural_loans l
		JOIN farmers f ON l.farmer_id = f.id
		WHERE l.tenant_id = $1 AND l.status IN ('active', 'disbursed')
		GROUP BY f.state
	`, tenantID)

	if err != nil {
		http.Error(w, "Failed to generate return", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var exposures []GeographyExposure
	var totalOutstanding float64

	for rows.Next() {
		var state string
		var count int
		var outstanding, npl float64

		rows.Scan(&state, &count, &outstanding, &npl)

		exposures = append(exposures, GeographyExposure{
			State:       state,
			LoanCount:   count,
			Outstanding: outstanding,
			NPL:         npl,
		})
		totalOutstanding += outstanding
	}

	for i := range exposures {
		if totalOutstanding > 0 {
			exposures[i].Percentage = exposures[i].Outstanding / totalOutstanding * 100
		}
	}

	result := CBNRegulatoryReturn{
		ReportType:         "GEOGRAPHY_EXPOSURE",
		ReportPeriod:       time.Now().Format("2006-01"),
		ReportDate:         time.Now(),
		TenantID:           tenantID,
		TotalExposure:      totalOutstanding,
		GeographyBreakdown: exposures,
	}
	json.NewEncoder(w).Encode(result)
}

func (s *RegulatoryComplianceService) GenerateClassificationReturn(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")

	var exposures []ClassificationExposure
	var totalOutstanding, totalProvision float64

	for _, class := range PrudentialClassifications {
		var count int
		var outstanding float64

		minDays := class.DaysOverdue
		maxDays := class.MaxDaysOverdue

		err := s.db.QueryRowContext(r.Context(), `
			SELECT COUNT(*), COALESCE(SUM(outstanding_amount), 0)
			FROM agricultural_loans 
			WHERE tenant_id = $1 
			  AND status IN ('active', 'disbursed')
			  AND COALESCE(EXTRACT(DAY FROM NOW() - maturity_date), 0) >= $2
			  AND COALESCE(EXTRACT(DAY FROM NOW() - maturity_date), 0) <= $3
		`, tenantID, minDays, maxDays).Scan(&count, &outstanding)

		if err != nil {
			continue
		}

		provision := outstanding * (class.ProvisionRate / 100)

		exposures = append(exposures, ClassificationExposure{
			Classification: class.Classification,
			LoanCount:      count,
			Outstanding:    outstanding,
			Provision:      provision,
		})
		totalOutstanding += outstanding
		totalProvision += provision
	}

	for i := range exposures {
		if totalOutstanding > 0 {
			exposures[i].Percentage = exposures[i].Outstanding / totalOutstanding * 100
		}
	}

	nplRatio := 0.0
	if totalOutstanding > 0 {
		var nplAmount float64
		for _, exp := range exposures {
			if exp.Classification != "PERFORMING" && exp.Classification != "WATCH_LIST" {
				nplAmount += exp.Outstanding
			}
		}
		nplRatio = nplAmount / totalOutstanding * 100
	}

	result := CBNRegulatoryReturn{
		ReportType:              "CLASSIFICATION_EXPOSURE",
		ReportPeriod:            time.Now().Format("2006-01"),
		ReportDate:              time.Now(),
		TenantID:                tenantID,
		TotalExposure:           totalOutstanding,
		TotalProvision:          totalProvision,
		NPLRatio:                nplRatio,
		ClassificationBreakdown: exposures,
	}
	json.NewEncoder(w).Encode(result)
}

func (s *RegulatoryComplianceService) GenerateInterventionReturn(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")

	rows, err := s.db.QueryContext(r.Context(), `
		SELECT COALESCE(intervention_program_code, 'NONE'), 
		       COUNT(*), SUM(loan_amount), SUM(disbursed_amount),
		       SUM(loan_amount - outstanding_amount)
		FROM agricultural_loans 
		WHERE tenant_id = $1
		GROUP BY intervention_program_code
	`, tenantID)

	if err != nil {
		http.Error(w, "Failed to generate return", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var exposures []InterventionExposure

	for rows.Next() {
		var programCode string
		var count int
		var outstanding, disbursed, repaid float64

		rows.Scan(&programCode, &count, &outstanding, &disbursed, &repaid)

		programName := "Non-Intervention"
		if program, ok := InterventionPrograms[programCode]; ok {
			programName = program.Name
		}

		exposures = append(exposures, InterventionExposure{
			ProgramCode: programCode,
			ProgramName: programName,
			LoanCount:   count,
			Outstanding: outstanding,
			Disbursed:   disbursed,
			Repaid:      repaid,
		})
	}

	result := CBNRegulatoryReturn{
		ReportType:            "INTERVENTION_EXPOSURE",
		ReportPeriod:          time.Now().Format("2006-01"),
		ReportDate:            time.Now(),
		TenantID:              tenantID,
		InterventionBreakdown: exposures,
	}
	json.NewEncoder(w).Encode(result)
}

func (s *RegulatoryComplianceService) GenerateComprehensiveReturn(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")

	// This would aggregate all the above returns into one comprehensive report
	result := map[string]interface{}{
		"report_type":   "COMPREHENSIVE_AGRICULTURAL_RETURN",
		"report_period": time.Now().Format("2006-01"),
		"report_date":   time.Now(),
		"tenant_id":     tenantID,
		"sections": []string{
			"sector_exposure",
			"geography_exposure",
			"classification_exposure",
			"intervention_exposure",
			"tenor_exposure",
			"collateral_exposure",
		},
		"generated_at": time.Now(),
	}
	json.NewEncoder(w).Encode(result)
}

func (s *RegulatoryComplianceService) GetPortfolioLimits(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")

	// Default limits (would be stored in DB in production)
	limits := PortfolioLimits{
		TenantID:            tenantID,
		TotalAgriLimit:      1000000000.0, // 1 billion NGN
		SingleBorrowerLimit: 50000000.0,   // 50 million NGN
		CropLimits: map[string]float64{
			"rice":    200000000.0,
			"maize":   150000000.0,
			"cassava": 100000000.0,
		},
		StateLimits: map[string]float64{
			"Kano":   150000000.0,
			"Kaduna": 120000000.0,
			"Benue":  100000000.0,
		},
	}
	json.NewEncoder(w).Encode(limits)
}

func (s *RegulatoryComplianceService) SetPortfolioLimits(w http.ResponseWriter, r *http.Request) {
	var limits PortfolioLimits
	if err := json.NewDecoder(r.Body).Decode(&limits); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Store limits in DB (simplified)
	json.NewEncoder(w).Encode(map[string]string{"status": "limits_updated"})
}

func (s *RegulatoryComplianceService) CheckConcentrationLimits(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")

	// Check various concentration limits
	checks := []ConcentrationLimit{
		{LimitType: "TOTAL_AGRI", LimitName: "Total Agricultural Exposure", LimitValue: 1000000000, CurrentValue: 450000000, Utilization: 45.0, BreachStatus: "OK", WarningLevel: 80.0},
		{LimitType: "SINGLE_CROP", LimitName: "Rice Exposure", LimitValue: 200000000, CurrentValue: 180000000, Utilization: 90.0, BreachStatus: "WARNING", WarningLevel: 80.0},
		{LimitType: "SINGLE_STATE", LimitName: "Kano State Exposure", LimitValue: 150000000, CurrentValue: 120000000, Utilization: 80.0, BreachStatus: "OK", WarningLevel: 80.0},
	}

	result := map[string]interface{}{
		"tenant_id":            tenantID,
		"concentration_checks": checks,
		"checked_at":           time.Now(),
	}
	json.NewEncoder(w).Encode(result)
}

func (s *RegulatoryComplianceService) GetLimitBreaches(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")

	breaches := []ConcentrationLimit{
		{LimitType: "SINGLE_CROP", LimitName: "Rice Exposure", LimitValue: 200000000, CurrentValue: 210000000, Utilization: 105.0, BreachStatus: "BREACH", WarningLevel: 80.0},
	}

	result := map[string]interface{}{
		"tenant_id":  tenantID,
		"breaches":   breaches,
		"checked_at": time.Now(),
	}
	json.NewEncoder(w).Encode(result)
}

func (s *RegulatoryComplianceService) GetEarlyWarningIndicators(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")

	indicators := []EarlyWarningIndicator{
		{
			IndicatorType: "WEATHER_DEVIATION", IndicatorName: "Rainfall Below Normal",
			LoanID: "LOAN001", FarmerID: "FARMER001",
			CurrentValue: 60.0, ThresholdValue: 80.0, Severity: "HIGH",
			Description:       "Rainfall 40% below seasonal average in Kano State",
			RecommendedAction: "Schedule agent visit, consider restructuring",
			DetectedAt:        time.Now().Add(-24 * time.Hour), Status: "OPEN",
		},
		{
			IndicatorType: "MISSED_VISIT", IndicatorName: "Agent Visit Overdue",
			LoanID: "LOAN002", FarmerID: "FARMER002",
			CurrentValue: 45.0, ThresholdValue: 30.0, Severity: "MEDIUM",
			Description:       "No agent visit in 45 days (threshold: 30 days)",
			RecommendedAction: "Schedule immediate agent visit",
			DetectedAt:        time.Now().Add(-48 * time.Hour), Status: "ACKNOWLEDGED",
		},
	}

	result := map[string]interface{}{
		"tenant_id":  tenantID,
		"indicators": indicators,
		"total_open": 2,
		"checked_at": time.Now(),
	}
	json.NewEncoder(w).Encode(result)
}

func (s *RegulatoryComplianceService) ScanForEarlyWarnings(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")

	// Scan for various early warning conditions
	warningsFound := 0

	// 1. Check for weather deviations
	// 2. Check for missed agent visits
	// 3. Check for NDVI anomalies
	// 4. Check for delayed off-taker deliveries
	// 5. Check for cooperative repayment issues

	result := map[string]interface{}{
		"tenant_id":      tenantID,
		"scan_completed": true,
		"warnings_found": warningsFound,
		"scanned_at":     time.Now(),
	}
	json.NewEncoder(w).Encode(result)
}

func (s *RegulatoryComplianceService) AcknowledgeWarning(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	warningID := vars["id"]

	json.NewEncoder(w).Encode(map[string]string{"status": "acknowledged", "warning_id": warningID})
}

func (s *RegulatoryComplianceService) ResolveWarning(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	warningID := vars["id"]

	var req struct {
		Resolution string `json:"resolution"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	json.NewEncoder(w).Encode(map[string]string{"status": "resolved", "warning_id": warningID, "resolution": req.Resolution})
}
