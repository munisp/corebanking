package main

import (
	"sync"
	"time"

	"github.com/google/uuid"
)

// ALMService handles Asset-Liability Management operations
type ALMService struct {
	tenantID string
	gaps     map[string]*ALMGap
	risks    map[string]*InterestRateRisk
	mu       sync.RWMutex
}

// NewALMService creates a new ALM service
func NewALMService(tenantID string) *ALMService {
	svc := &ALMService{
		tenantID: tenantID,
		gaps:     make(map[string]*ALMGap),
		risks:    make(map[string]*InterestRateRisk),
	}
	svc.initializeDefaultData(tenantID)
	return svc
}

func (s *ALMService) initializeDefaultData(tenantID string) {
	// Initialize NGN gap analysis
	s.gaps["NGN"] = &ALMGap{
		GapID:    uuid.New().String(),
		TenantID: tenantID,
		Date:     time.Now(),
		Currency: "NGN",
		TimeBuckets: []ALMTimeBucket{
			{
				Bucket:        "0-30d",
				Assets:        100000000000, // 100B
				Liabilities:   120000000000, // 120B
				Gap:           -20000000000,
				CumulativeGap: -20000000000,
				GapRatio:      -16.67,
			},
			{
				Bucket:        "31-90d",
				Assets:        80000000000,  // 80B
				Liabilities:   70000000000,  // 70B
				Gap:           10000000000,
				CumulativeGap: -10000000000,
				GapRatio:      14.29,
			},
			{
				Bucket:        "91-180d",
				Assets:        120000000000, // 120B
				Liabilities:   100000000000, // 100B
				Gap:           20000000000,
				CumulativeGap: 10000000000,
				GapRatio:      20.0,
			},
			{
				Bucket:        "181-365d",
				Assets:        100000000000, // 100B
				Liabilities:   90000000000,  // 90B
				Gap:           10000000000,
				CumulativeGap: 20000000000,
				GapRatio:      11.11,
			},
			{
				Bucket:        ">1y",
				Assets:        100000000000, // 100B
				Liabilities:   70000000000,  // 70B
				Gap:           30000000000,
				CumulativeGap: 50000000000,
				GapRatio:      42.86,
			},
		},
		TotalAssets:      500000000000, // 500B
		TotalLiabilities: 450000000000, // 450B
		CumulativeGap:    50000000000,  // 50B
		GapRatio:         11.11,
		Status:           "asset_sensitive",
		CreatedAt:        time.Now(),
	}

	// Initialize interest rate risk
	s.risks["NGN"] = &InterestRateRisk{
		RiskID:           uuid.New().String(),
		TenantID:         tenantID,
		Date:             time.Now(),
		Currency:         "NGN",
		DurationGap:      0.85,
		ModifiedDuration: 2.5,
		BPVAssets:        125000000, // 125M per bp
		BPVLiabilities:   100000000, // 100M per bp
		NetBPV:           25000000,  // 25M per bp
		EaR:              2500000000, // 2.5B at risk (100bp shock)
		EVE:              50000000000, // 50B economic value
		Status:           "moderate",
		CreatedAt:        time.Now(),
	}
}

// GetALMGap returns ALM gap for a currency
func (s *ALMService) GetALMGap(tenantID, currency string) *ALMGap {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if gap, exists := s.gaps[currency]; exists && gap.TenantID == tenantID {
		return gap
	}

	return &ALMGap{
		TenantID: tenantID,
		Currency: currency,
		Date:     time.Now(),
		Status:   "unknown",
	}
}

// GetGapAnalysis returns comprehensive gap analysis
func (s *ALMService) GetGapAnalysis(tenantID string) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	ngnGap := s.gaps["NGN"]
	if ngnGap == nil {
		return map[string]interface{}{}
	}

	return map[string]interface{}{
		"currency":         "NGN",
		"date":             ngnGap.Date.Format("2006-01-02"),
		"timeBuckets":      ngnGap.TimeBuckets,
		"totalAssets":      ngnGap.TotalAssets,
		"totalLiabilities": ngnGap.TotalLiabilities,
		"cumulativeGap":    ngnGap.CumulativeGap,
		"gapRatio":         ngnGap.GapRatio,
		"status":           ngnGap.Status,
		"interpretation":   "Bank is asset-sensitive; NII will increase if rates rise",
		"recommendation":   "Consider extending liability duration to reduce gap",
		"timestamp":        time.Now().Format(time.RFC3339),
	}
}

