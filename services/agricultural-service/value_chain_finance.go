package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gorilla/mux"
)

// ==================== VALUE CHAIN FINANCING ====================
// Equipment finance, processor/aggregator finance, export finance

// Equipment Finance
type EquipmentLoan struct {
	ID                string     `json:"id"`
	TenantID          string     `json:"tenant_id"`
	FarmerID          string     `json:"farmer_id"`
	CooperativeID     string     `json:"cooperative_id"`
	EquipmentType     string     `json:"equipment_type"` // TRACTOR, HARVESTER, IRRIGATION, PROCESSING, STORAGE
	EquipmentBrand    string     `json:"equipment_brand"`
	EquipmentModel    string     `json:"equipment_model"`
	EquipmentValue    float64    `json:"equipment_value"`
	DownPayment       float64    `json:"down_payment"`
	LoanAmount        float64    `json:"loan_amount"`
	DisbursedAmount   float64    `json:"disbursed_amount"`
	OutstandingAmount float64    `json:"outstanding_amount"`
	InterestRate      float64    `json:"interest_rate"`
	TenorMonths       int        `json:"tenor_months"`
	MonthlyPayment    float64    `json:"monthly_payment"`
	ResidualValue     float64    `json:"residual_value"`    // End of term value
	DepreciationRate  float64    `json:"depreciation_rate"` // Annual depreciation
	InsuranceRequired bool       `json:"insurance_required"`
	InsurancePolicyID string     `json:"insurance_policy_id"`
	VendorID          string     `json:"vendor_id"`
	VendorName        string     `json:"vendor_name"`
	DeliveryDate      *time.Time `json:"delivery_date"`
	WarrantyExpiry    *time.Time `json:"warranty_expiry"`
	SerialNumber      string     `json:"serial_number"`
	NCRRegistered     bool       `json:"ncr_registered"`
	NCRReferenceNo    string     `json:"ncr_reference_no"`
	Status            string     `json:"status"` // PENDING, APPROVED, DISBURSED, ACTIVE, COMPLETED, DEFAULT
	CreatedAt         time.Time  `json:"created_at"`
	DisbursedAt       *time.Time `json:"disbursed_at"`
}

// Equipment Types and Specifications
type EquipmentSpec struct {
	EquipmentType    string   `json:"equipment_type"`
	Description      string   `json:"description"`
	MinValue         float64  `json:"min_value"`
	MaxValue         float64  `json:"max_value"`
	MaxTenorMonths   int      `json:"max_tenor_months"`
	MinDownPayment   float64  `json:"min_down_payment"`  // percentage
	DepreciationRate float64  `json:"depreciation_rate"` // annual percentage
	InsuranceRate    float64  `json:"insurance_rate"`    // annual percentage
	EligibleCrops    []string `json:"eligible_crops"`
}

var EquipmentSpecs = map[string]EquipmentSpec{
	"TRACTOR": {
		EquipmentType: "TRACTOR", Description: "Agricultural Tractor",
		MinValue: 5000000, MaxValue: 50000000, MaxTenorMonths: 60,
		MinDownPayment: 20.0, DepreciationRate: 15.0, InsuranceRate: 3.0,
		EligibleCrops: []string{"all"},
	},
	"HARVESTER": {
		EquipmentType: "HARVESTER", Description: "Combine Harvester",
		MinValue: 10000000, MaxValue: 100000000, MaxTenorMonths: 72,
		MinDownPayment: 25.0, DepreciationRate: 12.0, InsuranceRate: 3.5,
		EligibleCrops: []string{"rice", "maize", "wheat", "sorghum"},
	},
	"IRRIGATION": {
		EquipmentType: "IRRIGATION", Description: "Irrigation System",
		MinValue: 500000, MaxValue: 20000000, MaxTenorMonths: 48,
		MinDownPayment: 15.0, DepreciationRate: 10.0, InsuranceRate: 2.0,
		EligibleCrops: []string{"all"},
	},
	"PROCESSING": {
		EquipmentType: "PROCESSING", Description: "Processing Equipment (Mill, Dryer, etc.)",
		MinValue: 1000000, MaxValue: 50000000, MaxTenorMonths: 60,
		MinDownPayment: 20.0, DepreciationRate: 12.0, InsuranceRate: 2.5,
		EligibleCrops: []string{"rice", "maize", "cassava", "palm_oil"},
	},
	"STORAGE": {
		EquipmentType: "STORAGE", Description: "Storage Facility/Silo",
		MinValue: 2000000, MaxValue: 100000000, MaxTenorMonths: 84,
		MinDownPayment: 20.0, DepreciationRate: 5.0, InsuranceRate: 1.5,
		EligibleCrops: []string{"all"},
	},
	"SPRAYER": {
		EquipmentType: "SPRAYER", Description: "Crop Sprayer/Boom Sprayer",
		MinValue: 200000, MaxValue: 5000000, MaxTenorMonths: 36,
		MinDownPayment: 15.0, DepreciationRate: 20.0, InsuranceRate: 2.0,
		EligibleCrops: []string{"all"},
	},
	"PLANTER": {
		EquipmentType: "PLANTER", Description: "Seed Planter/Seeder",
		MinValue: 500000, MaxValue: 10000000, MaxTenorMonths: 48,
		MinDownPayment: 15.0, DepreciationRate: 15.0, InsuranceRate: 2.0,
		EligibleCrops: []string{"rice", "maize", "sorghum", "groundnut"},
	},
}

