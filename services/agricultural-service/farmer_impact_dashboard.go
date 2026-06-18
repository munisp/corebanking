package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gorilla/mux"
)

// ============================================================================
// FARMER-VISIBLE IMPACT DASHBOARDS
// Longitudinal tracking, transparent reporting, performance visualization
// ============================================================================

// FarmerImpactDashboard comprehensive farmer performance view
type FarmerImpactDashboard struct {
	FarmerID            string              `json:"farmer_id"`
	FarmerName          string              `json:"farmer_name"`
	MemberSince         time.Time           `json:"member_since"`
	TotalSeasonsFinanced int                `json:"total_seasons_financed"`
	FinancialSummary    FinancialSummary    `json:"financial_summary"`
	PerformanceMetrics  PerformanceMetrics  `json:"performance_metrics"`
	SeasonHistory       []SeasonRecord      `json:"season_history"`
	Achievements        []Achievement       `json:"achievements"`
	InsuranceHistory    []InsuranceRecord   `json:"insurance_history"`
	ImpactMetrics       DashboardFarmerImpactMetrics `json:"impact_metrics"`
	NextSeasonPlan      *NextSeasonPlan     `json:"next_season_plan,omitempty"`
	GeneratedAt         time.Time           `json:"generated_at"`
}

// FinancialSummary tracks financial performance
type FinancialSummary struct {
	TotalLoansReceived    float64 `json:"total_loans_received"`
	TotalRepaid           float64 `json:"total_repaid"`
	CurrentOutstanding    float64 `json:"current_outstanding"`
	CreditLimit           float64 `json:"credit_limit"`
	CreditUtilization     float64 `json:"credit_utilization_percent"`
	AverageInterestRate   float64 `json:"average_interest_rate"`
	TotalInterestPaid     float64 `json:"total_interest_paid"`
	TotalInsurancePremiums float64 `json:"total_insurance_premiums"`
	TotalInsurancePayouts float64 `json:"total_insurance_payouts"`
	NetBenefit            float64 `json:"net_benefit"`
}

// PerformanceMetrics tracks farmer performance
type PerformanceMetrics struct {
	RepaymentRate         float64 `json:"repayment_rate_percent"`
	OnTimeRepaymentRate   float64 `json:"on_time_repayment_rate_percent"`
	RepaymentStreak       int     `json:"repayment_streak_seasons"`
	AverageYieldImprovement float64 `json:"average_yield_improvement_percent"`
	IncomeGrowthRate      float64 `json:"income_growth_rate_percent"`
	CreditScoreTrend      string  `json:"credit_score_trend"` // improving, stable, declining
	RiskCategory          string  `json:"risk_category"` // low, medium, high
}

// SeasonRecord tracks individual season performance
type SeasonRecord struct {
	Season            string    `json:"season"`
	Year              int       `json:"year"`
	CropType          string    `json:"crop_type"`
	FarmSizeHectares  float64   `json:"farm_size_hectares"`
	LoanAmount        float64   `json:"loan_amount"`
	RepaidAmount      float64   `json:"repaid_amount"`
	RepaidOnTime      bool      `json:"repaid_on_time"`
	YieldExpected     float64   `json:"yield_expected_tonnes"`
	YieldAchieved     float64   `json:"yield_achieved_tonnes"`
	YieldVariance     float64   `json:"yield_variance_percent"`
	PricePerTonne     float64   `json:"price_per_tonne"`
	GrossIncome       float64   `json:"gross_income"`
	InputCosts        float64   `json:"input_costs"`
	NetIncome         float64   `json:"net_income"`
	InsuranceClaim    bool      `json:"insurance_claim"`
	InsurancePayout   float64   `json:"insurance_payout"`
	WeatherConditions string    `json:"weather_conditions"`
	Notes             string    `json:"notes,omitempty"`
}

// Achievement represents farmer milestones
type Achievement struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Icon        string    `json:"icon"`
	EarnedAt    time.Time `json:"earned_at"`
	Category    string    `json:"category"` // repayment, yield, loyalty, training
}

