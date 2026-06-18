package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gorilla/mux"
)

// ==================== ANALYTICS & REPORTING ====================
// Portfolio dashboards, impact metrics, cohort analysis, regulatory exports

// Portfolio Dashboard Data
type PortfolioDashboard struct {
	TenantID        string    `json:"tenant_id"`
	ReportDate      time.Time `json:"report_date"`
	Summary         PortfolioSummary `json:"summary"`
	ByCrop          []CropBreakdown `json:"by_crop"`
	ByRegion        []RegionBreakdown `json:"by_region"`
	ByCooperative   []CooperativeBreakdown `json:"by_cooperative"`
	NPLAnalysis     NPLAnalysis `json:"npl_analysis"`
	YieldAnalysis   YieldAnalysis `json:"yield_analysis"`
	TrendData       []TrendDataPoint `json:"trend_data"`
}

type PortfolioSummary struct {
	TotalLoans          int     `json:"total_loans"`
	TotalDisbursed      float64 `json:"total_disbursed"`
	TotalOutstanding    float64 `json:"total_outstanding"`
	TotalCollections    float64 `json:"total_collections"`
	AverageTicketSize   float64 `json:"average_ticket_size"`
	TotalFarmers        int     `json:"total_farmers"`
	TotalCooperatives   int     `json:"total_cooperatives"`
	TotalHectares       float64 `json:"total_hectares"`
	PerformingLoans     int     `json:"performing_loans"`
	NonPerformingLoans  int     `json:"non_performing_loans"`
	NPLRatio            float64 `json:"npl_ratio"`
	PAR30               float64 `json:"par_30"`
	PAR60               float64 `json:"par_60"`
	PAR90               float64 `json:"par_90"`
	CollectionRate      float64 `json:"collection_rate"`
	RepaymentRate       float64 `json:"repayment_rate"`
}

type CropBreakdown struct {
	CropType          string  `json:"crop_type"`
	LoanCount         int     `json:"loan_count"`
	TotalDisbursed    float64 `json:"total_disbursed"`
	TotalOutstanding  float64 `json:"total_outstanding"`
	Hectares          float64 `json:"hectares"`
	FarmerCount       int     `json:"farmer_count"`
	NPLRatio          float64 `json:"npl_ratio"`
	AverageYield      float64 `json:"average_yield"`
	ExpectedYield     float64 `json:"expected_yield"`
	YieldVariance     float64 `json:"yield_variance"`
}

type RegionBreakdown struct {
	State             string  `json:"state"`
	LGA               string  `json:"lga"`
	LoanCount         int     `json:"loan_count"`
	TotalDisbursed    float64 `json:"total_disbursed"`
	TotalOutstanding  float64 `json:"total_outstanding"`
	FarmerCount       int     `json:"farmer_count"`
	NPLRatio          float64 `json:"npl_ratio"`
	WeatherRisk       string  `json:"weather_risk"`
}

type CooperativeBreakdown struct {
	CooperativeID     string  `json:"cooperative_id"`
	CooperativeName   string  `json:"cooperative_name"`
	LoanCount         int     `json:"loan_count"`
	TotalDisbursed    float64 `json:"total_disbursed"`
	TotalOutstanding  float64 `json:"total_outstanding"`
	MemberCount       int     `json:"member_count"`
	NPLRatio          float64 `json:"npl_ratio"`
	RepaymentRate     float64 `json:"repayment_rate"`
}

type NPLAnalysis struct {
	TotalNPL          float64 `json:"total_npl"`
	NPLRatio          float64 `json:"npl_ratio"`
	ByClassification  map[string]float64 `json:"by_classification"`
	ByCrop            map[string]float64 `json:"by_crop"`
	ByRegion          map[string]float64 `json:"by_region"`
	RecoveryRate      float64 `json:"recovery_rate"`
	WriteOffAmount    float64 `json:"write_off_amount"`
	ProvisionAmount   float64 `json:"provision_amount"`
}

type YieldAnalysis struct {
	AverageActualYield   float64 `json:"average_actual_yield"`
	AverageExpectedYield float64 `json:"average_expected_yield"`
	YieldVariance        float64 `json:"yield_variance"`
	ByCrop               map[string]YieldMetrics `json:"by_crop"`
	TopPerformers        []FarmYieldPerformance `json:"top_performers"`
	UnderPerformers      []FarmYieldPerformance `json:"under_performers"`
}

type YieldMetrics struct {
	ActualYield   float64 `json:"actual_yield"`
	ExpectedYield float64 `json:"expected_yield"`
	Variance      float64 `json:"variance"`
	SampleSize    int     `json:"sample_size"`
}

type FarmYieldPerformance struct {
	FarmID        string  `json:"farm_id"`
	FarmerName    string  `json:"farmer_name"`
	CropType      string  `json:"crop_type"`
	ActualYield   float64 `json:"actual_yield"`
	ExpectedYield float64 `json:"expected_yield"`
	Variance      float64 `json:"variance"`
}

type TrendDataPoint struct {
	Period            string  `json:"period"`
	Disbursements     float64 `json:"disbursements"`
	Collections       float64 `json:"collections"`
	Outstanding       float64 `json:"outstanding"`
	NPLRatio          float64 `json:"npl_ratio"`
	NewLoans          int     `json:"new_loans"`
	NewFarmers        int     `json:"new_farmers"`
}

