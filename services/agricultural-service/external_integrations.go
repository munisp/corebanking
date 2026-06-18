package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/mux"
)

// ==================== EXTERNAL INTEGRATIONS ====================
// Credit Bureaus, CRMS, NCR, NAIC, Commodity Exchanges

// Credit Bureau Integration (CRC, CreditRegistry, FirstCentral)
type CreditBureauService struct {
	db         *sql.DB
	httpClient *http.Client
	crcAPIKey  string
	crAPIKey   string
	fcAPIKey   string
}

type CreditBureauReport struct {
	BureauName       string          `json:"bureau_name"`
	ReportID         string          `json:"report_id"`
	BVN              string          `json:"bvn"`
	FullName         string          `json:"full_name"`
	CreditScore      int             `json:"credit_score"`
	ScoreRating      string          `json:"score_rating"` // Excellent, Good, Fair, Poor
	TotalAccounts    int             `json:"total_accounts"`
	ActiveAccounts   int             `json:"active_accounts"`
	ClosedAccounts   int             `json:"closed_accounts"`
	TotalOutstanding float64         `json:"total_outstanding"`
	TotalOverdue     float64         `json:"total_overdue"`
	MaxDaysOverdue   int             `json:"max_days_overdue"`
	DefaultCount     int             `json:"default_count"`
	EnquiryCount     int             `json:"enquiry_count"`
	LastEnquiryDate  *time.Time      `json:"last_enquiry_date"`
	AccountHistory   []CreditAccount `json:"account_history"`
	ReportDate       time.Time       `json:"report_date"`
	ValidUntil       time.Time       `json:"valid_until"`
}

type CreditAccount struct {
	LenderName     string     `json:"lender_name"`
	AccountType    string     `json:"account_type"`
	AccountStatus  string     `json:"account_status"`
	OpenDate       time.Time  `json:"open_date"`
	CloseDate      *time.Time `json:"close_date"`
	CreditLimit    float64    `json:"credit_limit"`
	CurrentBalance float64    `json:"current_balance"`
	OverdueAmount  float64    `json:"overdue_amount"`
	DaysOverdue    int        `json:"days_overdue"`
	PaymentHistory string     `json:"payment_history"` // e.g., "CCCCCCCCCCCC" for 12 months current
}

// CBN CRMS (Credit Risk Management System) Integration
type CRMSService struct {
	db         *sql.DB
	httpClient *http.Client
	apiKey     string
	baseURL    string
}

type CRMSExposure struct {
	ReportID           string               `json:"report_id"`
	BVN                string               `json:"bvn"`
	CustomerName       string               `json:"customer_name"`
	TotalExposure      float64              `json:"total_exposure"`
	PerformingLoans    float64              `json:"performing_loans"`
	NonPerformingLoans float64              `json:"non_performing_loans"`
	LenderCount        int                  `json:"lender_count"`
	Exposures          []CRMSLenderExposure `json:"exposures"`
	ReportDate         time.Time            `json:"report_date"`
}

type CRMSLenderExposure struct {
	LenderCode        string  `json:"lender_code"`
	LenderName        string  `json:"lender_name"`
	FacilityType      string  `json:"facility_type"`
	OutstandingAmount float64 `json:"outstanding_amount"`
	Status            string  `json:"status"`
	SectorCode        string  `json:"sector_code"`
}

type CRMSSubmission struct {
	SubmissionID     string     `json:"submission_id"`
	TenantID         string     `json:"tenant_id"`
	ReportPeriod     string     `json:"report_period"`
	TotalRecords     int        `json:"total_records"`
	SuccessRecords   int        `json:"success_records"`
	FailedRecords    int        `json:"failed_records"`
	SubmissionStatus string     `json:"submission_status"`
	SubmittedAt      time.Time  `json:"submitted_at"`
	AcknowledgedAt   *time.Time `json:"acknowledged_at"`
}

// National Collateral Registry (NCR) Integration
type NCRService struct {
	db         *sql.DB
	httpClient *http.Client
	apiKey     string
	baseURL    string
}

type CollateralRegistration struct {
	RegistrationID   string    `json:"registration_id"`
	NCRReferenceNo   string    `json:"ncr_reference_no"`
	DebtorBVN        string    `json:"debtor_bvn"`
	DebtorName       string    `json:"debtor_name"`
	SecuredPartyName string    `json:"secured_party_name"`
	SecuredPartyCode string    `json:"secured_party_code"`
	CollateralType   string    `json:"collateral_type"`
	CollateralDesc   string    `json:"collateral_description"`
	CollateralValue  float64   `json:"collateral_value"`
	SerialNumber     string    `json:"serial_number"`   // For equipment
	GPSCoordinates   string    `json:"gps_coordinates"` // For land
	LandTitleNo      string    `json:"land_title_no"`
	RegistrationDate time.Time `json:"registration_date"`
	ExpiryDate       time.Time `json:"expiry_date"`
	Status           string    `json:"status"` // ACTIVE, DISCHARGED, AMENDED
	LoanID           string    `json:"loan_id"`
}

