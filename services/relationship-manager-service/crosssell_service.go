package main

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// CrossSellService handles cross-sell recommendation operations
type CrossSellService struct {
	tenantID        string
	recommendations map[string]*CrossSellRecommendation
	mu              sync.RWMutex
}

// NewCrossSellService creates a new cross-sell service
func NewCrossSellService(tenantID string) *CrossSellService {
	svc := &CrossSellService{
		tenantID:        tenantID,
		recommendations: make(map[string]*CrossSellRecommendation),
	}
	svc.initializeDefaultData(tenantID)
	return svc
}

func (s *CrossSellService) initializeDefaultData(tenantID string) {
	// Credit card recommendation
	s.recommendations["rec-001"] = &CrossSellRecommendation{
		RecommendationID: "rec-001",
		TenantID:         tenantID,
		CustomerID:       "cust-001",
		CustomerName:     "Adaeze Okonkwo",
		ProductType:      "card",
		ProductName:      "Platinum Credit Card",
		Reason:           "High transaction volume, frequent international travel",
		Score:            92.5,
		ExpectedValue:    5000000,
		Status:           "pending",
		AssignedRM:       "rm-001",
		CreatedAt:        time.Now().AddDate(0, 0, -5),
		UpdatedAt:        time.Now().AddDate(0, 0, -5),
	}

	// Investment recommendation
	s.recommendations["rec-002"] = &CrossSellRecommendation{
		RecommendationID: "rec-002",
		TenantID:         tenantID,
		CustomerID:       "cust-002",
		CustomerName:     "Dangote Industries Ltd",
		ProductType:      "investment",
		ProductName:      "Corporate Treasury Management",
		Reason:           "Large idle balances, opportunity for yield optimization",
		Score:            88.0,
		ExpectedValue:    200000000,
		Status:           "accepted",
		AssignedRM:       "rm-001",
		CreatedAt:        time.Now().AddDate(0, 0, -10),
		UpdatedAt:        time.Now().AddDate(0, 0, -3),
	}

	// Insurance recommendation
	s.recommendations["rec-003"] = &CrossSellRecommendation{
		RecommendationID: "rec-003",
		TenantID:         tenantID,
		CustomerID:       "cust-003",
		CustomerName:     "Lagos Tech Solutions",
		ProductType:      "insurance",
		ProductName:      "Business Interruption Insurance",
		Reason:           "Growing business, no current insurance coverage",
		Score:            75.0,
		ExpectedValue:    3000000,
		Status:           "pending",
		AssignedRM:       "rm-001",
		CreatedAt:        time.Now().AddDate(0, 0, -7),
		UpdatedAt:        time.Now().AddDate(0, 0, -7),
	}

	// Loan recommendation
	s.recommendations["rec-004"] = &CrossSellRecommendation{
		RecommendationID: "rec-004",
		TenantID:         tenantID,
		CustomerID:       "cust-004",
		CustomerName:     "Chukwuemeka Nwosu",
		ProductType:      "loan",
		ProductName:      "Personal Loan",
		Reason:           "Strong salary credits, good repayment history",
		Score:            82.0,
		ExpectedValue:    10000000,
		Status:           "pending",
		AssignedRM:       "rm-001",
		CreatedAt:        time.Now().AddDate(0, 0, -3),
		UpdatedAt:        time.Now().AddDate(0, 0, -3),
	}

	// Converted recommendation
	s.recommendations["rec-005"] = &CrossSellRecommendation{
		RecommendationID: "rec-005",
		TenantID:         tenantID,
		CustomerID:       "cust-001",
		CustomerName:     "Adaeze Okonkwo",
		ProductType:      "deposit",
		ProductName:      "Fixed Deposit",
		Reason:           "Large savings balance, opportunity for higher yield",
		Score:            95.0,
		ExpectedValue:    50000000,
		Status:           "converted",
		AssignedRM:       "rm-001",
		CreatedAt:        time.Now().AddDate(0, -1, 0),
		UpdatedAt:        time.Now().AddDate(0, 0, -5),
	}
}

