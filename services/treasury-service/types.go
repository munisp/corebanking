package main

import "time"

// LiquidityPosition represents the bank's liquidity position
type LiquidityPosition struct {
	PositionID       string                 `json:"positionID"`
	TenantID         string                 `json:"tenantID"`
	Date             time.Time              `json:"date"`
	Currency         string                 `json:"currency"`
	TotalAssets      int64                  `json:"totalAssets"`
	TotalLiabilities int64                  `json:"totalLiabilities"`
	NetPosition      int64                  `json:"netPosition"`
	CashReserves     int64                  `json:"cashReserves"`
	CBNBalance       int64                  `json:"cbnBalance"`
	NostroBalances   map[string]int64       `json:"nostroBalances"`
	VostroBalances   map[string]int64       `json:"vostroBalances"`
	LCR              float64                `json:"lcr"` // Liquidity Coverage Ratio
	NSFR             float64                `json:"nsfr"` // Net Stable Funding Ratio
	CRR              float64                `json:"crr"` // Cash Reserve Ratio
	Status           string                 `json:"status"` // normal, warning, critical
	Metadata         map[string]interface{} `json:"metadata"`
	CreatedAt        time.Time              `json:"createdAt"`
	UpdatedAt        time.Time              `json:"updatedAt"`
}

// CashFlow represents a cash flow entry
type CashFlow struct {
	FlowID       string    `json:"flowID"`
	TenantID     string    `json:"tenantID"`
	Date         time.Time `json:"date"`
	FlowType     string    `json:"flowType"` // inflow, outflow
	Category     string    `json:"category"` // deposits, withdrawals, loans, investments, interbank
	Amount       int64     `json:"amount"`
	Currency     string    `json:"currency"`
	Description  string    `json:"description"`
	CounterParty string    `json:"counterParty"`
	Status       string    `json:"status"` // projected, confirmed, settled
	CreatedAt    time.Time `json:"createdAt"`
}

// FXPosition represents a foreign exchange position
type FXPosition struct {
	PositionID    string    `json:"positionID"`
	TenantID      string    `json:"tenantID"`
	Currency      string    `json:"currency"`
	LongPosition  int64     `json:"longPosition"`
	ShortPosition int64     `json:"shortPosition"`
	NetPosition   int64     `json:"netPosition"`
	AvgRate       float64   `json:"avgRate"`
	CurrentRate   float64   `json:"currentRate"`
	UnrealizedPnL int64     `json:"unrealizedPnL"`
	Limit         int64     `json:"limit"`
	Utilization   float64   `json:"utilization"`
	Status        string    `json:"status"` // within_limit, near_limit, breached
	UpdatedAt     time.Time `json:"updatedAt"`
}

// FXDeal represents a foreign exchange deal
type FXDeal struct {
	DealID         string                 `json:"dealID"`
	TenantID       string                 `json:"tenantID"`
	DealNumber     string                 `json:"dealNumber"`
	DealType       string                 `json:"dealType"` // spot, forward, swap
	BuyCurrency    string                 `json:"buyCurrency"`
	SellCurrency   string                 `json:"sellCurrency"`
	BuyAmount      int64                  `json:"buyAmount"`
	SellAmount     int64                  `json:"sellAmount"`
	Rate           float64                `json:"rate"`
	ValueDate      time.Time              `json:"valueDate"`
	MaturityDate   *time.Time             `json:"maturityDate"`
	CounterParty   string                 `json:"counterParty"`
	CounterPartyID string                 `json:"counterPartyID"`
	Purpose        string                 `json:"purpose"`
	Status         string                 `json:"status"` // pending, approved, executed, settled, cancelled
	DealerID       string                 `json:"dealerID"`
	DealerName     string                 `json:"dealerName"`
	ApprovedBy     string                 `json:"approvedBy"`
	ApprovedAt     *time.Time             `json:"approvedAt"`
	SettledAt      *time.Time             `json:"settledAt"`
	Metadata       map[string]interface{} `json:"metadata"`
	CreatedAt      time.Time              `json:"createdAt"`
	UpdatedAt      time.Time              `json:"updatedAt"`
}

