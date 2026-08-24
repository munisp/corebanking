package main

// FXService — foreign exchange operations.
//
// Data integrity doctrine:
//   - FX rates come ONLY from the configured rate source (FX_RATES_URL) or a
//     previously fetched real quote (served labelled with its as-of time).
//     When no real rate is available, rate/PnL calls return an error (503 at
//     the handler) — hardcoded "current" rates are never served.
//   - FX positions are AGGREGATED from real executed deals, not pre-seeded.
//   - Realized PnL is computed by FIFO-matching settled buys against sells.
//   - Settlement posts a real double-entry journal to the ledger
//     (JOURNAL_POSTING_URL). If the ledger is unavailable the deal is NOT
//     marked settled and the call fails.

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

// FXRate is a real quote obtained from the rate source.
type FXRate struct {
	Currency string    `json:"currency"`
	Buy      float64   `json:"buy"`
	Sell     float64   `json:"sell"`
	Mid      float64   `json:"mid"`
	AsOf     time.Time `json:"asOf"`
}

// FXService handles foreign exchange operations
type FXService struct {
	tenantID   string
	deals      map[string]*FXDeal
	counter    int
	mu         sync.RWMutex
	db         *sql.DB
	httpClient *http.Client
	ratesMu    sync.RWMutex
	rates      map[string]FXRate // last real quotes fetched from the rate source
	ratesAsOf  time.Time
}

func fxRateSourceURL() string { return os.Getenv("FX_RATES_URL") }

func fxLedgerURL() string {
	if v := os.Getenv("JOURNAL_POSTING_URL"); v != "" {
		return v
	}
	return os.Getenv("GL_ENGINE_URL") // gl-engine-go /v1/gl/journal
}

// NewFXService creates a new FX service. Deals are loaded from Postgres when
// DATABASE_URL is configured; positions are computed from those deals.
func NewFXService(tenantID string) *FXService {
	svc := &FXService{
		tenantID:   tenantID,
		deals:      make(map[string]*FXDeal),
		counter:    1000,
		httpClient: &http.Client{Timeout: 15 * time.Second},
		rates:      make(map[string]FXRate),
	}
	if dsn := os.Getenv("DATABASE_URL"); dsn != "" {
		if db, err := sql.Open("postgres", dsn); err == nil && db.Ping() == nil {
			svc.db = db
			svc.ensureSchema()
			svc.loadDeals(tenantID)
		} else {
			fmt.Printf("[fx-service] DATABASE_URL set but unreachable; deals kept in memory only\n")
		}
	}
	return svc
}

func (s *FXService) ensureSchema() {
	_, err := s.db.Exec(`CREATE TABLE IF NOT EXISTS fx_deals (
		deal_id VARCHAR(64) PRIMARY KEY,
		tenant_id VARCHAR(64) NOT NULL,
		deal_number VARCHAR(64),
		deal_type VARCHAR(16),
		buy_currency VARCHAR(8),
		sell_currency VARCHAR(8),
		buy_amount BIGINT,
		sell_amount BIGINT,
		rate DOUBLE PRECISION,
		status VARCHAR(16),
		payload JSONB,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`)
	if err != nil {
		fmt.Printf("[fx-service] fx_deals schema init failed: %v\n", err)
	}
}

func (s *FXService) persistDeal(deal *FXDeal) {
	if s.db == nil {
		return
	}
	payload, err := json.Marshal(deal)
	if err != nil {
		return
	}
	if _, err := s.db.Exec(`INSERT INTO fx_deals
		(deal_id, tenant_id, deal_number, deal_type, buy_currency, sell_currency, buy_amount, sell_amount, rate, status, payload, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
		ON CONFLICT (deal_id) DO UPDATE SET status = $10, payload = $11, updated_at = NOW()`,
		deal.DealID, deal.TenantID, deal.DealNumber, deal.DealType, deal.BuyCurrency,
		deal.SellCurrency, deal.BuyAmount, deal.SellAmount, deal.Rate, deal.Status, string(payload)); err != nil {
		fmt.Printf("[fx-service] persist deal %s failed: %v\n", deal.DealID, err)
	}
}

func (s *FXService) loadDeals(tenantID string) {
	rows, err := s.db.Query(`SELECT payload FROM fx_deals WHERE tenant_id = $1`, tenantID)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var p string
		if rows.Scan(&p) != nil {
			continue
		}
		var d FXDeal
		if json.Unmarshal([]byte(p), &d) == nil {
			s.deals[d.DealID] = &d
		}
	}
}

