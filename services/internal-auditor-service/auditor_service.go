package main

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// AuditorService handles auditor operations
type AuditorService struct {
	tenantID string
	auditors map[string]*Auditor
	mu       sync.RWMutex
}

// NewAuditorService creates a new auditor service
func NewAuditorService(tenantID string) *AuditorService {
	svc := &AuditorService{
		tenantID: tenantID,
		auditors: make(map[string]*Auditor),
	}
	svc.initializeDefaultData(tenantID)
	return svc
}

func (s *AuditorService) initializeDefaultData(tenantID string) {
	s.auditors["auditor-001"] = &Auditor{
		AuditorID:      "auditor-001",
		TenantID:       tenantID,
		EmployeeID:     "emp-001",
		FirstName:      "Adaeze",
		LastName:       "Okonkwo",
		Email:          "adaeze.okonkwo@54bank.com",
		Phone:          "+234-801-234-5678",
		Role:           "senior_auditor",
		Specialization: "operational",
		Certifications: []string{"CIA", "CISA"},
		Status:         "active",
		CreatedAt:      time.Now().AddDate(-3, 0, 0),
		UpdatedAt:      time.Now(),
	}

	s.auditors["auditor-002"] = &Auditor{
		AuditorID:      "auditor-002",
		TenantID:       tenantID,
		EmployeeID:     "emp-002",
		FirstName:      "Chukwuemeka",
		LastName:       "Nwosu",
		Email:          "chukwuemeka.nwosu@54bank.com",
		Phone:          "+234-802-345-6789",
		Role:           "auditor",
		Specialization: "financial",
		Certifications: []string{"CIA"},
		Status:         "active",
		CreatedAt:      time.Now().AddDate(-2, 0, 0),
		UpdatedAt:      time.Now(),
	}

	s.auditors["auditor-003"] = &Auditor{
		AuditorID:      "auditor-003",
		TenantID:       tenantID,
		EmployeeID:     "emp-003",
		FirstName:      "Ngozi",
		LastName:       "Eze",
		Email:          "ngozi.eze@54bank.com",
		Phone:          "+234-803-456-7890",
		Role:           "auditor",
		Specialization: "compliance",
		Certifications: []string{"CAMS", "CFE"},
		Status:         "active",
		CreatedAt:      time.Now().AddDate(-1, 0, 0),
		UpdatedAt:      time.Now(),
	}

	s.auditors["auditor-004"] = &Auditor{
		AuditorID:      "auditor-004",
		TenantID:       tenantID,
		EmployeeID:     "emp-004",
		FirstName:      "Olumide",
		LastName:       "Bakare",
		Email:          "olumide.bakare@54bank.com",
		Phone:          "+234-804-567-8901",
		Role:           "senior_auditor",
		Specialization: "it",
		Certifications: []string{"CISA", "CISSP"},
		Status:         "active",
		CreatedAt:      time.Now().AddDate(-4, 0, 0),
		UpdatedAt:      time.Now(),
	}

	s.auditors["auditor-005"] = &Auditor{
		AuditorID:      "auditor-005",
		TenantID:       tenantID,
		EmployeeID:     "emp-005",
		FirstName:      "Funke",
		LastName:       "Ajayi",
		Email:          "funke.ajayi@54bank.com",
		Phone:          "+234-805-678-9012",
		Role:           "cae",
		Specialization: "operational",
		Certifications: []string{"CIA", "CISA", "CFE", "CPA"},
		Status:         "active",
		CreatedAt:      time.Now().AddDate(-5, 0, 0),
		UpdatedAt:      time.Now(),
	}
}

// ListAuditors returns auditors based on filters
func (s *AuditorService) ListAuditors(tenantID, specialization string) []*Auditor {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*Auditor
	for _, auditor := range s.auditors {
		if auditor.TenantID != tenantID {
			continue
		}
		if specialization != "" && auditor.Specialization != specialization {
			continue
		}
		result = append(result, auditor)
	}
	return result
}

// GetAuditor retrieves an auditor by ID
func (s *AuditorService) GetAuditor(tenantID, auditorID string) (*Auditor, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	auditor, exists := s.auditors[auditorID]
	if !exists || auditor.TenantID != tenantID {
		return nil, errors.New("auditor not found")
	}
	return auditor, nil
}

// RegisterAuditor registers a new auditor
func (s *AuditorService) RegisterAuditor(tenantID string, auditor *Auditor) (*Auditor, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	auditor.AuditorID = uuid.New().String()
	auditor.TenantID = tenantID
	auditor.Status = "active"
	auditor.CreatedAt = time.Now()
	auditor.UpdatedAt = time.Now()

	s.auditors[auditor.AuditorID] = auditor
	return auditor, nil
}

// UpdateAuditor updates an auditor
func (s *AuditorService) UpdateAuditor(auditor *Auditor) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	existing, exists := s.auditors[auditor.AuditorID]
	if !exists || existing.TenantID != auditor.TenantID {
		return errors.New("auditor not found")
	}

	auditor.CreatedAt = existing.CreatedAt
	auditor.UpdatedAt = time.Now()
	s.auditors[auditor.AuditorID] = auditor
	return nil
}

// GetWorkload returns auditor workload
func (s *AuditorService) GetWorkload(tenantID, auditorID string) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	auditor, exists := s.auditors[auditorID]
	if !exists || auditor.TenantID != tenantID {
		return map[string]interface{}{
			"error": "auditor not found",
		}
	}

	return map[string]interface{}{
		"auditorID":          auditorID,
		"auditorName":        auditor.FirstName + " " + auditor.LastName,
		"activeEngagements":  2,
		"pendingTests":       5,
		"openFindings":       3,
		"pendingFollowUps":   2,
		"hoursAllocated":     160,
		"hoursUtilized":      120,
		"utilizationPercent": 75.0,
		"timestamp":          time.Now().Format(time.RFC3339),
	}
}