// ListRecommendations returns recommendations based on filters
func (s *CrossSellService) ListRecommendations(tenantID, rmID, status string) []*CrossSellRecommendation {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*CrossSellRecommendation
	for _, rec := range s.recommendations {
		if rec.TenantID != tenantID {
			continue
		}
		if rmID != "" && rec.AssignedRM != rmID {
			continue
		}
		if status != "" && rec.Status != status {
			continue
		}
		result = append(result, rec)
	}
	return result
}

// GetRecommendation retrieves a recommendation by ID
func (s *CrossSellService) GetRecommendation(tenantID, recommendationID string) (*CrossSellRecommendation, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	rec, exists := s.recommendations[recommendationID]
	if !exists || rec.TenantID != tenantID {
		return nil, errors.New("recommendation not found")
	}
	return rec, nil
}

// GetCustomerRecommendations returns recommendations for a customer
func (s *CrossSellService) GetCustomerRecommendations(tenantID, customerID string) []*CrossSellRecommendation {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*CrossSellRecommendation
	for _, rec := range s.recommendations {
		if rec.TenantID != tenantID {
			continue
		}
		if rec.CustomerID == customerID {
			result = append(result, rec)
		}
	}
	return result
}

// AcceptRecommendation accepts a recommendation
func (s *CrossSellService) AcceptRecommendation(tenantID, recommendationID string) (*CrossSellRecommendation, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	rec, exists := s.recommendations[recommendationID]
	if !exists || rec.TenantID != tenantID {
		return nil, errors.New("recommendation not found")
	}

	if rec.Status != "pending" {
		return nil, errors.New("recommendation is not pending")
	}

	rec.Status = "accepted"
	rec.UpdatedAt = time.Now()
	return rec, nil
}

// RejectRecommendation rejects a recommendation
func (s *CrossSellService) RejectRecommendation(tenantID, recommendationID string) (*CrossSellRecommendation, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	rec, exists := s.recommendations[recommendationID]
	if !exists || rec.TenantID != tenantID {
		return nil, errors.New("recommendation not found")
	}

	if rec.Status != "pending" {
		return nil, errors.New("recommendation is not pending")
	}

	rec.Status = "rejected"
	rec.UpdatedAt = time.Now()
	return rec, nil
}

// ConvertRecommendation converts a recommendation to sale
func (s *CrossSellService) ConvertRecommendation(tenantID, recommendationID string) (*CrossSellRecommendation, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	rec, exists := s.recommendations[recommendationID]
	if !exists || rec.TenantID != tenantID {
		return nil, errors.New("recommendation not found")
	}

	if rec.Status != "accepted" {
		return nil, errors.New("recommendation must be accepted before conversion")
	}

	rec.Status = "converted"
	rec.UpdatedAt = time.Now()
	return rec, nil
}

// CreateRecommendation creates a new recommendation
func (s *CrossSellService) CreateRecommendation(tenantID string, rec *CrossSellRecommendation) (*CrossSellRecommendation, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	rec.RecommendationID = uuid.New().String()
	rec.TenantID = tenantID
	rec.Status = "pending"
	rec.CreatedAt = time.Now()
	rec.UpdatedAt = time.Now()

	s.recommendations[rec.RecommendationID] = rec
	return rec, nil
}

// GetAnalytics returns cross-sell analytics
func (s *CrossSellService) GetAnalytics(tenantID, rmID string) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var totalRecs, pending, accepted, rejected, converted int
	var totalValue, convertedValue int64

	for _, rec := range s.recommendations {
		if rec.TenantID != tenantID {
			continue
		}
		if rmID != "" && rec.AssignedRM != rmID {
			continue
		}

		totalRecs++
		totalValue += rec.ExpectedValue

		switch rec.Status {
		case "pending":
			pending++
		case "accepted":
			accepted++
		case "rejected":
			rejected++
		case "converted":
			converted++
			convertedValue += rec.ExpectedValue
		}
	}

	var conversionRate float64
	if totalRecs > 0 {
		conversionRate = float64(converted) / float64(totalRecs) * 100
	}

	return map[string]interface{}{
		"totalRecommendations": totalRecs,
		"pending":              pending,
		"accepted":             accepted,
		"rejected":             rejected,
		"converted":            converted,
		"totalValue":           totalValue,
		"convertedValue":       convertedValue,
		"conversionRate":       conversionRate,
		"timestamp":            time.Now().Format(time.RFC3339),
	}
}
