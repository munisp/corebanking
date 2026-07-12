package main

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// StressTestService handles stress testing operations
type StressTestService struct {
	tenantID string
	tests    map[string]*StressTest
	mu       sync.RWMutex
}

// NewStressTestService creates a new stress test service
func NewStressTestService(tenantID string) *StressTestService {
	svc := &StressTestService{
		tenantID: tenantID,
		tests:    make(map[string]*StressTest),
	}
	svc.initializeDefaultData(tenantID)
	return svc
}

func (s *StressTestService) initializeDefaultData(tenantID string) {
	// Interest rate shock scenario
	s.tests["st-001"] = &StressTest{
		TestID:          "st-001",
		TenantID:        tenantID,
		TestName:        "Interest Rate Shock +300bp",
		TestType:        "sensitivity",
		Scenario:        "interest_rate_shock",
		Parameters: map[string]float64{
			"interestRateShock": 300,
			"horizon":           1,
		},
		BaselineCapital: 200000000000,
		StressedCapital: 185000000000,
		CapitalImpact:   -15000000000,
		CapitalRatio:    18.5,
		StressedRatio:   17.1,
		Status:          "passed",
		RunDate:         time.Now().AddDate(0, 0, -7),
		RunBy:           "risk-officer-001",
		Metadata:        make(map[string]interface{}),
		CreatedAt:       time.Now().AddDate(0, -1, 0),
		UpdatedAt:       time.Now().AddDate(0, 0, -7),
	}

	// Economic recession scenario
	s.tests["st-002"] = &StressTest{
		TestID:          "st-002",
		TenantID:        tenantID,
		TestName:        "Economic Recession Scenario",
		TestType:        "scenario",
		Scenario:        "economic_recession",
		Parameters: map[string]float64{
			"gdpDecline":        -5.0,
			"unemploymentRise":  8.0,
			"nplIncrease":       3.0,
			"interestRateShock": 200,
		},
		BaselineCapital: 200000000000,
		StressedCapital: 165000000000,
		CapitalImpact:   -35000000000,
		CapitalRatio:    18.5,
		StressedRatio:   15.3,
		Status:          "passed",
		RunDate:         time.Now().AddDate(0, 0, -14),
		RunBy:           "risk-officer-001",
		Metadata:        make(map[string]interface{}),
		CreatedAt:       time.Now().AddDate(0, -1, 0),
		UpdatedAt:       time.Now().AddDate(0, 0, -14),
	}

	// FX depreciation scenario
	s.tests["st-003"] = &StressTest{
		TestID:          "st-003",
		TenantID:        tenantID,
		TestName:        "Naira Depreciation 30%",
		TestType:        "sensitivity",
		Scenario:        "fx_depreciation",
		Parameters: map[string]float64{
			"ngnDepreciation": 30.0,
			"horizon":         1,
		},
		BaselineCapital: 200000000000,
		StressedCapital: 190000000000,
		CapitalImpact:   -10000000000,
		CapitalRatio:    18.5,
		StressedRatio:   17.6,
		Status:          "passed",
		RunDate:         time.Now().AddDate(0, 0, -7),
		RunBy:           "risk-officer-002",
		Metadata:        make(map[string]interface{}),
		CreatedAt:       time.Now().AddDate(0, -1, 0),
		UpdatedAt:       time.Now().AddDate(0, 0, -7),
	}

	// Severe stress scenario - warning
	s.tests["st-004"] = &StressTest{
		TestID:          "st-004",
		TenantID:        tenantID,
		TestName:        "Severe Combined Stress",
		TestType:        "scenario",
		Scenario:        "severe_combined",
		Parameters: map[string]float64{
			"gdpDecline":        -10.0,
			"unemploymentRise":  15.0,
			"nplIncrease":       5.0,
			"interestRateShock": 400,
			"ngnDepreciation":   50.0,
		},
		BaselineCapital: 200000000000,
		StressedCapital: 140000000000,
		CapitalImpact:   -60000000000,
		CapitalRatio:    18.5,
		StressedRatio:   13.0,
		Status:          "warning",
		RunDate:         time.Now().AddDate(0, 0, -14),
		RunBy:           "risk-officer-001",
		Metadata:        make(map[string]interface{}),
		CreatedAt:       time.Now().AddDate(0, -1, 0),
		UpdatedAt:       time.Now().AddDate(0, 0, -14),
	}
}

// ListTests returns stress tests based on filters
func (s *StressTestService) ListTests(tenantID, testType string) []*StressTest {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*StressTest
	for _, test := range s.tests {
		if test.TenantID != tenantID {
			continue
		}
		if testType != "" && test.TestType != testType {
			continue
		}
		result = append(result, test)
	}
	return result
}

// GetTest retrieves a test by ID
func (s *StressTestService) GetTest(tenantID, testID string) (*StressTest, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	test, exists := s.tests[testID]
	if !exists || test.TenantID != tenantID {
		return nil, errors.New("test not found")
	}
	return test, nil
}