// Impact Metrics
type ImpactMetrics struct {
	TenantID          string    `json:"tenant_id"`
	ReportDate        time.Time `json:"report_date"`
	FarmerMetrics     FarmerImpactMetrics `json:"farmer_metrics"`
	FinancialInclusion FinancialInclusionMetrics `json:"financial_inclusion"`
	ProductivityMetrics ProductivityImpactMetrics `json:"productivity_metrics"`
	SustainabilityMetrics SustainabilityMetrics `json:"sustainability_metrics"`
	SDGAlignment      SDGAlignmentMetrics `json:"sdg_alignment"`
}

type FarmerImpactMetrics struct {
	TotalFarmersOnboarded    int     `json:"total_farmers_onboarded"`
	MaleFarmers              int     `json:"male_farmers"`
	FemaleFarmers            int     `json:"female_farmers"`
	YouthFarmers             int     `json:"youth_farmers"` // Under 35
	FirstTimeBorrowers       int     `json:"first_time_borrowers"`
	RepeatBorrowers          int     `json:"repeat_borrowers"`
	SmallholderFarmers       int     `json:"smallholder_farmers"` // < 2 hectares
	MediumFarmers            int     `json:"medium_farmers"`      // 2-10 hectares
	LargeFarmers             int     `json:"large_farmers"`       // > 10 hectares
	CooperativeMembers       int     `json:"cooperative_members"`
	IndividualFarmers        int     `json:"individual_farmers"`
	AverageAge               float64 `json:"average_age"`
	LiteracyRate             float64 `json:"literacy_rate"`
}

type FinancialInclusionMetrics struct {
	NewBankAccounts          int     `json:"new_bank_accounts"`
	MobileMoneyAdoption      int     `json:"mobile_money_adoption"`
	InsurancePenetration     float64 `json:"insurance_penetration"`
	SavingsAccounts          int     `json:"savings_accounts"`
	AverageSavingsBalance    float64 `json:"average_savings_balance"`
	DigitalTransactions      int     `json:"digital_transactions"`
	USSDTransactions         int     `json:"ussd_transactions"`
	AgentTransactions        int     `json:"agent_transactions"`
}

type ProductivityImpactMetrics struct {
	AverageYieldImprovement  float64 `json:"average_yield_improvement"` // percentage
	TotalProductionIncrease  float64 `json:"total_production_increase"` // MT
	InputAdoptionRate        float64 `json:"input_adoption_rate"`
	MechanizationRate        float64 `json:"mechanization_rate"`
	IrrigationAdoption       float64 `json:"irrigation_adoption"`
	ImprovedSeedAdoption     float64 `json:"improved_seed_adoption"`
	FertilizerUsage          float64 `json:"fertilizer_usage"`
	PostHarvestLossReduction float64 `json:"post_harvest_loss_reduction"`
}

type SustainabilityMetrics struct {
	ClimateSmartPractices    int     `json:"climate_smart_practices"`
	OrganicFarming           int     `json:"organic_farming"`
	WaterConservation        int     `json:"water_conservation"`
	SoilHealthImprovement    int     `json:"soil_health_improvement"`
	BiodiversityConservation int     `json:"biodiversity_conservation"`
	CarbonSequestration      float64 `json:"carbon_sequestration"` // tonnes CO2
}

type SDGAlignmentMetrics struct {
	SDG1_NoPoverty           float64 `json:"sdg1_no_poverty"`
	SDG2_ZeroHunger          float64 `json:"sdg2_zero_hunger"`
	SDG5_GenderEquality      float64 `json:"sdg5_gender_equality"`
	SDG8_DecentWork          float64 `json:"sdg8_decent_work"`
	SDG12_ResponsibleConsumption float64 `json:"sdg12_responsible_consumption"`
	SDG13_ClimateAction      float64 `json:"sdg13_climate_action"`
}

// Cohort Analysis
type CohortAnalysis struct {
	TenantID          string    `json:"tenant_id"`
	ReportDate        time.Time `json:"report_date"`
	CohortType        string    `json:"cohort_type"` // FIRST_TIME, REPEAT, CROP, REGION
	Cohorts           []Cohort  `json:"cohorts"`
	RetentionMatrix   [][]float64 `json:"retention_matrix"`
	PerformanceMatrix [][]float64 `json:"performance_matrix"`
}

type Cohort struct {
	CohortID          string  `json:"cohort_id"`
	CohortName        string  `json:"cohort_name"`
	CohortPeriod      string  `json:"cohort_period"`
	InitialSize       int     `json:"initial_size"`
	CurrentSize       int     `json:"current_size"`
	RetentionRate     float64 `json:"retention_rate"`
	AverageTicketSize float64 `json:"average_ticket_size"`
	RepaymentRate     float64 `json:"repayment_rate"`
	NPLRatio          float64 `json:"npl_ratio"`
	GraduationRate    float64 `json:"graduation_rate"` // Moved to larger loans
	DefaultRate       float64 `json:"default_rate"`
}

// Regulatory Reports
type CBNReturn struct {
	ReturnType        string    `json:"return_type"`
	ReportPeriod      string    `json:"report_period"`
	TenantID          string    `json:"tenant_id"`
	TenantName        string    `json:"tenant_name"`
	SubmissionDate    time.Time `json:"submission_date"`
	Status            string    `json:"status"`
	Data              interface{} `json:"data"`
}

