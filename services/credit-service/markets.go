package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
)

// ==================== MULTICURRENCY REVALUATION ====================

func (s *CreditServer) initMulticurrencyTable(r *http.Request) {
	s.db.ExecContext(r.Context(), `CREATE TABLE IF NOT EXISTS multicurrency_revaluations (
		id VARCHAR(64) PRIMARY KEY,
		tenant_id VARCHAR(64),
		currency VARCHAR(8),
		base_currency VARCHAR(8) DEFAULT 'NGN',
		book_rate NUMERIC(18,6),
		market_rate NUMERIC(18,6),
		book_value NUMERIC(18,2),
		market_value NUMERIC(18,2),
		unrealized_pnl NUMERIC(18,2),
		position_type VARCHAR(32),
		account_id VARCHAR(64),
		status VARCHAR(32) DEFAULT 'pending',
		revaluation_date DATE DEFAULT CURRENT_DATE,
		created_at TIMESTAMPTZ DEFAULT NOW()
	)`)
}

func (s *CreditServer) multicurrencyRevaluationHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	s.initMulticurrencyTable(r)
	rows, err := s.db.QueryContext(r.Context(), `
		SELECT id, currency, base_currency, COALESCE(book_rate,0), COALESCE(market_rate,0),
		       COALESCE(book_value,0), COALESCE(market_value,0), COALESCE(unrealized_pnl,0),
		       COALESCE(position_type,'asset'), COALESCE(account_id,''),
		       status, TO_CHAR(revaluation_date,'YYYY-MM-DD')
		FROM multicurrency_revaluations WHERE tenant_id=$1 ORDER BY created_at DESC`, tid)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	type entry struct {
		ID              string  `json:"id"`
		Currency        string  `json:"currency"`
		BaseCurrency    string  `json:"base_currency"`
		BookRate        float64 `json:"book_rate"`
		MarketRate      float64 `json:"market_rate"`
		BookValue       float64 `json:"book_value"`
		MarketValue     float64 `json:"market_value"`
		UnrealizedPnL   float64 `json:"unrealized_pnl"`
		PositionType    string  `json:"position_type"`
		AccountID       string  `json:"account_id"`
		Status          string  `json:"status"`
		RevaluationDate string  `json:"revaluation_date"`
	}
	items := make([]entry, 0)
	for rows.Next() {
		var e entry
		rows.Scan(&e.ID, &e.Currency, &e.BaseCurrency, &e.BookRate, &e.MarketRate,
			&e.BookValue, &e.MarketValue, &e.UnrealizedPnL, &e.PositionType,
			&e.AccountID, &e.Status, &e.RevaluationDate)
		items = append(items, e)
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"entries": items, "total": len(items)})
}

func (s *CreditServer) multicurrencyRunHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	s.initMulticurrencyTable(r)
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondError(w, http.StatusBadRequest, "invalid body")
		return
	}
	currency, _ := body["currency"].(string)
	bookRate, _ := body["book_rate"].(float64)
	marketRate, _ := body["market_rate"].(float64)
	bookValue, _ := body["book_value"].(float64)
	marketValue := bookValue * (marketRate / bookRate)
	unrealizedPnL := marketValue - bookValue
	id := uuid.New().String()
	_, err := s.db.ExecContext(r.Context(), `
		INSERT INTO multicurrency_revaluations (id, tenant_id, currency, book_rate, market_rate,
			book_value, market_value, unrealized_pnl, status)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'completed')`,
		id, tid, currency, bookRate, marketRate, bookValue, marketValue, unrealizedPnL)
	if err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("revaluation failed: %v", err))
		return
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"id":             id,
		"currency":       currency,
		"book_rate":      bookRate,
		"market_rate":    marketRate,
		"book_value":     bookValue,
		"market_value":   marketValue,
		"unrealized_pnl": unrealizedPnL,
		"status":         "completed",
		"run_at":         time.Now().Format(time.RFC3339),
	})
}

// ==================== OTC DERIVATIVES ====================

func (s *CreditServer) initOTCTable(r *http.Request) {
	s.db.ExecContext(r.Context(), `CREATE TABLE IF NOT EXISTS otc_derivatives (
		id VARCHAR(64) PRIMARY KEY,
		tenant_id VARCHAR(64),
		instrument_type VARCHAR(64),
		counterparty VARCHAR(255),
		notional NUMERIC(18,2),
		currency VARCHAR(8) DEFAULT 'NGN',
		strike_rate NUMERIC(10,6),
		market_rate NUMERIC(10,6),
		mtm_value NUMERIC(18,2),
		maturity_date DATE,
		status VARCHAR(32) DEFAULT 'active',
		created_at TIMESTAMPTZ DEFAULT NOW()
	)`)
}

