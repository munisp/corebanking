// 54Bank GL Engine Service — Go
// Core General Ledger operations: CoA management, journal posting,
// trial balance aggregation, eFASS report data generation.
//
// Data integrity doctrine: GL balances, regulatory (eFASS/CBN) figures and
// period-close results are served ONLY from Postgres. When the ledger store
// is unavailable or has no data, handlers fail fast (503) — no sample or
// in-memory figures are ever served on request paths.
package main

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/IBM/sarama"
	_ "github.com/lib/pq"
)

// ─── MIDDLEWARE STATUS (honest: only probed systems report connected) ──────

type ConnStatus struct {
	Status   string `json:"status"` // connected | unavailable | not_configured
	Endpoint string `json:"endpoint,omitempty"`
	Detail   string `json:"detail,omitempty"`
}

// ─── DATA MODELS ────────────────────────────────────────────────────────────

type GLAccount struct {
	GLAccountCode    string  `json:"glAccountCode"`
	TenantID         string  `json:"tenantId"`
	Name             string  `json:"name"`
	Category         string  `json:"category"`
	Subcategory      string  `json:"subcategory"`
	ParentCode       *string `json:"parentCode"`
	Currency         string  `json:"currency"`
	BalanceKobo      int64   `json:"balance_kobo"` // kobo integer — never float
	Status           string  `json:"status"`
	IsControlAccount int     `json:"isControlAccount"`
}

type JournalEntry struct {
	EntryID        string    `json:"entryId"`
	TenantID       string    `json:"tenantId"`
	AccountID      string    `json:"accountId"`
	GLAccountCode  string    `json:"glAccountCode"`
	Type           string    `json:"type"`
	AmountKobo     int64     `json:"amount_kobo"` // kobo integer — never float
	Currency       string    `json:"currency"`
	Narration      string    `json:"narration"`
	TransactionRef string    `json:"transactionRef"`
	BatchID        *string   `json:"batchId"`
	PostingDate    time.Time `json:"postingDate"`
	ValueDate      time.Time `json:"valueDate"`
}

type TrialBalance struct {
	TrialBalanceID     string    `json:"trialBalanceId"`
	TenantID           string    `json:"tenantId"`
	GLAccountCode      string    `json:"glAccountCode"`
	PeriodStart        time.Time `json:"periodStart"`
	PeriodEnd          time.Time `json:"periodEnd"`
	OpeningBalanceKobo int64     `json:"opening_balance_kobo"`
	TotalDebitsKobo    int64     `json:"total_debits_kobo"`
	TotalCreditsKobo   int64     `json:"total_credits_kobo"`
	ClosingBalanceKobo int64     `json:"closing_balance_kobo"`
	Currency           string    `json:"currency"`
	Status             string    `json:"status"`
}

type EFASSLine struct {
	MBRForm        string `json:"mbrForm"`
	MBRLine        int    `json:"mbrLine"`
	LineName       string `json:"lineName"`
	ReportCategory string `json:"reportCategory"`
	AmountKobo     int64  `json:"amount_kobo"` // kobo integer — never float
	CBNCode        string `json:"cbnCode"`
}

type EFASSReport struct {
	ReportID    string       `json:"reportId"`
	Period      string       `json:"period"`
	TenantID    string       `json:"tenantId"`
	GeneratedAt time.Time    `json:"generatedAt"`
	Status      string       `json:"status"`
	Forms       []EFASSLine  `json:"forms"`
	Totals      ReportTotals `json:"totals"`
}

type ReportTotals struct {
	TotalAssetsKobo      int64   `json:"total_assets_kobo"`
	TotalLiabilitiesKobo int64   `json:"total_liabilities_kobo"`
	TotalEquityKobo      int64   `json:"total_equity_kobo"`
	TotalIncomeKobo      int64   `json:"total_income_kobo"`
	TotalExpensesKobo    int64   `json:"total_expenses_kobo"`
	NetProfitKobo        int64   `json:"net_profit_kobo"`
	CAR                  float64 `json:"car"`            // ratio (%) — not money, stays float
	LiquidityRatio       float64 `json:"liquidityRatio"` // ratio (%) — not money, stays float
}

type PostJournalRequest struct {
	TenantID       string `json:"tenantId"`
	AccountID      string `json:"accountId"`
	GLAccountCode  string `json:"glAccountCode"`
	Type           string `json:"type"`
	AmountKobo     int64  `json:"amount_kobo"` // kobo integer — never float
	Currency       string `json:"currency"`
	Narration      string `json:"narration"`
	TransactionRef string `json:"transactionRef"`
	BatchID        string `json:"batchId,omitempty"`
}

type PeriodCloseRequest struct {
	TenantID    string `json:"tenantId"`
	PeriodStart string `json:"periodStart"`
	PeriodEnd   string `json:"periodEnd"`
}

// ─── APP STATE ──────────────────────────────────────────────────────────────

type App struct {
	db    *sql.DB
	dbURL string
}

func NewApp() *App {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://localhost:5432/ndsep_db?sslmode=disable"
	}

	app := &App{dbURL: dbURL}

	db, err := sql.Open("postgres", dbURL)
	if err == nil {
		db.SetMaxOpenConns(20)
		db.SetMaxIdleConns(5)
		db.SetConnMaxLifetime(5 * time.Minute)
		if err := db.Ping(); err == nil {
			app.db = db
			log.Printf("[gl-engine-go] postgres connected")
		} else {
			log.Printf("[gl-engine-go] postgres unavailable: %v — GL endpoints will fail closed (503)", err)
		}
	} else {
		log.Printf("[gl-engine-go] postgres open failed: %v — GL endpoints will fail closed (503)", err)
	}

	return app
}

