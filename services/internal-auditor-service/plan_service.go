package main

import (
	"errors"
	"strconv"
	"sync"
	"time"

	"github.com/google/uuid"
)

// PlanService handles audit plan operations
type PlanService struct {
	tenantID string
	plans    *repo[AuditPlan]
	mu       sync.RWMutex
}

// NewPlanService creates a new plan service
func NewPlanService(tenantID string) *PlanService {
	svc := &PlanService{
		tenantID: tenantID,
		plans:    newRepo[AuditPlan](serviceDB, "audit_plans"),
	}
	svc.initializeDefaultData(tenantID)
	return svc
}

func (s *PlanService) initializeDefaultData(tenantID string) {
	approvedAt := time.Now().AddDate(0, -1, 0)
	startDate := time.Now().AddDate(0, 0, -15)

	// Annual operational audit plan
	s.plans.seed(tenantID, "plan-001", &AuditPlan{
		PlanID:           "plan-001",
		TenantID:         tenantID,
		PlanName:         "2026 Annual Operational Audit Plan",
		PlanYear:         2026,
		AuditType:        "operational",
		Scope:            "All operational processes across branches",
		Objectives:       []string{"Assess operational efficiency", "Identify control weaknesses", "Evaluate compliance with policies"},
		RiskRating:       "high",
		Department:       "Operations",
		PlannedStartDate: time.Now().AddDate(0, 0, -30),
		PlannedEndDate:   time.Now().AddDate(0, 3, 0),
		ActualStartDate:  &startDate,
		Status:           "in_progress",
		LeadAuditor:      "auditor-001",
		TeamMembers:      []string{"auditor-002", "auditor-003"},
		BudgetHours:      500,
		ActualHours:      150,
		ApprovedBy:       "auditor-005",
		ApprovedAt:       &approvedAt,
		Metadata:         make(map[string]interface{}),
		CreatedAt:        time.Now().AddDate(0, -2, 0),
		UpdatedAt:        time.Now(),
	})

	// IT audit plan
	s.plans.seed(tenantID, "plan-002", &AuditPlan{
		PlanID:           "plan-002",
		TenantID:         tenantID,
		PlanName:         "Core Banking System IT Audit",
		PlanYear:         2026,
		AuditType:        "it",
		Scope:            "Core banking application and infrastructure",
		Objectives:       []string{"Assess IT general controls", "Evaluate cybersecurity posture", "Review access management"},
		RiskRating:       "high",
		Department:       "IT",
		PlannedStartDate: time.Now().AddDate(0, 1, 0),
		PlannedEndDate:   time.Now().AddDate(0, 3, 0),
		Status:           "approved",
		LeadAuditor:      "auditor-004",
		TeamMembers:      []string{"auditor-002"},
		BudgetHours:      300,
		ActualHours:      0,
		ApprovedBy:       "auditor-005",
		ApprovedAt:       &approvedAt,
		Metadata:         make(map[string]interface{}),
		CreatedAt:        time.Now().AddDate(0, -1, 0),
		UpdatedAt:        time.Now().AddDate(0, -1, 0),
	})

	// Compliance audit plan
	s.plans.seed(tenantID, "plan-003", &AuditPlan{
		PlanID:           "plan-003",
		TenantID:         tenantID,
		PlanName:         "AML/CFT Compliance Audit",
		PlanYear:         2026,
		AuditType:        "compliance",
		Scope:            "AML/CFT policies, procedures, and controls",
		Objectives:       []string{"Assess AML program effectiveness", "Review KYC processes", "Evaluate transaction monitoring"},
		RiskRating:       "high",
		Department:       "Compliance",
		PlannedStartDate: time.Now().AddDate(0, 2, 0),
		PlannedEndDate:   time.Now().AddDate(0, 4, 0),
		Status:           "draft",
		LeadAuditor:      "auditor-003",
		TeamMembers:      []string{"auditor-001"},
		BudgetHours:      400,
		ActualHours:      0,
		Metadata:         make(map[string]interface{}),
		CreatedAt:        time.Now().AddDate(0, 0, -7),
		UpdatedAt:        time.Now().AddDate(0, 0, -7),
	})

	// Completed financial audit
	endDate := time.Now().AddDate(0, -1, 0)
	s.plans.seed(tenantID, "plan-004", &AuditPlan{
		PlanID:           "plan-004",
		TenantID:         tenantID,
		PlanName:         "Q4 2025 Financial Audit",
		PlanYear:         2025,
		AuditType:        "financial",
		Scope:            "Financial statements and accounting controls",
		Objectives:       []string{"Verify financial accuracy", "Assess accounting controls", "Review reconciliation processes"},
		RiskRating:       "medium",
		Department:       "Finance",
		PlannedStartDate: time.Now().AddDate(0, -3, 0),
		PlannedEndDate:   time.Now().AddDate(0, -1, 0),
		ActualStartDate:  &startDate,
		ActualEndDate:    &endDate,
		Status:           "completed",
		LeadAuditor:      "auditor-001",
		TeamMembers:      []string{"auditor-002"},
		BudgetHours:      200,
		ActualHours:      185,
		ApprovedBy:       "auditor-005",
		ApprovedAt:       &approvedAt,
		Metadata:         make(map[string]interface{}),
		CreatedAt:        time.Now().AddDate(0, -4, 0),
		UpdatedAt:        time.Now().AddDate(0, -1, 0),
	})
}

