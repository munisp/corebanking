package main

import "time"

// Customer represents a relationship customer
type Customer struct {
	CustomerID      string                 `json:"customerID"`
	TenantID        string                 `json:"tenantID"`
	CustomerType    string                 `json:"customerType"` // individual, corporate, sme, hnwi
	FirstName       string                 `json:"firstName"`
	LastName        string                 `json:"lastName"`
	CompanyName     string                 `json:"companyName"`
	Email           string                 `json:"email"`
	Phone           string                 `json:"phone"`
	Segment         string                 `json:"segment"`         // mass, affluent, hnwi, private, corporate, sme
	RelationshipAge int                    `json:"relationshipAge"` // months
	TotalBalance    int64                  `json:"totalBalance"`
	TotalProducts   int                    `json:"totalProducts"`
	Revenue         int64                  `json:"revenue"` // annual revenue from customer
	Profitability   int64                  `json:"profitability"`
	RiskRating      string                 `json:"riskRating"`
	NPS             int                    `json:"nps"` // Net Promoter Score
	LastContact     time.Time              `json:"lastContact"`
	NextReview      time.Time              `json:"nextReview"`
	AssignedRM      string                 `json:"assignedRM"`
	Status          string                 `json:"status"` // active, dormant, churned
	Metadata        map[string]interface{} `json:"metadata"`
	CreatedAt       time.Time              `json:"createdAt"`
	UpdatedAt       time.Time              `json:"updatedAt"`
}

