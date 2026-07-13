package main

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// LimitService handles treasury limit management
type LimitService struct {
	tenantID string
	limits   map[string]*TreasuryLimit
	mu       sync.RWMutex
}

// NewLimitService creates a new limit service
func NewLimitService(tenantID string) *LimitService {
	svc := &LimitService{
		tenantID: tenantID,
		limits:   make(map[string]*TreasuryLimit),
	}
	svc.initializeDefaultLimits(tenantID)
	return svc
}

func (s *LimitService) initializeDefaultLimits(tenantID string) {
	// FX Position Limits
	s.limits["limit-fx-usd"] = &TreasuryLimit{
		LimitID:      "limit-fx-usd",
		TenantID:     tenantID,
		LimitType:    "fx_position",
		Currency:     "USD",
		LimitValue:   100000000, // 100M USD
		CurrentUsage: 20000000,  // 20M USD
		Utilization:  20.0,
		WarningLevel: 80.0,
		Status:       "within_limit",
		ApprovedBy:   "board",
		ValidFrom:    time.Now().AddDate(0, -6, 0),
		ValidTo:      time.Now().AddDate(0, 6, 0),
		CreatedAt:    time.Now().AddDate(0, -6, 0),
		UpdatedAt:    time.Now(),
	}

	s.limits["limit-fx-gbp"] = &TreasuryLimit{
		LimitID:      "limit-fx-gbp",
		TenantID:     tenantID,
		LimitType:    "fx_position",
		Currency:     "GBP",
		LimitValue:   50000000, // 50M GBP
		CurrentUsage: 15000000, // 15M GBP
		Utilization:  30.0,
		WarningLevel: 80.0,
		Status:       "within_limit",
		ApprovedBy:   "board",
		ValidFrom:    time.Now().AddDate(0, -6, 0),
		ValidTo:      time.Now().AddDate(0, 6, 0),
		CreatedAt:    time.Now().AddDate(0, -6, 0),
		UpdatedAt:    time.Now(),
	}

	// Interbank Limits
	s.limits["limit-interbank-placement"] = &TreasuryLimit{
		LimitID:      "limit-interbank-placement",
		TenantID:     tenantID,
		LimitType:    "interbank",
		Currency:     "NGN",
		LimitValue:   50000000000, // 50B NGN
		CurrentUsage: 10000000000, // 10B NGN
		Utilization:  20.0,
		WarningLevel: 75.0,
		Status:       "within_limit",
		ApprovedBy:   "alco",
		ValidFrom:    time.Now().AddDate(0, -3, 0),
		ValidTo:      time.Now().AddDate(0, 9, 0),
		CreatedAt:    time.Now().AddDate(0, -3, 0),
		UpdatedAt:    time.Now(),
	}

	// Investment Limits
	s.limits["limit-investment-tbills"] = &TreasuryLimit{
		LimitID:      "limit-investment-tbills",
		TenantID:     tenantID,
		LimitType:    "investment",
		Currency:     "NGN",
		LimitValue:   100000000000, // 100B NGN
		CurrentUsage: 50000000000,  // 50B NGN
		Utilization:  50.0,
		WarningLevel: 85.0,
		Status:       "within_limit",
		ApprovedBy:   "board",
		ValidFrom:    time.Now().AddDate(-1, 0, 0),
		ValidTo:      time.Now().AddDate(1, 0, 0),
		CreatedAt:    time.Now().AddDate(-1, 0, 0),
		UpdatedAt:    time.Now(),
	}

	// Counterparty Limits
	s.limits["limit-counterparty-fbn"] = &TreasuryLimit{
		LimitID:      "limit-counterparty-fbn",
		TenantID:     tenantID,
		LimitType:    "counterparty",
		Currency:     "NGN",
		LimitValue:   20000000000, // 20B NGN
		CurrentUsage: 10000000000, // 10B NGN
		Utilization:  50.0,
		WarningLevel: 80.0,
		Status:       "within_limit",
		ApprovedBy:   "credit_committee",
		ValidFrom:    time.Now().AddDate(0, -6, 0),
		ValidTo:      time.Now().AddDate(0, 6, 0),
		CreatedAt:    time.Now().AddDate(0, -6, 0),
		UpdatedAt:    time.Now(),
	}
}