// InsuranceRecord tracks insurance history
type InsuranceRecord struct {
	PolicyID      string    `json:"policy_id"`
	Season        string    `json:"season"`
	ProductType   string    `json:"product_type"`
	CoverageAmount float64  `json:"coverage_amount"`
	PremiumPaid   float64   `json:"premium_paid"`
	SubsidyReceived float64 `json:"subsidy_received"`
	ClaimFiled    bool      `json:"claim_filed"`
	ClaimAmount   float64   `json:"claim_amount,omitempty"`
	ClaimPaid     float64   `json:"claim_paid,omitempty"`
	ClaimStatus   string    `json:"claim_status,omitempty"`
}

// DashboardFarmerImpactMetrics tracks broader impact
type DashboardFarmerImpactMetrics struct {
	JobsCreated           int     `json:"jobs_created"`
	FamilyMembersSupported int    `json:"family_members_supported"`
	LandUnderCultivation  float64 `json:"land_under_cultivation_hectares"`
	YieldImprovementTotal float64 `json:"yield_improvement_total_percent"`
	IncomeImprovementTotal float64 `json:"income_improvement_total_percent"`
	TrainingsCompleted    int     `json:"trainings_completed"`
	TechnologyAdopted     []string `json:"technology_adopted"`
	SDGContributions      []SDGContribution `json:"sdg_contributions"`
}

// SDGContribution tracks SDG alignment
type SDGContribution struct {
	SDGNumber   int     `json:"sdg_number"`
	SDGName     string  `json:"sdg_name"`
	Contribution string `json:"contribution"`
	Metric      string  `json:"metric"`
	Value       float64 `json:"value"`
}

// NextSeasonPlan shows upcoming season details
type NextSeasonPlan struct {
	Season           string   `json:"season"`
	PlannedCrop      string   `json:"planned_crop"`
	PlannedHectares  float64  `json:"planned_hectares"`
	EligibleLoanAmount float64 `json:"eligible_loan_amount"`
	RecommendedInputs []string `json:"recommended_inputs"`
	PlantingWindow   string   `json:"planting_window"`
	ExpectedYield    float64  `json:"expected_yield_tonnes"`
	ExpectedIncome   float64  `json:"expected_income"`
}

// CooperativeImpactDashboard for cooperative-level view
type CooperativeImpactDashboard struct {
	CooperativeID       string              `json:"cooperative_id"`
	CooperativeName     string              `json:"cooperative_name"`
	State               string              `json:"state"`
	LGA                 string              `json:"lga"`
	TotalMembers        int                 `json:"total_members"`
	ActiveBorrowers     int                 `json:"active_borrowers"`
	FinancialSummary    CoopFinancialSummary `json:"financial_summary"`
	PerformanceMetrics  CoopPerformanceMetrics `json:"performance_metrics"`
	MemberBreakdown     MemberBreakdown     `json:"member_breakdown"`
	SeasonalPerformance []CoopSeasonRecord  `json:"seasonal_performance"`
	ImpactMetrics       CoopImpactMetrics   `json:"impact_metrics"`
	TopPerformers       []TopPerformer      `json:"top_performers"`
	GeneratedAt         time.Time           `json:"generated_at"`
}

// CoopFinancialSummary for cooperative finances
type CoopFinancialSummary struct {
	TotalDisbursed      float64 `json:"total_disbursed"`
	TotalOutstanding    float64 `json:"total_outstanding"`
	TotalRepaid         float64 `json:"total_repaid"`
	AverageTicketSize   float64 `json:"average_ticket_size"`
	PortfolioAtRisk     float64 `json:"portfolio_at_risk_percent"`
	NPLRatio            float64 `json:"npl_ratio_percent"`
}

// CoopPerformanceMetrics for cooperative performance
type CoopPerformanceMetrics struct {
	RepaymentRate       float64 `json:"repayment_rate_percent"`
	MemberRetentionRate float64 `json:"member_retention_rate_percent"`
	AverageYieldImprovement float64 `json:"average_yield_improvement_percent"`
	InsurancePenetration float64 `json:"insurance_penetration_percent"`
}

// MemberBreakdown demographics
type MemberBreakdown struct {
	ByGender    map[string]int `json:"by_gender"`
	ByAgeGroup  map[string]int `json:"by_age_group"`
	ByCropType  map[string]int `json:"by_crop_type"`
	ByFarmSize  map[string]int `json:"by_farm_size"`
}

