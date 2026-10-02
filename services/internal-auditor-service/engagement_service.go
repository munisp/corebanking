package main

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// EngagementService handles audit engagement operations
type EngagementService struct {
	tenantID    string
	engagements *repo[AuditEngagement]
	mu          sync.RWMutex
}

// NewEngagementService creates a new engagement service
func NewEngagementService(tenantID string) *EngagementService {
	svc := &EngagementService{
		tenantID:    tenantID,
		engagements: newRepo[AuditEngagement](serviceDB, "audit_engagements"),
	}
	svc.initializeDefaultData(tenantID)
	return svc
}

func (s *EngagementService) initializeDefaultData(tenantID string) {
	// Active fieldwork engagement
	s.engagements.seed(tenantID, "eng-001", &AuditEngagement{
		EngagementID:   "eng-001",
		TenantID:       tenantID,
		PlanID:         "plan-001",
		EngagementName: "Branch Operations Audit - Lagos Main",
		AuditType:      "operational",
		Scope:          "Cash handling, customer service, and operational controls",
		Objectives:     []string{"Assess cash handling procedures", "Review customer service quality", "Evaluate operational efficiency"},
		Department:     "Operations",
		BranchID:       "branch-001",
		StartDate:      time.Now().AddDate(0, 0, -10),
		EndDate:        time.Now().AddDate(0, 0, 20),
		Status:         "fieldwork",
		LeadAuditor:    "auditor-001",
		TeamMembers:    []string{"auditor-002"},
		RiskAssessment: "high",
		ControlsTested: 15,
		FindingsCount:  3,
		Metadata:       make(map[string]interface{}),
		CreatedAt:      time.Now().AddDate(0, 0, -15),
		UpdatedAt:      time.Now(),
	})

	// Planning engagement
	s.engagements.seed(tenantID, "eng-002", &AuditEngagement{
		EngagementID:   "eng-002",
		TenantID:       tenantID,
		PlanID:         "plan-001",
		EngagementName: "Branch Operations Audit - Abuja",
		AuditType:      "operational",
		Scope:          "Cash handling, customer service, and operational controls",
		Objectives:     []string{"Assess cash handling procedures", "Review customer service quality"},
		Department:     "Operations",
		BranchID:       "branch-002",
		StartDate:      time.Now().AddDate(0, 0, 5),
		EndDate:        time.Now().AddDate(0, 0, 35),
		Status:         "planning",
		LeadAuditor:    "auditor-003",
		TeamMembers:    []string{},
		RiskAssessment: "medium",
		ControlsTested: 0,
		FindingsCount:  0,
		Metadata:       make(map[string]interface{}),
		CreatedAt:      time.Now().AddDate(0, 0, -5),
		UpdatedAt:      time.Now().AddDate(0, 0, -5),
	})

	// Reporting engagement
	s.engagements.seed(tenantID, "eng-003", &AuditEngagement{
		EngagementID:   "eng-003",
		TenantID:       tenantID,
		PlanID:         "plan-004",
		EngagementName: "Q4 2025 Financial Controls Review",
		AuditType:      "financial",
		Scope:          "Financial reporting controls and reconciliation processes",
		Objectives:     []string{"Verify financial accuracy", "Assess reconciliation controls"},
		Department:     "Finance",
		StartDate:      time.Now().AddDate(0, -2, 0),
		EndDate:        time.Now().AddDate(0, -1, 0),
		Status:         "reporting",
		LeadAuditor:    "auditor-001",
		TeamMembers:    []string{"auditor-002"},
		RiskAssessment: "medium",
		ControlsTested: 25,
		FindingsCount:  5,
		ReportID:       "report-001",
		Metadata:       make(map[string]interface{}),
		CreatedAt:      time.Now().AddDate(0, -2, -15),
		UpdatedAt:      time.Now().AddDate(0, 0, -5),
	})

	// Closed engagement
	s.engagements.seed(tenantID, "eng-004", &AuditEngagement{
		EngagementID:   "eng-004",
		TenantID:       tenantID,
		PlanID:         "plan-004",
		EngagementName: "Treasury Operations Audit",
		AuditType:      "operational",
		Scope:          "Treasury operations and investment controls",
		Objectives:     []string{"Assess treasury controls", "Review investment processes"},
		Department:     "Treasury",
		StartDate:      time.Now().AddDate(0, -3, 0),
		EndDate:        time.Now().AddDate(0, -2, 0),
		Status:         "closed",
		LeadAuditor:    "auditor-004",
		TeamMembers:    []string{"auditor-001"},
		RiskAssessment: "high",
		ControlsTested: 20,
		FindingsCount:  2,
		ReportID:       "report-002",
		Metadata:       make(map[string]interface{}),
		CreatedAt:      time.Now().AddDate(0, -3, -15),
		UpdatedAt:      time.Now().AddDate(0, -1, -15),
	})
}

