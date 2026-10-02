package main

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// IndicatorService handles Key Risk Indicator operations
type IndicatorService struct {
	tenantID   string
	indicators *repo[RiskIndicator]
	mu         sync.RWMutex
}

// NewIndicatorService creates a new indicator service
func NewIndicatorService(tenantID string) *IndicatorService {
	svc := &IndicatorService{
		tenantID:   tenantID,
		indicators: newRepo[RiskIndicator](serviceDB, "risk_indicators"),
	}
	svc.initializeDefaultData(tenantID)
	return svc
}

func (s *IndicatorService) initializeDefaultData(tenantID string) {
	// NPL Ratio
	s.indicators.seed(tenantID, "kri-001", &RiskIndicator{
		IndicatorID:   "kri-001",
		TenantID:      tenantID,
		IndicatorName: "NPL Ratio",
		Category:      "credit",
		CurrentValue:  3.2,
		Threshold:     5.0,
		WarningLevel:  4.0,
		Unit:          "%",
		Trend:         "stable",
		Status:        "green",
		LastUpdated:   time.Now(),
		Metadata:      make(map[string]interface{}),
		CreatedAt:     time.Now().AddDate(-1, 0, 0),
		UpdatedAt:     time.Now(),
	})

	// Capital Adequacy Ratio
	s.indicators.seed(tenantID, "kri-002", &RiskIndicator{
		IndicatorID:   "kri-002",
		TenantID:      tenantID,
		IndicatorName: "Capital Adequacy Ratio",
		Category:      "capital",
		CurrentValue:  18.5,
		Threshold:     15.0,
		WarningLevel:  16.0,
		Unit:          "%",
		Trend:         "improving",
		Status:        "green",
		LastUpdated:   time.Now(),
		Metadata:      make(map[string]interface{}),
		CreatedAt:     time.Now().AddDate(-1, 0, 0),
		UpdatedAt:     time.Now(),
	})

	// Liquidity Coverage Ratio
	s.indicators.seed(tenantID, "kri-003", &RiskIndicator{
		IndicatorID:   "kri-003",
		TenantID:      tenantID,
		IndicatorName: "Liquidity Coverage Ratio",
		Category:      "liquidity",
		CurrentValue:  125.0,
		Threshold:     100.0,
		WarningLevel:  110.0,
		Unit:          "%",
		Trend:         "stable",
		Status:        "green",
		LastUpdated:   time.Now(),
		Metadata:      make(map[string]interface{}),
		CreatedAt:     time.Now().AddDate(-1, 0, 0),
		UpdatedAt:     time.Now(),
	})

	// VaR Utilization
	s.indicators.seed(tenantID, "kri-004", &RiskIndicator{
		IndicatorID:   "kri-004",
		TenantID:      tenantID,
		IndicatorName: "VaR Utilization",
		Category:      "market",
		CurrentValue:  50.0,
		Threshold:     100.0,
		WarningLevel:  80.0,
		Unit:          "%",
		Trend:         "stable",
		Status:        "green",
		LastUpdated:   time.Now(),
		Metadata:      make(map[string]interface{}),
		CreatedAt:     time.Now().AddDate(-1, 0, 0),
		UpdatedAt:     time.Now(),
	})

	// Operational Loss Rate - warning
	s.indicators.seed(tenantID, "kri-005", &RiskIndicator{
		IndicatorID:   "kri-005",
		TenantID:      tenantID,
		IndicatorName: "Operational Loss Rate",
		Category:      "operational",
		CurrentValue:  0.08,
		Threshold:     0.10,
		WarningLevel:  0.07,
		Unit:          "%",
		Trend:         "deteriorating",
		Status:        "amber",
		LastUpdated:   time.Now(),
		Metadata:      make(map[string]interface{}),
		CreatedAt:     time.Now().AddDate(-1, 0, 0),
		UpdatedAt:     time.Now(),
	})

	// Concentration Risk - warning
	s.indicators.seed(tenantID, "kri-006", &RiskIndicator{
		IndicatorID:   "kri-006",
		TenantID:      tenantID,
		IndicatorName: "Top 20 Borrowers Concentration",
		Category:      "credit",
		CurrentValue:  28.0,
		Threshold:     30.0,
		WarningLevel:  25.0,
		Unit:          "%",
		Trend:         "deteriorating",
		Status:        "amber",
		LastUpdated:   time.Now(),
		Metadata:      make(map[string]interface{}),
		CreatedAt:     time.Now().AddDate(-1, 0, 0),
		UpdatedAt:     time.Now(),
	})

	// System Availability
	s.indicators.seed(tenantID, "kri-007", &RiskIndicator{
		IndicatorID:   "kri-007",
		TenantID:      tenantID,
		IndicatorName: "Core Banking System Availability",
		Category:      "operational",
		CurrentValue:  99.5,
		Threshold:     99.0,
		WarningLevel:  99.5,
		Unit:          "%",
		Trend:         "stable",
		Status:        "green",
		LastUpdated:   time.Now(),
		Metadata:      make(map[string]interface{}),
		CreatedAt:     time.Now().AddDate(-1, 0, 0),
		UpdatedAt:     time.Now(),
	})

	// Fraud Loss Rate
	s.indicators.seed(tenantID, "kri-008", &RiskIndicator{
		IndicatorID:   "kri-008",
		TenantID:      tenantID,
		IndicatorName: "Fraud Loss Rate",
		Category:      "operational",
		CurrentValue:  0.02,
		Threshold:     0.05,
		WarningLevel:  0.03,
		Unit:          "%",
		Trend:         "improving",
		Status:        "green",
		LastUpdated:   time.Now(),
		Metadata:      make(map[string]interface{}),
		CreatedAt:     time.Now().AddDate(-1, 0, 0),
		UpdatedAt:     time.Now(),
	})
}

