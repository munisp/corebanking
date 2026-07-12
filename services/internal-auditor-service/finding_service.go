package main

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// FindingService handles audit finding operations
type FindingService struct {
	tenantID string
	findings map[string]*AuditFinding
	mu       sync.RWMutex
}

// NewFindingService creates a new finding service
func NewFindingService(tenantID string) *FindingService {
	svc := &FindingService{
		tenantID: tenantID,
		findings: make(map[string]*AuditFinding),
	}
	svc.initializeDefaultData(tenantID)
	return svc
}

func (s *FindingService) initializeDefaultData(tenantID string) {
	targetDate := time.Now().AddDate(0, 1, 0)
	overdueDate := time.Now().AddDate(0, -1, 0)
	closedAt := time.Now().AddDate(0, 0, -10)

	// Critical open finding
	s.findings["find-001"] = &AuditFinding{
		FindingID:         "find-001",
		TenantID:          tenantID,
		EngagementID:      "eng-001",
		TestID:            "test-003",
		Title:             "Inadequate Supervisory Review of Daily Reconciliations",
		Description:       "Daily reconciliations are not being reviewed by supervisors in a timely manner",
		Condition:         "60% of daily reconciliations tested lacked evidence of supervisory review",
		Criteria:          "Bank policy requires all daily reconciliations to be reviewed and signed off by a supervisor within 24 hours",
		Cause:             "Insufficient staffing and lack of accountability for supervisory review",
		Effect:            "Errors in reconciliations may go undetected, leading to potential financial misstatements",
		Recommendation:    "Implement automated workflow for reconciliation review and establish accountability metrics",
		RiskRating:        "critical",
		Category:          "control_weakness",
		Department:        "Operations",
		ResponsiblePerson: "Branch Manager",
		Status:            "open",
		IdentifiedBy:      "auditor-002",
		IdentifiedAt:      time.Now().AddDate(0, 0, -5),
		TargetDate:        &targetDate,
		Metadata:          make(map[string]interface{}),
		CreatedAt:         time.Now().AddDate(0, 0, -5),
		UpdatedAt:         time.Now().AddDate(0, 0, -5),
	}

	// High finding with management response
	s.findings["find-002"] = &AuditFinding{
		FindingID:          "find-002",
		TenantID:           tenantID,
		EngagementID:       "eng-001",
		TestID:             "test-002",
		Title:              "Dual Authorization Not Consistently Applied",
		Description:        "Large transactions are not consistently receiving dual authorization",
		Condition:          "3 out of 25 large transactions tested did not have dual authorization",
		Criteria:           "All transactions above NGN 5,000,000 require dual authorization",
		Cause:              "Staff not following established procedures during peak hours",
		Effect:             "Increased risk of unauthorized transactions",
		Recommendation:     "Reinforce training and implement system controls to enforce dual authorization",
		RiskRating:         "high",
		Category:           "control_weakness",
		Department:         "Operations",
		ResponsiblePerson:  "Operations Manager",
		ManagementResponse: "We acknowledge the finding and will implement system controls by end of Q1",
		ActionPlan:         "1. Update system to require dual authorization 2. Conduct staff training 3. Monitor compliance",
		Status:             "management_response",
		IdentifiedBy:       "auditor-002",
		IdentifiedAt:       time.Now().AddDate(0, 0, -7),
		TargetDate:         &targetDate,
		Metadata:           make(map[string]interface{}),
		CreatedAt:          time.Now().AddDate(0, 0, -7),
		UpdatedAt:          time.Now().AddDate(0, 0, -2),
	}

	// Medium finding in remediation
	s.findings["find-003"] = &AuditFinding{
		FindingID:          "find-003",
		TenantID:           tenantID,
		EngagementID:       "eng-003",
		TestID:             "test-006",
		Title:              "Incomplete Documentation of Journal Entries",
		Description:        "Journal entries lack adequate supporting documentation",
		Condition:          "15% of journal entries tested had incomplete supporting documentation",
		Criteria:           "All journal entries must have complete supporting documentation attached",
		Cause:              "Lack of clear documentation requirements and training",
		Effect:             "Difficulty in verifying accuracy of financial records",
		Recommendation:     "Establish clear documentation standards and provide training",
		RiskRating:         "medium",
		Category:           "compliance",
		Department:         "Finance",
		ResponsiblePerson:  "Finance Manager",
		ManagementResponse: "Documentation standards have been updated and training scheduled",
		ActionPlan:         "Training to be completed by end of month",
		Status:             "remediation",
		IdentifiedBy:       "auditor-001",
		IdentifiedAt:       time.Now().AddDate(0, -1, 0),
		TargetDate:         &targetDate,
		Metadata:           make(map[string]interface{}),
		CreatedAt:          time.Now().AddDate(0, -1, 0),
		UpdatedAt:          time.Now().AddDate(0, 0, -5),
	}

	// Overdue finding
	s.findings["find-004"] = &AuditFinding{
		FindingID:          "find-004",
		TenantID:           tenantID,
		EngagementID:       "eng-004",
		TestID:             "test-007",
		Title:              "Weak Password Policy for Treasury System",
		Description:        "Treasury system password policy does not meet security standards",
		Condition:          "Password policy allows weak passwords and no expiration",
		Criteria:           "Passwords must be complex and expire every 90 days",
		Cause:              "Legacy system limitations",
		Effect:             "Increased risk of unauthorized access to treasury system",
		Recommendation:     "Upgrade system or implement compensating controls",
		RiskRating:         "high",
		Category:           "control_weakness",
		Department:         "IT",
		ResponsiblePerson:  "IT Manager",
		ManagementResponse: "System upgrade planned for Q2",
		ActionPlan:         "Implement compensating controls until upgrade",
		Status:             "overdue",
		IdentifiedBy:       "auditor-004",
		IdentifiedAt:       time.Now().AddDate(0, -3, 0),
		TargetDate:         &overdueDate,
		Metadata:           make(map[string]interface{}),
		CreatedAt:          time.Now().AddDate(0, -3, 0),
		UpdatedAt:          time.Now().AddDate(0, 0, -15),
	}

	// Closed finding
	s.findings["find-005"] = &AuditFinding{
		FindingID:          "find-005",
		TenantID:           tenantID,
		EngagementID:       "eng-004",
		TestID:             "test-008",
		Title:              "Segregation of Duties Violation in Treasury",
		Description:        "Same person can initiate and approve treasury transactions",
		Condition:          "System allows single user to complete full transaction cycle",
		Criteria:           "Segregation of duties required for all treasury transactions",
		Cause:              "System configuration error",
		Effect:             "Increased fraud risk",
		Recommendation:     "Reconfigure system to enforce segregation of duties",
		RiskRating:         "high",
		Category:           "control_weakness",
		Department:         "Treasury",
		ResponsiblePerson:  "Treasury Manager",
		ManagementResponse: "System has been reconfigured",
		ActionPlan:         "Completed",
		Status:             "closed",
		IdentifiedBy:       "auditor-004",
		IdentifiedAt:       time.Now().AddDate(0, -2, 0),
		TargetDate:         &overdueDate,
		ClosedBy:           "auditor-001",
		ClosedAt:           &closedAt,
		Metadata:           make(map[string]interface{}),
		CreatedAt:          time.Now().AddDate(0, -2, 0),
		UpdatedAt:          time.Now().AddDate(0, 0, -10),
	}
}