func (s *CreditServer) otcDerivativesHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	s.initOTCTable(r)
	rows, err := s.db.QueryContext(r.Context(), `
		SELECT id, COALESCE(instrument_type,'swap'), COALESCE(counterparty,''), COALESCE(notional,0),
		       COALESCE(currency,'NGN'), COALESCE(strike_rate,0), COALESCE(market_rate,0),
		       COALESCE(mtm_value,0), TO_CHAR(maturity_date,'YYYY-MM-DD'), status
		FROM otc_derivatives WHERE tenant_id=$1 ORDER BY created_at DESC`, tid)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	type derivative struct {
		ID             string  `json:"id"`
		InstrumentType string  `json:"instrument_type"`
		Counterparty   string  `json:"counterparty"`
		Notional       float64 `json:"notional"`
		Currency       string  `json:"currency"`
		StrikeRate     float64 `json:"strike_rate"`
		MarketRate     float64 `json:"market_rate"`
		MTMValue       float64 `json:"mtm_value"`
		MaturityDate   string  `json:"maturity_date"`
		Status         string  `json:"status"`
	}
	items := make([]derivative, 0)
	for rows.Next() {
		var d derivative
		rows.Scan(&d.ID, &d.InstrumentType, &d.Counterparty, &d.Notional, &d.Currency,
			&d.StrikeRate, &d.MarketRate, &d.MTMValue, &d.MaturityDate, &d.Status)
		items = append(items, d)
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"derivatives": items, "total": len(items)})
}

func (s *CreditServer) otcStatsHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	s.initOTCTable(r)
	var total int
	var totalNotional, totalMTM float64
	s.db.QueryRowContext(r.Context(), `
		SELECT COUNT(*), COALESCE(SUM(notional),0), COALESCE(SUM(mtm_value),0)
		FROM otc_derivatives WHERE tenant_id=$1 AND status='active'`, tid).
		Scan(&total, &totalNotional, &totalMTM)
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"totalContracts": total,
		"totalNotional":  totalNotional,
		"totalMTM":       totalMTM,
		"currency":       "NGN",
	})
}

func (s *CreditServer) otcCreateHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	s.initOTCTable(r)
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondError(w, http.StatusBadRequest, "invalid body")
		return
	}
	id := uuid.New().String()
	instrumentType, _ := body["instrument_type"].(string)
	counterparty, _ := body["counterparty"].(string)
	notional, _ := body["notional"].(float64)
	currency, _ := body["currency"].(string)
	if currency == "" {
		currency = "NGN"
	}
	strikeRate, _ := body["strike_rate"].(float64)
	_, err := s.db.ExecContext(r.Context(), `
		INSERT INTO otc_derivatives (id, tenant_id, instrument_type, counterparty, notional, currency, strike_rate, status)
		VALUES ($1,$2,$3,$4,$5,$6,$7,'active')`,
		id, tid, instrumentType, counterparty, notional, currency, strikeRate)
	if err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("create failed: %v", err))
		return
	}
	body["id"] = id
	body["status"] = "active"
	respondJSON(w, http.StatusCreated, body)
}

// ==================== ETD TRADING ====================

func (s *CreditServer) initETDTable(r *http.Request) {
	s.db.ExecContext(r.Context(), `CREATE TABLE IF NOT EXISTS etd_trades (
		id VARCHAR(64) PRIMARY KEY,
		tenant_id VARCHAR(64),
		instrument VARCHAR(128),
		exchange VARCHAR(64),
		trade_type VARCHAR(16),
		quantity NUMERIC(18,4),
		price NUMERIC(18,6),
		total_value NUMERIC(18,2),
		currency VARCHAR(8) DEFAULT 'NGN',
		settlement_date DATE,
		status VARCHAR(32) DEFAULT 'open',
		created_at TIMESTAMPTZ DEFAULT NOW()
	)`)
}

func (s *CreditServer) etdTradesHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	s.initETDTable(r)
	rows, err := s.db.QueryContext(r.Context(), `
		SELECT id, COALESCE(instrument,''), COALESCE(exchange,''), COALESCE(trade_type,'buy'),
		       COALESCE(quantity,0), COALESCE(price,0), COALESCE(total_value,0),
		       COALESCE(currency,'NGN'), TO_CHAR(settlement_date,'YYYY-MM-DD'), status
		FROM etd_trades WHERE tenant_id=$1 ORDER BY created_at DESC`, tid)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	type trade struct {
		ID             string  `json:"id"`
		Instrument     string  `json:"instrument"`
		Exchange       string  `json:"exchange"`
		TradeType      string  `json:"trade_type"`
		Quantity       float64 `json:"quantity"`
		Price          float64 `json:"price"`
		TotalValue     float64 `json:"total_value"`
		Currency       string  `json:"currency"`
		SettlementDate string  `json:"settlement_date"`
		Status         string  `json:"status"`
	}
	items := make([]trade, 0)
	for rows.Next() {
		var t trade
		rows.Scan(&t.ID, &t.Instrument, &t.Exchange, &t.TradeType, &t.Quantity,
			&t.Price, &t.TotalValue, &t.Currency, &t.SettlementDate, &t.Status)
		items = append(items, t)
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"trades": items, "total": len(items)})
}

