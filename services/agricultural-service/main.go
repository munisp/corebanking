package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	_ "github.com/lib/pq"
)

// ==================== EXPANDED CROP DATABASE (15+ Nigerian Crops) ====================

type CropData struct {
	CropType         string   `json:"crop_type"`
	LocalName        string   `json:"local_name"`
	GrowingPeriod    int      `json:"growing_period"` // days
	AverageYield     float64  `json:"average_yield"`  // tonnes per hectare
	MarketPrice      float64  `json:"market_price"`   // NGN per tonne
	InputCostPerHa   float64  `json:"input_cost_per_ha"`
	RiskLevel        string   `json:"risk_level"`
	OptimalSeason    string   `json:"optimal_season"`
	WaterRequirement string   `json:"water_requirement"` // low, medium, high
	SoilTypes        []string `json:"soil_types"`
}

var CropDatabase = map[string]CropData{
	"rice": {
		CropType: "rice", LocalName: "Shinkafa",
		GrowingPeriod: 120, AverageYield: 4.5, MarketPrice: 350000.0,
		InputCostPerHa: 180000.0, RiskLevel: "medium", OptimalSeason: "wet",
		WaterRequirement: "high", SoilTypes: []string{"clay", "loamy"},
	},
	"maize": {
		CropType: "maize", LocalName: "Agbado/Masara",
		GrowingPeriod: 90, AverageYield: 3.5, MarketPrice: 250000.0,
		InputCostPerHa: 120000.0, RiskLevel: "low", OptimalSeason: "wet",
		WaterRequirement: "medium", SoilTypes: []string{"loamy", "sandy-loam"},
	},
	"cassava": {
		CropType: "cassava", LocalName: "Rogo/Ege",
		GrowingPeriod: 365, AverageYield: 25.0, MarketPrice: 80000.0,
		InputCostPerHa: 150000.0, RiskLevel: "low", OptimalSeason: "wet",
		WaterRequirement: "medium", SoilTypes: []string{"sandy", "loamy"},
	},
	"yam": {
		CropType: "yam", LocalName: "Doya/Isu",
		GrowingPeriod: 270, AverageYield: 15.0, MarketPrice: 200000.0,
		InputCostPerHa: 300000.0, RiskLevel: "medium", OptimalSeason: "wet",
		WaterRequirement: "medium", SoilTypes: []string{"loamy", "sandy-loam"},
	},
	"sorghum": {
		CropType: "sorghum", LocalName: "Dawa",
		GrowingPeriod: 120, AverageYield: 2.0, MarketPrice: 180000.0,
		InputCostPerHa: 80000.0, RiskLevel: "low", OptimalSeason: "wet",
		WaterRequirement: "low", SoilTypes: []string{"sandy", "loamy", "clay"},
	},
	"millet": {
		CropType: "millet", LocalName: "Gero",
		GrowingPeriod: 90, AverageYield: 1.5, MarketPrice: 200000.0,
		InputCostPerHa: 60000.0, RiskLevel: "low", OptimalSeason: "wet",
		WaterRequirement: "low", SoilTypes: []string{"sandy", "loamy"},
	},
	"groundnut": {
		CropType: "groundnut", LocalName: "Gyada/Epa",
		GrowingPeriod: 120, AverageYield: 2.0, MarketPrice: 400000.0,
		InputCostPerHa: 150000.0, RiskLevel: "medium", OptimalSeason: "wet",
		WaterRequirement: "medium", SoilTypes: []string{"sandy-loam", "loamy"},
	},
	"cowpea": {
		CropType: "cowpea", LocalName: "Wake/Ewa",
		GrowingPeriod: 75, AverageYield: 1.5, MarketPrice: 350000.0,
		InputCostPerHa: 100000.0, RiskLevel: "low", OptimalSeason: "wet",
		WaterRequirement: "low", SoilTypes: []string{"sandy", "loamy"},
	},
	"cocoa": {
		CropType: "cocoa", LocalName: "Koko",
		GrowingPeriod: 1825, AverageYield: 0.5, MarketPrice: 1500000.0,
		InputCostPerHa: 400000.0, RiskLevel: "medium", OptimalSeason: "perennial",
		WaterRequirement: "high", SoilTypes: []string{"loamy", "clay-loam"},
	},
	"palm_oil": {
		CropType: "palm_oil", LocalName: "Epo Pupa",
		GrowingPeriod: 1460, AverageYield: 4.0, MarketPrice: 800000.0,
		InputCostPerHa: 500000.0, RiskLevel: "low", OptimalSeason: "perennial",
		WaterRequirement: "high", SoilTypes: []string{"loamy", "clay"},
	},
	"tomato": {
		CropType: "tomato", LocalName: "Tomati",
		GrowingPeriod: 75, AverageYield: 20.0, MarketPrice: 150000.0,
		InputCostPerHa: 250000.0, RiskLevel: "high", OptimalSeason: "dry",
		WaterRequirement: "high", SoilTypes: []string{"loamy", "sandy-loam"},
	},
	"pepper": {
		CropType: "pepper", LocalName: "Ata/Barkono",
		GrowingPeriod: 90, AverageYield: 8.0, MarketPrice: 300000.0,
		InputCostPerHa: 200000.0, RiskLevel: "high", OptimalSeason: "dry",
		WaterRequirement: "medium", SoilTypes: []string{"loamy", "sandy-loam"},
	},
	"onion": {
		CropType: "onion", LocalName: "Albasa",
		GrowingPeriod: 120, AverageYield: 15.0, MarketPrice: 250000.0,
		InputCostPerHa: 300000.0, RiskLevel: "medium", OptimalSeason: "dry",
		WaterRequirement: "medium", SoilTypes: []string{"loamy", "sandy-loam"},
	},
	"ginger": {
		CropType: "ginger", LocalName: "Citta",
		GrowingPeriod: 270, AverageYield: 10.0, MarketPrice: 500000.0,
		InputCostPerHa: 350000.0, RiskLevel: "medium", OptimalSeason: "wet",
		WaterRequirement: "high", SoilTypes: []string{"loamy", "sandy-loam"},
	},
	"sesame": {
		CropType: "sesame", LocalName: "Ridi",
		GrowingPeriod: 100, AverageYield: 0.8, MarketPrice: 600000.0,
		InputCostPerHa: 80000.0, RiskLevel: "low", OptimalSeason: "wet",
		WaterRequirement: "low", SoilTypes: []string{"sandy", "loamy"},
	},
}

// ==================== LIVESTOCK DATABASE ====================

type LivestockData struct {
	LivestockType   string  `json:"livestock_type"`
	LocalName       string  `json:"local_name"`
	MaturityPeriod  int     `json:"maturity_period"` // days
	AverageWeight   float64 `json:"average_weight"`  // kg
	MarketPrice     float64 `json:"market_price"`    // NGN per unit
	FeedCostPerDay  float64 `json:"feed_cost_per_day"`
	MortalityRate   float64 `json:"mortality_rate"` // percentage
	VaccinationCost float64 `json:"vaccination_cost"`
	HousingCost     float64 `json:"housing_cost"`
}

var LivestockDatabase = map[string]LivestockData{
	"cattle_beef": {
		LivestockType: "cattle_beef", LocalName: "Saniya",
		MaturityPeriod: 730, AverageWeight: 400.0, MarketPrice: 800000.0,
		FeedCostPerDay: 1500.0, MortalityRate: 3.0, VaccinationCost: 15000.0, HousingCost: 50000.0,
	},
	"cattle_dairy": {
		LivestockType: "cattle_dairy", LocalName: "Saniyar Madara",
		MaturityPeriod: 365, AverageWeight: 350.0, MarketPrice: 600000.0,
		FeedCostPerDay: 2000.0, MortalityRate: 2.0, VaccinationCost: 20000.0, HousingCost: 80000.0,
	},
	"goat": {
		LivestockType: "goat", LocalName: "Akuya/Ewure",
		MaturityPeriod: 180, AverageWeight: 30.0, MarketPrice: 45000.0,
		FeedCostPerDay: 200.0, MortalityRate: 5.0, VaccinationCost: 3000.0, HousingCost: 10000.0,
	},
	"sheep": {
		LivestockType: "sheep", LocalName: "Tunkiya/Agutan",
		MaturityPeriod: 180, AverageWeight: 35.0, MarketPrice: 50000.0,
		FeedCostPerDay: 250.0, MortalityRate: 4.0, VaccinationCost: 3500.0, HousingCost: 12000.0,
	},
	"poultry_broiler": {
		LivestockType: "poultry_broiler", LocalName: "Kaji Nama",
		MaturityPeriod: 42, AverageWeight: 2.5, MarketPrice: 4500.0,
		FeedCostPerDay: 50.0, MortalityRate: 8.0, VaccinationCost: 150.0, HousingCost: 500.0,
	},
	"poultry_layer": {
		LivestockType: "poultry_layer", LocalName: "Kaji Kwai",
		MaturityPeriod: 140, AverageWeight: 1.8, MarketPrice: 3500.0,
		FeedCostPerDay: 40.0, MortalityRate: 5.0, VaccinationCost: 200.0, HousingCost: 600.0,
	},
	"pig": {
		LivestockType: "pig", LocalName: "Alade/Elede",
		MaturityPeriod: 180, AverageWeight: 80.0, MarketPrice: 80000.0,
		FeedCostPerDay: 500.0, MortalityRate: 4.0, VaccinationCost: 5000.0, HousingCost: 20000.0,
	},
	"fish_catfish": {
		LivestockType: "fish_catfish", LocalName: "Kifi/Eja",
		MaturityPeriod: 180, AverageWeight: 1.0, MarketPrice: 2000.0,
		FeedCostPerDay: 100.0, MortalityRate: 10.0, VaccinationCost: 0.0, HousingCost: 50000.0,
	},
	"fish_tilapia": {
		LivestockType: "fish_tilapia", LocalName: "Tilapia",
		MaturityPeriod: 210, AverageWeight: 0.5, MarketPrice: 1500.0,
		FeedCostPerDay: 80.0, MortalityRate: 8.0, VaccinationCost: 0.0, HousingCost: 40000.0,
	},
}

