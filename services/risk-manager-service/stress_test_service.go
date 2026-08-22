package main

// StressTestService — regulatory capital stress testing.
//
// Data integrity doctrine:
//   - Baseline capital, risk-weighted exposure and baseline CAR are computed
//     from REAL portfolio data in Postgres (equity GL balances + loan book).
//   - Shock impacts are a documented parametric model applied to the REAL
//     exposure base — never a hardcoded ₦200bn/18.5% baseline.
//   - When portfolio data is missing/insufficient the run is recorded as
//     status="failed" with error="insufficient_data". No pre-baked "passed".

import (
	"database/sql"
	"errors"
	"fmt"
	"os"
	"sync"
	"time"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

// StressTestService handles stress testing operations
type StressTestService struct {
	tenantID string
	tests    map[string]*StressTest
	mu       sync.RWMutex
	db       *sql.DB
}

// NewStressTestService creates a new stress test service. No historical
// "passed" runs are seeded; the store starts empty.
func NewStressTestService(tenantID string) *StressTestService {
	svc := &StressTestService{
		tenantID: tenantID,
		tests:    make(map[string]*StressTest),
	}
	if dsn := os.Getenv("DATABASE_URL"); dsn != "" {
		if db, err := sql.Open("postgres", dsn); err == nil && db.Ping() == nil {
			svc.db = db
		} else {
			fmt.Printf("[stress-test] DATABASE_URL set but unreachable; runs will fail with insufficient_data\n")
		}
	}
	return svc
}

// portfolioBaseline loads the real capital and exposure base.
// Returns capital (kobo), loan book (kobo), fx exposure (kobo), error.
func (s *StressTestService) portfolioBaseline(tenantID string) (int64, int64, int64, error) {
	if s.db == nil {
		return 0, 0, 0, errors.New("no database connection")
	}
	// Capital: equity-category GL balances.
	var capital int64
	err := s.db.QueryRow(
		`SELECT COALESCE(SUM("balance_kobo"),0) FROM "glAccounts" WHERE "tenantId" = $1 AND "category" = 'equity'`,
		tenantID).Scan(&capital)
	if err != nil {
		return 0, 0, 0, fmt.Errorf("capital query failed: %w", err)
	}
	// Loan book: outstanding balances of active loans.
	var loanBook int64
	err = s.db.QueryRow(
		`SELECT COALESCE(SUM(outstanding_balance_kobo),0) FROM loans WHERE tenant_id = $1 AND status IN ('active','disbursed')`,
		tenantID).Scan(&loanBook)
	if err != nil {
		return 0, 0, 0, fmt.Errorf("loan book query failed: %w", err)
	}
	// FX exposure: absolute net executed FX positions per currency (NGN value).
	var fxExposure int64
	err = s.db.QueryRow(
		`SELECT COALESCE(SUM(ABS(buy_amount)),0) FROM fx_deals WHERE tenant_id = $1 AND status IN ('executed','settled') AND buy_currency <> 'NGN'`,
		tenantID).Scan(&fxExposure)
	if err != nil {
		// FX data optional: zero exposure, not an error.
		fxExposure = 0
	}
	if capital <= 0 && loanBook <= 0 {
		return 0, 0, 0, errors.New("no capital or loan data on record for tenant")
	}
	return capital, loanBook, fxExposure, nil
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

// GetTest retrieves a stress test by ID
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

// RunTest runs a stress test against the REAL portfolio baseline.
// Parametric impact model (explicit, documented assumptions):
//
//	interestRateShock (bp): 0.025% of the loan book per bp (≈2.5y duration)
//	ngnDepreciation (%):    30% pass-through on the real FX exposure per %
//	nplIncrease (%):        50% LGD on the shocked share of the loan book
//	gdpDecline (%):         20% of the loan book per % of GDP decline
//
// Status thresholds (CBN): >=15% passed, >=10% warning, else failed.
func (s *StressTestService) RunTest(tenantID, testID, userID string) (*StressTest, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	test, exists := s.tests[testID]
	if !exists || test.TenantID != tenantID {
		return nil, errors.New("test not found")
	}

	test.RunDate = time.Now()
	test.RunBy = userID
	test.UpdatedAt = time.Now()

	capital, loanBook, fxExposure, err := s.portfolioBaseline(tenantID)
	if err != nil {
		// Fail closed: never run a regulatory stress test on invented data.
		test.Status = "failed"
		test.Metadata["error"] = "insufficient_data"
		test.Metadata["errorDetail"] = err.Error()
		return test, nil
	}

	// RWA approximation: 100% weight on loan book, 50% on FX exposure.
	rwa := float64(loanBook) + 0.5*float64(fxExposure)
	if rwa <= 0 {
		test.Status = "failed"
		test.Metadata["error"] = "insufficient_data"
		test.Metadata["errorDetail"] = "zero risk-weighted exposure on record"
		return test, nil
	}

	test.BaselineCapital = capital
	test.CapitalRatio = float64(capital) / rwa * 100

	var totalImpact float64
	if shock, ok := test.Parameters["interestRateShock"]; ok {
		totalImpact += shock * 0.00025 * float64(loanBook) // per bp
	}
	if depreciation, ok := test.Parameters["ngnDepreciation"]; ok {
		totalImpact += (depreciation / 100) * 0.30 * float64(fxExposure)
	}
	if nplIncrease, ok := test.Parameters["nplIncrease"]; ok {
		totalImpact += (nplIncrease / 100) * 0.50 * float64(loanBook) // LGD 50%
	}
	if gdpDecline, ok := test.Parameters["gdpDecline"]; ok {
		totalImpact += (gdpDecline / 100) * 0.20 * float64(loanBook)
	}

	test.CapitalImpact = -int64(totalImpact)
	test.StressedCapital = test.BaselineCapital + test.CapitalImpact
	test.StressedRatio = float64(test.StressedCapital) / rwa * 100

	switch {
	case test.StressedRatio >= 15.0:
		test.Status = "passed"
	case test.StressedRatio >= 10.0:
		test.Status = "warning"
	default:
		test.Status = "failed"
	}
	test.Metadata["model"] = "parametric_v1"
	test.Metadata["loanBook_kobo"] = loanBook
	test.Metadata["fxExposure_kobo"] = fxExposure
	test.Metadata["rwa_kobo"] = int64(rwa)

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
			"testID":        test.TestID,
			"testName":      test.TestName,
			"scenario":      test.Scenario,
			"baselineRatio": test.CapitalRatio,
			"stressedRatio": test.StressedRatio,
			"capitalImpact": test.CapitalImpact,
			"status":        test.Status,
			"runDate":       test.RunDate.Format("2006-01-02"),
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
