package main

import "time"

// AuditPlan represents an audit plan
type AuditPlan struct {
	PlanID          string                 `json:"planID"`
	TenantID        string                 `json:"tenantID"`
	PlanName        string                 `json:"planName"`
	PlanYear        int                    `json:"planYear"`
	AuditType       string                 `json:"auditType"` // operational, financial, compliance, it, fraud
	Scope           string                 `json:"scope"`
	Objectives      []string               `json:"objectives"`
	RiskRating      string                 `json:"riskRating"` // high, medium, low
	Department      string                 `json:"department"`
	BranchID        string                 `json:"branchID"`
	PlannedStartDate time.Time             `json:"plannedStartDate"`
	PlannedEndDate  time.Time              `json:"plannedEndDate"`
	ActualStartDate *time.Time             `json:"actualStartDate"`
	ActualEndDate   *time.Time             `json:"actualEndDate"`
	Status          string                 `json:"status"` // draft, approved, in_progress, completed, cancelled
	LeadAuditor     string                 `json:"leadAuditor"`
	TeamMembers     []string               `json:"teamMembers"`
	BudgetHours     int                    `json:"budgetHours"`
	ActualHours     int                    `json:"actualHours"`
	ApprovedBy      string                 `json:"approvedBy"`
	ApprovedAt      *time.Time             `json:"approvedAt"`
	Metadata        map[string]interface{} `json:"metadata"`
	CreatedAt       time.Time              `json:"createdAt"`
	UpdatedAt       time.Time              `json:"updatedAt"`
}

// AuditEngagement represents an audit engagement
type AuditEngagement struct {
	EngagementID    string                 `json:"engagementID"`
	TenantID        string                 `json:"tenantID"`
	PlanID          string                 `json:"planID"`
	EngagementName  string                 `json:"engagementName"`
	AuditType       string                 `json:"auditType"`
	Scope           string                 `json:"scope"`
	Objectives      []string               `json:"objectives"`
	Department      string                 `json:"department"`
	BranchID        string                 `json:"branchID"`
	StartDate       time.Time              `json:"startDate"`
	EndDate         time.Time              `json:"endDate"`
	Status          string                 `json:"status"` // planning, fieldwork, reporting, review, closed
	LeadAuditor     string                 `json:"leadAuditor"`
	TeamMembers     []string               `json:"teamMembers"`
	RiskAssessment  string                 `json:"riskAssessment"`
	ControlsTested  int                    `json:"controlsTested"`
	FindingsCount   int                    `json:"findingsCount"`
	ReportID        string                 `json:"reportID"`
	Metadata        map[string]interface{} `json:"metadata"`
	CreatedAt       time.Time              `json:"createdAt"`
	UpdatedAt       time.Time              `json:"updatedAt"`
}

// ControlTest represents a control test
type ControlTest struct {
	TestID          string                 `json:"testID"`
	TenantID        string                 `json:"tenantID"`
	EngagementID    string                 `json:"engagementID"`
	ControlID       string                 `json:"controlID"`
	ControlName     string                 `json:"controlName"`
	ControlCategory string                 `json:"controlCategory"` // preventive, detective, corrective
	ControlType     string                 `json:"controlType"` // manual, automated, hybrid
	TestProcedure   string                 `json:"testProcedure"`
	SampleSize      int                    `json:"sampleSize"`
	SampleTested    int                    `json:"sampleTested"`
	ExceptionsFound int                    `json:"exceptionsFound"`
	TestResult      string                 `json:"testResult"` // effective, partially_effective, ineffective, not_tested
	Conclusion      string                 `json:"conclusion"`
	TestedBy        string                 `json:"testedBy"`
	TestedAt        *time.Time             `json:"testedAt"`
	ReviewedBy      string                 `json:"reviewedBy"`
	ReviewedAt      *time.Time             `json:"reviewedAt"`
	Status          string                 `json:"status"` // pending, in_progress, completed, reviewed
	Metadata        map[string]interface{} `json:"metadata"`
	CreatedAt       time.Time              `json:"createdAt"`
	UpdatedAt       time.Time              `json:"updatedAt"`
}