func (s *CreditServer) etdStatsHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	s.initETDTable(r)
	var total int
	var totalValue float64
	s.db.QueryRowContext(r.Context(), `
		SELECT COUNT(*), COALESCE(SUM(total_value),0)
		FROM etd_trades WHERE tenant_id=$1 AND status='open'`, tid).
		Scan(&total, &totalValue)
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"openTrades": total,
		"totalValue": totalValue,
		"currency":   "NGN",
	})
}

// ==================== BANKING CLEARING OPS ====================

func (s *CreditServer) initClearingTable(r *http.Request) {
	s.db.ExecContext(r.Context(), `CREATE TABLE IF NOT EXISTS clearing_instructions (
		id VARCHAR(64) PRIMARY KEY,
		tenant_id VARCHAR(64),
		instruction_type VARCHAR(64),
		reference VARCHAR(128),
		amount NUMERIC(18,2),
		currency VARCHAR(8) DEFAULT 'NGN',
		debtor_account VARCHAR(64),
		creditor_account VARCHAR(64),
		clearing_house VARCHAR(64),
		settlement_date DATE,
		status VARCHAR(32) DEFAULT 'pending',
		created_at TIMESTAMPTZ DEFAULT NOW()
	)`)
}

func (s *CreditServer) clearingInstructionsHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	s.initClearingTable(r)
	rows, err := s.db.QueryContext(r.Context(), `
		SELECT id, COALESCE(instruction_type,'neft'), COALESCE(reference,''), COALESCE(amount,0),
		       COALESCE(currency,'NGN'), COALESCE(debtor_account,''), COALESCE(creditor_account,''),
		       COALESCE(clearing_house,'NIBSS'), TO_CHAR(settlement_date,'YYYY-MM-DD'), status
		FROM clearing_instructions WHERE tenant_id=$1 ORDER BY created_at DESC`, tid)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()
	type instruction struct {
		ID              string  `json:"id"`
		Type            string  `json:"type"`
		Reference       string  `json:"reference"`
		Amount          float64 `json:"amount"`
		Currency        string  `json:"currency"`
		DebtorAccount   string  `json:"debtor_account"`
		CreditorAccount string  `json:"creditor_account"`
		ClearingHouse   string  `json:"clearing_house"`
		SettlementDate  string  `json:"settlement_date"`
		Status          string  `json:"status"`
	}
	items := make([]instruction, 0)
	for rows.Next() {
		var ins instruction
		rows.Scan(&ins.ID, &ins.Type, &ins.Reference, &ins.Amount, &ins.Currency,
			&ins.DebtorAccount, &ins.CreditorAccount, &ins.ClearingHouse,
			&ins.SettlementDate, &ins.Status)
		items = append(items, ins)
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"instructions": items, "total": len(items)})
}

func (s *CreditServer) clearingStatsHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	s.initClearingTable(r)
	var pending, settled int
	var totalValue float64
	s.db.QueryRowContext(r.Context(), `
		SELECT COUNT(*) FILTER (WHERE status='pending'),
		       COUNT(*) FILTER (WHERE status='settled'),
		       COALESCE(SUM(amount),0)
		FROM clearing_instructions WHERE tenant_id=$1`, tid).
		Scan(&pending, &settled, &totalValue)
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"pending":    pending,
		"settled":    settled,
		"totalValue": totalValue,
		"currency":   "NGN",
	})
}

func (s *CreditServer) clearingCreateHandler(w http.ResponseWriter, r *http.Request) {
	tid := tenantID(r)
	s.initClearingTable(r)
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondError(w, http.StatusBadRequest, "invalid body")
		return
	}
	id := uuid.New().String()
	instrType, _ := body["type"].(string)
	ref, _ := body["reference"].(string)
	amount, _ := body["amount"].(float64)
	currency, _ := body["currency"].(string)
	if currency == "" {
		currency = "NGN"
	}
	debtor, _ := body["debtor_account"].(string)
	creditor, _ := body["creditor_account"].(string)
	clearingHouse, _ := body["clearing_house"].(string)
	if clearingHouse == "" {
		clearingHouse = "NIBSS"
	}
	_, err := s.db.ExecContext(r.Context(), `
		INSERT INTO clearing_instructions (id, tenant_id, instruction_type, reference, amount, currency,
			debtor_account, creditor_account, clearing_house, status)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')`,
		id, tid, instrType, ref, amount, currency, debtor, creditor, clearingHouse)
	if err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("create failed: %v", err))
		return
	}
	body["id"] = id
	body["status"] = "pending"
	respondJSON(w, http.StatusCreated, body)
}
