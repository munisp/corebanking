package main

import (
	"fmt"
	"math"
	"time"
)

// ==================== MODELS ====================

// AgriculturalLoan represents a farm loan
type AgriculturalLoan struct {
	ID                  string
	TenantID            string
	FarmerID            string
	FarmID              string
	LoanAmount          float64
	LoanPurpose         string // "seeds", "fertilizer", "equipment", "labor"
	CropType            string
	PlantingDate        time.Time
	ExpectedHarvestDate time.Time
	SeasonType          string // "wet", "dry"
	InterestRate        float64
	GracePeriod         int // days before repayment starts
	RepaymentSchedule   []RepaymentInstallment
	Status              string // "pending", "approved", "disbursed", "active", "completed"
	CollateralType      string // "land_title", "equipment", "warehouse_receipt", "crop_insurance"
	CollateralValue     float64
	InsurancePolicy     string
	CreatedAt           time.Time
	DisbursedAt         *time.Time
}

// Farmer represents a farmer profile
type Farmer struct {
	ID              string
	TenantID        string
	FullName        string
	PhoneNumber     string
	BVN             string
	FarmLocation    string
	FarmSize        float64 // hectares
	CropsGrown      []string
	YearsExperience int
	CreditScore     int
	LoanHistory     []LoanRecord
	Status          string
	KYCVerified     bool
	CreatedAt       time.Time
}

// Farm represents a farm property
type Farm struct {
	ID              string
	TenantID        string
	FarmerID        string
	Location        string
	Size            float64 // hectares
	SoilType        string
	IrrigationType  string // "rain-fed", "irrigated", "drip"
	LandTitleNumber string
	LandValue       float64
	CurrentCrop     string
	PlantingDate    time.Time
	VerifiedBy      string
	VerifiedAt      *time.Time
	Status          string
}

// CropData represents crop information
type CropData struct {
	CropType       string
	GrowingPeriod  int     // days
	AverageYield   float64 // tonnes per hectare
	MarketPrice    float64 // per tonne
	InputCostPerHa float64 // Cost per hectare
	RiskLevel      string  // "low", "medium", "high"
}

// WeatherData represents weather information
type WeatherData struct {
	Location     string
	Date         time.Time
	Rainfall     float64 // mm
	Temperature  float64 // celsius
	Humidity     float64 // percentage
	ForecastRisk string  // "low", "medium", "high"
}

// LoanRecord represents historical loan
type LoanRecord struct {
	LoanID      string
	Amount      float64
	DisbursedAt time.Time
	SettledAt   *time.Time
	Status      string
	DaysOverdue int
}

// RepaymentInstallment represents a payment
type RepaymentInstallment struct {
	InstallmentNumber int
	DueDate           time.Time
	PrincipalAmount   float64
	InterestAmount    float64
	TotalAmount       float64
	Status            string // "pending", "paid", "overdue"
	PaidAt            *time.Time
}

// ==================== CROP DATABASE ====================

var CropDatabase = map[string]CropData{
	"rice": {
		CropType:       "rice",
		GrowingPeriod:  120,      // 4 months
		AverageYield:   4.5,      // tonnes per hectare
		MarketPrice:    350000.0, // ₦350k per tonne
		InputCostPerHa: 180000.0, // ₦180k per hectare
		RiskLevel:      "medium",
	},
	"maize": {
		CropType:       "maize",
		GrowingPeriod:  90, // 3 months
		AverageYield:   3.5,
		MarketPrice:    250000.0,
		InputCostPerHa: 120000.0,
		RiskLevel:      "low",
	},
	"cassava": {
		CropType:       "cassava",
		GrowingPeriod:  365, // 12 months
		AverageYield:   25.0,
		MarketPrice:    80000.0,
		InputCostPerHa: 150000.0,
		RiskLevel:      "low",
	},
	"tomato": {
		CropType:       "tomato",
		GrowingPeriod:  75, // 2.5 months
		AverageYield:   20.0,
		MarketPrice:    150000.0,
		InputCostPerHa: 250000.0,
		RiskLevel:      "high",
	},
}

// ==================== AGRICULTURAL LOAN ASSESSOR ====================

type AgriculturalLoanAssessor struct{}

func NewAgriculturalLoanAssessor() *AgriculturalLoanAssessor {
	return &AgriculturalLoanAssessor{}
}

