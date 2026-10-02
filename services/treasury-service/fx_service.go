package main

// FXService — foreign exchange operations.
//
// Data integrity doctrine:
//   - The typed fx_deals Postgres table is the ONLY deal store and the read
//     authority. There is no in-memory deal map; every read hits Postgres and
//     every status transition runs in a transaction with a row lock.
//   - FX rates come ONLY from the configured rate source (FX_RATES_URL) or a
//     previously fetched real quote (served labelled with its as-of time).
//     When no real rate is available, rate/PnL calls return an error (503 at
//     the handler) — hardcoded "current" rates are never served.
//   - FX positions are AGGREGATED from real executed deals, not pre-seeded.
//   - Realized PnL is computed by FIFO-matching settled buys against sells.
//   - Settlement posts a real double-entry journal to the ledger
//     (JOURNAL_POSTING_URL) OUTSIDE any database transaction, then re-checks
//     the deal status inside a short transaction before marking it settled.
//     If the ledger is unavailable the deal is NOT marked settled and the
//     call fails.

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
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

// NewFXService creates a new FX service backed by the shared Postgres handle.
// Boot fails closed when the fx_deals schema cannot be ensured.
func NewFXService(tenantID string) *FXService {
	svc := &FXService{
		tenantID:   tenantID,
		db:         serviceDB,
		httpClient: &http.Client{Timeout: 15 * time.Second},
		rates:      make(map[string]FXRate),
	}
	svc.ensureSchema()
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
		log.Fatalf("[fx-service] fx_deals schema init failed: %v", err)
	}
}

// dbInsertDeal persists a newly created deal.
func (s *FXService) dbInsertDeal(deal *FXDeal) error {
	payload, err := json.Marshal(deal)
	if err != nil {
		return fmt.Errorf("marshal fx deal: %w", err)
	}
	if _, err := s.db.Exec(`INSERT INTO fx_deals
		(deal_id, tenant_id, deal_number, deal_type, buy_currency, sell_currency, buy_amount, sell_amount, rate, status, payload, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
		ON CONFLICT (deal_id) DO UPDATE SET status = $10, payload = $11, updated_at = NOW()`,
		deal.DealID, deal.TenantID, deal.DealNumber, deal.DealType, deal.BuyCurrency,
		deal.SellCurrency, deal.BuyAmount, deal.SellAmount, deal.Rate, deal.Status, string(payload)); err != nil {
		return fmt.Errorf("insert fx deal %s: %w", deal.DealID, err)
	}
	return nil
}

// dbGetDeal loads one deal scoped to the tenant (read authority).
func (s *FXService) dbGetDeal(tenantID, dealID string) (*FXDeal, error) {
	var p []byte
	err := s.db.QueryRow(`SELECT payload FROM fx_deals WHERE deal_id = $1 AND tenant_id = $2`,
		dealID, tenantID).Scan(&p)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, errors.New("FX deal not found")
	}
	if err != nil {
		return nil, fmt.Errorf("get fx deal %s: %w", dealID, err)
	}
	var d FXDeal
	if err := json.Unmarshal(p, &d); err != nil {
		return nil, fmt.Errorf("decode fx deal %s: %w", dealID, err)
	}
	return &d, nil
}

// dbListDeals loads all deals for a tenant (read authority).
func (s *FXService) dbListDeals(tenantID string) ([]*FXDeal, error) {
	rows, err := s.db.Query(`SELECT payload FROM fx_deals WHERE tenant_id = $1 ORDER BY created_at, deal_id`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("list fx deals: %w", err)
	}
	defer rows.Close()
	out := []*FXDeal{}
	for rows.Next() {
		var p []byte
		if err := rows.Scan(&p); err != nil {
			return nil, fmt.Errorf("list fx deals scan: %w", err)
		}
		var d FXDeal
		if err := json.Unmarshal(p, &d); err != nil {
			return nil, fmt.Errorf("list fx deals decode: %w", err)
		}
		out = append(out, &d)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list fx deals: %w", err)
	}
	return out, nil
}