// ListFindings returns findings based on filters
func (s *FindingService) ListFindings(tenantID, status, riskRating string) []*AuditFinding {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*AuditFinding
	for _, finding := range s.findings {
		if finding.TenantID != tenantID {
			continue
		}
		if status != "" && finding.Status != status {
			continue
		}
		if riskRating != "" && finding.RiskRating != riskRating {
			continue
		}
		result = append(result, finding)
	}
	return result
}

// GetFinding retrieves a finding by ID
func (s *FindingService) GetFinding(tenantID, findingID string) (*AuditFinding, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	finding, exists := s.findings[findingID]
	if !exists || finding.TenantID != tenantID {
		return nil, errors.New("finding not found")
	}
	return finding, nil
}

// CreateFinding creates a new finding
func (s *FindingService) CreateFinding(tenantID, auditorID string, req *CreateFindingRequest) (*AuditFinding, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	finding := &AuditFinding{
		FindingID:      uuid.New().String(),
		TenantID:       tenantID,
		EngagementID:   req.EngagementID,
		Title:          req.Title,
		Description:    req.Description,
		Condition:      req.Condition,
		Criteria:       req.Criteria,
		Cause:          req.Cause,
		Effect:         req.Effect,
		Recommendation: req.Recommendation,
		RiskRating:     req.RiskRating,
		Category:       req.Category,
		Department:     req.Department,
		Status:         "draft",
		IdentifiedBy:   auditorID,
		IdentifiedAt:   time.Now(),
		Metadata:       make(map[string]interface{}),
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	s.findings[finding.FindingID] = finding
	return finding, nil
}

// UpdateFinding updates a finding
func (s *FindingService) UpdateFinding(finding *AuditFinding) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	existing, exists := s.findings[finding.FindingID]
	if !exists || existing.TenantID != finding.TenantID {
		return errors.New("finding not found")
	}

	finding.CreatedAt = existing.CreatedAt
	finding.UpdatedAt = time.Now()
	s.findings[finding.FindingID] = finding
	return nil
}

