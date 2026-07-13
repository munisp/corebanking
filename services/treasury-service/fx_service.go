package main

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
)

// FXService handles foreign exchange operations
type FXService struct {
	tenantID  string
	positions map[string]*FXPosition
	deals     map[string]*FXDeal
	counter   int
	mu        sync.RWMutex
}

// NewFXService creates a new FX service
func NewFXService(tenantID string) *FXService {
	svc := &FXService{
		tenantID:  tenantID,
		positions: make(map[string]*FXPosition),
		deals:     make(map[string]*FXDeal),
		counter:   1000,
	}
	svc.initializeDefaultPositions(tenantID)
	return svc
}

func (s *FXService) initializeDefaultPositions(tenantID string) {
	currencies := []string{"USD", "GBP", "EUR", "CNY"}
	rates := map[string]float64{
		"USD": 1550.00,
		"GBP": 1950.00,
		"EUR": 1680.00,
		"CNY": 215.00,
	}
	limits := map[string]int64{
		"USD": 100000000, // 100M USD
		"GBP": 50000000,  // 50M GBP
		"EUR": 75000000,  // 75M EUR
		"CNY": 200000000, // 200M CNY
	}

	for _, currency := range currencies {
		s.positions[currency] = &FXPosition{
			PositionID:    uuid.New().String(),
			TenantID:      tenantID,
			Currency:      currency,
			LongPosition:  50000000,
			ShortPosition: 30000000,
			NetPosition:   20000000,
			AvgRate:       rates[currency] * 0.98,
			CurrentRate:   rates[currency],
			UnrealizedPnL: int64(float64(20000000) * rates[currency] * 0.02),
			Limit:         limits[currency],
			Utilization:   20.0,
			Status:        "within_limit",
			UpdatedAt:     time.Now(),
		}
	}
}

// ListFXPositions returns all FX positions
func (s *FXService) ListFXPositions(tenantID string) []*FXPosition {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*FXPosition
	for _, pos := range s.positions {
		if pos.TenantID == tenantID {
			result = append(result, pos)
		}
	}
	return result
}

// GetFXPosition returns FX position for a currency
func (s *FXService) GetFXPosition(tenantID, currency string) *FXPosition {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if pos, exists := s.positions[currency]; exists && pos.TenantID == tenantID {
		return pos
	}
	return nil
}

// ListFXDeals returns FX deals based on filters
func (s *FXService) ListFXDeals(tenantID, status, dealType string) []*FXDeal {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*FXDeal
	for _, deal := range s.deals {
		if deal.TenantID != tenantID {
			continue
		}
		if status != "" && deal.Status != status {
			continue
		}
		if dealType != "" && deal.DealType != dealType {
			continue
		}
		result = append(result, deal)
	}
	return result
}

// GetFXDeal retrieves an FX deal by ID
func (s *FXService) GetFXDeal(tenantID, dealID string) (*FXDeal, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	deal, exists := s.deals[dealID]
	if !exists || deal.TenantID != tenantID {
		return nil, errors.New("FX deal not found")
	}
	return deal, nil
}

// CreateFXDeal creates a new FX deal
func (s *FXService) CreateFXDeal(tenantID, dealerID string, req *CreateFXDealRequest) (*FXDeal, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.counter++
	dealNumber := fmt.Sprintf("FX-%s-%d", time.Now().Format("20060102"), s.counter)

	valueDate, _ := time.Parse("2006-01-02", req.ValueDate)

	deal := &FXDeal{
		DealID:         uuid.New().String(),
		TenantID:       tenantID,
		DealNumber:     dealNumber,
		DealType:       req.DealType,
		BuyCurrency:    req.BuyCurrency,
		SellCurrency:   req.SellCurrency,
		BuyAmount:      req.BuyAmount,
		SellAmount:     req.SellAmount,
		Rate:           req.Rate,
		ValueDate:      valueDate,
		CounterParty:   req.CounterParty,
		CounterPartyID: req.CounterPartyID,
		Purpose:        req.Purpose,
		Status:         "pending",
		DealerID:       dealerID,
		Metadata:       make(map[string]interface{}),
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	if req.MaturityDate != "" {
		maturity, _ := time.Parse("2006-01-02", req.MaturityDate)
		deal.MaturityDate = &maturity
	}

	s.deals[deal.DealID] = deal
	return deal, nil
}

// UpdateFXDeal updates an FX deal
func (s *FXService) UpdateFXDeal(deal *FXDeal) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	existing, exists := s.deals[deal.DealID]
	if !exists || existing.TenantID != deal.TenantID {
		return errors.New("FX deal not found")
	}

	deal.CreatedAt = existing.CreatedAt
	deal.DealNumber = existing.DealNumber
	deal.UpdatedAt = time.Now()
	s.deals[deal.DealID] = deal
	return nil
}