// CoopSeasonRecord for cooperative seasonal data
type CoopSeasonRecord struct {
	Season          string  `json:"season"`
	MembersFinanced int     `json:"members_financed"`
	TotalDisbursed  float64 `json:"total_disbursed"`
	TotalRepaid     float64 `json:"total_repaid"`
	RepaymentRate   float64 `json:"repayment_rate_percent"`
	AverageYield    float64 `json:"average_yield_tonnes_per_ha"`
	TotalProduction float64 `json:"total_production_tonnes"`
}

// CoopImpactMetrics for cooperative impact
type CoopImpactMetrics struct {
	TotalJobsCreated      int     `json:"total_jobs_created"`
	TotalFamiliesImpacted int     `json:"total_families_impacted"`
	TotalLandCultivated   float64 `json:"total_land_cultivated_hectares"`
	TotalProduction       float64 `json:"total_production_tonnes"`
	FinancialInclusionRate float64 `json:"financial_inclusion_rate_percent"`
	WomenParticipation    float64 `json:"women_participation_percent"`
	YouthParticipation    float64 `json:"youth_participation_percent"`
}

// TopPerformer for recognition
type TopPerformer struct {
	FarmerID        string  `json:"farmer_id"`
	FarmerName      string  `json:"farmer_name"`
	Category        string  `json:"category"` // repayment, yield, improvement
	Score           float64 `json:"score"`
	Achievement     string  `json:"achievement"`
}

// RegulatorReport for CBN and partner reporting
type RegulatorReport struct {
	ReportID          string    `json:"report_id"`
	ReportType        string    `json:"report_type"` // cbn_return, impact_assessment, program_report
	ReportingPeriod   string    `json:"reporting_period"`
	GeneratedAt       time.Time `json:"generated_at"`
	PortfolioSummary  RegulatorPortfolioSummary `json:"portfolio_summary"`
	SectorBreakdown   []SectorBreakdown `json:"sector_breakdown"`
	ProgramPerformance []ProgramPerformance `json:"program_performance"`
	ImpactSummary     ImpactSummary `json:"impact_summary"`
	RiskIndicators    RiskIndicators `json:"risk_indicators"`
}

// RegulatorPortfolioSummary for regulatory reporting
type RegulatorPortfolioSummary struct {
	TotalLoans          int     `json:"total_loans"`
	TotalDisbursed      float64 `json:"total_disbursed"`
	TotalOutstanding    float64 `json:"total_outstanding"`
	TotalBorrowers      int     `json:"total_borrowers"`
	AverageTicketSize   float64 `json:"average_ticket_size"`
	PerformingLoans     float64 `json:"performing_loans_percent"`
	WatchList           float64 `json:"watch_list_percent"`
	Substandard         float64 `json:"substandard_percent"`
	Doubtful            float64 `json:"doubtful_percent"`
	Lost                float64 `json:"lost_percent"`
}

// SectorBreakdown by CBN sector codes
type SectorBreakdown struct {
	SectorCode    string  `json:"sector_code"`
	SectorName    string  `json:"sector_name"`
	LoanCount     int     `json:"loan_count"`
	TotalExposure float64 `json:"total_exposure"`
	NPLRatio      float64 `json:"npl_ratio_percent"`
}

// ProgramPerformance for intervention programs
type ProgramPerformance struct {
	ProgramCode       string  `json:"program_code"`
	ProgramName       string  `json:"program_name"`
	Beneficiaries     int     `json:"beneficiaries"`
	TotalDisbursed    float64 `json:"total_disbursed"`
	RepaymentRate     float64 `json:"repayment_rate_percent"`
	DefaultRate       float64 `json:"default_rate_percent"`
}

// ImpactSummary for development impact
type ImpactSummary struct {
	FarmersReached        int     `json:"farmers_reached"`
	WomenFarmers          int     `json:"women_farmers"`
	YouthFarmers          int     `json:"youth_farmers"`
	CooperativesSupported int     `json:"cooperatives_supported"`
	HectaresCultivated    float64 `json:"hectares_cultivated"`
	ProductionVolume      float64 `json:"production_volume_tonnes"`
	JobsCreated           int     `json:"jobs_created"`
	IncomeImprovement     float64 `json:"income_improvement_percent"`
}

