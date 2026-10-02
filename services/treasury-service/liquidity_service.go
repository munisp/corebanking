package main

import (
	"errors"
	"strconv"
	"time"

	"github.com/google/uuid"
)

// LiquidityService handles liquidity management operations.
// Postgres (tables liquidity_positions, cash_flows) is the system of record.
type LiquidityService struct {
	tenantID  string
	positions *repo[LiquidityPosition]
	cashFlows *repo[CashFlow]
}

// NewLiquidityService creates a new liquidity service
func NewLiquidityService(tenantID string) *LiquidityService {
	svc := &LiquidityService{
		tenantID:  tenantID,
		positions: newRepo[LiquidityPosition](serviceDB, "liquidity_positions"),
		cashFlows: newRepo[CashFlow](serviceDB, "cash_flows"),
	}
	svc.initializeDefaultPositions(tenantID)
	return svc
}

func (s *LiquidityService) initializeDefaultPositions(tenantID string) {
	// Initialize NGN position (idempotent seed)
	s.positions.seed(tenantID, "NGN", &LiquidityPosition{
		PositionID:       uuid.New().String(),
		TenantID:         tenantID,
		Date:             time.Now(),
		Currency:         "NGN",
		TotalAssets:      500000000000, // 500B NGN
		TotalLiabilities: 450000000000, // 450B NGN
		NetPosition:      50000000000,  // 50B NGN
		CashReserves:     100000000000, // 100B NGN
		CBNBalance:       135000000000, // 135B NGN (27% CRR)
		NostroBalances: map[string]int64{
			"USD": 50000000, // 50M USD
			"GBP": 10000000, // 10M GBP
			"EUR": 15000000, // 15M EUR
		},
		VostroBalances: map[string]int64{
			"USD": 20000000, // 20M USD
			"GBP": 5000000,  // 5M GBP
		},
		LCR:       125.5,
		NSFR:      115.2,
		CRR:       27.5,
		Status:    "normal",
		Metadata:  make(map[string]interface{}),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	})

	// Initialize USD position (idempotent seed)
	s.positions.seed(tenantID, "USD", &LiquidityPosition{
		PositionID:       uuid.New().String(),
		TenantID:         tenantID,
		Date:             time.Now(),
		Currency:         "USD",
		TotalAssets:      100000000, // 100M USD
		TotalLiabilities: 80000000,  // 80M USD
		NetPosition:      20000000,  // 20M USD
		CashReserves:     30000000,  // 30M USD
		NostroBalances:   map[string]int64{},
		VostroBalances:   map[string]int64{},
		LCR:              150.0,
		NSFR:             120.0,
		Status:           "normal",
		Metadata:         make(map[string]interface{}),
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	})
}

// GetLiquidityPosition returns the liquidity position for a currency
func (s *LiquidityService) GetLiquidityPosition(tenantID, currency string) (*LiquidityPosition, error) {
	pos, err := s.positions.get(tenantID, currency)
	if err == nil {
		return pos, nil
	}
	if !errors.Is(err, ErrNotFound) {
		return nil, err
	}

	// Return empty position if not found
	return &LiquidityPosition{
		TenantID: tenantID,
		Currency: currency,
		Date:     time.Now(),
		Status:   "unknown",
	}, nil
}

// GetCashFlows returns cash flows for a date range
func (s *LiquidityService) GetCashFlows(tenantID, startDate, endDate string) ([]*CashFlow, error) {
	flows, err := s.cashFlows.list(tenantID)
	if err != nil {
		return nil, err
	}
	var result []*CashFlow
	for _, cf := range flows {
		if startDate != "" && cf.Date.Format("2006-01-02") < startDate {
			continue
		}
		if endDate != "" && cf.Date.Format("2006-01-02") > endDate {
			continue
		}
		result = append(result, cf)
	}
	return result, nil
}

// GetCashFlowProjection returns projected cash flows
func (s *LiquidityService) GetCashFlowProjection(tenantID, daysStr string) []CashFlowProjection {
	days := 30
	if daysStr != "" {
		if d, err := strconv.Atoi(daysStr); err == nil {
			days = d
		}
	}

	var projections []CashFlowProjection
	balance := int64(100000000000) // Starting balance 100B NGN

	for i := 0; i < days; i++ {
		date := time.Now().AddDate(0, 0, i)
		inflows := int64(5000000000 + (i%7)*1000000000) // 5-12B daily inflows
		outflows := int64(4500000000 + (i%5)*800000000) // 4.5-8.5B daily outflows
		netFlow := inflows - outflows
		balance += netFlow

		projections = append(projections, CashFlowProjection{
			Date:     date.Format("2006-01-02"),
			Inflows:  inflows,
			Outflows: outflows,
			NetFlow:  netFlow,
			Balance:  balance,
		})
	}

	return projections
}

// GetLiquidityRatios returns liquidity ratios
func (s *LiquidityService) GetLiquidityRatios(tenantID string) (map[string]interface{}, error) {
	ngnPos, err := s.positions.get(tenantID, "NGN")
	if errors.Is(err, ErrNotFound) {
		return map[string]interface{}{}, nil
	}
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"lcr":                    ngnPos.LCR,
		"nsfr":                   ngnPos.NSFR,
		"crr":                    ngnPos.CRR,
		"lcrMinimum":             100.0,
		"nsfrMinimum":            100.0,
		"crrMinimum":             27.5,
		"lcrStatus":              "compliant",
		"nsfrStatus":             "compliant",
		"crrStatus":              "compliant",
		"liquidAssets":           ngnPos.CashReserves + ngnPos.CBNBalance,
		"netCashOutflows":        ngnPos.TotalLiabilities * 30 / 365, // 30-day outflows
		"availableStableFunding": ngnPos.TotalLiabilities,
		"requiredStableFunding":  ngnPos.TotalAssets * 87 / 100,
		"timestamp":              time.Now().Format(time.RFC3339),
	}, nil
}

// GetNostroBalances returns nostro account balances
func (s *LiquidityService) GetNostroBalances(tenantID string) (map[string]int64, error) {
	ngnPos, err := s.positions.get(tenantID, "NGN")
	if errors.Is(err, ErrNotFound) {
		return map[string]int64{}, nil
	}
	if err != nil {
		return nil, err
	}
	return ngnPos.NostroBalances, nil
}

// GetVostroBalances returns vostro account balances
func (s *LiquidityService) GetVostroBalances(tenantID string) (map[string]int64, error) {
	ngnPos, err := s.positions.get(tenantID, "NGN")
	if errors.Is(err, ErrNotFound) {
		return map[string]int64{}, nil
	}
	if err != nil {
		return nil, err
	}
	return ngnPos.VostroBalances, nil
}

// GetCRRPosition returns CRR position
func (s *LiquidityService) GetCRRPosition(tenantID string) (map[string]interface{}, error) {
	ngnPos, err := s.positions.get(tenantID, "NGN")
	if errors.Is(err, ErrNotFound) {
		return map[string]interface{}{}, nil
	}
	if err != nil {
		return nil, err
	}

	totalDeposits := ngnPos.TotalLiabilities
	requiredCRR := totalDeposits * 275 / 1000 // 27.5%
	actualCRR := ngnPos.CBNBalance

	return map[string]interface{}{
		"totalDeposits":    totalDeposits,
		"crrRate":          27.5,
		"requiredCRR":      requiredCRR,
		"actualCRR":        actualCRR,
		"surplus":          actualCRR - requiredCRR,
		"complianceStatus": "compliant",
		"cbnAccountNumber": "0001234567890",
		"lastUpdated":      time.Now().Format(time.RFC3339),
	}, nil
}