// ==================== MODELS ====================

type Farmer struct {
	ID              string    `json:"id"`
	TenantID        string    `json:"tenant_id"`
	FullName        string    `json:"full_name"`
	PhoneNumber     string    `json:"phone_number"`
	BVN             string    `json:"bvn"`
	NIN             string    `json:"nin"`
	FarmLocation    string    `json:"farm_location"`
	State           string    `json:"state"`
	LGA             string    `json:"lga"`
	FarmSize        float64   `json:"farm_size"` // hectares
	CropsGrown      []string  `json:"crops_grown"`
	LivestockRaised []string  `json:"livestock_raised"`
	YearsExperience int       `json:"years_experience"`
	CreditScore     int       `json:"credit_score"`
	CooperativeID   string    `json:"cooperative_id"`
	AgentID         string    `json:"agent_id"`
	KYCVerified     bool      `json:"kyc_verified"`
	KYCTier         string    `json:"kyc_tier"`
	GPSCoordinates  string    `json:"gps_coordinates"`
	Status          string    `json:"status"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type Farm struct {
	ID                string     `json:"id"`
	TenantID          string     `json:"tenant_id"`
	FarmerID          string     `json:"farmer_id"`
	FarmName          string     `json:"farm_name"`
	Location          string     `json:"location"`
	State             string     `json:"state"`
	LGA               string     `json:"lga"`
	Size              float64    `json:"size"` // hectares
	SoilType          string     `json:"soil_type"`
	IrrigationType    string     `json:"irrigation_type"`
	LandTitleNumber   string     `json:"land_title_number"`
	LandValue         float64    `json:"land_value"`
	CurrentCrop       string     `json:"current_crop"`
	PlantingDate      *time.Time `json:"planting_date"`
	GPSCoordinates    string     `json:"gps_coordinates"`
	SatelliteVerified bool       `json:"satellite_verified"`
	VerifiedBy        string     `json:"verified_by"`
	VerifiedAt        *time.Time `json:"verified_at"`
	Status            string     `json:"status"`
	CreatedAt         time.Time  `json:"created_at"`
}

type AgriculturalLoan struct {
	ID                  string                 `json:"id"`
	TenantID            string                 `json:"tenant_id"`
	FarmerID            string                 `json:"farmer_id"`
	FarmID              string                 `json:"farm_id"`
	CooperativeID       string                 `json:"cooperative_id"`
	LoanType            string                 `json:"loan_type"` // crop, livestock, input, equipment
	LoanAmount          float64                `json:"loan_amount"`
	DisbursedAmount     float64                `json:"disbursed_amount"`
	OutstandingAmount   float64                `json:"outstanding_amount"`
	LoanPurpose         string                 `json:"loan_purpose"`
	CropType            string                 `json:"crop_type"`
	LivestockType       string                 `json:"livestock_type"`
	PlantingDate        *time.Time             `json:"planting_date"`
	ExpectedHarvestDate *time.Time             `json:"expected_harvest_date"`
	SeasonType          string                 `json:"season_type"`
	InterestRate        float64                `json:"interest_rate"`
	GracePeriod         int                    `json:"grace_period"`
	TenorDays           int                    `json:"tenor_days"`
	RepaymentSchedule   []RepaymentInstallment `json:"repayment_schedule"`
	Status              string                 `json:"status"`
	CollateralType      string                 `json:"collateral_type"`
	CollateralValue     float64                `json:"collateral_value"`
	InsurancePolicyID   string                 `json:"insurance_policy_id"`
	OffTakerID          string                 `json:"off_taker_id"`
	InputSupplierID     string                 `json:"input_supplier_id"`
	WeatherRisk         string                 `json:"weather_risk"`
	RiskScore           float64                `json:"risk_score"`
	CreatedAt           time.Time              `json:"created_at"`
	DisbursedAt         *time.Time             `json:"disbursed_at"`
	MaturityDate        *time.Time             `json:"maturity_date"`
}

type RepaymentInstallment struct {
	InstallmentNumber int        `json:"installment_number"`
	DueDate           time.Time  `json:"due_date"`
	PrincipalAmount   float64    `json:"principal_amount"`
	InterestAmount    float64    `json:"interest_amount"`
	TotalAmount       float64    `json:"total_amount"`
	Status            string     `json:"status"`
	PaidAt            *time.Time `json:"paid_at"`
	PaidAmount        float64    `json:"paid_amount"`
}

type Cooperative struct {
	ID              string    `json:"id"`
	TenantID        string    `json:"tenant_id"`
	Name            string    `json:"name"`
	RegistrationNo  string    `json:"registration_no"`
	State           string    `json:"state"`
	LGA             string    `json:"lga"`
	Address         string    `json:"address"`
	ChairmanName    string    `json:"chairman_name"`
	ChairmanPhone   string    `json:"chairman_phone"`
	SecretaryName   string    `json:"secretary_name"`
	SecretaryPhone  string    `json:"secretary_phone"`
	MemberCount     int       `json:"member_count"`
	TotalFarmSize   float64   `json:"total_farm_size"`
	PrimaryCrops    []string  `json:"primary_crops"`
	BankAccountNo   string    `json:"bank_account_no"`
	GroupGuarantee  bool      `json:"group_guarantee"`
	CreditLimit     float64   `json:"credit_limit"`
	OutstandingLoan float64   `json:"outstanding_loan"`
	RepaymentRate   float64   `json:"repayment_rate"` // percentage
	Status          string    `json:"status"`
	CreatedAt       time.Time `json:"created_at"`
}

type OffTaker struct {
	ID                string    `json:"id"`
	TenantID          string    `json:"tenant_id"`
	CompanyName       string    `json:"company_name"`
	RegistrationNo    string    `json:"registration_no"`
	ContactPerson     string    `json:"contact_person"`
	ContactPhone      string    `json:"contact_phone"`
	Email             string    `json:"email"`
	Address           string    `json:"address"`
	CommoditiesBought []string  `json:"commodities_bought"`
	MinQuantity       float64   `json:"min_quantity"`
	MaxQuantity       float64   `json:"max_quantity"`
	PricePerUnit      float64   `json:"price_per_unit"`
	PaymentTerms      string    `json:"payment_terms"`
	ContractActive    bool      `json:"contract_active"`
	TotalPurchased    float64   `json:"total_purchased"`
	Status            string    `json:"status"`
	CreatedAt         time.Time `json:"created_at"`
}

type InputSupplier struct {
	ID             string    `json:"id"`
	TenantID       string    `json:"tenant_id"`
	CompanyName    string    `json:"company_name"`
	RegistrationNo string    `json:"registration_no"`
	ContactPerson  string    `json:"contact_person"`
	ContactPhone   string    `json:"contact_phone"`
	Email          string    `json:"email"`
	Address        string    `json:"address"`
	InputTypes     []string  `json:"input_types"`  // seeds, fertilizer, pesticides, equipment
	CreditTerms    int       `json:"credit_terms"` // days
	DiscountRate   float64   `json:"discount_rate"`
	MinOrderValue  float64   `json:"min_order_value"`
	DeliveryAreas  []string  `json:"delivery_areas"`
	Status         string    `json:"status"`
	CreatedAt      time.Time `json:"created_at"`
}

type LivestockLoan struct {
	ID               string    `json:"id"`
	TenantID         string    `json:"tenant_id"`
	FarmerID         string    `json:"farmer_id"`
	LivestockType    string    `json:"livestock_type"`
	Quantity         int       `json:"quantity"`
	UnitCost         float64   `json:"unit_cost"`
	TotalCost        float64   `json:"total_cost"`
	LoanAmount       float64   `json:"loan_amount"`
	InterestRate     float64   `json:"interest_rate"`
	TenorDays        int       `json:"tenor_days"`
	ExpectedMaturity time.Time `json:"expected_maturity"`
	MortalityInsured bool      `json:"mortality_insured"`
	InsurancePremium float64   `json:"insurance_premium"`
	VaccinationPlan  []string  `json:"vaccination_plan"`
	FeedingPlan      string    `json:"feeding_plan"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"created_at"`
}

// ==================== SERVICE ====================

type AgriculturalService struct {
	db *sql.DB
}

func NewAgriculturalService(db *sql.DB) *AgriculturalService {
	return &AgriculturalService{db: db}
}

// ==================== HTTP HANDLERS ====================

func (s *AgriculturalService) RegisterRoutes(r *mux.Router) {
	// Crop endpoints
	r.HandleFunc("/api/v1/agriculture/crops", s.ListCrops).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/crops/{crop_type}", s.GetCropDetails).Methods("GET")

	// Livestock endpoints
	r.HandleFunc("/api/v1/agriculture/livestock", s.ListLivestock).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/livestock/{livestock_type}", s.GetLivestockDetails).Methods("GET")

	// Farmer endpoints
	r.HandleFunc("/api/v1/agriculture/farmers", s.ListFarmers).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/farmers", s.RegisterFarmer).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/farmers/{farmer_id}", s.GetFarmer).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/farmers/{farmer_id}/farms", s.ListFarmerFarms).Methods("GET")

	// Farm endpoints
	r.HandleFunc("/api/v1/agriculture/farms", s.ListFarms).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/farms", s.RegisterFarm).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/farms/{farm_id}", s.GetFarm).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/farms/{farm_id}/verify", s.VerifyFarm).Methods("POST")

	// Loan endpoints
	r.HandleFunc("/api/v1/agriculture/loans", s.ListLoans).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/loans/assess", s.AssessLoan).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/loans/apply", s.ApplyForLoan).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/loans/{loan_id}", s.GetLoan).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/loans/{loan_id}/disburse", s.DisburseLoan).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/loans/{loan_id}/repay", s.RepayLoan).Methods("POST")

	// Livestock loan endpoints
	r.HandleFunc("/api/v1/agriculture/livestock-loans/apply", s.ApplyForLivestockLoan).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/livestock-loans/{loan_id}", s.GetLivestockLoan).Methods("GET")

	// Cooperative endpoints
	r.HandleFunc("/api/v1/agriculture/cooperatives", s.ListCooperatives).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/cooperatives", s.RegisterCooperative).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/cooperatives/{coop_id}", s.GetCooperative).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/cooperatives/{coop_id}/members", s.ListCooperativeMembers).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/cooperatives/{coop_id}/loans", s.ApplyGroupLoan).Methods("POST")

	// Off-taker endpoints
	r.HandleFunc("/api/v1/agriculture/off-takers", s.RegisterOffTaker).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/off-takers/{off_taker_id}", s.GetOffTaker).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/off-takers/{off_taker_id}/contracts", s.CreateContract).Methods("POST")

	// Input supplier endpoints
	r.HandleFunc("/api/v1/agriculture/input-suppliers", s.RegisterInputSupplier).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/input-suppliers/{supplier_id}", s.GetInputSupplier).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/input-suppliers/{supplier_id}/orders", s.CreateInputOrder).Methods("POST")

	// Partner endpoints
	r.HandleFunc("/api/v1/agriculture/partners", s.ListPartners).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/partners", s.RegisterPartner).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/partners/{partner_id}", s.GetPartner).Methods("GET")

	// Program endpoints
	r.HandleFunc("/api/v1/agriculture/programs", s.ListPrograms).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/programs", s.CreateProgram).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/programs/{program_id}", s.GetProgram).Methods("GET")

	// Weather endpoints
	r.HandleFunc("/api/v1/agriculture/weather/{location}", s.GetWeatherForecast).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/weather/{location}/risk", s.GetWeatherRisk).Methods("GET")

	// Market prices
	r.HandleFunc("/api/v1/agriculture/prices/{commodity}", s.GetCommodityPrice).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/prices/{commodity}/history", s.GetPriceHistory).Methods("GET")

	// Insurance
	r.HandleFunc("/api/v1/agriculture/insurance/quote", s.GetInsuranceQuote).Methods("POST")
	r.HandleFunc("/api/v1/agriculture/insurance/purchase", s.PurchaseInsurance).Methods("POST")

	// Analytics
	r.HandleFunc("/api/v1/agriculture/analytics/portfolio", s.GetPortfolioAnalytics).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/analytics/risk", s.GetRiskAnalytics).Methods("GET")

	// Health check
	r.HandleFunc("/health", s.HealthCheck).Methods("GET")
	r.HandleFunc("/ready", s.ReadyCheck).Methods("GET")
}

// ==================== HANDLER IMPLEMENTATIONS ====================

func (s *AgriculturalService) HealthCheck(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "healthy", "service": "agricultural-service"})
}

func (s *AgriculturalService) ReadyCheck(w http.ResponseWriter, r *http.Request) {
	if err := s.db.Ping(); err != nil {
		http.Error(w, "Database not ready", http.StatusServiceUnavailable)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
}

func (s *AgriculturalService) ListCrops(w http.ResponseWriter, r *http.Request) {
	crops := make([]CropData, 0, len(CropDatabase))
	for _, crop := range CropDatabase {
		crops = append(crops, crop)
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"crops": crops, "total": len(crops)})
}

func (s *AgriculturalService) GetCropDetails(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	cropType := vars["crop_type"]

	crop, exists := CropDatabase[cropType]
	if !exists {
		http.Error(w, "Crop not found", http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(crop)
}

func (s *AgriculturalService) ListLivestock(w http.ResponseWriter, r *http.Request) {
	livestock := make([]LivestockData, 0, len(LivestockDatabase))
	for _, ls := range LivestockDatabase {
		livestock = append(livestock, ls)
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"livestock": livestock, "total": len(livestock)})
}

func (s *AgriculturalService) GetLivestockDetails(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	livestockType := vars["livestock_type"]

	livestock, exists := LivestockDatabase[livestockType]
	if !exists {
		http.Error(w, "Livestock type not found", http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(livestock)
}

func (s *AgriculturalService) RegisterFarmer(w http.ResponseWriter, r *http.Request) {
	var farmer Farmer
	if err := json.NewDecoder(r.Body).Decode(&farmer); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	farmer.ID = fmt.Sprintf("FRM%d", time.Now().UnixNano())
	farmer.Status = "pending_verification"
	farmer.CreatedAt = time.Now()
	farmer.UpdatedAt = time.Now()

	// Insert into database
	query := `
		INSERT INTO farmers (id, tenant_id, full_name, phone_number, bvn, nin, farm_location, 
			state, lga, farm_size, crops_grown, livestock_raised, years_experience, 
			cooperative_id, agent_id, kyc_verified, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
	`

	cropsJSON, _ := json.Marshal(farmer.CropsGrown)
	livestockJSON, _ := json.Marshal(farmer.LivestockRaised)

	_, err := s.db.ExecContext(r.Context(), query,
		farmer.ID, farmer.TenantID, farmer.FullName, farmer.PhoneNumber, farmer.BVN, farmer.NIN,
		farmer.FarmLocation, farmer.State, farmer.LGA, farmer.FarmSize, cropsJSON, livestockJSON,
		farmer.YearsExperience, farmer.CooperativeID, farmer.AgentID, farmer.KYCVerified,
		farmer.Status, farmer.CreatedAt, farmer.UpdatedAt)

	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to register farmer: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(farmer)
}

func (s *AgriculturalService) ListFarmers(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 10
	}
	offset := (page - 1) * limit

	var total int
	s.db.QueryRowContext(r.Context(), "SELECT COUNT(*) FROM farmers WHERE tenant_id = $1", tenantID).Scan(&total)

	query := `SELECT farmer_id, full_name, phone_number, farm_location, farm_size,
		years_experience, status, kyc_verified FROM farmers WHERE tenant_id = $1
		ORDER BY farmer_id LIMIT $2 OFFSET $3`

	rows, err := s.db.QueryContext(r.Context(), query, tenantID, limit, offset)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var farmers []Farmer
	for rows.Next() {
		var f Farmer
		rows.Scan(&f.ID, &f.FullName, &f.PhoneNumber, &f.FarmLocation,
			&f.FarmSize, &f.YearsExperience, &f.Status, &f.KYCVerified)
		farmers = append(farmers, f)
	}

	json.NewEncoder(w).Encode(map[string]interface{}{"farmers": farmers, "total": total, "page": page, "limit": limit})
}

func (s *AgriculturalService) GetFarmer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	farmerID := vars["farmer_id"]
	tenantID := r.Header.Get("X-Tenant-ID")

	query := `SELECT id, tenant_id, full_name, phone_number, bvn, farm_location, state, lga, 
		farm_size, years_experience, kyc_verified, status, created_at 
		FROM farmers WHERE id = $1 AND tenant_id = $2`

	var farmer Farmer
	err := s.db.QueryRowContext(r.Context(), query, farmerID, tenantID).Scan(
		&farmer.ID, &farmer.TenantID, &farmer.FullName, &farmer.PhoneNumber, &farmer.BVN,
		&farmer.FarmLocation, &farmer.State, &farmer.LGA, &farmer.FarmSize,
		&farmer.YearsExperience, &farmer.KYCVerified, &farmer.Status, &farmer.CreatedAt)

	if err == sql.ErrNoRows {
		http.Error(w, "Farmer not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(farmer)
}

func (s *AgriculturalService) ListFarmerFarms(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	farmerID := vars["farmer_id"]
	tenantID := r.Header.Get("X-Tenant-ID")

	query := `SELECT id, tenant_id, farmer_id, farm_name, location, state, lga, size, 
		soil_type, irrigation_type, current_crop, status, created_at 
		FROM farms WHERE farmer_id = $1 AND tenant_id = $2`

	rows, err := s.db.QueryContext(r.Context(), query, farmerID, tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var farms []Farm
	for rows.Next() {
		var farm Farm
		rows.Scan(&farm.ID, &farm.TenantID, &farm.FarmerID, &farm.FarmName, &farm.Location,
			&farm.State, &farm.LGA, &farm.Size, &farm.SoilType, &farm.IrrigationType,
			&farm.CurrentCrop, &farm.Status, &farm.CreatedAt)
		farms = append(farms, farm)
	}

	json.NewEncoder(w).Encode(map[string]interface{}{"farms": farms, "total": len(farms)})
}

func (s *AgriculturalService) ListFarms(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 10
	}
	offset := (page - 1) * limit

	var total int
	s.db.QueryRowContext(r.Context(), "SELECT COUNT(*) FROM farms WHERE tenant_id = $1", tenantID).Scan(&total)

	query := `SELECT farm_id, farmer_id, location, size, soil_type, irrigation_type,
		current_crop, status FROM farms WHERE tenant_id = $1
		ORDER BY farm_id LIMIT $2 OFFSET $3`

	rows, err := s.db.QueryContext(r.Context(), query, tenantID, limit, offset)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var farms []Farm
	for rows.Next() {
		var f Farm
		rows.Scan(&f.ID, &f.FarmerID, &f.Location, &f.Size,
			&f.SoilType, &f.IrrigationType, &f.CurrentCrop, &f.Status)
		farms = append(farms, f)
	}

	json.NewEncoder(w).Encode(map[string]interface{}{"farms": farms, "total": total, "page": page, "limit": limit})
}

func (s *AgriculturalService) RegisterFarm(w http.ResponseWriter, r *http.Request) {
	var farm Farm
	if err := json.NewDecoder(r.Body).Decode(&farm); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	farm.ID = fmt.Sprintf("FARM%d", time.Now().UnixNano())
	farm.Status = "pending_verification"
	farm.CreatedAt = time.Now()

	query := `
		INSERT INTO farms (id, tenant_id, farmer_id, farm_name, location, state, lga, size,
			soil_type, irrigation_type, land_title_number, gps_coordinates, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`

	_, err := s.db.ExecContext(r.Context(), query,
		farm.ID, farm.TenantID, farm.FarmerID, farm.FarmName, farm.Location, farm.State,
		farm.LGA, farm.Size, farm.SoilType, farm.IrrigationType, farm.LandTitleNumber,
		farm.GPSCoordinates, farm.Status, farm.CreatedAt)

	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to register farm: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(farm)
}

func (s *AgriculturalService) GetFarm(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	farmID := vars["farm_id"]
	tenantID := r.Header.Get("X-Tenant-ID")

	query := `SELECT id, tenant_id, farmer_id, farm_name, location, state, lga, size,
		soil_type, irrigation_type, land_title_number, current_crop, status, created_at
		FROM farms WHERE id = $1 AND tenant_id = $2`

	var farm Farm
	err := s.db.QueryRowContext(r.Context(), query, farmID, tenantID).Scan(
		&farm.ID, &farm.TenantID, &farm.FarmerID, &farm.FarmName, &farm.Location,
		&farm.State, &farm.LGA, &farm.Size, &farm.SoilType, &farm.IrrigationType,
		&farm.LandTitleNumber, &farm.CurrentCrop, &farm.Status, &farm.CreatedAt)

	if err == sql.ErrNoRows {
		http.Error(w, "Farm not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(farm)
}

func (s *AgriculturalService) VerifyFarm(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	farmID := vars["farm_id"]
	tenantID := r.Header.Get("X-Tenant-ID")

	var req struct {
		VerifiedBy     string  `json:"verified_by"`
		GPSCoordinates string  `json:"gps_coordinates"`
		LandValue      float64 `json:"land_value"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	now := time.Now()
	query := `UPDATE farms SET status = 'verified', verified_by = $1, verified_at = $2, 
		gps_coordinates = $3, land_value = $4 WHERE id = $5 AND tenant_id = $6`

	_, err := s.db.ExecContext(r.Context(), query, req.VerifiedBy, now, req.GPSCoordinates,
		req.LandValue, farmID, tenantID)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":      "verified",
		"farm_id":     farmID,
		"verified_at": now,
	})
}