// Equipment Vendor
type EquipmentVendor struct {
	ID                string    `json:"id"`
	TenantID          string    `json:"tenant_id"`
	VendorName        string    `json:"vendor_name"`
	ContactPerson     string    `json:"contact_person"`
	Phone             string    `json:"phone"`
	Email             string    `json:"email"`
	Address           string    `json:"address"`
	State             string    `json:"state"`
	EquipmentTypes    []string  `json:"equipment_types"`
	Brands            []string  `json:"brands"`
	CreditLimit       float64   `json:"credit_limit"`
	OutstandingCredit float64   `json:"outstanding_credit"`
	WarrantyTerms     string    `json:"warranty_terms"`
	Status            string    `json:"status"`
	CreatedAt         time.Time `json:"created_at"`
}

// Processor/Aggregator Finance
type ProcessorLoan struct {
	ID                 string     `json:"id"`
	TenantID           string     `json:"tenant_id"`
	ProcessorID        string     `json:"processor_id"`
	ProcessorName      string     `json:"processor_name"`
	ProcessorType      string     `json:"processor_type"` // MILLER, AGGREGATOR, PROCESSOR, EXPORTER
	FacilityType       string     `json:"facility_type"`  // WORKING_CAPITAL, INVOICE_DISCOUNTING, RECEIVABLES
	LoanAmount         float64    `json:"loan_amount"`
	DisbursedAmount    float64    `json:"disbursed_amount"`
	OutstandingAmount  float64    `json:"outstanding_amount"`
	InterestRate       float64    `json:"interest_rate"`
	TenorDays          int        `json:"tenor_days"`
	Purpose            string     `json:"purpose"`
	LinkedFarmers      []string   `json:"linked_farmers"`      // Farmer IDs supplying to processor
	LinkedContracts    []string   `json:"linked_contracts"`    // Off-taker contract IDs
	Throughput         float64    `json:"throughput"`          // Monthly processing capacity (MT)
	HistoricThroughput float64    `json:"historic_throughput"` // Average monthly throughput
	CollateralType     string     `json:"collateral_type"`
	CollateralValue    float64    `json:"collateral_value"`
	Status             string     `json:"status"`
	CreatedAt          time.Time  `json:"created_at"`
	DisbursedAt        *time.Time `json:"disbursed_at"`
	MaturityDate       *time.Time `json:"maturity_date"`
}

// Processor/Aggregator Profile
type Processor struct {
	ID                 string    `json:"id"`
	TenantID           string    `json:"tenant_id"`
	ProcessorName      string    `json:"processor_name"`
	ProcessorType      string    `json:"processor_type"`
	RegistrationNo     string    `json:"registration_no"`
	TaxID              string    `json:"tax_id"`
	ContactPerson      string    `json:"contact_person"`
	Phone              string    `json:"phone"`
	Email              string    `json:"email"`
	Address            string    `json:"address"`
	State              string    `json:"state"`
	LGA                string    `json:"lga"`
	ProcessingCapacity float64   `json:"processing_capacity"` // MT per month
	StorageCapacity    float64   `json:"storage_capacity"`    // MT
	CommoditiesHandled []string  `json:"commodities_handled"`
	LinkedFarmers      int       `json:"linked_farmers"`
	LinkedCooperatives int       `json:"linked_cooperatives"`
	CreditLimit        float64   `json:"credit_limit"`
	OutstandingCredit  float64   `json:"outstanding_credit"`
	RepaymentHistory   float64   `json:"repayment_history"` // percentage on-time
	BankAccountNo      string    `json:"bank_account_no"`
	BankName           string    `json:"bank_name"`
	Status             string    `json:"status"`
	CreatedAt          time.Time `json:"created_at"`
}

// Invoice/Receivables Discounting
type InvoiceDiscount struct {
	ID             string     `json:"id"`
	TenantID       string     `json:"tenant_id"`
	ProcessorID    string     `json:"processor_id"`
	InvoiceNo      string     `json:"invoice_no"`
	BuyerName      string     `json:"buyer_name"`
	BuyerID        string     `json:"buyer_id"`
	InvoiceAmount  float64    `json:"invoice_amount"`
	DiscountRate   float64    `json:"discount_rate"`
	DiscountAmount float64    `json:"discount_amount"`
	NetAdvance     float64    `json:"net_advance"`
	InvoiceDate    time.Time  `json:"invoice_date"`
	DueDate        time.Time  `json:"due_date"`
	CommodityType  string     `json:"commodity_type"`
	Quantity       float64    `json:"quantity"`
	Unit           string     `json:"unit"`
	DeliveryProof  string     `json:"delivery_proof"`
	Status         string     `json:"status"` // SUBMITTED, VERIFIED, DISCOUNTED, SETTLED
	SettlementDate *time.Time `json:"settlement_date"`
	CreatedAt      time.Time  `json:"created_at"`
}

