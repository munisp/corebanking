package main

import (
	"errors"
	"strconv"
	"sync"
	"time"

	"github.com/google/uuid"
)

// InvestmentService handles investment operations
type InvestmentService struct {
	tenantID    string
	investments map[string]*Investment
	mu          sync.RWMutex
}

// NewInvestmentService creates a new investment service
func NewInvestmentService(tenantID string) *InvestmentService {
	svc := &InvestmentService{
		tenantID:    tenantID,
		investments: make(map[string]*Investment),
	}
	svc.initializeDefaultInvestments(tenantID)
	return svc
}

func (s *InvestmentService) initializeDefaultInvestments(tenantID string) {
	// Treasury Bills
	s.investments["inv-001"] = &Investment{
		InvestmentID:   "inv-001",
		TenantID:       tenantID,
		InvestmentType: "treasury_bill",
		Issuer:         "Central Bank of Nigeria",
		IssuerID:       "CBN",
		FaceValue:      50000000000, // 50B NGN
		PurchasePrice:  48500000000, // 48.5B NGN
		CurrentValue:   49200000000, // 49.2B NGN
		Currency:       "NGN",
		CouponRate:     0,
		YieldRate:      18.5,
		PurchaseDate:   time.Now().AddDate(0, -2, 0),
		MaturityDate:   time.Now().AddDate(0, 1, 0),
		Status:         "active",
		Portfolio:      "held_to_maturity",
		UnrealizedPnL:  700000000,
		Metadata:       make(map[string]interface{}),
		CreatedAt:      time.Now().AddDate(0, -2, 0),
		UpdatedAt:      time.Now(),
	}

	// FGN Bonds
	s.investments["inv-002"] = &Investment{
		InvestmentID:   "inv-002",
		TenantID:       tenantID,
		InvestmentType: "bond",
		Issuer:         "Federal Government of Nigeria",
		IssuerID:       "FGN",
		FaceValue:      100000000000, // 100B NGN
		PurchasePrice:  98000000000,  // 98B NGN
		CurrentValue:   102000000000, // 102B NGN
		Currency:       "NGN",
		CouponRate:     14.5,
		YieldRate:      15.2,
		PurchaseDate:   time.Now().AddDate(-1, 0, 0),
		MaturityDate:   time.Now().AddDate(4, 0, 0),
		Status:         "active",
		Portfolio:      "available_for_sale",
		UnrealizedPnL:  4000000000,
		AccruedInterest: 3625000000,
		Metadata:       make(map[string]interface{}),
		CreatedAt:      time.Now().AddDate(-1, 0, 0),
		UpdatedAt:      time.Now(),
	}

	// Commercial Paper
	s.investments["inv-003"] = &Investment{
		InvestmentID:   "inv-003",
		TenantID:       tenantID,
		InvestmentType: "commercial_paper",
		Issuer:         "Dangote Industries",
		IssuerID:       "DANGOTE",
		FaceValue:      10000000000, // 10B NGN
		PurchasePrice:  9700000000,  // 9.7B NGN
		CurrentValue:   9850000000,  // 9.85B NGN
		Currency:       "NGN",
		CouponRate:     0,
		YieldRate:      20.5,
		PurchaseDate:   time.Now().AddDate(0, -1, 0),
		MaturityDate:   time.Now().AddDate(0, 2, 0),
		Status:         "active",
		Portfolio:      "trading",
		UnrealizedPnL:  150000000,
		Metadata:       make(map[string]interface{}),
		CreatedAt:      time.Now().AddDate(0, -1, 0),
		UpdatedAt:      time.Now(),
	}
}

// ListInvestments returns investments based on filters
func (s *InvestmentService) ListInvestments(tenantID, investmentType, status string) []*Investment {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*Investment
	for _, inv := range s.investments {
		if inv.TenantID != tenantID {
			continue
		}
		if investmentType != "" && inv.InvestmentType != investmentType {
			continue
		}
		if status != "" && inv.Status != status {
			continue
		}
		result = append(result, inv)
	}
	return result
}

// GetInvestment retrieves an investment by ID
func (s *InvestmentService) GetInvestment(tenantID, investmentID string) (*Investment, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	inv, exists := s.investments[investmentID]
	if !exists || inv.TenantID != tenantID {
		return nil, errors.New("investment not found")
	}
	return inv, nil
}