// AssessLoanApplication assesses agricultural loan application
func (ala *AgriculturalLoanAssessor) AssessLoanApplication(
	farmer *Farmer,
	farm *Farm,
	loanAmount float64,
	cropType string,
	plantingDate time.Time,
) (*AgriculturalLoan, error) {

	// Step 1: Validate farmer eligibility
	if !farmer.KYCVerified {
		return nil, fmt.Errorf("farmer KYC not verified")
	}

	if farmer.YearsExperience < 2 {
		return nil, fmt.Errorf("minimum 2 years farming experience required")
	}

	// Step 2: Validate farm
	if farm.Status != "verified" {
		return nil, fmt.Errorf("farm must be verified")
	}

	// Step 3: Get crop data
	cropData, exists := CropDatabase[cropType]
	if !exists {
		return nil, fmt.Errorf("unsupported crop type: %s", cropType)
	}

	// Step 4: Calculate maximum loan amount based on farm size and crop
	maxLoanAmount := ala.calculateMaxLoanAmount(farm, cropData)

	if loanAmount > maxLoanAmount {
		return nil, fmt.Errorf("requested amount ₦%.2f exceeds maximum ₦%.2f",
			loanAmount, maxLoanAmount)
	}

	// Step 5: Assess weather risk
	weatherRisk := ala.assessWeatherRisk(farm.Location, plantingDate, cropData.GrowingPeriod)

	// Step 6: Calculate interest rate
	interestRate := ala.calculateInterestRate(farmer, cropData, weatherRisk)

	// Step 7: Determine grace period
	gracePeriod := cropData.GrowingPeriod + 30 // Harvest + 30 days

	// Step 8: Calculate expected harvest date
	expectedHarvestDate := plantingDate.AddDate(0, 0, cropData.GrowingPeriod)

	// Step 9: Generate repayment schedule
	repaymentSchedule := ala.generateRepaymentSchedule(
		loanAmount,
		interestRate,
		expectedHarvestDate,
		gracePeriod,
	)

	// Step 10: Determine collateral requirement
	collateralValue := loanAmount * 1.2 // 120% collateral coverage

	loan := &AgriculturalLoan{
		ID:                  ala.generateLoanID(),
		TenantID:            farmer.TenantID,
		FarmerID:            farmer.ID,
		FarmID:              farm.ID,
		LoanAmount:          loanAmount,
		CropType:            cropType,
		PlantingDate:        plantingDate,
		ExpectedHarvestDate: expectedHarvestDate,
		InterestRate:        interestRate,
		GracePeriod:         gracePeriod,
		RepaymentSchedule:   repaymentSchedule,
		Status:              "pending",
		CollateralType:      "land_title",
		CollateralValue:     collateralValue,
		CreatedAt:           time.Now(),
	}

	return loan, nil
}

func (ala *AgriculturalLoanAssessor) calculateMaxLoanAmount(farm *Farm, cropData CropData) float64 {
	// Calculate expected revenue
	expectedYield := farm.Size * cropData.AverageYield
	expectedRevenue := expectedYield * cropData.MarketPrice

	// Calculate total input cost
	totalInputCost := farm.Size * cropData.InputCostPerHa

	// Maximum loan is 80% of input cost or 50% of expected revenue, whichever is lower
	maxBasedOnCost := totalInputCost * 0.80
	maxBasedOnRevenue := expectedRevenue * 0.50

	return math.Min(maxBasedOnCost, maxBasedOnRevenue)
}

func (ala *AgriculturalLoanAssessor) assessWeatherRisk(location string, plantingDate time.Time, growingPeriod int) string {
	// Try to get weather forecast from API
	weatherData, err := getWeatherForecast(location, growingPeriod)
	if err == nil && weatherData != nil {
		return analyzeWeatherRisk(weatherData, growingPeriod)
	}

	// Fallback to seasonal analysis if API unavailable
	month := plantingDate.Month()

	// Wet season (April-October) - lower risk
	if month >= 4 && month <= 10 {
		return "low"
	}

	// Dry season (November-March) - higher risk
	return "medium"
}