// Export Finance
type ExportLoan struct {
	ID                 string     `json:"id"`
	TenantID           string     `json:"tenant_id"`
	ExporterID         string     `json:"exporter_id"`
	ExporterName       string     `json:"exporter_name"`
	FacilityType       string     `json:"facility_type"` // PRE_SHIPMENT, POST_SHIPMENT, LC_BACKED
	LoanAmount         float64    `json:"loan_amount"`
	Currency           string     `json:"currency"` // NGN, USD
	DisbursedAmount    float64    `json:"disbursed_amount"`
	OutstandingAmount  float64    `json:"outstanding_amount"`
	InterestRate       float64    `json:"interest_rate"`
	TenorDays          int        `json:"tenor_days"`
	CommodityType      string     `json:"commodity_type"`
	Quantity           float64    `json:"quantity"`
	Unit               string     `json:"unit"`
	ExportDestination  string     `json:"export_destination"`
	BuyerName          string     `json:"buyer_name"`
	BuyerCountry       string     `json:"buyer_country"`
	ContractValue      float64    `json:"contract_value"`
	ContractCurrency   string     `json:"contract_currency"`
	LCNumber           string     `json:"lc_number"`
	LCIssuingBank      string     `json:"lc_issuing_bank"`
	LCAmount           float64    `json:"lc_amount"`
	ShippingDate       *time.Time `json:"shipping_date"`
	BillOfLading       string     `json:"bill_of_lading"`
	CustomsDeclaration string     `json:"customs_declaration"`
	NEXIMInsured       bool       `json:"nexim_insured"`
	NEXIMPolicyNo      string     `json:"nexim_policy_no"`
	Status             string     `json:"status"`
	CreatedAt          time.Time  `json:"created_at"`
	DisbursedAt        *time.Time `json:"disbursed_at"`
}

// Exporter Profile
type Exporter struct {
	ID                 string    `json:"id"`
	TenantID           string    `json:"tenant_id"`
	ExporterName       string    `json:"exporter_name"`
	RegistrationNo     string    `json:"registration_no"`
	NEPCRegistration   string    `json:"nepc_registration"` // Nigerian Export Promotion Council
	TaxID              string    `json:"tax_id"`
	ContactPerson      string    `json:"contact_person"`
	Phone              string    `json:"phone"`
	Email              string    `json:"email"`
	Address            string    `json:"address"`
	State              string    `json:"state"`
	ExportCommodities  []string  `json:"export_commodities"`
	ExportDestinations []string  `json:"export_destinations"`
	AnnualExportVolume float64   `json:"annual_export_volume"` // MT
	AnnualExportValue  float64   `json:"annual_export_value"`  // USD
	CreditLimit        float64   `json:"credit_limit"`
	OutstandingCredit  float64   `json:"outstanding_credit"`
	BankAccountNo      string    `json:"bank_account_no"`
	BankName           string    `json:"bank_name"`
	DomiciliaryAccount string    `json:"domiciliary_account"`
	Status             string    `json:"status"`
	CreatedAt          time.Time `json:"created_at"`
}

// Value Chain Finance Service
type ValueChainFinanceService struct {
	db *sql.DB
}

func NewValueChainFinanceService(db *sql.DB) *ValueChainFinanceService {
	return &ValueChainFinanceService{db: db}
}

