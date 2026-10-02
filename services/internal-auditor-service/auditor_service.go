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
	auditors *repo[Auditor]
	mu       sync.RWMutex
}

// NewAuditorService creates a new auditor service
func NewAuditorService(tenantID string) *AuditorService {
	svc := &AuditorService{
		tenantID: tenantID,
		auditors: newRepo[Auditor](serviceDB, "auditors"),
	}
	svc.initializeDefaultData(tenantID)
	return svc
}

func (s *AuditorService) initializeDefaultData(tenantID string) {
	s.auditors.seed(tenantID, "auditor-001", &Auditor{
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
	})

	s.auditors.seed(tenantID, "auditor-002", &Auditor{
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
	})

	s.auditors.seed(tenantID, "auditor-003", &Auditor{
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
	})

	s.auditors.seed(tenantID, "auditor-004", &Auditor{
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
	})

	s.auditors.seed(tenantID, "auditor-005", &Auditor{
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
	})
}

// ListAuditors returns auditors based on filters
func (s *AuditorService) ListAuditors(tenantID, specialization string) ([]*Auditor, error) {

	var result []*Auditor
	__ALL__, __ERR__ := s.auditors.list(tenantID)
	if __ERR__ != nil {
		return nil, __ERR__
	}
	for _, auditor := range __ALL__ {
		if auditor.TenantID != tenantID {
			continue
		}
		if specialization != "" && auditor.Specialization != specialization {
			continue
		}
		result = append(result, auditor)
	}
	return result, nil
}

// GetAuditor retrieves an auditor by ID
func (s *AuditorService) GetAuditor(tenantID, auditorID string) (*Auditor, error) {

	auditor, err := s.auditors.get(tenantID, auditorID)
	if err != nil {
		return nil, errors.New("auditor not found")
	}
	return auditor, nil
}

// RegisterAuditor registers a new auditor
func (s *AuditorService) RegisterAuditor(tenantID string, auditor *Auditor) (*Auditor, error) {

	auditor.AuditorID = uuid.New().String()
	auditor.TenantID = tenantID
	auditor.Status = "active"
	auditor.CreatedAt = time.Now()
	auditor.UpdatedAt = time.Now()

	if err := s.auditors.put(tenantID, auditor.AuditorID, auditor); err != nil {
		return nil, err
	}
	return auditor, nil
}

// UpdateAuditor updates an auditor
func (s *AuditorService) UpdateAuditor(auditor *Auditor) error {

	existing, err := s.auditors.get(auditor.TenantID, auditor.AuditorID)
	if err != nil {
		return errors.New("auditor not found")
	}

	auditor.CreatedAt = existing.CreatedAt
	auditor.UpdatedAt = time.Now()
	return s.auditors.put(auditor.TenantID, auditor.AuditorID, auditor)
}

// GetWorkload returns auditor workload
func (s *AuditorService) GetWorkload(tenantID, auditorID string) map[string]interface{} {

	auditor, err := s.auditors.get(tenantID, auditorID)
	if err != nil {
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