type DFIReport struct {
	ReportType        string    `json:"report_type"`
	DFIName           string    `json:"dfi_name"` // NIRSAL, BOA, AfDB, etc.
	ReportPeriod      string    `json:"report_period"`
	TenantID          string    `json:"tenant_id"`
	Data              interface{} `json:"data"`
}

type BoardPack struct {
	ReportPeriod      string    `json:"report_period"`
	TenantID          string    `json:"tenant_id"`
	ExecutiveSummary  string    `json:"executive_summary"`
	PortfolioOverview PortfolioSummary `json:"portfolio_overview"`
	KeyMetrics        map[string]interface{} `json:"key_metrics"`
	RiskHighlights    []string  `json:"risk_highlights"`
	Recommendations   []string  `json:"recommendations"`
	Appendices        []string  `json:"appendices"`
}

// Analytics Service
type AnalyticsService struct {
	db *sql.DB
}

func NewAnalyticsService(db *sql.DB) *AnalyticsService {
	return &AnalyticsService{db: db}
}

// Register analytics routes
func (s *AnalyticsService) RegisterRoutes(r *mux.Router) {
	// Portfolio Dashboards
	r.HandleFunc("/api/v1/analytics/portfolio/dashboard", s.GetPortfolioDashboard).Methods("GET")
	r.HandleFunc("/api/v1/analytics/portfolio/summary", s.GetPortfolioSummary).Methods("GET")
	r.HandleFunc("/api/v1/analytics/portfolio/by-crop", s.GetPortfolioByCrop).Methods("GET")
	r.HandleFunc("/api/v1/analytics/portfolio/by-region", s.GetPortfolioByRegion).Methods("GET")
	r.HandleFunc("/api/v1/analytics/portfolio/by-cooperative", s.GetPortfolioByCooperative).Methods("GET")
	r.HandleFunc("/api/v1/analytics/portfolio/npl", s.GetNPLAnalysis).Methods("GET")
	r.HandleFunc("/api/v1/analytics/portfolio/yield", s.GetYieldAnalysis).Methods("GET")
	r.HandleFunc("/api/v1/analytics/portfolio/trends", s.GetPortfolioTrends).Methods("GET")
	
	// Impact Metrics
	r.HandleFunc("/api/v1/analytics/impact", s.GetImpactMetrics).Methods("GET")
	r.HandleFunc("/api/v1/analytics/impact/farmers", s.GetFarmerImpactMetrics).Methods("GET")
	r.HandleFunc("/api/v1/analytics/impact/financial-inclusion", s.GetFinancialInclusionMetrics).Methods("GET")
	r.HandleFunc("/api/v1/analytics/impact/productivity", s.GetProductivityMetrics).Methods("GET")
	r.HandleFunc("/api/v1/analytics/impact/sustainability", s.GetSustainabilityMetrics).Methods("GET")
	r.HandleFunc("/api/v1/analytics/impact/sdg", s.GetSDGAlignment).Methods("GET")
	
	// Cohort Analysis
	r.HandleFunc("/api/v1/analytics/cohorts", s.GetCohortAnalysis).Methods("GET")
	r.HandleFunc("/api/v1/analytics/cohorts/first-time-vs-repeat", s.GetFirstTimeVsRepeatCohorts).Methods("GET")
	r.HandleFunc("/api/v1/analytics/cohorts/by-crop", s.GetCohortsByCrop).Methods("GET")
	r.HandleFunc("/api/v1/analytics/cohorts/by-region", s.GetCohortsByRegion).Methods("GET")
	r.HandleFunc("/api/v1/analytics/cohorts/retention", s.GetRetentionAnalysis).Methods("GET")
	
	// Regulatory Reports
	r.HandleFunc("/api/v1/analytics/reports/cbn", s.GenerateCBNReturn).Methods("POST")
	r.HandleFunc("/api/v1/analytics/reports/cbn/list", s.ListCBNReturns).Methods("GET")
	r.HandleFunc("/api/v1/analytics/reports/dfi", s.GenerateDFIReport).Methods("POST")
	r.HandleFunc("/api/v1/analytics/reports/dfi/list", s.ListDFIReports).Methods("GET")
	r.HandleFunc("/api/v1/analytics/reports/board-pack", s.GenerateBoardPack).Methods("POST")
	
	// Export Endpoints
	r.HandleFunc("/api/v1/analytics/export/csv", s.ExportToCSV).Methods("GET")
	r.HandleFunc("/api/v1/analytics/export/excel", s.ExportToExcel).Methods("GET")
	r.HandleFunc("/api/v1/analytics/export/pdf", s.ExportToPDF).Methods("GET")
	
	// Real-time Metrics
	r.HandleFunc("/api/v1/analytics/realtime/disbursements", s.GetRealtimeDisbursements).Methods("GET")
	r.HandleFunc("/api/v1/analytics/realtime/collections", s.GetRealtimeCollections).Methods("GET")
	r.HandleFunc("/api/v1/analytics/realtime/alerts", s.GetRealtimeAlerts).Methods("GET")
}

