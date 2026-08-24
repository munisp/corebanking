package main

import (
	"fmt"
	"math"
	"time"
)

// ==================== MODELS ====================

// CarbonCredit represents a carbon credit unit
type CarbonCredit struct {
	ID              string
	TenantID        string
	ProjectID       string
	ProjectName     string
	CreditType      string // "VCS", "Gold Standard", "CDM"
	Vintage         int    // Year of emission reduction
	Quantity        float64
	SerialNumber    string
	Status          string // "issued", "available", "retired", "cancelled"
	IssueDate       time.Time
	RetirementDate  *time.Time
	OwnerID         string
	Registry        string // "Verra", "Gold Standard Registry"
	VerificationDoc string
}

// CarbonProject represents a carbon offset project
type CarbonProject struct {
	ID                 string
	TenantID           string
	ProjectName        string
	ProjectType        string // "Renewable Energy", "Forestry", "Energy Efficiency"
	Location           string
	Developer          string
	Registry           string
	TotalCredits       float64
	AvailableCredits   float64
	RetiredCredits     float64
	PricePerCredit     float64
	Vintage            int
	VerificationStatus string // "verified", "pending", "rejected"
	CertificationBody  string
	CreatedAt          time.Time
}

// CarbonTrade represents a trade transaction
type CarbonTrade struct {
	ID             string
	TenantID       string
	TradeType      string // "buy", "sell"
	BuyerID        string
	SellerID       string
	ProjectID      string
	Quantity       float64
	PricePerCredit float64
	TotalAmount    float64
	Status         string // "pending", "completed", "cancelled"
	TradeDate      time.Time
	SettlementDate *time.Time
	TransferStatus string // "pending", "completed"
}

// FootprintCalculation represents carbon footprint assessment
type FootprintCalculation struct {
	EntityID        string
	TenantID        string
	Period          string  // "2024-Q1"
	TotalEmissions  float64 // tonnes CO2e
	Scope1Emissions float64 // Direct emissions
	Scope2Emissions float64 // Indirect from energy
	Scope3Emissions float64 // Value chain emissions
	OffsetCredits   float64
	NetEmissions    float64
	CalculationDate time.Time
	Breakdown       map[string]float64
}

// ==================== CARBON FOOTPRINT CALCULATOR ====================

type FootprintCalculator struct{}

func NewFootprintCalculator() *FootprintCalculator {
	return &FootprintCalculator{}
}

// CalculateFootprint calculates carbon footprint for an entity
func (c *FootprintCalculator) CalculateFootprint(
	entityID string,
	tenantID string,
	period string,
	activityData map[string]float64,
) (*FootprintCalculation, error) {

	// Emission factors (kg CO2e per unit)
	emissionFactors := map[string]float64{
		"electricity_kwh": 0.5,   // kg CO2e per kWh
		"natural_gas_m3":  2.0,   // kg CO2e per m³
		"diesel_liters":   2.68,  // kg CO2e per liter
		"petrol_liters":   2.31,  // kg CO2e per liter
		"air_travel_km":   0.255, // kg CO2e per km
		"road_freight_km": 0.062, // kg CO2e per tonne-km
		"waste_tonnes":    21.0,  // kg CO2e per tonne
		"water_m3":        0.34,  // kg CO2e per m³
	}

	breakdown := make(map[string]float64)
	scope1 := 0.0 // Direct emissions
	scope2 := 0.0 // Energy indirect
	scope3 := 0.0 // Other indirect

	// Calculate emissions for each activity
	for activity, quantity := range activityData {
		if factor, exists := emissionFactors[activity]; exists {
			emissions := quantity * factor / 1000.0 // Convert to tonnes

			breakdown[activity] = emissions

			// Categorize into scopes
			switch activity {
			case "natural_gas_m3", "diesel_liters", "petrol_liters":
				scope1 += emissions
			case "electricity_kwh":
				scope2 += emissions
			case "air_travel_km", "road_freight_km", "waste_tonnes", "water_m3":
				scope3 += emissions
			}
		}
	}

	totalEmissions := scope1 + scope2 + scope3

	footprint := &FootprintCalculation{
		EntityID:        entityID,
		TenantID:        tenantID,
		Period:          period,
		TotalEmissions:  totalEmissions,
		Scope1Emissions: scope1,
		Scope2Emissions: scope2,
		Scope3Emissions: scope3,
		OffsetCredits:   0, // To be set if credits are purchased
		NetEmissions:    totalEmissions,
		CalculationDate: time.Now(),
		Breakdown:       breakdown,
	}

	return footprint, nil
}