// ApproveFXDeal approves an FX deal
func (s *FXService) ApproveFXDeal(tenantID, dealID, approverID string) (*FXDeal, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	deal, exists := s.deals[dealID]
	if !exists || deal.TenantID != tenantID {
		return nil, errors.New("FX deal not found")
	}

	if deal.Status != "pending" {
		return nil, errors.New("can only approve pending deals")
	}

	now := time.Now()
	deal.Status = "approved"
	deal.ApprovedBy = approverID
	deal.ApprovedAt = &now
	deal.UpdatedAt = time.Now()

	return deal, nil
}

// ExecuteFXDeal executes an FX deal
func (s *FXService) ExecuteFXDeal(tenantID, dealID string) (*FXDeal, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	deal, exists := s.deals[dealID]
	if !exists || deal.TenantID != tenantID {
		return nil, errors.New("FX deal not found")
	}

	if deal.Status != "approved" {
		return nil, errors.New("can only execute approved deals")
	}

	deal.Status = "executed"
	deal.UpdatedAt = time.Now()

	// Update FX position
	if pos, exists := s.positions[deal.BuyCurrency]; exists {
		pos.LongPosition += deal.BuyAmount
		pos.NetPosition = pos.LongPosition - pos.ShortPosition
		pos.Utilization = float64(pos.NetPosition) / float64(pos.Limit) * 100
		pos.UpdatedAt = time.Now()
	}

	return deal, nil
}

// SettleFXDeal settles an FX deal
func (s *FXService) SettleFXDeal(tenantID, dealID string) (*FXDeal, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	deal, exists := s.deals[dealID]
	if !exists || deal.TenantID != tenantID {
		return nil, errors.New("FX deal not found")
	}

	if deal.Status != "executed" {
		return nil, errors.New("can only settle executed deals")
	}

	now := time.Now()
	deal.Status = "settled"
	deal.SettledAt = &now
	deal.UpdatedAt = time.Now()

	return deal, nil
}

// CancelFXDeal cancels an FX deal
func (s *FXService) CancelFXDeal(tenantID, dealID, reason string) (*FXDeal, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	deal, exists := s.deals[dealID]
	if !exists || deal.TenantID != tenantID {
		return nil, errors.New("FX deal not found")
	}

	if deal.Status == "settled" {
		return nil, errors.New("cannot cancel settled deals")
	}

	deal.Status = "cancelled"
	deal.Metadata["cancelReason"] = reason
	deal.UpdatedAt = time.Now()

	return deal, nil
}

// GetFXRates returns current FX rates
func (s *FXService) GetFXRates(tenantID string) map[string]interface{} {
	return map[string]interface{}{
		"USD": map[string]interface{}{
			"buy":    1545.00,
			"sell":   1555.00,
			"mid":    1550.00,
			"change": 0.5,
		},
		"GBP": map[string]interface{}{
			"buy":    1940.00,
			"sell":   1960.00,
			"mid":    1950.00,
			"change": -0.2,
		},
		"EUR": map[string]interface{}{
			"buy":    1670.00,
			"sell":   1690.00,
			"mid":    1680.00,
			"change": 0.3,
		},
		"CNY": map[string]interface{}{
			"buy":    210.00,
			"sell":   220.00,
			"mid":    215.00,
			"change": 0.1,
		},
		"timestamp": time.Now().Format(time.RFC3339),
	}
}

// GetFXPnL returns FX P&L
func (s *FXService) GetFXPnL(tenantID string) map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var totalPnL int64
	currencyPnL := make(map[string]int64)

	for currency, pos := range s.positions {
		if pos.TenantID == tenantID {
			currencyPnL[currency] = pos.UnrealizedPnL
			totalPnL += pos.UnrealizedPnL
		}
	}

	return map[string]interface{}{
		"totalUnrealizedPnL": totalPnL,
		"currencyPnL":        currencyPnL,
		"realizedPnL":        int64(500000000), // 500M NGN realized
		"timestamp":          time.Now().Format(time.RFC3339),
	}
}