// Investment represents an investment holding
type Investment struct {
	InvestmentID   string                 `json:"investmentID"`
	TenantID       string                 `json:"tenantID"`
	InvestmentType string                 `json:"investmentType"` // treasury_bill, bond, commercial_paper, fixed_deposit
	Issuer         string                 `json:"issuer"`
	IssuerID       string                 `json:"issuerID"`
	FaceValue      int64                  `json:"faceValue"`
	PurchasePrice  int64                  `json:"purchasePrice"`
	CurrentValue   int64                  `json:"currentValue"`
	Currency       string                 `json:"currency"`
	CouponRate     float64                `json:"couponRate"`
	YieldRate      float64                `json:"yieldRate"`
	PurchaseDate   time.Time              `json:"purchaseDate"`
	MaturityDate   time.Time              `json:"maturityDate"`
	NextCouponDate *time.Time             `json:"nextCouponDate"`
	Status         string                 `json:"status"` // active, matured, sold
	Portfolio      string                 `json:"portfolio"` // trading, held_to_maturity, available_for_sale
	UnrealizedPnL  int64                  `json:"unrealizedPnL"`
	AccruedInterest int64                 `json:"accruedInterest"`
	Metadata       map[string]interface{} `json:"metadata"`
	CreatedAt      time.Time              `json:"createdAt"`
	UpdatedAt      time.Time              `json:"updatedAt"`
}

// InterbankDeal represents an interbank money market deal
type InterbankDeal struct {
	DealID        string                 `json:"dealID"`
	TenantID      string                 `json:"tenantID"`
	DealNumber    string                 `json:"dealNumber"`
	DealType      string                 `json:"dealType"` // placement, takings, call_money
	CounterParty  string                 `json:"counterParty"`
	CounterPartyID string                `json:"counterPartyID"`
	Principal     int64                  `json:"principal"`
	Currency      string                 `json:"currency"`
	InterestRate  float64                `json:"interestRate"`
	StartDate     time.Time              `json:"startDate"`
	MaturityDate  time.Time              `json:"maturityDate"`
	Tenor         int                    `json:"tenor"` // days
	Interest      int64                  `json:"interest"`
	TotalAmount   int64                  `json:"totalAmount"`
	Status        string                 `json:"status"` // pending, active, matured, rolled_over
	DealerID      string                 `json:"dealerID"`
	ApprovedBy    string                 `json:"approvedBy"`
	ApprovedAt    *time.Time             `json:"approvedAt"`
	Metadata      map[string]interface{} `json:"metadata"`
	CreatedAt     time.Time              `json:"createdAt"`
	UpdatedAt     time.Time              `json:"updatedAt"`
}

// ALMGap represents Asset-Liability Management gap analysis
type ALMGap struct {
	GapID        string             `json:"gapID"`
	TenantID     string             `json:"tenantID"`
	Date         time.Time          `json:"date"`
	Currency     string             `json:"currency"`
	TimeBuckets  []ALMTimeBucket    `json:"timeBuckets"`
	TotalAssets  int64              `json:"totalAssets"`
	TotalLiabilities int64          `json:"totalLiabilities"`
	CumulativeGap int64             `json:"cumulativeGap"`
	GapRatio     float64            `json:"gapRatio"`
	Status       string             `json:"status"` // balanced, asset_sensitive, liability_sensitive
	CreatedAt    time.Time          `json:"createdAt"`
}

// ALMTimeBucket represents a time bucket in ALM gap analysis
type ALMTimeBucket struct {
	Bucket       string  `json:"bucket"` // 0-30d, 31-90d, 91-180d, 181-365d, >1y
	Assets       int64   `json:"assets"`
	Liabilities  int64   `json:"liabilities"`
	Gap          int64   `json:"gap"`
	CumulativeGap int64  `json:"cumulativeGap"`
	GapRatio     float64 `json:"gapRatio"`
}

// InterestRateRisk represents interest rate risk metrics
type InterestRateRisk struct {
	RiskID          string    `json:"riskID"`
	TenantID        string    `json:"tenantID"`
	Date            time.Time `json:"date"`
	Currency        string    `json:"currency"`
	DurationGap     float64   `json:"durationGap"`
	ModifiedDuration float64  `json:"modifiedDuration"`
	BPVAssets       int64     `json:"bpvAssets"` // Basis Point Value
	BPVLiabilities  int64     `json:"bpvLiabilities"`
	NetBPV          int64     `json:"netBPV"`
	EaR             int64     `json:"ear"` // Earnings at Risk
	EVE             int64     `json:"eve"` // Economic Value of Equity
	Status          string    `json:"status"`
	CreatedAt       time.Time `json:"createdAt"`
}

