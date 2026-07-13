package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gorilla/mux"
)

// ============================================================================
// FARMER-FIRST FINANCIAL PRODUCTS
// Season-aligned loans, input vouchers, pay-at-harvest, warehouse receipts
// ============================================================================

// CropCalendar defines planting and harvest seasons for different crops
type CropCalendar struct {
	CropType       string    `json:"crop_type"`
	Region         string    `json:"region"`
	PlantingStart  time.Time `json:"planting_start"`
	PlantingEnd    time.Time `json:"planting_end"`
	GrowingPeriod  int       `json:"growing_period_days"`
	HarvestStart   time.Time `json:"harvest_start"`
	HarvestEnd     time.Time `json:"harvest_end"`
	OptimalLoanTerm int      `json:"optimal_loan_term_days"`
}

// SeasonAlignedLoan represents a loan structured around crop cycles
type SeasonAlignedLoan struct {
	ID                    string    `json:"id"`
	FarmerID              string    `json:"farmer_id"`
	CooperativeID         string    `json:"cooperative_id,omitempty"`
	CropType              string    `json:"crop_type"`
	Region                string    `json:"region"`
	LoanType              string    `json:"loan_type"` // input, planting, growing, harvest, warehouse_receipt
	Principal             float64   `json:"principal"`
	InterestRate          float64   `json:"interest_rate"`
	GracePeriodDays       int       `json:"grace_period_days"`
	RepaymentStartDate    time.Time `json:"repayment_start_date"`
	MaturityDate          time.Time `json:"maturity_date"`
	ExpectedHarvestDate   time.Time `json:"expected_harvest_date"`
	PayAtHarvest          bool      `json:"pay_at_harvest"`
	LinkedWarehouseReceipt string   `json:"linked_warehouse_receipt,omitempty"`
	LinkedInsurancePolicy  string   `json:"linked_insurance_policy,omitempty"`
	Status                string    `json:"status"`
	DisbursementMethod    string    `json:"disbursement_method"` // direct, voucher, merchant
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}

// InputVoucher represents a digital voucher for agricultural inputs
type InputVoucher struct {
	ID                string    `json:"id"`
	FarmerID          string    `json:"farmer_id"`
	LoanID            string    `json:"loan_id"`
	VoucherCode       string    `json:"voucher_code"`
	InputType         string    `json:"input_type"` // fertilizer, seed, pesticide, equipment
	Amount            float64   `json:"amount"`
	RemainingBalance  float64   `json:"remaining_balance"`
	ValidFrom         time.Time `json:"valid_from"`
	ValidUntil        time.Time `json:"valid_until"`
	ApprovedMerchants []string  `json:"approved_merchants"`
	Redemptions       []VoucherRedemption `json:"redemptions"`
	Status            string    `json:"status"` // active, partially_used, fully_used, expired
	CreatedAt         time.Time `json:"created_at"`
}

// VoucherRedemption tracks voucher usage at merchants
type VoucherRedemption struct {
	ID            string    `json:"id"`
	VoucherID     string    `json:"voucher_id"`
	MerchantID    string    `json:"merchant_id"`
	MerchantName  string    `json:"merchant_name"`
	Amount        float64   `json:"amount"`
	Items         []InputItem `json:"items"`
	RedemptionMethod string `json:"redemption_method"` // pos, ussd, agent
	Timestamp     time.Time `json:"timestamp"`
	Location      GeoLocation `json:"location,omitempty"`
}

// InputItem represents an agricultural input purchased
type InputItem struct {
	Name        string  `json:"name"`
	Category    string  `json:"category"`
	Quantity    float64 `json:"quantity"`
	Unit        string  `json:"unit"`
	UnitPrice   float64 `json:"unit_price"`
	TotalPrice  float64 `json:"total_price"`
}

// GeoLocation for tracking redemption locations
type GeoLocation struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

// PayAtHarvestLoan extends loan with harvest-linked repayment
type PayAtHarvestLoan struct {
	SeasonAlignedLoan
	ExpectedYield        float64 `json:"expected_yield_tonnes"`
	ExpectedPrice        float64 `json:"expected_price_per_tonne"`
	MinimumRepayment     float64 `json:"minimum_repayment_percentage"`
	LinkedOffTaker       string  `json:"linked_off_taker,omitempty"`
	OffTakerContract     string  `json:"off_taker_contract,omitempty"`
	AutoDeductFromSale   bool    `json:"auto_deduct_from_sale"`
}

