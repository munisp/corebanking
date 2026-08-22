package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gorilla/mux"
)

// ============================================================================
// MICRO-INSURANCE AND PARAMETRIC TRIGGERS
// Weather index insurance, input insurance, automatic claims processing
// ============================================================================

// InsuranceProduct defines available agricultural insurance products
type InsuranceProduct struct {
	ID                 string              `json:"id"`
	Name               string              `json:"name"`
	Type               string              `json:"type"` // weather_index, crop, input, livestock, life_lite
	Description        string              `json:"description"`
	CoverageTypes      []string            `json:"coverage_types"`
	PremiumRateMin     float64             `json:"premium_rate_min"`
	PremiumRateMax     float64             `json:"premium_rate_max"`
	MaxCoverageAmount  float64             `json:"max_coverage_amount"`
	ParametricTriggers []ParametricTrigger `json:"parametric_triggers,omitempty"`
	EligibleCrops      []string            `json:"eligible_crops,omitempty"`
	EligibleRegions    []string            `json:"eligible_regions"`
	SubsidyAvailable   bool                `json:"subsidy_available"`
	SubsidyPercent     float64             `json:"subsidy_percent"`
	SubsidySource      string              `json:"subsidy_source,omitempty"`
	IsActive           bool                `json:"is_active"`
}

// ParametricTrigger defines automatic claim triggers
type ParametricTrigger struct {
	ID                string  `json:"id"`
	TriggerType       string  `json:"trigger_type"` // rainfall_deficit, rainfall_excess, temperature, ndvi
	Threshold         float64 `json:"threshold"`
	ThresholdUnit     string  `json:"threshold_unit"`
	ComparisonType    string  `json:"comparison_type"` // below, above, between
	MeasurementPeriod int     `json:"measurement_period_days"`
	PayoutPercent     float64 `json:"payout_percent"`
	DataSource        string  `json:"data_source"`
	AutoPayout        bool    `json:"auto_payout"`
}

// InsurancePolicy represents a farmer's insurance policy
type InsurancePolicy struct {
	ID               string           `json:"id"`
	FarmerID         string           `json:"farmer_id"`
	LoanID           string           `json:"loan_id,omitempty"`
	ProductID        string           `json:"product_id"`
	ProductName      string           `json:"product_name"`
	PolicyType       string           `json:"policy_type"`
	CropType         string           `json:"crop_type,omitempty"`
	FarmLocation     string           `json:"farm_location"`
	FarmSizeHectares float64          `json:"farm_size_hectares"`
	CoverageAmount   float64          `json:"coverage_amount"`
	PremiumAmount    float64          `json:"premium_amount"`
	SubsidyAmount    float64          `json:"subsidy_amount"`
	FarmerPremium    float64          `json:"farmer_premium"`
	PolicyStartDate  time.Time        `json:"policy_start_date"`
	PolicyEndDate    time.Time        `json:"policy_end_date"`
	Season           string           `json:"season"`
	Status           string           `json:"status"` // active, expired, claimed, cancelled
	LinkedTriggers   []string         `json:"linked_triggers"`
	ClaimHistory     []InsuranceClaim `json:"claim_history"`
	CreatedAt        time.Time        `json:"created_at"`
}

// InsuranceClaim represents a claim against a policy
type InsuranceClaim struct {
	ID              string                 `json:"id"`
	PolicyID        string                 `json:"policy_id"`
	FarmerID        string                 `json:"farmer_id"`
	ClaimType       string                 `json:"claim_type"` // parametric_auto, manual
	TriggerID       string                 `json:"trigger_id,omitempty"`
	TriggerEvent    string                 `json:"trigger_event"`
	TriggerData     map[string]interface{} `json:"trigger_data"`
	ClaimAmount     float64                `json:"claim_amount"`
	PayoutAmount    float64                `json:"payout_amount"`
	PayoutMethod    string                 `json:"payout_method"` // bank_transfer, mobile_money, loan_offset
	Status          string                 `json:"status"`        // pending, approved, paid, rejected
	AutoProcessed   bool                   `json:"auto_processed"`
	ProcessedAt     time.Time              `json:"processed_at,omitempty"`
	PaidAt          time.Time              `json:"paid_at,omitempty"`
	RejectionReason string                 `json:"rejection_reason,omitempty"`
	CreatedAt       time.Time              `json:"created_at"`
}