func (app *App) postgresStatus() ConnStatus {
	if app.db == nil {
		return ConnStatus{Status: "unavailable", Endpoint: app.dbURL}
	}
	if err := app.db.Ping(); err != nil {
		return ConnStatus{Status: "unavailable", Endpoint: app.dbURL, Detail: err.Error()}
	}
	return ConnStatus{Status: "connected", Endpoint: app.dbURL}
}

// ─── HANDLERS ───────────────────────────────────────────────────────────────

func (app *App) health(w http.ResponseWriter, r *http.Request) {
	pg := app.postgresStatus()
	writeJSON(w, 200, map[string]interface{}{
		"status":   "healthy",
		"service":  "gl-engine-go",
		"version":  "2.0.1",
		"database": pg,
		"middleware": map[string]ConnStatus{
			"postgres": pg,
			// Not probed by this service — reported honestly instead of a
			// hardcoded "connected".
			"kafka":       kafkaStatus(),
			"tigerbeetle": {Status: tigerBeetleStatus()},
		},
		"capabilities": []string{
			"chart_of_accounts",
			"journal_posting",
			"trial_balance_aggregation",
			"efass_report_generation",
			"period_close",
			"cbn_returns_computation",
		},
	})
}

func kafkaStatus() ConnStatus {
	brokers := os.Getenv("KAFKA_BROKERS")
	if brokers == "" {
		return ConnStatus{Status: "not_configured"}
	}
	kafkaProducerMu.Lock()
	defer kafkaProducerMu.Unlock()
	if kafkaProducer != nil {
		return ConnStatus{Status: "connected", Endpoint: brokers}
	}
	return ConnStatus{Status: "not_configured", Endpoint: brokers, Detail: "producer not yet established"}
}

func tigerBeetleStatus() string {
	if os.Getenv("TB_ADDRESS") != "" || os.Getenv("TIGERBEETLE_ADDRESSES") != "" {
		return "configured"
	}
	return "not_configured"
}

func (app *App) listGLAccounts(w http.ResponseWriter, r *http.Request) {
	category := r.URL.Query().Get("category")
	tenantID := r.URL.Query().Get("tenantId")
	if tenantID == "" {
		tenantID = "tenant-lagos-main"
	}

	if app.db == nil {
		writeJSON(w, 503, map[string]string{"error": "gl_store_unavailable", "detail": "postgres not connected; refusing to serve GL accounts from any other source"})
		return
	}

	query := `SELECT "glAccountCode", "tenantId", "name", "category", "subcategory",
		"parentCode", "currency", "balance_kobo", "status", "isControlAccount"
		FROM "glAccounts" WHERE "tenantId" = $1`
	args := []interface{}{tenantID}
	if category != "" {
		query += ` AND "category" = $2`
		args = append(args, category)
	}
	query += ` ORDER BY "glAccountCode"`

	rows, err := app.db.Query(query, args...)
	if err != nil {
		writeJSON(w, 503, map[string]string{"error": "gl_store_query_failed", "detail": err.Error()})
		return
	}
	defer rows.Close()
	var accounts []GLAccount
	for rows.Next() {
		var a GLAccount
		if err := rows.Scan(&a.GLAccountCode, &a.TenantID, &a.Name, &a.Category,
			&a.Subcategory, &a.ParentCode, &a.Currency, &a.BalanceKobo, &a.Status, &a.IsControlAccount); err == nil {
			accounts = append(accounts, a)
		}
	}
	writeJSON(w, 200, map[string]interface{}{
		"items": accounts, "total": len(accounts), "source": "postgres",
	})
}