// CreateInvestment creates a new investment
func (s *InvestmentService) CreateInvestment(tenantID string, req *CreateInvestmentRequest) (*Investment, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	purchaseDate, _ := time.Parse("2006-01-02", req.PurchaseDate)
	maturityDate, _ := time.Parse("2006-01-02", req.MaturityDate)

	inv := &Investment{
		InvestmentID:   uuid.New().String(),
		TenantID:       tenantID,
		InvestmentType: req.InvestmentType,
		Issuer:         req.Issuer,
		IssuerID:       req.IssuerID,
		FaceValue:      req.FaceValue,
		PurchasePrice:  req.PurchasePrice,
		CurrentValue:   req.PurchasePrice,
		Currency:       req.Currency,
		CouponRate:     req.CouponRate,
		YieldRate:      req.YieldRate,
		PurchaseDate:   purchaseDate,
		MaturityDate:   maturityDate,
		Status:         "active",
		Portfolio:      req.Portfolio,
		UnrealizedPnL:  0,
		Metadata:       make(map[string]interface{}),
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	s.investments[inv.InvestmentID] = inv
	return inv, nil
}

// UpdateInvestment updates an investment
func (s *InvestmentService) UpdateInvestment(inv *Investment) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	existing, exists := s.investments[inv.InvestmentID]
	if !exists || existing.TenantID != inv.TenantID {
		return errors.New("investment not found")
	}

	inv.CreatedAt = existing.CreatedAt
	inv.UpdatedAt = time.Now()
	s.investments[inv.InvestmentID] = inv
	return nil
}

// SellInvestment sells an investment
func (s *InvestmentService) SellInvestment(tenantID, investmentID string, salePrice int64) (*Investment, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	inv, exists := s.investments[investmentID]
	if !exists || inv.TenantID != tenantID {
		return nil, errors.New("investment not found")
	}

	if inv.Status != "active" {
		return nil, errors.New("can only sell active investments")
	}

	inv.Status = "sold"
	inv.CurrentValue = salePrice
	inv.UnrealizedPnL = 0
	inv.Metadata["salePrice"] = salePrice
	inv.Metadata["realizedPnL"] = salePrice - inv.PurchasePrice
	inv.Metadata["saleDate"] = time.Now().Format(time.RFC3339)
	inv.UpdatedAt = time.Now()

	return inv, nil
}

// GetPortfolioSummary returns portfolio summary
func (s *InvestmentService) GetPortfolioSummary(tenantID string) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var totalValue, totalPurchasePrice, totalUnrealizedPnL, totalAccruedInterest int64
	var totalYield float64
	var count int

	byType := make(map[string]int64)
	byPortfolio := make(map[string]int64)

	for _, inv := range s.investments {
		if inv.TenantID != tenantID || inv.Status != "active" {
			continue
		}
		count++
		totalValue += inv.CurrentValue
		totalPurchasePrice += inv.PurchasePrice
		totalUnrealizedPnL += inv.UnrealizedPnL
		totalAccruedInterest += inv.AccruedInterest
		totalYield += inv.YieldRate

		byType[inv.InvestmentType] += inv.CurrentValue
		byPortfolio[inv.Portfolio] += inv.CurrentValue
	}

	avgYield := 0.0
	if count > 0 {
		avgYield = totalYield / float64(count)
	}

	return map[string]interface{}{
		"totalValue":          totalValue,
		"totalPurchasePrice":  totalPurchasePrice,
		"totalUnrealizedPnL":  totalUnrealizedPnL,
		"totalAccruedInterest": totalAccruedInterest,
		"avgYield":            avgYield,
		"investmentCount":     count,
		"byType":              byType,
		"byPortfolio":         byPortfolio,
		"timestamp":           time.Now().Format(time.RFC3339),
	}
}

// GetMaturingInvestments returns investments maturing within specified days
func (s *InvestmentService) GetMaturingInvestments(tenantID, daysStr string) []*Investment {
	s.mu.RLock()
	defer s.mu.RUnlock()

	days := 30
	if daysStr != "" {
		if d, err := strconv.Atoi(daysStr); err == nil {
			days = d
		}
	}

	cutoff := time.Now().AddDate(0, 0, days)
	var result []*Investment

	for _, inv := range s.investments {
		if inv.TenantID != tenantID || inv.Status != "active" {
			continue
		}
		if inv.MaturityDate.Before(cutoff) {
			result = append(result, inv)
		}
	}
	return result
}

// GetPortfolioYield returns portfolio yield analysis
func (s *InvestmentService) GetPortfolioYield(tenantID string) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	yieldByType := make(map[string]float64)
	countByType := make(map[string]int)

	for _, inv := range s.investments {
		if inv.TenantID != tenantID || inv.Status != "active" {
			continue
		}
		yieldByType[inv.InvestmentType] += inv.YieldRate
		countByType[inv.InvestmentType]++
	}

	avgYieldByType := make(map[string]float64)
	for invType, totalYield := range yieldByType {
		avgYieldByType[invType] = totalYield / float64(countByType[invType])
	}

	return map[string]interface{}{
		"avgYieldByType":    avgYieldByType,
		"benchmarkRate":     18.0, // CBN MPR
		"spreadOverBenchmark": 2.5,
		"timestamp":         time.Now().Format(time.RFC3339),
	}
}