// RiskIndicators for risk monitoring
type RiskIndicators struct {
	PAR30             float64 `json:"par_30_percent"`
	PAR60             float64 `json:"par_60_percent"`
	PAR90             float64 `json:"par_90_percent"`
	WriteOffRate      float64 `json:"write_off_rate_percent"`
	RecoveryRate      float64 `json:"recovery_rate_percent"`
	ConcentrationRisk float64 `json:"concentration_risk_percent"`
}

// HTTP Handlers for Farmer Impact Dashboard

func handleGetFarmerDashboard(w http.ResponseWriter, r *http.Request) {
	farmerID := r.URL.Query().Get("farmer_id")
	if farmerID == "" {
		http.Error(w, "farmer_id is required", http.StatusBadRequest)
		return
	}
	
	// Mock farmer dashboard - in production, this would query the database
	dashboard := FarmerImpactDashboard{
		FarmerID:            farmerID,
		FarmerName:          "Adamu Ibrahim",
		MemberSince:         time.Date(2022, 1, 15, 0, 0, 0, 0, time.UTC),
		TotalSeasonsFinanced: 6,
		FinancialSummary: FinancialSummary{
			TotalLoansReceived:    1200000,
			TotalRepaid:           1050000,
			CurrentOutstanding:    150000,
			CreditLimit:           500000,
			CreditUtilization:     30,
			AverageInterestRate:   16.5,
			TotalInterestPaid:     85000,
			TotalInsurancePremiums: 24000,
			TotalInsurancePayouts: 45000,
			NetBenefit:            21000,
		},
		PerformanceMetrics: PerformanceMetrics{
			RepaymentRate:           100,
			OnTimeRepaymentRate:     83.3,
			RepaymentStreak:         5,
			AverageYieldImprovement: 32,
			IncomeGrowthRate:        45,
			CreditScoreTrend:        "improving",
			RiskCategory:            "low",
		},
		SeasonHistory: []SeasonRecord{
			{
				Season:           "2024-wet",
				Year:             2024,
				CropType:         "Maize",
				FarmSizeHectares: 3.5,
				LoanAmount:       200000,
				RepaidAmount:     200000,
				RepaidOnTime:     true,
				YieldExpected:    4.0,
				YieldAchieved:    4.5,
				YieldVariance:    12.5,
				PricePerTonne:    180000,
				GrossIncome:      810000,
				InputCosts:       200000,
				NetIncome:        610000,
				InsuranceClaim:   false,
				WeatherConditions: "Good rainfall",
			},
			{
				Season:           "2024-dry",
				Year:             2024,
				CropType:         "Rice",
				FarmSizeHectares: 2.0,
				LoanAmount:       150000,
				RepaidAmount:     150000,
				RepaidOnTime:     true,
				YieldExpected:    3.5,
				YieldAchieved:    3.2,
				YieldVariance:    -8.6,
				PricePerTonne:    250000,
				GrossIncome:      800000,
				InputCosts:       180000,
				NetIncome:        620000,
				InsuranceClaim:   false,
				WeatherConditions: "Adequate irrigation",
			},
		},
		Achievements: []Achievement{
			{
				ID:          "ACH-001",
				Title:       "Perfect Repayment",
				Description: "5 consecutive seasons of on-time repayment",
				Icon:        "star",
				EarnedAt:    time.Date(2024, 10, 1, 0, 0, 0, 0, time.UTC),
				Category:    "repayment",
			},
			{
				ID:          "ACH-002",
				Title:       "Yield Champion",
				Description: "Exceeded expected yield by 20%+",
				Icon:        "trophy",
				EarnedAt:    time.Date(2024, 9, 15, 0, 0, 0, 0, time.UTC),
				Category:    "yield",
			},
			{
				ID:          "ACH-003",
				Title:       "Loyal Farmer",
				Description: "3 years with 54Bank Agriculture",
				Icon:        "heart",
				EarnedAt:    time.Date(2025, 1, 15, 0, 0, 0, 0, time.UTC),
				Category:    "loyalty",
			},
		},
		InsuranceHistory: []InsuranceRecord{
			{
				PolicyID:       "POL-2024-001",
				Season:         "2024-wet",
				ProductType:    "weather_index",
				CoverageAmount: 200000,
				PremiumPaid:    6000,
				SubsidyReceived: 3000,
				ClaimFiled:     false,
			},
			{
				PolicyID:       "POL-2023-002",
				Season:         "2023-wet",
				ProductType:    "weather_index",
				CoverageAmount: 150000,
				PremiumPaid:    4500,
				SubsidyReceived: 2250,
				ClaimFiled:     true,
				ClaimAmount:    75000,
				ClaimPaid:      75000,
				ClaimStatus:    "paid",
			},
		},
		ImpactMetrics: DashboardFarmerImpactMetrics{
			JobsCreated:           3,
			FamilyMembersSupported: 8,
			LandUnderCultivation:  5.5,
			YieldImprovementTotal: 32,
			IncomeImprovementTotal: 45,
			TrainingsCompleted:    4,
			TechnologyAdopted:     []string{"Improved seeds", "Soil testing", "Mobile banking"},
			SDGContributions: []SDGContribution{
				{SDGNumber: 1, SDGName: "No Poverty", Contribution: "Income increased by 45%", Metric: "income_growth", Value: 45},
				{SDGNumber: 2, SDGName: "Zero Hunger", Contribution: "Food production increased", Metric: "yield_improvement", Value: 32},
				{SDGNumber: 8, SDGName: "Decent Work", Contribution: "Created 3 farm jobs", Metric: "jobs_created", Value: 3},
			},
		},
		NextSeasonPlan: &NextSeasonPlan{
			Season:             "2025-wet",
			PlannedCrop:        "Maize",
			PlannedHectares:    4.0,
			EligibleLoanAmount: 250000,
			RecommendedInputs:  []string{"NPK 15-15-15", "Improved maize seeds", "Herbicides"},
			PlantingWindow:     "May 15 - June 30",
			ExpectedYield:      5.0,
			ExpectedIncome:     900000,
		},
		GeneratedAt: time.Now(),
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"dashboard": dashboard,
		"message":   "Farmer impact dashboard generated successfully",
	})
}