// WarehouseReceiptLoan represents financing against stored commodities
type WarehouseReceiptLoan struct {
	ID                  string    `json:"id"`
	FarmerID            string    `json:"farmer_id"`
	WarehouseReceiptID  string    `json:"warehouse_receipt_id"`
	WarehouseID         string    `json:"warehouse_id"`
	WarehouseName       string    `json:"warehouse_name"`
	CommodityType       string    `json:"commodity_type"`
	QuantityTonnes      float64   `json:"quantity_tonnes"`
	GradeQuality        string    `json:"grade_quality"`
	StorageDate         time.Time `json:"storage_date"`
	CurrentMarketPrice  float64   `json:"current_market_price"`
	CollateralValue     float64   `json:"collateral_value"`
	LoanToValueRatio    float64   `json:"loan_to_value_ratio"`
	LoanAmount          float64   `json:"loan_amount"`
	InterestRate        float64   `json:"interest_rate"`
	StorageFeePerDay    float64   `json:"storage_fee_per_day"`
	MaturityDate        time.Time `json:"maturity_date"`
	Status              string    `json:"status"`
	PriceAlerts         []PriceAlert `json:"price_alerts"`
	CreatedAt           time.Time `json:"created_at"`
}

// PriceAlert for warehouse receipt holders
type PriceAlert struct {
	ID          string    `json:"id"`
	TargetPrice float64   `json:"target_price"`
	AlertType   string    `json:"alert_type"` // above, below
	Triggered   bool      `json:"triggered"`
	TriggeredAt time.Time `json:"triggered_at,omitempty"`
}

// GroupLending for women and youth farmer groups
type GroupLending struct {
	ID              string    `json:"id"`
	GroupName       string    `json:"group_name"`
	GroupType       string    `json:"group_type"` // women, youth, mixed
	CooperativeID   string    `json:"cooperative_id,omitempty"`
	Members         []GroupMember `json:"members"`
	TotalLoanAmount float64   `json:"total_loan_amount"`
	IndividualCap   float64   `json:"individual_cap"`
	CollectiveGuarantee bool  `json:"collective_guarantee"`
	RepaymentRate   float64   `json:"repayment_rate"`
	MeetingSchedule string    `json:"meeting_schedule"`
	Status          string    `json:"status"`
	CreatedAt       time.Time `json:"created_at"`
}

// GroupMember represents a member of a lending group
type GroupMember struct {
	FarmerID        string  `json:"farmer_id"`
	Name            string  `json:"name"`
	Role            string  `json:"role"` // leader, treasurer, secretary, member
	LoanAmount      float64 `json:"loan_amount"`
	RepaymentStatus string  `json:"repayment_status"`
	GuarantorFor    []string `json:"guarantor_for"`
}

// FarmerCreditHistory tracks farmer's performance over seasons
type FarmerCreditHistory struct {
	FarmerID            string    `json:"farmer_id"`
	TotalSeasonsFinanced int      `json:"total_seasons_financed"`
	OnTimeRepayments    int       `json:"on_time_repayments"`
	LateRepayments      int       `json:"late_repayments"`
	Defaults            int       `json:"defaults"`
	RepaymentStreak     int       `json:"repayment_streak"`
	CreditScore         int       `json:"credit_score"`
	CreditLimit         float64   `json:"credit_limit"`
	NextSeasonEligible  bool      `json:"next_season_eligible"`
	SeasonHistory       []SeasonPerformance `json:"season_history"`
	LastUpdated         time.Time `json:"last_updated"`
}

// SeasonPerformance tracks performance for a single season
type SeasonPerformance struct {
	Season          string    `json:"season"` // e.g., "2024-wet", "2024-dry"
	CropType        string    `json:"crop_type"`
	LoanAmount      float64   `json:"loan_amount"`
	RepaidAmount    float64   `json:"repaid_amount"`
	RepaidOnTime    bool      `json:"repaid_on_time"`
	YieldAchieved   float64   `json:"yield_achieved_tonnes"`
	YieldExpected   float64   `json:"yield_expected_tonnes"`
	IncomeGenerated float64   `json:"income_generated"`
	InsuranceClaim  bool      `json:"insurance_claim"`
}

