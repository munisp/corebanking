package main

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// OfficerService handles risk officer operations
type OfficerService struct {
	tenantID string
	officers map[string]*RiskOfficer
	mu       sync.RWMutex
}

// NewOfficerService creates a new officer service
func NewOfficerService(tenantID string) *OfficerService {
	svc := &OfficerService{
		tenantID: tenantID,
		officers: make(map[string]*RiskOfficer),
	}
	svc.initializeDefaultData(tenantID)
	return svc
}

func (s *OfficerService) initializeDefaultData(tenantID string) {
	// Chief Risk Officer
	s.officers["off-001"] = &RiskOfficer{
		OfficerID:      "off-001",
		TenantID:       tenantID,
		EmployeeID:     "EMP-CRO-001",
		FirstName:      "Adaeze",
		LastName:       "Okonkwo",
		Email:          "adaeze.okonkwo@54bank.com",
		Phone:          "+234-803-555-0001",
		Role:           "chief_risk_officer",
		Specialization: "enterprise",
		Status:         "active",
		CreatedAt:      time.Now().AddDate(-3, 0, 0),
		UpdatedAt:      time.Now(),
	}

	// Credit Risk Manager
	s.officers["off-002"] = &RiskOfficer{
		OfficerID:      "off-002",
		TenantID:       tenantID,
		EmployeeID:     "EMP-RM-001",
		FirstName:      "Chukwuemeka",
		LastName:       "Nwosu",
		Email:          "chukwuemeka.nwosu@54bank.com",
		Phone:          "+234-803-555-0002",
		Role:           "manager",
		Specialization: "credit",
		Status:         "active",
		CreatedAt:      time.Now().AddDate(-2, 0, 0),
		UpdatedAt:      time.Now(),
	}

	// Market Risk Manager
	s.officers["off-003"] = &RiskOfficer{
		OfficerID:      "off-003",
		TenantID:       tenantID,
		EmployeeID:     "EMP-RM-002",
		FirstName:      "Folake",
		LastName:       "Adeyemi",
		Email:          "folake.adeyemi@54bank.com",
		Phone:          "+234-803-555-0003",
		Role:           "manager",
		Specialization: "market",
		Status:         "active",
		CreatedAt:      time.Now().AddDate(-2, 0, 0),
		UpdatedAt:      time.Now(),
	}

	// Operational Risk Manager
	s.officers["off-004"] = &RiskOfficer{
		OfficerID:      "off-004",
		TenantID:       tenantID,
		EmployeeID:     "EMP-RM-003",
		FirstName:      "Olumide",
		LastName:       "Bakare",
		Email:          "olumide.bakare@54bank.com",
		Phone:          "+234-803-555-0004",
		Role:           "manager",
		Specialization: "operational",
		Status:         "active",
		CreatedAt:      time.Now().AddDate(-1, 6, 0),
		UpdatedAt:      time.Now(),
	}

	// Senior Credit Risk Analyst
	s.officers["off-005"] = &RiskOfficer{
		OfficerID:      "off-005",
		TenantID:       tenantID,
		EmployeeID:     "EMP-RA-001",
		FirstName:      "Ngozi",
		LastName:       "Eze",
		Email:          "ngozi.eze@54bank.com",
		Phone:          "+234-803-555-0005",
		Role:           "senior_analyst",
		Specialization: "credit",
		Status:         "active",
		CreatedAt:      time.Now().AddDate(-1, 0, 0),
		UpdatedAt:      time.Now(),
	}

	// Market Risk Analyst
	s.officers["off-006"] = &RiskOfficer{
		OfficerID:      "off-006",
		TenantID:       tenantID,
		EmployeeID:     "EMP-RA-002",
		FirstName:      "Tunde",
		LastName:       "Ogundimu",
		Email:          "tunde.ogundimu@54bank.com",
		Phone:          "+234-803-555-0006",
		Role:           "analyst",
		Specialization: "market",
		Status:         "active",
		CreatedAt:      time.Now().AddDate(0, -6, 0),
		UpdatedAt:      time.Now(),
	}
}

// ListOfficers returns officers based on filters
func (s *OfficerService) ListOfficers(tenantID, specialization string) []*RiskOfficer {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*RiskOfficer
	for _, officer := range s.officers {
		if officer.TenantID != tenantID {
			continue
		}
		if specialization != "" && officer.Specialization != specialization {
			continue
		}
		result = append(result, officer)
	}
	return result
}

// GetOfficer retrieves an officer by ID
func (s *OfficerService) GetOfficer(tenantID, officerID string) (*RiskOfficer, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	officer, exists := s.officers[officerID]
	if !exists || officer.TenantID != tenantID {
		return nil, errors.New("officer not found")
	}
	return officer, nil
}

// RegisterOfficer registers a new officer
func (s *OfficerService) RegisterOfficer(tenantID string, officer *RiskOfficer) (*RiskOfficer, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	officer.OfficerID = uuid.New().String()
	officer.TenantID = tenantID
	officer.Status = "active"
	officer.CreatedAt = time.Now()
	officer.UpdatedAt = time.Now()

	s.officers[officer.OfficerID] = officer
	return officer, nil
}

// UpdateOfficer updates an officer
func (s *OfficerService) UpdateOfficer(officer *RiskOfficer) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	existing, exists := s.officers[officer.OfficerID]
	if !exists || existing.TenantID != officer.TenantID {
		return errors.New("officer not found")
	}

	officer.CreatedAt = existing.CreatedAt
	officer.UpdatedAt = time.Now()
	s.officers[officer.OfficerID] = officer
	return nil
}