// Register value chain finance routes
func (s *ValueChainFinanceService) RegisterRoutes(r *mux.Router) {
	// Equipment Finance
	r.HandleFunc("/api/v1/value-chain/equipment/specs", s.ListEquipmentSpecs).Methods("GET")
	r.HandleFunc("/api/v1/value-chain/equipment/vendors", s.ListEquipmentVendors).Methods("GET")
	r.HandleFunc("/api/v1/value-chain/equipment/vendors", s.RegisterEquipmentVendor).Methods("POST")
	r.HandleFunc("/api/v1/value-chain/equipment/loans", s.ListEquipmentLoans).Methods("GET")
	r.HandleFunc("/api/v1/value-chain/equipment/loans", s.ApplyEquipmentLoan).Methods("POST")
	r.HandleFunc("/api/v1/value-chain/equipment/loans/{loan_id}", s.GetEquipmentLoan).Methods("GET")
	r.HandleFunc("/api/v1/value-chain/equipment/loans/{loan_id}/approve", s.ApproveEquipmentLoan).Methods("POST")
	r.HandleFunc("/api/v1/value-chain/equipment/loans/{loan_id}/disburse", s.DisburseEquipmentLoan).Methods("POST")
	r.HandleFunc("/api/v1/value-chain/equipment/calculator", s.CalculateEquipmentLoan).Methods("POST")

	// Processor/Aggregator Finance
	r.HandleFunc("/api/v1/value-chain/processors", s.ListProcessors).Methods("GET")
	r.HandleFunc("/api/v1/value-chain/processors", s.RegisterProcessor).Methods("POST")
	r.HandleFunc("/api/v1/value-chain/processors/{processor_id}", s.GetProcessor).Methods("GET")
	r.HandleFunc("/api/v1/value-chain/processors/{processor_id}/loans", s.ListProcessorLoans).Methods("GET")
	r.HandleFunc("/api/v1/value-chain/processors/{processor_id}/loans", s.ApplyProcessorLoan).Methods("POST")
	r.HandleFunc("/api/v1/value-chain/processor-loans/{loan_id}", s.GetProcessorLoan).Methods("GET")
	r.HandleFunc("/api/v1/value-chain/processor-loans/{loan_id}/approve", s.ApproveProcessorLoan).Methods("POST")
	r.HandleFunc("/api/v1/value-chain/processor-loans/{loan_id}/disburse", s.DisburseProcessorLoan).Methods("POST")

	// Invoice Discounting
	r.HandleFunc("/api/v1/value-chain/invoices", s.ListInvoices).Methods("GET")
	r.HandleFunc("/api/v1/value-chain/invoices", s.SubmitInvoice).Methods("POST")
	r.HandleFunc("/api/v1/value-chain/invoices/{invoice_id}", s.GetInvoice).Methods("GET")
	r.HandleFunc("/api/v1/value-chain/invoices/{invoice_id}/verify", s.VerifyInvoice).Methods("POST")
	r.HandleFunc("/api/v1/value-chain/invoices/{invoice_id}/discount", s.DiscountInvoice).Methods("POST")
	r.HandleFunc("/api/v1/value-chain/invoices/{invoice_id}/settle", s.SettleInvoice).Methods("POST")

	// Export Finance
	r.HandleFunc("/api/v1/value-chain/exporters", s.ListExporters).Methods("GET")
	r.HandleFunc("/api/v1/value-chain/exporters", s.RegisterExporter).Methods("POST")
	r.HandleFunc("/api/v1/value-chain/exporters/{exporter_id}", s.GetExporter).Methods("GET")
	r.HandleFunc("/api/v1/value-chain/export-loans", s.ListExportLoans).Methods("GET")
	r.HandleFunc("/api/v1/value-chain/export-loans", s.ApplyExportLoan).Methods("POST")
	r.HandleFunc("/api/v1/value-chain/export-loans/{loan_id}", s.GetExportLoan).Methods("GET")
	r.HandleFunc("/api/v1/value-chain/export-loans/{loan_id}/approve", s.ApproveExportLoan).Methods("POST")
	r.HandleFunc("/api/v1/value-chain/export-loans/{loan_id}/disburse", s.DisburseExportLoan).Methods("POST")
	r.HandleFunc("/api/v1/value-chain/export-loans/{loan_id}/shipping", s.UpdateShippingDetails).Methods("POST")

	// Portfolio Analytics
	r.HandleFunc("/api/v1/value-chain/portfolio", s.GetValueChainPortfolio).Methods("GET")
}

// Equipment Finance Handlers
func (s *ValueChainFinanceService) ListEquipmentSpecs(w http.ResponseWriter, r *http.Request) {
	specs := make([]EquipmentSpec, 0, len(EquipmentSpecs))
	for _, spec := range EquipmentSpecs {
		specs = append(specs, spec)
	}
	json.NewEncoder(w).Encode(specs)
}

func (s *ValueChainFinanceService) ListEquipmentVendors(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")

	vendors := []EquipmentVendor{
		{
			ID:             "VENDOR-001",
			TenantID:       tenantID,
			VendorName:     "Tractor Supply Nigeria",
			ContactPerson:  "John Doe",
			Phone:          "+2348012345678",
			Email:          "sales@tractorsupply.ng",
			Address:        "123 Industrial Estate, Lagos",
			State:          "Lagos",
			EquipmentTypes: []string{"TRACTOR", "HARVESTER", "PLANTER"},
			Brands:         []string{"John Deere", "Massey Ferguson", "New Holland"},
			CreditLimit:    100000000,
			Status:         "ACTIVE",
		},
	}
	json.NewEncoder(w).Encode(vendors)
}

func (s *ValueChainFinanceService) RegisterEquipmentVendor(w http.ResponseWriter, r *http.Request) {
	var req EquipmentVendor
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	req.ID = fmt.Sprintf("VENDOR-%d", time.Now().Unix())
	req.Status = "ACTIVE"
	req.CreatedAt = time.Now()

	json.NewEncoder(w).Encode(req)
}

func (s *ValueChainFinanceService) ListEquipmentLoans(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")

	loans := []EquipmentLoan{
		{
			ID:                "EQLOAN-001",
			TenantID:          tenantID,
			FarmerID:          "FARMER-001",
			EquipmentType:     "TRACTOR",
			EquipmentBrand:    "Massey Ferguson",
			EquipmentModel:    "MF 375",
			EquipmentValue:    15000000,
			DownPayment:       3000000,
			LoanAmount:        12000000,
			OutstandingAmount: 10000000,
			InterestRate:      18.0,
			TenorMonths:       48,
			MonthlyPayment:    350000,
			Status:            "ACTIVE",
		},
	}
	json.NewEncoder(w).Encode(loans)
}