// CropCalendarService manages crop calendars
var cropCalendars = map[string]CropCalendar{
	"maize_north": {
		CropType:       "maize",
		Region:         "north",
		PlantingStart:  time.Date(2025, 5, 1, 0, 0, 0, 0, time.UTC),
		PlantingEnd:    time.Date(2025, 6, 30, 0, 0, 0, 0, time.UTC),
		GrowingPeriod:  120,
		HarvestStart:   time.Date(2025, 9, 1, 0, 0, 0, 0, time.UTC),
		HarvestEnd:     time.Date(2025, 10, 31, 0, 0, 0, 0, time.UTC),
		OptimalLoanTerm: 150,
	},
	"rice_north": {
		CropType:       "rice",
		Region:         "north",
		PlantingStart:  time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC),
		PlantingEnd:    time.Date(2025, 7, 31, 0, 0, 0, 0, time.UTC),
		GrowingPeriod:  150,
		HarvestStart:   time.Date(2025, 11, 1, 0, 0, 0, 0, time.UTC),
		HarvestEnd:     time.Date(2025, 12, 31, 0, 0, 0, 0, time.UTC),
		OptimalLoanTerm: 180,
	},
	"cassava_south": {
		CropType:       "cassava",
		Region:         "south",
		PlantingStart:  time.Date(2025, 3, 1, 0, 0, 0, 0, time.UTC),
		PlantingEnd:    time.Date(2025, 4, 30, 0, 0, 0, 0, time.UTC),
		GrowingPeriod:  270,
		HarvestStart:   time.Date(2025, 12, 1, 0, 0, 0, 0, time.UTC),
		HarvestEnd:     time.Date(2026, 2, 28, 0, 0, 0, 0, time.UTC),
		OptimalLoanTerm: 300,
	},
	"sorghum_north": {
		CropType:       "sorghum",
		Region:         "north",
		PlantingStart:  time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC),
		PlantingEnd:    time.Date(2025, 7, 15, 0, 0, 0, 0, time.UTC),
		GrowingPeriod:  120,
		HarvestStart:   time.Date(2025, 10, 1, 0, 0, 0, 0, time.UTC),
		HarvestEnd:     time.Date(2025, 11, 30, 0, 0, 0, 0, time.UTC),
		OptimalLoanTerm: 150,
	},
}

// HTTP Handlers for Farmer-First Products

func handleGetCropCalendars(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	
	calendars := make([]CropCalendar, 0, len(cropCalendars))
	for _, cal := range cropCalendars {
		calendars = append(calendars, cal)
	}
	
	json.NewEncoder(w).Encode(map[string]interface{}{
		"calendars": calendars,
		"count":     len(calendars),
	})
}

func handleCreateSeasonAlignedLoan(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	var request struct {
		FarmerID      string  `json:"farmer_id"`
		CooperativeID string  `json:"cooperative_id,omitempty"`
		CropType      string  `json:"crop_type"`
		Region        string  `json:"region"`
		LoanType      string  `json:"loan_type"`
		Principal     float64 `json:"principal"`
		PayAtHarvest  bool    `json:"pay_at_harvest"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	// Get crop calendar for optimal loan structuring
	calendarKey := fmt.Sprintf("%s_%s", request.CropType, request.Region)
	calendar, exists := cropCalendars[calendarKey]
	if !exists {
		// Use default calendar
		calendar = CropCalendar{
			GrowingPeriod:   120,
			OptimalLoanTerm: 150,
		}
	}
	
	// Calculate grace period based on crop type
	gracePeriod := calendar.GrowingPeriod / 2 // Grace period is half the growing period
	
	// Calculate interest rate based on farmer history (simplified)
	baseRate := 18.0 // Base rate 18% p.a.
	// In production, this would check farmer credit history
	
	loan := SeasonAlignedLoan{
		ID:                  fmt.Sprintf("SAL-%d", time.Now().UnixNano()),
		FarmerID:            request.FarmerID,
		CooperativeID:       request.CooperativeID,
		CropType:            request.CropType,
		Region:              request.Region,
		LoanType:            request.LoanType,
		Principal:           request.Principal,
		InterestRate:        baseRate,
		GracePeriodDays:     gracePeriod,
		RepaymentStartDate:  time.Now().AddDate(0, 0, gracePeriod),
		MaturityDate:        time.Now().AddDate(0, 0, calendar.OptimalLoanTerm),
		ExpectedHarvestDate: calendar.HarvestStart,
		PayAtHarvest:        request.PayAtHarvest,
		Status:              "pending_approval",
		DisbursementMethod:  "voucher",
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"loan":    loan,
		"message": "Season-aligned loan created successfully",
		"calendar": calendar,
	})
}

func handleCreateInputVoucher(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	var request struct {
		FarmerID          string   `json:"farmer_id"`
		LoanID            string   `json:"loan_id"`
		InputType         string   `json:"input_type"`
		Amount            float64  `json:"amount"`
		ValidDays         int      `json:"valid_days"`
		ApprovedMerchants []string `json:"approved_merchants"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	// Generate unique voucher code (6 alphanumeric characters)
	voucherCode := fmt.Sprintf("54V%06d", time.Now().UnixNano()%1000000)
	
	voucher := InputVoucher{
		ID:                fmt.Sprintf("VCH-%d", time.Now().UnixNano()),
		FarmerID:          request.FarmerID,
		LoanID:            request.LoanID,
		VoucherCode:       voucherCode,
		InputType:         request.InputType,
		Amount:            request.Amount,
		RemainingBalance:  request.Amount,
		ValidFrom:         time.Now(),
		ValidUntil:        time.Now().AddDate(0, 0, request.ValidDays),
		ApprovedMerchants: request.ApprovedMerchants,
		Redemptions:       []VoucherRedemption{},
		Status:            "active",
		CreatedAt:         time.Now(),
	}
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"voucher": voucher,
		"message": "Input voucher created successfully",
		"ussd_code": fmt.Sprintf("*347*4*%s#", voucherCode),
	})
}