// GetInterestRateRisk returns interest rate risk metrics
func (s *ALMService) GetInterestRateRisk(tenantID string) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	risk := s.risks["NGN"]
	if risk == nil {
		return map[string]interface{}{}
	}

	return map[string]interface{}{
		"currency":         "NGN",
		"date":             risk.Date.Format("2006-01-02"),
		"durationGap":      risk.DurationGap,
		"modifiedDuration": risk.ModifiedDuration,
		"bpvAssets":        risk.BPVAssets,
		"bpvLiabilities":   risk.BPVLiabilities,
		"netBPV":           risk.NetBPV,
		"earningsAtRisk":   risk.EaR,
		"economicValue":    risk.EVE,
		"status":           risk.Status,
		"riskLevel":        "moderate",
		"timestamp":        time.Now().Format(time.RFC3339),
	}
}

// GetDurationAnalysis returns duration analysis
func (s *ALMService) GetDurationAnalysis(tenantID string) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	risk := s.risks["NGN"]
	if risk == nil {
		return map[string]interface{}{}
	}

	return map[string]interface{}{
		"assetDuration":     2.8,
		"liabilityDuration": 1.95,
		"durationGap":       risk.DurationGap,
		"modifiedDuration":  risk.ModifiedDuration,
		"convexity":         0.15,
		"interpretation":    "Positive duration gap indicates asset-sensitive position",
		"impactOf100bp":     risk.EaR,
		"timestamp":         time.Now().Format(time.RFC3339),
	}
}

// RunStressTest runs a stress test scenario
func (s *ALMService) RunStressTest(tenantID, scenario string, rateShift, fxShift float64) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	risk := s.risks["NGN"]
	if risk == nil {
		return map[string]interface{}{"error": "no risk data available"}
	}

	// Calculate impact
	rateImpact := int64(float64(risk.NetBPV) * rateShift * 100) // Convert % to bp
	fxImpact := int64(50000000 * fxShift / 100)                 // Assume 50M FX exposure

	return map[string]interface{}{
		"scenario":       scenario,
		"rateShift":      rateShift,
		"fxShift":        fxShift,
		"rateImpact":     rateImpact,
		"fxImpact":       fxImpact,
		"totalImpact":    rateImpact + fxImpact,
		"capitalImpact":  float64(rateImpact+fxImpact) / float64(risk.EVE) * 100,
		"lcrImpact":      -2.5 * rateShift,
		"nsfrImpact":     -1.5 * rateShift,
		"recommendation": "Maintain adequate capital buffers",
		"timestamp":      time.Now().Format(time.RFC3339),
	}
}

// GetScenarioAnalysis returns predefined scenario analysis
func (s *ALMService) GetScenarioAnalysis(tenantID string) []map[string]interface{} {
	scenarios := []map[string]interface{}{
		{
			"name":        "Base Case",
			"description": "Current market conditions",
			"rateChange":  0.0,
			"fxChange":    0.0,
			"niiImpact":   0,
			"eveImpact":   0,
		},
		{
			"name":        "Rate Hike +200bp",
			"description": "CBN tightening scenario",
			"rateChange":  2.0,
			"fxChange":    -5.0,
			"niiImpact":   5000000000,  // 5B increase
			"eveImpact":   -2500000000, // 2.5B decrease
		},
		{
			"name":        "Rate Cut -100bp",
			"description": "CBN easing scenario",
			"rateChange":  -1.0,
			"fxChange":    10.0,
			"niiImpact":   -2500000000, // 2.5B decrease
			"eveImpact":   1250000000,  // 1.25B increase
		},
		{
			"name":        "Stress Scenario",
			"description": "Severe market stress",
			"rateChange":  5.0,
			"fxChange":    30.0,
			"niiImpact":   12500000000, // 12.5B increase
			"eveImpact":   -6250000000, // 6.25B decrease
		},
	}

	return scenarios
}
