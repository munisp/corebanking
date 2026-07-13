package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gorilla/mux"
)

// ============================================================================
// PROACTIVE RISK MANAGEMENT
// NDVI-driven alerts, weather shock detection, automatic restructuring
// ============================================================================

// AreaShockDetection detects area-wide agricultural shocks
type AreaShockDetection struct {
	ID              string    `json:"id"`
	Region          string    `json:"region"`
	State           string    `json:"state"`
	LGA             string    `json:"lga"`
	ShockType       string    `json:"shock_type"` // drought, flood, pest, disease, price_crash
	Severity        string    `json:"severity"`   // minor, moderate, severe, catastrophic
	DetectedAt      time.Time `json:"detected_at"`
	DataSources     []string  `json:"data_sources"`
	AffectedFarmers int       `json:"affected_farmers"`
	AffectedLoans   int       `json:"affected_loans"`
	TotalExposure   float64   `json:"total_exposure"`
	NDVIDeviation   float64   `json:"ndvi_deviation_percent"`
	RainfallDeviation float64 `json:"rainfall_deviation_percent"`
	RecommendedAction string  `json:"recommended_action"`
	AutoTriggered   bool      `json:"auto_triggered"`
	Status          string    `json:"status"`
}

// CohortRescheduling handles bulk loan rescheduling for affected areas
type CohortRescheduling struct {
	ID                string    `json:"id"`
	ShockDetectionID  string    `json:"shock_detection_id"`
	Region            string    `json:"region"`
	AffectedLoanIDs   []string  `json:"affected_loan_ids"`
	TotalLoansAffected int      `json:"total_loans_affected"`
	TotalAmountAffected float64 `json:"total_amount_affected"`
	ReschedulingType  string    `json:"rescheduling_type"` // grace_extension, term_extension, payment_holiday
	NewGracePeriodDays int      `json:"new_grace_period_days"`
	NewTermExtensionDays int    `json:"new_term_extension_days"`
	InterestWaiver    float64   `json:"interest_waiver_percent"`
	ApprovalStatus    string    `json:"approval_status"`
	ApprovedBy        string    `json:"approved_by,omitempty"`
	ApprovedAt        time.Time `json:"approved_at,omitempty"`
	CommunicationSent bool      `json:"communication_sent"`
	CreatedAt         time.Time `json:"created_at"`
}

// DynamicCreditLimit adjusts farmer credit limits based on performance and conditions
type DynamicCreditLimit struct {
	FarmerID           string    `json:"farmer_id"`
	BaseLimit          float64   `json:"base_limit"`
	CurrentLimit       float64   `json:"current_limit"`
	NDVIScore          float64   `json:"ndvi_score"`
	RepaymentScore     float64   `json:"repayment_score"`
	WeatherRiskScore   float64   `json:"weather_risk_score"`
	MarketRiskScore    float64   `json:"market_risk_score"`
	CompositeRiskScore float64   `json:"composite_risk_score"`
	LimitMultiplier    float64   `json:"limit_multiplier"`
	AdjustmentReason   string    `json:"adjustment_reason"`
	ValidUntil         time.Time `json:"valid_until"`
	LastCalculated     time.Time `json:"last_calculated"`
}

// RiskBasedPricing calculates interest rates based on risk factors
type RiskBasedPricing struct {
	FarmerID          string  `json:"farmer_id"`
	BaseRate          float64 `json:"base_rate"`
	CreditHistoryAdj  float64 `json:"credit_history_adjustment"`
	CollateralAdj     float64 `json:"collateral_adjustment"`
	InsuranceAdj      float64 `json:"insurance_adjustment"`
	GroupLendingAdj   float64 `json:"group_lending_adjustment"`
	SeasonalAdj       float64 `json:"seasonal_adjustment"`
	NDVIHealthAdj     float64 `json:"ndvi_health_adjustment"`
	FinalRate         float64 `json:"final_rate"`
	RateCategory      string  `json:"rate_category"` // prime, standard, subprime
}

