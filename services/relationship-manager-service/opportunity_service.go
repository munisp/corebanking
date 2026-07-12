package main

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// OpportunityService handles opportunity operations
type OpportunityService struct {
	tenantID      string
	opportunities map[string]*Opportunity
	mu            sync.RWMutex
}

// NewOpportunityService creates a new opportunity service
func NewOpportunityService(tenantID string) *OpportunityService {
	svc := &OpportunityService{
		tenantID:      tenantID,
		opportunities: make(map[string]*Opportunity),
	}
	svc.initializeDefaultData(tenantID)
	return svc
}

func (s *OpportunityService) initializeDefaultData(tenantID string) {
	// Loan opportunity - negotiation stage
	s.opportunities["opp-001"] = &Opportunity{
		OpportunityID: "opp-001",
		TenantID:      tenantID,
		CustomerID:    "cust-002",
		CustomerName:  "Dangote Industries Ltd",
		ProductType:   "loan",
		ProductName:   "Working Capital Facility",
		ExpectedValue: 500000000, // 500M NGN
		Probability:   0.75,
		WeightedValue: 375000000,
		Stage:         "negotiation",
		Source:        "cross_sell",
		AssignedRM:    "rm-001",
		ExpectedClose: time.Now().AddDate(0, 0, 15),
		Notes:         "Customer interested in expanding working capital facility",
		Metadata:      make(map[string]interface{}),
		CreatedAt:     time.Now().AddDate(0, -1, 0),
		UpdatedAt:     time.Now(),
	}

	// Investment opportunity - proposal stage
	s.opportunities["opp-002"] = &Opportunity{
		OpportunityID: "opp-002",
		TenantID:      tenantID,
		CustomerID:    "cust-001",
		CustomerName:  "Adaeze Okonkwo",
		ProductType:   "investment",
		ProductName:   "Treasury Bills Portfolio",
		ExpectedValue: 100000000, // 100M NGN
		Probability:   0.60,
		WeightedValue: 60000000,
		Stage:         "proposal",
		Source:        "cross_sell",
		AssignedRM:    "rm-001",
		ExpectedClose: time.Now().AddDate(0, 0, 20),
		Notes:         "Customer looking to diversify into fixed income",
		Metadata:      make(map[string]interface{}),
		CreatedAt:     time.Now().AddDate(0, 0, -14),
		UpdatedAt:     time.Now(),
	}

	// Insurance opportunity - qualified stage
	s.opportunities["opp-003"] = &Opportunity{
		OpportunityID: "opp-003",
		TenantID:      tenantID,
		CustomerID:    "cust-003",
		CustomerName:  "Lagos Tech Solutions",
		ProductType:   "insurance",
		ProductName:   "Business Insurance Package",
		ExpectedValue: 5000000, // 5M NGN
		Probability:   0.40,
		WeightedValue: 2000000,
		Stage:         "qualified",
		Source:        "referral",
		AssignedRM:    "rm-001",
		ExpectedClose: time.Now().AddDate(0, 1, 0),
		Notes:         "Referred by existing customer",
		Metadata:      make(map[string]interface{}),
		CreatedAt:     time.Now().AddDate(0, 0, -7),
		UpdatedAt:     time.Now(),
	}

	// Card opportunity - lead stage
	s.opportunities["opp-004"] = &Opportunity{
		OpportunityID: "opp-004",
		TenantID:      tenantID,
		CustomerID:    "cust-004",
		CustomerName:  "Chukwuemeka Nwosu",
		ProductType:   "card",
		ProductName:   "Platinum Credit Card",
		ExpectedValue: 2000000, // 2M NGN limit
		Probability:   0.25,
		WeightedValue: 500000,
		Stage:         "lead",
		Source:        "campaign",
		AssignedRM:    "rm-001",
		ExpectedClose: time.Now().AddDate(0, 1, 15),
		Notes:         "Responded to credit card campaign",
		Metadata:      make(map[string]interface{}),
		CreatedAt:     time.Now().AddDate(0, 0, -3),
		UpdatedAt:     time.Now(),
	}

	// Closed won opportunity
	closedAt := time.Now().AddDate(0, 0, -5)
	s.opportunities["opp-005"] = &Opportunity{
		OpportunityID: "opp-005",
		TenantID:      tenantID,
		CustomerID:    "cust-001",
		CustomerName:  "Adaeze Okonkwo",
		ProductType:   "deposit",
		ProductName:   "Fixed Deposit - 12 Months",
		ExpectedValue: 50000000, // 50M NGN
		Probability:   1.0,
		WeightedValue: 50000000,
		Stage:         "closed_won",
		Source:        "cross_sell",
		AssignedRM:    "rm-001",
		ExpectedClose: time.Now().AddDate(0, 0, -7),
		ActualClose:   &closedAt,
		Notes:         "Successfully converted to fixed deposit",
		Metadata:      make(map[string]interface{}),
		CreatedAt:     time.Now().AddDate(0, -1, 0),
		UpdatedAt:     time.Now().AddDate(0, 0, -5),
	}
}