// Portfolio Dashboard Handlers
func (s *AnalyticsService) GetPortfolioDashboard(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	
	dashboard := PortfolioDashboard{
		TenantID:   tenantID,
		ReportDate: time.Now(),
		Summary: PortfolioSummary{
			TotalLoans:         500,
			TotalDisbursed:     2500000000,
			TotalOutstanding:   1800000000,
			TotalCollections:   700000000,
			AverageTicketSize:  5000000,
			TotalFarmers:       450,
			TotalCooperatives:  25,
			TotalHectares:      2250,
			PerformingLoans:    475,
			NonPerformingLoans: 25,
			NPLRatio:           5.0,
			PAR30:              8.0,
			PAR60:              5.0,
			PAR90:              3.0,
			CollectionRate:     92.0,
			RepaymentRate:      95.0,
		},
		ByCrop: []CropBreakdown{
			{CropType: "rice", LoanCount: 200, TotalDisbursed: 1000000000, TotalOutstanding: 700000000, Hectares: 1000, FarmerCount: 180, NPLRatio: 4.0, AverageYield: 4.2, ExpectedYield: 4.5, YieldVariance: -6.7},
			{CropType: "maize", LoanCount: 150, TotalDisbursed: 750000000, TotalOutstanding: 550000000, Hectares: 750, FarmerCount: 140, NPLRatio: 5.0, AverageYield: 3.1, ExpectedYield: 3.5, YieldVariance: -11.4},
			{CropType: "cassava", LoanCount: 100, TotalDisbursed: 500000000, TotalOutstanding: 350000000, Hectares: 350, FarmerCount: 90, NPLRatio: 6.0, AverageYield: 22.0, ExpectedYield: 25.0, YieldVariance: -12.0},
			{CropType: "sorghum", LoanCount: 50, TotalDisbursed: 250000000, TotalOutstanding: 200000000, Hectares: 150, FarmerCount: 40, NPLRatio: 8.0, AverageYield: 1.8, ExpectedYield: 2.0, YieldVariance: -10.0},
		},
		ByRegion: []RegionBreakdown{
			{State: "Kano", LoanCount: 150, TotalDisbursed: 750000000, TotalOutstanding: 550000000, FarmerCount: 140, NPLRatio: 4.0, WeatherRisk: "LOW"},
			{State: "Kaduna", LoanCount: 120, TotalDisbursed: 600000000, TotalOutstanding: 450000000, FarmerCount: 110, NPLRatio: 5.0, WeatherRisk: "MEDIUM"},
			{State: "Niger", LoanCount: 100, TotalDisbursed: 500000000, TotalOutstanding: 350000000, FarmerCount: 90, NPLRatio: 6.0, WeatherRisk: "MEDIUM"},
			{State: "Kebbi", LoanCount: 80, TotalDisbursed: 400000000, TotalOutstanding: 300000000, FarmerCount: 70, NPLRatio: 5.5, WeatherRisk: "LOW"},
			{State: "Benue", LoanCount: 50, TotalDisbursed: 250000000, TotalOutstanding: 150000000, FarmerCount: 40, NPLRatio: 7.0, WeatherRisk: "HIGH"},
		},
		ByCooperative: []CooperativeBreakdown{
			{CooperativeID: "COOP-001", CooperativeName: "Kano Rice Farmers Cooperative", LoanCount: 50, TotalDisbursed: 250000000, TotalOutstanding: 180000000, MemberCount: 100, NPLRatio: 3.0, RepaymentRate: 97.0},
			{CooperativeID: "COOP-002", CooperativeName: "Kaduna Maize Growers Association", LoanCount: 40, TotalDisbursed: 200000000, TotalOutstanding: 150000000, MemberCount: 80, NPLRatio: 4.0, RepaymentRate: 95.0},
		},
		NPLAnalysis: NPLAnalysis{
			TotalNPL:    90000000,
			NPLRatio:    5.0,
			ByClassification: map[string]float64{
				"WATCH_LIST":  30000000,
				"SUBSTANDARD": 35000000,
				"DOUBTFUL":    20000000,
				"LOST":        5000000,
			},
			ByCrop: map[string]float64{
				"rice":    28000000,
				"maize":   27500000,
				"cassava": 21000000,
				"sorghum": 13500000,
			},
			RecoveryRate:    65.0,
			WriteOffAmount:  5000000,
			ProvisionAmount: 45000000,
		},
		YieldAnalysis: YieldAnalysis{
			AverageActualYield:   3.8,
			AverageExpectedYield: 4.2,
			YieldVariance:        -9.5,
			ByCrop: map[string]YieldMetrics{
				"rice":    {ActualYield: 4.2, ExpectedYield: 4.5, Variance: -6.7, SampleSize: 180},
				"maize":   {ActualYield: 3.1, ExpectedYield: 3.5, Variance: -11.4, SampleSize: 140},
				"cassava": {ActualYield: 22.0, ExpectedYield: 25.0, Variance: -12.0, SampleSize: 90},
			},
		},
		TrendData: s.generateTrendData(),
	}
	
	json.NewEncoder(w).Encode(dashboard)
}

func (s *AnalyticsService) generateTrendData() []TrendDataPoint {
	trends := []TrendDataPoint{}
	baseDate := time.Now()
	
	for i := 11; i >= 0; i-- {
		month := baseDate.AddDate(0, -i, 0)
		trends = append(trends, TrendDataPoint{
			Period:        month.Format("2006-01"),
			Disbursements: float64(200000000 + i*10000000),
			Collections:   float64(50000000 + i*5000000),
			Outstanding:   float64(1500000000 + i*25000000),
			NPLRatio:      5.0 - float64(i)*0.1,
			NewLoans:      40 + i,
			NewFarmers:    35 + i,
		})
	}
	return trends
}