// PriceDropAlert monitors commodity prices and suggests actions
type PriceDropAlert struct {
	ID              string    `json:"id"`
	CommodityType   string    `json:"commodity_type"`
	Region          string    `json:"region"`
	PreviousPrice   float64   `json:"previous_price"`
	CurrentPrice    float64   `json:"current_price"`
	DropPercent     float64   `json:"drop_percent"`
	AlertLevel      string    `json:"alert_level"` // watch, warning, critical
	AffectedFarmers int       `json:"affected_farmers"`
	SuggestedActions []string `json:"suggested_actions"`
	WarehouseOptions []WarehouseOption `json:"warehouse_options"`
	WorkingCapitalOffer *WorkingCapitalOffer `json:"working_capital_offer,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
}

// WarehouseOption suggests storage alternatives during price drops
type WarehouseOption struct {
	WarehouseID     string  `json:"warehouse_id"`
	WarehouseName   string  `json:"warehouse_name"`
	Location        string  `json:"location"`
	DistanceKm      float64 `json:"distance_km"`
	AvailableCapacity float64 `json:"available_capacity_tonnes"`
	StorageRate     float64 `json:"storage_rate_per_tonne_day"`
	LoanAvailable   bool    `json:"loan_available"`
	MaxLTV          float64 `json:"max_ltv_ratio"`
}

// WorkingCapitalOffer provides bridge financing during price drops
type WorkingCapitalOffer struct {
	MaxAmount       float64 `json:"max_amount"`
	InterestRate    float64 `json:"interest_rate"`
	TermDays        int     `json:"term_days"`
	Purpose         string  `json:"purpose"`
	RequiresStorage bool    `json:"requires_storage"`
}

// BulkCommunication for mass farmer notifications
type BulkCommunication struct {
	ID              string    `json:"id"`
	TriggerEvent    string    `json:"trigger_event"`
	Region          string    `json:"region"`
	TargetFarmers   int       `json:"target_farmers"`
	Channels        []string  `json:"channels"` // sms, ussd_push, ivr, app_notification
	MessageTemplate string    `json:"message_template"`
	Languages       []string  `json:"languages"`
	SentCount       int       `json:"sent_count"`
	DeliveredCount  int       `json:"delivered_count"`
	Status          string    `json:"status"`
	CreatedAt       time.Time `json:"created_at"`
	CompletedAt     time.Time `json:"completed_at,omitempty"`
}

// NDVIThresholds for different alert levels
var ndviThresholds = map[string]float64{
	"healthy":    0.6,
	"moderate":   0.4,
	"stressed":   0.3,
	"critical":   0.2,
}

// HTTP Handlers for Proactive Risk Management

func handleDetectAreaShock(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	var request struct {
		Region          string  `json:"region"`
		State           string  `json:"state"`
		LGA             string  `json:"lga"`
		NDVIDeviation   float64 `json:"ndvi_deviation_percent"`
		RainfallDeviation float64 `json:"rainfall_deviation_percent"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	// Determine shock type and severity
	var shockType, severity, recommendedAction string
	
	if request.RainfallDeviation < -40 {
		shockType = "drought"
		if request.RainfallDeviation < -60 {
			severity = "severe"
			recommendedAction = "immediate_restructuring"
		} else {
			severity = "moderate"
			recommendedAction = "grace_period_extension"
		}
	} else if request.RainfallDeviation > 50 {
		shockType = "flood"
		if request.RainfallDeviation > 80 {
			severity = "severe"
			recommendedAction = "immediate_restructuring"
		} else {
			severity = "moderate"
			recommendedAction = "payment_holiday"
		}
	} else if request.NDVIDeviation < -30 {
		shockType = "crop_stress"
		severity = "moderate"
		recommendedAction = "monitoring_and_support"
	} else {
		shockType = "normal"
		severity = "minor"
		recommendedAction = "continue_monitoring"
	}
	
	shock := AreaShockDetection{
		ID:              fmt.Sprintf("SHOCK-%d", time.Now().UnixNano()),
		Region:          request.Region,
		State:           request.State,
		LGA:             request.LGA,
		ShockType:       shockType,
		Severity:        severity,
		DetectedAt:      time.Now(),
		DataSources:     []string{"satellite_ndvi", "weather_stations", "field_reports"},
		AffectedFarmers: 250, // Would be calculated from database
		AffectedLoans:   180,
		TotalExposure:   45000000.0,
		NDVIDeviation:   request.NDVIDeviation,
		RainfallDeviation: request.RainfallDeviation,
		RecommendedAction: recommendedAction,
		AutoTriggered:   severity == "severe",
		Status:          "detected",
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"shock":   shock,
		"message": "Area shock detected and analyzed",
		"auto_actions": map[string]interface{}{
			"restructuring_triggered": shock.AutoTriggered,
			"communication_queued":    true,
			"insurance_claims_flagged": severity == "severe",
		},
	})
}

