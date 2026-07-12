package main

import "time"

// CreditRisk represents credit risk assessment
type CreditRisk struct {
	RiskID           string                 `json:"riskID"`
	TenantID         string                 `json:"tenantID"`
	EntityType       string                 `json:"entityType"` // customer, portfolio, sector
	EntityID         string                 `json:"entityID"`
	EntityName       string                 `json:"entityName"`
	ExposureAmount   int64                  `json:"exposureAmount"`
	Currency         string                 `json:"currency"`
	PD               float64                `json:"pd"`  // Probability of Default
	LGD              float64                `json:"lgd"` // Loss Given Default
	EAD              int64                  `json:"ead"` // Exposure at Default
	ExpectedLoss     int64                  `json:"expectedLoss"`
	RiskRating       string                 `json:"riskRating"` // AAA, AA, A, BBB, BB, B, CCC, CC, C, D
	RiskScore        float64                `json:"riskScore"`
	WatchlistStatus  string                 `json:"watchlistStatus"` // normal, watch, substandard, doubtful, loss
	ProvisionRate    float64                `json:"provisionRate"`
	ProvisionAmount  int64                  `json:"provisionAmount"`
	CollateralValue  int64                  `json:"collateralValue"`
	CollateralCoverage float64              `json:"collateralCoverage"`
	LastReviewDate   time.Time              `json:"lastReviewDate"`
	NextReviewDate   time.Time              `json:"nextReviewDate"`
	Metadata         map[string]interface{} `json:"metadata"`
	CreatedAt        time.Time              `json:"createdAt"`
	UpdatedAt        time.Time              `json:"updatedAt"`
}

// OperationalRisk represents operational risk event
type OperationalRisk struct {
	RiskID          string                 `json:"riskID"`
	TenantID        string                 `json:"tenantID"`
	EventType       string                 `json:"eventType"` // fraud, system_failure, process_error, external_event, legal, compliance
	EventCategory   string                 `json:"eventCategory"` // internal_fraud, external_fraud, employment, clients, physical, business_disruption, execution
	Description     string                 `json:"description"`
	Department      string                 `json:"department"`
	BusinessLine    string                 `json:"businessLine"`
	DiscoveryDate   time.Time              `json:"discoveryDate"`
	OccurrenceDate  time.Time              `json:"occurrenceDate"`
	GrossLoss       int64                  `json:"grossLoss"`
	Recovery        int64                  `json:"recovery"`
	NetLoss         int64                  `json:"netLoss"`
	Currency        string                 `json:"currency"`
	Status          string                 `json:"status"` // open, investigating, resolved, closed
	Severity        string                 `json:"severity"` // low, medium, high, critical
	RootCause       string                 `json:"rootCause"`
	CorrectiveAction string                `json:"correctiveAction"`
	PreventiveAction string                `json:"preventiveAction"`
	ReportedBy      string                 `json:"reportedBy"`
	AssignedTo      string                 `json:"assignedTo"`
	ResolvedBy      string                 `json:"resolvedBy"`
	ResolvedAt      *time.Time             `json:"resolvedAt"`
	Metadata        map[string]interface{} `json:"metadata"`
	CreatedAt       time.Time              `json:"createdAt"`
	UpdatedAt       time.Time              `json:"updatedAt"`
}

// MarketRisk represents market risk metrics
type MarketRisk struct {
	RiskID          string                 `json:"riskID"`
	TenantID        string                 `json:"tenantID"`
	Date            time.Time              `json:"date"`
	Portfolio       string                 `json:"portfolio"` // trading, banking, fx, interest_rate
	VaR             int64                  `json:"var"` // Value at Risk
	VaRConfidence   float64                `json:"varConfidence"` // 95%, 99%
	VaRHorizon      int                    `json:"varHorizon"` // days
	ExpectedShortfall int64                `json:"expectedShortfall"` // CVaR
	StressVaR       int64                  `json:"stressVaR"`
	DeltaNormal     int64                  `json:"deltaNormal"`
	HistoricalVaR   int64                  `json:"historicalVaR"`
	MonteCarloVaR   int64                  `json:"monteCarloVaR"`
	Currency        string                 `json:"currency"`
	Status          string                 `json:"status"` // within_limit, warning, breached
	Metadata        map[string]interface{} `json:"metadata"`
	CreatedAt       time.Time              `json:"createdAt"`
	UpdatedAt       time.Time              `json:"updatedAt"`
}