func (s *AnalyticsService) GetPortfolioSummary(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	
	summary := PortfolioSummary{
		TotalLoans:         500,
		TotalDisbursed:     2500000000,
		TotalOutstanding:   1800000000,
		TotalCollections:   700000000,
		AverageTicketSize:  5000000,
		TotalFarmers:       450,
		TotalCooperatives:  25,
		TotalHectares:      2250,
		PerformingLoans:    475,
		NonPerformingLoans: 25,
		NPLRatio:           5.0,
		PAR30:              8.0,
		PAR60:              5.0,
		PAR90:              3.0,
		CollectionRate:     92.0,
		RepaymentRate:      95.0,
	}
	
	json.NewEncoder(w).Encode(map[string]interface{}{
		"tenant_id": tenantID,
		"summary":   summary,
	})
}

func (s *AnalyticsService) GetPortfolioByCrop(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	
	crops := []CropBreakdown{
		{CropType: "rice", LoanCount: 200, TotalDisbursed: 1000000000, TotalOutstanding: 700000000, Hectares: 1000, FarmerCount: 180, NPLRatio: 4.0},
		{CropType: "maize", LoanCount: 150, TotalDisbursed: 750000000, TotalOutstanding: 550000000, Hectares: 750, FarmerCount: 140, NPLRatio: 5.0},
		{CropType: "cassava", LoanCount: 100, TotalDisbursed: 500000000, TotalOutstanding: 350000000, Hectares: 350, FarmerCount: 90, NPLRatio: 6.0},
	}
	
	json.NewEncoder(w).Encode(map[string]interface{}{
		"tenant_id": tenantID,
		"by_crop":   crops,
	})
}

func (s *AnalyticsService) GetPortfolioByRegion(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	
	regions := []RegionBreakdown{
		{State: "Kano", LoanCount: 150, TotalDisbursed: 750000000, TotalOutstanding: 550000000, FarmerCount: 140, NPLRatio: 4.0, WeatherRisk: "LOW"},
		{State: "Kaduna", LoanCount: 120, TotalDisbursed: 600000000, TotalOutstanding: 450000000, FarmerCount: 110, NPLRatio: 5.0, WeatherRisk: "MEDIUM"},
	}
	
	json.NewEncoder(w).Encode(map[string]interface{}{
		"tenant_id": tenantID,
		"by_region": regions,
	})
}

func (s *AnalyticsService) GetPortfolioByCooperative(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	
	cooperatives := []CooperativeBreakdown{
		{CooperativeID: "COOP-001", CooperativeName: "Kano Rice Farmers Cooperative", LoanCount: 50, TotalDisbursed: 250000000, MemberCount: 100, NPLRatio: 3.0, RepaymentRate: 97.0},
	}
	
	json.NewEncoder(w).Encode(map[string]interface{}{
		"tenant_id":      tenantID,
		"by_cooperative": cooperatives,
	})
}

func (s *AnalyticsService) GetNPLAnalysis(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	
	npl := NPLAnalysis{
		TotalNPL:    90000000,
		NPLRatio:    5.0,
		ByClassification: map[string]float64{
			"WATCH_LIST":  30000000,
			"SUBSTANDARD": 35000000,
			"DOUBTFUL":    20000000,
			"LOST":        5000000,
		},
		RecoveryRate:    65.0,
		WriteOffAmount:  5000000,
		ProvisionAmount: 45000000,
	}
	
	json.NewEncoder(w).Encode(map[string]interface{}{
		"tenant_id":    tenantID,
		"npl_analysis": npl,
	})
}

func (s *AnalyticsService) GetYieldAnalysis(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	
	yield := YieldAnalysis{
		AverageActualYield:   3.8,
		AverageExpectedYield: 4.2,
		YieldVariance:        -9.5,
		ByCrop: map[string]YieldMetrics{
			"rice":  {ActualYield: 4.2, ExpectedYield: 4.5, Variance: -6.7, SampleSize: 180},
			"maize": {ActualYield: 3.1, ExpectedYield: 3.5, Variance: -11.4, SampleSize: 140},
		},
	}
	
	json.NewEncoder(w).Encode(map[string]interface{}{
		"tenant_id":      tenantID,
		"yield_analysis": yield,
	})
}

func (s *AnalyticsService) GetPortfolioTrends(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	
	json.NewEncoder(w).Encode(map[string]interface{}{
		"tenant_id": tenantID,
		"trends":    s.generateTrendData(),
	})
}