// TreasuryLimit represents a treasury limit
type TreasuryLimit struct {
	LimitID     string    `json:"limitID"`
	TenantID    string    `json:"tenantID"`
	LimitType   string    `json:"limitType"` // fx_position, interbank, investment, counterparty
	Currency    string    `json:"currency"`
	LimitValue  int64     `json:"limitValue"`
	CurrentUsage int64    `json:"currentUsage"`
	Utilization float64   `json:"utilization"`
	WarningLevel float64  `json:"warningLevel"` // percentage
	Status      string    `json:"status"` // within_limit, warning, breached
	ApprovedBy  string    `json:"approvedBy"`
	ValidFrom   time.Time `json:"validFrom"`
	ValidTo     time.Time `json:"validTo"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// TreasuryOfficer represents a treasury officer
type TreasuryOfficer struct {
	OfficerID    string    `json:"officerID"`
	TenantID     string    `json:"tenantID"`
	EmployeeID   string    `json:"employeeID"`
	FirstName    string    `json:"firstName"`
	LastName     string    `json:"lastName"`
	Email        string    `json:"email"`
	Phone        string    `json:"phone"`
	Role         string    `json:"role"` // dealer, senior_dealer, head_treasury, alm_officer
	Desk         string    `json:"desk"` // fx, money_market, investments, alm
	DealingLimit int64     `json:"dealingLimit"`
	Status       string    `json:"status"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// TreasuryDashboard represents the treasury dashboard
type TreasuryDashboard struct {
	Date              time.Time `json:"date"`
	
	// Liquidity
	TotalLiquidity    int64   `json:"totalLiquidity"`
	LCR               float64 `json:"lcr"`
	NSFR              float64 `json:"nsfr"`
	CRR               float64 `json:"crr"`
	LiquidityStatus   string  `json:"liquidityStatus"`
	
	// FX
	TotalFXPosition   int64   `json:"totalFXPosition"`
	FXPnL             int64   `json:"fxPnL"`
	OpenFXDeals       int     `json:"openFXDeals"`
	
	// Investments
	TotalInvestments  int64   `json:"totalInvestments"`
	InvestmentYield   float64 `json:"investmentYield"`
	MaturingThisWeek  int     `json:"maturingThisWeek"`
	
	// Interbank
	NetInterbankPosition int64 `json:"netInterbankPosition"`
	Placements        int64   `json:"placements"`
	Takings           int64   `json:"takings"`
	
	// ALM
	GapRatio          float64 `json:"gapRatio"`
	DurationGap       float64 `json:"durationGap"`
	ALMStatus         string  `json:"almStatus"`
	
	// Limits
	LimitsBreached    int     `json:"limitsBreached"`
	LimitsWarning     int     `json:"limitsWarning"`
}

// Request/Response types
type CreateFXDealRequest struct {
	DealType       string  `json:"dealType"`
	BuyCurrency    string  `json:"buyCurrency"`
	SellCurrency   string  `json:"sellCurrency"`
	BuyAmount      int64   `json:"buyAmount"`
	SellAmount     int64   `json:"sellAmount"`
	Rate           float64 `json:"rate"`
	ValueDate      string  `json:"valueDate"`
	MaturityDate   string  `json:"maturityDate"`
	CounterParty   string  `json:"counterParty"`
	CounterPartyID string  `json:"counterPartyID"`
	Purpose        string  `json:"purpose"`
}

type CreateInvestmentRequest struct {
	InvestmentType string  `json:"investmentType"`
	Issuer         string  `json:"issuer"`
	IssuerID       string  `json:"issuerID"`
	FaceValue      int64   `json:"faceValue"`
	PurchasePrice  int64   `json:"purchasePrice"`
	Currency       string  `json:"currency"`
	CouponRate     float64 `json:"couponRate"`
	YieldRate      float64 `json:"yieldRate"`
	PurchaseDate   string  `json:"purchaseDate"`
	MaturityDate   string  `json:"maturityDate"`
	Portfolio      string  `json:"portfolio"`
}

type CreateInterbankDealRequest struct {
	DealType       string  `json:"dealType"`
	CounterParty   string  `json:"counterParty"`
	CounterPartyID string  `json:"counterPartyID"`
	Principal      int64   `json:"principal"`
	Currency       string  `json:"currency"`
	InterestRate   float64 `json:"interestRate"`
	StartDate      string  `json:"startDate"`
	MaturityDate   string  `json:"maturityDate"`
}

type CreateLimitRequest struct {
	LimitType    string  `json:"limitType"`
	Currency     string  `json:"currency"`
	LimitValue   int64   `json:"limitValue"`
	WarningLevel float64 `json:"warningLevel"`
	ValidFrom    string  `json:"validFrom"`
	ValidTo      string  `json:"validTo"`
}

type CashFlowProjection struct {
	Date     string `json:"date"`
	Inflows  int64  `json:"inflows"`
	Outflows int64  `json:"outflows"`
	NetFlow  int64  `json:"netFlow"`
	Balance  int64  `json:"balance"`
}
