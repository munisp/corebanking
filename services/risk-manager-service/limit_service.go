package main

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// LimitService handles risk limit operations
type LimitService struct {
	tenantID string
	limits   *repo[RiskLimit]
	mu       sync.RWMutex
}

// NewLimitService creates a new limit service
func NewLimitService(tenantID string) *LimitService {
	svc := &LimitService{
		tenantID: tenantID,
		limits:   newRepo[RiskLimit](serviceDB, "risk_limits"),
	}
	svc.initializeDefaultData(tenantID)
	return svc
}

func (s *LimitService) initializeDefaultData(tenantID string) {
	// Credit concentration limit
	s.limits.seed(tenantID, "lim-001", &RiskLimit{
		LimitID:      "lim-001",
		TenantID:     tenantID,
		LimitType:    "concentration",
		LimitName:    "Single Obligor Limit",
		LimitValue:   50000000000, // 50B NGN
		CurrentUsage: 35000000000,
		Utilization:  70.0,
		WarningLevel: 80.0,
		Currency:     "NGN",
		Status:       "within_limit",
		ApprovedBy:   "board",
		ValidFrom:    time.Now().AddDate(-1, 0, 0),
		ValidTo:      time.Now().AddDate(1, 0, 0),
		Metadata:     make(map[string]interface{}),
		CreatedAt:    time.Now().AddDate(-1, 0, 0),
		UpdatedAt:    time.Now(),
	})

	// Market risk VaR limit
	s.limits.seed(tenantID, "lim-002", &RiskLimit{
		LimitID:      "lim-002",
		TenantID:     tenantID,
		LimitType:    "market",
		LimitName:    "Total VaR Limit",
		LimitValue:   5000000000, // 5B NGN
		CurrentUsage: 2500000000,
		Utilization:  50.0,
		WarningLevel: 80.0,
		Currency:     "NGN",
		Status:       "within_limit",
		ApprovedBy:   "alco",
		ValidFrom:    time.Now().AddDate(-1, 0, 0),
		ValidTo:      time.Now().AddDate(1, 0, 0),
		Metadata:     make(map[string]interface{}),
		CreatedAt:    time.Now().AddDate(-1, 0, 0),
		UpdatedAt:    time.Now(),
	})

	// FX open position limit
	s.limits.seed(tenantID, "lim-003", &RiskLimit{
		LimitID:      "lim-003",
		TenantID:     tenantID,
		LimitType:    "market",
		LimitName:    "FX Open Position Limit",
		LimitValue:   50000000000, // 50B NGN
		CurrentUsage: 36300000000,
		Utilization:  72.6,
		WarningLevel: 80.0,
		Currency:     "NGN",
		Status:       "within_limit",
		ApprovedBy:   "alco",
		ValidFrom:    time.Now().AddDate(-1, 0, 0),
		ValidTo:      time.Now().AddDate(1, 0, 0),
		Metadata:     make(map[string]interface{}),
		CreatedAt:    time.Now().AddDate(-1, 0, 0),
		UpdatedAt:    time.Now(),
	})

	// Operational loss limit
	s.limits.seed(tenantID, "lim-004", &RiskLimit{
		LimitID:      "lim-004",
		TenantID:     tenantID,
		LimitType:    "operational",
		LimitName:    "Annual Operational Loss Limit",
		LimitValue:   1000000000, // 1B NGN
		CurrentUsage: 250000000,
		Utilization:  25.0,
		WarningLevel: 70.0,
		Currency:     "NGN",
		Status:       "within_limit",
		ApprovedBy:   "board",
		ValidFrom:    time.Now().AddDate(-1, 0, 0),
		ValidTo:      time.Now().AddDate(1, 0, 0),
		Metadata:     make(map[string]interface{}),
		CreatedAt:    time.Now().AddDate(-1, 0, 0),
		UpdatedAt:    time.Now(),
	})

	// Sector concentration limit - warning
	s.limits.seed(tenantID, "lim-005", &RiskLimit{
		LimitID:      "lim-005",
		TenantID:     tenantID,
		LimitType:    "concentration",
		LimitName:    "Oil & Gas Sector Limit",
		LimitValue:   100000000000, // 100B NGN
		CurrentUsage: 85000000000,
		Utilization:  85.0,
		WarningLevel: 80.0,
		Currency:     "NGN",
		Status:       "warning",
		ApprovedBy:   "board",
		ValidFrom:    time.Now().AddDate(-1, 0, 0),
		ValidTo:      time.Now().AddDate(1, 0, 0),
		Metadata:     make(map[string]interface{}),
		CreatedAt:    time.Now().AddDate(-1, 0, 0),
		UpdatedAt:    time.Now(),
	})
}

