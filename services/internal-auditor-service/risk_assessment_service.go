package main

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// RiskAssessmentService handles risk assessment operations
type RiskAssessmentService struct {
	tenantID    string
	assessments *repo[RiskAssessment]
	mu          sync.RWMutex
}

// NewRiskAssessmentService creates a new risk assessment service
func NewRiskAssessmentService(tenantID string) *RiskAssessmentService {
	svc := &RiskAssessmentService{
		tenantID:    tenantID,
		assessments: newRepo[RiskAssessment](serviceDB, "audit_risk_assessments"),
	}
	svc.initializeDefaultData(tenantID)
	return svc
}

func (s *RiskAssessmentService) initializeDefaultData(tenantID string) {
	lastAudit := time.Now().AddDate(0, -6, 0)
	nextAudit := time.Now().AddDate(0, 6, 0)

	// High risk - Treasury
	s.assessments.seed(tenantID, "ra-001", &RiskAssessment{
		AssessmentID:         "ra-001",
		TenantID:             tenantID,
		AssessmentName:       "Treasury Operations Risk Assessment",
		AssessmentYear:       2026,
		Department:           "Treasury",
		Process:              "Investment Management",
		InherentRisk:         "high",
		ControlEffectiveness: "adequate",
		ResidualRisk:         "high",
		RiskScore:            20,
		AuditFrequency:       "annual",
		LastAuditDate:        &lastAudit,
		NextAuditDate:        &nextAudit,
		AssessedBy:           "auditor-001",
		ApprovedBy:           "auditor-005",
		Status:               "approved",
		Metadata:             make(map[string]interface{}),
		CreatedAt:            time.Now().AddDate(0, -1, 0),
		UpdatedAt:            time.Now().AddDate(0, -1, 0),
	})

	// High risk - IT Security
	s.assessments.seed(tenantID, "ra-002", &RiskAssessment{
		AssessmentID:         "ra-002",
		TenantID:             tenantID,
		AssessmentName:       "IT Security Risk Assessment",
		AssessmentYear:       2026,
		Department:           "IT",
		Process:              "Cybersecurity",
		InherentRisk:         "high",
		ControlEffectiveness: "weak",
		ResidualRisk:         "high",
		RiskScore:            22,
		AuditFrequency:       "annual",
		LastAuditDate:        &lastAudit,
		NextAuditDate:        &nextAudit,
		AssessedBy:           "auditor-004",
		ApprovedBy:           "auditor-005",
		Status:               "approved",
		Metadata:             make(map[string]interface{}),
		CreatedAt:            time.Now().AddDate(0, -1, 0),
		UpdatedAt:            time.Now().AddDate(0, -1, 0),
	})

	// Medium risk - Branch Operations
	s.assessments.seed(tenantID, "ra-003", &RiskAssessment{
		AssessmentID:         "ra-003",
		TenantID:             tenantID,
		AssessmentName:       "Branch Operations Risk Assessment",
		AssessmentYear:       2026,
		Department:           "Operations",
		Process:              "Cash Handling",
		InherentRisk:         "medium",
		ControlEffectiveness: "adequate",
		ResidualRisk:         "medium",
		RiskScore:            12,
		AuditFrequency:       "annual",
		LastAuditDate:        &lastAudit,
		NextAuditDate:        &nextAudit,
		AssessedBy:           "auditor-001",
		ApprovedBy:           "auditor-005",
		Status:               "approved",
		Metadata:             make(map[string]interface{}),
		CreatedAt:            time.Now().AddDate(0, -1, 0),
		UpdatedAt:            time.Now().AddDate(0, -1, 0),
	})

	// High risk - AML/CFT
	s.assessments.seed(tenantID, "ra-004", &RiskAssessment{
		AssessmentID:         "ra-004",
		TenantID:             tenantID,
		AssessmentName:       "AML/CFT Compliance Risk Assessment",
		AssessmentYear:       2026,
		Department:           "Compliance",
		Process:              "Transaction Monitoring",
		InherentRisk:         "high",
		ControlEffectiveness: "adequate",
		ResidualRisk:         "high",
		RiskScore:            18,
		AuditFrequency:       "annual",
		LastAuditDate:        &lastAudit,
		NextAuditDate:        &nextAudit,
		AssessedBy:           "auditor-003",
		ApprovedBy:           "auditor-005",
		Status:               "approved",
		Metadata:             make(map[string]interface{}),
		CreatedAt:            time.Now().AddDate(0, -1, 0),
		UpdatedAt:            time.Now().AddDate(0, -1, 0),
	})

	// Low risk - HR
	s.assessments.seed(tenantID, "ra-005", &RiskAssessment{
		AssessmentID:         "ra-005",
		TenantID:             tenantID,
		AssessmentName:       "HR Operations Risk Assessment",
		AssessmentYear:       2026,
		Department:           "HR",
		Process:              "Payroll Processing",
		InherentRisk:         "low",
		ControlEffectiveness: "strong",
		ResidualRisk:         "low",
		RiskScore:            5,
		AuditFrequency:       "triennial",
		LastAuditDate:        &lastAudit,
		NextAuditDate:        &nextAudit,
		AssessedBy:           "auditor-002",
		ApprovedBy:           "auditor-005",
		Status:               "approved",
		Metadata:             make(map[string]interface{}),
		CreatedAt:            time.Now().AddDate(0, -1, 0),
		UpdatedAt:            time.Now().AddDate(0, -1, 0),
	})

	// Draft assessment
	s.assessments.seed(tenantID, "ra-006", &RiskAssessment{
		AssessmentID:         "ra-006",
		TenantID:             tenantID,
		AssessmentName:       "Lending Operations Risk Assessment",
		AssessmentYear:       2026,
		Department:           "Credit",
		Process:              "Loan Origination",
		InherentRisk:         "high",
		ControlEffectiveness: "adequate",
		ResidualRisk:         "medium",
		RiskScore:            15,
		AuditFrequency:       "annual",
		AssessedBy:           "auditor-001",
		Status:               "draft",
		Metadata:             make(map[string]interface{}),
		CreatedAt:            time.Now().AddDate(0, 0, -5),
		UpdatedAt:            time.Now().AddDate(0, 0, -5),
	})
}

