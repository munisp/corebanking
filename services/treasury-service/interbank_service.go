package main

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
)

// InterbankService handles interbank money market operations
type InterbankService struct {
	tenantID string
	deals    map[string]*InterbankDeal
	counter  int
	mu       sync.RWMutex
}

// NewInterbankService creates a new interbank service
func NewInterbankService(tenantID string) *InterbankService {
	svc := &InterbankService{
		tenantID: tenantID,
		deals:    make(map[string]*InterbankDeal),
		counter:  2000,
	}
	svc.initializeDefaultDeals(tenantID)
	return svc
}

func (s *InterbankService) initializeDefaultDeals(tenantID string) {
	// Active placement
	s.deals["ib-001"] = &InterbankDeal{
		DealID:         "ib-001",
		TenantID:       tenantID,
		DealNumber:     "IB-20260215-2001",
		DealType:       "placement",
		CounterParty:   "First Bank of Nigeria",
		CounterPartyID: "FBN",
		Principal:      10000000000, // 10B NGN
		Currency:       "NGN",
		InterestRate:   18.5,
		StartDate:      time.Now().AddDate(0, 0, -7),
		MaturityDate:   time.Now().AddDate(0, 0, 23),
		Tenor:          30,
		Interest:       152054795, // 10B * 18.5% * 30/365
		TotalAmount:    10152054795,
		Status:         "active",
		DealerID:       "dealer-001",
		Metadata:       make(map[string]interface{}),
		CreatedAt:      time.Now().AddDate(0, 0, -7),
		UpdatedAt:      time.Now(),
	}

	// Active takings
	s.deals["ib-002"] = &InterbankDeal{
		DealID:         "ib-002",
		TenantID:       tenantID,
		DealNumber:     "IB-20260210-2002",
		DealType:       "takings",
		CounterParty:   "Zenith Bank",
		CounterPartyID: "ZENITH",
		Principal:      5000000000, // 5B NGN
		Currency:       "NGN",
		InterestRate:   17.5,
		StartDate:      time.Now().AddDate(0, 0, -12),
		MaturityDate:   time.Now().AddDate(0, 0, 18),
		Tenor:          30,
		Interest:       71917808, // 5B * 17.5% * 30/365
		TotalAmount:    5071917808,
		Status:         "active",
		DealerID:       "dealer-001",
		Metadata:       make(map[string]interface{}),
		CreatedAt:      time.Now().AddDate(0, 0, -12),
		UpdatedAt:      time.Now(),
	}
}

// ListInterbankDeals returns interbank deals based on filters
func (s *InterbankService) ListInterbankDeals(tenantID, status, dealType string) []*InterbankDeal {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*InterbankDeal
	for _, deal := range s.deals {
		if deal.TenantID != tenantID {
			continue
		}
		if status != "" && deal.Status != status {
			continue
		}
		if dealType != "" && deal.DealType != dealType {
			continue
		}
		result = append(result, deal)
	}
	return result
}

// GetInterbankDeal retrieves an interbank deal by ID
func (s *InterbankService) GetInterbankDeal(tenantID, dealID string) (*InterbankDeal, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	deal, exists := s.deals[dealID]
	if !exists || deal.TenantID != tenantID {
		return nil, errors.New("interbank deal not found")
	}
	return deal, nil
}

// CreateInterbankDeal creates a new interbank deal
func (s *InterbankService) CreateInterbankDeal(tenantID, dealerID string, req *CreateInterbankDealRequest) (*InterbankDeal, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.counter++
	dealNumber := fmt.Sprintf("IB-%s-%d", time.Now().Format("20060102"), s.counter)

	startDate, _ := time.Parse("2006-01-02", req.StartDate)
	maturityDate, _ := time.Parse("2006-01-02", req.MaturityDate)
	tenor := int(maturityDate.Sub(startDate).Hours() / 24)

	// Calculate interest
	interest := int64(float64(req.Principal) * req.InterestRate / 100 * float64(tenor) / 365)

	deal := &InterbankDeal{
		DealID:         uuid.New().String(),
		TenantID:       tenantID,
		DealNumber:     dealNumber,
		DealType:       req.DealType,
		CounterParty:   req.CounterParty,
		CounterPartyID: req.CounterPartyID,
		Principal:      req.Principal,
		Currency:       req.Currency,
		InterestRate:   req.InterestRate,
		StartDate:      startDate,
		MaturityDate:   maturityDate,
		Tenor:          tenor,
		Interest:       interest,
		TotalAmount:    req.Principal + interest,
		Status:         "pending",
		DealerID:       dealerID,
		Metadata:       make(map[string]interface{}),
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	s.deals[deal.DealID] = deal
	return deal, nil
}

// UpdateInterbankDeal updates an interbank deal
func (s *InterbankService) UpdateInterbankDeal(deal *InterbankDeal) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	existing, exists := s.deals[deal.DealID]
	if !exists || existing.TenantID != deal.TenantID {
		return errors.New("interbank deal not found")
	}

	deal.CreatedAt = existing.CreatedAt
	deal.DealNumber = existing.DealNumber
	deal.UpdatedAt = time.Now()
	s.deals[deal.DealID] = deal
	return nil
}