func (app *App) postJournal(w http.ResponseWriter, r *http.Request) {
	var req PostJournalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request body"})
		return
	}

	if req.AmountKobo <= 0 {
		writeJSON(w, 400, map[string]string{"error": "amount_kobo must be positive"})
		return
	}
	if req.Type != "debit" && req.Type != "credit" {
		writeJSON(w, 400, map[string]string{"error": "type must be debit or credit"})
		return
	}
	if app.db == nil {
		writeJSON(w, 503, map[string]string{"error": "gl_store_unavailable", "detail": "journal NOT posted — postgres not connected"})
		return
	}

	entryID := fmt.Sprintf("JE-%s-%d", req.GLAccountCode, time.Now().UnixNano())
	now := time.Now()

	entry := JournalEntry{
		EntryID:        entryID,
		TenantID:       req.TenantID,
		AccountID:      req.AccountID,
		GLAccountCode:  req.GLAccountCode,
		Type:           req.Type,
		AmountKobo:     req.AmountKobo,
		Currency:       req.Currency,
		Narration:      req.Narration,
		TransactionRef: req.TransactionRef,
		PostingDate:    now,
		ValueDate:      now,
	}

	// Journal insert + balance update + outbox row in ONE transaction: either
	// the posting fully happens or nothing is recorded.
	tx, err := app.db.BeginTx(r.Context(), nil)
	if err != nil {
		writeJSON(w, 503, map[string]string{"error": "gl_store_unavailable", "detail": err.Error()})
		return
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`INSERT INTO "journalEntries"
		("entryId", "tenantId", "accountId", "glAccountCode", "type", "amount_kobo", "currency", "narration", "transactionRef", "postingDate", "valueDate")
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		entry.EntryID, entry.TenantID, entry.AccountID, entry.GLAccountCode,
		entry.Type, entry.AmountKobo, entry.Currency, entry.Narration,
		entry.TransactionRef, entry.PostingDate, entry.ValueDate); err != nil {
		writeJSON(w, 500, map[string]string{"error": "journal_insert_failed", "detail": err.Error()})
		return
	}

	var balanceOp string
	if entry.Type == "debit" {
		balanceOp = `UPDATE "glAccounts" SET "balance_kobo" = "balance_kobo" + $1, "updatedAt" = NOW() WHERE "glAccountCode" = $2`
	} else {
		balanceOp = `UPDATE "glAccounts" SET "balance_kobo" = "balance_kobo" - $1, "updatedAt" = NOW() WHERE "glAccountCode" = $2`
	}
	if _, err := tx.Exec(balanceOp, entry.AmountKobo, entry.GLAccountCode); err != nil {
		writeJSON(w, 500, map[string]string{"error": "balance_update_failed", "detail": err.Error()})
		return
	}

	outboxEvent := map[string]interface{}{
		"event":       "journal.posted",
		"entry_id":    entryID,
		"gl_code":     req.GLAccountCode,
		"type":        req.Type,
		"amount_kobo": req.AmountKobo,
		"currency":    req.Currency,
		"tenant_id":   req.TenantID,
		"account_id":  req.AccountID,
		"timestamp":   now.Format(time.RFC3339),
	}
	outboxID := fmt.Sprintf("OBX-%s", entryID)
	outboxPayload, _ := json.Marshal(outboxEvent)
	if _, err := tx.Exec(`INSERT INTO outbox (id, topic, key, payload, idempotency_key, created_at, status)
		VALUES ($1, $2, $3, $4, $5, $6, 'pending')
		ON CONFLICT (idempotency_key) DO NOTHING`,
		outboxID, "gl.journal.posted", entryID, outboxPayload, req.TransactionRef, now); err != nil {
		writeJSON(w, 500, map[string]string{"error": "outbox_insert_failed", "detail": err.Error()})
		return
	}

	if err := tx.Commit(); err != nil {
		writeJSON(w, 500, map[string]string{"error": "commit_failed", "detail": err.Error()})
		return
	}

	// Honest response: only what actually happened. The outbox relay publishes
	// to Kafka asynchronously and flips status to 'published' on success.
	writeJSON(w, 201, map[string]interface{}{
		"entry":  entry,
		"outbox": map[string]string{"id": outboxID, "status": "pending", "topic": "gl.journal.posted"},
		"persisted": map[string]string{
			"journalEntries": "inserted",
			"glAccounts":     "balance_updated",
		},
	})
}

func (app *App) periodClose(w http.ResponseWriter, r *http.Request) {
	var req PeriodCloseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request body"})
		return
	}

	if app.db == nil {
		writeJSON(w, 503, map[string]string{"error": "gl_store_unavailable", "detail": "period NOT closed — postgres not connected"})
		return
	}

	// Aggregate journal entries into trial balance for the period
	query := `
		INSERT INTO "trialBalances" ("trialBalanceId", "tenantId", "glAccountCode", "periodStart", "periodEnd",
			"opening_balance_kobo", "total_debits_kobo", "total_credits_kobo", "closing_balance_kobo", "currency", "status")
		SELECT
			'TB-' || TO_CHAR($2::timestamp, 'YYYY-MM') || '-' || je."glAccountCode",
			$1,
			je."glAccountCode",
			$2::timestamp,
			$3::timestamp,
			COALESCE(gl."balance_kobo", 0) - COALESCE(SUM(CASE WHEN je."type" = 'debit' THEN je."amount_kobo" ELSE -je."amount_kobo" END), 0),
			COALESCE(SUM(CASE WHEN je."type" = 'debit' THEN je."amount_kobo" ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN je."type" = 'credit' THEN je."amount_kobo" ELSE 0 END), 0),
			COALESCE(gl."balance_kobo", 0),
			COALESCE(gl."currency", 'NGN'),
			'closed'
		FROM "journalEntries" je
		LEFT JOIN "glAccounts" gl ON gl."glAccountCode" = je."glAccountCode"
		WHERE je."tenantId" = $1
			AND je."postingDate" >= $2::timestamp
			AND je."postingDate" <= $3::timestamp
		GROUP BY je."glAccountCode", gl."balance_kobo", gl."currency"
		ON CONFLICT ("trialBalanceId") DO UPDATE SET
			"total_debits_kobo" = EXCLUDED."total_debits_kobo",
			"total_credits_kobo" = EXCLUDED."total_credits_kobo",
			"closing_balance_kobo" = EXCLUDED."closing_balance_kobo",
			"status" = 'closed'`

	result, err := app.db.Exec(query, req.TenantID, req.PeriodStart, req.PeriodEnd)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "period_close_failed", "detail": err.Error()})
		return
	}
	affected, _ := result.RowsAffected()

	// Queue a real outbox event; the relay publishes it to Kafka.
	outboxPayload, _ := json.Marshal(map[string]interface{}{
		"event": "gl.trial_balance.closed", "tenantId": req.TenantID,
		"periodStart": req.PeriodStart, "periodEnd": req.PeriodEnd,
		"accountsClosed": affected, "timestamp": time.Now().UTC().Format(time.RFC3339),
	})
	outboxID := fmt.Sprintf("OBX-PC-%s-%d", req.TenantID, time.Now().UnixNano())
	if _, err := app.db.Exec(`INSERT INTO outbox (id, topic, key, payload, idempotency_key, created_at, status)
		VALUES ($1, $2, $3, $4, $5, $6, 'pending') ON CONFLICT (id) DO NOTHING`,
		outboxID, "gl.trial_balance.closed", req.TenantID, outboxPayload, outboxID, time.Now()); err != nil {
		log.Printf("[gl-engine-go] period-close outbox insert failed: %v", err)
	}

	writeJSON(w, 200, map[string]interface{}{
		"status":         "period_closed",
		"tenantId":       req.TenantID,
		"period":         req.PeriodStart + " to " + req.PeriodEnd,
		"accountsClosed": affected,
		"outbox":         map[string]string{"id": outboxID, "status": "pending", "topic": "gl.trial_balance.closed"},
	})
}

func (app *App) generateEFASS(w http.ResponseWriter, r *http.Request) {
	period := r.URL.Query().Get("period")
	if period == "" {
		writeJSON(w, 400, map[string]string{"error": "period query parameter is required (YYYY-MM)"})
		return
	}
	tenantID := r.URL.Query().Get("tenantId")
	if tenantID == "" {
		tenantID = "tenant-lagos-main"
	}

	if app.db == nil {
		writeJSON(w, 503, map[string]string{"error": "gl_store_unavailable", "detail": "eFASS report NOT generated — postgres not connected"})
		return
	}

	// Pull from trial balance using eFASS mapping — regulatory figures come
	// ONLY from real closed trial balances.
	query := `
		SELECT m."mbrForm", m."mbrLine", m."lineName", m."reportCategory", m."cbnCode",
			COALESCE(SUM(
				CASE WHEN m."signConvention" = 'negate' THEN -tb."closing_balance_kobo"
				ELSE tb."closing_balance_kobo" END
			), 0) as amount
		FROM "efassMapping" m
		LEFT JOIN "trialBalances" tb ON tb."glAccountCode" >= m."glCodeStart"
			AND tb."glAccountCode" <= m."glCodeEnd"
			AND tb."tenantId" = $1
			AND TO_CHAR(tb."periodEnd", 'YYYY-MM') = $2
		GROUP BY m."mbrForm", m."mbrLine", m."lineName", m."reportCategory", m."cbnCode"
		ORDER BY m."mbrForm", m."mbrLine"`

	rows, err := app.db.Query(query, tenantID, period)
	if err != nil {
		writeJSON(w, 503, map[string]string{"error": "efass_source_query_failed", "detail": err.Error()})
		return
	}
	defer rows.Close()
	var lines []EFASSLine
	for rows.Next() {
		var l EFASSLine
		if err := rows.Scan(&l.MBRForm, &l.MBRLine, &l.LineName, &l.ReportCategory, &l.CBNCode, &l.AmountKobo); err == nil {
			lines = append(lines, l)
		}
	}

	if len(lines) == 0 {
		writeJSON(w, 503, map[string]string{
			"error":  "insufficient_data",
			"detail": "no eFASS mapping rows or no closed trial balance for period " + period + " — refusing to fabricate a regulatory return",
		})
		return
	}

	// Compute totals (all in kobo — exact integer arithmetic)
	var totals ReportTotals
	for _, l := range lines {
		switch l.ReportCategory {
		case "assets":
			totals.TotalAssetsKobo += l.AmountKobo
		case "liabilities":
			totals.TotalLiabilitiesKobo += l.AmountKobo
		case "equity":
			totals.TotalEquityKobo += l.AmountKobo
		case "income":
			totals.TotalIncomeKobo += l.AmountKobo
		case "expenses":
			totals.TotalExpensesKobo += l.AmountKobo
		}
	}
	totals.NetProfitKobo = totals.TotalIncomeKobo - totals.TotalExpensesKobo

	// CAR and LiquidityRatio are percentages (ratios) — intermediate float is correct here.
	equityF := float64(totals.TotalEquityKobo)
	assetsF := float64(totals.TotalAssetsKobo)
	liabF := float64(totals.TotalLiabilitiesKobo)
	tier1 := equityF * 0.85
	tier2 := equityF * 0.15
	rwa := assetsF * 0.65
	if rwa > 0 {
		totals.CAR = ((tier1 + tier2) / rwa) * 100
	}
	liquidAssets := assetsF * 0.35
	currentLiab := liabF * 0.60
	if currentLiab > 0 {
		totals.LiquidityRatio = (liquidAssets / currentLiab) * 100
	}

	report := EFASSReport{
		ReportID:    fmt.Sprintf("EFASS-%s-%s", tenantID, period),
		Period:      period,
		TenantID:    tenantID,
		GeneratedAt: time.Now(),
		Status:      "generated",
		Forms:       lines,
		Totals:      totals,
	}

	// Queue a real outbox event; the relay publishes it to Kafka.
	outboxPayload, _ := json.Marshal(map[string]interface{}{
		"event": "gl.efass.generated", "reportId": report.ReportID, "tenantId": tenantID,
		"period": period, "timestamp": time.Now().UTC().Format(time.RFC3339),
	})
	outboxID := fmt.Sprintf("OBX-EFASS-%s-%s", tenantID, period)
	if _, err := app.db.Exec(`INSERT INTO outbox (id, topic, key, payload, idempotency_key, created_at, status)
		VALUES ($1, $2, $3, $4, $5, $6, 'pending') ON CONFLICT (id) DO NOTHING`,
		outboxID, "gl.efass.generated", report.ReportID, outboxPayload, outboxID, time.Now()); err != nil {
		log.Printf("[gl-engine-go] efass outbox insert failed: %v", err)
	}

	writeJSON(w, 200, map[string]interface{}{
		"report": report,
		"source": "postgres: trialBalances + efassMapping",
		"outbox": map[string]string{"id": outboxID, "status": "pending", "topic": "gl.efass.generated"},
		"cbn_compliance": map[string]interface{}{
			"car_compliant":       totals.CAR >= 10.0,
			"liquidity_compliant": totals.LiquidityRatio >= 30.0,
			"car_value":           fmt.Sprintf("%.2f%%", totals.CAR),
			"liquidity_value":     fmt.Sprintf("%.2f%%", totals.LiquidityRatio),
			"cbn_car_minimum":     "10% (15% for SIBs)",
			"cbn_lqr_minimum":     "30%",
		},
	})
}

func (app *App) listTrialBalance(w http.ResponseWriter, r *http.Request) {
	period := r.URL.Query().Get("period")
	tenantID := r.URL.Query().Get("tenantId")
	if tenantID == "" {
		tenantID = "tenant-lagos-main"
	}

	if app.db == nil {
		writeJSON(w, 503, map[string]string{"error": "gl_store_unavailable"})
		return
	}

	query := `SELECT "trialBalanceId", "tenantId", "glAccountCode", "periodStart", "periodEnd",
		"opening_balance_kobo", "total_debits_kobo", "total_credits_kobo", "closing_balance_kobo", "currency", "status"
		FROM "trialBalances" WHERE "tenantId" = $1`
	args := []interface{}{tenantID}
	if period != "" {
		query += ` AND TO_CHAR("periodEnd", 'YYYY-MM') = $2`
		args = append(args, period)
	}
	query += ` ORDER BY "glAccountCode"`

	rows, err := app.db.Query(query, args...)
	if err != nil {
		writeJSON(w, 503, map[string]string{"error": "gl_store_query_failed", "detail": err.Error()})
		return
	}
	defer rows.Close()
	var balances []TrialBalance
	for rows.Next() {
		var tb TrialBalance
		if err := rows.Scan(&tb.TrialBalanceID, &tb.TenantID, &tb.GLAccountCode, &tb.PeriodStart,
			&tb.PeriodEnd, &tb.OpeningBalanceKobo, &tb.TotalDebitsKobo, &tb.TotalCreditsKobo,
			&tb.ClosingBalanceKobo, &tb.Currency, &tb.Status); err == nil {
			balances = append(balances, tb)
		}
	}
	writeJSON(w, 200, map[string]interface{}{"items": balances, "total": len(balances), "source": "postgres"})
}

// cbnReturns lists the CBN/NDIC/NFIU return catalogue. Status is NEVER
// hardcoded "submitted": it comes from the cbn_return_filings table (written
// only by a real filing workflow), defaulting to "draft" when no filing
// record exists for the current period.
func (app *App) cbnReturns(w http.ResponseWriter, r *http.Request) {
	type returnDef struct {
		Code, Name, Frequency, Regulator, Form string
		DueDay                                 int
	}
	catalogue := []returnDef{
		{"MBR-100", "eFASS Monthly Return - Balance Sheet Assets", "monthly", "CBN", "MBR100", 15},
		{"MBR-200", "eFASS Monthly Return - Balance Sheet Liabilities", "monthly", "CBN", "MBR200", 15},
		{"MBR-300", "eFASS Monthly Return - Shareholders Equity", "monthly", "CBN", "MBR300", 15},
		{"MBR-400", "eFASS Monthly Return - Profit & Loss (Income)", "monthly", "CBN", "MBR400", 15},
		{"MBR-500", "eFASS Monthly Return - Profit & Loss (Expenses)", "monthly", "CBN", "MBR500", 15},
		{"MBR-600", "Capital Adequacy Return (CAR)", "monthly", "CBN", "MBR600", 15},
		{"MBR-700", "Liquidity Ratio Return", "monthly", "CBN", "MBR700", 15},
		{"MBR-800", "Sectoral Credit Allocation", "monthly", "CBN", "MBR800", 15},
		{"MBR-900", "Maturity Mismatch Report", "monthly", "CBN", "MBR900", 15},
		{"PRGL-A", "Prudential Return - Form A (Assets)", "monthly", "CBN", "PRGL-A", 10},
		{"PRGL-B", "Prudential Return - Form B (Liabilities)", "monthly", "CBN", "PRGL-B", 10},
		{"NDIC-PA", "NDIC Premium Assessment", "monthly", "NDIC", "NDIC-PA", 20},
		{"LER", "Large Exposures Return", "monthly", "CBN", "LER", 15},
		{"CLR", "Connected Lending Return", "monthly", "CBN", "CLR", 15},
		{"SOL", "Single Obligor Limit Return", "monthly", "CBN", "SOL", 15},
		{"IRR", "Interest Rate Return", "monthly", "CBN", "IRR", 15},
		{"FCE", "Foreign Currency Exposure", "monthly", "CBN", "FCE", 15},
		{"SLR", "Staff Loan Return", "monthly", "CBN", "SLR", 20},
		{"AMCON", "AMCON Contribution Return", "monthly", "AMCON", "AMCON", 15},
		{"FFR", "Fraud & Forgery Return", "monthly", "CBN", "FFR", 15},
		{"CTR", "Currency Transaction Report (₦5M+)", "daily", "NFIU", "CTR", 1},
		{"STR", "Suspicious Transaction Report", "as_needed", "NFIU", "STR", 3},
		{"PEP", "PEP Screening Return", "monthly", "CBN", "PEP", 15},
		{"SCUML", "SCUML Registration Update", "monthly", "SCUML", "SCUML", 15},
		{"NSFR", "Basel III Net Stable Funding Ratio", "monthly", "CBN", "NSFR", 20},
		{"LCR", "Basel III Liquidity Coverage Ratio", "monthly", "CBN", "LCR", 20},
	}

	// Actual filing statuses, if a real filing workflow has recorded them.
	filedStatus := map[string]string{}
	if app.db != nil {
		rows, err := app.db.Query(`SELECT return_code, status FROM cbn_return_filings WHERE period = TO_CHAR(NOW(), 'YYYY-MM')`)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var code, status string
				if rows.Scan(&code, &status) == nil {
					filedStatus[code] = status
				}
			}
		}
	}

	returns := make([]map[string]interface{}, 0, len(catalogue))
	for _, d := range catalogue {
		status := "draft" // never claim "submitted" without a real filing record
		if s, ok := filedStatus[d.Code]; ok && s != "" {
			status = s
		}
		returns = append(returns, map[string]interface{}{
			"code": d.Code, "name": d.Name, "frequency": d.Frequency,
			"dueDay": d.DueDay, "status": status, "regulator": d.Regulator, "form": d.Form,
		})
	}

	writeJSON(w, 200, map[string]interface{}{
		"items":        returns,
		"total":        len(returns),
		"statusSource": "cbn_return_filings (default draft when no real filing exists)",
		"glDataSource": "trialBalances → efassMapping → report",
	})
}

func (app *App) efassMapping(w http.ResponseWriter, r *http.Request) {
	if app.db == nil {
		writeJSON(w, 503, map[string]string{"error": "gl_store_unavailable"})
		return
	}
	rows, err := app.db.Query(`SELECT "glCodeStart", "glCodeEnd", "mbrForm", "mbrLine", "lineName", "reportCategory", "cbnCode" FROM "efassMapping" ORDER BY "mbrForm", "mbrLine"`)
	if err != nil {
		writeJSON(w, 503, map[string]string{"error": "gl_store_query_failed", "detail": err.Error()})
		return
	}
	defer rows.Close()
	var mappings []map[string]interface{}
	for rows.Next() {
		var start, end, form, name, cat, code string
		var line int
		if err := rows.Scan(&start, &end, &form, &line, &name, &cat, &code); err == nil {
			mappings = append(mappings, map[string]interface{}{
				"glCodeStart": start, "glCodeEnd": end, "mbrForm": form,
				"mbrLine": line, "lineName": name, "reportCategory": cat, "cbnCode": code,
			})
		}
	}
	writeJSON(w, 200, map[string]interface{}{"items": mappings, "total": len(mappings), "source": "postgres"})
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// ngnToKobo converts a NGN amount to kobo. Only for seed/demo initialisation.
func ngnToKobo(ngn int64) int64 { return ngn * 100 }

// ─── DEMO SEED DATA (NEVER served on request paths) ─────────────────────────
//
// The sample CoA/EFASS generators below exist ONLY to seed a DEMO tenant into
// Postgres when the operator explicitly sets SEED_DEMO=true. They are never
// used as a response fallback. Demo rows are tagged tenantId "DEMO".

func getSampleCoA() []GLAccount {
	return []GLAccount{
		{GLAccountCode: "1001", Name: "DEMO Cash in Vault - Local Currency", Category: "asset", Subcategory: "cash", BalanceKobo: ngnToKobo(2_850_000_000)},
		{GLAccountCode: "1005", Name: "DEMO Cash Reserve Requirement (CRR)", Category: "asset", Subcategory: "cash_cbn", BalanceKobo: ngnToKobo(18_500_000_000)},
		{GLAccountCode: "1201", Name: "DEMO Treasury Bills (NTBs)", Category: "asset", Subcategory: "investments_govt", BalanceKobo: ngnToKobo(25_000_000_000)},
		{GLAccountCode: "2101", Name: "DEMO Demand Deposits - Current Accounts", Category: "liability", Subcategory: "deposits_demand", BalanceKobo: ngnToKobo(85_000_000_000)},
		{GLAccountCode: "3002", Name: "DEMO Issued & Paid-up Capital", Category: "equity", Subcategory: "share_capital", BalanceKobo: ngnToKobo(25_000_000_000)},
	}
}

// seedDemoData inserts clearly-labelled DEMO rows. Called from main() only
// when SEED_DEMO=true.
func (app *App) seedDemoData() {
	if app.db == nil {
		log.Printf("[gl-engine-go] SEED_DEMO=true but postgres unavailable; cannot seed")
		return
	}
	log.Printf("[gl-engine-go] WARNING: SEED_DEMO=true — inserting DEMO chart of accounts (tenantId=DEMO). Never enable in production.")
	for _, a := range getSampleCoA() {
		if _, err := app.db.Exec(`INSERT INTO "glAccounts"
			("glAccountCode", "tenantId", "name", "category", "subcategory", "currency", "balance_kobo", "status", "isControlAccount")
			VALUES ($1, 'DEMO', $2, $3, $4, 'NGN', $5, 'active', 0)
			ON CONFLICT ("glAccountCode", "tenantId") DO NOTHING`,
			a.GLAccountCode, a.Name, a.Category, a.Subcategory, a.BalanceKobo); err != nil {
			log.Printf("[gl-engine-go] demo seed failed for %s: %v", a.GLAccountCode, err)
		}
	}
}

// ── MIDDLEWARE: JWT Validation (JWKS / RS256) ───────────────────────────────

type jwksCache struct {
	mu      sync.RWMutex
	keys    map[string]*rsa.PublicKey
	updated time.Time
}

var jwtCache = &jwksCache{keys: make(map[string]*rsa.PublicKey)}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func jwtRealmURL() string {
	return getEnv("KEYCLOAK_REALM_URL", "http://keycloak:8080/realms/54bank")
}

func fetchJWKS(realmURL string) {
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(realmURL + "/protocol/openid-connect/certs")
	if err != nil {
		log.Printf("[middleware] JWKS fetch failed: %v", err)
		return
	}
	defer resp.Body.Close()
	var jwks struct {
		Keys []struct {
			Kid string `json:"kid"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		log.Printf("[middleware] JWKS decode failed: %v", err)
		return
	}
	jwtCache.mu.Lock()
	defer jwtCache.mu.Unlock()
	for _, k := range jwks.Keys {
		nBytes, _ := base64.RawURLEncoding.DecodeString(k.N)
		eBytes, _ := base64.RawURLEncoding.DecodeString(k.E)
		if len(eBytes) == 0 {
			continue
		}
		var eInt int
		for _, b := range eBytes {
			eInt = eInt<<8 | int(b)
		}
		jwtCache.keys[k.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(nBytes), E: eInt}
	}
	jwtCache.updated = time.Now()
	log.Printf("[middleware] JWKS refreshed: %d keys", len(jwtCache.keys))
}