// WeatherIndexData for parametric trigger evaluation
type WeatherIndexData struct {
	Region             string    `json:"region"`
	Station            string    `json:"station"`
	Date               time.Time `json:"date"`
	RainfallMM         float64   `json:"rainfall_mm"`
	CumulativeRainfall float64   `json:"cumulative_rainfall_mm"`
	ExpectedRainfall   float64   `json:"expected_rainfall_mm"`
	RainfallDeficit    float64   `json:"rainfall_deficit_percent"`
	TemperatureMax     float64   `json:"temperature_max_c"`
	TemperatureMin     float64   `json:"temperature_min_c"`
	NDVIValue          float64   `json:"ndvi_value"`
	DataSource         string    `json:"data_source"`
}

// InsuranceBundle for loan-linked insurance
type InsuranceBundle struct {
	ID                 string            `json:"id"`
	LoanID             string            `json:"loan_id"`
	FarmerID           string            `json:"farmer_id"`
	Policies           []InsurancePolicy `json:"policies"`
	TotalPremium       float64           `json:"total_premium"`
	TotalSubsidy       float64           `json:"total_subsidy"`
	FarmerContribution float64           `json:"farmer_contribution"`
	BundleDiscount     float64           `json:"bundle_discount_percent"`
	Status             string            `json:"status"`
	CreatedAt          time.Time         `json:"created_at"`
}

// PortfolioGuarantee for cooperative/off-taker level guarantees
type PortfolioGuarantee struct {
	ID                  string    `json:"id"`
	GuarantorType       string    `json:"guarantor_type"` // nirsal, dfi, government, private
	GuarantorName       string    `json:"guarantor_name"`
	ProgramName         string    `json:"program_name"`
	CoveragePercent     float64   `json:"coverage_percent"`
	MaxGuaranteeAmount  float64   `json:"max_guarantee_amount"`
	UtilizedAmount      float64   `json:"utilized_amount"`
	AvailableAmount     float64   `json:"available_amount"`
	EligibilityCriteria []string  `json:"eligibility_criteria"`
	LinkedLoans         []string  `json:"linked_loans"`
	ValidFrom           time.Time `json:"valid_from"`
	ValidUntil          time.Time `json:"valid_until"`
	Status              string    `json:"status"`
}