// AuditFinding represents an audit finding
type AuditFinding struct {
	FindingID       string                 `json:"findingID"`
	TenantID        string                 `json:"tenantID"`
	EngagementID    string                 `json:"engagementID"`
	TestID          string                 `json:"testID"`
	Title           string                 `json:"title"`
	Description     string                 `json:"description"`
	Condition       string                 `json:"condition"`
	Criteria        string                 `json:"criteria"`
	Cause           string                 `json:"cause"`
	Effect          string                 `json:"effect"`
	Recommendation  string                 `json:"recommendation"`
	RiskRating      string                 `json:"riskRating"` // critical, high, medium, low
	Category        string                 `json:"category"` // control_weakness, compliance, operational, fraud
	Department      string                 `json:"department"`
	ResponsiblePerson string               `json:"responsiblePerson"`
	ManagementResponse string              `json:"managementResponse"`
	ActionPlan      string                 `json:"actionPlan"`
	TargetDate      *time.Time             `json:"targetDate"`
	Status          string                 `json:"status"` // draft, open, management_response, remediation, closed, overdue
	IdentifiedBy    string                 `json:"identifiedBy"`
	IdentifiedAt    time.Time              `json:"identifiedAt"`
	ClosedBy        string                 `json:"closedBy"`
	ClosedAt        *time.Time             `json:"closedAt"`
	Metadata        map[string]interface{} `json:"metadata"`
	CreatedAt       time.Time              `json:"createdAt"`
	UpdatedAt       time.Time              `json:"updatedAt"`
}

// AuditReport represents an audit report
type AuditReport struct {
	ReportID        string                 `json:"reportID"`
	TenantID        string                 `json:"tenantID"`
	EngagementID    string                 `json:"engagementID"`
	ReportTitle     string                 `json:"reportTitle"`
	ReportType      string                 `json:"reportType"` // draft, final
	ExecutiveSummary string                `json:"executiveSummary"`
	Scope           string                 `json:"scope"`
	Methodology     string                 `json:"methodology"`
	Findings        []string               `json:"findings"` // Finding IDs
	OverallRating   string                 `json:"overallRating"` // satisfactory, needs_improvement, unsatisfactory
	Recommendations []string               `json:"recommendations"`
	PreparedBy      string                 `json:"preparedBy"`
	ReviewedBy      string                 `json:"reviewedBy"`
	ApprovedBy      string                 `json:"approvedBy"`
	IssuedDate      *time.Time             `json:"issuedDate"`
	Status          string                 `json:"status"` // draft, review, approved, issued
	Distribution    []string               `json:"distribution"`
	Metadata        map[string]interface{} `json:"metadata"`
	CreatedAt       time.Time              `json:"createdAt"`
	UpdatedAt       time.Time              `json:"updatedAt"`
}