// SubmitManagementResponse submits management response
func (s *FindingService) SubmitManagementResponse(tenantID, findingID string, req *ManagementResponseRequest) (*AuditFinding, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	finding, exists := s.findings[findingID]
	if !exists || finding.TenantID != tenantID {
		return nil, errors.New("finding not found")
	}

	targetDate, _ := time.Parse("2006-01-02", req.TargetDate)
	finding.ManagementResponse = req.Response
	finding.ActionPlan = req.ActionPlan
	finding.TargetDate = &targetDate
	finding.Status = "management_response"
	finding.UpdatedAt = time.Now()

	return finding, nil
}

// CloseFinding closes a finding
func (s *FindingService) CloseFinding(tenantID, findingID, auditorID string) (*AuditFinding, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	finding, exists := s.findings[findingID]
	if !exists || finding.TenantID != tenantID {
		return nil, errors.New("finding not found")
	}

	now := time.Now()
	finding.Status = "closed"
	finding.ClosedBy = auditorID
	finding.ClosedAt = &now
	finding.UpdatedAt = now

	return finding, nil
}

// GetOpenFindings returns open findings
func (s *FindingService) GetOpenFindings(tenantID string) []*AuditFinding {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*AuditFinding
	for _, finding := range s.findings {
		if finding.TenantID != tenantID {
			continue
		}
		if finding.Status != "closed" {
			result = append(result, finding)
		}
	}
	return result
}

// GetOverdueFindings returns overdue findings
func (s *FindingService) GetOverdueFindings(tenantID string) []*AuditFinding {
	s.mu.RLock()
	defer s.mu.RUnlock()

	now := time.Now()
	var result []*AuditFinding
	for _, finding := range s.findings {
		if finding.TenantID != tenantID {
			continue
		}
		if finding.Status == "closed" {
			continue
		}
		if finding.TargetDate != nil && finding.TargetDate.Before(now) {
			result = append(result, finding)
		}
	}
	return result
}

// GetEngagementFindings returns findings for an engagement
func (s *FindingService) GetEngagementFindings(tenantID, engagementID string) []*AuditFinding {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*AuditFinding
	for _, finding := range s.findings {
		if finding.TenantID != tenantID {
			continue
		}
		if finding.EngagementID == engagementID {
			result = append(result, finding)
		}
	}
	return result
}

// GetSummary returns finding summary
func (s *FindingService) GetSummary(tenantID string) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var total, open, critical, high, medium, low, overdue, closed int
	now := time.Now()

	for _, finding := range s.findings {
		if finding.TenantID != tenantID {
			continue
		}
		total++

		if finding.Status != "closed" {
			open++
			if finding.TargetDate != nil && finding.TargetDate.Before(now) {
				overdue++
			}
		} else {
			closed++
		}

		switch finding.RiskRating {
		case "critical":
			critical++
		case "high":
			high++
		case "medium":
			medium++
		case "low":
			low++
		}
	}

	return map[string]interface{}{
		"totalFindings":    total,
		"openFindings":     open,
		"closedFindings":   closed,
		"criticalFindings": critical,
		"highFindings":     high,
		"mediumFindings":   medium,
		"lowFindings":      low,
		"overdueFindings":  overdue,
		"timestamp":        time.Now().Format(time.RFC3339),
	}
}