// ListLimits returns limits based on filters
func (s *LimitService) ListLimits(tenantID, limitType string) []*TreasuryLimit {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*TreasuryLimit
	for _, limit := range s.limits {
		if limit.TenantID != tenantID {
			continue
		}
		if limitType != "" && limit.LimitType != limitType {
			continue
		}
		result = append(result, limit)
	}
	return result
}

// GetLimit retrieves a limit by ID
func (s *LimitService) GetLimit(tenantID, limitID string) (*TreasuryLimit, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	limit, exists := s.limits[limitID]
	if !exists || limit.TenantID != tenantID {
		return nil, errors.New("limit not found")
	}
	return limit, nil
}

// CreateLimit creates a new limit
func (s *LimitService) CreateLimit(tenantID, approverID string, req *CreateLimitRequest) (*TreasuryLimit, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	validFrom, _ := time.Parse("2006-01-02", req.ValidFrom)
	validTo, _ := time.Parse("2006-01-02", req.ValidTo)

	limit := &TreasuryLimit{
		LimitID:      uuid.New().String(),
		TenantID:     tenantID,
		LimitType:    req.LimitType,
		Currency:     req.Currency,
		LimitValue:   req.LimitValue,
		CurrentUsage: 0,
		Utilization:  0,
		WarningLevel: req.WarningLevel,
		Status:       "within_limit",
		ApprovedBy:   approverID,
		ValidFrom:    validFrom,
		ValidTo:      validTo,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	s.limits[limit.LimitID] = limit
	return limit, nil
}

// UpdateLimit updates a limit
func (s *LimitService) UpdateLimit(limit *TreasuryLimit) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	existing, exists := s.limits[limit.LimitID]
	if !exists || existing.TenantID != limit.TenantID {
		return errors.New("limit not found")
	}

	limit.CreatedAt = existing.CreatedAt
	limit.UpdatedAt = time.Now()

	// Recalculate utilization and status
	limit.Utilization = float64(limit.CurrentUsage) / float64(limit.LimitValue) * 100
	if limit.Utilization >= 100 {
		limit.Status = "breached"
	} else if limit.Utilization >= limit.WarningLevel {
		limit.Status = "warning"
	} else {
		limit.Status = "within_limit"
	}

	s.limits[limit.LimitID] = limit
	return nil
}

// GetLimitUtilization returns limit utilization summary
func (s *LimitService) GetLimitUtilization(tenantID string) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var totalLimits, withinLimit, warning, breached int
	utilizationByType := make(map[string]float64)
	countByType := make(map[string]int)

	for _, limit := range s.limits {
		if limit.TenantID != tenantID {
			continue
		}
		totalLimits++

		switch limit.Status {
		case "within_limit":
			withinLimit++
		case "warning":
			warning++
		case "breached":
			breached++
		}

		utilizationByType[limit.LimitType] += limit.Utilization
		countByType[limit.LimitType]++
	}

	avgUtilizationByType := make(map[string]float64)
	for limitType, totalUtil := range utilizationByType {
		avgUtilizationByType[limitType] = totalUtil / float64(countByType[limitType])
	}

	return map[string]interface{}{
		"totalLimits":          totalLimits,
		"withinLimit":          withinLimit,
		"warning":              warning,
		"breached":             breached,
		"avgUtilizationByType": avgUtilizationByType,
		"timestamp":            time.Now().Format(time.RFC3339),
	}
}

// GetLimitBreaches returns breached limits
func (s *LimitService) GetLimitBreaches(tenantID string) []*TreasuryLimit {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*TreasuryLimit
	for _, limit := range s.limits {
		if limit.TenantID == tenantID && limit.Status == "breached" {
			result = append(result, limit)
		}
	}
	return result
}
