package main

import "time"

// Branch represents a bank branch
type Branch struct {
	BranchID      string    `json:"branchID"`
	TenantID      string    `json:"tenantID"`
	BranchCode    string    `json:"branchCode"`
	BranchName    string    `json:"branchName"`
	BranchType    string    `json:"branchType"` // main, regional, satellite, agency
	Region        string    `json:"region"`
	State         string    `json:"state"`
	LGA           string    `json:"lga"`
	Address       string    `json:"address"`
	Phone         string    `json:"phone"`
	Email         string    `json:"email"`
	ManagerID     string    `json:"managerID"`
	ManagerName   string    `json:"managerName"`
	Status        string    `json:"status"` // active, inactive, under_renovation
	OpeningTime   string    `json:"openingTime"`
	ClosingTime   string    `json:"closingTime"`
	WorkingDays   []string  `json:"workingDays"`
	Latitude      float64   `json:"latitude"`
	Longitude     float64   `json:"longitude"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

// BranchStaff represents a staff member at a branch
type BranchStaff struct {
	StaffID       string    `json:"staffID"`
	TenantID      string    `json:"tenantID"`
	BranchID      string    `json:"branchID"`
	EmployeeID    string    `json:"employeeID"`
	FirstName     string    `json:"firstName"`
	LastName      string    `json:"lastName"`
	Email         string    `json:"email"`
	Phone         string    `json:"phone"`
	Role          string    `json:"role"` // teller, cso, supervisor, manager
	Department    string    `json:"department"`
	Status        string    `json:"status"` // active, on_leave, suspended, terminated
	JoinDate      time.Time `json:"joinDate"`
	Supervisor    string    `json:"supervisor"`
	Skills        []string  `json:"skills"`
	Certifications []string `json:"certifications"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

// StaffSchedule represents a staff schedule
type StaffSchedule struct {
	ScheduleID    string    `json:"scheduleID"`
	TenantID      string    `json:"tenantID"`
	BranchID      string    `json:"branchID"`
	StaffID       string    `json:"staffID"`
	StaffName     string    `json:"staffName"`
	ScheduleDate  time.Time `json:"scheduleDate"`
	ShiftType     string    `json:"shiftType"` // morning, afternoon, full_day, night
	StartTime     string    `json:"startTime"`
	EndTime       string    `json:"endTime"`
	Position      string    `json:"position"` // teller_1, teller_2, cso, supervisor
	Status        string    `json:"status"`   // scheduled, confirmed, absent, completed
	Notes         string    `json:"notes"`
	CreatedBy     string    `json:"createdBy"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

// LeaveRequest represents a staff leave request
type LeaveRequest struct {
	RequestID     string     `json:"requestID"`
	TenantID      string     `json:"tenantID"`
	BranchID      string     `json:"branchID"`
	StaffID       string     `json:"staffID"`
	StaffName     string     `json:"staffName"`
	LeaveType     string     `json:"leaveType"` // annual, sick, maternity, paternity, compassionate
	StartDate     time.Time  `json:"startDate"`
	EndDate       time.Time  `json:"endDate"`
	TotalDays     int        `json:"totalDays"`
	Reason        string     `json:"reason"`
	Status        string     `json:"status"` // pending, approved, rejected, cancelled
	ApprovedBy    string     `json:"approvedBy"`
	ApprovedAt    *time.Time `json:"approvedAt"`
	RejectionNote string     `json:"rejectionNote"`
	CreatedAt     time.Time  `json:"createdAt"`
	UpdatedAt     time.Time  `json:"updatedAt"`
}

// ApprovalRequest represents a request requiring manager approval
type ApprovalRequest struct {
	RequestID     string                 `json:"requestID"`
	TenantID      string                 `json:"tenantID"`
	BranchID      string                 `json:"branchID"`
	RequestType   string                 `json:"requestType"` // transaction, account_opening, loan, limit_increase, fee_waiver
	ReferenceID   string                 `json:"referenceID"`
	RequestedBy   string                 `json:"requestedBy"`
	RequestedByName string               `json:"requestedByName"`
	CustomerID    string                 `json:"customerID"`
	CustomerName  string                 `json:"customerName"`
	Amount        int64                  `json:"amount"`
	Currency      string                 `json:"currency"`
	Description   string                 `json:"description"`
	Priority      string                 `json:"priority"` // low, medium, high, urgent
	Status        string                 `json:"status"`   // pending, approved, rejected, escalated
	Details       map[string]interface{} `json:"details"`
	ApprovedBy    string                 `json:"approvedBy"`
	ApprovedAt    *time.Time             `json:"approvedAt"`
	RejectionNote string                 `json:"rejectionNote"`
	EscalatedTo   string                 `json:"escalatedTo"`
	EscalatedAt   *time.Time             `json:"escalatedAt"`
	DueDate       *time.Time             `json:"dueDate"`
	CreatedAt     time.Time              `json:"createdAt"`
	UpdatedAt     time.Time              `json:"updatedAt"`
}

// BranchTarget represents branch performance targets
type BranchTarget struct {
	TargetID      string    `json:"targetID"`
	TenantID      string    `json:"tenantID"`
	BranchID      string    `json:"branchID"`
	Period        string    `json:"period"` // monthly, quarterly, yearly
	Year          int       `json:"year"`
	Month         int       `json:"month"`
	Quarter       int       `json:"quarter"`
	TargetType    string    `json:"targetType"` // deposits, loans, accounts, transactions, revenue
	TargetValue   int64     `json:"targetValue"`
	AchievedValue int64     `json:"achievedValue"`
	Currency      string    `json:"currency"`
	Status        string    `json:"status"` // on_track, at_risk, achieved, missed
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

// BranchPerformance represents branch performance metrics
type BranchPerformance struct {
	PerformanceID   string    `json:"performanceID"`
	TenantID        string    `json:"tenantID"`
	BranchID        string    `json:"branchID"`
	Period          string    `json:"period"`
	Date            time.Time `json:"date"`
	
	// Transaction Metrics
	TotalTransactions    int   `json:"totalTransactions"`
	DepositCount         int   `json:"depositCount"`
	WithdrawalCount      int   `json:"withdrawalCount"`
	TransferCount        int   `json:"transferCount"`
	TotalDepositAmount   int64 `json:"totalDepositAmount"`
	TotalWithdrawalAmount int64 `json:"totalWithdrawalAmount"`
	TotalTransferAmount  int64 `json:"totalTransferAmount"`
	
	// Account Metrics
	NewAccountsOpened    int   `json:"newAccountsOpened"`
	AccountsClosed       int   `json:"accountsClosed"`
	ActiveAccounts       int   `json:"activeAccounts"`
	DormantAccounts      int   `json:"dormantAccounts"`
	
	// Loan Metrics
	LoanApplications     int   `json:"loanApplications"`
	LoansApproved        int   `json:"loansApproved"`
	LoansDisbursed       int   `json:"loansDisbursed"`
	TotalDisbursedAmount int64 `json:"totalDisbursedAmount"`
	NPLCount             int   `json:"nplCount"`
	NPLAmount            int64 `json:"nplAmount"`
	
	// Customer Metrics
	CustomersServed      int     `json:"customersServed"`
	AvgWaitTime          float64 `json:"avgWaitTime"` // minutes
	AvgServiceTime       float64 `json:"avgServiceTime"`
	CustomerSatisfaction float64 `json:"customerSatisfaction"` // 1-5 rating
	
	// Revenue Metrics
	FeeIncome            int64 `json:"feeIncome"`
	InterestIncome       int64 `json:"interestIncome"`
	TotalRevenue         int64 `json:"totalRevenue"`
	
	// Operational Metrics
	CashPosition         int64 `json:"cashPosition"`
	VaultBalance         int64 `json:"vaultBalance"`
	ATMUptime            float64 `json:"atmUptime"` // percentage
	SystemUptime         float64 `json:"systemUptime"`
	
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// CashManagement represents branch cash management
type CashManagement struct {
	RecordID        string    `json:"recordID"`
	TenantID        string    `json:"tenantID"`
	BranchID        string    `json:"branchID"`
	Date            time.Time `json:"date"`
	OpeningBalance  int64     `json:"openingBalance"`
	ClosingBalance  int64     `json:"closingBalance"`
	TotalCashIn     int64     `json:"totalCashIn"`
	TotalCashOut    int64     `json:"totalCashOut"`
	VaultBalance    int64     `json:"vaultBalance"`
	TellerBalances  map[string]int64 `json:"tellerBalances"`
	CashLimit       int64     `json:"cashLimit"`
	ExcessCash      int64     `json:"excessCash"`
	CashShortage    int64     `json:"cashShortage"`
	Status          string    `json:"status"` // open, closed, reconciled
	ReconciliationNotes string `json:"reconciliationNotes"`
	ReconcililedBy  string    `json:"reconciledBy"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

// CashRequest represents a cash requisition or evacuation request
type CashRequest struct {
	RequestID     string    `json:"requestID"`
	TenantID      string    `json:"tenantID"`
	BranchID      string    `json:"branchID"`
	RequestType   string    `json:"requestType"` // requisition, evacuation
	Amount        int64     `json:"amount"`
	Currency      string    `json:"currency"`
	Reason        string    `json:"reason"`
	Priority      string    `json:"priority"` // normal, urgent
	Status        string    `json:"status"`   // pending, approved, in_transit, completed, rejected
	RequestedBy   string    `json:"requestedBy"`
	ApprovedBy    string    `json:"approvedBy"`
	ApprovedAt    *time.Time `json:"approvedAt"`
	ScheduledDate *time.Time `json:"scheduledDate"`
	CompletedAt   *time.Time `json:"completedAt"`
	Notes         string    `json:"notes"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

// BranchIncident represents an incident at the branch
type BranchIncident struct {
	IncidentID    string    `json:"incidentID"`
	TenantID      string    `json:"tenantID"`
	BranchID      string    `json:"branchID"`
	IncidentType  string    `json:"incidentType"` // security, system, customer_complaint, operational, fraud
	Severity      string    `json:"severity"`     // low, medium, high, critical
	Title         string    `json:"title"`
	Description   string    `json:"description"`
	ReportedBy    string    `json:"reportedBy"`
	ReportedAt    time.Time `json:"reportedAt"`
	Status        string    `json:"status"` // open, investigating, resolved, closed
	AssignedTo    string    `json:"assignedTo"`
	Resolution    string    `json:"resolution"`
	ResolvedBy    string    `json:"resolvedBy"`
	ResolvedAt    *time.Time `json:"resolvedAt"`
	Attachments   []string  `json:"attachments"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

// BranchManager represents a branch manager
type BranchManager struct {
	ManagerID     string    `json:"managerID"`
	TenantID      string    `json:"tenantID"`
	BranchID      string    `json:"branchID"`
	EmployeeID    string    `json:"employeeID"`
	FirstName     string    `json:"firstName"`
	LastName      string    `json:"lastName"`
	Email         string    `json:"email"`
	Phone         string    `json:"phone"`
	ApprovalLimit int64     `json:"approvalLimit"`
	Status        string    `json:"status"`
	StartDate     time.Time `json:"startDate"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

// BranchDashboard represents the branch manager dashboard
type BranchDashboard struct {
	BranchID          string `json:"branchID"`
	BranchName        string `json:"branchName"`
	
	// Today's Summary
	TodayTransactions    int   `json:"todayTransactions"`
	TodayDeposits        int64 `json:"todayDeposits"`
	TodayWithdrawals     int64 `json:"todayWithdrawals"`
	TodayNewAccounts     int   `json:"todayNewAccounts"`
	TodayCustomersServed int   `json:"todayCustomersServed"`
	
	// Staff Summary
	TotalStaff           int `json:"totalStaff"`
	PresentToday         int `json:"presentToday"`
	OnLeave              int `json:"onLeave"`
	
	// Pending Approvals
	PendingApprovals     int `json:"pendingApprovals"`
	UrgentApprovals      int `json:"urgentApprovals"`
	PendingLeaveRequests int `json:"pendingLeaveRequests"`
	
	// Cash Position
	CurrentCashPosition  int64 `json:"currentCashPosition"`
	CashLimit            int64 `json:"cashLimit"`
	CashUtilization      float64 `json:"cashUtilization"`
	
	// Performance
	MTDDeposits          int64   `json:"mtdDeposits"`
	MTDTarget            int64   `json:"mtdTarget"`
	TargetAchievement    float64 `json:"targetAchievement"`
	CustomerSatisfaction float64 `json:"customerSatisfaction"`
	
	// Incidents
	OpenIncidents        int `json:"openIncidents"`
	CriticalIncidents    int `json:"criticalIncidents"`
	
	// Queue Status
	CurrentQueueLength   int     `json:"currentQueueLength"`
	AvgWaitTime          float64 `json:"avgWaitTime"`
}

// Request/Response types
type CreateBranchRequest struct {
	BranchCode  string   `json:"branchCode"`
	BranchName  string   `json:"branchName"`
	BranchType  string   `json:"branchType"`
	Region      string   `json:"region"`
	State       string   `json:"state"`
	LGA         string   `json:"lga"`
	Address     string   `json:"address"`
	Phone       string   `json:"phone"`
	Email       string   `json:"email"`
	OpeningTime string   `json:"openingTime"`
	ClosingTime string   `json:"closingTime"`
	WorkingDays []string `json:"workingDays"`
	Latitude    float64  `json:"latitude"`
	Longitude   float64  `json:"longitude"`
}

type CreateStaffRequest struct {
	EmployeeID     string   `json:"employeeID"`
	FirstName      string   `json:"firstName"`
	LastName       string   `json:"lastName"`
	Email          string   `json:"email"`
	Phone          string   `json:"phone"`
	Role           string   `json:"role"`
	Department     string   `json:"department"`
	Supervisor     string   `json:"supervisor"`
	Skills         []string `json:"skills"`
	Certifications []string `json:"certifications"`
}

type CreateScheduleRequest struct {
	StaffID      string `json:"staffID"`
	ScheduleDate string `json:"scheduleDate"`
	ShiftType    string `json:"shiftType"`
	StartTime    string `json:"startTime"`
	EndTime      string `json:"endTime"`
	Position     string `json:"position"`
	Notes        string `json:"notes"`
}

type CreateLeaveRequest struct {
	StaffID   string `json:"staffID"`
	LeaveType string `json:"leaveType"`
	StartDate string `json:"startDate"`
	EndDate   string `json:"endDate"`
	Reason    string `json:"reason"`
}

type CreateApprovalRequest struct {
	RequestType     string                 `json:"requestType"`
	ReferenceID     string                 `json:"referenceID"`
	CustomerID      string                 `json:"customerID"`
	CustomerName    string                 `json:"customerName"`
	Amount          int64                  `json:"amount"`
	Currency        string                 `json:"currency"`
	Description     string                 `json:"description"`
	Priority        string                 `json:"priority"`
	Details         map[string]interface{} `json:"details"`
}

type ApproveRequestPayload struct {
	RequestID string `json:"requestID"`
	Notes     string `json:"notes"`
}

type RejectRequestPayload struct {
	RequestID string `json:"requestID"`
	Reason    string `json:"reason"`
}

type CreateTargetRequest struct {
	Period      string `json:"period"`
	Year        int    `json:"year"`
	Month       int    `json:"month"`
	Quarter     int    `json:"quarter"`
	TargetType  string `json:"targetType"`
	TargetValue int64  `json:"targetValue"`
	Currency    string `json:"currency"`
}

type CreateCashRequestPayload struct {
	RequestType   string `json:"requestType"`
	Amount        int64  `json:"amount"`
	Currency      string `json:"currency"`
	Reason        string `json:"reason"`
	Priority      string `json:"priority"`
	ScheduledDate string `json:"scheduledDate"`
}

type CreateIncidentRequest struct {
	IncidentType string   `json:"incidentType"`
	Severity     string   `json:"severity"`
	Title        string   `json:"title"`
	Description  string   `json:"description"`
	Attachments  []string `json:"attachments"`
}