func (s *ValueChainFinanceService) ApplyEquipmentLoan(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TenantID       string  `json:"tenant_id"`
		FarmerID       string  `json:"farmer_id"`
		CooperativeID  string  `json:"cooperative_id"`
		EquipmentType  string  `json:"equipment_type"`
		EquipmentBrand string  `json:"equipment_brand"`
		EquipmentModel string  `json:"equipment_model"`
		EquipmentValue float64 `json:"equipment_value"`
		DownPayment    float64 `json:"down_payment"`
		TenorMonths    int     `json:"tenor_months"`
		VendorID       string  `json:"vendor_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Validate equipment type
	spec, ok := EquipmentSpecs[req.EquipmentType]
	if !ok {
		http.Error(w, "Invalid equipment type", http.StatusBadRequest)
		return
	}

	// Validate down payment
	minDownPayment := req.EquipmentValue * (spec.MinDownPayment / 100)
	if req.DownPayment < minDownPayment {
		http.Error(w, fmt.Sprintf("Minimum down payment is %.0f%%", spec.MinDownPayment), http.StatusBadRequest)
		return
	}

	loanAmount := req.EquipmentValue - req.DownPayment
	interestRate := 18.0 // Base rate
	monthlyRate := interestRate / 12 / 100
	monthlyPayment := loanAmount * (monthlyRate * pow(1+monthlyRate, float64(req.TenorMonths))) / (pow(1+monthlyRate, float64(req.TenorMonths)) - 1)

	loan := EquipmentLoan{
		ID:                fmt.Sprintf("EQLOAN-%d", time.Now().Unix()),
		TenantID:          req.TenantID,
		FarmerID:          req.FarmerID,
		CooperativeID:     req.CooperativeID,
		EquipmentType:     req.EquipmentType,
		EquipmentBrand:    req.EquipmentBrand,
		EquipmentModel:    req.EquipmentModel,
		EquipmentValue:    req.EquipmentValue,
		DownPayment:       req.DownPayment,
		LoanAmount:        loanAmount,
		OutstandingAmount: loanAmount,
		InterestRate:      interestRate,
		TenorMonths:       req.TenorMonths,
		MonthlyPayment:    monthlyPayment,
		DepreciationRate:  spec.DepreciationRate,
		InsuranceRequired: true,
		VendorID:          req.VendorID,
		Status:            "PENDING",
		CreatedAt:         time.Now(),
	}
	json.NewEncoder(w).Encode(loan)
}

func pow(base, exp float64) float64 {
	result := 1.0
	for i := 0; i < int(exp); i++ {
		result *= base
	}
	return result
}

func (s *ValueChainFinanceService) GetEquipmentLoan(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	loanID := vars["loan_id"]

	loan := EquipmentLoan{
		ID:             loanID,
		EquipmentType:  "TRACTOR",
		EquipmentBrand: "Massey Ferguson",
		LoanAmount:     12000000,
		Status:         "ACTIVE",
	}
	json.NewEncoder(w).Encode(loan)
}

func (s *ValueChainFinanceService) ApproveEquipmentLoan(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	loanID := vars["loan_id"]

	json.NewEncoder(w).Encode(map[string]string{
		"loan_id": loanID,
		"status":  "APPROVED",
	})
}

func (s *ValueChainFinanceService) DisburseEquipmentLoan(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	loanID := vars["loan_id"]

	var req struct {
		SerialNumber   string `json:"serial_number"`
		DeliveryDate   string `json:"delivery_date"`
		WarrantyExpiry string `json:"warranty_expiry"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	now := time.Now()
	json.NewEncoder(w).Encode(map[string]interface{}{
		"loan_id":       loanID,
		"status":        "DISBURSED",
		"serial_number": req.SerialNumber,
		"disbursed_at":  now,
	})
}