func handleRedeemVoucher(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	var request struct {
		VoucherCode      string      `json:"voucher_code"`
		MerchantID       string      `json:"merchant_id"`
		MerchantName     string      `json:"merchant_name"`
		Amount           float64     `json:"amount"`
		Items            []InputItem `json:"items"`
		RedemptionMethod string      `json:"redemption_method"`
		Latitude         float64     `json:"latitude,omitempty"`
		Longitude        float64     `json:"longitude,omitempty"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	// In production, this would validate voucher and update balance
	redemption := VoucherRedemption{
		ID:               fmt.Sprintf("RDM-%d", time.Now().UnixNano()),
		VoucherID:        request.VoucherCode,
		MerchantID:       request.MerchantID,
		MerchantName:     request.MerchantName,
		Amount:           request.Amount,
		Items:            request.Items,
		RedemptionMethod: request.RedemptionMethod,
		Timestamp:        time.Now(),
		Location: GeoLocation{
			Latitude:  request.Latitude,
			Longitude: request.Longitude,
		},
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"redemption":       redemption,
		"message":          "Voucher redeemed successfully",
		"remaining_balance": 50000.0, // Placeholder
	})
}

func handleCreateWarehouseReceiptLoan(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	var request struct {
		FarmerID           string  `json:"farmer_id"`
		WarehouseID        string  `json:"warehouse_id"`
		WarehouseName      string  `json:"warehouse_name"`
		CommodityType      string  `json:"commodity_type"`
		QuantityTonnes     float64 `json:"quantity_tonnes"`
		GradeQuality       string  `json:"grade_quality"`
		CurrentMarketPrice float64 `json:"current_market_price"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	// Calculate collateral value and loan amount
	collateralValue := request.QuantityTonnes * request.CurrentMarketPrice
	ltvRatio := 0.70 // 70% loan-to-value ratio
	loanAmount := collateralValue * ltvRatio
	
	// Generate warehouse receipt ID
	receiptID := fmt.Sprintf("WR-%s-%d", request.WarehouseID[:3], time.Now().UnixNano()%100000)
	
	loan := WarehouseReceiptLoan{
		ID:                 fmt.Sprintf("WRL-%d", time.Now().UnixNano()),
		FarmerID:           request.FarmerID,
		WarehouseReceiptID: receiptID,
		WarehouseID:        request.WarehouseID,
		WarehouseName:      request.WarehouseName,
		CommodityType:      request.CommodityType,
		QuantityTonnes:     request.QuantityTonnes,
		GradeQuality:       request.GradeQuality,
		StorageDate:        time.Now(),
		CurrentMarketPrice: request.CurrentMarketPrice,
		CollateralValue:    collateralValue,
		LoanToValueRatio:   ltvRatio,
		LoanAmount:         loanAmount,
		InterestRate:       15.0, // Lower rate due to collateral
		StorageFeePerDay:   request.QuantityTonnes * 50, // N50 per tonne per day
		MaturityDate:       time.Now().AddDate(0, 6, 0), // 6 months
		Status:             "active",
		PriceAlerts:        []PriceAlert{},
		CreatedAt:          time.Now(),
	}
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"loan":             loan,
		"warehouse_receipt": receiptID,
		"message":          "Warehouse receipt loan created successfully",
		"benefits": map[string]interface{}{
			"avoid_distress_sale": true,
			"price_appreciation_potential": "Wait for better prices",
			"lower_interest_rate": "15% vs 18% unsecured",
		},
	})
}