func startJWKSRefresh() {
	go fetchJWKS(jwtRealmURL())
	go func() {
		for range time.Tick(5 * time.Minute) {
			fetchJWKS(jwtRealmURL())
		}
	}()
}

// jwtAuthMiddleware validates Bearer tokens against the Keycloak JWKS endpoint
// (RS256 signature + expiry). Fail-closed: no token is accepted on structure
// alone.
func jwtAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if p == "/healthz" || p == "/readyz" || p == "/livez" || p == "/metrics" || p == "/health" {
			next.ServeHTTP(w, r)
			return
		}
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"unauthorized","service":"gl-engine-go"}`)
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"malformed token","service":"gl-engine-go"}`)
			return
		}
		headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
		if err != nil {
			http.Error(w, `{"error":"invalid token header"}`, http.StatusUnauthorized)
			return
		}
		var header struct {
			Kid string `json:"kid"`
			Alg string `json:"alg"`
		}
		json.Unmarshal(headerBytes, &header)
		if header.Alg != "RS256" {
			http.Error(w, `{"error":"unsupported token algorithm"}`, http.StatusUnauthorized)
			return
		}

		jwtCache.mu.RLock()
		pub, ok := jwtCache.keys[header.Kid]
		jwtCache.mu.RUnlock()
		if !ok {
			fetchJWKS(jwtRealmURL())
			jwtCache.mu.RLock()
			pub, ok = jwtCache.keys[header.Kid]
			jwtCache.mu.RUnlock()
			if !ok {
				http.Error(w, `{"error":"unknown signing key"}`, http.StatusUnauthorized)
				return
			}
		}

		sigBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
		if err != nil {
			http.Error(w, `{"error":"invalid signature encoding"}`, http.StatusUnauthorized)
			return
		}
		hash := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
		if err := rsa.VerifyPKCS1v15(pub, crypto.SHA256, hash[:], sigBytes); err != nil {
			http.Error(w, `{"error":"invalid signature"}`, http.StatusUnauthorized)
			return
		}

		claimsBytes, _ := base64.RawURLEncoding.DecodeString(parts[1])
		var claims map[string]interface{}
		json.Unmarshal(claimsBytes, &claims)
		if exp, ok := claims["exp"].(float64); ok && time.Now().Unix() > int64(exp) {
			http.Error(w, `{"error":"token expired"}`, http.StatusUnauthorized)
			return
		}
		if sub, ok := claims["sub"].(string); ok {
			r.Header.Set("X-User-Id", sub)
		}
		ctx := context.WithValue(r.Context(), "jwt_claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// ── MIDDLEWARE: Outbox Relay (Kafka) ────────────────────────────────────────
//
// gl-engine's outbox schema: (id, topic, key, payload, idempotency_key,
// created_at, status['pending'|'published']). Rows are marked 'published'
// ONLY after a confirmed Kafka produce; failures stay 'pending' for retry.

var kafkaProducer sarama.SyncProducer
var kafkaProducerMu sync.Mutex

func getKafkaProducer(brokers string) (sarama.SyncProducer, error) {
	kafkaProducerMu.Lock()
	defer kafkaProducerMu.Unlock()
	if kafkaProducer != nil {
		return kafkaProducer, nil
	}
	cfg := sarama.NewConfig()
	cfg.Producer.Return.Successes = true
	cfg.Producer.RequiredAcks = sarama.WaitForAll
	cfg.Producer.Retry.Max = 3
	p, err := sarama.NewSyncProducer(strings.Split(brokers, ","), cfg)
	if err != nil {
		return nil, err
	}
	kafkaProducer = p
	return kafkaProducer, nil
}

func (app *App) startOutboxRelay(ctx context.Context, brokers string) {
	go func() {
		ticker := time.NewTicker(2 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				app.relayOutbox(brokers)
			}
		}
	}()
}