// ListEngagements returns engagements based on filters
func (s *EngagementService) ListEngagements(tenantID, status string) ([]*AuditEngagement, error) {

	var result []*AuditEngagement
	__ALL__, __ERR__ := s.engagements.list(tenantID)
	if __ERR__ != nil {
		return nil, __ERR__
	}
	for _, eng := range __ALL__ {
		if eng.TenantID != tenantID {
			continue
		}
		if status != "" && eng.Status != status {
			continue
		}
		result = append(result, eng)
	}
	return result, nil
}

// GetEngagement retrieves an engagement by ID
func (s *EngagementService) GetEngagement(tenantID, engagementID string) (*AuditEngagement, error) {

	eng, err := s.engagements.get(tenantID, engagementID)
	if err != nil {
		return nil, errors.New("engagement not found")
	}
	return eng, nil
}

// CreateEngagement creates a new engagement
func (s *EngagementService) CreateEngagement(tenantID, auditorID string, eng *AuditEngagement) (*AuditEngagement, error) {

	eng.EngagementID = uuid.New().String()
	eng.TenantID = tenantID
	eng.Status = "planning"
	eng.LeadAuditor = auditorID
	eng.ControlsTested = 0
	eng.FindingsCount = 0
	eng.Metadata = make(map[string]interface{})
	eng.CreatedAt = time.Now()
	eng.UpdatedAt = time.Now()

	if err := s.engagements.put(tenantID, eng.EngagementID, eng); err != nil {
		return nil, err
	}
	return eng, nil
}

// UpdateEngagement updates an engagement
func (s *EngagementService) UpdateEngagement(eng *AuditEngagement) error {

	existing, err := s.engagements.get(eng.TenantID, eng.EngagementID)
	if err != nil {
		return errors.New("engagement not found")
	}

	eng.CreatedAt = existing.CreatedAt
	eng.UpdatedAt = time.Now()
	return s.engagements.put(eng.TenantID, eng.EngagementID, eng)
}

// StartFieldwork starts fieldwork phase
func (s *EngagementService) StartFieldwork(tenantID, engagementID string) (*AuditEngagement, error) {
	return s.engagements.update(tenantID, engagementID, func(eng *AuditEngagement) error {
		if eng.Status != "planning" {
			return errors.New("engagement is not in planning phase")
		}

		eng.Status = "fieldwork"
		eng.UpdatedAt = time.Now()

		return nil
	})
}

// StartReporting starts reporting phase
func (s *EngagementService) StartReporting(tenantID, engagementID string) (*AuditEngagement, error) {
	return s.engagements.update(tenantID, engagementID, func(eng *AuditEngagement) error {
		if eng.Status != "fieldwork" {
			return errors.New("engagement is not in fieldwork phase")
		}

		eng.Status = "reporting"
		eng.UpdatedAt = time.Now()

		return nil
	})
}

// CloseEngagement closes an engagement
func (s *EngagementService) CloseEngagement(tenantID, engagementID string) (*AuditEngagement, error) {
	return s.engagements.update(tenantID, engagementID, func(eng *AuditEngagement) error {
		if eng.Status != "reporting" && eng.Status != "review" {
			return errors.New("engagement cannot be closed from current status")
		}

		eng.Status = "closed"
		eng.UpdatedAt = time.Now()

		return nil
	})
}

// GetActiveEngagements returns active engagements
func (s *EngagementService) GetActiveEngagements(tenantID string) ([]*AuditEngagement, error) {

	var result []*AuditEngagement
	__ALL__, __ERR__ := s.engagements.list(tenantID)
	if __ERR__ != nil {
		return nil, __ERR__
	}
	for _, eng := range __ALL__ {
		if eng.TenantID != tenantID {
			continue
		}
		if eng.Status == "planning" || eng.Status == "fieldwork" || eng.Status == "reporting" || eng.Status == "review" {
			result = append(result, eng)
		}
	}
	return result, nil
}

// IncrementControlsTested increments controls tested count
func (s *EngagementService) IncrementControlsTested(tenantID, engagementID string) error {

	eng, err := s.engagements.get(tenantID, engagementID)
	if err != nil {
		return errors.New("engagement not found")
	}

	eng.ControlsTested++
	eng.UpdatedAt = time.Now()
	return nil
}

// IncrementFindingsCount increments findings count
func (s *EngagementService) IncrementFindingsCount(tenantID, engagementID string) error {

	eng, err := s.engagements.get(tenantID, engagementID)
	if err != nil {
		return errors.New("engagement not found")
	}

	eng.FindingsCount++
	eng.UpdatedAt = time.Now()
	return nil
}