// ListOpportunities returns opportunities based on filters
func (s *OpportunityService) ListOpportunities(tenantID, rmID, stage string) []*Opportunity {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*Opportunity
	for _, opp := range s.opportunities {
		if opp.TenantID != tenantID {
			continue
		}
		if rmID != "" && opp.AssignedRM != rmID {
			continue
		}
		if stage != "" && opp.Stage != stage {
			continue
		}
		result = append(result, opp)
	}
	return result
}

// GetOpportunity retrieves an opportunity by ID
func (s *OpportunityService) GetOpportunity(tenantID, opportunityID string) (*Opportunity, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	opp, exists := s.opportunities[opportunityID]
	if !exists || opp.TenantID != tenantID {
		return nil, errors.New("opportunity not found")
	}
	return opp, nil
}

// CreateOpportunity creates a new opportunity
func (s *OpportunityService) CreateOpportunity(tenantID, rmID string, req *CreateOpportunityRequest) (*Opportunity, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	expectedClose, _ := time.Parse("2006-01-02", req.ExpectedClose)

	opp := &Opportunity{
		OpportunityID: uuid.New().String(),
		TenantID:      tenantID,
		CustomerID:    req.CustomerID,
		ProductType:   req.ProductType,
		ProductName:   req.ProductName,
		ExpectedValue: req.ExpectedValue,
		Probability:   req.Probability,
		WeightedValue: int64(float64(req.ExpectedValue) * req.Probability),
		Stage:         "lead",
		Source:        req.Source,
		AssignedRM:    rmID,
		ExpectedClose: expectedClose,
		Notes:         req.Notes,
		Metadata:      make(map[string]interface{}),
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	s.opportunities[opp.OpportunityID] = opp
	return opp, nil
}

// UpdateOpportunity updates an opportunity
func (s *OpportunityService) UpdateOpportunity(opp *Opportunity) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	existing, exists := s.opportunities[opp.OpportunityID]
	if !exists || existing.TenantID != opp.TenantID {
		return errors.New("opportunity not found")
	}

	opp.CreatedAt = existing.CreatedAt
	opp.UpdatedAt = time.Now()
	opp.WeightedValue = int64(float64(opp.ExpectedValue) * opp.Probability)
	s.opportunities[opp.OpportunityID] = opp
	return nil
}

// UpdateStage updates opportunity stage
func (s *OpportunityService) UpdateStage(tenantID, opportunityID, stage, notes string) (*Opportunity, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	opp, exists := s.opportunities[opportunityID]
	if !exists || opp.TenantID != tenantID {
		return nil, errors.New("opportunity not found")
	}

	opp.Stage = stage
	if notes != "" {
		opp.Notes = notes
	}
	opp.UpdatedAt = time.Now()

	// Update probability based on stage
	switch stage {
	case "lead":
		opp.Probability = 0.10
	case "qualified":
		opp.Probability = 0.25
	case "proposal":
		opp.Probability = 0.50
	case "negotiation":
		opp.Probability = 0.75
	case "closed_won":
		opp.Probability = 1.0
		now := time.Now()
		opp.ActualClose = &now
	case "closed_lost":
		opp.Probability = 0.0
		now := time.Now()
		opp.ActualClose = &now
	}

	opp.WeightedValue = int64(float64(opp.ExpectedValue) * opp.Probability)

	return opp, nil
}

