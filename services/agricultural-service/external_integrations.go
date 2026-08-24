package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/mux"
)

// ==================== EXTERNAL INTEGRATIONS ====================
// Credit Bureaus, CRMS, NCR, NAIC, Commodity Exchanges
//
// Doctrine: every external datum (bureau score/report, CRMS submission
// status, NCR registration, NAIC policy/claim, exchange price) comes from a
// REAL upstream call over env-configured base URLs, or from rows this
// service persisted after such a call. If an upstream is unconfigured or
// unreachable the handler fails fast (503) or reports not_submitted.
// Nothing is fabricated.

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
	ScoreRating      string          `json:"score_rating"`
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
	PaymentHistory string     `json:"payment_history"`
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
	SerialNumber     string    `json:"serial_number"`
	GPSCoordinates   string    `json:"gps_coordinates"`
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
	PolicyType         string    `json:"policy_type"`
	FarmerName         string    `json:"farmer_name"`
	FarmerBVN          string    `json:"farmer_bvn"`
	FarmLocation       string    `json:"farm_location"`
	State              string    `json:"state"`
	LGA                string    `json:"lga"`
	CropType           string    `json:"crop_type"`
	LivestockType      string    `json:"livestock_type"`
	CoverageArea       float64   `json:"coverage_area"`
	SumInsured         float64   `json:"sum_insured"`
	Premium            float64   `json:"premium"`
	PremiumPaid        float64   `json:"premium_paid"`
	GovernmentSubsidy  float64   `json:"government_subsidy"`
	FarmerContribution float64   `json:"farmer_contribution"`
	PolicyStartDate    time.Time `json:"policy_start_date"`
	PolicyEndDate      time.Time `json:"policy_end_date"`
	Status             string    `json:"status"` // RECORDED, SUBMITTED, ACTIVE, EXPIRED, CLAIMED, CANCELLED
	LinkedLoanID       string    `json:"linked_loan_id"`
	CreatedAt          time.Time `json:"created_at"`
}