// ApproveInterbankDeal approves an interbank deal
func (s *InterbankService) ApproveInterbankDeal(tenantID, dealID, approverID string) (*InterbankDeal, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	deal, exists := s.deals[dealID]
	if !exists || deal.TenantID != tenantID {
		return nil, errors.New("interbank deal not found")
	}

	if deal.Status != "pending" {
		return nil, errors.New("can only approve pending deals")
	}

	now := time.Now()
	deal.Status = "active"
	deal.ApprovedBy = approverID
	deal.ApprovedAt = &now
	deal.UpdatedAt = time.Now()

	return deal, nil
}

// RolloverDeal rolls over a maturing deal
func (s *InterbankService) RolloverDeal(tenantID, dealID, newMaturityDate string, newRate float64) (*InterbankDeal, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	deal, exists := s.deals[dealID]
	if !exists || deal.TenantID != tenantID {
		return nil, errors.New("interbank deal not found")
	}

	// Mark old deal as rolled over
	deal.Status = "rolled_over"
	deal.UpdatedAt = time.Now()

	// Create new deal
	s.counter++
	newDealNumber := fmt.Sprintf("IB-%s-%d", time.Now().Format("20060102"), s.counter)

	maturity, _ := time.Parse("2006-01-02", newMaturityDate)
	startDate := deal.MaturityDate
	tenor := int(maturity.Sub(startDate).Hours() / 24)
	interest := int64(float64(deal.Principal) * newRate / 100 * float64(tenor) / 365)

	newDeal := &InterbankDeal{
		DealID:         uuid.New().String(),
		TenantID:       tenantID,
		DealNumber:     newDealNumber,
		DealType:       deal.DealType,
		CounterParty:   deal.CounterParty,
		CounterPartyID: deal.CounterPartyID,
		Principal:      deal.Principal,
		Currency:       deal.Currency,
		InterestRate:   newRate,
		StartDate:      startDate,
		MaturityDate:   maturity,
		Tenor:          tenor,
		Interest:       interest,
		TotalAmount:    deal.Principal + interest,
		Status:         "active",
		DealerID:       deal.DealerID,
		Metadata: map[string]interface{}{
			"rolledOverFrom": deal.DealID,
		},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	s.deals[newDeal.DealID] = newDeal
	return newDeal, nil
}

// GetInterbankPosition returns net interbank position
func (s *InterbankService) GetInterbankPosition(tenantID string) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var placements, takings int64
	var placementCount, takingsCount int

	for _, deal := range s.deals {
		if deal.TenantID != tenantID || deal.Status != "active" {
			continue
		}
		if deal.DealType == "placement" {
			placements += deal.Principal
			placementCount++
		} else if deal.DealType == "takings" {
			takings += deal.Principal
			takingsCount++
		}
	}

	return map[string]interface{}{
		"placements":     placements,
		"placementCount": placementCount,
		"takings":        takings,
		"takingsCount":   takingsCount,
		"netPosition":    placements - takings,
		"timestamp":      time.Now().Format(time.RFC3339),
	}
}

// GetInterbankRates returns current interbank rates
func (s *InterbankService) GetInterbankRates(tenantID string) map[string]interface{} {
	return map[string]interface{}{
		"overnight": map[string]float64{
			"bid":  17.0,
			"offer": 18.0,
		},
		"7day": map[string]float64{
			"bid":  17.5,
			"offer": 18.5,
		},
		"30day": map[string]float64{
			"bid":  18.0,
			"offer": 19.0,
		},
		"90day": map[string]float64{
			"bid":  18.5,
			"offer": 19.5,
		},
		"nibor": 18.25,
		"mpr":   18.0,
		"timestamp": time.Now().Format(time.RFC3339),
	}
}