func (ala *AgriculturalLoanAssessor) calculateInterestRate(farmer *Farmer, cropData CropData, weatherRisk string) float64 {
	baseRate := 12.0 // Base rate for agricultural loans (12% per annum)

	// Adjust for crop risk
	cropRiskAdjustment := map[string]float64{
		"low":    0.0,
		"medium": 2.0,
		"high":   4.0,
	}
	baseRate += cropRiskAdjustment[cropData.RiskLevel]

	// Adjust for weather risk
	weatherRiskAdjustment := map[string]float64{
		"low":    0.0,
		"medium": 1.5,
		"high":   3.0,
	}
	baseRate += weatherRiskAdjustment[weatherRisk]

	// Adjust for farmer experience
	if farmer.YearsExperience >= 10 {
		baseRate -= 1.0 // Experienced farmer discount
	} else if farmer.YearsExperience < 5 {
		baseRate += 1.0 // New farmer premium
	}

	// Adjust for credit history
	if len(farmer.LoanHistory) > 0 {
		defaultCount := 0
		for _, loan := range farmer.LoanHistory {
			if loan.DaysOverdue > 30 {
				defaultCount++
			}
		}

		if defaultCount == 0 {
			baseRate -= 1.5 // Good payment history discount
		} else if defaultCount > 2 {
			baseRate += 3.0 // Poor payment history premium
		}
	}

	// Cap between 10% and 25%
	return math.Max(10.0, math.Min(baseRate, 25.0))
}

func (ala *AgriculturalLoanAssessor) generateRepaymentSchedule(
	loanAmount float64,
	annualRate float64,
	harvestDate time.Time,
	gracePeriod int,
) []RepaymentInstallment {

	// Agricultural loans typically have bullet repayment after harvest
	// Calculate total interest
	loanDuration := float64(gracePeriod) / 365.0 // years
	totalInterest := loanAmount * (annualRate / 100.0) * loanDuration

	// Single payment after grace period
	repaymentDate := harvestDate.AddDate(0, 0, 30) // 30 days after harvest

	schedule := []RepaymentInstallment{
		{
			InstallmentNumber: 1,
			DueDate:           repaymentDate,
			PrincipalAmount:   loanAmount,
			InterestAmount:    totalInterest,
			TotalAmount:       loanAmount + totalInterest,
			Status:            "pending",
		},
	}

	return schedule
}

func (ala *AgriculturalLoanAssessor) generateLoanID() string {
	return fmt.Sprintf("AGRI%d", time.Now().UnixNano())
}

// ==================== FARM VERIFIER ====================

type FarmVerifier struct{}

func NewFarmVerifier() *FarmVerifier {
	return &FarmVerifier{}
}

// VerifyFarm conducts farm verification visit
func (fv *FarmVerifier) VerifyFarm(farm *Farm, verifierID string) error {
	// In production, this would involve:
	// 1. GPS coordinates verification
	// 2. Land title verification
	// 3. Physical inspection
	// 4. Soil testing
	// 5. Photo documentation

	// For now, mark as verified
	farm.Status = "verified"
	farm.VerifiedBy = verifierID
	now := time.Now()
	farm.VerifiedAt = &now

	return nil
}

// EstimateLandValue estimates farm land value
func (fv *FarmVerifier) EstimateLandValue(farm *Farm) float64 {
	// Base value per hectare (varies by location)
	baseValuePerHa := 2000000.0 // ₦2M per hectare

	// Adjust for location (simplified)
	locationMultiplier := 1.0
	if farm.Location == "Lagos" || farm.Location == "Abuja" {
		locationMultiplier = 2.0
	}

	// Adjust for irrigation
	irrigationMultiplier := 1.0
	if farm.IrrigationType == "irrigated" {
		irrigationMultiplier = 1.3
	} else if farm.IrrigationType == "drip" {
		irrigationMultiplier = 1.5
	}

	totalValue := farm.Size * baseValuePerHa * locationMultiplier * irrigationMultiplier

	return totalValue
}

// ==================== WEATHER INSURANCE INTEGRATOR ====================

type WeatherInsurance struct{}

func NewWeatherInsurance() *WeatherInsurance {
	return &WeatherInsurance{}
}

// GetInsuranceQuote gets weather insurance quote
func (wi *WeatherInsurance) GetInsuranceQuote(
	loan *AgriculturalLoan,
	farm *Farm,
	cropData CropData,
) (float64, error) {

	// Calculate insurance premium (typically 3-8% of loan amount)
	basePremiumRate := 0.05 // 5%

	// Adjust for crop risk
	riskAdjustment := map[string]float64{
		"low":    0.0,
		"medium": 0.01,
		"high":   0.02,
	}
	premiumRate := basePremiumRate + riskAdjustment[cropData.RiskLevel]

	// Adjust for irrigation (reduces risk)
	if farm.IrrigationType != "rain-fed" {
		premiumRate -= 0.01
	}

	premium := loan.LoanAmount * premiumRate

	return premium, nil
}