func (s *ValueChainFinanceService) CalculateEquipmentLoan(w http.ResponseWriter, r *http.Request) {
	var req struct {
		EquipmentType  string  `json:"equipment_type"`
		EquipmentValue float64 `json:"equipment_value"`
		DownPayment    float64 `json:"down_payment"`
		TenorMonths    int     `json:"tenor_months"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	spec := EquipmentSpecs[req.EquipmentType]
	loanAmount := req.EquipmentValue - req.DownPayment
	interestRate := 18.0
	monthlyRate := interestRate / 12 / 100
	monthlyPayment := loanAmount * (monthlyRate * pow(1+monthlyRate, float64(req.TenorMonths))) / (pow(1+monthlyRate, float64(req.TenorMonths)) - 1)
	totalInterest := (monthlyPayment * float64(req.TenorMonths)) - loanAmount
	insuranceCost := req.EquipmentValue * (spec.InsuranceRate / 100) * (float64(req.TenorMonths) / 12)

	result := map[string]interface{}{
		"equipment_value": req.EquipmentValue,
		"down_payment":    req.DownPayment,
		"loan_amount":     loanAmount,
		"interest_rate":   interestRate,
		"tenor_months":    req.TenorMonths,
		"monthly_payment": monthlyPayment,
		"total_interest":  totalInterest,
		"total_repayment": loanAmount + totalInterest,
		"insurance_cost":  insuranceCost,
		"residual_value":  req.EquipmentValue * pow(1-(spec.DepreciationRate/100), float64(req.TenorMonths)/12),
	}
	json.NewEncoder(w).Encode(result)
}

// Processor Finance Handlers
func (s *ValueChainFinanceService) ListProcessors(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")

	processors := []Processor{
		{
			ID:                 "PROC-001",
			TenantID:           tenantID,
			ProcessorName:      "Kano Rice Mill Ltd",
			ProcessorType:      "MILLER",
			RegistrationNo:     "RC123456",
			ContactPerson:      "Alhaji Musa",
			Phone:              "+2348023456789",
			State:              "Kano",
			ProcessingCapacity: 500,
			StorageCapacity:    2000,
			CommoditiesHandled: []string{"rice"},
			LinkedFarmers:      150,
			CreditLimit:        50000000,
			Status:             "ACTIVE",
		},
	}
	json.NewEncoder(w).Encode(processors)
}

func (s *ValueChainFinanceService) RegisterProcessor(w http.ResponseWriter, r *http.Request) {
	var req Processor
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	req.ID = fmt.Sprintf("PROC-%d", time.Now().Unix())
	req.Status = "ACTIVE"
	req.CreatedAt = time.Now()

	json.NewEncoder(w).Encode(req)
}

func (s *ValueChainFinanceService) GetProcessor(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	processorID := vars["processor_id"]

	processor := Processor{
		ID:            processorID,
		ProcessorName: "Kano Rice Mill Ltd",
		ProcessorType: "MILLER",
		Status:        "ACTIVE",
	}
	json.NewEncoder(w).Encode(processor)
}

func (s *ValueChainFinanceService) ListProcessorLoans(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	processorID := vars["processor_id"]

	loans := []ProcessorLoan{
		{
			ID:                "PROCLOAN-001",
			ProcessorID:       processorID,
			ProcessorName:     "Kano Rice Mill Ltd",
			ProcessorType:     "MILLER",
			FacilityType:      "WORKING_CAPITAL",
			LoanAmount:        20000000,
			OutstandingAmount: 15000000,
			InterestRate:      20.0,
			TenorDays:         180,
			Status:            "ACTIVE",
		},
	}
	json.NewEncoder(w).Encode(loans)
}

func (s *ValueChainFinanceService) ApplyProcessorLoan(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	processorID := vars["processor_id"]

	var req struct {
		TenantID     string  `json:"tenant_id"`
		FacilityType string  `json:"facility_type"`
		LoanAmount   float64 `json:"loan_amount"`
		TenorDays    int     `json:"tenor_days"`
		Purpose      string  `json:"purpose"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	loan := ProcessorLoan{
		ID:                fmt.Sprintf("PROCLOAN-%d", time.Now().Unix()),
		TenantID:          req.TenantID,
		ProcessorID:       processorID,
		FacilityType:      req.FacilityType,
		LoanAmount:        req.LoanAmount,
		OutstandingAmount: req.LoanAmount,
		InterestRate:      20.0,
		TenorDays:         req.TenorDays,
		Purpose:           req.Purpose,
		Status:            "PENDING",
		CreatedAt:         time.Now(),
	}
	json.NewEncoder(w).Encode(loan)
}

func (s *ValueChainFinanceService) GetProcessorLoan(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	loanID := vars["loan_id"]

	loan := ProcessorLoan{
		ID:           loanID,
		FacilityType: "WORKING_CAPITAL",
		LoanAmount:   20000000,
		Status:       "ACTIVE",
	}
	json.NewEncoder(w).Encode(loan)
}

func (s *ValueChainFinanceService) ApproveProcessorLoan(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	loanID := vars["loan_id"]

	json.NewEncoder(w).Encode(map[string]string{"loan_id": loanID, "status": "APPROVED"})
}

func (s *ValueChainFinanceService) DisburseProcessorLoan(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	loanID := vars["loan_id"]

	now := time.Now()
	json.NewEncoder(w).Encode(map[string]interface{}{
		"loan_id":      loanID,
		"status":       "DISBURSED",
		"disbursed_at": now,
	})
}

// Invoice Discounting Handlers
func (s *ValueChainFinanceService) ListInvoices(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")

	invoices := []InvoiceDiscount{
		{
			ID:             "INV-001",
			TenantID:       tenantID,
			ProcessorID:    "PROC-001",
			InvoiceNo:      "INV-2024-001",
			BuyerName:      "Dangote Foods",
			InvoiceAmount:  5000000,
			DiscountRate:   2.5,
			DiscountAmount: 125000,
			NetAdvance:     4875000,
			CommodityType:  "rice",
			Quantity:       50,
			Unit:           "MT",
			Status:         "DISCOUNTED",
		},
	}
	json.NewEncoder(w).Encode(invoices)
}

func (s *ValueChainFinanceService) SubmitInvoice(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TenantID      string    `json:"tenant_id"`
		ProcessorID   string    `json:"processor_id"`
		InvoiceNo     string    `json:"invoice_no"`
		BuyerName     string    `json:"buyer_name"`
		BuyerID       string    `json:"buyer_id"`
		InvoiceAmount float64   `json:"invoice_amount"`
		InvoiceDate   time.Time `json:"invoice_date"`
		DueDate       time.Time `json:"due_date"`
		CommodityType string    `json:"commodity_type"`
		Quantity      float64   `json:"quantity"`
		Unit          string    `json:"unit"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	invoice := InvoiceDiscount{
		ID:            fmt.Sprintf("INV-%d", time.Now().Unix()),
		TenantID:      req.TenantID,
		ProcessorID:   req.ProcessorID,
		InvoiceNo:     req.InvoiceNo,
		BuyerName:     req.BuyerName,
		BuyerID:       req.BuyerID,
		InvoiceAmount: req.InvoiceAmount,
		InvoiceDate:   req.InvoiceDate,
		DueDate:       req.DueDate,
		CommodityType: req.CommodityType,
		Quantity:      req.Quantity,
		Unit:          req.Unit,
		Status:        "SUBMITTED",
		CreatedAt:     time.Now(),
	}
	json.NewEncoder(w).Encode(invoice)
}

func (s *ValueChainFinanceService) GetInvoice(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	invoiceID := vars["invoice_id"]

	invoice := InvoiceDiscount{
		ID:            invoiceID,
		InvoiceNo:     "INV-2024-001",
		InvoiceAmount: 5000000,
		Status:        "SUBMITTED",
	}
	json.NewEncoder(w).Encode(invoice)
}

func (s *ValueChainFinanceService) VerifyInvoice(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	invoiceID := vars["invoice_id"]

	json.NewEncoder(w).Encode(map[string]string{
		"invoice_id": invoiceID,
		"status":     "VERIFIED",
	})
}

func (s *ValueChainFinanceService) DiscountInvoice(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	invoiceID := vars["invoice_id"]

	var req struct {
		DiscountRate float64 `json:"discount_rate"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	// Calculate discount (simplified)
	invoiceAmount := 5000000.0
	discountAmount := invoiceAmount * (req.DiscountRate / 100)
	netAdvance := invoiceAmount - discountAmount

	json.NewEncoder(w).Encode(map[string]interface{}{
		"invoice_id":      invoiceID,
		"status":          "DISCOUNTED",
		"invoice_amount":  invoiceAmount,
		"discount_rate":   req.DiscountRate,
		"discount_amount": discountAmount,
		"net_advance":     netAdvance,
		"discounted_at":   time.Now(),
	})
}

func (s *ValueChainFinanceService) SettleInvoice(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	invoiceID := vars["invoice_id"]

	now := time.Now()
	json.NewEncoder(w).Encode(map[string]interface{}{
		"invoice_id":      invoiceID,
		"status":          "SETTLED",
		"settlement_date": now,
	})
}

// Export Finance Handlers
func (s *ValueChainFinanceService) ListExporters(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")

	exporters := []Exporter{
		{
			ID:                 "EXP-001",
			TenantID:           tenantID,
			ExporterName:       "Nigerian Agro Exports Ltd",
			RegistrationNo:     "RC789012",
			NEPCRegistration:   "NEPC/2024/001234",
			ContactPerson:      "Chief Okonkwo",
			Phone:              "+2348034567890",
			State:              "Lagos",
			ExportCommodities:  []string{"cocoa", "sesame", "ginger", "cashew"},
			ExportDestinations: []string{"Netherlands", "Germany", "China", "India"},
			AnnualExportVolume: 5000,
			AnnualExportValue:  10000000,
			CreditLimit:        500000000,
			Status:             "ACTIVE",
		},
	}
	json.NewEncoder(w).Encode(exporters)
}

func (s *ValueChainFinanceService) RegisterExporter(w http.ResponseWriter, r *http.Request) {
	var req Exporter
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	req.ID = fmt.Sprintf("EXP-%d", time.Now().Unix())
	req.Status = "ACTIVE"
	req.CreatedAt = time.Now()

	json.NewEncoder(w).Encode(req)
}

func (s *ValueChainFinanceService) GetExporter(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	exporterID := vars["exporter_id"]

	exporter := Exporter{
		ID:           exporterID,
		ExporterName: "Nigerian Agro Exports Ltd",
		Status:       "ACTIVE",
	}
	json.NewEncoder(w).Encode(exporter)
}

func (s *ValueChainFinanceService) ListExportLoans(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")

	loans := []ExportLoan{
		{
			ID:                "EXPLOAN-001",
			TenantID:          tenantID,
			ExporterID:        "EXP-001",
			ExporterName:      "Nigerian Agro Exports Ltd",
			FacilityType:      "PRE_SHIPMENT",
			LoanAmount:        100000000,
			Currency:          "NGN",
			OutstandingAmount: 80000000,
			InterestRate:      15.0,
			TenorDays:         90,
			CommodityType:     "cocoa",
			Quantity:          200,
			Unit:              "MT",
			ExportDestination: "Netherlands",
			BuyerName:         "Dutch Cocoa BV",
			BuyerCountry:      "Netherlands",
			ContractValue:     500000,
			ContractCurrency:  "USD",
			Status:            "ACTIVE",
		},
	}
	json.NewEncoder(w).Encode(loans)
}

func (s *ValueChainFinanceService) ApplyExportLoan(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TenantID          string  `json:"tenant_id"`
		ExporterID        string  `json:"exporter_id"`
		FacilityType      string  `json:"facility_type"`
		LoanAmount        float64 `json:"loan_amount"`
		Currency          string  `json:"currency"`
		TenorDays         int     `json:"tenor_days"`
		CommodityType     string  `json:"commodity_type"`
		Quantity          float64 `json:"quantity"`
		Unit              string  `json:"unit"`
		ExportDestination string  `json:"export_destination"`
		BuyerName         string  `json:"buyer_name"`
		BuyerCountry      string  `json:"buyer_country"`
		ContractValue     float64 `json:"contract_value"`
		ContractCurrency  string  `json:"contract_currency"`
		LCNumber          string  `json:"lc_number"`
		LCIssuingBank     string  `json:"lc_issuing_bank"`
		LCAmount          float64 `json:"lc_amount"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	loan := ExportLoan{
		ID:                fmt.Sprintf("EXPLOAN-%d", time.Now().Unix()),
		TenantID:          req.TenantID,
		ExporterID:        req.ExporterID,
		FacilityType:      req.FacilityType,
		LoanAmount:        req.LoanAmount,
		Currency:          req.Currency,
		OutstandingAmount: req.LoanAmount,
		InterestRate:      15.0,
		TenorDays:         req.TenorDays,
		CommodityType:     req.CommodityType,
		Quantity:          req.Quantity,
		Unit:              req.Unit,
		ExportDestination: req.ExportDestination,
		BuyerName:         req.BuyerName,
		BuyerCountry:      req.BuyerCountry,
		ContractValue:     req.ContractValue,
		ContractCurrency:  req.ContractCurrency,
		LCNumber:          req.LCNumber,
		LCIssuingBank:     req.LCIssuingBank,
		LCAmount:          req.LCAmount,
		Status:            "PENDING",
		CreatedAt:         time.Now(),
	}
	json.NewEncoder(w).Encode(loan)
}

func (s *ValueChainFinanceService) GetExportLoan(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	loanID := vars["loan_id"]

	loan := ExportLoan{
		ID:           loanID,
		FacilityType: "PRE_SHIPMENT",
		LoanAmount:   100000000,
		Status:       "ACTIVE",
	}
	json.NewEncoder(w).Encode(loan)
}

func (s *ValueChainFinanceService) ApproveExportLoan(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	loanID := vars["loan_id"]

	json.NewEncoder(w).Encode(map[string]string{"loan_id": loanID, "status": "APPROVED"})
}

func (s *ValueChainFinanceService) DisburseExportLoan(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	loanID := vars["loan_id"]

	now := time.Now()
	json.NewEncoder(w).Encode(map[string]interface{}{
		"loan_id":      loanID,
		"status":       "DISBURSED",
		"disbursed_at": now,
	})
}

func (s *ValueChainFinanceService) UpdateShippingDetails(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	loanID := vars["loan_id"]

	var req struct {
		ShippingDate       string `json:"shipping_date"`
		BillOfLading       string `json:"bill_of_lading"`
		CustomsDeclaration string `json:"customs_declaration"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	json.NewEncoder(w).Encode(map[string]interface{}{
		"loan_id":             loanID,
		"shipping_date":       req.ShippingDate,
		"bill_of_lading":      req.BillOfLading,
		"customs_declaration": req.CustomsDeclaration,
		"status":              "SHIPPED",
	})
}

// Portfolio Analytics
func (s *ValueChainFinanceService) GetValueChainPortfolio(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")

	portfolio := map[string]interface{}{
		"tenant_id":   tenantID,
		"report_date": time.Now(),
		"equipment_finance": map[string]interface{}{
			"total_loans":       25,
			"total_outstanding": 150000000,
			"npl_ratio":         2.5,
			"by_type": map[string]int{
				"TRACTOR":    10,
				"HARVESTER":  5,
				"IRRIGATION": 8,
				"PROCESSING": 2,
			},
		},
		"processor_finance": map[string]interface{}{
			"total_facilities":  15,
			"total_outstanding": 200000000,
			"npl_ratio":         1.5,
			"by_type": map[string]int{
				"WORKING_CAPITAL":     8,
				"INVOICE_DISCOUNTING": 5,
				"RECEIVABLES":         2,
			},
		},
		"export_finance": map[string]interface{}{
			"total_facilities":  10,
			"total_outstanding": 500000000,
			"npl_ratio":         0.5,
			"by_type": map[string]int{
				"PRE_SHIPMENT":  6,
				"POST_SHIPMENT": 3,
				"LC_BACKED":     1,
			},
			"by_commodity": map[string]float64{
				"cocoa":  200000000,
				"sesame": 150000000,
				"ginger": 100000000,
				"cashew": 50000000,
			},
		},
		"total_value_chain_exposure": 850000000,
		"total_value_chain_npl":      1.5,
	}
	json.NewEncoder(w).Encode(portfolio)
}