// Impact Metrics Handlers
func (s *AnalyticsService) GetImpactMetrics(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	
	impact := ImpactMetrics{
		TenantID:   tenantID,
		ReportDate: time.Now(),
		FarmerMetrics: FarmerImpactMetrics{
			TotalFarmersOnboarded: 450,
			MaleFarmers:           320,
			FemaleFarmers:         130,
			YouthFarmers:          180,
			FirstTimeBorrowers:    200,
			RepeatBorrowers:       250,
			SmallholderFarmers:    300,
			MediumFarmers:         120,
			LargeFarmers:          30,
			CooperativeMembers:    350,
			IndividualFarmers:     100,
			AverageAge:            42.5,
			LiteracyRate:          65.0,
		},
		FinancialInclusion: FinancialInclusionMetrics{
			NewBankAccounts:       200,
			MobileMoneyAdoption:   350,
			InsurancePenetration:  45.0,
			SavingsAccounts:       180,
			AverageSavingsBalance: 150000,
			DigitalTransactions:   5000,
			USSDTransactions:      3500,
			AgentTransactions:     1500,
		},
		ProductivityMetrics: ProductivityImpactMetrics{
			AverageYieldImprovement:  25.0,
			TotalProductionIncrease:  5000,
			InputAdoptionRate:        75.0,
			MechanizationRate:        35.0,
			IrrigationAdoption:       20.0,
			ImprovedSeedAdoption:     80.0,
			FertilizerUsage:          85.0,
			PostHarvestLossReduction: 30.0,
		},
		SustainabilityMetrics: SustainabilityMetrics{
			ClimateSmartPractices:    150,
			OrganicFarming:           50,
			WaterConservation:        100,
			SoilHealthImprovement:    200,
			BiodiversityConservation: 30,
			CarbonSequestration:      1500,
		},
		SDGAlignment: SDGAlignmentMetrics{
			SDG1_NoPoverty:               85.0,
			SDG2_ZeroHunger:              90.0,
			SDG5_GenderEquality:          65.0,
			SDG8_DecentWork:              80.0,
			SDG12_ResponsibleConsumption: 70.0,
			SDG13_ClimateAction:          60.0,
		},
	}
	
	json.NewEncoder(w).Encode(impact)
}

func (s *AnalyticsService) GetFarmerImpactMetrics(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	
	metrics := FarmerImpactMetrics{
		TotalFarmersOnboarded: 450,
		MaleFarmers:           320,
		FemaleFarmers:         130,
		YouthFarmers:          180,
		FirstTimeBorrowers:    200,
		RepeatBorrowers:       250,
	}
	
	json.NewEncoder(w).Encode(map[string]interface{}{
		"tenant_id":      tenantID,
		"farmer_metrics": metrics,
	})
}

func (s *AnalyticsService) GetFinancialInclusionMetrics(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	
	metrics := FinancialInclusionMetrics{
		NewBankAccounts:       200,
		MobileMoneyAdoption:   350,
		InsurancePenetration:  45.0,
		SavingsAccounts:       180,
		AverageSavingsBalance: 150000,
	}
	
	json.NewEncoder(w).Encode(map[string]interface{}{
		"tenant_id":           tenantID,
		"financial_inclusion": metrics,
	})
}

func (s *AnalyticsService) GetProductivityMetrics(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	
	metrics := ProductivityImpactMetrics{
		AverageYieldImprovement: 25.0,
		TotalProductionIncrease: 5000,
		InputAdoptionRate:       75.0,
		MechanizationRate:       35.0,
	}
	
	json.NewEncoder(w).Encode(map[string]interface{}{
		"tenant_id":    tenantID,
		"productivity": metrics,
	})
}

func (s *AnalyticsService) GetSustainabilityMetrics(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	
	metrics := SustainabilityMetrics{
		ClimateSmartPractices: 150,
		OrganicFarming:        50,
		WaterConservation:     100,
		CarbonSequestration:   1500,
	}
	
	json.NewEncoder(w).Encode(map[string]interface{}{
		"tenant_id":      tenantID,
		"sustainability": metrics,
	})
}

func (s *AnalyticsService) GetSDGAlignment(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	
	metrics := SDGAlignmentMetrics{
		SDG1_NoPoverty:   85.0,
		SDG2_ZeroHunger:  90.0,
		SDG5_GenderEquality: 65.0,
	}
	
	json.NewEncoder(w).Encode(map[string]interface{}{
		"tenant_id":     tenantID,
		"sdg_alignment": metrics,
	})
}

// Cohort Analysis Handlers
func (s *AnalyticsService) GetCohortAnalysis(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	cohortType := r.URL.Query().Get("type")
	
	if cohortType == "" {
		cohortType = "FIRST_TIME"
	}
	
	analysis := CohortAnalysis{
		TenantID:   tenantID,
		ReportDate: time.Now(),
		CohortType: cohortType,
		Cohorts: []Cohort{
			{CohortID: "2024-Q1", CohortName: "Q1 2024 Borrowers", CohortPeriod: "2024-Q1", InitialSize: 100, CurrentSize: 85, RetentionRate: 85.0, AverageTicketSize: 4500000, RepaymentRate: 95.0, NPLRatio: 3.0, GraduationRate: 15.0, DefaultRate: 2.0},
			{CohortID: "2024-Q2", CohortName: "Q2 2024 Borrowers", CohortPeriod: "2024-Q2", InitialSize: 120, CurrentSize: 110, RetentionRate: 91.7, AverageTicketSize: 5000000, RepaymentRate: 96.0, NPLRatio: 2.5, GraduationRate: 12.0, DefaultRate: 1.5},
			{CohortID: "2024-Q3", CohortName: "Q3 2024 Borrowers", CohortPeriod: "2024-Q3", InitialSize: 150, CurrentSize: 145, RetentionRate: 96.7, AverageTicketSize: 5200000, RepaymentRate: 97.0, NPLRatio: 2.0, GraduationRate: 8.0, DefaultRate: 1.0},
		},
	}
	
	json.NewEncoder(w).Encode(analysis)
}