func handleGetCooperativeDashboard(w http.ResponseWriter, r *http.Request) {
	coopID := r.URL.Query().Get("cooperative_id")
	if coopID == "" {
		http.Error(w, "cooperative_id is required", http.StatusBadRequest)
		return
	}
	
	// Mock cooperative dashboard
	dashboard := CooperativeImpactDashboard{
		CooperativeID:   coopID,
		CooperativeName: "Zaria Farmers Cooperative",
		State:           "Kaduna",
		LGA:             "Zaria",
		TotalMembers:    250,
		ActiveBorrowers: 180,
		FinancialSummary: CoopFinancialSummary{
			TotalDisbursed:    45000000,
			TotalOutstanding:  12000000,
			TotalRepaid:       33000000,
			AverageTicketSize: 250000,
			PortfolioAtRisk:   5.8,
			NPLRatio:          3.2,
		},
		PerformanceMetrics: CoopPerformanceMetrics{
			RepaymentRate:           94.5,
			MemberRetentionRate:     92,
			AverageYieldImprovement: 28,
			InsurancePenetration:    68,
		},
		MemberBreakdown: MemberBreakdown{
			ByGender:   map[string]int{"male": 165, "female": 85},
			ByAgeGroup: map[string]int{"18-30": 45, "31-45": 120, "46-60": 70, "60+": 15},
			ByCropType: map[string]int{"maize": 100, "rice": 80, "sorghum": 40, "cassava": 30},
			ByFarmSize: map[string]int{"0-2ha": 80, "2-5ha": 120, "5-10ha": 40, "10+ha": 10},
		},
		SeasonalPerformance: []CoopSeasonRecord{
			{
				Season:          "2024-wet",
				MembersFinanced: 180,
				TotalDisbursed:  36000000,
				TotalRepaid:     34200000,
				RepaymentRate:   95,
				AverageYield:    4.2,
				TotalProduction: 2520,
			},
			{
				Season:          "2024-dry",
				MembersFinanced: 120,
				TotalDisbursed:  24000000,
				TotalRepaid:     22800000,
				RepaymentRate:   95,
				AverageYield:    3.8,
				TotalProduction: 1520,
			},
		},
		ImpactMetrics: CoopImpactMetrics{
			TotalJobsCreated:       450,
			TotalFamiliesImpacted:  1500,
			TotalLandCultivated:    750,
			TotalProduction:        4040,
			FinancialInclusionRate: 72,
			WomenParticipation:     34,
			YouthParticipation:     18,
		},
		TopPerformers: []TopPerformer{
			{FarmerID: "FRM-001", FarmerName: "Adamu Ibrahim", Category: "repayment", Score: 100, Achievement: "Perfect repayment 5 seasons"},
			{FarmerID: "FRM-045", FarmerName: "Fatima Yusuf", Category: "yield", Score: 95, Achievement: "Highest yield improvement"},
			{FarmerID: "FRM-089", FarmerName: "Musa Abdullahi", Category: "improvement", Score: 92, Achievement: "Most improved farmer"},
		},
		GeneratedAt: time.Now(),
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"dashboard": dashboard,
		"message":   "Cooperative impact dashboard generated successfully",
	})
}