// ListPlans returns plans based on filters
func (s *PlanService) ListPlans(tenantID, status, auditType string) ([]*AuditPlan, error) {

	var result []*AuditPlan
	__ALL__, __ERR__ := s.plans.list(tenantID)
	if __ERR__ != nil {
		return nil, __ERR__
	}
	for _, plan := range __ALL__ {
		if plan.TenantID != tenantID {
			continue
		}
		if status != "" && plan.Status != status {
			continue
		}
		if auditType != "" && plan.AuditType != auditType {
			continue
		}
		result = append(result, plan)
	}
	return result, nil
}

// GetPlan retrieves a plan by ID
func (s *PlanService) GetPlan(tenantID, planID string) (*AuditPlan, error) {

	plan, err := s.plans.get(tenantID, planID)
	if err != nil {
		return nil, errors.New("plan not found")
	}
	return plan, nil
}

// CreatePlan creates a new audit plan
func (s *PlanService) CreatePlan(tenantID, auditorID string, req *CreatePlanRequest) (*AuditPlan, error) {

	startDate, _ := time.Parse("2006-01-02", req.PlannedStartDate)
	endDate, _ := time.Parse("2006-01-02", req.PlannedEndDate)

	plan := &AuditPlan{
		PlanID:           uuid.New().String(),
		TenantID:         tenantID,
		PlanName:         req.PlanName,
		PlanYear:         req.PlanYear,
		AuditType:        req.AuditType,
		Scope:            req.Scope,
		Objectives:       req.Objectives,
		RiskRating:       req.RiskRating,
		Department:       req.Department,
		PlannedStartDate: startDate,
		PlannedEndDate:   endDate,
		Status:           "draft",
		LeadAuditor:      auditorID,
		TeamMembers:      []string{},
		BudgetHours:      req.BudgetHours,
		ActualHours:      0,
		Metadata:         make(map[string]interface{}),
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	if err := s.plans.put(tenantID, plan.PlanID, plan); err != nil {
		return nil, err
	}
	return plan, nil
}

// UpdatePlan updates a plan
func (s *PlanService) UpdatePlan(plan *AuditPlan) error {

	existing, err := s.plans.get(plan.TenantID, plan.PlanID)
	if err != nil {
		return errors.New("plan not found")
	}

	plan.CreatedAt = existing.CreatedAt
	plan.UpdatedAt = time.Now()
	return s.plans.put(plan.TenantID, plan.PlanID, plan)
}

// ApprovePlan approves a plan
func (s *PlanService) ApprovePlan(tenantID, planID, approverID string) (*AuditPlan, error) {
	return s.plans.update(tenantID, planID, func(plan *AuditPlan) error {
		if plan.Status != "draft" {
			return errors.New("plan is not in draft status")
		}

		now := time.Now()
		plan.Status = "approved"
		plan.ApprovedBy = approverID
		plan.ApprovedAt = &now
		plan.UpdatedAt = now

		return nil
	})
}

// StartPlan starts a plan
func (s *PlanService) StartPlan(tenantID, planID string) (*AuditPlan, error) {
	return s.plans.update(tenantID, planID, func(plan *AuditPlan) error {
		if plan.Status != "approved" {
			return errors.New("plan is not approved")
		}

		now := time.Now()
		plan.Status = "in_progress"
		plan.ActualStartDate = &now
		plan.UpdatedAt = now

		return nil
	})
}

// CompletePlan completes a plan
func (s *PlanService) CompletePlan(tenantID, planID string) (*AuditPlan, error) {
	return s.plans.update(tenantID, planID, func(plan *AuditPlan) error {
		if plan.Status != "in_progress" {
			return errors.New("plan is not in progress")
		}

		now := time.Now()
		plan.Status = "completed"
		plan.ActualEndDate = &now
		plan.UpdatedAt = now

		return nil
	})
}

// GetPlansByYear returns plans for a specific year
func (s *PlanService) GetPlansByYear(tenantID, year string) ([]*AuditPlan, error) {

	yearInt, _ := strconv.Atoi(year)
	var result []*AuditPlan
	__ALL__, __ERR__ := s.plans.list(tenantID)
	if __ERR__ != nil {
		return nil, __ERR__
	}
	for _, plan := range __ALL__ {
		if plan.TenantID != tenantID {
			continue
		}
		if plan.PlanYear == yearInt {
			result = append(result, plan)
		}
	}
	return result, nil
}

// GetSummary returns plan summary
func (s *PlanService) GetSummary(tenantID string) (map[string]interface{}, error) {

	var total, draft, approved, inProgress, completed int

	__ALL__, __ERR__ := s.plans.list(tenantID)
	if __ERR__ != nil {
		return nil, __ERR__
	}
	for _, plan := range __ALL__ {
		if plan.TenantID != tenantID {
			continue
		}
		total++
		switch plan.Status {
		case "draft":
			draft++
		case "approved":
			approved++
		case "in_progress":
			inProgress++
		case "completed":
			completed++
		}
	}

	return map[string]interface{}{
		"totalPlans": total,
		"draft":      draft,
		"approved":   approved,
		"inProgress": inProgress,
		"completed":  completed,
		"timestamp":  time.Now().Format(time.RFC3339),
	}, nil
}