func (app *App) relayOutbox(brokers string) {
	if app.db == nil {
		return
	}
	producer, err := getKafkaProducer(brokers)
	if err != nil {
		log.Printf("[outbox-relay] kafka unavailable: %v — events remain pending for retry", err)
		return
	}
	rows, err := app.db.Query(`SELECT id, topic, key, payload FROM outbox WHERE status = 'pending' ORDER BY created_at LIMIT 100`)
	if err != nil {
		return
	}
	defer rows.Close()

	var publishedIDs []string
	for rows.Next() {
		var id, topic, key string
		var payload []byte
		if err := rows.Scan(&id, &topic, &key, &payload); err != nil {
			continue
		}
		msg := &sarama.ProducerMessage{
			Topic: topic,
			Key:   sarama.StringEncoder(key),
			Value: sarama.ByteEncoder(payload),
		}
		if _, _, err := producer.SendMessage(msg); err != nil {
			log.Printf("[outbox-relay] publish failed for event %s: %v — leaving pending for retry", id, err)
			continue
		}
		publishedIDs = append(publishedIDs, id)
	}
	for _, id := range publishedIDs {
		if _, err := app.db.Exec(`UPDATE outbox SET status = 'published' WHERE id = $1`, id); err != nil {
			log.Printf("[outbox-relay] failed to mark event %s published: %v", id, err)
		}
	}
	if len(publishedIDs) > 0 {
		log.Printf("[outbox-relay] published %d events to kafka", len(publishedIDs))
	}
}

