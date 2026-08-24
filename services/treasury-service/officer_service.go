package main

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// OfficerService handles treasury officer management
type OfficerService struct {
	tenantID string
	officers map[string]*TreasuryOfficer
	mu       sync.RWMutex
}

// NewOfficerService creates a new officer service
func NewOfficerService(tenantID string) *OfficerService {
	svc := &OfficerService{
		tenantID: tenantID,
		officers: make(map[string]*TreasuryOfficer),
	}
	svc.initializeDefaultOfficers(tenantID)
	return svc
}

func (s *OfficerService) initializeDefaultOfficers(tenantID string) {
	s.officers["officer-001"] = &TreasuryOfficer{
		OfficerID:    "officer-001",
		TenantID:     tenantID,
		EmployeeID:   "EMP-T001",
		FirstName:    "Adebayo",
		LastName:     "Okonkwo",
		Email:        "adebayo.okonkwo@54bank.com",
		Phone:        "+234-801-234-5678",
		Role:         "head_treasury",
		Desk:         "management",
		DealingLimit: 50000000000, // 50B NGN
		Status:       "active",
		CreatedAt:    time.Now().AddDate(-2, 0, 0),
		UpdatedAt:    time.Now(),
	}

	s.officers["officer-002"] = &TreasuryOfficer{
		OfficerID:    "officer-002",
		TenantID:     tenantID,
		EmployeeID:   "EMP-T002",
		FirstName:    "Chioma",
		LastName:     "Nwosu",
		Email:        "chioma.nwosu@54bank.com",
		Phone:        "+234-802-345-6789",
		Role:         "senior_dealer",
		Desk:         "fx",
		DealingLimit: 20000000000, // 20B NGN
		Status:       "active",
		CreatedAt:    time.Now().AddDate(-1, 0, 0),
		UpdatedAt:    time.Now(),
	}

	s.officers["officer-003"] = &TreasuryOfficer{
		OfficerID:    "officer-003",
		TenantID:     tenantID,
		EmployeeID:   "EMP-T003",
		FirstName:    "Emeka",
		LastName:     "Eze",
		Email:        "emeka.eze@54bank.com",
		Phone:        "+234-803-456-7890",
		Role:         "dealer",
		Desk:         "money_market",
		DealingLimit: 10000000000, // 10B NGN
		Status:       "active",
		CreatedAt:    time.Now().AddDate(0, -6, 0),
		UpdatedAt:    time.Now(),
	}

	s.officers["officer-004"] = &TreasuryOfficer{
		OfficerID:    "officer-004",
		TenantID:     tenantID,
		EmployeeID:   "EMP-T004",
		FirstName:    "Fatima",
		LastName:     "Bello",
		Email:        "fatima.bello@54bank.com",
		Phone:        "+234-804-567-8901",
		Role:         "alm_officer",
		Desk:         "alm",
		DealingLimit: 0, // ALM officers don't deal
		Status:       "active",
		CreatedAt:    time.Now().AddDate(0, -3, 0),
		UpdatedAt:    time.Now(),
	}
}

// ListOfficers returns officers based on filters
func (s *OfficerService) ListOfficers(tenantID, desk string) []*TreasuryOfficer {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*TreasuryOfficer
	for _, officer := range s.officers {
		if officer.TenantID != tenantID {
			continue
		}
		if desk != "" && officer.Desk != desk {
			continue
		}
		result = append(result, officer)
	}
	return result
}

// GetOfficer retrieves an officer by ID
func (s *OfficerService) GetOfficer(tenantID, officerID string) (*TreasuryOfficer, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	officer, exists := s.officers[officerID]
	if !exists || officer.TenantID != tenantID {
		return nil, errors.New("officer not found")
	}
	return officer, nil
}

// RegisterOfficer registers a new officer
func (s *OfficerService) RegisterOfficer(tenantID string, officer *TreasuryOfficer) (*TreasuryOfficer, error) {
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
func (s *OfficerService) UpdateOfficer(officer *TreasuryOfficer) error {
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

// GetOfficerDeals returns deals for an officer
func (s *OfficerService) GetOfficerDeals(tenantID, officerID string, fxService *FXService, interbankService *InterbankService) map[string]interface{} {
	officer, err := s.GetOfficer(tenantID, officerID)
	if err != nil {
		return map[string]interface{}{"error": "officer not found"}
	}

	// Get FX deals
	fxDeals := fxService.ListFXDeals(tenantID, "", "")
	var officerFXDeals []*FXDeal
	for _, deal := range fxDeals {
		if deal.DealerID == officerID {
			officerFXDeals = append(officerFXDeals, deal)
		}
	}

	// Get interbank deals
	interbankDeals := interbankService.ListInterbankDeals(tenantID, "", "")
	var officerInterbankDeals []*InterbankDeal
	for _, deal := range interbankDeals {
		if deal.DealerID == officerID {
			officerInterbankDeals = append(officerInterbankDeals, deal)
		}
	}

	return map[string]interface{}{
		"officerID":      officerID,
		"officerName":    officer.FirstName + " " + officer.LastName,
		"desk":           officer.Desk,
		"fxDeals":        officerFXDeals,
		"fxDealCount":    len(officerFXDeals),
		"interbankDeals": officerInterbankDeals,
		"interbankCount": len(officerInterbankDeals),
		"dealingLimit":   officer.DealingLimit,
		"timestamp":      time.Now().Format(time.RFC3339),
	}
}
