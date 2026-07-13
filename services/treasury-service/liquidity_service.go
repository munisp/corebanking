package main

import (
	"strconv"
	"sync"
	"time"

	"github.com/google/uuid"
)

// LiquidityService handles liquidity management operations
type LiquidityService struct {
	tenantID  string
	positions map[string]*LiquidityPosition
	cashFlows map[string]*CashFlow
	mu        sync.RWMutex
}

// NewLiquidityService creates a new liquidity service
func NewLiquidityService(tenantID string) *LiquidityService {
	svc := &LiquidityService{
		tenantID:  tenantID,
		positions: make(map[string]*LiquidityPosition),
		cashFlows: make(map[string]*CashFlow),
	}
	svc.initializeDefaultPositions(tenantID)
	return svc
}

func (s *LiquidityService) initializeDefaultPositions(tenantID string) {
	// Initialize NGN position
	s.positions["NGN"] = &LiquidityPosition{
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
			"USD": 50000000,  // 50M USD
			"GBP": 10000000,  // 10M GBP
			"EUR": 15000000,  // 15M EUR
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
	}

	// Initialize USD position
	s.positions["USD"] = &LiquidityPosition{
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
	}
}

// GetLiquidityPosition returns the liquidity position for a currency
func (s *LiquidityService) GetLiquidityPosition(tenantID, currency string) *LiquidityPosition {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if pos, exists := s.positions[currency]; exists && pos.TenantID == tenantID {
		return pos
	}

	// Return empty position if not found
	return &LiquidityPosition{
		TenantID: tenantID,
		Currency: currency,
		Date:     time.Now(),
		Status:   "unknown",
	}
}

// GetCashFlows returns cash flows for a date range
func (s *LiquidityService) GetCashFlows(tenantID, startDate, endDate string) []*CashFlow {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*CashFlow
	for _, cf := range s.cashFlows {
		if cf.TenantID == tenantID {
			result = append(result, cf)
		}
	}
	return result
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
		inflows := int64(5000000000 + (i%7)*1000000000)   // 5-12B daily inflows
		outflows := int64(4500000000 + (i%5)*800000000)   // 4.5-8.5B daily outflows
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
func (s *LiquidityService) GetLiquidityRatios(tenantID string) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	ngnPos := s.positions["NGN"]
	if ngnPos == nil {
		return map[string]interface{}{}
	}

	return map[string]interface{}{
		"lcr":                ngnPos.LCR,
		"nsfr":               ngnPos.NSFR,
		"crr":                ngnPos.CRR,
		"lcrMinimum":         100.0,
		"nsfrMinimum":        100.0,
		"crrMinimum":         27.5,
		"lcrStatus":          "compliant",
		"nsfrStatus":         "compliant",
		"crrStatus":          "compliant",
		"liquidAssets":       ngnPos.CashReserves + ngnPos.CBNBalance,
		"netCashOutflows":    ngnPos.TotalLiabilities * 30 / 365, // 30-day outflows
		"availableStableFunding": ngnPos.TotalLiabilities,
		"requiredStableFunding":  ngnPos.TotalAssets * 87 / 100,
		"timestamp":          time.Now().Format(time.RFC3339),
	}
}

// GetNostroBalances returns nostro account balances
func (s *LiquidityService) GetNostroBalances(tenantID string) map[string]int64 {
	s.mu.RLock()
	defer s.mu.RUnlock()

	ngnPos := s.positions["NGN"]
	if ngnPos == nil {
		return map[string]int64{}
	}
	return ngnPos.NostroBalances
}

// GetVostroBalances returns vostro account balances
func (s *LiquidityService) GetVostroBalances(tenantID string) map[string]int64 {
	s.mu.RLock()
	defer s.mu.RUnlock()

	ngnPos := s.positions["NGN"]
	if ngnPos == nil {
		return map[string]int64{}
	}
	return ngnPos.VostroBalances
}

// GetCRRPosition returns CRR position
func (s *LiquidityService) GetCRRPosition(tenantID string) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	ngnPos := s.positions["NGN"]
	if ngnPos == nil {
		return map[string]interface{}{}
	}

	totalDeposits := ngnPos.TotalLiabilities
	requiredCRR := totalDeposits * 275 / 1000 // 27.5%
	actualCRR := ngnPos.CBNBalance

	return map[string]interface{}{
		"totalDeposits":   totalDeposits,
		"crrRate":         27.5,
		"requiredCRR":     requiredCRR,
		"actualCRR":       actualCRR,
		"surplus":         actualCRR - requiredCRR,
		"complianceStatus": "compliant",
		"cbnAccountNumber": "0001234567890",
		"lastUpdated":     time.Now().Format(time.RFC3339),
	}
}