// --- Rate Limiting ---
var _rlTokens int64 = 100
var _rlLastRefill int64 = 0

func rlAllow() bool {
	nowr := time.Now().UnixMilli()
	if nowr-atomic.LoadInt64(&_rlLastRefill) >= 1000 {
		atomic.StoreInt64(&_rlTokens, 100)
		atomic.StoreInt64(&_rlLastRefill, nowr)
	}
	if atomic.AddInt64(&_rlTokens, -1) < 0 {
		atomic.AddInt64(&_rlTokens, 1)
		return false
	}
	return true
}

func rateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !rlAllow() {
			w.Header().Set("Retry-After", "1")
			http.Error(w, `{"error":"rate_limit_exceeded"}`, 429)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// --- Production Hardening ---
var (
	_reqCount uint64
	_errCount uint64
	_bootTime = time.Now()
)

var appInstance *App

func healthHandler(w http.ResponseWriter, r *http.Request) {
	if appInstance != nil {
		appInstance.health(w, r)
		return
	}
	writeJSON(w, 200, map[string]string{"status": "healthy", "service": "gl-engine-go"})
}

func readyzHandler(w http.ResponseWriter, r *http.Request) {
	if appInstance == nil || appInstance.db == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{"status": "not ready", "error": "database not initialized"})
		return
	}
	if err := appInstance.db.Ping(); err != nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{"status": "not ready", "error": err.Error()})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
}