// CalculateOffsetsRequired calculates credits needed for carbon neutrality
func (c *FootprintCalculator) CalculateOffsetsRequired(footprint *FootprintCalculation) float64 {
	// Round up to nearest whole credit
	return math.Ceil(footprint.NetEmissions)
}

// ==================== CARBON CREDIT ISSUER ====================

type CreditIssuer struct{}

func NewCreditIssuer() *CreditIssuer {
	return &CreditIssuer{}
}

// IssueCredits issues new carbon credits for a verified project
func (i *CreditIssuer) IssueCredits(
	project *CarbonProject,
	quantity float64,
	vintage int,
) ([]*CarbonCredit, error) {

	if project.VerificationStatus != "verified" {
		return nil, fmt.Errorf("project must be verified before issuing credits")
	}

	if quantity <= 0 {
		return nil, fmt.Errorf("quantity must be positive")
	}

	// Generate credits in batches of 1000
	batchSize := 1000.0
	numBatches := int(math.Ceil(quantity / batchSize))

	credits := make([]*CarbonCredit, 0, numBatches)

	for batch := 0; batch < numBatches; batch++ {
		batchQuantity := math.Min(batchSize, quantity-float64(batch)*batchSize)

		credit := &CarbonCredit{
			ID:              i.generateCreditID(),
			TenantID:        project.TenantID,
			ProjectID:       project.ID,
			ProjectName:     project.ProjectName,
			CreditType:      project.Registry,
			Vintage:         vintage,
			Quantity:        batchQuantity,
			SerialNumber:    i.generateSerialNumber(project, vintage, batch),
			Status:          "issued",
			IssueDate:       time.Now(),
			OwnerID:         project.Developer,
			Registry:        project.Registry,
			VerificationDoc: fmt.Sprintf("verification_%s_%d.pdf", project.ID, vintage),
		}

		credits = append(credits, credit)
	}

	// Update project statistics
	project.TotalCredits += quantity
	project.AvailableCredits += quantity

	return credits, nil
}

func (i *CreditIssuer) generateCreditID() string {
	return fmt.Sprintf("CC%d", time.Now().UnixNano())
}

func (i *CreditIssuer) generateSerialNumber(project *CarbonProject, vintage int, batch int) string {
	// Format: REGISTRY-PROJECT-VINTAGE-BATCH
	return fmt.Sprintf("%s-%s-%d-%04d",
		project.Registry[:3],
		project.ID[:8],
		vintage,
		batch,
	)
}

// ==================== TRADING ENGINE ====================

type TradingEngine struct{}

func NewTradingEngine() *TradingEngine {
	return &TradingEngine{}
}