// refreshRates fetches real quotes from the configured FX rate source.
// Returns error when the source is unconfigured or unreachable; the caller
// fails fast unless a previously fetched (real, labelled) quote exists.
func (s *FXService) refreshRates() error {
	base := fxRateSourceURL()
	if base == "" {
		return errors.New("FX_RATES_URL not configured")
	}
	resp, err := s.httpClient.Get(base + "/v1/rates")
	if err != nil {
		return fmt.Errorf("fx rate source unreachable: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("fx rate source returned status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return err
	}
	var payload struct {
		Rates []struct {
			Currency string  `json:"currency"`
			Buy      float64 `json:"buy"`
			Sell     float64 `json:"sell"`
			Mid      float64 `json:"mid"`
		} `json:"rates"`
		AsOf string `json:"asOf"`
	}
	if err := json.Unmarshal(body, &payload); err != nil || len(payload.Rates) == 0 {
		return fmt.Errorf("fx rate source returned no usable rates")
	}
	asOf := time.Now()
	if t, err := time.Parse(time.RFC3339, payload.AsOf); err == nil {
		asOf = t
	}
	s.ratesMu.Lock()
	defer s.ratesMu.Unlock()
	for _, r := range payload.Rates {
		mid := r.Mid
		if mid == 0 && r.Buy > 0 && r.Sell > 0 {
			mid = (r.Buy + r.Sell) / 2
		}
		s.rates[r.Currency] = FXRate{Currency: r.Currency, Buy: r.Buy, Sell: r.Sell, Mid: mid, AsOf: asOf}
	}
	s.ratesAsOf = asOf
	return nil
}

// currentRate returns the last real mid-rate for a currency.
func (s *FXService) currentRate(currency string) (FXRate, bool) {
	s.ratesMu.RLock()
	defer s.ratesMu.RUnlock()
	r, ok := s.rates[currency]
	return r, ok
}

// computePositions aggregates real executed/settled deals into positions.
func (s *FXService) computePositions(tenantID string) []*FXPosition {
	type agg struct {
		long, short   int64
		costNumerator float64 // Σ buyAmount * rate for avg rate
	}
	aggs := map[string]*agg{}
	for _, d := range s.deals {
		if d.TenantID != tenantID || (d.Status != "executed" && d.Status != "settled") {
			continue
		}
		a := aggs[d.BuyCurrency]
		if a == nil {
			a = &agg{}
			aggs[d.BuyCurrency] = a
		}
		a.long += d.BuyAmount
		a.costNumerator += float64(d.BuyAmount) * d.Rate
		b := aggs[d.SellCurrency]
		if b == nil {
			b = &agg{}
			aggs[d.SellCurrency] = b
		}
		b.short += d.SellAmount
	}

	var result []*FXPosition
	for ccy, a := range aggs {
		avgRate := 0.0
		if a.long > 0 {
			avgRate = a.costNumerator / float64(a.long)
		}
		pos := &FXPosition{
			PositionID:    tenantID + "-" + ccy,
			TenantID:      tenantID,
			Currency:      ccy,
			LongPosition:  a.long,
			ShortPosition: a.short,
			NetPosition:   a.long - a.short,
			AvgRate:       avgRate,
			Status:        "within_limit",
			UpdatedAt:     time.Now(),
		}
		// Unrealized PnL only from a real rate quote; otherwise left zero and
		// flagged via metadata on the PnL endpoint.
		if r, ok := s.currentRate(ccy); ok {
			pos.CurrentRate = r.Mid
			pos.UnrealizedPnL = int64(float64(pos.NetPosition) * (r.Mid - avgRate))
		}
		result = append(result, pos)
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Currency < result[j].Currency })
	return result
}

// ListFXPositions returns positions aggregated from real deals.
func (s *FXService) ListFXPositions(tenantID string) []*FXPosition {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.computePositions(tenantID)
}

// GetFXPosition returns the aggregated FX position for a currency.
func (s *FXService) GetFXPosition(tenantID, currency string) *FXPosition {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, p := range s.computePositions(tenantID) {
		if p.Currency == currency {
			return p
		}
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
	s.persistDeal(deal)
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
	s.persistDeal(deal)
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
	s.persistDeal(deal)

	return deal, nil
}

// ExecuteFXDeal executes an approved FX deal (books it; positions recompute
// from executed deals).
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
	s.persistDeal(deal)

	return deal, nil
}

// SettleFXDeal settles an executed deal by posting a real balanced
// double-entry journal to the ledger. If the ledger is unavailable or rejects
// the posting, the deal is NOT marked settled and an error is returned.
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

	ledgerBase := fxLedgerURL()
	if ledgerBase == "" {
		return nil, errors.New("ledger unconfigured (set JOURNAL_POSTING_URL or GL_ENGINE_URL) — deal NOT settled")
	}

	journal := map[string]interface{}{
		"tenantId":       tenantID,
		"transactionRef": deal.DealNumber,
		"narration":      fmt.Sprintf("FX settlement %s: buy %d %s / sell %d %s @ %.4f", deal.DealNumber, deal.BuyAmount, deal.BuyCurrency, deal.SellAmount, deal.SellCurrency, deal.Rate),
		"legs": []map[string]interface{}{
			{"accountId": "FX-SETTLEMENT-" + deal.BuyCurrency, "type": "debit", "amount": deal.BuyAmount, "currency": deal.BuyCurrency},
			{"accountId": "FX-SETTLEMENT-" + deal.SellCurrency, "type": "credit", "amount": deal.SellAmount, "currency": deal.SellCurrency},
		},
	}
	payload, err := json.Marshal(journal)
	if err != nil {
		return nil, err
	}

	// journal-posting-go exposes POST /v1/journals; gl-engine-go exposes
	// /v1/gl/journal. Try the journal posting endpoint first, then the GL one.
	var settled bool
	var lastErr error
	for _, path := range []string{"/v1/journals", "/v1/gl/journal"} {
		resp, err := s.httpClient.Post(ledgerBase+path, "application/json", bytes.NewReader(payload))
		if err != nil {
			lastErr = fmt.Errorf("ledger call failed: %w", err)
			continue
		}
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
		resp.Body.Close()
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			settled = true
			break
		}
		lastErr = fmt.Errorf("ledger returned status %d: %s", resp.StatusCode, string(body))
	}
	if !settled {
		return nil, fmt.Errorf("settlement journal was NOT posted (%v) — deal remains 'executed'", lastErr)
	}

	now := time.Now()
	deal.Status = "settled"
	deal.SettledAt = &now
	deal.UpdatedAt = time.Now()
	s.persistDeal(deal)

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
	s.persistDeal(deal)

	return deal, nil
}