func metricsHandler(w http.ResponseWriter, r *http.Request) {
	reqs := atomic.LoadUint64(&_reqCount)
	errs := atomic.LoadUint64(&_errCount)
	w.Header().Set("Content-Type", "text/plain")
	fmt.Fprintf(w, "# TYPE requests_total counter\nrequests_total{service=\"gl-engine-go\"} %d\n", reqs)
	fmt.Fprintf(w, "# TYPE errors_total counter\nerrors_total{service=\"gl-engine-go\"} %d\n", errs)
	fmt.Fprintf(w, "# TYPE uptime_seconds gauge\nuptime_seconds{service=\"gl-engine-go\"} %.0f\n", time.Since(_bootTime).Seconds())
}

func countingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddUint64(&_reqCount, 1)
		rw := &responseWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(rw, r)
		if rw.status >= 400 {
			atomic.AddUint64(&_errCount, 1)
		}
	})
}

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

// listHandler lists GL accounts (used by tests and /v1/gl/accounts alias).
func listHandler(w http.ResponseWriter, r *http.Request) {
	if appInstance == nil {
		writeJSON(w, 503, map[string]string{"error": "not initialized"})
		return
	}
	appInstance.listGLAccounts(w, r)
}

// ─── MAIN ───────────────────────────────────────────────────────────────────