func handleCreateGroupLending(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	var request struct {
		GroupName       string        `json:"group_name"`
		GroupType       string        `json:"group_type"`
		CooperativeID   string        `json:"cooperative_id,omitempty"`
		Members         []GroupMember `json:"members"`
		TotalLoanAmount float64       `json:"total_loan_amount"`
		IndividualCap   float64       `json:"individual_cap"`
		MeetingSchedule string        `json:"meeting_schedule"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	group := GroupLending{
		ID:                fmt.Sprintf("GRP-%d", time.Now().UnixNano()),
		GroupName:         request.GroupName,
		GroupType:         request.GroupType,
		CooperativeID:     request.CooperativeID,
		Members:           request.Members,
		TotalLoanAmount:   request.TotalLoanAmount,
		IndividualCap:     request.IndividualCap,
		CollectiveGuarantee: true,
		RepaymentRate:     0.0,
		MeetingSchedule:   request.MeetingSchedule,
		Status:            "active",
		CreatedAt:         time.Now(),
	}
	
	// Calculate benefits for group type
	benefits := map[string]interface{}{}
	switch request.GroupType {
	case "women":
		benefits["interest_discount"] = "2% lower rate"
		benefits["grace_period_bonus"] = "Additional 30 days"
		benefits["training_access"] = "Free financial literacy training"
	case "youth":
		benefits["interest_discount"] = "1.5% lower rate"
		benefits["mentorship"] = "Paired with experienced farmers"
		benefits["technology_support"] = "Free smartphone app training"
	}
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"group":    group,
		"message":  "Group lending facility created successfully",
		"benefits": benefits,
	})
}

func handleGetFarmerCreditHistory(w http.ResponseWriter, r *http.Request) {
	farmerID := r.URL.Query().Get("farmer_id")
	if farmerID == "" {
		http.Error(w, "farmer_id is required", http.StatusBadRequest)
		return
	}
	
	// Mock credit history - in production, this would query the database
	history := FarmerCreditHistory{
		FarmerID:            farmerID,
		TotalSeasonsFinanced: 5,
		OnTimeRepayments:    4,
		LateRepayments:      1,
		Defaults:            0,
		RepaymentStreak:     3,
		CreditScore:         720,
		CreditLimit:         500000.0,
		NextSeasonEligible:  true,
		SeasonHistory: []SeasonPerformance{
			{
				Season:          "2024-wet",
				CropType:        "maize",
				LoanAmount:      200000,
				RepaidAmount:    200000,
				RepaidOnTime:    true,
				YieldAchieved:   4.5,
				YieldExpected:   4.0,
				IncomeGenerated: 450000,
				InsuranceClaim:  false,
			},
			{
				Season:          "2024-dry",
				CropType:        "rice",
				LoanAmount:      300000,
				RepaidAmount:    300000,
				RepaidOnTime:    true,
				YieldAchieved:   3.8,
				YieldExpected:   4.0,
				IncomeGenerated: 520000,
				InsuranceClaim:  false,
			},
		},
		LastUpdated: time.Now(),
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"credit_history": history,
		"recommendations": map[string]interface{}{
			"eligible_products": []string{"season_aligned_loan", "input_voucher", "warehouse_receipt_loan"},
			"suggested_limit":   550000.0,
			"suggested_rate":    16.5,
		},
	})
}

// RegisterFarmerFirstProductsRoutes registers all farmer-first product routes
func RegisterFarmerFirstProductsRoutes(r *mux.Router) {
	r.HandleFunc("/api/v1/agriculture/crop-calendars", handleGetCropCalendars).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/season-aligned-loans", handleCreateSeasonAlignedLoan).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/input-vouchers", handleCreateInputVoucher).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/input-vouchers/redeem", handleRedeemVoucher).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/warehouse-receipt-loans", handleCreateWarehouseReceiptLoan).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/group-lending", handleCreateGroupLending).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/farmer-credit-history", handleGetFarmerCreditHistory).Methods("GET")
}