// ListLimits returns limits based on filters
func (s *LimitService) ListLimits(tenantID, limitType string) ([]*RiskLimit, error) {

	var result []*RiskLimit
	__ALL__, __ERR__ := s.limits.list(tenantID)
	if __ERR__ != nil {
		return nil, __ERR__
	}
	for _, limit := range __ALL__ {
		if limit.TenantID != tenantID {
			continue
		}
		if limitType != "" && limit.LimitType != limitType {
			continue
		}
		result = append(result, limit)
	}
	return result, nil
}

// GetLimit retrieves a limit by ID
func (s *LimitService) GetLimit(tenantID, limitID string) (*RiskLimit, error) {

	limit, err := s.limits.get(tenantID, limitID)
	if err != nil {
		return nil, errors.New("limit not found")
	}
	return limit, nil
}

// CreateLimit creates a new risk limit
func (s *LimitService) CreateLimit(tenantID, userID string, req *CreateRiskLimitRequest) (*RiskLimit, error) {

	validFrom, _ := time.Parse("2006-01-02", req.ValidFrom)
	validTo, _ := time.Parse("2006-01-02", req.ValidTo)

	limit := &RiskLimit{
		LimitID:      uuid.New().String(),
		TenantID:     tenantID,
		LimitType:    req.LimitType,
		LimitName:    req.LimitName,
		LimitValue:   req.LimitValue,
		CurrentUsage: 0,
		Utilization:  0,
		WarningLevel: req.WarningLevel,
		Currency:     req.Currency,
		Status:       "within_limit",
		ApprovedBy:   userID,
		ValidFrom:    validFrom,
		ValidTo:      validTo,
		Metadata:     make(map[string]interface{}),
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := s.limits.put(tenantID, limit.LimitID, limit); err != nil {
		return nil, err
	}
	return limit, nil
}

// UpdateLimit updates a risk limit
func (s *LimitService) UpdateLimit(limit *RiskLimit) error {

	existing, err := s.limits.get(limit.TenantID, limit.LimitID)
	if err != nil {
		return errors.New("limit not found")
	}

	limit.CreatedAt = existing.CreatedAt
	limit.UpdatedAt = time.Now()

	// Recalculate utilization and status
	if limit.LimitValue > 0 {
		limit.Utilization = float64(limit.CurrentUsage) / float64(limit.LimitValue) * 100
	}

	if limit.Utilization >= 100 {
		limit.Status = "breached"
	} else if limit.Utilization >= limit.WarningLevel {
		limit.Status = "warning"
	} else {
		limit.Status = "within_limit"
	}

	return s.limits.put(limit.TenantID, limit.LimitID, limit)
}

// GetUtilization returns limit utilization summary
func (s *LimitService) GetUtilization(tenantID string) (map[string]interface{}, error) {

	byType := make(map[string][]map[string]interface{})

	__ALL__, __ERR__ := s.limits.list(tenantID)
	if __ERR__ != nil {
		return nil, __ERR__
	}
	for _, limit := range __ALL__ {
		if limit.TenantID != tenantID {
			continue
		}

		byType[limit.LimitType] = append(byType[limit.LimitType], map[string]interface{}{
			"limitID":      limit.LimitID,
			"limitName":    limit.LimitName,
			"limitValue":   limit.LimitValue,
			"currentUsage": limit.CurrentUsage,
			"utilization":  limit.Utilization,
			"status":       limit.Status,
		})
	}

	return map[string]interface{}{
		"byType":    byType,
		"timestamp": time.Now().Format(time.RFC3339),
	}, nil
}

// GetBreaches returns breached or warning limits
func (s *LimitService) GetBreaches(tenantID string) ([]*RiskLimit, error) {

	var result []*RiskLimit
	__ALL__, __ERR__ := s.limits.list(tenantID)
	if __ERR__ != nil {
		return nil, __ERR__
	}
	for _, limit := range __ALL__ {
		if limit.TenantID != tenantID {
			continue
		}
		if limit.Status == "breached" || limit.Status == "warning" {
			result = append(result, limit)
		}
	}
	return result, nil
}