// ExecuteTrade executes a carbon credit trade
func (t *TradingEngine) ExecuteTrade(
	buyerID string,
	sellerID string,
	projectID string,
	quantity float64,
	pricePerCredit float64,
	tenantID string,
) (*CarbonTrade, error) {

	// Validate trade parameters
	if quantity <= 0 {
		return nil, fmt.Errorf("quantity must be positive")
	}

	if pricePerCredit <= 0 {
		return nil, fmt.Errorf("price must be positive")
	}

	// Check seller has sufficient credits
	sellerCredits := t.getAvailableCredits(sellerID, projectID)
	if sellerCredits < quantity {
		return nil, fmt.Errorf("insufficient credits available")
	}

	// Calculate total amount
	totalAmount := quantity * pricePerCredit

	// Create trade record
	trade := &CarbonTrade{
		ID:             t.generateTradeID(),
		TenantID:       tenantID,
		TradeType:      "buy",
		BuyerID:        buyerID,
		SellerID:       sellerID,
		ProjectID:      projectID,
		Quantity:       quantity,
		PricePerCredit: pricePerCredit,
		TotalAmount:    totalAmount,
		Status:         "pending",
		TradeDate:      time.Now(),
		TransferStatus: "pending",
	}

	// Execute payment
	paymentSuccess := t.executePayment(buyerID, sellerID, totalAmount)
	if !paymentSuccess {
		trade.Status = "cancelled"
		return trade, fmt.Errorf("payment failed")
	}

	// Transfer credits
	transferSuccess := t.transferCredits(sellerID, buyerID, projectID, quantity)
	if !transferSuccess {
		// Reverse payment
		t.reversePayment(buyerID, sellerID, totalAmount)
		trade.Status = "cancelled"
		return trade, fmt.Errorf("credit transfer failed")
	}

	// Complete trade
	trade.Status = "completed"
	trade.TransferStatus = "completed"
	settlementDate := time.Now()
	trade.SettlementDate = &settlementDate

	return trade, nil
}

func (t *TradingEngine) getAvailableCredits(ownerID string, projectID string) float64 {
	// In production, query database
	return 10000.0 // Mock value
}

func (t *TradingEngine) executePayment(buyerID string, sellerID string, amount float64) bool {
	// In production, integrate with payment system
	return true
}

func (t *TradingEngine) transferCredits(fromID string, toID string, projectID string, quantity float64) bool {
	// In production, update credit ownership in database
	return true
}

func (t *TradingEngine) reversePayment(buyerID string, sellerID string, amount float64) bool {
	// In production, reverse payment transaction
	return true
}

func (t *TradingEngine) generateTradeID() string {
	return fmt.Sprintf("TRD%d", time.Now().UnixNano())
}

// ==================== CREDIT RETIREMENT ====================

type CreditRetirement struct{}

func NewCreditRetirement() *CreditRetirement {
	return &CreditRetirement{}
}

// RetireCredits permanently retires carbon credits
func (r *CreditRetirement) RetireCredits(
	ownerID string,
	projectID string,
	quantity float64,
	retirementReason string,
	beneficiary string,
) error {

	// Validate ownership and availability
	availableCredits := r.getOwnerCredits(ownerID, projectID)
	if availableCredits < quantity {
		return fmt.Errorf("insufficient credits to retire")
	}

	// Mark credits as retired
	credits := r.selectCreditsForRetirement(ownerID, projectID, quantity)

	retirementDate := time.Now()
	for _, credit := range credits {
		credit.Status = "retired"
		credit.RetirementDate = &retirementDate
	}

	// Record retirement certificate
	certificate := r.generateRetirementCertificate(
		ownerID,
		projectID,
		quantity,
		retirementReason,
		beneficiary,
	)

	fmt.Printf("Retirement certificate generated: %s\n", certificate)

	return nil
}

func (r *CreditRetirement) getOwnerCredits(ownerID string, projectID string) float64 {
	// In production, query database
	return 5000.0
}

func (r *CreditRetirement) selectCreditsForRetirement(ownerID string, projectID string, quantity float64) []*CarbonCredit {
	// In production, select oldest credits first (FIFO)
	return []*CarbonCredit{}
}

func (r *CreditRetirement) generateRetirementCertificate(
	ownerID string,
	projectID string,
	quantity float64,
	reason string,
	beneficiary string,
) string {

	certificateID := fmt.Sprintf("RET%d", time.Now().UnixNano())

	// In production, generate PDF certificate
	certificate := fmt.Sprintf(`
Carbon Credit Retirement Certificate
=====================================
Certificate ID: %s
Date: %s
Owner: %s
Project: %s
Quantity Retired: %.2f tonnes CO2e
Reason: %s
Beneficiary: %s
`,
		certificateID,
		time.Now().Format("2006-01-02"),
		ownerID,
		projectID,
		quantity,
		reason,
		beneficiary,
	)

	return certificate
}