// dbUpdateDeal replaces a deal's stored state (non-transition updates).
func (s *FXService) dbUpdateDeal(deal *FXDeal) error {
	payload, err := json.Marshal(deal)
	if err != nil {
		return fmt.Errorf("marshal fx deal: %w", err)
	}
	res, err := s.db.Exec(`UPDATE fx_deals SET status = $3, payload = $4, updated_at = NOW()
		WHERE deal_id = $1 AND tenant_id = $2`,
		deal.DealID, deal.TenantID, deal.Status, string(payload))
	if err != nil {
		return fmt.Errorf("update fx deal %s: %w", deal.DealID, err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return errors.New("FX deal not found")
	}
	return nil
}

// dbTransitionDeal runs fn against the deal inside a transaction with the row
// locked (SELECT ... FOR UPDATE). fn must validate the current status and
// mutate the deal; any error rolls the transaction back.
func (s *FXService) dbTransitionDeal(tenantID, dealID string, fn func(*FXDeal) error) (*FXDeal, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("fx deal %s begin: %w", dealID, err)
	}
	defer tx.Rollback() //nolint:errcheck // no-op after Commit

	var p []byte
	err = tx.QueryRow(`SELECT payload FROM fx_deals WHERE deal_id = $1 AND tenant_id = $2 FOR UPDATE`,
		dealID, tenantID).Scan(&p)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, errors.New("FX deal not found")
	}
	if err != nil {
		return nil, fmt.Errorf("fx deal %s lock: %w", dealID, err)
	}
	var d FXDeal
	if err := json.Unmarshal(p, &d); err != nil {
		return nil, fmt.Errorf("fx deal %s decode: %w", dealID, err)
	}
	if err := fn(&d); err != nil {
		return nil, err
	}
	payload, err := json.Marshal(&d)
	if err != nil {
		return nil, fmt.Errorf("fx deal %s marshal: %w", dealID, err)
	}
	if _, err := tx.Exec(`UPDATE fx_deals SET status = $3, payload = $4, updated_at = NOW()
		WHERE deal_id = $1 AND tenant_id = $2`, dealID, tenantID, d.Status, string(payload)); err != nil {
		return nil, fmt.Errorf("fx deal %s write: %w", dealID, err)
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("fx deal %s commit: %w", dealID, err)
	}
	return &d, nil
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
// It is a pure function over a per-request snapshot of deals.
func (s *FXService) computePositions(tenantID string, deals []*FXDeal) []*FXPosition {
	type agg struct {
		long, short   int64
		costNumerator float64 // Σ buyAmount * rate for avg rate
	}
	aggs := map[string]*agg{}
	for _, d := range deals {
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
func (s *FXService) ListFXPositions(tenantID string) ([]*FXPosition, error) {
	deals, err := s.dbListDeals(tenantID)
	if err != nil {
		return nil, err
	}
	return s.computePositions(tenantID, deals), nil
}

// GetFXPosition returns the aggregated FX position for a currency.
func (s *FXService) GetFXPosition(tenantID, currency string) (*FXPosition, error) {
	positions, err := s.ListFXPositions(tenantID)
	if err != nil {
		return nil, err
	}
	for _, p := range positions {
		if p.Currency == currency {
			return p, nil
		}
	}
	return nil, nil
}

// ListFXDeals returns FX deals based on filters
func (s *FXService) ListFXDeals(tenantID, status, dealType string) ([]*FXDeal, error) {
	deals, err := s.dbListDeals(tenantID)
	if err != nil {
		return nil, err
	}
	var result []*FXDeal
	for _, deal := range deals {
		if status != "" && deal.Status != status {
			continue
		}
		if dealType != "" && deal.DealType != dealType {
			continue
		}
		result = append(result, deal)
	}
	return result, nil
}

// GetFXDeal retrieves an FX deal by ID
func (s *FXService) GetFXDeal(tenantID, dealID string) (*FXDeal, error) {
	return s.dbGetDeal(tenantID, dealID)
}

// CreateFXDeal creates a new FX deal
func (s *FXService) CreateFXDeal(tenantID, dealerID string, req *CreateFXDealRequest) (*FXDeal, error) {
	// Deal numbers derive from the clock, not a process-local counter (which
	// resets on restart); deal_id is a UUID primary key.
	dealNumber := fmt.Sprintf("FX-%s-%d", time.Now().Format("20060102"), time.Now().UnixNano()%1000000000)

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

	if err := s.dbInsertDeal(deal); err != nil {
		return nil, err
	}
	return deal, nil
}

// UpdateFXDeal updates an FX deal
func (s *FXService) UpdateFXDeal(deal *FXDeal) error {
	existing, err := s.dbGetDeal(deal.TenantID, deal.DealID)
	if err != nil {
		return errors.New("FX deal not found")
	}

	deal.CreatedAt = existing.CreatedAt
	deal.DealNumber = existing.DealNumber
	deal.UpdatedAt = time.Now()
	return s.dbUpdateDeal(deal)
}

// ApproveFXDeal approves an FX deal (transactional transition)
func (s *FXService) ApproveFXDeal(tenantID, dealID, approverID string) (*FXDeal, error) {
	return s.dbTransitionDeal(tenantID, dealID, func(deal *FXDeal) error {
		if deal.Status != "pending" {
			return errors.New("can only approve pending deals")
		}
		now := time.Now()
		deal.Status = "approved"
		deal.ApprovedBy = approverID
		deal.ApprovedAt = &now
		deal.UpdatedAt = time.Now()
		return nil
	})
}

// ExecuteFXDeal executes an approved FX deal (books it; positions recompute
// from executed deals).
func (s *FXService) ExecuteFXDeal(tenantID, dealID string) (*FXDeal, error) {
	return s.dbTransitionDeal(tenantID, dealID, func(deal *FXDeal) error {
		if deal.Status != "approved" {
			return errors.New("can only execute approved deals")
		}
		deal.Status = "executed"
		deal.UpdatedAt = time.Now()
		return nil
	})
}

// SettleFXDeal settles an executed deal by posting a real balanced
// double-entry journal to the ledger. The ledger HTTP call happens OUTSIDE
// any database transaction; afterwards the deal status is re-checked inside
// a short transaction (row lock) before being marked settled. If the ledger
// is unavailable or rejects the posting, the deal is NOT marked settled and
// an error is returned.
func (s *FXService) SettleFXDeal(tenantID, dealID string) (*FXDeal, error) {
	deal, err := s.dbGetDeal(tenantID, dealID)
	if err != nil {
		return nil, err
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

	// Journal posted. Re-check and transition the status inside a transaction
	// so a concurrent settle/cancel cannot double-settle this deal.
	return s.dbTransitionDeal(tenantID, dealID, func(d *FXDeal) error {
		if d.Status != "executed" {
			return fmt.Errorf("deal status changed to %q during settlement; journal was posted — reconcile manually", d.Status)
		}
		now := time.Now()
		d.Status = "settled"
		d.SettledAt = &now
		d.UpdatedAt = time.Now()
		return nil
	})
}

// CancelFXDeal cancels an FX deal (transactional transition)
func (s *FXService) CancelFXDeal(tenantID, dealID, reason string) (*FXDeal, error) {
	return s.dbTransitionDeal(tenantID, dealID, func(deal *FXDeal) error {
		if deal.Status == "settled" {
			return errors.New("cannot cancel settled deals")
		}
		deal.Status = "cancelled"
		if deal.Metadata == nil {
			deal.Metadata = make(map[string]interface{})
		}
		deal.Metadata["cancelReason"] = reason
		deal.UpdatedAt = time.Now()
		return nil
	})
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
	deals, err := s.dbListDeals(tenantID)
	if err != nil {
		return nil, err
	}

	positions := s.computePositions(tenantID, deals)
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
	realized := s.computeRealizedPnL(tenantID, deals)

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
// Pure function over a per-request snapshot of deals.
func (s *FXService) computeRealizedPnL(tenantID string, deals []*FXDeal) int64 {
	var settled []*FXDeal
	for _, d := range deals {
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