// Available insurance products
var insuranceProducts = []InsuranceProduct{
	{
		ID:                "PROD-WI-001",
		Name:              "Weather Index Insurance - Rainfall",
		Type:              "weather_index",
		Description:       "Automatic payout when rainfall falls below or exceeds thresholds",
		CoverageTypes:     []string{"drought", "excess_rainfall"},
		PremiumRateMin:    3.0,
		PremiumRateMax:    8.0,
		MaxCoverageAmount: 5000000,
		ParametricTriggers: []ParametricTrigger{
			{
				ID:                "TRIG-RAIN-DEF",
				TriggerType:       "rainfall_deficit",
				Threshold:         40,
				ThresholdUnit:     "percent_below_normal",
				ComparisonType:    "below",
				MeasurementPeriod: 30,
				PayoutPercent:     50,
				DataSource:        "nimet_stations",
				AutoPayout:        true,
			},
			{
				ID:                "TRIG-RAIN-EXC",
				TriggerType:       "rainfall_excess",
				Threshold:         50,
				ThresholdUnit:     "percent_above_normal",
				ComparisonType:    "above",
				MeasurementPeriod: 7,
				PayoutPercent:     60,
				DataSource:        "nimet_stations",
				AutoPayout:        true,
			},
		},
		EligibleCrops:    []string{"maize", "rice", "sorghum", "millet", "cowpea"},
		EligibleRegions:  []string{"north_central", "north_west", "north_east"},
		SubsidyAvailable: true,
		SubsidyPercent:   50,
		SubsidySource:    "CBN_ACGSF",
		IsActive:         true,
	},
	{
		ID:                "PROD-WI-002",
		Name:              "NDVI Crop Health Insurance",
		Type:              "weather_index",
		Description:       "Automatic payout when satellite NDVI shows crop stress",
		CoverageTypes:     []string{"crop_failure", "yield_loss"},
		PremiumRateMin:    4.0,
		PremiumRateMax:    10.0,
		MaxCoverageAmount: 3000000,
		ParametricTriggers: []ParametricTrigger{
			{
				ID:                "TRIG-NDVI-LOW",
				TriggerType:       "ndvi",
				Threshold:         0.3,
				ThresholdUnit:     "ndvi_value",
				ComparisonType:    "below",
				MeasurementPeriod: 14,
				PayoutPercent:     70,
				DataSource:        "sentinel_satellite",
				AutoPayout:        true,
			},
		},
		EligibleCrops:    []string{"maize", "rice", "cassava", "sorghum"},
		EligibleRegions:  []string{"all"},
		SubsidyAvailable: true,
		SubsidyPercent:   40,
		SubsidySource:    "NAIC",
		IsActive:         true,
	},
	{
		ID:                "PROD-INP-001",
		Name:              "Input Protection Insurance",
		Type:              "input",
		Description:       "Covers loss of seeds, fertilizers, and other inputs",
		CoverageTypes:     []string{"input_loss", "germination_failure"},
		PremiumRateMin:    2.0,
		PremiumRateMax:    5.0,
		MaxCoverageAmount: 500000,
		EligibleCrops:     []string{"all"},
		EligibleRegions:   []string{"all"},
		SubsidyAvailable:  false,
		IsActive:          true,
	},
	{
		ID:                "PROD-LIFE-001",
		Name:              "Farmer Life-Lite Insurance",
		Type:              "life_lite",
		Description:       "Basic life coverage with loan balance protection",
		CoverageTypes:     []string{"death", "permanent_disability"},
		PremiumRateMin:    0.5,
		PremiumRateMax:    1.5,
		MaxCoverageAmount: 2000000,
		EligibleRegions:   []string{"all"},
		SubsidyAvailable:  false,
		IsActive:          true,
	},
}

// Portfolio guarantees available
var portfolioGuarantees = []PortfolioGuarantee{
	{
		ID:                 "GUAR-NIRSAL-001",
		GuarantorType:      "nirsal",
		GuarantorName:      "NIRSAL Plc",
		ProgramName:        "Agricultural Credit Guarantee",
		CoveragePercent:    75,
		MaxGuaranteeAmount: 500000000,
		UtilizedAmount:     150000000,
		AvailableAmount:    350000000,
		EligibilityCriteria: []string{
			"Registered farmer or cooperative",
			"Valid BVN",
			"Agricultural loan purpose",
			"Maximum loan N10M per farmer",
		},
		ValidFrom:  time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		ValidUntil: time.Date(2025, 12, 31, 0, 0, 0, 0, time.UTC),
		Status:     "active",
	},
	{
		ID:                 "GUAR-CBN-ABP",
		GuarantorType:      "government",
		GuarantorName:      "Central Bank of Nigeria",
		ProgramName:        "Anchor Borrowers Programme",
		CoveragePercent:    50,
		MaxGuaranteeAmount: 1000000000,
		UtilizedAmount:     400000000,
		AvailableAmount:    600000000,
		EligibilityCriteria: []string{
			"Smallholder farmer",
			"Linked to anchor/off-taker",
			"Approved crop value chain",
			"Maximum 5 hectares",
		},
		ValidFrom:  time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		ValidUntil: time.Date(2025, 12, 31, 0, 0, 0, 0, time.UTC),
		Status:     "active",
	},
}

// HTTP Handlers for Micro-Insurance