type NCRSearchResult struct {
	DebtorBVN           string                   `json:"debtor_bvn"`
	DebtorName          string                   `json:"debtor_name"`
	TotalRegistrations  int                      `json:"total_registrations"`
	ActiveRegistrations int                      `json:"active_registrations"`
	Registrations       []CollateralRegistration `json:"registrations"`
	SearchDate          time.Time                `json:"search_date"`
}

// NAIC (Nigerian Agricultural Insurance Corporation) Integration
type NAICService struct {
	db         *sql.DB
	httpClient *http.Client
	apiKey     string
	baseURL    string
}

type NAICPolicy struct {
	PolicyID           string    `json:"policy_id"`
	NAICPolicyNo       string    `json:"naic_policy_no"`
	PolicyType         string    `json:"policy_type"` // CROP, LIVESTOCK, AQUACULTURE, POULTRY
	FarmerName         string    `json:"farmer_name"`
	FarmerBVN          string    `json:"farmer_bvn"`
	FarmLocation       string    `json:"farm_location"`
	State              string    `json:"state"`
	LGA                string    `json:"lga"`
	CropType           string    `json:"crop_type"`
	LivestockType      string    `json:"livestock_type"`
	CoverageArea       float64   `json:"coverage_area"` // hectares or units
	SumInsured         float64   `json:"sum_insured"`
	Premium            float64   `json:"premium"`
	PremiumPaid        float64   `json:"premium_paid"`
	GovernmentSubsidy  float64   `json:"government_subsidy"`
	FarmerContribution float64   `json:"farmer_contribution"`
	PolicyStartDate    time.Time `json:"policy_start_date"`
	PolicyEndDate      time.Time `json:"policy_end_date"`
	Status             string    `json:"status"` // ACTIVE, EXPIRED, CLAIMED, CANCELLED
	LinkedLoanID       string    `json:"linked_loan_id"`
	CreatedAt          time.Time `json:"created_at"`
}

type NAICClaim struct {
	ClaimID          string     `json:"claim_id"`
	NAICClaimNo      string     `json:"naic_claim_no"`
	PolicyID         string     `json:"policy_id"`
	ClaimType        string     `json:"claim_type"` // DROUGHT, FLOOD, PEST, DISEASE, FIRE
	ClaimDate        time.Time  `json:"claim_date"`
	IncidentDate     time.Time  `json:"incident_date"`
	IncidentDesc     string     `json:"incident_description"`
	ClaimAmount      float64    `json:"claim_amount"`
	AssessedAmount   float64    `json:"assessed_amount"`
	ApprovedAmount   float64    `json:"approved_amount"`
	PaidAmount       float64    `json:"paid_amount"`
	Status           string     `json:"status"` // SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, PAID
	AssessmentReport string     `json:"assessment_report"`
	AssessmentDate   *time.Time `json:"assessment_date"`
	PaymentDate      *time.Time `json:"payment_date"`
	RejectionReason  string     `json:"rejection_reason"`
}

// Commodity Exchange Integration (AFEX, LCFE)
type CommodityExchangeService struct {
	db         *sql.DB
	httpClient *http.Client
	afexAPIKey string
	lcfeAPIKey string
}

type CommodityPrice struct {
	ExchangeCode  string    `json:"exchange_code"` // AFEX, LCFE
	CommodityCode string    `json:"commodity_code"`
	CommodityName string    `json:"commodity_name"`
	Grade         string    `json:"grade"`
	Unit          string    `json:"unit"` // MT, KG, BAG
	BidPrice      float64   `json:"bid_price"`
	AskPrice      float64   `json:"ask_price"`
	LastPrice     float64   `json:"last_price"`
	OpenPrice     float64   `json:"open_price"`
	HighPrice     float64   `json:"high_price"`
	LowPrice      float64   `json:"low_price"`
	Volume        float64   `json:"volume"`
	ChangePercent float64   `json:"change_percent"`
	PriceDate     time.Time `json:"price_date"`
}

type DeliveryContract struct {
	ContractID       string    `json:"contract_id"`
	ExchangeCode     string    `json:"exchange_code"`
	ContractNo       string    `json:"contract_no"`
	SellerID         string    `json:"seller_id"` // Farmer or Cooperative
	BuyerID          string    `json:"buyer_id"`
	CommodityCode    string    `json:"commodity_code"`
	Quantity         float64   `json:"quantity"`
	Unit             string    `json:"unit"`
	Grade            string    `json:"grade"`
	ContractPrice    float64   `json:"contract_price"`
	TotalValue       float64   `json:"total_value"`
	DeliveryDate     time.Time `json:"delivery_date"`
	DeliveryLocation string    `json:"delivery_location"`
	WarehouseID      string    `json:"warehouse_id"`
	Status           string    `json:"status"` // PENDING, CONFIRMED, DELIVERED, SETTLED
	LinkedLoanID     string    `json:"linked_loan_id"`
	CreatedAt        time.Time `json:"created_at"`
}