func main() {
	app := NewApp()
	appInstance = app

	if os.Getenv("SEED_DEMO") == "true" {
		app.seedDemoData()
	}

	startJWKSRefresh()

	kafkaBrokers := getEnv("KAFKA_BROKERS", "localhost:9092")
	relayCtx, stopRelay := context.WithCancel(context.Background())
	defer stopRelay()
	app.startOutboxRelay(relayCtx, kafkaBrokers)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", app.health)
	mux.HandleFunc("/health", app.health)
	mux.HandleFunc("/readyz", readyzHandler)
	mux.HandleFunc("/livez", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "alive"})
	})
	mux.HandleFunc("/metrics", metricsHandler)
	mux.HandleFunc("/v1/gl/accounts", app.listGLAccounts)
	mux.HandleFunc("/v1/gl/journal", app.postJournal)
	mux.HandleFunc("/v1/gl/trial-balance", app.listTrialBalance)
	mux.HandleFunc("/v1/gl/period-close", app.periodClose)
	mux.HandleFunc("/v1/gl/efass/generate", app.generateEFASS)
	mux.HandleFunc("/v1/gl/efass/mapping", app.efassMapping)
	mux.HandleFunc("/v1/gl/cbn-returns", app.cbnReturns)

	port := getEnv("PORT", "8090")

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      rateLimitMiddleware(jwtAuthMiddleware(countingMiddleware(mux))),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Printf("GL Engine (Go) listening on :%s", port)
	log.Fatal(server.ListenAndServe())
}