func handleGetInsuranceProducts(w http.ResponseWriter, r *http.Request) {
	productType := r.URL.Query().Get("type")
	cropType := r.URL.Query().Get("crop")

	filtered := make([]InsuranceProduct, 0)
	for _, product := range insuranceProducts {
		if productType != "" && product.Type != productType {
			continue
		}
		if cropType != "" {
			eligible := false
			for _, crop := range product.EligibleCrops {
				if crop == cropType || crop == "all" {
					eligible = true
					break
				}
			}
			if !eligible {
				continue
			}
		}
		filtered = append(filtered, product)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"products": filtered,
		"count":    len(filtered),
	})
}

func handleCreateInsurancePolicy(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var request struct {
		FarmerID         string  `json:"farmer_id"`
		LoanID           string  `json:"loan_id,omitempty"`
		ProductID        string  `json:"product_id"`
		CropType         string  `json:"crop_type"`
		FarmLocation     string  `json:"farm_location"`
		FarmSizeHectares float64 `json:"farm_size_hectares"`
		CoverageAmount   float64 `json:"coverage_amount"`
		Season           string  `json:"season"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Find product
	var product *InsuranceProduct
	for _, p := range insuranceProducts {
		if p.ID == request.ProductID {
			product = &p
			break
		}
	}
	if product == nil {
		http.Error(w, "Product not found", http.StatusNotFound)
		return
	}

	// Calculate premium
	premiumRate := (product.PremiumRateMin + product.PremiumRateMax) / 2 / 100
	premiumAmount := request.CoverageAmount * premiumRate
	subsidyAmount := 0.0
	if product.SubsidyAvailable {
		subsidyAmount = premiumAmount * (product.SubsidyPercent / 100)
	}
	farmerPremium := premiumAmount - subsidyAmount

	// Get trigger IDs
	triggerIDs := make([]string, len(product.ParametricTriggers))
	for i, t := range product.ParametricTriggers {
		triggerIDs[i] = t.ID
	}

	policy := InsurancePolicy{
		ID:               fmt.Sprintf("POL-%d", time.Now().UnixNano()),
		FarmerID:         request.FarmerID,
		LoanID:           request.LoanID,
		ProductID:        request.ProductID,
		ProductName:      product.Name,
		PolicyType:       product.Type,
		CropType:         request.CropType,
		FarmLocation:     request.FarmLocation,
		FarmSizeHectares: request.FarmSizeHectares,
		CoverageAmount:   request.CoverageAmount,
		PremiumAmount:    premiumAmount,
		SubsidyAmount:    subsidyAmount,
		FarmerPremium:    farmerPremium,
		PolicyStartDate:  time.Now(),
		PolicyEndDate:    time.Now().AddDate(0, 6, 0),
		Season:           request.Season,
		Status:           "active",
		LinkedTriggers:   triggerIDs,
		ClaimHistory:     []InsuranceClaim{},
		CreatedAt:        time.Now(),
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"policy":  policy,
		"message": "Insurance policy created successfully",
		"premium_breakdown": map[string]interface{}{
			"gross_premium":        premiumAmount,
			"subsidy":              subsidyAmount,
			"subsidy_source":       product.SubsidySource,
			"farmer_pays":          farmerPremium,
			"savings_from_subsidy": fmt.Sprintf("%.0f%%", product.SubsidyPercent),
		},
		"coverage_details": map[string]interface{}{
			"triggers":     product.ParametricTriggers,
			"auto_payout":  true,
			"no_paperwork": "Claims processed automatically based on weather data",
		},
	})
}

func handleEvaluateParametricTrigger(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var request struct {
		Region          string  `json:"region"`
		TriggerType     string  `json:"trigger_type"`
		MeasuredValue   float64 `json:"measured_value"`
		ExpectedValue   float64 `json:"expected_value"`
		MeasurementDate string  `json:"measurement_date"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Calculate deviation
	deviation := ((request.ExpectedValue - request.MeasuredValue) / request.ExpectedValue) * 100

	// Check against triggers
	triggeredPolicies := []map[string]interface{}{}
	totalPayout := 0.0

	// Mock: Find policies that would be triggered
	if request.TriggerType == "rainfall_deficit" && deviation >= 40 {
		// 40% deficit triggers payout
		payoutPercent := 50.0
		if deviation >= 60 {
			payoutPercent = 75.0
		}

		// Mock affected policies
		affectedPolicies := 25
		avgCoverage := 200000.0
		payout := avgCoverage * (payoutPercent / 100)
		totalPayout = payout * float64(affectedPolicies)

		for i := 0; i < 3; i++ { // Show sample
			triggeredPolicies = append(triggeredPolicies, map[string]interface{}{
				"policy_id":      fmt.Sprintf("POL-SAMPLE-%d", i+1),
				"farmer_id":      fmt.Sprintf("FRM-%d", 1000+i),
				"coverage":       avgCoverage,
				"payout_percent": payoutPercent,
				"payout_amount":  payout,
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"evaluation": map[string]interface{}{
			"region":            request.Region,
			"trigger_type":      request.TriggerType,
			"measured_value":    request.MeasuredValue,
			"expected_value":    request.ExpectedValue,
			"deviation_percent": deviation,
			"trigger_activated": deviation >= 40,
		},
		"affected_policies": len(triggeredPolicies),
		"sample_policies":   triggeredPolicies,
		"total_payout":      totalPayout,
		"auto_processing":   true,
		"message":           "Parametric trigger evaluated",
	})
}

func handleProcessAutoClaim(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var request struct {
		PolicyID      string                 `json:"policy_id"`
		TriggerID     string                 `json:"trigger_id"`
		TriggerEvent  string                 `json:"trigger_event"`
		TriggerData   map[string]interface{} `json:"trigger_data"`
		PayoutPercent float64                `json:"payout_percent"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Mock policy lookup
	coverageAmount := 200000.0
	payoutAmount := coverageAmount * (request.PayoutPercent / 100)

	claim := InsuranceClaim{
		ID:            fmt.Sprintf("CLM-%d", time.Now().UnixNano()),
		PolicyID:      request.PolicyID,
		FarmerID:      "FRM-12345", // Would come from policy
		ClaimType:     "parametric_auto",
		TriggerID:     request.TriggerID,
		TriggerEvent:  request.TriggerEvent,
		TriggerData:   request.TriggerData,
		ClaimAmount:   coverageAmount,
		PayoutAmount:  payoutAmount,
		PayoutMethod:  "bank_transfer",
		Status:        "approved",
		AutoProcessed: true,
		ProcessedAt:   time.Now(),
		CreatedAt:     time.Now(),
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"claim":   claim,
		"message": "Automatic claim processed successfully",
		"farmer_notification": map[string]interface{}{
			"sms":  fmt.Sprintf("54Bank Insurance: Your claim of N%.0f has been approved and will be paid within 24 hours. Ref: %s", payoutAmount, claim.ID),
			"sent": true,
		},
		"no_paperwork_required": true,
	})
}

func handleCreateInsuranceBundle(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var request struct {
		FarmerID         string   `json:"farmer_id"`
		LoanID           string   `json:"loan_id"`
		ProductIDs       []string `json:"product_ids"`
		CropType         string   `json:"crop_type"`
		FarmLocation     string   `json:"farm_location"`
		FarmSizeHectares float64  `json:"farm_size_hectares"`
		LoanAmount       float64  `json:"loan_amount"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Create policies for each product
	policies := []InsurancePolicy{}
	totalPremium := 0.0
	totalSubsidy := 0.0

	for _, productID := range request.ProductIDs {
		for _, product := range insuranceProducts {
			if product.ID == productID {
				premiumRate := (product.PremiumRateMin + product.PremiumRateMax) / 2 / 100
				coverage := request.LoanAmount
				if coverage > product.MaxCoverageAmount {
					coverage = product.MaxCoverageAmount
				}
				premium := coverage * premiumRate
				subsidy := 0.0
				if product.SubsidyAvailable {
					subsidy = premium * (product.SubsidyPercent / 100)
				}

				policy := InsurancePolicy{
					ID:               fmt.Sprintf("POL-%d", time.Now().UnixNano()),
					FarmerID:         request.FarmerID,
					LoanID:           request.LoanID,
					ProductID:        productID,
					ProductName:      product.Name,
					PolicyType:       product.Type,
					CropType:         request.CropType,
					FarmLocation:     request.FarmLocation,
					FarmSizeHectares: request.FarmSizeHectares,
					CoverageAmount:   coverage,
					PremiumAmount:    premium,
					SubsidyAmount:    subsidy,
					FarmerPremium:    premium - subsidy,
					PolicyStartDate:  time.Now(),
					PolicyEndDate:    time.Now().AddDate(0, 6, 0),
					Status:           "active",
					CreatedAt:        time.Now(),
				}
				policies = append(policies, policy)
				totalPremium += premium
				totalSubsidy += subsidy
				break
			}
		}
	}

	// Apply bundle discount
	bundleDiscount := 10.0 // 10% discount for bundling
	farmerContribution := (totalPremium - totalSubsidy) * (1 - bundleDiscount/100)

	bundle := InsuranceBundle{
		ID:                 fmt.Sprintf("BND-%d", time.Now().UnixNano()),
		LoanID:             request.LoanID,
		FarmerID:           request.FarmerID,
		Policies:           policies,
		TotalPremium:       totalPremium,
		TotalSubsidy:       totalSubsidy,
		FarmerContribution: farmerContribution,
		BundleDiscount:     bundleDiscount,
		Status:             "active",
		CreatedAt:          time.Now(),
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"bundle":  bundle,
		"message": "Insurance bundle created successfully",
		"savings": map[string]interface{}{
			"subsidy_savings":    totalSubsidy,
			"bundle_discount":    (totalPremium - totalSubsidy) * (bundleDiscount / 100),
			"total_savings":      totalSubsidy + (totalPremium-totalSubsidy)*(bundleDiscount/100),
			"farmer_pays":        farmerContribution,
			"can_add_to_loan":    true,
			"monthly_if_in_loan": farmerContribution / 6,
		},
	})
}

func handleGetPortfolioGuarantees(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"guarantees": portfolioGuarantees,
		"count":      len(portfolioGuarantees),
		"total_available": func() float64 {
			total := 0.0
			for _, g := range portfolioGuarantees {
				total += g.AvailableAmount
			}
			return total
		}(),
	})
}

func handleCheckGuaranteeEligibility(w http.ResponseWriter, r *http.Request) {
	farmerID := r.URL.Query().Get("farmer_id")
	loanAmount := r.URL.Query().Get("loan_amount")

	if farmerID == "" || loanAmount == "" {
		http.Error(w, "farmer_id and loan_amount are required", http.StatusBadRequest)
		return
	}

	// Mock eligibility check
	eligibleGuarantees := []map[string]interface{}{}

	for _, g := range portfolioGuarantees {
		if g.Status == "active" && g.AvailableAmount > 0 {
			eligibleGuarantees = append(eligibleGuarantees, map[string]interface{}{
				"guarantee_id":     g.ID,
				"program_name":     g.ProgramName,
				"guarantor":        g.GuarantorName,
				"coverage_percent": g.CoveragePercent,
				"eligible":         true,
				"criteria_met":     g.EligibilityCriteria,
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"farmer_id":           farmerID,
		"loan_amount":         loanAmount,
		"eligible_guarantees": eligibleGuarantees,
		"recommendation":      "NIRSAL guarantee recommended for best coverage",
	})
}

// RegisterMicroInsuranceRoutes registers all micro-insurance routes
func RegisterMicroInsuranceRoutes(r *mux.Router) {
	r.HandleFunc("/api/v1/agriculture/insurance/products", handleGetInsuranceProducts).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/insurance/policies", handleCreateInsurancePolicy).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/insurance/evaluate-trigger", handleEvaluateParametricTrigger).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/insurance/auto-claim", handleProcessAutoClaim).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/insurance/bundles", handleCreateInsuranceBundle).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/insurance/guarantees", handleGetPortfolioGuarantees).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/insurance/check-eligibility", handleCheckGuaranteeEligibility).Methods("POST")
}