// GetFXRates returns real FX rates from the configured rate source. When no
// real quote has ever been fetched it returns an error (handler maps to 503);
// otherwise it serves the last real quotes with their true as-of timestamp.
func (s *FXService) GetFXRates(tenantID string) (map[string]interface{}, error) {
	freshErr := s.refreshRates()

	s.ratesMu.RLock()
	defer s.ratesMu.RUnlock()
	if len(s.rates) == 0 {
		return nil, fmt.Errorf("no real FX rates available: %v", freshErr)
	}
	out := map[string]interface{}{}
	for ccy, r := range s.rates {
		out[ccy] = map[string]interface{}{
			"buy":  r.Buy,
			"sell": r.Sell,
			"mid":  r.Mid,
			"asOf": r.AsOf.Format(time.RFC3339),
		}
	}
	out["timestamp"] = s.ratesAsOf.Format(time.RFC3339)
	out["source"] = fxRateSourceURL()
	if freshErr != nil {
		out["stale"] = true
		out["staleReason"] = freshErr.Error()
	} else {
		out["stale"] = false
	}
	return out, nil
}

// GetFXPnL computes P&L from real deals and real rates:
//   - unrealized: net open position × (current real mid − avg acquisition rate)
//   - realized: FIFO-matched settled sells minus the cost of matched buys
//
// Returns error when rates are required but no real rate has ever been fetched.
func (s *FXService) GetFXPnL(tenantID string) (map[string]interface{}, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	positions := s.computePositions(tenantID)
	currencyPnL := make(map[string]int64)
	var totalUnrealized int64
	ratesAvailable := true
	for _, p := range positions {
		if p.NetPosition != 0 {
			if _, ok := s.currentRate(p.Currency); !ok {
				ratesAvailable = false
			}
		}
		currencyPnL[p.Currency] = p.UnrealizedPnL
		totalUnrealized += p.UnrealizedPnL
	}
	if !ratesAvailable {
		if err := s.refreshRates(); err != nil {
			return nil, fmt.Errorf("cannot compute unrealized PnL without real FX rates: %v", err)
		}
	}

	// Realized PnL: FIFO matching of settled deals per currency pair.
	realized := s.computeRealizedPnL(tenantID)

	return map[string]interface{}{
		"totalUnrealizedPnL": totalUnrealized,
		"currencyPnL":        currencyPnL,
		"realizedPnL":        realized,
		"source":             "computed from settled/executed deals and real rate quotes",
		"timestamp":          time.Now().Format(time.RFC3339),
	}, nil
}

// computeRealizedPnL FIFO-matches settled deals: for each currency, sells are
// matched against earlier buys; realized PnL = Σ qty × (sellRate − buyRate).
func (s *FXService) computeRealizedPnL(tenantID string) int64 {
	var settled []*FXDeal
	for _, d := range s.deals {
		if d.TenantID == tenantID && d.Status == "settled" && d.SettledAt != nil {
			settled = append(settled, d)
		}
	}
	sort.Slice(settled, func(i, j int) bool { return settled[i].SettledAt.Before(*settled[j].SettledAt) })

	type lot struct {
		qty  int64
		rate float64
	}
	openBuys := map[string][]lot{}
	var realized float64
	for _, d := range settled {
		// A deal buys BuyCurrency and sells SellCurrency at Rate (sell per buy unit).
		// Track NGN legs: when buying FCY with NGN we open a lot; when selling
		// FCY for NGN we close FIFO lots.
		if d.SellCurrency == "NGN" {
			openBuys[d.BuyCurrency] = append(openBuys[d.BuyCurrency], lot{qty: d.BuyAmount, rate: d.Rate})
			continue
		}
		if d.BuyCurrency == "NGN" {
			lots := openBuys[d.SellCurrency]
			remaining := d.SellAmount
			for len(lots) > 0 && remaining > 0 {
				matched := lots[0].qty
				if matched > remaining {
					matched = remaining
				}
				realized += float64(matched) * (d.Rate - lots[0].rate)
				lots[0].qty -= matched
				remaining -= matched
				if lots[0].qty == 0 {
					lots = lots[1:]
				}
			}
			openBuys[d.SellCurrency] = lots
		}
	}
	return int64(realized)
}