func (s *AnalyticsService) GetFirstTimeVsRepeatCohorts(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	
	result := map[string]interface{}{
		"tenant_id": tenantID,
		"first_time_borrowers": Cohort{
			CohortID: "FIRST_TIME", CohortName: "First-Time Borrowers",
			InitialSize: 200, CurrentSize: 160, RetentionRate: 80.0,
			AverageTicketSize: 3500000, RepaymentRate: 92.0, NPLRatio: 6.0,
		},
		"repeat_borrowers": Cohort{
			CohortID: "REPEAT", CohortName: "Repeat Borrowers",
			InitialSize: 250, CurrentSize: 240, RetentionRate: 96.0,
			AverageTicketSize: 6000000, RepaymentRate: 98.0, NPLRatio: 2.0,
		},
		"insights": []string{
			"Repeat borrowers have 50% lower NPL ratio",
			"Repeat borrowers take 71% larger loans on average",
			"First-time borrower retention improves with cooperative membership",
		},
	}
	
	json.NewEncoder(w).Encode(result)
}

func (s *AnalyticsService) GetCohortsByCrop(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	
	cohorts := []Cohort{
		{CohortID: "RICE", CohortName: "Rice Farmers", InitialSize: 180, RetentionRate: 90.0, RepaymentRate: 95.0, NPLRatio: 4.0},
		{CohortID: "MAIZE", CohortName: "Maize Farmers", InitialSize: 140, RetentionRate: 85.0, RepaymentRate: 93.0, NPLRatio: 5.0},
		{CohortID: "CASSAVA", CohortName: "Cassava Farmers", InitialSize: 90, RetentionRate: 82.0, RepaymentRate: 91.0, NPLRatio: 6.0},
	}
	
	json.NewEncoder(w).Encode(map[string]interface{}{
		"tenant_id": tenantID,
		"cohorts":   cohorts,
	})
}

func (s *AnalyticsService) GetCohortsByRegion(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	
	cohorts := []Cohort{
		{CohortID: "KANO", CohortName: "Kano State", InitialSize: 140, RetentionRate: 92.0, RepaymentRate: 96.0, NPLRatio: 4.0},
		{CohortID: "KADUNA", CohortName: "Kaduna State", InitialSize: 110, RetentionRate: 88.0, RepaymentRate: 94.0, NPLRatio: 5.0},
	}
	
	json.NewEncoder(w).Encode(map[string]interface{}{
		"tenant_id": tenantID,
		"cohorts":   cohorts,
	})
}

func (s *AnalyticsService) GetRetentionAnalysis(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	
	// Retention matrix: rows are cohorts, columns are months
	retentionMatrix := [][]float64{
		{100, 95, 92, 90, 88, 85},
		{100, 96, 94, 92, 91, 90},
		{100, 97, 95, 94, 93, 92},
	}
	
	json.NewEncoder(w).Encode(map[string]interface{}{
		"tenant_id":        tenantID,
		"retention_matrix": retentionMatrix,
		"cohort_labels":    []string{"Q1 2024", "Q2 2024", "Q3 2024"},
		"period_labels":    []string{"Month 0", "Month 1", "Month 2", "Month 3", "Month 4", "Month 5"},
	})
}

// Regulatory Report Handlers
func (s *AnalyticsService) GenerateCBNReturn(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TenantID     string `json:"tenant_id"`
		ReturnType   string `json:"return_type"`
		ReportPeriod string `json:"report_period"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	
	cbnReturn := CBNReturn{
		ReturnType:     req.ReturnType,
		ReportPeriod:   req.ReportPeriod,
		TenantID:       req.TenantID,
		TenantName:     "Sample MFB",
		SubmissionDate: time.Now(),
		Status:         "GENERATED",
		Data: map[string]interface{}{
			"agricultural_portfolio": map[string]interface{}{
				"total_loans":       500,
				"total_outstanding": 1800000000,
				"npl_ratio":         5.0,
				"by_sector":         map[string]float64{"AGR001": 700000000, "AGR002": 550000000, "AGR003": 350000000},
			},
		},
	}
	
	json.NewEncoder(w).Encode(cbnReturn)
}

func (s *AnalyticsService) ListCBNReturns(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	
	returns := []CBNReturn{
		{ReturnType: "AGRICULTURAL_CREDIT", ReportPeriod: "2024-12", TenantID: tenantID, Status: "SUBMITTED", SubmissionDate: time.Now().AddDate(0, 0, -5)},
		{ReturnType: "AGRICULTURAL_CREDIT", ReportPeriod: "2024-11", TenantID: tenantID, Status: "ACKNOWLEDGED", SubmissionDate: time.Now().AddDate(0, -1, -5)},
	}
	
	json.NewEncoder(w).Encode(returns)
}

func (s *AnalyticsService) GenerateDFIReport(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TenantID     string `json:"tenant_id"`
		DFIName      string `json:"dfi_name"`
		ReportType   string `json:"report_type"`
		ReportPeriod string `json:"report_period"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	
	report := DFIReport{
		ReportType:   req.ReportType,
		DFIName:      req.DFIName,
		ReportPeriod: req.ReportPeriod,
		TenantID:     req.TenantID,
		Data: map[string]interface{}{
			"disbursements":    500000000,
			"farmers_reached":  150,
			"female_farmers":   45,
			"youth_farmers":    60,
			"yield_improvement": 25.0,
		},
	}
	
	json.NewEncoder(w).Encode(report)
}