type NAICClaim struct {
	ClaimID          string     `json:"claim_id"`
	NAICClaimNo      string     `json:"naic_claim_no"`
	PolicyID         string     `json:"policy_id"`
	ClaimType        string     `json:"claim_type"`
	ClaimDate        time.Time  `json:"claim_date"`
	IncidentDate     time.Time  `json:"incident_date"`
	IncidentDesc     string     `json:"incident_description"`
	ClaimAmount      float64    `json:"claim_amount"`
	AssessedAmount   float64    `json:"assessed_amount"`
	ApprovedAmount   float64    `json:"approved_amount"`
	PaidAmount       float64    `json:"paid_amount"`
	Status           string     `json:"status"` // RECORDED, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, PAID
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
	ExchangeCode  string    `json:"exchange_code"`
	CommodityCode string    `json:"commodity_code"`
	CommodityName string    `json:"commodity_name"`
	Grade         string    `json:"grade"`
	Unit          string    `json:"unit"`
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
	SellerID         string    `json:"seller_id"`
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

func (s *ExternalIntegrationsService) ensureAgriculturalLoansTable(r *http.Request) error {
	_, err := s.db.ExecContext(r.Context(), `
		CREATE TABLE IF NOT EXISTS agricultural_loans (
			id                   VARCHAR(64) PRIMARY KEY,
			tenant_id            VARCHAR(64) NOT NULL,
			customer_id          VARCHAR(64),
			farmer_id            VARCHAR(64),
			product_type         VARCHAR(64) NOT NULL DEFAULT 'input_finance',
			amount               NUMERIC(18,2) NOT NULL DEFAULT 0,
			currency             VARCHAR(3) NOT NULL DEFAULT 'NGN',
			status               VARCHAR(32) NOT NULL DEFAULT 'active',
			ncr_registered       BOOLEAN NOT NULL DEFAULT FALSE,
			ncr_registration_no  VARCHAR(128),
			insurance_policy_id  VARCHAR(128),
			disbursed_at         TIMESTAMPTZ,
			created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
	`)
	return err
}

func (s *ExternalIntegrationsService) ensureIntegrationTables() error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS crms_submissions (
			submission_id VARCHAR(96) PRIMARY KEY,
			tenant_id VARCHAR(64) NOT NULL,
			report_period VARCHAR(16) NOT NULL,
			total_records INT NOT NULL DEFAULT 0,
			success_records INT NOT NULL DEFAULT 0,
			failed_records INT NOT NULL DEFAULT 0,
			submission_status VARCHAR(32) NOT NULL,
			submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			acknowledged_at TIMESTAMPTZ
		)`,
		`CREATE TABLE IF NOT EXISTS ncr_registrations (
			registration_id VARCHAR(96) PRIMARY KEY,
			ncr_reference_no VARCHAR(128),
			debtor_bvn VARCHAR(16),
			debtor_name VARCHAR(200),
			collateral_type VARCHAR(32),
			collateral_value NUMERIC(18,2),
			status VARCHAR(32) NOT NULL,
			loan_id VARCHAR(64),
			payload JSONB,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS naic_policies (
			policy_id VARCHAR(96) PRIMARY KEY,
			naic_policy_no VARCHAR(128),
			policy_type VARCHAR(32),
			farmer_id VARCHAR(64),
			sum_insured NUMERIC(18,2),
			premium NUMERIC(18,2),
			status VARCHAR(32) NOT NULL,
			linked_loan_id VARCHAR(64),
			payload JSONB,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS naic_claims (
			claim_id VARCHAR(96) PRIMARY KEY,
			policy_id VARCHAR(96),
			claim_type VARCHAR(32),
			claim_amount NUMERIC(18,2),
			status VARCHAR(32) NOT NULL,
			payload JSONB,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS commodity_contracts (
			contract_id VARCHAR(96) PRIMARY KEY,
			exchange_code VARCHAR(16),
			seller_id VARCHAR(64),
			buyer_id VARCHAR(64),
			commodity_code VARCHAR(32),
			quantity NUMERIC(18,2),
			contract_price NUMERIC(18,2),
			status VARCHAR(32) NOT NULL,
			linked_loan_id VARCHAR(64),
			payload JSONB,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
	}
	for _, q := range stmts {
		if _, err := s.db.Exec(q); err != nil {
			return err
		}
	}
	return nil
}

// callUpstream performs a real HTTP call to an external provider. Any
// transport error, non-2xx status, or invalid JSON is an error — the caller
// fails closed (503 / not_submitted) instead of fabricating a result.
func callUpstream(client *http.Client, method, url, apiKey string, reqBody interface{}) (map[string]interface{}, error) {
	var reader io.Reader
	if reqBody != nil {
		payload, err := json.Marshal(reqBody)
		if err != nil {
			return nil, err
		}
		reader = bytes.NewReader(payload)
	}
	req, err := http.NewRequest(method, url, reader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if apiKey != "" {
		req.Header.Set("X-API-Key", apiKey)
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("upstream call %s %s failed: %w", method, url, err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("upstream %s %s returned status %d", method, url, resp.StatusCode)
	}
	var result map[string]interface{}
	if len(body) > 0 {
		if err := json.Unmarshal(body, &result); err != nil {
			return nil, fmt.Errorf("upstream %s %s returned invalid JSON: %w", method, url, err)
		}
	}
	return result, nil
}

func writeJSONExt(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func upstreamUnavailable(w http.ResponseWriter, provider string, err error) {
	writeJSONExt(w, http.StatusServiceUnavailable, map[string]interface{}{
		"error":    fmt.Sprintf("%s_unavailable", provider),
		"detail":   err.Error(),
		"doctrine": "no fabricated " + provider + " data is ever returned",
	})
}

// bureauBaseURL resolves the configured base URL + API key for a bureau code.
func (s *ExternalIntegrationsService) bureauConfig(bureau string) (string, string, string, error) {
	switch bureau {
	case "CRC", "":
		return os.Getenv("CRC_BUREAU_URL"), s.creditBureau.crcAPIKey, "CRC Credit Bureau", nil
	case "CR":
		return os.Getenv("CREDIT_REGISTRY_URL"), s.creditBureau.crAPIKey, "CreditRegistry", nil
	case "FC":
		return os.Getenv("FIRST_CENTRAL_URL"), s.creditBureau.fcAPIKey, "FirstCentral", nil
	}
	return "", "", "", fmt.Errorf("unknown bureau code %q (expected CRC, CR, FC)", bureau)
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

	baseURL, apiKey, _, err := s.bureauConfig(bureau)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if baseURL == "" {
		upstreamUnavailable(w, "credit_bureau", fmt.Errorf("bureau base URL env var not set (CRC_BUREAU_URL / CREDIT_REGISTRY_URL / FIRST_CENTRAL_URL)"))
		return
	}

	resp, err := callUpstream(s.creditBureau.httpClient, "GET",
		fmt.Sprintf("%s/v1/bureau/report?bvn=%s", baseURL, bvn), apiKey, nil)
	if err != nil {
		upstreamUnavailable(w, "credit_bureau", err)
		return
	}
	resp["source"] = baseURL
	writeJSONExt(w, 200, resp)
}

func (s *ExternalIntegrationsService) GetCreditScore(w http.ResponseWriter, r *http.Request) {
	bvn := r.URL.Query().Get("bvn")
	bureau := r.URL.Query().Get("bureau")

	if bvn == "" {
		http.Error(w, "BVN is required", http.StatusBadRequest)
		return
	}

	baseURL, apiKey, _, err := s.bureauConfig(bureau)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if baseURL == "" {
		upstreamUnavailable(w, "credit_bureau", fmt.Errorf("bureau base URL env var not set"))
		return
	}

	resp, err := callUpstream(s.creditBureau.httpClient, "GET",
		fmt.Sprintf("%s/v1/bureau/score?bvn=%s", baseURL, bvn), apiKey, nil)
	if err != nil {
		upstreamUnavailable(w, "credit_bureau", err)
		return
	}
	// Pass through ONLY the bureau-reported score; never invent one.
	if _, ok := resp["credit_score"]; !ok {
		if _, ok := resp["creditScore"]; !ok {
			upstreamUnavailable(w, "credit_bureau", fmt.Errorf("bureau response contained no credit score"))
			return
		}
	}
	resp["source"] = baseURL
	writeJSONExt(w, 200, resp)
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

	baseURL, apiKey, _, err := s.bureauConfig(req.Bureau)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if baseURL == "" {
		writeJSONExt(w, http.StatusServiceUnavailable, map[string]interface{}{
			"bvn": req.BVN, "bureau": req.Bureau, "status": "not_submitted",
			"error": "credit_bureau_unavailable",
		})
		return
	}

	resp, err := callUpstream(s.creditBureau.httpClient, "POST", baseURL+"/v1/bureau/enquiry", apiKey, req)
	if err != nil {
		writeJSONExt(w, http.StatusServiceUnavailable, map[string]interface{}{
			"bvn": req.BVN, "bureau": req.Bureau, "status": "not_submitted",
			"error": err.Error(),
		})
		return
	}
	writeJSONExt(w, 200, resp)
}

// CRMS Handlers
func (s *ExternalIntegrationsService) GetCRMSExposure(w http.ResponseWriter, r *http.Request) {
	bvn := r.URL.Query().Get("bvn")

	if bvn == "" {
		http.Error(w, "BVN is required", http.StatusBadRequest)
		return
	}

	if s.crms.baseURL == "" {
		upstreamUnavailable(w, "crms", fmt.Errorf("CBN_CRMS_BASE_URL not configured"))
		return
	}
	resp, err := callUpstream(s.crms.httpClient, "GET",
		fmt.Sprintf("%s/v1/crms/exposure?bvn=%s", s.crms.baseURL, bvn), s.crms.apiKey, nil)
	if err != nil {
		upstreamUnavailable(w, "crms", err)
		return
	}
	writeJSONExt(w, 200, resp)
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

	if err := s.ensureIntegrationTables(); err != nil {
		upstreamUnavailable(w, "crms", fmt.Errorf("submission store unavailable: %w", err))
		return
	}
	_ = s.ensureAgriculturalLoansTable(r)

	// Real records from Postgres — the actual loan book for the tenant.
	rows, err := s.db.QueryContext(r.Context(), `
		SELECT id, customer_id, amount, currency, status FROM agricultural_loans
		WHERE tenant_id = $1 AND status IN ('active', 'disbursed')
	`, req.TenantID)
	if err != nil {
		upstreamUnavailable(w, "crms", fmt.Errorf("could not load loan records: %w", err))
		return
	}
	type loanRec struct {
		ID, CustomerID, Currency, Status string
		Amount                           float64
	}
	var records []loanRec
	for rows.Next() {
		var lr loanRec
		if rows.Scan(&lr.ID, &lr.CustomerID, &lr.Amount, &lr.Currency, &lr.Status) == nil {
			records = append(records, lr)
		}
	}
	rows.Close()

	submissionID := fmt.Sprintf("SUB-%d", time.Now().UnixNano())
	submission := CRMSSubmission{
		SubmissionID:     submissionID,
		TenantID:         req.TenantID,
		ReportPeriod:     req.ReportPeriod,
		TotalRecords:     len(records),
		SubmissionStatus: "not_submitted",
		SubmittedAt:      time.Now(),
	}

	if s.crms.baseURL == "" {
		// No CRMS channel configured: record honestly as not_submitted.
		s.persistCRMSSubmission(submission)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"submission": submission,
			"error":      "CBN_CRMS_BASE_URL not configured — nothing was submitted to CBN",
		})
		return
	}

	// Real CRMS submission call.
	resp, err := callUpstream(s.crms.httpClient, "POST",
		s.crms.baseURL+"/v1/crms/submissions", s.crms.apiKey, map[string]interface{}{
			"tenant_id":     req.TenantID,
			"report_period": req.ReportPeriod,
			"records":       records,
		})
	if err != nil {
		submission.SubmissionStatus = "not_submitted"
		s.persistCRMSSubmission(submission)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"submission": submission,
			"error":      err.Error(),
		})
		return
	}

	// Use CBN's own acknowledgement fields; no local success fabrication.
	if v, ok := resp["success_records"].(float64); ok {
		submission.SuccessRecords = int(v)
	}
	if v, ok := resp["failed_records"].(float64); ok {
		submission.FailedRecords = int(v)
	}
	if v, ok := resp["status"].(string); ok && v != "" {
		submission.SubmissionStatus = v
	} else {
		submission.SubmissionStatus = "SUBMITTED"
	}
	if ref, ok := resp["acknowledgement_reference"].(string); ok && ref != "" {
		now := time.Now()
		submission.AcknowledgedAt = &now
	}
	s.persistCRMSSubmission(submission)
	writeJSONExt(w, 200, submission)
}

func (s *ExternalIntegrationsService) persistCRMSSubmission(sub CRMSSubmission) {
	if _, err := s.db.Exec(`INSERT INTO crms_submissions
		(submission_id, tenant_id, report_period, total_records, success_records, failed_records, submission_status, submitted_at, acknowledged_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		ON CONFLICT (submission_id) DO UPDATE SET submission_status = $7, success_records = $5, failed_records = $6, acknowledged_at = $9`,
		sub.SubmissionID, sub.TenantID, sub.ReportPeriod, sub.TotalRecords,
		sub.SuccessRecords, sub.FailedRecords, sub.SubmissionStatus, sub.SubmittedAt, sub.AcknowledgedAt); err != nil {
		fmt.Printf("[external-integrations] persist crms submission failed: %v\n", err)
	}
}

func (s *ExternalIntegrationsService) ListCRMSSubmissions(w http.ResponseWriter, r *http.Request) {
	// Tenant identity comes ONLY from verified JWT claims (stamped onto
	// X-Tenant-ID by jwtAuthMiddleware); never from caller-supplied query
	// parameters. Fail-closed: a missing tenant is rejected before any query.
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		http.Error(w, `{"error":"forbidden: tenant required"}`, http.StatusForbidden)
		return
	}
	if err := s.ensureIntegrationTables(); err != nil {
		upstreamUnavailable(w, "crms", err)
		return
	}
	rows, err := s.db.QueryContext(r.Context(), `
		SELECT submission_id, tenant_id, report_period, total_records, success_records,
			failed_records, submission_status, submitted_at, acknowledged_at
		FROM crms_submissions WHERE tenant_id = $1 ORDER BY submitted_at DESC LIMIT 100`, tenantID)
	if err != nil {
		upstreamUnavailable(w, "crms", err)
		return
	}
	defer rows.Close()
	submissions := []CRMSSubmission{}
	for rows.Next() {
		var sub CRMSSubmission
		if err := rows.Scan(&sub.SubmissionID, &sub.TenantID, &sub.ReportPeriod, &sub.TotalRecords,
			&sub.SuccessRecords, &sub.FailedRecords, &sub.SubmissionStatus, &sub.SubmittedAt, &sub.AcknowledgedAt); err == nil {
			submissions = append(submissions, sub)
		}
	}
	writeJSONExt(w, 200, map[string]interface{}{"submissions": submissions, "total": len(submissions), "source": "postgres"})
}

// NCR Handlers
func (s *ExternalIntegrationsService) SearchNCR(w http.ResponseWriter, r *http.Request) {
	bvn := r.URL.Query().Get("bvn")

	if bvn == "" {
		http.Error(w, "BVN is required", http.StatusBadRequest)
		return
	}

	if s.ncr.baseURL == "" {
		upstreamUnavailable(w, "ncr", fmt.Errorf("NCR_BASE_URL not configured"))
		return
	}
	resp, err := callUpstream(s.ncr.httpClient, "GET",
		fmt.Sprintf("%s/v1/ncr/search?bvn=%s", s.ncr.baseURL, bvn), s.ncr.apiKey, nil)
	if err != nil {
		upstreamUnavailable(w, "ncr", err)
		return
	}
	writeJSONExt(w, 200, resp)
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

	if s.ncr.baseURL == "" {
		upstreamUnavailable(w, "ncr", fmt.Errorf("NCR_BASE_URL not configured — collateral NOT registered"))
		return
	}

	// Register with the real NCR; only the NCR-issued reference is stored.
	resp, err := callUpstream(s.ncr.httpClient, "POST", s.ncr.baseURL+"/v1/ncr/registrations", s.ncr.apiKey, req)
	if err != nil {
		upstreamUnavailable(w, "ncr", err)
		return
	}

	registration := CollateralRegistration{
		RegistrationID:   fmt.Sprintf("REG-%d", time.Now().UnixNano()),
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
		Status:           "ACTIVE",
		LoanID:           req.LoanID,
	}
	// NCR reference must come from the registry response.
	if ref, ok := resp["ncr_reference_no"].(string); ok && ref != "" {
		registration.NCRReferenceNo = ref
	} else if ref, ok := resp["reference"].(string); ok && ref != "" {
		registration.NCRReferenceNo = ref
	} else {
		upstreamUnavailable(w, "ncr", fmt.Errorf("NCR response contained no registration reference"))
		return
	}

	if err := s.ensureIntegrationTables(); err == nil {
		payload, _ := json.Marshal(registration)
		s.db.Exec(`INSERT INTO ncr_registrations
			(registration_id, ncr_reference_no, debtor_bvn, debtor_name, collateral_type, collateral_value, status, loan_id, payload)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
			registration.RegistrationID, registration.NCRReferenceNo, registration.DebtorBVN,
			registration.DebtorName, registration.CollateralType, registration.CollateralValue,
			registration.Status, registration.LoanID, string(payload))
	}

	// Update loan with the REAL NCR registration reference
	if req.LoanID != "" {
		_ = s.ensureAgriculturalLoansTable(r)
		s.db.ExecContext(r.Context(), `
			UPDATE agricultural_loans
			SET ncr_registered = true, ncr_registration_no = $1
			WHERE id = $2
		`, registration.NCRReferenceNo, req.LoanID)
	}

	writeJSONExt(w, 201, registration)
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

	if s.ncr.baseURL == "" {
		upstreamUnavailable(w, "ncr", fmt.Errorf("NCR_BASE_URL not configured — collateral NOT discharged"))
		return
	}

	resp, err := callUpstream(s.ncr.httpClient, "POST", s.ncr.baseURL+"/v1/ncr/discharges", s.ncr.apiKey, req)
	if err != nil {
		upstreamUnavailable(w, "ncr", err)
		return
	}

	if err := s.ensureIntegrationTables(); err == nil {
		s.db.Exec(`UPDATE ncr_registrations SET status = 'DISCHARGED' WHERE ncr_reference_no = $1`, req.NCRReferenceNo)
	}
	resp["ncr_reference_no"] = req.NCRReferenceNo
	writeJSONExt(w, 200, resp)
}

func (s *ExternalIntegrationsService) ListCollateralRegistrations(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	if err := s.ensureIntegrationTables(); err != nil {
		upstreamUnavailable(w, "ncr", err)
		return
	}
	rows, err := s.db.QueryContext(r.Context(),
		`SELECT payload FROM ncr_registrations ORDER BY created_at DESC LIMIT 200`)
	if err != nil {
		upstreamUnavailable(w, "ncr", err)
		return
	}
	defer rows.Close()
	registrations := []json.RawMessage{}
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err == nil {
			registrations = append(registrations, json.RawMessage(p))
		}
	}
	writeJSONExt(w, 200, map[string]interface{}{
		"tenant_id": tenantID, "registrations": registrations,
		"total": len(registrations), "source": "postgres",
	})
}

// NAIC Handlers — policies/claims are persisted locally; ACTIVE/SUBMITTED
// status requires a real NAIC acknowledgement.
func (s *ExternalIntegrationsService) ListNAICPolicies(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	farmerID := r.URL.Query().Get("farmer_id")
	if err := s.ensureIntegrationTables(); err != nil {
		upstreamUnavailable(w, "naic", err)
		return
	}
	rows, err := s.db.QueryContext(r.Context(),
		`SELECT payload FROM naic_policies WHERE ($1 = '' OR farmer_id = $1) ORDER BY created_at DESC LIMIT 200`, farmerID)
	if err != nil {
		upstreamUnavailable(w, "naic", err)
		return
	}
	defer rows.Close()
	policies := []json.RawMessage{}
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err == nil {
			policies = append(policies, json.RawMessage(p))
		}
	}
	writeJSONExt(w, 200, map[string]interface{}{
		"tenant_id": tenantID, "farmer_id": farmerID, "policies": policies,
		"total": len(policies), "source": "postgres",
	})
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

	// Premium estimate (local deterministic pricing model — not external data).
	premium := req.SumInsured * 0.05
	govSubsidy := premium * 0.50
	farmerContrib := premium - govSubsidy

	policy := NAICPolicy{
		PolicyID:           fmt.Sprintf("POL-%d", time.Now().UnixNano()),
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
		Status:             "RECORDED", // becomes SUBMITTED/ACTIVE only via real NAIC call
		LinkedLoanID:       req.LinkedLoanID,
		CreatedAt:          time.Now(),
	}

	// Forward to NAIC when configured; adopt NAIC-issued policy number/status.
	naicErr := error(nil)
	if s.naic.baseURL != "" {
		resp, err := callUpstream(s.naic.httpClient, "POST", s.naic.baseURL+"/v1/naic/policies", s.naic.apiKey, req)
		if err != nil {
			naicErr = err
		} else {
			if no, ok := resp["naic_policy_no"].(string); ok && no != "" {
				policy.NAICPolicyNo = no
			}
			if st, ok := resp["status"].(string); ok && st != "" {
				policy.Status = st
			} else {
				policy.Status = "SUBMITTED"
			}
		}
	}

	if err := s.ensureIntegrationTables(); err != nil {
		upstreamUnavailable(w, "naic", fmt.Errorf("policy store unavailable: %w", err))
		return
	}
	payload, _ := json.Marshal(policy)
	if _, err := s.db.Exec(`INSERT INTO naic_policies
		(policy_id, naic_policy_no, policy_type, farmer_id, sum_insured, premium, status, linked_loan_id, payload)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		policy.PolicyID, policy.NAICPolicyNo, policy.PolicyType, req.FarmerID,
		policy.SumInsured, policy.Premium, policy.Status, policy.LinkedLoanID, string(payload)); err != nil {
		upstreamUnavailable(w, "naic", fmt.Errorf("policy persist failed: %w", err))
		return
	}

	if req.LinkedLoanID != "" {
		_ = s.ensureAgriculturalLoansTable(r)
		s.db.ExecContext(r.Context(), `
			UPDATE agricultural_loans
			SET insurance_policy_id = $1
			WHERE id = $2
		`, policy.PolicyID, req.LinkedLoanID)
	}

	if naicErr != nil {
		// Recorded locally but NOT submitted to NAIC — say so.
		writeJSONExt(w, http.StatusServiceUnavailable, map[string]interface{}{
			"policy": policy, "naic_status": "not_submitted", "error": naicErr.Error(),
		})
		return
	}
	writeJSONExt(w, 201, policy)
}

func (s *ExternalIntegrationsService) GetNAICPolicy(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	policyID := vars["policy_id"]

	if err := s.ensureIntegrationTables(); err != nil {
		upstreamUnavailable(w, "naic", err)
		return
	}
	var payload string
	err := s.db.QueryRowContext(r.Context(),
		`SELECT payload FROM naic_policies WHERE policy_id = $1`, policyID).Scan(&payload)
	if err == sql.ErrNoRows {
		http.Error(w, "policy not found", http.StatusNotFound)
		return
	}
	if err != nil {
		upstreamUnavailable(w, "naic", err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(payload))
}

func (s *ExternalIntegrationsService) ListNAICClaims(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	if err := s.ensureIntegrationTables(); err != nil {
		upstreamUnavailable(w, "naic", err)
		return
	}
	rows, err := s.db.QueryContext(r.Context(),
		`SELECT payload FROM naic_claims ORDER BY created_at DESC LIMIT 200`)
	if err != nil {
		upstreamUnavailable(w, "naic", err)
		return
	}
	defer rows.Close()
	claims := []json.RawMessage{}
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err == nil {
			claims = append(claims, json.RawMessage(p))
		}
	}
	writeJSONExt(w, 200, map[string]interface{}{
		"tenant_id": tenantID, "claims": claims, "total": len(claims), "source": "postgres",
	})
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

	// Verify the policy exists locally before accepting a claim against it.
	if err := s.ensureIntegrationTables(); err != nil {
		upstreamUnavailable(w, "naic", err)
		return
	}
	var cnt int
	if err := s.db.QueryRowContext(r.Context(),
		`SELECT COUNT(*) FROM naic_policies WHERE policy_id = $1`, req.PolicyID).Scan(&cnt); err != nil || cnt == 0 {
		http.Error(w, "policy not found", http.StatusNotFound)
		return
	}

	claim := NAICClaim{
		ClaimID:      fmt.Sprintf("CLM-%d", time.Now().UnixNano()),
		PolicyID:     req.PolicyID,
		ClaimType:    req.ClaimType,
		ClaimDate:    time.Now(),
		IncidentDate: req.IncidentDate,
		IncidentDesc: req.IncidentDesc,
		ClaimAmount:  req.ClaimAmount,
		Status:       "RECORDED", // becomes SUBMITTED only via real NAIC call
	}

	naicErr := error(nil)
	if s.naic.baseURL != "" {
		resp, err := callUpstream(s.naic.httpClient, "POST", s.naic.baseURL+"/v1/naic/claims", s.naic.apiKey, req)
		if err != nil {
			naicErr = err
		} else {
			if no, ok := resp["naic_claim_no"].(string); ok && no != "" {
				claim.NAICClaimNo = no
			}
			if st, ok := resp["status"].(string); ok && st != "" {
				claim.Status = st
			} else {
				claim.Status = "SUBMITTED"
			}
		}
	}

	payload, _ := json.Marshal(claim)
	if _, err := s.db.Exec(`INSERT INTO naic_claims
		(claim_id, policy_id, claim_type, claim_amount, status, payload)
		VALUES ($1,$2,$3,$4,$5,$6)`,
		claim.ClaimID, claim.PolicyID, claim.ClaimType, claim.ClaimAmount, claim.Status, string(payload)); err != nil {
		upstreamUnavailable(w, "naic", fmt.Errorf("claim persist failed: %w", err))
		return
	}

	if naicErr != nil {
		writeJSONExt(w, http.StatusServiceUnavailable, map[string]interface{}{
			"claim": claim, "naic_status": "not_submitted", "error": naicErr.Error(),
		})
		return
	}
	writeJSONExt(w, 201, claim)
}

func (s *ExternalIntegrationsService) GetNAICClaim(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	claimID := vars["claim_id"]

	if err := s.ensureIntegrationTables(); err != nil {
		upstreamUnavailable(w, "naic", err)
		return
	}
	var payload string
	err := s.db.QueryRowContext(r.Context(),
		`SELECT payload FROM naic_claims WHERE claim_id = $1`, claimID).Scan(&payload)
	if err == sql.ErrNoRows {
		http.Error(w, "claim not found", http.StatusNotFound)
		return
	}
	if err != nil {
		upstreamUnavailable(w, "naic", err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(payload))
}

// CalculateNAICPremium is a deterministic local pricing model (no external
// data fabrication): rates are explicit model parameters returned verbatim.
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

	baseRate := 0.05 // 5% base rate (model parameter)

	cropRiskMultiplier := map[string]float64{
		"rice": 1.0, "maize": 0.9, "cassava": 0.8, "tomato": 1.3, "pepper": 1.2,
	}
	multiplier := cropRiskMultiplier[req.CropType]
	if multiplier == 0 {
		multiplier = 1.0
	}

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

	writeJSONExt(w, 200, map[string]interface{}{
		"sum_insured":         req.SumInsured,
		"base_rate":           baseRate * 100,
		"crop_risk_factor":    multiplier,
		"state_risk_factor":   stateMultiplier,
		"total_premium":       premium,
		"government_subsidy":  govSubsidy,
		"farmer_contribution": farmerContrib,
		"model":               "local_deterministic_v1",
	})
}

// Commodity Exchange Handlers — prices come from the real exchanges only.
func (s *ExternalIntegrationsService) exchangeConfig(exchange string) (string, string, error) {
	switch exchange {
	case "AFEX", "":
		return os.Getenv("AFEX_BASE_URL"), s.commodityExchange.afexAPIKey, nil
	case "LCFE":
		return os.Getenv("LCFE_BASE_URL"), s.commodityExchange.lcfeAPIKey, nil
	}
	return "", "", fmt.Errorf("unknown exchange %q (expected AFEX or LCFE)", exchange)
}

func (s *ExternalIntegrationsService) GetCommodityPrices(w http.ResponseWriter, r *http.Request) {
	exchange := r.URL.Query().Get("exchange") // AFEX, LCFE

	baseURL, apiKey, err := s.exchangeConfig(exchange)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if baseURL == "" {
		upstreamUnavailable(w, "commodity_exchange", fmt.Errorf("AFEX_BASE_URL / LCFE_BASE_URL not configured"))
		return
	}
	resp, err := callUpstream(s.commodityExchange.httpClient, "GET", baseURL+"/v1/prices", apiKey, nil)
	if err != nil {
		upstreamUnavailable(w, "commodity_exchange", err)
		return
	}
	writeJSONExt(w, 200, resp)
}

func (s *ExternalIntegrationsService) GetCommodityPrice(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	commodity := vars["commodity"]
	exchange := r.URL.Query().Get("exchange")

	baseURL, apiKey, err := s.exchangeConfig(exchange)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if baseURL == "" {
		upstreamUnavailable(w, "commodity_exchange", fmt.Errorf("exchange base URL not configured"))
		return
	}
	resp, err := callUpstream(s.commodityExchange.httpClient, "GET", baseURL+"/v1/prices/"+commodity, apiKey, nil)
	if err != nil {
		upstreamUnavailable(w, "commodity_exchange", err)
		return
	}
	writeJSONExt(w, 200, resp)
}

func (s *ExternalIntegrationsService) ListDeliveryContracts(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	if err := s.ensureIntegrationTables(); err != nil {
		upstreamUnavailable(w, "commodity_exchange", err)
		return
	}
	rows, err := s.db.QueryContext(r.Context(),
		`SELECT payload FROM commodity_contracts ORDER BY created_at DESC LIMIT 200`)
	if err != nil {
		upstreamUnavailable(w, "commodity_exchange", err)
		return
	}
	defer rows.Close()
	contracts := []json.RawMessage{}
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err == nil {
			contracts = append(contracts, json.RawMessage(p))
		}
	}
	writeJSONExt(w, 200, map[string]interface{}{
		"tenant_id": tenantID, "contracts": contracts, "total": len(contracts), "source": "postgres",
	})
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
		ExchangeCode     string    `json:"exchange_code"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if err := s.ensureIntegrationTables(); err != nil {
		upstreamUnavailable(w, "commodity_exchange", err)
		return
	}

	exchangeCode := req.ExchangeCode
	if exchangeCode == "" {
		exchangeCode = "AFEX"
	}
	contract := DeliveryContract{
		ContractID:       fmt.Sprintf("DC-%d", time.Now().UnixNano()),
		ExchangeCode:     exchangeCode,
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
	payload, _ := json.Marshal(contract)
	if _, err := s.db.Exec(`INSERT INTO commodity_contracts
		(contract_id, exchange_code, seller_id, buyer_id, commodity_code, quantity, contract_price, status, linked_loan_id, payload)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		contract.ContractID, contract.ExchangeCode, contract.SellerID, contract.BuyerID,
		contract.CommodityCode, contract.Quantity, contract.ContractPrice, contract.Status,
		contract.LinkedLoanID, string(payload)); err != nil {
		upstreamUnavailable(w, "commodity_exchange", fmt.Errorf("contract persist failed: %w", err))
		return
	}
	writeJSONExt(w, 201, contract)
}