// RiskLimit represents a risk limit
type RiskLimit struct {
	LimitID         string                 `json:"limitID"`
	TenantID        string                 `json:"tenantID"`
	LimitType       string                 `json:"limitType"` // credit, market, operational, concentration
	LimitName       string                 `json:"limitName"`
	LimitValue      int64                  `json:"limitValue"`
	CurrentUsage    int64                  `json:"currentUsage"`
	Utilization     float64                `json:"utilization"`
	WarningLevel    float64                `json:"warningLevel"`
	Currency        string                 `json:"currency"`
	Status          string                 `json:"status"` // within_limit, warning, breached
	ApprovedBy      string                 `json:"approvedBy"`
	ValidFrom       time.Time              `json:"validFrom"`
	ValidTo         time.Time              `json:"validTo"`
	Metadata        map[string]interface{} `json:"metadata"`
	CreatedAt       time.Time              `json:"createdAt"`
	UpdatedAt       time.Time              `json:"updatedAt"`
}

// RiskIndicator represents a Key Risk Indicator (KRI)
type RiskIndicator struct {
	IndicatorID     string                 `json:"indicatorID"`
	TenantID        string                 `json:"tenantID"`
	IndicatorName   string                 `json:"indicatorName"`
	Category        string                 `json:"category"` // credit, market, operational, liquidity
	CurrentValue    float64                `json:"currentValue"`
	Threshold       float64                `json:"threshold"`
	WarningLevel    float64                `json:"warningLevel"`
	Unit            string                 `json:"unit"`
	Trend           string                 `json:"trend"` // improving, stable, deteriorating
	Status          string                 `json:"status"` // green, amber, red
	LastUpdated     time.Time              `json:"lastUpdated"`
	Metadata        map[string]interface{} `json:"metadata"`
	CreatedAt       time.Time              `json:"createdAt"`
	UpdatedAt       time.Time              `json:"updatedAt"`
}

// StressTest represents a stress test scenario
type StressTest struct {
	TestID          string                 `json:"testID"`
	TenantID        string                 `json:"tenantID"`
	TestName        string                 `json:"testName"`
	TestType        string                 `json:"testType"` // sensitivity, scenario, reverse
	Scenario        string                 `json:"scenario"`
	Parameters      map[string]float64     `json:"parameters"`
	BaselineCapital int64                  `json:"baselineCapital"`
	StressedCapital int64                  `json:"stressedCapital"`
	CapitalImpact   int64                  `json:"capitalImpact"`
	CapitalRatio    float64                `json:"capitalRatio"`
	StressedRatio   float64                `json:"stressedRatio"`
	Status          string                 `json:"status"` // passed, warning, failed
	RunDate         time.Time              `json:"runDate"`
	RunBy           string                 `json:"runBy"`
	Metadata        map[string]interface{} `json:"metadata"`
	CreatedAt       time.Time              `json:"createdAt"`
	UpdatedAt       time.Time              `json:"updatedAt"`
}