func (s *AnalyticsService) ListDFIReports(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	
	reports := []DFIReport{
		{ReportType: "QUARTERLY", DFIName: "NIRSAL", ReportPeriod: "2024-Q4", TenantID: tenantID},
		{ReportType: "QUARTERLY", DFIName: "AfDB", ReportPeriod: "2024-Q4", TenantID: tenantID},
	}
	
	json.NewEncoder(w).Encode(reports)
}

func (s *AnalyticsService) GenerateBoardPack(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TenantID     string `json:"tenant_id"`
		ReportPeriod string `json:"report_period"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	
	boardPack := BoardPack{
		ReportPeriod: req.ReportPeriod,
		TenantID:     req.TenantID,
		ExecutiveSummary: "Agricultural portfolio continues strong performance with 5% NPL ratio and 95% repayment rate. Total disbursements reached N2.5B across 500 loans to 450 farmers.",
		PortfolioOverview: PortfolioSummary{
			TotalLoans:       500,
			TotalDisbursed:   2500000000,
			TotalOutstanding: 1800000000,
			NPLRatio:         5.0,
			RepaymentRate:    95.0,
		},
		KeyMetrics: map[string]interface{}{
			"disbursement_growth":  15.0,
			"farmer_growth":        20.0,
			"yield_improvement":    25.0,
			"insurance_penetration": 45.0,
		},
		RiskHighlights: []string{
			"Weather risk elevated in Benue State due to flooding",
			"Concentration risk in rice portfolio (40% of total)",
			"5 loans flagged for early warning indicators",
		},
		Recommendations: []string{
			"Increase geographic diversification",
			"Expand insurance coverage to 60%",
			"Implement satellite monitoring for all farms",
		},
	}
	
	json.NewEncoder(w).Encode(boardPack)
}

// Export Handlers
func (s *AnalyticsService) ExportToCSV(w http.ResponseWriter, r *http.Request) {
	reportType := r.URL.Query().Get("report_type")
	
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s_%s.csv", reportType, time.Now().Format("20060102")))
	
	// Sample CSV output
	csv := "Loan ID,Farmer Name,Crop Type,Amount,Status,NPL Status\n"
	csv += "LOAN-001,John Farmer,rice,5000000,ACTIVE,PERFORMING\n"
	csv += "LOAN-002,Jane Farmer,maize,3000000,ACTIVE,PERFORMING\n"
	
	w.Write([]byte(csv))
}

func (s *AnalyticsService) ExportToExcel(w http.ResponseWriter, r *http.Request) {
	reportType := r.URL.Query().Get("report_type")
	
	// In production, this would generate actual Excel file
	result := map[string]interface{}{
		"status":      "generated",
		"report_type": reportType,
		"file_url":    fmt.Sprintf("/downloads/reports/%s_%s.xlsx", reportType, time.Now().Format("20060102")),
	}
	
	json.NewEncoder(w).Encode(result)
}

func (s *AnalyticsService) ExportToPDF(w http.ResponseWriter, r *http.Request) {
	reportType := r.URL.Query().Get("report_type")
	
	// In production, this would generate actual PDF file
	result := map[string]interface{}{
		"status":      "generated",
		"report_type": reportType,
		"file_url":    fmt.Sprintf("/downloads/reports/%s_%s.pdf", reportType, time.Now().Format("20060102")),
	}
	
	json.NewEncoder(w).Encode(result)
}

// Real-time Metrics Handlers
func (s *AnalyticsService) GetRealtimeDisbursements(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	
	result := map[string]interface{}{
		"tenant_id":            tenantID,
		"timestamp":            time.Now(),
		"today_disbursements":  25000000,
		"today_count":          5,
		"mtd_disbursements":    350000000,
		"mtd_count":            70,
		"pending_disbursements": 50000000,
		"pending_count":        10,
	}
	
	json.NewEncoder(w).Encode(result)
}

func (s *AnalyticsService) GetRealtimeCollections(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	
	result := map[string]interface{}{
		"tenant_id":         tenantID,
		"timestamp":         time.Now(),
		"today_collections": 15000000,
		"today_count":       25,
		"mtd_collections":   200000000,
		"mtd_count":         400,
		"expected_today":    20000000,
		"collection_rate":   75.0,
	}
	
	json.NewEncoder(w).Encode(result)
}

func (s *AnalyticsService) GetRealtimeAlerts(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenant_id")
	
	alerts := []map[string]interface{}{
		{"alert_id": "ALERT-001", "type": "PAYMENT_DUE", "severity": "HIGH", "message": "5 loans due today", "count": 5},
		{"alert_id": "ALERT-002", "type": "NDVI_DROP", "severity": "MEDIUM", "message": "NDVI anomaly detected on 3 farms", "count": 3},
		{"alert_id": "ALERT-003", "type": "WEATHER", "severity": "LOW", "message": "Heavy rainfall forecast in Kano", "count": 1},
	}
	
	json.NewEncoder(w).Encode(map[string]interface{}{
		"tenant_id": tenantID,
		"timestamp": time.Now(),
		"alerts":    alerts,
	})
}