// ==================== LOAN ASSESSMENT ====================

type LoanAssessmentRequest struct {
	TenantID     string    `json:"tenant_id"`
	FarmerID     string    `json:"farmer_id"`
	FarmID       string    `json:"farm_id"`
	LoanType     string    `json:"loan_type"`
	LoanAmount   float64   `json:"loan_amount"`
	CropType     string    `json:"crop_type"`
	PlantingDate time.Time `json:"planting_date"`
}

type LoanAssessmentResult struct {
	Eligible          bool     `json:"eligible"`
	MaxLoanAmount     float64  `json:"max_loan_amount"`
	RecommendedAmount float64  `json:"recommended_amount"`
	InterestRate      float64  `json:"interest_rate"`
	TenorDays         int      `json:"tenor_days"`
	GracePeriod       int      `json:"grace_period"`
	WeatherRisk       string   `json:"weather_risk"`
	CropRisk          string   `json:"crop_risk"`
	RiskScore         float64  `json:"risk_score"`
	InsuranceRequired bool     `json:"insurance_required"`
	InsurancePremium  float64  `json:"insurance_premium"`
	Reasons           []string `json:"reasons"`
}

func (s *AgriculturalService) AssessLoan(w http.ResponseWriter, r *http.Request) {
	var req LoanAssessmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result := &LoanAssessmentResult{
		Eligible: true,
		Reasons:  []string{},
	}

	// Get crop data
	cropData, exists := CropDatabase[req.CropType]
	if !exists {
		result.Eligible = false
		result.Reasons = append(result.Reasons, "Unsupported crop type")
		json.NewEncoder(w).Encode(result)
		return
	}

	// Get farmer data
	var farmer Farmer
	err := s.db.QueryRowContext(r.Context(),
		`SELECT id, kyc_verified, years_experience, credit_score FROM farmers WHERE id = $1 AND tenant_id = $2`,
		req.FarmerID, req.TenantID).Scan(&farmer.ID, &farmer.KYCVerified, &farmer.YearsExperience, &farmer.CreditScore)

	if err == sql.ErrNoRows {
		result.Eligible = false
		result.Reasons = append(result.Reasons, "Farmer not found")
		json.NewEncoder(w).Encode(result)
		return
	}

	// Check KYC
	if !farmer.KYCVerified {
		result.Eligible = false
		result.Reasons = append(result.Reasons, "Farmer KYC not verified")
	}

	// Check experience
	if farmer.YearsExperience < 2 {
		result.Eligible = false
		result.Reasons = append(result.Reasons, "Minimum 2 years farming experience required")
	}

	// Get farm data
	var farm Farm
	err = s.db.QueryRowContext(r.Context(),
		`SELECT id, size, status, land_value FROM farms WHERE id = $1 AND tenant_id = $2`,
		req.FarmID, req.TenantID).Scan(&farm.ID, &farm.Size, &farm.Status, &farm.LandValue)

	if err == sql.ErrNoRows {
		result.Eligible = false
		result.Reasons = append(result.Reasons, "Farm not found")
		json.NewEncoder(w).Encode(result)
		return
	}

	if farm.Status != "verified" {
		result.Eligible = false
		result.Reasons = append(result.Reasons, "Farm must be verified")
	}

	// Calculate max loan amount
	expectedYield := farm.Size * cropData.AverageYield
	expectedRevenue := expectedYield * cropData.MarketPrice
	totalInputCost := farm.Size * cropData.InputCostPerHa

	maxBasedOnCost := totalInputCost * 0.80
	maxBasedOnRevenue := expectedRevenue * 0.50
	result.MaxLoanAmount = math.Min(maxBasedOnCost, maxBasedOnRevenue)
	result.RecommendedAmount = result.MaxLoanAmount * 0.8

	// Check requested amount
	if req.LoanAmount > result.MaxLoanAmount {
		result.Eligible = false
		result.Reasons = append(result.Reasons, fmt.Sprintf("Requested amount exceeds maximum of NGN %.2f", result.MaxLoanAmount))
	}

	// Calculate weather risk
	month := req.PlantingDate.Month()
	if month >= 4 && month <= 10 {
		result.WeatherRisk = "low"
	} else {
		result.WeatherRisk = "medium"
	}

	result.CropRisk = cropData.RiskLevel

	// Calculate interest rate
	baseRate := 12.0
	riskAdjustment := map[string]float64{"low": 0.0, "medium": 2.0, "high": 4.0}
	baseRate += riskAdjustment[cropData.RiskLevel]
	baseRate += riskAdjustment[result.WeatherRisk]

	if farmer.YearsExperience >= 10 {
		baseRate -= 1.0
	} else if farmer.YearsExperience < 5 {
		baseRate += 1.0
	}

	result.InterestRate = math.Max(10.0, math.Min(baseRate, 25.0))

	// Calculate tenor and grace period
	result.GracePeriod = cropData.GrowingPeriod + 30
	result.TenorDays = cropData.GrowingPeriod + 60

	// Calculate risk score
	result.RiskScore = 50.0
	if cropData.RiskLevel == "high" {
		result.RiskScore += 20
	} else if cropData.RiskLevel == "medium" {
		result.RiskScore += 10
	}
	if result.WeatherRisk == "high" {
		result.RiskScore += 15
	} else if result.WeatherRisk == "medium" {
		result.RiskScore += 8
	}

	// Insurance requirement
	result.InsuranceRequired = result.RiskScore > 60 || req.LoanAmount > 1000000
	if result.InsuranceRequired {
		premiumRate := 0.05
		if cropData.RiskLevel == "high" {
			premiumRate = 0.08
		}
		result.InsurancePremium = req.LoanAmount * premiumRate
	}

	json.NewEncoder(w).Encode(result)
}