// ListAssessments returns assessments based on filters
func (s *RiskAssessmentService) ListAssessments(tenantID, status string) ([]*RiskAssessment, error) {

	var result []*RiskAssessment
	__ALL__, __ERR__ := s.assessments.list(tenantID)
	if __ERR__ != nil {
		return nil, __ERR__
	}
	for _, assessment := range __ALL__ {
		if assessment.TenantID != tenantID {
			continue
		}
		if status != "" && assessment.Status != status {
			continue
		}
		result = append(result, assessment)
	}
	return result, nil
}

// GetAssessment retrieves an assessment by ID
func (s *RiskAssessmentService) GetAssessment(tenantID, assessmentID string) (*RiskAssessment, error) {

	assessment, err := s.assessments.get(tenantID, assessmentID)
	if err != nil {
		return nil, errors.New("assessment not found")
	}
	return assessment, nil
}

// CreateAssessment creates a new assessment
func (s *RiskAssessmentService) CreateAssessment(tenantID, auditorID string, assessment *RiskAssessment) (*RiskAssessment, error) {

	assessment.AssessmentID = uuid.New().String()
	assessment.TenantID = tenantID
	assessment.Status = "draft"
	assessment.AssessedBy = auditorID
	assessment.Metadata = make(map[string]interface{})
	assessment.CreatedAt = time.Now()
	assessment.UpdatedAt = time.Now()

	// Calculate risk score
	assessment.RiskScore = s.calculateRiskScore(assessment.InherentRisk, assessment.ControlEffectiveness)

	if err := s.assessments.put(tenantID, assessment.AssessmentID, assessment); err != nil {
		return nil, err
	}
	return assessment, nil
}

// UpdateAssessment updates an assessment
func (s *RiskAssessmentService) UpdateAssessment(assessment *RiskAssessment) error {

	existing, err := s.assessments.get(assessment.TenantID, assessment.AssessmentID)
	if err != nil {
		return errors.New("assessment not found")
	}

	assessment.CreatedAt = existing.CreatedAt
	assessment.UpdatedAt = time.Now()
	assessment.RiskScore = s.calculateRiskScore(assessment.InherentRisk, assessment.ControlEffectiveness)
	return s.assessments.put(assessment.TenantID, assessment.AssessmentID, assessment)
}

// ApproveAssessment approves an assessment
func (s *RiskAssessmentService) ApproveAssessment(tenantID, assessmentID, approverID string) (*RiskAssessment, error) {
	return s.assessments.update(tenantID, assessmentID, func(assessment *RiskAssessment) error {
		if assessment.Status != "draft" {
			return errors.New("assessment is not in draft status")
		}

		assessment.ApprovedBy = approverID
		assessment.Status = "approved"
		assessment.UpdatedAt = time.Now()

		return nil
	})
}

// GetHighRiskAreas returns high risk areas
func (s *RiskAssessmentService) GetHighRiskAreas(tenantID string) ([]*RiskAssessment, error) {

	var result []*RiskAssessment
	__ALL__, __ERR__ := s.assessments.list(tenantID)
	if __ERR__ != nil {
		return nil, __ERR__
	}
	for _, assessment := range __ALL__ {
		if assessment.TenantID != tenantID {
			continue
		}
		if assessment.ResidualRisk == "high" || assessment.RiskScore >= 15 {
			result = append(result, assessment)
		}
	}
	return result, nil
}

func (s *RiskAssessmentService) calculateRiskScore(inherentRisk, controlEffectiveness string) int {
	inherentScore := 0
	switch inherentRisk {
	case "high":
		inherentScore = 5
	case "medium":
		inherentScore = 3
	case "low":
		inherentScore = 1
	}

	controlScore := 0
	switch controlEffectiveness {
	case "weak":
		controlScore = 5
	case "adequate":
		controlScore = 3
	case "strong":
		controlScore = 1
	}

	return inherentScore * controlScore
}