func handleCreateCohortRescheduling(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	var request struct {
		ShockDetectionID    string   `json:"shock_detection_id"`
		Region              string   `json:"region"`
		AffectedLoanIDs     []string `json:"affected_loan_ids"`
		ReschedulingType    string   `json:"rescheduling_type"`
		NewGracePeriodDays  int      `json:"new_grace_period_days"`
		NewTermExtensionDays int     `json:"new_term_extension_days"`
		InterestWaiver      float64  `json:"interest_waiver_percent"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	// Calculate total affected amount (mock)
	totalAmount := float64(len(request.AffectedLoanIDs)) * 250000.0
	
	rescheduling := CohortRescheduling{
		ID:                  fmt.Sprintf("RESCH-%d", time.Now().UnixNano()),
		ShockDetectionID:    request.ShockDetectionID,
		Region:              request.Region,
		AffectedLoanIDs:     request.AffectedLoanIDs,
		TotalLoansAffected:  len(request.AffectedLoanIDs),
		TotalAmountAffected: totalAmount,
		ReschedulingType:    request.ReschedulingType,
		NewGracePeriodDays:  request.NewGracePeriodDays,
		NewTermExtensionDays: request.NewTermExtensionDays,
		InterestWaiver:      request.InterestWaiver,
		ApprovalStatus:      "pending_approval",
		CommunicationSent:   false,
		CreatedAt:           time.Now(),
	}
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"rescheduling": rescheduling,
		"message":      "Cohort rescheduling request created",
		"next_steps": []string{
			"Pending approval from credit committee",
			"Bulk SMS/USSD notification will be sent upon approval",
			"Loan terms will be automatically updated",
		},
	})
}

func handleCalculateDynamicLimit(w http.ResponseWriter, r *http.Request) {
	farmerID := r.URL.Query().Get("farmer_id")
	if farmerID == "" {
		http.Error(w, "farmer_id is required", http.StatusBadRequest)
		return
	}
	
	// Mock calculation - in production, this would use ML models
	baseLimit := 300000.0
	ndviScore := 0.72
	repaymentScore := 0.85
	weatherRiskScore := 0.65
	marketRiskScore := 0.70
	
	// Composite risk score (weighted average)
	compositeScore := (ndviScore*0.25 + repaymentScore*0.35 + weatherRiskScore*0.20 + marketRiskScore*0.20)
	
	// Calculate multiplier based on composite score
	var multiplier float64
	var reason string
	if compositeScore >= 0.8 {
		multiplier = 1.5
		reason = "Excellent performance - limit increased by 50%"
	} else if compositeScore >= 0.7 {
		multiplier = 1.2
		reason = "Good performance - limit increased by 20%"
	} else if compositeScore >= 0.6 {
		multiplier = 1.0
		reason = "Standard performance - limit maintained"
	} else if compositeScore >= 0.5 {
		multiplier = 0.8
		reason = "Below average - limit reduced by 20%"
	} else {
		multiplier = 0.5
		reason = "High risk - limit reduced by 50%"
	}
	
	dynamicLimit := DynamicCreditLimit{
		FarmerID:           farmerID,
		BaseLimit:          baseLimit,
		CurrentLimit:       baseLimit * multiplier,
		NDVIScore:          ndviScore,
		RepaymentScore:     repaymentScore,
		WeatherRiskScore:   weatherRiskScore,
		MarketRiskScore:    marketRiskScore,
		CompositeRiskScore: compositeScore,
		LimitMultiplier:    multiplier,
		AdjustmentReason:   reason,
		ValidUntil:         time.Now().AddDate(0, 3, 0), // Valid for 3 months
		LastCalculated:     time.Now(),
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"dynamic_limit": dynamicLimit,
		"factors": map[string]interface{}{
			"ndvi_health":      fmt.Sprintf("%.0f%% (weight: 25%%)", ndviScore*100),
			"repayment_history": fmt.Sprintf("%.0f%% (weight: 35%%)", repaymentScore*100),
			"weather_risk":     fmt.Sprintf("%.0f%% (weight: 20%%)", weatherRiskScore*100),
			"market_risk":      fmt.Sprintf("%.0f%% (weight: 20%%)", marketRiskScore*100),
		},
	})
}

func handleCalculateRiskBasedPricing(w http.ResponseWriter, r *http.Request) {
	farmerID := r.URL.Query().Get("farmer_id")
	if farmerID == "" {
		http.Error(w, "farmer_id is required", http.StatusBadRequest)
		return
	}
	
	// Base rate
	baseRate := 24.0 // CBN MPR + spread
	
	// Adjustments (negative = discount, positive = premium)
	creditHistoryAdj := -2.0  // Good history discount
	collateralAdj := -1.5     // Has collateral
	insuranceAdj := -1.0      // Has insurance
	groupLendingAdj := -0.5   // Part of group
	seasonalAdj := 0.5        // Peak season premium
	ndviHealthAdj := -1.0     // Healthy crops
	
	finalRate := baseRate + creditHistoryAdj + collateralAdj + insuranceAdj + groupLendingAdj + seasonalAdj + ndviHealthAdj
	
	var rateCategory string
	if finalRate <= 16 {
		rateCategory = "prime"
	} else if finalRate <= 20 {
		rateCategory = "standard"
	} else {
		rateCategory = "subprime"
	}
	
	pricing := RiskBasedPricing{
		FarmerID:         farmerID,
		BaseRate:         baseRate,
		CreditHistoryAdj: creditHistoryAdj,
		CollateralAdj:    collateralAdj,
		InsuranceAdj:     insuranceAdj,
		GroupLendingAdj:  groupLendingAdj,
		SeasonalAdj:      seasonalAdj,
		NDVIHealthAdj:    ndviHealthAdj,
		FinalRate:        finalRate,
		RateCategory:     rateCategory,
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"pricing": pricing,
		"savings": map[string]interface{}{
			"vs_base_rate":    fmt.Sprintf("%.1f%% savings", baseRate-finalRate),
			"annual_savings":  fmt.Sprintf("N%.0f on N500,000 loan", (baseRate-finalRate)/100*500000),
		},
		"how_to_improve": []string{
			"Maintain on-time repayments (+2% discount)",
			"Add crop insurance (+1% discount)",
			"Join a cooperative group (+0.5% discount)",
			"Provide warehouse receipt collateral (+1.5% discount)",
		},
	})
}

func handlePriceDropAlert(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	var request struct {
		CommodityType string  `json:"commodity_type"`
		Region        string  `json:"region"`
		PreviousPrice float64 `json:"previous_price"`
		CurrentPrice  float64 `json:"current_price"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	dropPercent := ((request.PreviousPrice - request.CurrentPrice) / request.PreviousPrice) * 100
	
	var alertLevel string
	var suggestedActions []string
	
	if dropPercent >= 30 {
		alertLevel = "critical"
		suggestedActions = []string{
			"Immediate warehouse storage recommended",
			"Working capital loan available for holding costs",
			"Contact off-taker for forward contract",
			"Consider insurance claim if applicable",
		}
	} else if dropPercent >= 20 {
		alertLevel = "warning"
		suggestedActions = []string{
			"Consider warehouse storage",
			"Monitor market for recovery",
			"Explore forward contracts",
		}
	} else {
		alertLevel = "watch"
		suggestedActions = []string{
			"Continue monitoring prices",
			"Review selling strategy",
		}
	}
	
	alert := PriceDropAlert{
		ID:              fmt.Sprintf("PDA-%d", time.Now().UnixNano()),
		CommodityType:   request.CommodityType,
		Region:          request.Region,
		PreviousPrice:   request.PreviousPrice,
		CurrentPrice:    request.CurrentPrice,
		DropPercent:     dropPercent,
		AlertLevel:      alertLevel,
		AffectedFarmers: 150,
		SuggestedActions: suggestedActions,
		WarehouseOptions: []WarehouseOption{
			{
				WarehouseID:       "WH-KAN-001",
				WarehouseName:     "Kano Commodity Warehouse",
				Location:          "Kano, Kano State",
				DistanceKm:        25,
				AvailableCapacity: 500,
				StorageRate:       50,
				LoanAvailable:     true,
				MaxLTV:            0.70,
			},
			{
				WarehouseID:       "WH-KAD-002",
				WarehouseName:     "Kaduna Agri Storage",
				Location:          "Kaduna, Kaduna State",
				DistanceKm:        45,
				AvailableCapacity: 800,
				StorageRate:       45,
				LoanAvailable:     true,
				MaxLTV:            0.65,
			},
		},
		WorkingCapitalOffer: &WorkingCapitalOffer{
			MaxAmount:       200000,
			InterestRate:    15,
			TermDays:        90,
			Purpose:         "Bridge financing during price recovery",
			RequiresStorage: true,
		},
		CreatedAt: time.Now(),
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"alert":   alert,
		"message": fmt.Sprintf("Price drop of %.1f%% detected for %s", dropPercent, request.CommodityType),
		"farmer_notification": map[string]interface{}{
			"sms_template": fmt.Sprintf("54Bank Alert: %s prices dropped %.0f%%. Storage options available. Dial *347*4# for details.", request.CommodityType, dropPercent),
			"ussd_menu":    "*347*4*3#",
		},
	})
}