func (s *AgriculturalService) ApplyForLoan(w http.ResponseWriter, r *http.Request) {
	var loan AgriculturalLoan
	if err := json.NewDecoder(r.Body).Decode(&loan); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	loan.ID = fmt.Sprintf("AGRI%d", time.Now().UnixNano())
	loan.Status = "pending_approval"
	loan.CreatedAt = time.Now()

	// Get crop data for tenor calculation
	if cropData, exists := CropDatabase[loan.CropType]; exists {
		harvestDate := loan.PlantingDate.AddDate(0, 0, cropData.GrowingPeriod)
		loan.ExpectedHarvestDate = &harvestDate
		loan.GracePeriod = cropData.GrowingPeriod + 30
		loan.TenorDays = cropData.GrowingPeriod + 60

		maturity := loan.CreatedAt.AddDate(0, 0, loan.TenorDays)
		loan.MaturityDate = &maturity
	}

	query := `
		INSERT INTO agricultural_loans (id, tenant_id, farmer_id, farm_id, cooperative_id,
			loan_type, loan_amount, loan_purpose, crop_type, planting_date, expected_harvest_date,
			season_type, interest_rate, grace_period, tenor_days, status, collateral_type,
			collateral_value, off_taker_id, input_supplier_id, weather_risk, risk_score,
			created_at, maturity_date)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
	`

	_, err := s.db.ExecContext(r.Context(), query,
		loan.ID, loan.TenantID, loan.FarmerID, loan.FarmID, loan.CooperativeID,
		loan.LoanType, loan.LoanAmount, loan.LoanPurpose, loan.CropType, loan.PlantingDate,
		loan.ExpectedHarvestDate, loan.SeasonType, loan.InterestRate, loan.GracePeriod,
		loan.TenorDays, loan.Status, loan.CollateralType, loan.CollateralValue,
		loan.OffTakerID, loan.InputSupplierID, loan.WeatherRisk, loan.RiskScore,
		loan.CreatedAt, loan.MaturityDate)

	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to create loan: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(loan)
}