// CreateTest creates a new stress test
func (s *StressTestService) CreateTest(tenantID, userID string, req *CreateStressTestRequest) (*StressTest, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	test := &StressTest{
		TestID:     uuid.New().String(),
		TenantID:   tenantID,
		TestName:   req.TestName,
		TestType:   req.TestType,
		Scenario:   req.Scenario,
		Parameters: req.Parameters,
		Status:     "pending",
		RunBy:      userID,
		Metadata:   make(map[string]interface{}),
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	s.tests[test.TestID] = test
	return test, nil
}

// RunTest runs a stress test
func (s *StressTestService) RunTest(tenantID, testID, userID string) (*StressTest, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	test, exists := s.tests[testID]
	if !exists || test.TenantID != tenantID {
		return nil, errors.New("test not found")
	}

	// Simulate stress test calculation
	test.BaselineCapital = 200000000000
	test.CapitalRatio = 18.5

	// Calculate impact based on parameters
	var totalImpact float64
	if shock, ok := test.Parameters["interestRateShock"]; ok {
		totalImpact += shock * 50000000 // 50M per bp
	}
	if depreciation, ok := test.Parameters["ngnDepreciation"]; ok {
		totalImpact += depreciation * 333333333 // ~333M per 1%
	}
	if nplIncrease, ok := test.Parameters["nplIncrease"]; ok {
		totalImpact += nplIncrease * 5000000000 // 5B per 1%
	}
	if gdpDecline, ok := test.Parameters["gdpDecline"]; ok {
		totalImpact += -gdpDecline * 2000000000 // 2B per 1%
	}

	test.CapitalImpact = -int64(totalImpact)
	test.StressedCapital = test.BaselineCapital + test.CapitalImpact
	test.StressedRatio = float64(test.StressedCapital) / float64(test.BaselineCapital) * test.CapitalRatio

	// Determine status
	if test.StressedRatio >= 15.0 {
		test.Status = "passed"
	} else if test.StressedRatio >= 10.0 {
		test.Status = "warning"
	} else {
		test.Status = "failed"
	}

	test.RunDate = time.Now()
	test.RunBy = userID
	test.UpdatedAt = time.Now()

	return test, nil
}

// GetScenarios returns available stress test scenarios
func (s *StressTestService) GetScenarios() []map[string]interface{} {
	return []map[string]interface{}{
		{
			"id":          "interest_rate_shock",
			"name":        "Interest Rate Shock",
			"description": "Tests impact of sudden interest rate changes",
			"parameters":  []string{"interestRateShock", "horizon"},
			"type":        "sensitivity",
		},
		{
			"id":          "fx_depreciation",
			"name":        "FX Depreciation",
			"description": "Tests impact of Naira depreciation",
			"parameters":  []string{"ngnDepreciation", "horizon"},
			"type":        "sensitivity",
		},
		{
			"id":          "economic_recession",
			"name":        "Economic Recession",
			"description": "Tests impact of economic downturn",
			"parameters":  []string{"gdpDecline", "unemploymentRise", "nplIncrease", "interestRateShock"},
			"type":        "scenario",
		},
		{
			"id":          "severe_combined",
			"name":        "Severe Combined Stress",
			"description": "Tests impact of multiple severe shocks",
			"parameters":  []string{"gdpDecline", "unemploymentRise", "nplIncrease", "interestRateShock", "ngnDepreciation"},
			"type":        "scenario",
		},
		{
			"id":          "oil_price_shock",
			"name":        "Oil Price Shock",
			"description": "Tests impact of oil price decline on Nigerian economy",
			"parameters":  []string{"oilPriceDecline", "fxImpact", "gdpImpact"},
			"type":        "scenario",
		},
		{
			"id":          "liquidity_crisis",
			"name":        "Liquidity Crisis",
			"description": "Tests impact of sudden liquidity withdrawal",
			"parameters":  []string{"depositOutflow", "interbankFreeze", "assetHaircut"},
			"type":        "scenario",
		},
	}
}

// GetResults returns stress test results summary
func (s *StressTestService) GetResults(tenantID string) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var passedCount, warningCount, failedCount int
	var results []map[string]interface{}

	for _, test := range s.tests {
		if test.TenantID != tenantID {
			continue
		}

		switch test.Status {
		case "passed":
			passedCount++
		case "warning":
			warningCount++
		case "failed":
			failedCount++
		}

		results = append(results, map[string]interface{}{
			"testID":          test.TestID,
			"testName":        test.TestName,
			"scenario":        test.Scenario,
			"baselineRatio":   test.CapitalRatio,
			"stressedRatio":   test.StressedRatio,
			"capitalImpact":   test.CapitalImpact,
			"status":          test.Status,
			"runDate":         test.RunDate.Format("2006-01-02"),
		})
	}

	return map[string]interface{}{
		"passedTests":  passedCount,
		"warningTests": warningCount,
		"failedTests":  failedCount,
		"results":      results,
		"timestamp":    time.Now().Format(time.RFC3339),
	}
}