// Portfolio represents RM's customer portfolio
type Portfolio struct {
	PortfolioID    string    `json:"portfolioID"`
	TenantID       string    `json:"tenantID"`
	RMID           string    `json:"rmID"`
	TotalCustomers int       `json:"totalCustomers"`
	TotalBalance   int64     `json:"totalBalance"`
	TotalRevenue   int64     `json:"totalRevenue"`
	TotalProducts  int       `json:"totalProducts"`
	AverageNPS     float64   `json:"averageNPS"`
	ChurnRate      float64   `json:"churnRate"`
	CrossSellRatio float64   `json:"crossSellRatio"`
	TargetRevenue  int64     `json:"targetRevenue"`
	ActualRevenue  int64     `json:"actualRevenue"`
	Achievement    float64   `json:"achievement"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

// Opportunity represents a sales opportunity
type Opportunity struct {
	OpportunityID string                 `json:"opportunityID"`
	TenantID      string                 `json:"tenantID"`
	CustomerID    string                 `json:"customerID"`
	CustomerName  string                 `json:"customerName"`
	ProductType   string                 `json:"productType"` // loan, deposit, card, insurance, investment
	ProductName   string                 `json:"productName"`
	ExpectedValue int64                  `json:"expectedValue"`
	Probability   float64                `json:"probability"`
	WeightedValue int64                  `json:"weightedValue"`
	Stage         string                 `json:"stage"`  // lead, qualified, proposal, negotiation, closed_won, closed_lost
	Source        string                 `json:"source"` // referral, campaign, cross_sell, walk_in, digital
	AssignedRM    string                 `json:"assignedRM"`
	ExpectedClose time.Time              `json:"expectedClose"`
	ActualClose   *time.Time             `json:"actualClose"`
	Notes         string                 `json:"notes"`
	Metadata      map[string]interface{} `json:"metadata"`
	CreatedAt     time.Time              `json:"createdAt"`
	UpdatedAt     time.Time              `json:"updatedAt"`
}

// Activity represents customer interaction activity
type Activity struct {
	ActivityID    string                 `json:"activityID"`
	TenantID      string                 `json:"tenantID"`
	CustomerID    string                 `json:"customerID"`
	CustomerName  string                 `json:"customerName"`
	ActivityType  string                 `json:"activityType"` // call, meeting, email, visit, review
	Subject       string                 `json:"subject"`
	Description   string                 `json:"description"`
	Outcome       string                 `json:"outcome"`
	FollowUpDate  *time.Time             `json:"followUpDate"`
	FollowUpNotes string                 `json:"followUpNotes"`
	RMID          string                 `json:"rmID"`
	Duration      int                    `json:"duration"` // minutes
	Metadata      map[string]interface{} `json:"metadata"`
	CreatedAt     time.Time              `json:"createdAt"`
	UpdatedAt     time.Time              `json:"updatedAt"`
}

// CrossSellRecommendation represents a product recommendation
type CrossSellRecommendation struct {
	RecommendationID string    `json:"recommendationID"`
	TenantID         string    `json:"tenantID"`
	CustomerID       string    `json:"customerID"`
	CustomerName     string    `json:"customerName"`
	ProductType      string    `json:"productType"`
	ProductName      string    `json:"productName"`
	Reason           string    `json:"reason"`
	Score            float64   `json:"score"` // 0-100
	ExpectedValue    int64     `json:"expectedValue"`
	Status           string    `json:"status"` // pending, accepted, rejected, converted
	AssignedRM       string    `json:"assignedRM"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

// Campaign represents a marketing campaign
type Campaign struct {
	CampaignID      string                 `json:"campaignID"`
	TenantID        string                 `json:"tenantID"`
	CampaignName    string                 `json:"campaignName"`
	CampaignType    string                 `json:"campaignType"` // acquisition, retention, cross_sell, win_back
	ProductType     string                 `json:"productType"`
	StartDate       time.Time              `json:"startDate"`
	EndDate         time.Time              `json:"endDate"`
	TargetSegment   string                 `json:"targetSegment"`
	TargetCount     int                    `json:"targetCount"`
	ContactedCount  int                    `json:"contactedCount"`
	ResponseCount   int                    `json:"responseCount"`
	ConversionCount int                    `json:"conversionCount"`
	Budget          int64                  `json:"budget"`
	Spent           int64                  `json:"spent"`
	Revenue         int64                  `json:"revenue"`
	Status          string                 `json:"status"` // draft, active, paused, completed
	Metadata        map[string]interface{} `json:"metadata"`
	CreatedAt       time.Time              `json:"createdAt"`
	UpdatedAt       time.Time              `json:"updatedAt"`
}

// RelationshipManager represents an RM
type RelationshipManager struct {
	RMID          string    `json:"rmID"`
	TenantID      string    `json:"tenantID"`
	EmployeeID    string    `json:"employeeID"`
	FirstName     string    `json:"firstName"`
	LastName      string    `json:"lastName"`
	Email         string    `json:"email"`
	Phone         string    `json:"phone"`
	Role          string    `json:"role"`    // rm, senior_rm, team_lead, manager
	Segment       string    `json:"segment"` // retail, corporate, sme, hnwi, private
	BranchID      string    `json:"branchID"`
	TargetRevenue int64     `json:"targetRevenue"`
	ActualRevenue int64     `json:"actualRevenue"`
	CustomerCount int       `json:"customerCount"`
	Status        string    `json:"status"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

// RMDashboard represents the RM dashboard
type RMDashboard struct {
	Date time.Time `json:"date"`

	// Portfolio
	TotalCustomers int     `json:"totalCustomers"`
	TotalBalance   int64   `json:"totalBalance"`
	TotalRevenue   int64   `json:"totalRevenue"`
	RevenueTarget  int64   `json:"revenueTarget"`
	Achievement    float64 `json:"achievement"`

	// Pipeline
	TotalOpportunities int   `json:"totalOpportunities"`
	PipelineValue      int64 `json:"pipelineValue"`
	WeightedPipeline   int64 `json:"weightedPipeline"`

	// Activity
	ActivitiesToday    int `json:"activitiesToday"`
	ActivitiesThisWeek int `json:"activitiesThisWeek"`
	PendingFollowUps   int `json:"pendingFollowUps"`

	// Cross-sell
	Recommendations int     `json:"recommendations"`
	ConversionRate  float64 `json:"conversionRate"`

	// Customer Health
	AtRiskCustomers  int     `json:"atRiskCustomers"`
	DormantCustomers int     `json:"dormantCustomers"`
	AverageNPS       float64 `json:"averageNPS"`
}

// Request/Response types
type CreateCustomerRequest struct {
	CustomerType string `json:"customerType"`
	FirstName    string `json:"firstName"`
	LastName     string `json:"lastName"`
	CompanyName  string `json:"companyName"`
	Email        string `json:"email"`
	Phone        string `json:"phone"`
	Segment      string `json:"segment"`
}

type CreateOpportunityRequest struct {
	CustomerID    string  `json:"customerID"`
	ProductType   string  `json:"productType"`
	ProductName   string  `json:"productName"`
	ExpectedValue int64   `json:"expectedValue"`
	Probability   float64 `json:"probability"`
	Source        string  `json:"source"`
	ExpectedClose string  `json:"expectedClose"`
	Notes         string  `json:"notes"`
}

type CreateActivityRequest struct {
	CustomerID   string `json:"customerID"`
	ActivityType string `json:"activityType"`
	Subject      string `json:"subject"`
	Description  string `json:"description"`
	Outcome      string `json:"outcome"`
	Duration     int    `json:"duration"`
	FollowUpDate string `json:"followUpDate"`
}

type UpdateOpportunityStageRequest struct {
	Stage string `json:"stage"`
	Notes string `json:"notes"`
}