func (s *AgriculturalService) GetLoan(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	loanID := vars["loan_id"]
	tenantID := r.Header.Get("X-Tenant-ID")

	query := `SELECT id, tenant_id, farmer_id, farm_id, loan_type, loan_amount, 
		disbursed_amount, outstanding_amount, crop_type, interest_rate, tenor_days,
		status, created_at FROM agricultural_loans WHERE id = $1 AND tenant_id = $2`

	var loan AgriculturalLoan
	err := s.db.QueryRowContext(r.Context(), query, loanID, tenantID).Scan(
		&loan.ID, &loan.TenantID, &loan.FarmerID, &loan.FarmID, &loan.LoanType,
		&loan.LoanAmount, &loan.DisbursedAmount, &loan.OutstandingAmount, &loan.CropType,
		&loan.InterestRate, &loan.TenorDays, &loan.Status, &loan.CreatedAt)

	if err == sql.ErrNoRows {
		http.Error(w, "Loan not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(loan)
}

func (s *AgriculturalService) ListLoans(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 10
	}
	offset := (page - 1) * limit

	var total int
	s.db.QueryRowContext(r.Context(), "SELECT COUNT(*) FROM agricultural_loans WHERE tenant_id = $1", tenantID).Scan(&total)

	query := `SELECT loan_id, farmer_id, farm_id, loan_amount, crop_type,
		interest_rate, status, planting_date, expected_harvest_date
		FROM agricultural_loans WHERE tenant_id = $1
		ORDER BY loan_id LIMIT $2 OFFSET $3`

	rows, err := s.db.QueryContext(r.Context(), query, tenantID, limit, offset)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var loans []AgriculturalLoan
	for rows.Next() {
		var l AgriculturalLoan
		rows.Scan(&l.ID, &l.FarmerID, &l.FarmID, &l.LoanAmount, &l.CropType,
			&l.InterestRate, &l.Status, &l.PlantingDate, &l.ExpectedHarvestDate)
		loans = append(loans, l)
	}

	json.NewEncoder(w).Encode(map[string]interface{}{"loans": loans, "total": total, "page": page, "limit": limit})
}

func (s *AgriculturalService) DisburseLoan(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	loanID := vars["loan_id"]
	tenantID := r.Header.Get("X-Tenant-ID")

	var req struct {
		Amount float64 `json:"amount"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	now := time.Now()
	query := `UPDATE agricultural_loans SET status = 'disbursed', disbursed_amount = $1,
		outstanding_amount = $1, disbursed_at = $2 WHERE id = $3 AND tenant_id = $4`

	_, err := s.db.ExecContext(r.Context(), query, req.Amount, now, loanID, tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":       "disbursed",
		"loan_id":      loanID,
		"amount":       req.Amount,
		"disbursed_at": now,
	})
}

func (s *AgriculturalService) RepayLoan(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	loanID := vars["loan_id"]
	tenantID := r.Header.Get("X-Tenant-ID")

	var req struct {
		Amount float64 `json:"amount"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Get current outstanding
	var outstanding float64
	err := s.db.QueryRowContext(r.Context(),
		`SELECT outstanding_amount FROM agricultural_loans WHERE id = $1 AND tenant_id = $2`,
		loanID, tenantID).Scan(&outstanding)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	newOutstanding := outstanding - req.Amount
	status := "active"
	if newOutstanding <= 0 {
		newOutstanding = 0
		status = "completed"
	}

	query := `UPDATE agricultural_loans SET outstanding_amount = $1, status = $2 WHERE id = $3 AND tenant_id = $4`
	_, err = s.db.ExecContext(r.Context(), query, newOutstanding, status, loanID, tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":      status,
		"loan_id":     loanID,
		"amount_paid": req.Amount,
		"outstanding": newOutstanding,
	})
}

// ==================== LIVESTOCK LOANS ====================

func (s *AgriculturalService) ApplyForLivestockLoan(w http.ResponseWriter, r *http.Request) {
	var loan LivestockLoan
	if err := json.NewDecoder(r.Body).Decode(&loan); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Get livestock data
	livestockData, exists := LivestockDatabase[loan.LivestockType]
	if !exists {
		http.Error(w, "Unsupported livestock type", http.StatusBadRequest)
		return
	}

	loan.ID = fmt.Sprintf("LST%d", time.Now().UnixNano())
	loan.UnitCost = livestockData.MarketPrice
	loan.TotalCost = float64(loan.Quantity) * loan.UnitCost
	loan.LoanAmount = loan.TotalCost * 0.8 // 80% financing
	loan.TenorDays = livestockData.MaturityPeriod + 30
	loan.ExpectedMaturity = time.Now().AddDate(0, 0, livestockData.MaturityPeriod)
	loan.InsurancePremium = loan.TotalCost * (livestockData.MortalityRate / 100) * 1.5
	loan.Status = "pending_approval"
	loan.CreatedAt = time.Now()

	query := `
		INSERT INTO livestock_loans (id, tenant_id, farmer_id, livestock_type, quantity,
			unit_cost, total_cost, loan_amount, interest_rate, tenor_days, expected_maturity,
			mortality_insured, insurance_premium, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
	`

	_, err := s.db.ExecContext(r.Context(), query,
		loan.ID, loan.TenantID, loan.FarmerID, loan.LivestockType, loan.Quantity,
		loan.UnitCost, loan.TotalCost, loan.LoanAmount, loan.InterestRate, loan.TenorDays,
		loan.ExpectedMaturity, loan.MortalityInsured, loan.InsurancePremium, loan.Status, loan.CreatedAt)

	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to create livestock loan: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(loan)
}

func (s *AgriculturalService) GetLivestockLoan(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	loanID := vars["loan_id"]
	tenantID := r.Header.Get("X-Tenant-ID")

	query := `SELECT id, tenant_id, farmer_id, livestock_type, quantity, unit_cost,
		total_cost, loan_amount, interest_rate, tenor_days, expected_maturity,
		mortality_insured, insurance_premium, status, created_at
		FROM livestock_loans WHERE id = $1 AND tenant_id = $2`

	var loan LivestockLoan
	err := s.db.QueryRowContext(r.Context(), query, loanID, tenantID).Scan(
		&loan.ID, &loan.TenantID, &loan.FarmerID, &loan.LivestockType, &loan.Quantity,
		&loan.UnitCost, &loan.TotalCost, &loan.LoanAmount, &loan.InterestRate, &loan.TenorDays,
		&loan.ExpectedMaturity, &loan.MortalityInsured, &loan.InsurancePremium, &loan.Status, &loan.CreatedAt)

	if err == sql.ErrNoRows {
		http.Error(w, "Livestock loan not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(loan)
}

// ==================== COOPERATIVE ENDPOINTS ====================

func (s *AgriculturalService) RegisterCooperative(w http.ResponseWriter, r *http.Request) {
	var coop Cooperative
	if err := json.NewDecoder(r.Body).Decode(&coop); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	coop.ID = fmt.Sprintf("COOP%d", time.Now().UnixNano())
	coop.Status = "active"
	coop.CreatedAt = time.Now()

	cropsJSON, _ := json.Marshal(coop.PrimaryCrops)

	query := `
		INSERT INTO cooperatives (id, tenant_id, name, registration_no, state, lga, address,
			chairman_name, chairman_phone, secretary_name, secretary_phone, member_count,
			total_farm_size, primary_crops, bank_account_no, group_guarantee, credit_limit, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
	`

	_, err := s.db.ExecContext(r.Context(), query,
		coop.ID, coop.TenantID, coop.Name, coop.RegistrationNo, coop.State, coop.LGA, coop.Address,
		coop.ChairmanName, coop.ChairmanPhone, coop.SecretaryName, coop.SecretaryPhone, coop.MemberCount,
		coop.TotalFarmSize, cropsJSON, coop.BankAccountNo, coop.GroupGuarantee, coop.CreditLimit, coop.Status, coop.CreatedAt)

	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to register cooperative: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(coop)
}

func (s *AgriculturalService) GetCooperative(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	coopID := vars["coop_id"]
	tenantID := r.Header.Get("X-Tenant-ID")

	query := `SELECT id, tenant_id, name, registration_no, state, lga, member_count,
		total_farm_size, credit_limit, outstanding_loan, repayment_rate, status, created_at
		FROM cooperatives WHERE id = $1 AND tenant_id = $2`

	var coop Cooperative
	err := s.db.QueryRowContext(r.Context(), query, coopID, tenantID).Scan(
		&coop.ID, &coop.TenantID, &coop.Name, &coop.RegistrationNo, &coop.State, &coop.LGA,
		&coop.MemberCount, &coop.TotalFarmSize, &coop.CreditLimit, &coop.OutstandingLoan,
		&coop.RepaymentRate, &coop.Status, &coop.CreatedAt)

	if err == sql.ErrNoRows {
		http.Error(w, "Cooperative not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(coop)
}

func (s *AgriculturalService) ListCooperativeMembers(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	coopID := vars["coop_id"]
	tenantID := r.Header.Get("X-Tenant-ID")

	query := `SELECT id, full_name, phone_number, farm_size, years_experience, status
		FROM farmers WHERE cooperative_id = $1 AND tenant_id = $2`

	rows, err := s.db.QueryContext(r.Context(), query, coopID, tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var members []map[string]interface{}
	for rows.Next() {
		var id, name, phone, status string
		var farmSize float64
		var experience int
		rows.Scan(&id, &name, &phone, &farmSize, &experience, &status)
		members = append(members, map[string]interface{}{
			"id": id, "full_name": name, "phone_number": phone,
			"farm_size": farmSize, "years_experience": experience, "status": status,
		})
	}

	json.NewEncoder(w).Encode(map[string]interface{}{"members": members, "total": len(members)})
}

func (s *AgriculturalService) ApplyGroupLoan(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	coopID := vars["coop_id"]

	var req struct {
		TenantID   string   `json:"tenant_id"`
		LoanAmount float64  `json:"loan_amount"`
		CropType   string   `json:"crop_type"`
		MemberIDs  []string `json:"member_ids"`
		Purpose    string   `json:"purpose"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	loanID := fmt.Sprintf("GRP%d", time.Now().UnixNano())
	amountPerMember := req.LoanAmount / float64(len(req.MemberIDs))

	// Create group loan record
	query := `
		INSERT INTO group_loans (id, tenant_id, cooperative_id, total_amount, amount_per_member,
			crop_type, purpose, member_count, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending_approval', $9)
	`

	_, err := s.db.ExecContext(r.Context(), query,
		loanID, req.TenantID, coopID, req.LoanAmount, amountPerMember,
		req.CropType, req.Purpose, len(req.MemberIDs), time.Now())

	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to create group loan: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"loan_id":           loanID,
		"cooperative_id":    coopID,
		"total_amount":      req.LoanAmount,
		"amount_per_member": amountPerMember,
		"member_count":      len(req.MemberIDs),
		"status":            "pending_approval",
	})
}

// ==================== OFF-TAKER ENDPOINTS ====================

func (s *AgriculturalService) RegisterOffTaker(w http.ResponseWriter, r *http.Request) {
	var offTaker OffTaker
	if err := json.NewDecoder(r.Body).Decode(&offTaker); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	offTaker.ID = fmt.Sprintf("OFT%d", time.Now().UnixNano())
	offTaker.Status = "active"
	offTaker.CreatedAt = time.Now()

	commoditiesJSON, _ := json.Marshal(offTaker.CommoditiesBought)

	query := `
		INSERT INTO off_takers (id, tenant_id, company_name, registration_no, contact_person,
			contact_phone, email, address, commodities_bought, min_quantity, max_quantity,
			price_per_unit, payment_terms, contract_active, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
	`

	_, err := s.db.ExecContext(r.Context(), query,
		offTaker.ID, offTaker.TenantID, offTaker.CompanyName, offTaker.RegistrationNo,
		offTaker.ContactPerson, offTaker.ContactPhone, offTaker.Email, offTaker.Address,
		commoditiesJSON, offTaker.MinQuantity, offTaker.MaxQuantity, offTaker.PricePerUnit,
		offTaker.PaymentTerms, offTaker.ContractActive, offTaker.Status, offTaker.CreatedAt)

	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to register off-taker: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(offTaker)
}

func (s *AgriculturalService) GetOffTaker(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	offTakerID := vars["off_taker_id"]
	tenantID := r.Header.Get("X-Tenant-ID")

	query := `SELECT id, tenant_id, company_name, contact_person, contact_phone,
		min_quantity, max_quantity, price_per_unit, payment_terms, contract_active, status
		FROM off_takers WHERE id = $1 AND tenant_id = $2`

	var offTaker OffTaker
	err := s.db.QueryRowContext(r.Context(), query, offTakerID, tenantID).Scan(
		&offTaker.ID, &offTaker.TenantID, &offTaker.CompanyName, &offTaker.ContactPerson,
		&offTaker.ContactPhone, &offTaker.MinQuantity, &offTaker.MaxQuantity,
		&offTaker.PricePerUnit, &offTaker.PaymentTerms, &offTaker.ContractActive, &offTaker.Status)

	if err == sql.ErrNoRows {
		http.Error(w, "Off-taker not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(offTaker)
}

func (s *AgriculturalService) CreateContract(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	offTakerID := vars["off_taker_id"]

	var req struct {
		TenantID     string    `json:"tenant_id"`
		FarmerID     string    `json:"farmer_id"`
		CropType     string    `json:"crop_type"`
		Quantity     float64   `json:"quantity"`
		PricePerUnit float64   `json:"price_per_unit"`
		DeliveryDate time.Time `json:"delivery_date"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	contractID := fmt.Sprintf("CTR%d", time.Now().UnixNano())
	totalValue := req.Quantity * req.PricePerUnit

	query := `
		INSERT INTO off_taker_contracts (id, tenant_id, off_taker_id, farmer_id, crop_type,
			quantity, price_per_unit, total_value, delivery_date, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10)
	`

	_, err := s.db.ExecContext(r.Context(), query,
		contractID, req.TenantID, offTakerID, req.FarmerID, req.CropType,
		req.Quantity, req.PricePerUnit, totalValue, req.DeliveryDate, time.Now())

	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to create contract: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"contract_id":   contractID,
		"off_taker_id":  offTakerID,
		"farmer_id":     req.FarmerID,
		"crop_type":     req.CropType,
		"quantity":      req.Quantity,
		"total_value":   totalValue,
		"delivery_date": req.DeliveryDate,
		"status":        "active",
	})
}

// ==================== INPUT SUPPLIER ENDPOINTS ====================

func (s *AgriculturalService) RegisterInputSupplier(w http.ResponseWriter, r *http.Request) {
	var supplier InputSupplier
	if err := json.NewDecoder(r.Body).Decode(&supplier); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	supplier.ID = fmt.Sprintf("SUP%d", time.Now().UnixNano())
	supplier.Status = "active"
	supplier.CreatedAt = time.Now()

	inputTypesJSON, _ := json.Marshal(supplier.InputTypes)
	deliveryAreasJSON, _ := json.Marshal(supplier.DeliveryAreas)

	query := `
		INSERT INTO input_suppliers (id, tenant_id, company_name, registration_no, contact_person,
			contact_phone, email, address, input_types, credit_terms, discount_rate,
			min_order_value, delivery_areas, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
	`

	_, err := s.db.ExecContext(r.Context(), query,
		supplier.ID, supplier.TenantID, supplier.CompanyName, supplier.RegistrationNo,
		supplier.ContactPerson, supplier.ContactPhone, supplier.Email, supplier.Address,
		inputTypesJSON, supplier.CreditTerms, supplier.DiscountRate, supplier.MinOrderValue,
		deliveryAreasJSON, supplier.Status, supplier.CreatedAt)

	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to register input supplier: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(supplier)
}

func (s *AgriculturalService) GetInputSupplier(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	supplierID := vars["supplier_id"]
	tenantID := r.Header.Get("X-Tenant-ID")

	query := `SELECT id, tenant_id, company_name, contact_person, contact_phone,
		credit_terms, discount_rate, min_order_value, status
		FROM input_suppliers WHERE id = $1 AND tenant_id = $2`

	var supplier InputSupplier
	err := s.db.QueryRowContext(r.Context(), query, supplierID, tenantID).Scan(
		&supplier.ID, &supplier.TenantID, &supplier.CompanyName, &supplier.ContactPerson,
		&supplier.ContactPhone, &supplier.CreditTerms, &supplier.DiscountRate,
		&supplier.MinOrderValue, &supplier.Status)

	if err == sql.ErrNoRows {
		http.Error(w, "Input supplier not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(supplier)
}

func (s *AgriculturalService) CreateInputOrder(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	supplierID := vars["supplier_id"]

	var req struct {
		TenantID     string  `json:"tenant_id"`
		FarmerID     string  `json:"farmer_id"`
		LoanID       string  `json:"loan_id"`
		InputType    string  `json:"input_type"`
		Quantity     float64 `json:"quantity"`
		UnitPrice    float64 `json:"unit_price"`
		DeliveryAddr string  `json:"delivery_address"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	orderID := fmt.Sprintf("ORD%d", time.Now().UnixNano())
	totalValue := req.Quantity * req.UnitPrice

	query := `
		INSERT INTO input_orders (id, tenant_id, supplier_id, farmer_id, loan_id,
			input_type, quantity, unit_price, total_value, delivery_address, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11)
	`

	_, err := s.db.ExecContext(r.Context(), query,
		orderID, req.TenantID, supplierID, req.FarmerID, req.LoanID,
		req.InputType, req.Quantity, req.UnitPrice, totalValue, req.DeliveryAddr, time.Now())

	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to create order: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"order_id":    orderID,
		"supplier_id": supplierID,
		"farmer_id":   req.FarmerID,
		"input_type":  req.InputType,
		"total_value": totalValue,
		"status":      "pending",
	})
}

// ==================== WEATHER & MARKET ENDPOINTS ====================

func (s *AgriculturalService) GetWeatherForecast(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	location := vars["location"]

	// In production, integrate with NIMET or OpenWeather API
	// For now, return realistic sample data based on season
	month := time.Now().Month()

	var rainfall, temperature, humidity float64
	var season, risk string

	if month >= 4 && month <= 10 {
		season = "wet"
		rainfall = 150.0 + float64(time.Now().Unix()%50)
		temperature = 26.0 + float64(time.Now().Unix()%4)
		humidity = 75.0 + float64(time.Now().Unix()%15)
		risk = "low"
	} else {
		season = "dry"
		rainfall = 20.0 + float64(time.Now().Unix()%30)
		temperature = 32.0 + float64(time.Now().Unix()%5)
		humidity = 40.0 + float64(time.Now().Unix()%20)
		risk = "medium"
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"location":      location,
		"season":        season,
		"rainfall_mm":   rainfall,
		"temperature":   temperature,
		"humidity":      humidity,
		"risk_level":    risk,
		"forecast_days": 30,
		"last_updated":  time.Now(),
	})
}

func (s *AgriculturalService) GetWeatherRisk(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	location := vars["location"]

	month := time.Now().Month()
	var risk string
	var score float64

	if month >= 4 && month <= 10 {
		risk = "low"
		score = 0.2
	} else {
		risk = "medium"
		score = 0.5
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"location":   location,
		"risk_level": risk,
		"risk_score": score,
		"factors":    []string{"rainfall", "temperature", "humidity"},
	})
}

func (s *AgriculturalService) GetCommodityPrice(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	commodity := vars["commodity"]

	if cropData, exists := CropDatabase[commodity]; exists {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"commodity":    commodity,
			"price":        cropData.MarketPrice,
			"unit":         "NGN/tonne",
			"last_updated": time.Now(),
		})
		return
	}

	http.Error(w, "Commodity not found", http.StatusNotFound)
}

func (s *AgriculturalService) GetPriceHistory(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	commodity := vars["commodity"]

	cropData, exists := CropDatabase[commodity]
	if !exists {
		http.Error(w, "Commodity not found", http.StatusNotFound)
		return
	}

	// Generate 12 months of price history
	history := make([]map[string]interface{}, 12)
	basePrice := cropData.MarketPrice

	for i := 0; i < 12; i++ {
		month := time.Now().AddDate(0, -i, 0)
		seasonalFactor := 1.0 + 0.1*math.Sin(float64(i)*math.Pi/6)
		price := basePrice * seasonalFactor

		history[11-i] = map[string]interface{}{
			"month": month.Format("2006-01"),
			"price": price,
		}
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"commodity": commodity,
		"history":   history,
	})
}

// ==================== INSURANCE ENDPOINTS ====================

func (s *AgriculturalService) GetInsuranceQuote(w http.ResponseWriter, r *http.Request) {
	var req struct {
		CropType   string  `json:"crop_type"`
		FarmSize   float64 `json:"farm_size"`
		LoanAmount float64 `json:"loan_amount"`
		Location   string  `json:"location"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	cropData, exists := CropDatabase[req.CropType]
	if !exists {
		http.Error(w, "Unsupported crop type", http.StatusBadRequest)
		return
	}

	// Calculate premium based on risk
	basePremiumRate := 0.05
	riskAdjustment := map[string]float64{"low": 0.0, "medium": 0.01, "high": 0.02}
	premiumRate := basePremiumRate + riskAdjustment[cropData.RiskLevel]

	premium := req.LoanAmount * premiumRate
	coverage := req.LoanAmount * 1.2 // 120% coverage

	json.NewEncoder(w).Encode(map[string]interface{}{
		"crop_type":      req.CropType,
		"farm_size":      req.FarmSize,
		"loan_amount":    req.LoanAmount,
		"coverage":       coverage,
		"premium":        premium,
		"premium_rate":   premiumRate * 100,
		"risk_level":     cropData.RiskLevel,
		"valid_for_days": 30,
	})
}

func (s *AgriculturalService) PurchaseInsurance(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TenantID string  `json:"tenant_id"`
		FarmerID string  `json:"farmer_id"`
		LoanID   string  `json:"loan_id"`
		CropType string  `json:"crop_type"`
		Coverage float64 `json:"coverage"`
		Premium  float64 `json:"premium"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	policyID := fmt.Sprintf("INS%d", time.Now().UnixNano())
	startDate := time.Now()
	endDate := startDate.AddDate(1, 0, 0)

	query := `
		INSERT INTO crop_insurance_policies (id, tenant_id, farmer_id, loan_id, crop_type,
			coverage_amount, premium_amount, start_date, end_date, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10)
	`

	_, err := s.db.ExecContext(r.Context(), query,
		policyID, req.TenantID, req.FarmerID, req.LoanID, req.CropType,
		req.Coverage, req.Premium, startDate, endDate, time.Now())

	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to purchase insurance: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"policy_id":  policyID,
		"farmer_id":  req.FarmerID,
		"loan_id":    req.LoanID,
		"coverage":   req.Coverage,
		"premium":    req.Premium,
		"start_date": startDate,
		"end_date":   endDate,
		"status":     "active",
	})
}

// ==================== ANALYTICS ENDPOINTS ====================

func (s *AgriculturalService) GetPortfolioAnalytics(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")

	// Get loan portfolio stats
	var totalLoans, activeLoans, completedLoans int
	var totalDisbursed, totalOutstanding float64

	s.db.QueryRowContext(r.Context(),
		`SELECT COUNT(*), COALESCE(SUM(disbursed_amount), 0), COALESCE(SUM(outstanding_amount), 0)
		FROM agricultural_loans WHERE tenant_id = $1`, tenantID).Scan(&totalLoans, &totalDisbursed, &totalOutstanding)

	s.db.QueryRowContext(r.Context(),
		`SELECT COUNT(*) FROM agricultural_loans WHERE tenant_id = $1 AND status = 'active'`, tenantID).Scan(&activeLoans)

	s.db.QueryRowContext(r.Context(),
		`SELECT COUNT(*) FROM agricultural_loans WHERE tenant_id = $1 AND status = 'completed'`, tenantID).Scan(&completedLoans)

	// Get crop distribution
	rows, _ := s.db.QueryContext(r.Context(),
		`SELECT crop_type, COUNT(*), SUM(loan_amount) FROM agricultural_loans 
		WHERE tenant_id = $1 GROUP BY crop_type`, tenantID)
	defer rows.Close()

	cropDistribution := make([]map[string]interface{}, 0)
	for rows.Next() {
		var cropType string
		var count int
		var amount float64
		rows.Scan(&cropType, &count, &amount)
		cropDistribution = append(cropDistribution, map[string]interface{}{
			"crop_type": cropType, "count": count, "amount": amount,
		})
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"total_loans":       totalLoans,
		"active_loans":      activeLoans,
		"completed_loans":   completedLoans,
		"total_disbursed":   totalDisbursed,
		"total_outstanding": totalOutstanding,
		"crop_distribution": cropDistribution,
	})
}

func (s *AgriculturalService) GetRiskAnalytics(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")

	// Get risk distribution
	rows, _ := s.db.QueryContext(r.Context(),
		`SELECT weather_risk, COUNT(*), SUM(outstanding_amount) FROM agricultural_loans 
		WHERE tenant_id = $1 AND status = 'active' GROUP BY weather_risk`, tenantID)
	defer rows.Close()

	riskDistribution := make([]map[string]interface{}, 0)
	for rows.Next() {
		var risk string
		var count int
		var amount float64
		rows.Scan(&risk, &count, &amount)
		riskDistribution = append(riskDistribution, map[string]interface{}{
			"risk_level": risk, "count": count, "exposure": amount,
		})
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"risk_distribution": riskDistribution,
		"analysis_date":     time.Now(),
	})
}

// ==================== PARTNERS & PROGRAMS ====================

type Program struct {
	ID                  string     `json:"id"`
	TenantID            string     `json:"tenant_id"`
	Name                string     `json:"name"`
	ProgramType         string     `json:"program_type"` // ABP, AGSMEIS, CACS, ACGSF, custom
	Description         string     `json:"description"`
	FundingSource       string     `json:"funding_source"`
	MaxLoanAmount       float64    `json:"max_loan_amount"`
	InterestRate        float64    `json:"interest_rate"`
	TenorDays           int        `json:"tenor_days"`
	TargetFarmers       int        `json:"target_farmers"`
	EligibilityCriteria []string   `json:"eligibility_criteria"`
	Status              string     `json:"status"` // active, paused, closed
	StartDate           time.Time  `json:"start_date"`
	EndDate             *time.Time `json:"end_date"`
	CreatedAt           time.Time  `json:"created_at"`
}

func (s *AgriculturalService) ListCooperatives(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")

	rows, err := s.db.QueryContext(r.Context(),
		`SELECT id, tenant_id, name, registration_no, state, lga, member_count, total_farm_size, 
		credit_limit, outstanding_loan, repayment_rate, status, created_at
		FROM cooperatives WHERE tenant_id = $1 ORDER BY created_at DESC`, tenantID)
	if err != nil {
		http.Error(w, "Failed to fetch cooperatives", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	cooperatives := make([]Cooperative, 0)
	for rows.Next() {
		var c Cooperative
		err := rows.Scan(&c.ID, &c.TenantID, &c.Name, &c.RegistrationNo, &c.State, &c.LGA,
			&c.MemberCount, &c.TotalFarmSize, &c.CreditLimit, &c.OutstandingLoan,
			&c.RepaymentRate, &c.Status, &c.CreatedAt)
		if err != nil {
			continue
		}
		c.PrimaryCrops = []string{}
		cooperatives = append(cooperatives, c)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"cooperatives": cooperatives,
		"total":        len(cooperatives),
	})
}

func (s *AgriculturalService) ListPartners(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")

	rows, err := s.db.QueryContext(r.Context(),
		`SELECT id, tenant_id, name, partner_type, contact_name, contact_phone, email, address, rating, total_deals, status, created_at
		FROM partners WHERE tenant_id = $1 ORDER BY created_at DESC`, tenantID)
	if err != nil {
		http.Error(w, "Failed to fetch partners", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	partners := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id, tenantID, name, partnerType, contactName, contactPhone, email, address, status string
		var rating float64
		var totalDeals int
		var createdAt time.Time
		err := rows.Scan(&id, &tenantID, &name, &partnerType, &contactName, &contactPhone,
			&email, &address, &rating, &totalDeals, &status, &createdAt)
		if err != nil {
			continue
		}
		partners = append(partners, map[string]interface{}{
			"id": id, "tenant_id": tenantID, "name": name, "partner_type": partnerType,
			"contact_name": contactName, "contact_phone": contactPhone, "email": email,
			"address": address, "rating": rating, "total_deals": totalDeals,
			"status": status, "created_at": createdAt,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"partners": partners,
		"total":    len(partners),
	})
}

func (s *AgriculturalService) RegisterPartner(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")

	var partner map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&partner); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	partnerID := fmt.Sprintf("partner_%d", time.Now().UnixNano())
	partner["id"] = partnerID
	partner["tenant_id"] = tenantID
	partner["created_at"] = time.Now()
	partner["status"] = "active"

	_, err := s.db.ExecContext(r.Context(),
		`INSERT INTO partners (id, tenant_id, name, partner_type, contact_name, contact_phone, email, address, rating, total_deals, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
		partnerID, tenantID, partner["name"], partner["partner_type"], partner["contact_name"],
		partner["contact_phone"], partner["email"], partner["address"], 0.0, 0, "active", time.Now())

	if err != nil {
		http.Error(w, "Failed to register partner", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(partner)
}

func (s *AgriculturalService) GetPartner(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	partnerID := vars["partner_id"]

	var id, tenantID, name, partnerType, contactName, contactPhone, email, address, status string
	var rating float64
	var totalDeals int
	var createdAt time.Time

	err := s.db.QueryRowContext(r.Context(),
		`SELECT id, tenant_id, name, partner_type, contact_name, contact_phone, email, address, rating, total_deals, status, created_at
		FROM partners WHERE id = $1`, partnerID).Scan(&id, &tenantID, &name, &partnerType,
		&contactName, &contactPhone, &email, &address, &rating, &totalDeals, &status, &createdAt)

	if err != nil {
		http.Error(w, "Partner not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id": id, "tenant_id": tenantID, "name": name, "partner_type": partnerType,
		"contact_name": contactName, "contact_phone": contactPhone, "email": email,
		"address": address, "rating": rating, "total_deals": totalDeals,
		"status": status, "created_at": createdAt,
	})
}

func (s *AgriculturalService) ListPrograms(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")

	rows, err := s.db.QueryContext(r.Context(),
		`SELECT id, tenant_id, name, program_type, description, funding_source, max_loan_amount, interest_rate, 
		tenor_days, target_farmers, status, start_date, end_date, created_at
		FROM programs WHERE tenant_id = $1 ORDER BY created_at DESC`, tenantID)
	if err != nil {
		http.Error(w, "Failed to fetch programs", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	programs := make([]Program, 0)
	for rows.Next() {
		var p Program
		err := rows.Scan(&p.ID, &p.TenantID, &p.Name, &p.ProgramType, &p.Description, &p.FundingSource,
			&p.MaxLoanAmount, &p.InterestRate, &p.TenorDays, &p.TargetFarmers, &p.Status, &p.StartDate, &p.EndDate, &p.CreatedAt)
		if err != nil {
			continue
		}
		p.EligibilityCriteria = []string{}
		programs = append(programs, p)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"programs": programs,
		"total":    len(programs),
	})
}

func (s *AgriculturalService) CreateProgram(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")

	var program Program
	if err := json.NewDecoder(r.Body).Decode(&program); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	program.ID = fmt.Sprintf("program_%d", time.Now().UnixNano())
	program.TenantID = tenantID
	program.CreatedAt = time.Now()
	program.Status = "active"

	_, err := s.db.ExecContext(r.Context(),
		`INSERT INTO programs (id, tenant_id, name, program_type, description, funding_source, max_loan_amount, interest_rate, tenor_days, target_farmers, status, start_date, end_date, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
		program.ID, program.TenantID, program.Name, program.ProgramType, program.Description, program.FundingSource,
		program.MaxLoanAmount, program.InterestRate, program.TenorDays, program.TargetFarmers, program.Status, program.StartDate, program.EndDate, program.CreatedAt)

	if err != nil {
		http.Error(w, "Failed to create program", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(program)
}

func (s *AgriculturalService) GetProgram(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	programID := vars["program_id"]

	var program Program
	err := s.db.QueryRowContext(r.Context(),
		`SELECT id, tenant_id, name, program_type, description, funding_source, max_loan_amount, interest_rate, tenor_days, target_farmers, status, start_date, end_date, created_at
		FROM programs WHERE id = $1`, programID).Scan(&program.ID, &program.TenantID, &program.Name, &program.ProgramType,
		&program.Description, &program.FundingSource, &program.MaxLoanAmount, &program.InterestRate, &program.TenorDays,
		&program.TargetFarmers, &program.Status, &program.StartDate, &program.EndDate, &program.CreatedAt)

	if err != nil {
		http.Error(w, "Program not found", http.StatusNotFound)
		return
	}

	program.EligibilityCriteria = []string{}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(program)
}

// ==================== ROUTE REGISTRATION HELPERS ====================

// ==================== MAIN ====================

func main() {
	// Database connection
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:postgres@localhost:5432/agricultural_db?sslmode=disable"
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Setup router
	r := mux.NewRouter()

	// Initialize and register core agricultural service
	service := NewAgriculturalService(db)
	service.RegisterRoutes(r)

	// Initialize and register regulatory compliance service (Category 1)
	regulatoryService := NewRegulatoryComplianceService(db)
	regulatoryService.RegisterRoutes(r)
	log.Println("Registered: Regulatory Compliance Service (CBN sector codes, prudential classification, IFRS 9/ECL)")

	// Initialize and register external integrations service (Category 2)
	externalService := NewExternalIntegrationsService(db)
	externalService.RegisterRoutes(r)
	log.Println("Registered: External Integrations Service (Credit bureaus, CRMS, NCR, NAIC, Commodity exchanges)")

	// Initialize and register AgTech/satellite service (Category 5)
	agTechService := NewAgTechService(db)
	agTechService.RegisterRoutes(r)
	log.Println("Registered: AgTech & Satellite Service (NDVI, farm verification, IoT, weather stations)")

	// Initialize and register value chain finance service (Category 6)
	valueChainService := NewValueChainFinanceService(db)
	valueChainService.RegisterRoutes(r)
	log.Println("Registered: Value Chain Finance Service (Equipment, processor, invoice, export finance)")

	// Initialize and register analytics & reporting service (Category 7)
	analyticsService := NewAnalyticsService(db)
	analyticsService.RegisterRoutes(r)
	log.Println("Registered: Analytics & Reporting Service (Dashboards, impact metrics, cohort analysis, CBN returns)")

	// Initialize and register distribution channels service (Category 4)
	distributionService := NewDistributionChannelsService(db)
	distributionService.RegisterRoutes(r)
	log.Println("Registered: Distribution Channels Service (APISIX gateway, IVR flows, agent app)")

	// Register agent banking routes
	service.RegisterAgentBankingRoutes(r)
	log.Println("Registered: Agent Banking (transactions list/stats/create/get)")

	// Initialize and register USSD handler (existing)
	ussdHandler := NewUSSDHandler(db)
	ussdHandler.RegisterRoutes(r)
	log.Println("Registered: USSD Handler (4 languages: English, Hausa, Yoruba, Igbo)")

	// Initialize and register weather service (existing)
	weatherService := NewWeatherService(db)
	weatherService.RegisterRoutes(r)
	log.Println("Registered: Weather Service (NIMET integration, forecasts, risk assessment)")

	// Initialize and register merged agri services (consolidated from standalone microservices)
	mergedAgriService := NewMergedAgriService(db)
	mergedAgriService.RegisterRoutes(r)
	log.Println("Registered: Merged Agri Services (evoucher, input-marketplace, logistics, reinsurance, savings-cycles, esg-impact, cbn-returns, ussd-agri, iot-sensor, agriculture-banking, crossborder-trade)")

	// Register standalone route groups
	RegisterFarmerFirstProductsRoutes(r)
	log.Println("Registered: Farmer-First Products (crop calendars, season-aligned loans, input vouchers, warehouse receipt loans, group lending, credit history)")

	RegisterFarmerImpactDashboardRoutes(r)
	log.Println("Registered: Farmer Impact Dashboard (farmer/cooperative dashboards, regulator reports, achievements, certificates)")

	RegisterProactiveRiskManagementRoutes(r)
	log.Println("Registered: Proactive Risk Management (shock detection, cohort rescheduling, dynamic limits, risk pricing, price drop alerts, bulk comms)")

	RegisterInclusiveAccessRoutes(r)
	log.Println("Registered: Inclusive Access (USSD request/profile/loan-status/prices/planting/season-plan/voucher-redeem/payment, IVR flow, languages)")

	RegisterMicroInsuranceRoutes(r)
	log.Println("Registered: Micro-Insurance (products, policies, parametric triggers, auto-claims, bundles, guarantees, eligibility)")

	RegisterPartnerEcosystemRoutes(r)
	log.Println("Registered: Partner Ecosystem (partner onboard/transactions, program check-eligibility/enroll/configure)")

	// Start server
	port := os.Getenv("SERVICE_PORT")
	if port == "" {
		port = "8015"
	}

	log.Printf("Agricultural Service starting on port %s", port)
	log.Printf("Total endpoints registered: 350+ across 15 service modules")
	log.Fatal(http.ListenAndServe(":"+port, r))
}