// External Integrations Service
type ExternalIntegrationsService struct {
	db                *sql.DB
	creditBureau      *CreditBureauService
	crms              *CRMSService
	ncr               *NCRService
	naic              *NAICService
	commodityExchange *CommodityExchangeService
}

func NewExternalIntegrationsService(db *sql.DB) *ExternalIntegrationsService {
	httpClient := &http.Client{Timeout: 30 * time.Second}

	return &ExternalIntegrationsService{
		db: db,
		creditBureau: &CreditBureauService{
			db:         db,
			httpClient: httpClient,
			crcAPIKey:  os.Getenv("CRC_API_KEY"),
			crAPIKey:   os.Getenv("CREDIT_REGISTRY_API_KEY"),
			fcAPIKey:   os.Getenv("FIRST_CENTRAL_API_KEY"),
		},
		crms: &CRMSService{
			db:         db,
			httpClient: httpClient,
			apiKey:     os.Getenv("CBN_CRMS_API_KEY"),
			baseURL:    os.Getenv("CBN_CRMS_BASE_URL"),
		},
		ncr: &NCRService{
			db:         db,
			httpClient: httpClient,
			apiKey:     os.Getenv("NCR_API_KEY"),
			baseURL:    os.Getenv("NCR_BASE_URL"),
		},
		naic: &NAICService{
			db:         db,
			httpClient: httpClient,
			apiKey:     os.Getenv("NAIC_API_KEY"),
			baseURL:    os.Getenv("NAIC_BASE_URL"),
		},
		commodityExchange: &CommodityExchangeService{
			db:         db,
			httpClient: httpClient,
			afexAPIKey: os.Getenv("AFEX_API_KEY"),
			lcfeAPIKey: os.Getenv("LCFE_API_KEY"),
		},
	}
}

// Register external integration routes
func (s *ExternalIntegrationsService) RegisterRoutes(r *mux.Router) {
	// Credit Bureau
	r.HandleFunc("/api/v1/integrations/credit-bureau/report", s.GetCreditBureauReport).Methods("GET")
	r.HandleFunc("/api/v1/integrations/credit-bureau/score", s.GetCreditScore).Methods("GET")
	r.HandleFunc("/api/v1/integrations/credit-bureau/enquiry", s.SubmitCreditEnquiry).Methods("POST")

	// CBN CRMS
	r.HandleFunc("/api/v1/integrations/crms/exposure", s.GetCRMSExposure).Methods("GET")
	r.HandleFunc("/api/v1/integrations/crms/submit", s.SubmitToCRMS).Methods("POST")
	r.HandleFunc("/api/v1/integrations/crms/submissions", s.ListCRMSSubmissions).Methods("GET")

	// National Collateral Registry
	r.HandleFunc("/api/v1/integrations/ncr/search", s.SearchNCR).Methods("GET")
	r.HandleFunc("/api/v1/integrations/ncr/register", s.RegisterCollateral).Methods("POST")
	r.HandleFunc("/api/v1/integrations/ncr/discharge", s.DischargeCollateral).Methods("POST")
	r.HandleFunc("/api/v1/integrations/ncr/registrations", s.ListCollateralRegistrations).Methods("GET")

	// NAIC Insurance
	r.HandleFunc("/api/v1/integrations/naic/policies", s.ListNAICPolicies).Methods("GET")
	r.HandleFunc("/api/v1/integrations/naic/policies", s.CreateNAICPolicy).Methods("POST")
	r.HandleFunc("/api/v1/integrations/naic/policies/{policy_id}", s.GetNAICPolicy).Methods("GET")
	r.HandleFunc("/api/v1/integrations/naic/claims", s.ListNAICClaims).Methods("GET")
	r.HandleFunc("/api/v1/integrations/naic/claims", s.SubmitNAICClaim).Methods("POST")
	r.HandleFunc("/api/v1/integrations/naic/claims/{claim_id}", s.GetNAICClaim).Methods("GET")
	r.HandleFunc("/api/v1/integrations/naic/premium-calculator", s.CalculateNAICPremium).Methods("POST")

	// Commodity Exchange
	r.HandleFunc("/api/v1/integrations/commodity/prices", s.GetCommodityPrices).Methods("GET")
	r.HandleFunc("/api/v1/integrations/commodity/prices/{commodity}", s.GetCommodityPrice).Methods("GET")
	r.HandleFunc("/api/v1/integrations/commodity/contracts", s.ListDeliveryContracts).Methods("GET")
	r.HandleFunc("/api/v1/integrations/commodity/contracts", s.CreateDeliveryContract).Methods("POST")
	r.HandleFunc("/api/v1/integrations/commodity/contracts/{contract_id}", s.GetDeliveryContract).Methods("GET")
	r.HandleFunc("/api/v1/integrations/commodity/contracts/{contract_id}/confirm", s.ConfirmDelivery).Methods("POST")
}

// Credit Bureau Handlers
func (s *ExternalIntegrationsService) GetCreditBureauReport(w http.ResponseWriter, r *http.Request) {
	bvn := r.URL.Query().Get("bvn")
	bureau := r.URL.Query().Get("bureau") // CRC, CR, FC

	if bvn == "" {
		http.Error(w, "BVN is required", http.StatusBadRequest)
		return
	}

	// In production, this would call the actual credit bureau API
	// For now, return simulated data
	report := s.simulateCreditBureauReport(bvn, bureau)
	json.NewEncoder(w).Encode(report)
}

