package main

import (
	"sync"
	"time"
)

// PortfolioService handles portfolio operations
type PortfolioService struct {
	tenantID   string
	portfolios map[string]*Portfolio
	mu         sync.RWMutex
}

// NewPortfolioService creates a new portfolio service
func NewPortfolioService(tenantID string) *PortfolioService {
	svc := &PortfolioService{
		tenantID:   tenantID,
		portfolios: make(map[string]*Portfolio),
	}
	svc.initializeDefaultData(tenantID)
	return svc
}

func (s *PortfolioService) initializeDefaultData(tenantID string) {
	s.portfolios["rm-001"] = &Portfolio{
		PortfolioID:    "port-001",
		TenantID:       tenantID,
		RMID:           "rm-001",
		TotalCustomers: 45,
		TotalBalance:   5650500000, // 5.65B NGN
		TotalRevenue:   185025000,
		TotalProducts:  156,
		AverageNPS:     72.5,
		ChurnRate:      2.5,
		CrossSellRatio: 3.5,
		TargetRevenue:  200000000,
		ActualRevenue:  185025000,
		Achievement:    92.5,
		CreatedAt:      time.Now().AddDate(-1, 0, 0),
		UpdatedAt:      time.Now(),
	}

	s.portfolios["rm-002"] = &Portfolio{
		PortfolioID:    "port-002",
		TenantID:       tenantID,
		RMID:           "rm-002",
		TotalCustomers: 38,
		TotalBalance:   3200000000, // 3.2B NGN
		TotalRevenue:   120000000,
		TotalProducts:  98,
		AverageNPS:     68.0,
		ChurnRate:      3.2,
		CrossSellRatio: 2.6,
		TargetRevenue:  150000000,
		ActualRevenue:  120000000,
		Achievement:    80.0,
		CreatedAt:      time.Now().AddDate(-1, 0, 0),
		UpdatedAt:      time.Now(),
	}
}

// GetPortfolio returns portfolio for an RM
func (s *PortfolioService) GetPortfolio(tenantID, rmID string) *Portfolio {
	s.mu.RLock()
	defer s.mu.RUnlock()

	portfolio, exists := s.portfolios[rmID]
	if !exists || portfolio.TenantID != tenantID {
		return &Portfolio{
			TenantID:       tenantID,
			RMID:           rmID,
			TotalCustomers: 0,
			TotalBalance:   0,
			TotalRevenue:   0,
			TotalProducts:  0,
			AverageNPS:     0,
			ChurnRate:      0,
			CrossSellRatio: 0,
			TargetRevenue:  0,
			ActualRevenue:  0,
			Achievement:    0,
		}
	}
	return portfolio
}

// GetPortfolioSummary returns portfolio summary
func (s *PortfolioService) GetPortfolioSummary(tenantID, rmID string) map[string]interface{} {
	portfolio := s.GetPortfolio(tenantID, rmID)

	return map[string]interface{}{
		"totalCustomers": portfolio.TotalCustomers,
		"totalBalance":   portfolio.TotalBalance,
		"totalRevenue":   portfolio.TotalRevenue,
		"totalProducts":  portfolio.TotalProducts,
		"averageNPS":     portfolio.AverageNPS,
		"churnRate":      portfolio.ChurnRate,
		"crossSellRatio": portfolio.CrossSellRatio,
		"targetRevenue":  portfolio.TargetRevenue,
		"actualRevenue":  portfolio.ActualRevenue,
		"achievement":    portfolio.Achievement,
		"timestamp":      time.Now().Format(time.RFC3339),
	}
}

// GetPortfolioBySegment returns portfolio breakdown by segment
func (s *PortfolioService) GetPortfolioBySegment(tenantID, rmID string) map[string]interface{} {
	return map[string]interface{}{
		"segments": []map[string]interface{}{
			{
				"segment":       "hnwi",
				"customerCount": 5,
				"totalBalance":  2500000000,
				"revenue":       75000000,
				"averageNPS":    82.0,
			},
			{
				"segment":       "corporate",
				"customerCount": 8,
				"totalBalance":  2000000000,
				"revenue":       60000000,
				"averageNPS":    75.0,
			},
			{
				"segment":       "sme",
				"customerCount": 15,
				"totalBalance":  750000000,
				"revenue":       30000000,
				"averageNPS":    70.0,
			},
			{
				"segment":       "affluent",
				"customerCount": 12,
				"totalBalance":  350000000,
				"revenue":       17500000,
				"averageNPS":    72.0,
			},
			{
				"segment":       "mass",
				"customerCount": 5,
				"totalBalance":  50500000,
				"revenue":       2525000,
				"averageNPS":    65.0,
			},
		},
		"timestamp": time.Now().Format(time.RFC3339),
	}
}

// GetPortfolioPerformance returns portfolio performance metrics
func (s *PortfolioService) GetPortfolioPerformance(tenantID, rmID string) map[string]interface{} {
	return map[string]interface{}{
		"monthly": []map[string]interface{}{
			{"month": "2026-01", "revenue": 15000000, "target": 16666667, "achievement": 90.0},
			{"month": "2025-12", "revenue": 16500000, "target": 16666667, "achievement": 99.0},
			{"month": "2025-11", "revenue": 14800000, "target": 16666667, "achievement": 88.8},
			{"month": "2025-10", "revenue": 15200000, "target": 16666667, "achievement": 91.2},
			{"month": "2025-09", "revenue": 16000000, "target": 16666667, "achievement": 96.0},
			{"month": "2025-08", "revenue": 15500000, "target": 16666667, "achievement": 93.0},
		},
		"ytdRevenue":     185025000,
		"ytdTarget":      200000000,
		"ytdAchievement": 92.5,
		"balanceGrowth":  12.5,
		"customerGrowth": 8.0,
		"productGrowth":  15.0,
		"timestamp":      time.Now().Format(time.RFC3339),
	}
}

// GetPortfolioTargets returns portfolio targets
func (s *PortfolioService) GetPortfolioTargets(tenantID, rmID string) map[string]interface{} {
	return map[string]interface{}{
		"revenue": map[string]interface{}{
			"annual":      200000000,
			"monthly":     16666667,
			"ytdTarget":   200000000,
			"ytdActual":   185025000,
			"achievement": 92.5,
		},
		"acquisition": map[string]interface{}{
			"annual":      12,
			"ytdTarget":   12,
			"ytdActual":   10,
			"achievement": 83.3,
		},
		"crossSell": map[string]interface{}{
			"annual":      30,
			"ytdTarget":   30,
			"ytdActual":   28,
			"achievement": 93.3,
		},
		"nps": map[string]interface{}{
			"target": 75.0,
			"actual": 72.5,
			"status": "below_target",
		},
		"churn": map[string]interface{}{
			"target": 3.0,
			"actual": 2.5,
			"status": "on_target",
		},
		"timestamp": time.Now().Format(time.RFC3339),
	}
}