func handleGenerateRegulatorReport(w http.ResponseWriter, r *http.Request) {
	reportType := r.URL.Query().Get("type")
	period := r.URL.Query().Get("period")
	
	if reportType == "" {
		reportType = "cbn_return"
	}
	if period == "" {
		period = "Q4-2024"
	}
	
	report := RegulatorReport{
		ReportID:        fmt.Sprintf("RPT-%s-%d", reportType, time.Now().UnixNano()%100000),
		ReportType:      reportType,
		ReportingPeriod: period,
		GeneratedAt:     time.Now(),
		PortfolioSummary: RegulatorPortfolioSummary{
			TotalLoans:        1250,
			TotalDisbursed:    5500000000,
			TotalOutstanding:  3200000000,
			TotalBorrowers:    25000,
			AverageTicketSize: 220000,
			PerformingLoans:   91.5,
			WatchList:         5.3,
			Substandard:       2.0,
			Doubtful:          0.8,
			Lost:              0.4,
		},
		SectorBreakdown: []SectorBreakdown{
			{SectorCode: "AGR001", SectorName: "Crop Production - Cereals", LoanCount: 450, TotalExposure: 2000000000, NPLRatio: 2.8},
			{SectorCode: "AGR002", SectorName: "Crop Production - Tubers", LoanCount: 280, TotalExposure: 1200000000, NPLRatio: 2.1},
			{SectorCode: "AGR003", SectorName: "Crop Production - Legumes", LoanCount: 200, TotalExposure: 800000000, NPLRatio: 3.5},
			{SectorCode: "LVS001", SectorName: "Livestock - Poultry", LoanCount: 150, TotalExposure: 600000000, NPLRatio: 4.2},
			{SectorCode: "AGP001", SectorName: "Agro-Processing", LoanCount: 170, TotalExposure: 1100000000, NPLRatio: 3.0},
		},
		ProgramPerformance: []ProgramPerformance{
			{ProgramCode: "ABP", ProgramName: "Anchor Borrowers Programme", Beneficiaries: 15000, TotalDisbursed: 3000000000, RepaymentRate: 94.5, DefaultRate: 2.8},
			{ProgramCode: "AGSMEIS", ProgramName: "AGSMEIS", Beneficiaries: 500, TotalDisbursed: 1500000000, RepaymentRate: 92.0, DefaultRate: 4.5},
			{ProgramCode: "ACGSF", ProgramName: "ACGSF Guaranteed", Beneficiaries: 9500, TotalDisbursed: 1000000000, RepaymentRate: 96.0, DefaultRate: 2.0},
		},
		ImpactSummary: ImpactSummary{
			FarmersReached:        25000,
			WomenFarmers:          8500,
			YouthFarmers:          4500,
			CooperativesSupported: 450,
			HectaresCultivated:    125000,
			ProductionVolume:      500000,
			JobsCreated:           75000,
			IncomeImprovement:     32,
		},
		RiskIndicators: RiskIndicators{
			PAR30:             5.8,
			PAR60:             3.2,
			PAR90:             2.1,
			WriteOffRate:      0.4,
			RecoveryRate:      65,
			ConcentrationRisk: 18,
		},
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"report":  report,
		"message": "Regulator report generated successfully",
		"export_formats": []string{"pdf", "excel", "json", "xml"},
	})
}

