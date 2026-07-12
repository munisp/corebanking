package main

import (
	"sync"
	"time"
)

// MarketRiskService handles market risk operations
type MarketRiskService struct {
	tenantID string
	risks    map[string]*MarketRisk
	mu       sync.RWMutex
}

// NewMarketRiskService creates a new market risk service
func NewMarketRiskService(tenantID string) *MarketRiskService {
	svc := &MarketRiskService{
		tenantID: tenantID,
		risks:    make(map[string]*MarketRisk),
	}
	svc.initializeDefaultData(tenantID)
	return svc
}

func (s *MarketRiskService) initializeDefaultData(tenantID string) {
	// Trading book VaR
	s.risks["mr-001"] = &MarketRisk{
		RiskID:            "mr-001",
		TenantID:          tenantID,
		Date:              time.Now(),
		Portfolio:         "trading",
		VaR:               2500000000, // 2.5B NGN
		VaRConfidence:     99.0,
		VaRHorizon:        1,
		ExpectedShortfall: 3500000000,
		StressVaR:         5000000000,
		DeltaNormal:       2300000000,
		HistoricalVaR:     2600000000,
		MonteCarloVaR:     2550000000,
		Currency:          "NGN",
		Status:            "within_limit",
		Metadata:          make(map[string]interface{}),
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	// FX book VaR
	s.risks["mr-002"] = &MarketRisk{
		RiskID:            "mr-002",
		TenantID:          tenantID,
		Date:              time.Now(),
		Portfolio:         "fx",
		VaR:               1500000000, // 1.5B NGN
		VaRConfidence:     99.0,
		VaRHorizon:        1,
		ExpectedShortfall: 2100000000,
		StressVaR:         3000000000,
		DeltaNormal:       1400000000,
		HistoricalVaR:     1550000000,
		MonteCarloVaR:     1520000000,
		Currency:          "NGN",
		Status:            "within_limit",
		Metadata:          make(map[string]interface{}),
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	// Interest rate book VaR
	s.risks["mr-003"] = &MarketRisk{
		RiskID:            "mr-003",
		TenantID:          tenantID,
		Date:              time.Now(),
		Portfolio:         "interest_rate",
		VaR:               800000000, // 800M NGN
		VaRConfidence:     99.0,
		VaRHorizon:        1,
		ExpectedShortfall: 1100000000,
		StressVaR:         1600000000,
		DeltaNormal:       750000000,
		HistoricalVaR:     820000000,
		MonteCarloVaR:     810000000,
		Currency:          "NGN",
		Status:            "within_limit",
		Metadata:          make(map[string]interface{}),
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	// Banking book
	s.risks["mr-004"] = &MarketRisk{
		RiskID:            "mr-004",
		TenantID:          tenantID,
		Date:              time.Now(),
		Portfolio:         "banking",
		VaR:               500000000, // 500M NGN
		VaRConfidence:     99.0,
		VaRHorizon:        1,
		ExpectedShortfall: 700000000,
		StressVaR:         1000000000,
		DeltaNormal:       480000000,
		HistoricalVaR:     520000000,
		MonteCarloVaR:     510000000,
		Currency:          "NGN",
		Status:            "within_limit",
		Metadata:          make(map[string]interface{}),
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}
}

// ListRisks returns market risks based on filters
func (s *MarketRiskService) ListRisks(tenantID, portfolio string) []*MarketRisk {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*MarketRisk
	for _, risk := range s.risks {
		if risk.TenantID != tenantID {
			continue
		}
		if portfolio != "" && risk.Portfolio != portfolio {
			continue
		}
		result = append(result, risk)
	}
	return result
}

// GetVaR returns current VaR summary
func (s *MarketRiskService) GetVaR(tenantID string) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var totalVaR, totalES, totalStressVaR int64
	portfolioVaR := make(map[string]int64)

	for _, risk := range s.risks {
		if risk.TenantID != tenantID {
			continue
		}
		totalVaR += risk.VaR
		totalES += risk.ExpectedShortfall
		totalStressVaR += risk.StressVaR
		portfolioVaR[risk.Portfolio] = risk.VaR
	}

	varLimit := int64(5000000000) // 5B NGN
	utilization := float64(totalVaR) / float64(varLimit) * 100

	status := "within_limit"
	if utilization > 90 {
		status = "warning"
	}
	if utilization > 100 {
		status = "breached"
	}

	return map[string]interface{}{
		"totalVaR":          totalVaR,
		"totalES":           totalES,
		"totalStressVaR":    totalStressVaR,
		"byPortfolio":       portfolioVaR,
		"varLimit":          varLimit,
		"utilization":       utilization,
		"status":            status,
		"confidence":        99.0,
		"horizon":           1,
		"timestamp":         time.Now().Format(time.RFC3339),
	}
}

// GetVaRHistory returns VaR history
func (s *MarketRiskService) GetVaRHistory(tenantID string) []map[string]interface{} {
	var history []map[string]interface{}

	// Generate sample history for last 30 days
	for i := 29; i >= 0; i-- {
		date := time.Now().AddDate(0, 0, -i)
		baseVaR := int64(2500000000)
		variation := int64(float64(baseVaR) * (0.9 + float64(i%10)*0.02))

		history = append(history, map[string]interface{}{
			"date":     date.Format("2006-01-02"),
			"totalVaR": variation,
			"limit":    int64(5000000000),
		})
	}

	return history
}

// GetSensitivityAnalysis returns sensitivity analysis
func (s *MarketRiskService) GetSensitivityAnalysis(tenantID string) map[string]interface{} {
	return map[string]interface{}{
		"interestRate": map[string]interface{}{
			"basisPointValue": 50000000,  // 50M NGN per bp
			"dv01":            50000000,
			"pv01":            50000000,
			"impact100bp":     5000000000,
		},
		"fx": map[string]interface{}{
			"usdSensitivity": 100000000, // 100M NGN per 1% USD move
			"gbpSensitivity": 50000000,
			"eurSensitivity": 30000000,
		},
		"equity": map[string]interface{}{
			"delta":  0.85,
			"gamma":  0.02,
			"vega":   15000000,
		},
		"credit": map[string]interface{}{
			"cs01":          25000000, // 25M NGN per bp spread
			"spreadDuration": 4.5,
		},
		"timestamp": time.Now().Format(time.RFC3339),
	}
}

// GetFXExposure returns FX exposure analysis
func (s *MarketRiskService) GetFXExposure(tenantID string) map[string]interface{} {
	return map[string]interface{}{
		"positions": map[string]interface{}{
			"USD": map[string]interface{}{
				"longPosition":  100000000,  // $100M
				"shortPosition": 80000000,
				"netPosition":   20000000,
				"ngnEquivalent": 30000000000, // 30B NGN
			},
			"GBP": map[string]interface{}{
				"longPosition":  30000000,
				"shortPosition": 25000000,
				"netPosition":   5000000,
				"ngnEquivalent": 9500000000,
			},
			"EUR": map[string]interface{}{
				"longPosition":  20000000,
				"shortPosition": 22000000,
				"netPosition":   -2000000,
				"ngnEquivalent": -3200000000,
			},
		},
		"totalNetExposure": 36300000000,
		"omlLimit":         50000000000, // Open Market Limit
		"utilization":      72.6,
		"status":           "within_limit",
		"timestamp":        time.Now().Format(time.RFC3339),
	}
}

// GetInterestRateRisk returns interest rate risk analysis
func (s *MarketRiskService) GetInterestRateRisk(tenantID string) map[string]interface{} {
	return map[string]interface{}{
		"repricing": map[string]interface{}{
			"0-30days":   150000000000,
			"31-90days":  100000000000,
			"91-180days": 80000000000,
			"181-365days": 60000000000,
			"over1year":  50000000000,
		},
		"gapAnalysis": map[string]interface{}{
			"0-30days":   20000000000,
			"31-90days":  -10000000000,
			"91-180days": 5000000000,
			"181-365days": -15000000000,
			"over1year":  10000000000,
		},
		"duration": map[string]interface{}{
			"assetDuration":     2.5,
			"liabilityDuration": 1.8,
			"durationGap":       0.7,
		},
		"nii": map[string]interface{}{
			"baseNII":          50000000000,
			"niiAt100bpUp":     52500000000,
			"niiAt100bpDown":   47500000000,
			"niiSensitivity":   5.0,
		},
		"eve": map[string]interface{}{
			"baseEVE":          200000000000,
			"eveAt100bpUp":     195000000000,
			"eveAt100bpDown":   205000000000,
			"eveSensitivity":   2.5,
		},
		"timestamp": time.Now().Format(time.RFC3339),
	}
}