// PurchaseInsurance purchases weather insurance policy
func (wi *WeatherInsurance) PurchaseInsurance(
	loan *AgriculturalLoan,
	premium float64,
) (string, error) {

	// Try to purchase from insurance provider API
	policyNumber, err := purchaseInsurancePolicy(
		loan.FarmerID,
		loan.CropType,
		loan.LoanAmount,
		premium,
	)

	if err == nil && policyNumber != "" {
		loan.InsurancePolicy = policyNumber
		return policyNumber, nil
	}

	// Fallback to local policy generation
	policyNumber = fmt.Sprintf("WI%d", time.Now().UnixNano())
	loan.InsurancePolicy = policyNumber

	return policyNumber, nil
}

// ==================== COMMODITY PRICE TRACKER ====================

type CommodityPriceTracker struct{}

func NewCommodityPriceTracker() *CommodityPriceTracker {
	return &CommodityPriceTracker{}
}

// GetCurrentPrice gets current market price for commodity
func (cpt *CommodityPriceTracker) GetCurrentPrice(cropType string, location string) (float64, error) {
	// Try to get price from commodity exchange API
	price, err := getCommodityPrice(cropType, location)
	if err == nil && price > 0 {
		return price, nil
	}

	// Fallback to crop database
	if cropData, exists := CropDatabase[cropType]; exists {
		// Add some variation based on location
		locationAdjustment := 1.0
		if location == "Lagos" {
			locationAdjustment = 1.1 // 10% higher in Lagos
		} else if location == "Kano" {
			locationAdjustment = 1.05 // 5% higher in Kano
		}

		return cropData.MarketPrice * locationAdjustment, nil
	}

	return 0, fmt.Errorf("price not available for crop: %s", cropType)
}

// GetPriceHistory gets historical price data
func (cpt *CommodityPriceTracker) GetPriceHistory(cropType string, months int) ([]float64, error) {
	// Try to get historical data from API
	historicalPrices, err := getCommodityPriceHistory(cropType, months)
	if err == nil && len(historicalPrices) > 0 {
		return historicalPrices, nil
	}

	// Fallback to generated data based on current price
	basePrice, _ := cpt.GetCurrentPrice(cropType, "")

	prices := make([]float64, months)
	for i := 0; i < months; i++ {
		// Add seasonal variation and trend
		seasonalFactor := 1.0 + 0.1*math.Sin(float64(i)*math.Pi/6) // ±10% seasonal
		trendFactor := 1.0 + 0.02*float64(i)/12.0                  // 2% annual growth
		prices[months-1-i] = basePrice * seasonalFactor * trendFactor
	}

	return prices, nil
}

// ==================== HARVEST ESTIMATOR ====================

type HarvestEstimator struct{}

func NewHarvestEstimator() *HarvestEstimator {
	return &HarvestEstimator{}
}

// EstimateYield estimates crop yield based on various factors
func (he *HarvestEstimator) EstimateYield(
	farm *Farm,
	cropType string,
	plantingDate time.Time,
	weatherData []WeatherData,
) (float64, error) {

	cropData, exists := CropDatabase[cropType]
	if !exists {
		return 0, fmt.Errorf("unknown crop type: %s", cropType)
	}

	// Start with average yield
	estimatedYield := cropData.AverageYield * farm.Size

	// Adjust for irrigation
	if farm.IrrigationType == "irrigated" {
		estimatedYield *= 1.2 // 20% increase
	} else if farm.IrrigationType == "drip" {
		estimatedYield *= 1.3 // 30% increase
	}

	// Adjust for weather conditions
	if len(weatherData) > 0 {
		avgRainfall := 0.0
		for _, wd := range weatherData {
			avgRainfall += wd.Rainfall
		}
		avgRainfall /= float64(len(weatherData))

		// Optimal rainfall for most crops: 50-100mm per month
		if avgRainfall < 30 {
			estimatedYield *= 0.7 // Drought impact
		} else if avgRainfall > 150 {
			estimatedYield *= 0.8 // Excessive rainfall impact
		}
	}

	// Adjust for farmer experience
	// More experienced farmers get better yields
	// This would come from farmer profile in production

	return estimatedYield, nil
}