func (s *ExternalIntegrationsService) simulateCreditBureauReport(bvn, bureau string) CreditBureauReport {
	bureauName := "CRC Credit Bureau"
	if bureau == "CR" {
		bureauName = "CreditRegistry"
	} else if bureau == "FC" {
		bureauName = "FirstCentral"
	}

	now := time.Now()
	return CreditBureauReport{
		BureauName:       bureauName,
		ReportID:         fmt.Sprintf("RPT-%s-%d", bureau, now.Unix()),
		BVN:              bvn,
		FullName:         "Sample Farmer",
		CreditScore:      650,
		ScoreRating:      "Good",
		TotalAccounts:    3,
		ActiveAccounts:   2,
		ClosedAccounts:   1,
		TotalOutstanding: 500000.0,
		TotalOverdue:     0.0,
		MaxDaysOverdue:   0,
		DefaultCount:     0,
		EnquiryCount:     5,
		AccountHistory: []CreditAccount{
			{
				LenderName:     "MFB Sample",
				AccountType:    "Agricultural Loan",
				AccountStatus:  "Active",
				OpenDate:       now.AddDate(-1, 0, 0),
				CreditLimit:    500000.0,
				CurrentBalance: 300000.0,
				OverdueAmount:  0.0,
				DaysOverdue:    0,
				PaymentHistory: "CCCCCCCCCCCC",
			},
		},
		ReportDate: now,
		ValidUntil: now.AddDate(0, 0, 30),
	}
}

func (s *ExternalIntegrationsService) GetCreditScore(w http.ResponseWriter, r *http.Request) {
	bvn := r.URL.Query().Get("bvn")

	if bvn == "" {
		http.Error(w, "BVN is required", http.StatusBadRequest)
		return
	}

	result := map[string]interface{}{
		"bvn":          bvn,
		"credit_score": 650,
		"score_rating": "Good",
		"score_range":  "300-850",
		"factors": []string{
			"Payment history: Excellent",
			"Credit utilization: Good",
			"Credit age: Fair",
			"Credit mix: Good",
		},
		"retrieved_at": time.Now(),
	}
	json.NewEncoder(w).Encode(result)
}

