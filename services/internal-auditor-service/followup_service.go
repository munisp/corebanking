package main

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// FollowUpService handles follow-up operations
type FollowUpService struct {
	tenantID  string
	followUps *repo[FollowUp]
	mu        sync.RWMutex
}

// NewFollowUpService creates a new follow-up service
func NewFollowUpService(tenantID string) *FollowUpService {
	svc := &FollowUpService{
		tenantID:  tenantID,
		followUps: newRepo[FollowUp](serviceDB, "follow_ups"),
	}
	svc.initializeDefaultData(tenantID)
	return svc
}

func (s *FollowUpService) initializeDefaultData(tenantID string) {
	nextFollowUp := time.Now().AddDate(0, 0, 14)
	overdueNext := time.Now().AddDate(0, 0, -7)

	// Pending follow-up
	s.followUps.seed(tenantID, "fu-001", &FollowUp{
		FollowUpID:       "fu-001",
		TenantID:         tenantID,
		FindingID:        "find-001",
		FollowUpDate:     time.Now().AddDate(0, 0, -3),
		Status:           "pending",
		Notes:            "Initial follow-up scheduled. Awaiting management update on remediation progress.",
		EvidenceProvided: false,
		PercentComplete:  0,
		FollowedUpBy:     "auditor-002",
		NextFollowUp:     &nextFollowUp,
		CreatedAt:        time.Now().AddDate(0, 0, -3),
		UpdatedAt:        time.Now().AddDate(0, 0, -3),
	})

	// In progress follow-up
	s.followUps.seed(tenantID, "fu-002", &FollowUp{
		FollowUpID:       "fu-002",
		TenantID:         tenantID,
		FindingID:        "find-002",
		FollowUpDate:     time.Now().AddDate(0, 0, -7),
		Status:           "in_progress",
		Notes:            "Management has started implementing system controls. Training scheduled for next week.",
		EvidenceProvided: true,
		PercentComplete:  40,
		FollowedUpBy:     "auditor-002",
		NextFollowUp:     &nextFollowUp,
		CreatedAt:        time.Now().AddDate(0, 0, -7),
		UpdatedAt:        time.Now().AddDate(0, 0, -2),
	})

	// Completed follow-up
	s.followUps.seed(tenantID, "fu-003", &FollowUp{
		FollowUpID:       "fu-003",
		TenantID:         tenantID,
		FindingID:        "find-003",
		FollowUpDate:     time.Now().AddDate(0, 0, -14),
		Status:           "completed",
		Notes:            "Documentation standards updated and training completed. Evidence reviewed and verified.",
		EvidenceProvided: true,
		PercentComplete:  100,
		FollowedUpBy:     "auditor-001",
		CreatedAt:        time.Now().AddDate(0, 0, -14),
		UpdatedAt:        time.Now().AddDate(0, 0, -5),
	})

	// Overdue follow-up
	s.followUps.seed(tenantID, "fu-004", &FollowUp{
		FollowUpID:       "fu-004",
		TenantID:         tenantID,
		FindingID:        "find-004",
		FollowUpDate:     time.Now().AddDate(0, 0, -30),
		Status:           "overdue",
		Notes:            "No response from IT Manager. Escalation required.",
		EvidenceProvided: false,
		PercentComplete:  10,
		FollowedUpBy:     "auditor-004",
		NextFollowUp:     &overdueNext,
		CreatedAt:        time.Now().AddDate(0, 0, -30),
		UpdatedAt:        time.Now().AddDate(0, 0, -7),
	})
}

// ListFollowUps returns follow-ups based on filters
func (s *FollowUpService) ListFollowUps(tenantID, status string) ([]*FollowUp, error) {

	var result []*FollowUp
	__ALL__, __ERR__ := s.followUps.list(tenantID)
	if __ERR__ != nil {
		return nil, __ERR__
	}
	for _, fu := range __ALL__ {
		if fu.TenantID != tenantID {
			continue
		}
		if status != "" && fu.Status != status {
			continue
		}
		result = append(result, fu)
	}
	return result, nil
}

// GetFollowUp retrieves a follow-up by ID
func (s *FollowUpService) GetFollowUp(tenantID, followUpID string) (*FollowUp, error) {

	fu, err := s.followUps.get(tenantID, followUpID)
	if err != nil {
		return nil, errors.New("follow-up not found")
	}
	return fu, nil
}

// CreateFollowUp creates a new follow-up
func (s *FollowUpService) CreateFollowUp(tenantID, auditorID string, fu *FollowUp) (*FollowUp, error) {

	fu.FollowUpID = uuid.New().String()
	fu.TenantID = tenantID
	fu.Status = "pending"
	fu.FollowUpDate = time.Now()
	fu.FollowedUpBy = auditorID
	fu.PercentComplete = 0
	fu.EvidenceProvided = false
	fu.CreatedAt = time.Now()
	fu.UpdatedAt = time.Now()

	if err := s.followUps.put(tenantID, fu.FollowUpID, fu); err != nil {
		return nil, err
	}
	return fu, nil
}

// UpdateFollowUp updates a follow-up
func (s *FollowUpService) UpdateFollowUp(fu *FollowUp) error {

	existing, err := s.followUps.get(fu.TenantID, fu.FollowUpID)
	if err != nil {
		return errors.New("follow-up not found")
	}

	fu.CreatedAt = existing.CreatedAt
	fu.UpdatedAt = time.Now()
	return s.followUps.put(fu.TenantID, fu.FollowUpID, fu)
}

// GetPendingFollowUps returns pending follow-ups
func (s *FollowUpService) GetPendingFollowUps(tenantID string) ([]*FollowUp, error) {

	var result []*FollowUp
	__ALL__, __ERR__ := s.followUps.list(tenantID)
	if __ERR__ != nil {
		return nil, __ERR__
	}
	for _, fu := range __ALL__ {
		if fu.TenantID != tenantID {
			continue
		}
		if fu.Status == "pending" || fu.Status == "in_progress" {
			result = append(result, fu)
		}
	}
	return result, nil
}

// GetOverdueFollowUps returns overdue follow-ups
func (s *FollowUpService) GetOverdueFollowUps(tenantID string) ([]*FollowUp, error) {

	now := time.Now()
	var result []*FollowUp
	__ALL__, __ERR__ := s.followUps.list(tenantID)
	if __ERR__ != nil {
		return nil, __ERR__
	}
	for _, fu := range __ALL__ {
		if fu.TenantID != tenantID {
			continue
		}
		if fu.Status == "overdue" {
			result = append(result, fu)
		}
		if fu.NextFollowUp != nil && fu.NextFollowUp.Before(now) && fu.Status != "completed" {
			result = append(result, fu)
		}
	}
	return result, nil
}

// GetFindingFollowUps returns follow-ups for a finding
func (s *FollowUpService) GetFindingFollowUps(tenantID, findingID string) ([]*FollowUp, error) {

	var result []*FollowUp
	__ALL__, __ERR__ := s.followUps.list(tenantID)
	if __ERR__ != nil {
		return nil, __ERR__
	}
	for _, fu := range __ALL__ {
		if fu.TenantID != tenantID {
			continue
		}
		if fu.FindingID == findingID {
			result = append(result, fu)
		}
	}
	return result, nil
}