func handleSendBulkCommunication(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	var request struct {
		TriggerEvent    string   `json:"trigger_event"`
		Region          string   `json:"region"`
		TargetFarmerIDs []string `json:"target_farmer_ids,omitempty"`
		Channels        []string `json:"channels"`
		MessageTemplate string   `json:"message_template"`
		Languages       []string `json:"languages"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	targetCount := len(request.TargetFarmerIDs)
	if targetCount == 0 {
		targetCount = 500 // Default to region-wide
	}
	
	communication := BulkCommunication{
		ID:              fmt.Sprintf("COMM-%d", time.Now().UnixNano()),
		TriggerEvent:    request.TriggerEvent,
		Region:          request.Region,
		TargetFarmers:   targetCount,
		Channels:        request.Channels,
		MessageTemplate: request.MessageTemplate,
		Languages:       request.Languages,
		SentCount:       0,
		DeliveredCount:  0,
		Status:          "queued",
		CreatedAt:       time.Now(),
	}
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"communication": communication,
		"message":       "Bulk communication queued for delivery",
		"estimated_delivery": map[string]interface{}{
			"sms":              "Within 30 minutes",
			"ussd_push":        "Within 1 hour",
			"ivr":              "Within 2 hours",
			"app_notification": "Immediate",
		},
	})
}

// RegisterProactiveRiskManagementRoutes registers all proactive risk management routes
func RegisterProactiveRiskManagementRoutes(r *mux.Router) {
	r.HandleFunc("/api/v1/agriculture/risk/detect-shock", handleDetectAreaShock).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/risk/cohort-rescheduling", handleCreateCohortRescheduling).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/risk/dynamic-limit", handleCalculateDynamicLimit).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/risk/pricing", handleCalculateRiskBasedPricing).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/risk/price-drop-alert", handlePriceDropAlert).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/risk/bulk-communication", handleSendBulkCommunication).Methods("POST")
}