// FollowUp represents a finding follow-up
type FollowUp struct {
	FollowUpID      string    `json:"followUpID"`
	TenantID        string    `json:"tenantID"`
	FindingID       string    `json:"findingID"`
	FollowUpDate    time.Time `json:"followUpDate"`
	Status          string    `json:"status"` // pending, in_progress, completed, overdue
	Notes           string    `json:"notes"`
	EvidenceProvided bool     `json:"evidenceProvided"`
	PercentComplete int       `json:"percentComplete"`
	FollowedUpBy    string    `json:"followedUpBy"`
	NextFollowUp    *time.Time `json:"nextFollowUp"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

// RiskAssessment represents a risk assessment
type RiskAssessment struct {
	AssessmentID    string                 `json:"assessmentID"`
	TenantID        string                 `json:"tenantID"`
	AssessmentName  string                 `json:"assessmentName"`
	AssessmentYear  int                    `json:"assessmentYear"`
	Department      string                 `json:"department"`
	Process         string                 `json:"process"`
	InherentRisk    string                 `json:"inherentRisk"` // high, medium, low
	ControlEffectiveness string            `json:"controlEffectiveness"` // strong, adequate, weak
	ResidualRisk    string                 `json:"residualRisk"` // high, medium, low
	RiskScore       int                    `json:"riskScore"` // 1-25
	AuditFrequency  string                 `json:"auditFrequency"` // annual, biennial, triennial
	LastAuditDate   *time.Time             `json:"lastAuditDate"`
	NextAuditDate   *time.Time             `json:"nextAuditDate"`
	AssessedBy      string                 `json:"assessedBy"`
	ApprovedBy      string                 `json:"approvedBy"`
	Status          string                 `json:"status"` // draft, approved
	Metadata        map[string]interface{} `json:"metadata"`
	CreatedAt       time.Time              `json:"createdAt"`
	UpdatedAt       time.Time              `json:"updatedAt"`
}

// Auditor represents an internal auditor
type Auditor struct {
	AuditorID       string    `json:"auditorID"`
	TenantID        string    `json:"tenantID"`
	EmployeeID      string    `json:"employeeID"`
	FirstName       string    `json:"firstName"`
	LastName        string    `json:"lastName"`
	Email           string    `json:"email"`
	Phone           string    `json:"phone"`
	Role            string    `json:"role"` // auditor, senior_auditor, manager, director, cae
	Specialization  string    `json:"specialization"` // operational, financial, it, compliance, fraud
	Certifications  []string  `json:"certifications"` // CIA, CISA, CFE, etc.
	Status          string    `json:"status"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

// AuditDashboard represents the audit dashboard
type AuditDashboard struct {
	Date time.Time `json:"date"`

	// Plan Summary
	TotalPlans      int `json:"totalPlans"`
	PlansInProgress int `json:"plansInProgress"`
	PlansCompleted  int `json:"plansCompleted"`

	// Engagement Summary
	ActiveEngagements   int `json:"activeEngagements"`
	EngagementsThisYear int `json:"engagementsThisYear"`

	// Findings Summary
	OpenFindings      int `json:"openFindings"`
	CriticalFindings  int `json:"criticalFindings"`
	HighFindings      int `json:"highFindings"`
	OverdueFindings   int `json:"overdueFindings"`

	// Control Testing
	ControlsTested    int     `json:"controlsTested"`
	EffectiveControls int     `json:"effectiveControls"`
	ControlEffectiveness float64 `json:"controlEffectiveness"`

	// Follow-ups
	PendingFollowUps  int `json:"pendingFollowUps"`
	OverdueFollowUps  int `json:"overdueFollowUps"`

	// Resources
	AuditorsAvailable int `json:"auditorsAvailable"`
	HoursUtilized     int `json:"hoursUtilized"`
	HoursBudgeted     int `json:"hoursBudgeted"`
}

// Request/Response types
type CreatePlanRequest struct {
	PlanName         string   `json:"planName"`
	PlanYear         int      `json:"planYear"`
	AuditType        string   `json:"auditType"`
	Scope            string   `json:"scope"`
	Objectives       []string `json:"objectives"`
	RiskRating       string   `json:"riskRating"`
	Department       string   `json:"department"`
	PlannedStartDate string   `json:"plannedStartDate"`
	PlannedEndDate   string   `json:"plannedEndDate"`
	BudgetHours      int      `json:"budgetHours"`
}

type CreateFindingRequest struct {
	EngagementID    string `json:"engagementID"`
	Title           string `json:"title"`
	Description     string `json:"description"`
	Condition       string `json:"condition"`
	Criteria        string `json:"criteria"`
	Cause           string `json:"cause"`
	Effect          string `json:"effect"`
	Recommendation  string `json:"recommendation"`
	RiskRating      string `json:"riskRating"`
	Category        string `json:"category"`
	Department      string `json:"department"`
}

type ManagementResponseRequest struct {
	Response   string `json:"response"`
	ActionPlan string `json:"actionPlan"`
	TargetDate string `json:"targetDate"`
}