// GetCustomerOpportunities returns opportunities for a customer
func (s *OpportunityService) GetCustomerOpportunities(tenantID, customerID string) []*Opportunity {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*Opportunity
	for _, opp := range s.opportunities {
		if opp.TenantID != tenantID {
			continue
		}
		if opp.CustomerID == customerID {
			result = append(result, opp)
		}
	}
	return result
}

// GetPipeline returns pipeline summary
func (s *OpportunityService) GetPipeline(tenantID, rmID string) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var totalOpportunities int
	var totalValue, weightedValue int64

	for _, opp := range s.opportunities {
		if opp.TenantID != tenantID {
			continue
		}
		if rmID != "" && opp.AssignedRM != rmID {
			continue
		}
		if opp.Stage != "closed_won" && opp.Stage != "closed_lost" {
			totalOpportunities++
			totalValue += opp.ExpectedValue
			weightedValue += opp.WeightedValue
		}
	}

	return map[string]interface{}{
		"totalOpportunities": totalOpportunities,
		"totalValue":         totalValue,
		"weightedValue":      weightedValue,
		"timestamp":          time.Now().Format(time.RFC3339),
	}
}

// GetPipelineByStage returns pipeline breakdown by stage
func (s *OpportunityService) GetPipelineByStage(tenantID, rmID string) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	stages := map[string]map[string]interface{}{
		"lead":        {"count": 0, "value": int64(0)},
		"qualified":   {"count": 0, "value": int64(0)},
		"proposal":    {"count": 0, "value": int64(0)},
		"negotiation": {"count": 0, "value": int64(0)},
	}

	for _, opp := range s.opportunities {
		if opp.TenantID != tenantID {
			continue
		}
		if rmID != "" && opp.AssignedRM != rmID {
			continue
		}
		if stage, exists := stages[opp.Stage]; exists {
			stage["count"] = stage["count"].(int) + 1
			stage["value"] = stage["value"].(int64) + opp.ExpectedValue
		}
	}

	return map[string]interface{}{
		"stages":    stages,
		"timestamp": time.Now().Format(time.RFC3339),
	}
}

// GetForecast returns revenue forecast
func (s *OpportunityService) GetForecast(tenantID, rmID string) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var thisMonth, nextMonth, thisQuarter int64

	now := time.Now()
	endOfMonth := time.Date(now.Year(), now.Month()+1, 0, 23, 59, 59, 0, now.Location())
	endOfNextMonth := time.Date(now.Year(), now.Month()+2, 0, 23, 59, 59, 0, now.Location())
	endOfQuarter := time.Date(now.Year(), ((now.Month()-1)/3+1)*3+1, 0, 23, 59, 59, 0, now.Location())

	for _, opp := range s.opportunities {
		if opp.TenantID != tenantID {
			continue
		}
		if rmID != "" && opp.AssignedRM != rmID {
			continue
		}
		if opp.Stage == "closed_won" || opp.Stage == "closed_lost" {
			continue
		}

		if opp.ExpectedClose.Before(endOfMonth) {
			thisMonth += opp.WeightedValue
		}
		if opp.ExpectedClose.Before(endOfNextMonth) {
			nextMonth += opp.WeightedValue
		}
		if opp.ExpectedClose.Before(endOfQuarter) {
			thisQuarter += opp.WeightedValue
		}
	}

	return map[string]interface{}{
		"thisMonth":   thisMonth,
		"nextMonth":   nextMonth,
		"thisQuarter": thisQuarter,
		"timestamp":   time.Now().Format(time.RFC3339),
	}
}