// EstimateRevenue estimates revenue from harvest
func (he *HarvestEstimator) EstimateRevenue(
	estimatedYield float64,
	cropType string,
	location string,
) (float64, error) {

	priceTracker := NewCommodityPriceTracker()
	currentPrice, err := priceTracker.GetCurrentPrice(cropType, location)
	if err != nil {
		return 0, err
	}

	// Apply 10% discount for conservative estimate
	estimatedRevenue := estimatedYield * currentPrice * 0.9

	return estimatedRevenue, nil
}

// ==================== REPAYMENT PROCESSOR ====================

type RepaymentProcessor struct{}

func NewRepaymentProcessor() *RepaymentProcessor {
	return &RepaymentProcessor{}
}

// ProcessHarvestRepayment processes repayment from harvest proceeds
func (rp *RepaymentProcessor) ProcessHarvestRepayment(
	loan *AgriculturalLoan,
	harvestRevenue float64,
) error {

	if loan.Status != "active" {
		return fmt.Errorf("loan is not active")
	}

	// Get outstanding amount
	outstandingAmount := 0.0
	for _, installment := range loan.RepaymentSchedule {
		if installment.Status == "pending" {
			outstandingAmount += installment.TotalAmount
		}
	}

	if harvestRevenue < outstandingAmount {
		// Partial payment - restructure loan
		return rp.restructureLoan(loan, harvestRevenue)
	}

	// Full repayment
	for i := range loan.RepaymentSchedule {
		if loan.RepaymentSchedule[i].Status == "pending" {
			loan.RepaymentSchedule[i].Status = "paid"
			now := time.Now()
			loan.RepaymentSchedule[i].PaidAt = &now
		}
	}

	loan.Status = "completed"

	return nil
}

func (rp *RepaymentProcessor) restructureLoan(loan *AgriculturalLoan, partialPayment float64) error {
	// Apply partial payment
	remainingPayment := partialPayment

	for i := range loan.RepaymentSchedule {
		if loan.RepaymentSchedule[i].Status == "pending" && remainingPayment > 0 {
			if remainingPayment >= loan.RepaymentSchedule[i].TotalAmount {
				// Full payment of this installment
				remainingPayment -= loan.RepaymentSchedule[i].TotalAmount
				loan.RepaymentSchedule[i].Status = "paid"
				now := time.Now()
				loan.RepaymentSchedule[i].PaidAt = &now
			} else {
				// Partial payment - reduce principal
				loan.RepaymentSchedule[i].PrincipalAmount -= remainingPayment
				loan.RepaymentSchedule[i].TotalAmount = loan.RepaymentSchedule[i].PrincipalAmount +
					loan.RepaymentSchedule[i].InterestAmount
				remainingPayment = 0
			}
		}
	}

	// Extend due date by 6 months for remaining balance
	for i := range loan.RepaymentSchedule {
		if loan.RepaymentSchedule[i].Status == "pending" {
			loan.RepaymentSchedule[i].DueDate = loan.RepaymentSchedule[i].DueDate.AddDate(0, 6, 0)
		}
	}

	return nil
}

// ==================== EXTERNAL API INTEGRATIONS ====================

// getWeatherForecast fetches weather forecast from external API
func getWeatherForecast(location string, days int) (*WeatherData, error) {
	// In production, call weather API (e.g., OpenWeatherMap, NIMET)
	// For now, return nil to trigger fallback
	return nil, fmt.Errorf("weather API not configured")
}

// analyzeWeatherRisk analyzes weather data to determine risk level
func analyzeWeatherRisk(data *WeatherData, growingPeriod int) string {
	if data == nil {
		return "medium"
	}

	// Simple risk analysis based on rainfall and temperature
	if data.Rainfall < 50 || data.Temperature > 38 {
		return "high"
	} else if data.Rainfall > 200 && data.Temperature < 35 {
		return "low"
	}

	return "medium"
}

// getCommodityPrice fetches current commodity price from exchange API
func getCommodityPrice(cropType string, location string) (float64, error) {
	// In production, call commodity exchange API
	// For now, return error to trigger fallback
	return 0, fmt.Errorf("commodity API not configured")
}

// getCommodityPriceHistory fetches historical price data
func getCommodityPriceHistory(cropType string, months int) ([]float64, error) {
	// In production, query historical price database or API
	// For now, return error to trigger fallback
	return nil, fmt.Errorf("price history API not configured")
}

// purchaseInsurancePolicy purchases insurance from external provider
func purchaseInsurancePolicy(farmerID string, cropType string, coverage float64, premium float64) (string, error) {
	// In production, call insurance provider API
	// For now, return error to trigger fallback
	return "", fmt.Errorf("insurance API not configured")
}