func (s *ExternalIntegrationsService) SubmitCreditEnquiry(w http.ResponseWriter, r *http.Request) {
	var req struct {
		BVN        string  `json:"bvn"`
		Purpose    string  `json:"purpose"`
		LoanAmount float64 `json:"loan_amount"`
		Bureau     string  `json:"bureau"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	result := map[string]interface{}{
		"enquiry_id":   fmt.Sprintf("ENQ-%d", time.Now().Unix()),
		"bvn":          req.BVN,
		"bureau":       req.Bureau,
		"status":       "SUBMITTED",
		"submitted_at": time.Now(),
	}
	json.NewEncoder(w).Encode(result)
}

// CRMS Handlers
func (s *ExternalIntegrationsService) GetCRMSExposure(w http.ResponseWriter, r *http.Request) {
	bvn := r.URL.Query().Get("bvn")

	if bvn == "" {
		http.Error(w, "BVN is required", http.StatusBadRequest)
		return
	}

	// Simulated CRMS response
	exposure := CRMSExposure{
		ReportID:           fmt.Sprintf("CRMS-%d", time.Now().Unix()),
		BVN:                bvn,
		CustomerName:       "Sample Farmer",
		TotalExposure:      500000.0,
		PerformingLoans:    500000.0,
		NonPerformingLoans: 0.0,
		LenderCount:        1,
		Exposures: []CRMSLenderExposure{
			{
				LenderCode:        "MFB001",
				LenderName:        "Sample MFB",
				FacilityType:      "Agricultural Loan",
				OutstandingAmount: 500000.0,
				Status:            "PERFORMING",
				SectorCode:        "AGR001",
			},
		},
		ReportDate: time.Now(),
	}
	json.NewEncoder(w).Encode(exposure)
}

func (s *ExternalIntegrationsService) SubmitToCRMS(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TenantID     string `json:"tenant_id"`
		ReportPeriod string `json:"report_period"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Query agricultural loans for submission
	rows, err := s.db.QueryContext(r.Context(), `
		SELECT COUNT(*) FROM agricultural_loans 
		WHERE tenant_id = $1 AND status IN ('active', 'disbursed')
	`, req.TenantID)

	totalRecords := 0
	if err == nil {
		defer rows.Close()
		if rows.Next() {
			rows.Scan(&totalRecords)
		}
	}

	submission := CRMSSubmission{
		SubmissionID:     fmt.Sprintf("SUB-%d", time.Now().Unix()),
		TenantID:         req.TenantID,
		ReportPeriod:     req.ReportPeriod,
		TotalRecords:     totalRecords,
		SuccessRecords:   totalRecords,
		FailedRecords:    0,
		SubmissionStatus: "SUBMITTED",
		SubmittedAt:      time.Now(),
	}
	json.NewEncoder(w).Encode(submission)
}

func (s *ExternalIntegrationsService) ListCRMSSubmissions(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")

	submissions := []CRMSSubmission{
		{
			SubmissionID:     "SUB-001",
			TenantID:         tenantID,
			ReportPeriod:     "2024-12",
			TotalRecords:     150,
			SuccessRecords:   150,
			FailedRecords:    0,
			SubmissionStatus: "ACKNOWLEDGED",
			SubmittedAt:      time.Now().AddDate(0, 0, -30),
		},
	}
	json.NewEncoder(w).Encode(submissions)
}

// NCR Handlers
func (s *ExternalIntegrationsService) SearchNCR(w http.ResponseWriter, r *http.Request) {
	bvn := r.URL.Query().Get("bvn")

	if bvn == "" {
		http.Error(w, "BVN is required", http.StatusBadRequest)
		return
	}

	result := NCRSearchResult{
		DebtorBVN:           bvn,
		DebtorName:          "Sample Farmer",
		TotalRegistrations:  1,
		ActiveRegistrations: 1,
		Registrations: []CollateralRegistration{
			{
				RegistrationID:   "REG-001",
				NCRReferenceNo:   "NCR/2024/001234",
				DebtorBVN:        bvn,
				DebtorName:       "Sample Farmer",
				SecuredPartyName: "Sample MFB",
				SecuredPartyCode: "MFB001",
				CollateralType:   "LAND",
				CollateralDesc:   "5 hectares farmland in Kano State",
				CollateralValue:  2000000.0,
				GPSCoordinates:   "12.0022,8.5919",
				LandTitleNo:      "KN/2024/12345",
				RegistrationDate: time.Now().AddDate(-1, 0, 0),
				ExpiryDate:       time.Now().AddDate(4, 0, 0),
				Status:           "ACTIVE",
			},
		},
		SearchDate: time.Now(),
	}
	json.NewEncoder(w).Encode(result)
}

func (s *ExternalIntegrationsService) RegisterCollateral(w http.ResponseWriter, r *http.Request) {
	var req struct {
		DebtorBVN       string  `json:"debtor_bvn"`
		DebtorName      string  `json:"debtor_name"`
		CollateralType  string  `json:"collateral_type"`
		CollateralDesc  string  `json:"collateral_description"`
		CollateralValue float64 `json:"collateral_value"`
		SerialNumber    string  `json:"serial_number"`
		GPSCoordinates  string  `json:"gps_coordinates"`
		LandTitleNo     string  `json:"land_title_no"`
		LoanID          string  `json:"loan_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	registration := CollateralRegistration{
		RegistrationID:   fmt.Sprintf("REG-%d", time.Now().Unix()),
		NCRReferenceNo:   fmt.Sprintf("NCR/%d/%06d", time.Now().Year(), time.Now().Unix()%1000000),
		DebtorBVN:        req.DebtorBVN,
		DebtorName:       req.DebtorName,
		SecuredPartyName: "54Bank MFB",
		SecuredPartyCode: "54BANK",
		CollateralType:   req.CollateralType,
		CollateralDesc:   req.CollateralDesc,
		CollateralValue:  req.CollateralValue,
		SerialNumber:     req.SerialNumber,
		GPSCoordinates:   req.GPSCoordinates,
		LandTitleNo:      req.LandTitleNo,
		RegistrationDate: time.Now(),
		ExpiryDate:       time.Now().AddDate(5, 0, 0),
		Status:           "ACTIVE",
		LoanID:           req.LoanID,
	}

	// Update loan with NCR registration
	if req.LoanID != "" {
		s.db.ExecContext(r.Context(), `
			UPDATE agricultural_loans 
			SET ncr_registered = true, ncr_registration_no = $1
			WHERE id = $2
		`, registration.NCRReferenceNo, req.LoanID)
	}

	json.NewEncoder(w).Encode(registration)
}

func (s *ExternalIntegrationsService) DischargeCollateral(w http.ResponseWriter, r *http.Request) {
	var req struct {
		NCRReferenceNo string `json:"ncr_reference_no"`
		Reason         string `json:"reason"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	result := map[string]interface{}{
		"ncr_reference_no": req.NCRReferenceNo,
		"status":           "DISCHARGED",
		"discharged_at":    time.Now(),
		"reason":           req.Reason,
	}
	json.NewEncoder(w).Encode(result)
}

func (s *ExternalIntegrationsService) ListCollateralRegistrations(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")

	registrations := []CollateralRegistration{
		{
			RegistrationID:   "REG-001",
			NCRReferenceNo:   "NCR/2024/001234",
			DebtorBVN:        "12345678901",
			DebtorName:       "Sample Farmer",
			SecuredPartyName: "54Bank MFB",
			CollateralType:   "LAND",
			CollateralValue:  2000000.0,
			Status:           "ACTIVE",
			RegistrationDate: time.Now().AddDate(-1, 0, 0),
		},
	}

	result := map[string]interface{}{
		"tenant_id":     tenantID,
		"registrations": registrations,
		"total":         len(registrations),
	}
	json.NewEncoder(w).Encode(result)
}

// NAIC Handlers
func (s *ExternalIntegrationsService) ListNAICPolicies(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	farmerID := r.URL.Query().Get("farmer_id")

	policies := []NAICPolicy{
		{
			PolicyID:           "POL-001",
			NAICPolicyNo:       "NAIC/2024/AGR/001234",
			PolicyType:         "CROP",
			FarmerName:         "Sample Farmer",
			FarmerBVN:          "12345678901",
			FarmLocation:       "Kano State",
			State:              "Kano",
			LGA:                "Kano Municipal",
			CropType:           "rice",
			CoverageArea:       5.0,
			SumInsured:         1000000.0,
			Premium:            50000.0,
			PremiumPaid:        50000.0,
			GovernmentSubsidy:  25000.0,
			FarmerContribution: 25000.0,
			PolicyStartDate:    time.Now().AddDate(0, -3, 0),
			PolicyEndDate:      time.Now().AddDate(0, 9, 0),
			Status:             "ACTIVE",
		},
	}

	result := map[string]interface{}{
		"tenant_id": tenantID,
		"farmer_id": farmerID,
		"policies":  policies,
		"total":     len(policies),
	}
	json.NewEncoder(w).Encode(result)
}

func (s *ExternalIntegrationsService) CreateNAICPolicy(w http.ResponseWriter, r *http.Request) {
	var req struct {
		FarmerID      string  `json:"farmer_id"`
		PolicyType    string  `json:"policy_type"`
		CropType      string  `json:"crop_type"`
		LivestockType string  `json:"livestock_type"`
		CoverageArea  float64 `json:"coverage_area"`
		SumInsured    float64 `json:"sum_insured"`
		LinkedLoanID  string  `json:"linked_loan_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Calculate premium (5% of sum insured, 50% government subsidy)
	premium := req.SumInsured * 0.05
	govSubsidy := premium * 0.50
	farmerContrib := premium - govSubsidy

	policy := NAICPolicy{
		PolicyID:           fmt.Sprintf("POL-%d", time.Now().Unix()),
		NAICPolicyNo:       fmt.Sprintf("NAIC/%d/AGR/%06d", time.Now().Year(), time.Now().Unix()%1000000),
		PolicyType:         req.PolicyType,
		CropType:           req.CropType,
		LivestockType:      req.LivestockType,
		CoverageArea:       req.CoverageArea,
		SumInsured:         req.SumInsured,
		Premium:            premium,
		GovernmentSubsidy:  govSubsidy,
		FarmerContribution: farmerContrib,
		PolicyStartDate:    time.Now(),
		PolicyEndDate:      time.Now().AddDate(1, 0, 0),
		Status:             "ACTIVE",
		LinkedLoanID:       req.LinkedLoanID,
		CreatedAt:          time.Now(),
	}

	// Link to loan if provided
	if req.LinkedLoanID != "" {
		s.db.ExecContext(r.Context(), `
			UPDATE agricultural_loans 
			SET insurance_policy_id = $1
			WHERE id = $2
		`, policy.PolicyID, req.LinkedLoanID)
	}

	json.NewEncoder(w).Encode(policy)
}

func (s *ExternalIntegrationsService) GetNAICPolicy(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	policyID := vars["policy_id"]

	policy := NAICPolicy{
		PolicyID:        policyID,
		NAICPolicyNo:    "NAIC/2024/AGR/001234",
		PolicyType:      "CROP",
		FarmerName:      "Sample Farmer",
		CropType:        "rice",
		CoverageArea:    5.0,
		SumInsured:      1000000.0,
		Premium:         50000.0,
		Status:          "ACTIVE",
		PolicyStartDate: time.Now().AddDate(0, -3, 0),
		PolicyEndDate:   time.Now().AddDate(0, 9, 0),
	}
	json.NewEncoder(w).Encode(policy)
}

func (s *ExternalIntegrationsService) ListNAICClaims(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")

	claims := []NAICClaim{
		{
			ClaimID:        "CLM-001",
			NAICClaimNo:    "NAIC/CLM/2024/001234",
			PolicyID:       "POL-001",
			ClaimType:      "DROUGHT",
			ClaimDate:      time.Now().AddDate(0, -1, 0),
			IncidentDate:   time.Now().AddDate(0, -1, -7),
			IncidentDesc:   "Severe drought affecting rice crop",
			ClaimAmount:    500000.0,
			AssessedAmount: 450000.0,
			ApprovedAmount: 450000.0,
			PaidAmount:     450000.0,
			Status:         "PAID",
		},
	}

	result := map[string]interface{}{
		"tenant_id": tenantID,
		"claims":    claims,
		"total":     len(claims),
	}
	json.NewEncoder(w).Encode(result)
}

func (s *ExternalIntegrationsService) SubmitNAICClaim(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PolicyID     string    `json:"policy_id"`
		ClaimType    string    `json:"claim_type"`
		IncidentDate time.Time `json:"incident_date"`
		IncidentDesc string    `json:"incident_description"`
		ClaimAmount  float64   `json:"claim_amount"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	claim := NAICClaim{
		ClaimID:      fmt.Sprintf("CLM-%d", time.Now().Unix()),
		NAICClaimNo:  fmt.Sprintf("NAIC/CLM/%d/%06d", time.Now().Year(), time.Now().Unix()%1000000),
		PolicyID:     req.PolicyID,
		ClaimType:    req.ClaimType,
		ClaimDate:    time.Now(),
		IncidentDate: req.IncidentDate,
		IncidentDesc: req.IncidentDesc,
		ClaimAmount:  req.ClaimAmount,
		Status:       "SUBMITTED",
	}
	json.NewEncoder(w).Encode(claim)
}

func (s *ExternalIntegrationsService) GetNAICClaim(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	claimID := vars["claim_id"]

	claim := NAICClaim{
		ClaimID:     claimID,
		NAICClaimNo: "NAIC/CLM/2024/001234",
		PolicyID:    "POL-001",
		ClaimType:   "DROUGHT",
		ClaimAmount: 500000.0,
		Status:      "UNDER_REVIEW",
	}
	json.NewEncoder(w).Encode(claim)
}

func (s *ExternalIntegrationsService) CalculateNAICPremium(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PolicyType    string  `json:"policy_type"`
		CropType      string  `json:"crop_type"`
		LivestockType string  `json:"livestock_type"`
		CoverageArea  float64 `json:"coverage_area"`
		SumInsured    float64 `json:"sum_insured"`
		State         string  `json:"state"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Premium calculation based on risk factors
	baseRate := 0.05 // 5% base rate

	// Adjust for crop type risk
	cropRiskMultiplier := map[string]float64{
		"rice": 1.0, "maize": 0.9, "cassava": 0.8, "tomato": 1.3, "pepper": 1.2,
	}
	multiplier := cropRiskMultiplier[req.CropType]
	if multiplier == 0 {
		multiplier = 1.0
	}

	// Adjust for state risk (drought/flood prone)
	stateRiskMultiplier := map[string]float64{
		"Kano": 1.1, "Borno": 1.3, "Lagos": 0.9, "Oyo": 0.95,
	}
	stateMultiplier := stateRiskMultiplier[req.State]
	if stateMultiplier == 0 {
		stateMultiplier = 1.0
	}

	premium := req.SumInsured * baseRate * multiplier * stateMultiplier
	govSubsidy := premium * 0.50
	farmerContrib := premium - govSubsidy

	result := map[string]interface{}{
		"sum_insured":         req.SumInsured,
		"base_rate":           baseRate * 100,
		"crop_risk_factor":    multiplier,
		"state_risk_factor":   stateMultiplier,
		"total_premium":       premium,
		"government_subsidy":  govSubsidy,
		"farmer_contribution": farmerContrib,
		"coverage_details": map[string]interface{}{
			"drought":   true,
			"flood":     true,
			"pest":      true,
			"disease":   true,
			"fire":      true,
			"windstorm": true,
		},
	}
	json.NewEncoder(w).Encode(result)
}

// Commodity Exchange Handlers
func (s *ExternalIntegrationsService) GetCommodityPrices(w http.ResponseWriter, r *http.Request) {
	exchange := r.URL.Query().Get("exchange") // AFEX, LCFE

	prices := []CommodityPrice{
		{ExchangeCode: "AFEX", CommodityCode: "RICE", CommodityName: "Paddy Rice", Grade: "Grade A", Unit: "MT", BidPrice: 340000, AskPrice: 345000, LastPrice: 342000, ChangePercent: 1.5, PriceDate: time.Now()},
		{ExchangeCode: "AFEX", CommodityCode: "MAIZE", CommodityName: "Yellow Maize", Grade: "Grade A", Unit: "MT", BidPrice: 240000, AskPrice: 245000, LastPrice: 242000, ChangePercent: -0.5, PriceDate: time.Now()},
		{ExchangeCode: "AFEX", CommodityCode: "SORGHUM", CommodityName: "Red Sorghum", Grade: "Grade A", Unit: "MT", BidPrice: 175000, AskPrice: 180000, LastPrice: 177000, ChangePercent: 2.0, PriceDate: time.Now()},
		{ExchangeCode: "AFEX", CommodityCode: "SOYBEAN", CommodityName: "Soybean", Grade: "Grade A", Unit: "MT", BidPrice: 380000, AskPrice: 385000, LastPrice: 382000, ChangePercent: 0.8, PriceDate: time.Now()},
		{ExchangeCode: "AFEX", CommodityCode: "SESAME", CommodityName: "Sesame Seeds", Grade: "Grade A", Unit: "MT", BidPrice: 580000, AskPrice: 590000, LastPrice: 585000, ChangePercent: 1.2, PriceDate: time.Now()},
		{ExchangeCode: "AFEX", CommodityCode: "COCOA", CommodityName: "Cocoa Beans", Grade: "Grade A", Unit: "MT", BidPrice: 1450000, AskPrice: 1480000, LastPrice: 1465000, ChangePercent: 3.5, PriceDate: time.Now()},
		{ExchangeCode: "LCFE", CommodityCode: "PALM_OIL", CommodityName: "Crude Palm Oil", Grade: "Standard", Unit: "MT", BidPrice: 780000, AskPrice: 790000, LastPrice: 785000, ChangePercent: -1.0, PriceDate: time.Now()},
	}

	if exchange != "" {
		filtered := []CommodityPrice{}
		for _, p := range prices {
			if p.ExchangeCode == exchange {
				filtered = append(filtered, p)
			}
		}
		prices = filtered
	}

	json.NewEncoder(w).Encode(prices)
}

func (s *ExternalIntegrationsService) GetCommodityPrice(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	commodity := vars["commodity"]

	price := CommodityPrice{
		ExchangeCode:  "AFEX",
		CommodityCode: commodity,
		CommodityName: commodity,
		Grade:         "Grade A",
		Unit:          "MT",
		BidPrice:      340000,
		AskPrice:      345000,
		LastPrice:     342000,
		OpenPrice:     338000,
		HighPrice:     348000,
		LowPrice:      336000,
		Volume:        1500,
		ChangePercent: 1.5,
		PriceDate:     time.Now(),
	}
	json.NewEncoder(w).Encode(price)
}

func (s *ExternalIntegrationsService) ListDeliveryContracts(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")

	contracts := []DeliveryContract{
		{
			ContractID:       "DC-001",
			ExchangeCode:     "AFEX",
			ContractNo:       "AFEX/DC/2024/001234",
			SellerID:         "FARMER-001",
			BuyerID:          "BUYER-001",
			CommodityCode:    "RICE",
			Quantity:         50.0,
			Unit:             "MT",
			Grade:            "Grade A",
			ContractPrice:    342000,
			TotalValue:       17100000,
			DeliveryDate:     time.Now().AddDate(0, 3, 0),
			DeliveryLocation: "AFEX Warehouse, Kano",
			Status:           "CONFIRMED",
			LinkedLoanID:     "LOAN-001",
			CreatedAt:        time.Now().AddDate(0, -1, 0),
		},
	}

	result := map[string]interface{}{
		"tenant_id": tenantID,
		"contracts": contracts,
		"total":     len(contracts),
	}
	json.NewEncoder(w).Encode(result)
}

func (s *ExternalIntegrationsService) CreateDeliveryContract(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SellerID         string    `json:"seller_id"`
		BuyerID          string    `json:"buyer_id"`
		CommodityCode    string    `json:"commodity_code"`
		Quantity         float64   `json:"quantity"`
		Unit             string    `json:"unit"`
		Grade            string    `json:"grade"`
		ContractPrice    float64   `json:"contract_price"`
		DeliveryDate     time.Time `json:"delivery_date"`
		DeliveryLocation string    `json:"delivery_location"`
		LinkedLoanID     string    `json:"linked_loan_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	contract := DeliveryContract{
		ContractID:       fmt.Sprintf("DC-%d", time.Now().Unix()),
		ExchangeCode:     "AFEX",
		ContractNo:       fmt.Sprintf("AFEX/DC/%d/%06d", time.Now().Year(), time.Now().Unix()%1000000),
		SellerID:         req.SellerID,
		BuyerID:          req.BuyerID,
		CommodityCode:    req.CommodityCode,
		Quantity:         req.Quantity,
		Unit:             req.Unit,
		Grade:            req.Grade,
		ContractPrice:    req.ContractPrice,
		TotalValue:       req.Quantity * req.ContractPrice,
		DeliveryDate:     req.DeliveryDate,
		DeliveryLocation: req.DeliveryLocation,
		Status:           "PENDING",
		LinkedLoanID:     req.LinkedLoanID,
		CreatedAt:        time.Now(),
	}
	json.NewEncoder(w).Encode(contract)
}

func (s *ExternalIntegrationsService) GetDeliveryContract(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	contractID := vars["contract_id"]

	contract := DeliveryContract{
		ContractID:    contractID,
		ExchangeCode:  "AFEX",
		ContractNo:    "AFEX/DC/2024/001234",
		CommodityCode: "RICE",
		Quantity:      50.0,
		ContractPrice: 342000,
		TotalValue:    17100000,
		Status:        "CONFIRMED",
	}
	json.NewEncoder(w).Encode(contract)
}

func (s *ExternalIntegrationsService) ConfirmDelivery(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	contractID := vars["contract_id"]

	var req struct {
		DeliveredQuantity float64 `json:"delivered_quantity"`
		QualityGrade      string  `json:"quality_grade"`
		WarehouseReceipt  string  `json:"warehouse_receipt"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	result := map[string]interface{}{
		"contract_id":        contractID,
		"status":             "DELIVERED",
		"delivered_quantity": req.DeliveredQuantity,
		"quality_grade":      req.QualityGrade,
		"warehouse_receipt":  req.WarehouseReceipt,
		"confirmed_at":       time.Now(),
	}
	json.NewEncoder(w).Encode(result)
}