func handleGetFarmerAchievements(w http.ResponseWriter, r *http.Request) {
	farmerID := r.URL.Query().Get("farmer_id")
	if farmerID == "" {
		http.Error(w, "farmer_id is required", http.StatusBadRequest)
		return
	}
	
	achievements := []Achievement{
		{ID: "ACH-001", Title: "First Loan", Description: "Received first agricultural loan", Icon: "seedling", EarnedAt: time.Date(2022, 1, 15, 0, 0, 0, 0, time.UTC), Category: "milestone"},
		{ID: "ACH-002", Title: "On-Time Repayer", Description: "First on-time repayment", Icon: "clock", EarnedAt: time.Date(2022, 9, 30, 0, 0, 0, 0, time.UTC), Category: "repayment"},
		{ID: "ACH-003", Title: "Yield Improver", Description: "Improved yield by 10%+", Icon: "chart-up", EarnedAt: time.Date(2023, 10, 1, 0, 0, 0, 0, time.UTC), Category: "yield"},
		{ID: "ACH-004", Title: "Insurance Smart", Description: "First insurance policy", Icon: "shield", EarnedAt: time.Date(2023, 5, 1, 0, 0, 0, 0, time.UTC), Category: "insurance"},
		{ID: "ACH-005", Title: "Perfect Streak", Description: "5 consecutive on-time repayments", Icon: "star", EarnedAt: time.Date(2024, 10, 1, 0, 0, 0, 0, time.UTC), Category: "repayment"},
		{ID: "ACH-006", Title: "Training Graduate", Description: "Completed financial literacy training", Icon: "graduation", EarnedAt: time.Date(2023, 3, 15, 0, 0, 0, 0, time.UTC), Category: "training"},
	}
	
	// Calculate next achievements
	nextAchievements := []map[string]interface{}{
		{"title": "Yield Champion", "description": "Exceed expected yield by 20%+", "progress": 60, "remaining": "8% more yield improvement needed"},
		{"title": "Decade Farmer", "description": "10 seasons with 54Bank", "progress": 60, "remaining": "4 more seasons"},
		{"title": "Credit Elite", "description": "Reach N1M credit limit", "progress": 50, "remaining": "N500,000 more to unlock"},
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"farmer_id":         farmerID,
		"achievements":      achievements,
		"total_earned":      len(achievements),
		"next_achievements": nextAchievements,
	})
}

func handleGetImpactCertificate(w http.ResponseWriter, r *http.Request) {
	farmerID := r.URL.Query().Get("farmer_id")
	if farmerID == "" {
		http.Error(w, "farmer_id is required", http.StatusBadRequest)
		return
	}
	
	certificate := map[string]interface{}{
		"certificate_id":   fmt.Sprintf("CERT-%d", time.Now().UnixNano()%100000),
		"farmer_id":        farmerID,
		"farmer_name":      "Adamu Ibrahim",
		"issued_date":      time.Now().Format("2006-01-02"),
		"valid_until":      time.Now().AddDate(1, 0, 0).Format("2006-01-02"),
		"title":            "Certified Sustainable Farmer",
		"achievements": []string{
			"6 seasons of successful farming with 54Bank",
			"100% loan repayment rate",
			"32% yield improvement achieved",
			"3 jobs created in local community",
			"Adopted sustainable farming practices",
		},
		"sdg_contributions": []string{
			"SDG 1: Poverty Reduction - 45% income improvement",
			"SDG 2: Zero Hunger - 32% yield improvement",
			"SDG 8: Decent Work - 3 jobs created",
		},
		"qr_code":     "https://54bank.com/verify/CERT-12345",
		"shareable":   true,
		"share_text":  "I'm a Certified Sustainable Farmer with 54Bank! 6 seasons, 100% repayment, 32% yield improvement. #54BankAgriculture #SustainableFarming",
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"certificate": certificate,
		"message":     "Impact certificate generated successfully",
	})
}

// RegisterFarmerImpactDashboardRoutes registers all farmer impact dashboard routes
func RegisterFarmerImpactDashboardRoutes(r *mux.Router) {
	r.HandleFunc("/api/v1/agriculture/dashboard/farmer", handleGetFarmerDashboard).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/dashboard/cooperative", handleGetCooperativeDashboard).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/reports/regulator", handleGenerateRegulatorReport).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/achievements", handleGetFarmerAchievements).Methods("GET")
	r.HandleFunc("/api/v1/agriculture/certificate", handleGetImpactCertificate).Methods("GET")
}