// RiskReport represents a risk report
type RiskReport struct {
	ReportID        string                 `json:"reportID"`
	TenantID        string                 `json:"tenantID"`
	ReportType      string                 `json:"reportType"` // daily, weekly, monthly, quarterly, regulatory
	ReportName      string                 `json:"reportName"`
	ReportDate      time.Time              `json:"reportDate"`
	Status          string                 `json:"status"` // draft, pending_review, approved, submitted
	GeneratedBy     string                 `json:"generatedBy"`
	ApprovedBy      string                 `json:"approvedBy"`
	ApprovedAt      *time.Time             `json:"approvedAt"`
	SubmittedAt     *time.Time             `json:"submittedAt"`
	Content         map[string]interface{} `json:"content"`
	Metadata        map[string]interface{} `json:"metadata"`
	CreatedAt       time.Time              `json:"createdAt"`
	UpdatedAt       time.Time              `json:"updatedAt"`
}

// RiskOfficer represents a risk management officer
type RiskOfficer struct {
	OfficerID       string    `json:"officerID"`
	TenantID        string    `json:"tenantID"`
	EmployeeID      string    `json:"employeeID"`
	FirstName       string    `json:"firstName"`
	LastName        string    `json:"lastName"`
	Email           string    `json:"email"`
	Phone           string    `json:"phone"`
	Role            string    `json:"role"` // analyst, senior_analyst, manager, chief_risk_officer
	Specialization  string    `json:"specialization"` // credit, market, operational, enterprise
	Status          string    `json:"status"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

// RiskDashboard represents the risk dashboard
type RiskDashboard struct {
	Date time.Time `json:"date"`

	// Credit Risk
	TotalExposure       int64   `json:"totalExposure"`
	NPLRatio            float64 `json:"nplRatio"`
	ProvisionCoverage   float64 `json:"provisionCoverage"`
	ConcentrationRisk   float64 `json:"concentrationRisk"`

	// Market Risk
	TotalVaR            int64   `json:"totalVaR"`
	VaRUtilization      float64 `json:"varUtilization"`
	FXExposure          int64   `json:"fxExposure"`
	InterestRateRisk    int64   `json:"interestRateRisk"`

	// Operational Risk
	OpenIncidents       int     `json:"openIncidents"`
	TotalLosses         int64   `json:"totalLosses"`
	HighSeverityEvents  int     `json:"highSeverityEvents"`

	// Overall
	CapitalAdequacyRatio float64 `json:"capitalAdequacyRatio"`
	RiskAppetiteStatus   string  `json:"riskAppetiteStatus"`
	KRIBreaches          int     `json:"kriBreaches"`
}

// Request/Response types
type CreateCreditRiskRequest struct {
	EntityType      string  `json:"entityType"`
	EntityID        string  `json:"entityID"`
	EntityName      string  `json:"entityName"`
	ExposureAmount  int64   `json:"exposureAmount"`
	Currency        string  `json:"currency"`
	CollateralValue int64   `json:"collateralValue"`
}

type CreateOperationalRiskRequest struct {
	EventType       string `json:"eventType"`
	EventCategory   string `json:"eventCategory"`
	Description     string `json:"description"`
	Department      string `json:"department"`
	BusinessLine    string `json:"businessLine"`
	OccurrenceDate  string `json:"occurrenceDate"`
	GrossLoss       int64  `json:"grossLoss"`
	Severity        string `json:"severity"`
}

type CreateStressTestRequest struct {
	TestName   string             `json:"testName"`
	TestType   string             `json:"testType"`
	Scenario   string             `json:"scenario"`
	Parameters map[string]float64 `json:"parameters"`
}

type CreateRiskLimitRequest struct {
	LimitType    string  `json:"limitType"`
	LimitName    string  `json:"limitName"`
	LimitValue   int64   `json:"limitValue"`
	Currency     string  `json:"currency"`
	WarningLevel float64 `json:"warningLevel"`
	ValidFrom    string  `json:"validFrom"`
	ValidTo      string  `json:"validTo"`
}

type UpdateRiskRatingRequest struct {
	RiskRating      string  `json:"riskRating"`
	WatchlistStatus string  `json:"watchlistStatus"`
	Notes           string  `json:"notes"`
}