// ListIndicators returns indicators based on filters
func (s *IndicatorService) ListIndicators(tenantID, category string) ([]*RiskIndicator, error) {

	var result []*RiskIndicator
	__ALL__, __ERR__ := s.indicators.list(tenantID)
	if __ERR__ != nil {
		return nil, __ERR__
	}
	for _, indicator := range __ALL__ {
		if indicator.TenantID != tenantID {
			continue
		}
		if category != "" && indicator.Category != category {
			continue
		}
		result = append(result, indicator)
	}
	return result, nil
}

// GetIndicator retrieves an indicator by ID
func (s *IndicatorService) GetIndicator(tenantID, indicatorID string) (*RiskIndicator, error) {

	indicator, err := s.indicators.get(tenantID, indicatorID)
	if err != nil {
		return nil, errors.New("indicator not found")
	}
	return indicator, nil
}

// CreateIndicator creates a new indicator
func (s *IndicatorService) CreateIndicator(tenantID string, indicator *RiskIndicator) (*RiskIndicator, error) {

	indicator.IndicatorID = uuid.New().String()
	indicator.TenantID = tenantID
	indicator.LastUpdated = time.Now()
	indicator.CreatedAt = time.Now()
	indicator.UpdatedAt = time.Now()

	// Calculate status
	indicator.Status = s.calculateStatus(indicator)

	if err := s.indicators.put(tenantID, indicator.IndicatorID, indicator); err != nil {
		return nil, err
	}
	return indicator, nil
}

// UpdateIndicator updates an indicator
func (s *IndicatorService) UpdateIndicator(indicator *RiskIndicator) error {

	existing, err := s.indicators.get(indicator.TenantID, indicator.IndicatorID)
	if err != nil {
		return errors.New("indicator not found")
	}

	indicator.CreatedAt = existing.CreatedAt
	indicator.LastUpdated = time.Now()
	indicator.UpdatedAt = time.Now()

	// Calculate status
	indicator.Status = s.calculateStatus(indicator)

	return s.indicators.put(indicator.TenantID, indicator.IndicatorID, indicator)
}

func (s *IndicatorService) calculateStatus(indicator *RiskIndicator) string {
	// For metrics where higher is better (like CAR, LCR)
	if indicator.IndicatorName == "Capital Adequacy Ratio" ||
		indicator.IndicatorName == "Liquidity Coverage Ratio" ||
		indicator.IndicatorName == "Core Banking System Availability" {
		if indicator.CurrentValue < indicator.Threshold {
			return "red"
		}
		if indicator.CurrentValue < indicator.WarningLevel {
			return "amber"
		}
		return "green"
	}

	// For metrics where lower is better (like NPL, Loss Rate)
	if indicator.CurrentValue >= indicator.Threshold {
		return "red"
	}
	if indicator.CurrentValue >= indicator.WarningLevel {
		return "amber"
	}
	return "green"
}

// GetDashboard returns KRI dashboard summary
func (s *IndicatorService) GetDashboard(tenantID string) (map[string]interface{}, error) {

	var greenCount, amberCount, redCount int
	byCategory := make(map[string][]map[string]interface{})

	__ALL__, __ERR__ := s.indicators.list(tenantID)
	if __ERR__ != nil {
		return nil, __ERR__
	}
	for _, indicator := range __ALL__ {
		if indicator.TenantID != tenantID {
			continue
		}

		switch indicator.Status {
		case "green":
			greenCount++
		case "amber":
			amberCount++
		case "red":
			redCount++
		}

		byCategory[indicator.Category] = append(byCategory[indicator.Category], map[string]interface{}{
			"indicatorID":   indicator.IndicatorID,
			"indicatorName": indicator.IndicatorName,
			"currentValue":  indicator.CurrentValue,
			"threshold":     indicator.Threshold,
			"unit":          indicator.Unit,
			"status":        indicator.Status,
			"trend":         indicator.Trend,
		})
	}

	return map[string]interface{}{
		"greenIndicators": greenCount,
		"amberIndicators": amberCount,
		"redIndicators":   redCount,
		"byCategory":      byCategory,
		"timestamp":       time.Now().Format(time.RFC3339),
	}, nil
}

// GetTrends returns KRI trends
func (s *IndicatorService) GetTrends(tenantID string) (map[string]interface{}, error) {

	trends := make(map[string][]map[string]interface{})

	__ALL__, __ERR__ := s.indicators.list(tenantID)
	if __ERR__ != nil {
		return nil, __ERR__
	}
	for _, indicator := range __ALL__ {
		if indicator.TenantID != tenantID {
			continue
		}

		// Generate sample trend data for last 12 months
		var trendData []map[string]interface{}
		baseValue := indicator.CurrentValue
		for i := 11; i >= 0; i-- {
			date := time.Now().AddDate(0, -i, 0)
			variation := baseValue * (0.95 + float64(i%5)*0.02)
			trendData = append(trendData, map[string]interface{}{
				"month": date.Format("2006-01"),
				"value": variation,
			})
		}

		trends[indicator.IndicatorName] = trendData
	}

	return map[string]interface{}{
		"trends":    trends,
		"timestamp": time.Now().Format(time.RFC3339),
	}, nil
}