// ==================== ESG REPORTING ====================

type ESGReporter struct{}

func NewESGReporter() *ESGReporter {
	return &ESGReporter{}
}

// GenerateESGReport generates comprehensive ESG report
func (e *ESGReporter) GenerateESGReport(
	entityID string,
	tenantID string,
	period string,
) (map[string]interface{}, error) {

	// Get carbon footprint data
	footprint := e.getFootprintData(entityID, period)

	// Get offset credits
	offsetCredits := e.getOffsetCredits(entityID, period)

	// Calculate carbon intensity
	carbonIntensity := e.calculateCarbonIntensity(entityID, period)

	// Get renewable energy percentage
	renewablePercentage := e.getRenewableEnergyPercentage(entityID, period)

	// Calculate ESG score
	esgScore := e.calculateESGScore(footprint, offsetCredits, renewablePercentage)

	report := map[string]interface{}{
		"entity_id":            entityID,
		"period":               period,
		"total_emissions":      footprint,
		"offset_credits":       offsetCredits,
		"net_emissions":        footprint - offsetCredits,
		"carbon_intensity":     carbonIntensity,
		"renewable_percentage": renewablePercentage,
		"esg_score":            esgScore,
		"carbon_neutral":       footprint <= offsetCredits,
		"report_date":          time.Now(),
	}

	return report, nil
}

func (e *ESGReporter) getFootprintData(entityID string, period string) float64 {
	// In production, query footprint calculations
	return 1250.5 // tonnes CO2e
}

func (e *ESGReporter) getOffsetCredits(entityID string, period string) float64 {
	// In production, query retired credits
	return 1300.0 // tonnes CO2e
}

func (e *ESGReporter) calculateCarbonIntensity(entityID string, period string) float64 {
	// Carbon intensity = emissions / revenue
	// In production, get actual revenue data
	emissions := e.getFootprintData(entityID, period)
	revenue := 50000000.0 // ₦50M

	return emissions / revenue * 1000000 // tonnes CO2e per million Naira
}

func (e *ESGReporter) getRenewableEnergyPercentage(entityID string, period string) float64 {
	// In production, calculate from energy consumption data
	return 35.0 // 35% renewable
}

func (e *ESGReporter) calculateESGScore(emissions float64, offsets float64, renewable float64) float64 {
	// Simple ESG scoring (0-100 scale)
	score := 50.0 // Base score

	// Carbon neutrality bonus
	if offsets >= emissions {
		score += 30.0
	} else {
		score += (offsets / emissions) * 30.0
	}

	// Renewable energy bonus
	score += (renewable / 100.0) * 20.0

	return math.Min(score, 100.0)
}

// ==================== REGISTRY INTEGRATION ====================

type RegistryClient struct {
	registryType string // "Verra", "Gold Standard"
	apiKey       string
	baseURL      string
}

func NewRegistryClient(registryType string, apiKey string) *RegistryClient {
	baseURLs := map[string]string{
		"Verra":         "https://registry.verra.org/api",
		"Gold Standard": "https://registry.goldstandard.org/api",
	}

	return &RegistryClient{
		registryType: registryType,
		apiKey:       apiKey,
		baseURL:      baseURLs[registryType],
	}
}

// VerifyProject verifies project with external registry
func (r *RegistryClient) VerifyProject(projectID string) (bool, error) {
	// In production, call external registry API
	// For now, return mock verification
	return true, nil
}

// RegisterCredits registers issued credits with external registry
func (r *RegistryClient) RegisterCredits(credits []*CarbonCredit) error {
	// In production, submit credits to external registry
	return nil
}

// VerifyRetirement verifies credit retirement with registry
func (r *RegistryClient) VerifyRetirement(certificateID string) (bool, error) {
	// In production, verify with external registry
	return true, nil
}