func (s *ExternalIntegrationsService) GetDeliveryContract(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	contractID := vars["contract_id"]

	if err := s.ensureIntegrationTables(); err != nil {
		upstreamUnavailable(w, "commodity_exchange", err)
		return
	}
	var payload string
	err := s.db.QueryRowContext(r.Context(),
		`SELECT payload FROM commodity_contracts WHERE contract_id = $1`, contractID).Scan(&payload)
	if err == sql.ErrNoRows {
		http.Error(w, "contract not found", http.StatusNotFound)
		return
	}
	if err != nil {
		upstreamUnavailable(w, "commodity_exchange", err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(payload))
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

	if err := s.ensureIntegrationTables(); err != nil {
		upstreamUnavailable(w, "commodity_exchange", err)
		return
	}

	// Only a real persisted contract can be confirmed.
	res, err := s.db.ExecContext(r.Context(),
		`UPDATE commodity_contracts SET status = 'DELIVERED' WHERE contract_id = $1 AND status IN ('PENDING','CONFIRMED')`,
		contractID)
	if err != nil {
		upstreamUnavailable(w, "commodity_exchange", err)
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		http.Error(w, "contract not found or already delivered", http.StatusNotFound)
		return
	}

	writeJSONExt(w, 200, map[string]interface{}{
		"contract_id":        contractID,
		"status":             "DELIVERED",
		"delivered_quantity": req.DeliveredQuantity,
		"quality_grade":      req.QualityGrade,
		"warehouse_receipt":  req.WarehouseReceipt,
		"confirmed_at":       time.Now(),
	})
}
