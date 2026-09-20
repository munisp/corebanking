package main

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"tbclient"
	"time"

	_ "github.com/lib/pq"

	"shared/otel/go/otelkit"
)

// TigerBeetle Overdraft Protection (MN-08 rework).
//
// Drawdown moves REAL money: a single non-pending TB transfer from the
// per-facility TB liability account to the customer's real TB account.
//  - Facility TB account id is derived deterministically from facility_id
//    (detID("od-facility:"+facilityID)) and created at facility creation.
//  - Transfer id is deterministic: detID("od:{facility_id}:{seq}") where seq
//    is a DB counter incremented under SELECT ... FOR UPDATE — retries with
//    the same seq are idempotent via TB's exists result.
//  - Postgres (tb_overdraft_facilities) is the ONLY source of truth; the
//    previous in-memory map and random tbclient.NewUint128() accounts are
//    gone.
//  - Debit-path integration contract (implemented by R2 in
//    payment-processing-service, NOT here): GET /v1/overdraft/check
//    ?account_id=<customer account id>&amount=<kobo> →
//    {"approved":bool,"available_limit":int64,"facility_id":string}.
//  - Interest: POST /v1/overdraft/accrue computes daily interest in integer
//    kobo (ROUND_HALF_UP), persists it idempotently per facility+date, and
//    triggers interest-accrual-engine-go POST /v1/interest/accrue
//    (INTEREST_ACCRUAL_URL). GL posting (Dr 1301 / Cr 4101) lands once the
//    accrual engine's eligible-account feed is wired (S9, R4).

// TB ledger/code constants — ledger 1 / code 1 match account-service TB
// provisioning (account-service/adapters/tigerbeetle.py: ledger=1, code=1).
const (
	ledgerNGN         uint32 = 1
	codeODFacility    uint16 = 2  // facility liability pool accounts
	codeCustomerAcct  uint16 = 1  // customer deposit accounts
	transferDrawdown  uint16 = 21 // OD drawdown transfers
	transferRepayment uint16 = 22 // OD repayment transfers
)

type OverdraftFacility struct {
	FacilityID    string    `json:"facility_id"`
	AccountID     string    `json:"account_id"`    // customer primary account id (TB hex id)
	ODAccountID   string    `json:"od_account_id"` // facility TB liability account id (hex)
	LimitKobo     int64     `json:"limit_kobo"`
	UsedKobo      int64     `json:"used_kobo"`
	AvailableKobo int64     `json:"available_kobo"`
	InterestRate  float64   `json:"interest_rate_pct"`
	Status        string    `json:"status"` // active, suspended, closed, expired
	CreatedAt     time.Time `json:"created_at"`
	ExpiresAt     time.Time `json:"expires_at"`
}

type ODTransfer struct {
	TransferID    string    `json:"transfer_id"`
	FacilityID    string    `json:"facility_id"`
	AmountKobo    int64     `json:"amount_kobo"`
	Type          string    `json:"type"` // drawdown, repayment
	BalanceBefore int64     `json:"balance_before_kobo"`
	BalanceAfter  int64     `json:"balance_after_kobo"`
	CreatedAt     time.Time `json:"created_at"`
}

var (
	db       *sql.DB
	tbClient *tbclient.Client
)

// detID derives a deterministic TB Uint128 from a human-meaningful key
// (SHA-256, first 128 bits). Deterministic ⇒ idempotent: TB returns
// "exists" instead of duplicating the transfer on retry.
func detID(key string) tbclient.Uint128 {
	sum := sha256.Sum256([]byte(key))
	var b [16]byte
	copy(b[:], sum[:16])
	return tbclient.BytesToUint128(b)
}

// u128Hex renders a TB Uint128 as a 32-char big-endian hex string.
func u128Hex(u tbclient.Uint128) string {
	b := u.Bytes()
	for i, j := 0, 15; i < j; i, j = i+1, j-1 {
		b[i], b[j] = b[j], b[i]
	}
	return hex.EncodeToString(b[:])
}

// parseTBAccountID parses a big-endian hex TB account id (32 hex chars, or
// shorter / odd-length forms as produced by Uint128.String()). Mirrors the
// SDK's HexStringToUint128 (not re-exported by pkg/tbclient).
func parseTBAccountID(s string) (tbclient.Uint128, error) {
	var zero tbclient.Uint128
	s = strings.TrimSpace(strings.ToLower(s))
	if s == "" || len(s) > 32 {
		return zero, fmt.Errorf("account id must be 1..32 hex chars")
	}
	if len(s)%2 == 1 {
		s = "0" + s
	}
	var b [16]byte
	n, err := hex.Decode(b[:], []byte(s))
	if err != nil {
		return zero, fmt.Errorf("account id is not valid hex: %w", err)
	}
	// big-endian hex → little-endian storage
	for i := 0; i < n/2; i++ {
		b[i], b[n-1-i] = b[n-1-i], b[i]
	}
	return tbclient.BytesToUint128(b), nil
}

func jsonErr(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Printf("[tb-overdraft-protection] WARNING: DATABASE_URL unset — money-moving endpoints will fail closed (503)")
		return
	}
	var err error
	db, err = otelkit.OpenSQLDB("postgres", dsn)
	if err != nil {
		log.Printf("DB error: %v", err)
		db = nil
		return
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS tb_overdraft_facilities (
		facility_id VARCHAR(64) PRIMARY KEY,
		account_id VARCHAR(64) NOT NULL,
		od_account_id VARCHAR(64) NOT NULL,
		limit_kobo BIGINT NOT NULL,
		used_kobo BIGINT NOT NULL DEFAULT 0,
		available_kobo BIGINT NOT NULL,
		interest_rate_pct NUMERIC(8,4) NOT NULL DEFAULT 0,
		status VARCHAR(16) NOT NULL DEFAULT 'active',
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		expires_at TIMESTAMPTZ NOT NULL
	)`); err != nil {
		log.Printf("schema(tb_overdraft_facilities): %v", err)
	}
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS tb_od_transfers (
		transfer_id VARCHAR(128) PRIMARY KEY,
		facility_id VARCHAR(64) NOT NULL,
		amount_kobo BIGINT NOT NULL,
		type VARCHAR(16) NOT NULL,
		balance_before_kobo BIGINT NOT NULL,
		balance_after_kobo BIGINT NOT NULL,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`); err != nil {
		log.Printf("schema(tb_od_transfers): %v", err)
	}
	// MN-08 expand-migrate: deterministic sequence counters for transfer ids.
	for _, stmt := range []string{
		`ALTER TABLE tb_overdraft_facilities ADD COLUMN IF NOT EXISTS draw_seq BIGINT NOT NULL DEFAULT 0`,
		`ALTER TABLE tb_overdraft_facilities ADD COLUMN IF NOT EXISTS repay_seq BIGINT NOT NULL DEFAULT 0`,
		`CREATE TABLE IF NOT EXISTS od_interest_accruals (
			facility_id VARCHAR(64) NOT NULL,
			accrual_date DATE NOT NULL,
			amount_kobo BIGINT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			PRIMARY KEY (facility_id, accrual_date)
		)`,
	} {
		if _, err := db.Exec(stmt); err != nil {
			log.Printf("schema migration: %v", err)
		}
	}
	log.Println("[tb-overdraft-protection] Schema initialized")
}

// ensureFacilityTBAccount idempotently creates the facility's TB liability
// account (deterministic id ⇒ AccountExists is a success).
func ensureFacilityTBAccount(ctx context.Context, facilityID string) (tbclient.Uint128, error) {
	acctID := detID("od-facility:" + facilityID)
	results, err := tbClient.CreateAccounts(ctx, []tbclient.Account{{
		ID:     acctID,
		Ledger: ledgerNGN,
		Code:   codeODFacility,
		Flags:  tbclient.AccountFlags{History: true}.ToUint16(),
	}})
	if err != nil {
		return acctID, fmt.Errorf("tb create facility account: %w", err)
	}
	for _, r := range results {
		if r.Status != tbclient.AccountExists {
			return acctID, fmt.Errorf("tb create facility account failed: status=%d", uint32(r.Status))
		}
	}
	return acctID, nil
}

func createFacilityHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AccountID    string  `json:"account_id"` // customer's real TB account id (hex)
		LimitKobo    int64   `json:"limit_kobo"`
		InterestRate float64 `json:"interest_rate_pct"`
		ExpiryDays   int     `json:"expiry_days"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "invalid request", 400)
		return
	}
	if req.LimitKobo <= 0 {
		jsonErr(w, "limit must be positive", 400)
		return
	}
	if db == nil || tbClient == nil {
		jsonErr(w, "store or ledger unavailable — facility NOT created", 503)
		return
	}
	custID, err := parseTBAccountID(req.AccountID)
	if err != nil {
		jsonErr(w, "account_id must be the customer TB account id (hex): "+err.Error(), 400)
		return
	}
	// Fail-closed: the customer account must really exist in TB.
	if accts, err := tbClient.LookupAccounts(r.Context(), []tbclient.Uint128{custID}); err != nil || len(accts) == 0 {
		jsonErr(w, "customer TB account not found — facility NOT created", 422)
		return
	}

	f := &OverdraftFacility{
		FacilityID:    fmt.Sprintf("ODF-%d", time.Now().UnixNano()),
		AccountID:     req.AccountID,
		LimitKobo:     req.LimitKobo,
		UsedKobo:      0,
		AvailableKobo: req.LimitKobo,
		InterestRate:  req.InterestRate,
		Status:        "active",
		CreatedAt:     time.Now(),
		ExpiresAt:     time.Now().AddDate(0, 0, req.ExpiryDays),
	}
	facTB, err := ensureFacilityTBAccount(r.Context(), f.FacilityID)
	if err != nil {
		jsonErr(w, "failed to provision facility TB account: "+err.Error(), 502)
		return
	}
	f.ODAccountID = u128Hex(facTB)

	if _, err := db.Exec(`INSERT INTO tb_overdraft_facilities (facility_id, account_id, od_account_id, limit_kobo, used_kobo, available_kobo, interest_rate_pct, status, created_at, expires_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		f.FacilityID, f.AccountID, f.ODAccountID, f.LimitKobo, f.UsedKobo, f.AvailableKobo, f.InterestRate, f.Status, f.CreatedAt, f.ExpiresAt); err != nil {
		jsonErr(w, err.Error(), 500)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(201)
	json.NewEncoder(w).Encode(map[string]interface{}{"facility": f})
}

// odTransfer executes the single non-pending TB transfer for a drawdown
// (facility → customer) or repayment (customer → facility). Fail-closed.
func odTransfer(ctx context.Context, key string, debit, credit tbclient.Uint128, amountKobo int64, code uint16) error {
	results, err := tbClient.CreateTransfers(ctx, []tbclient.Transfer{{
		ID:              detID(key),
		DebitAccountID:  debit,
		CreditAccountID: credit,
		Amount:          tbclient.ToUint128(uint64(amountKobo)),
		Ledger:          ledgerNGN,
		Code:            code,
	}})
	if err != nil {
		return fmt.Errorf("tb transfer: %w", err)
	}
	for _, res := range results {
		// TransferExists (deterministic id) = idempotent retry success.
		if res.Status != tbclient.TransferExists {
			return fmt.Errorf("tb transfer rejected: status=%d", uint32(res.Status))
		}
	}
	return nil
}

func drawdownHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AccountID           string `json:"account_id"`             // facility key (customer account id)
		CustomerTBAccountID string `json:"customer_tb_account_id"` // real TB account id (hex)
		AmountKobo          int64  `json:"amount_kobo"`
		Reason              string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "invalid request", 400)
		return
	}
	if req.AmountKobo <= 0 {
		jsonErr(w, "amount_kobo must be positive", 400)
		return
	}
	if req.CustomerTBAccountID == "" {
		req.CustomerTBAccountID = req.AccountID
	}
	if db == nil || tbClient == nil {
		jsonErr(w, "store or ledger unavailable — drawdown NOT executed", 503)
		return
	}
	custTB, err := parseTBAccountID(req.CustomerTBAccountID)
	if err != nil {
		jsonErr(w, "customer_tb_account_id must be a TB account id (hex): "+err.Error(), 400)
		return
	}
	// Fail-closed: credit leg must be a real, existing customer account.
	if accts, err := tbClient.LookupAccounts(r.Context(), []tbclient.Uint128{custTB}); err != nil || len(accts) == 0 {
		jsonErr(w, "customer TB account not found", 422)
		return
	}

	ctx := r.Context()
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		jsonErr(w, "db error", 500)
		return
	}
	defer tx.Rollback()

	// MN-08: DB is the source of truth; row lock serializes drawdowns.
	var f OverdraftFacility
	var drawSeq int64
	err = tx.QueryRowContext(ctx, `SELECT facility_id, account_id, od_account_id, limit_kobo, used_kobo, available_kobo,
		interest_rate_pct, status, created_at, expires_at, draw_seq
		FROM tb_overdraft_facilities WHERE account_id=$1 ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, req.AccountID).
		Scan(&f.FacilityID, &f.AccountID, &f.ODAccountID, &f.LimitKobo, &f.UsedKobo, &f.AvailableKobo,
			&f.InterestRate, &f.Status, &f.CreatedAt, &f.ExpiresAt, &drawSeq)
	if err == sql.ErrNoRows {
		jsonErr(w, "no overdraft facility for this account", 404)
		return
	}
	if err != nil {
		jsonErr(w, "db error", 500)
		return
	}
	if f.Status != "active" {
		jsonErr(w, "facility not active", 403)
		return
	}
	if time.Now().After(f.ExpiresAt) {
		tx.ExecContext(ctx, `UPDATE tb_overdraft_facilities SET status='expired' WHERE facility_id=$1`, f.FacilityID)
		tx.Commit()
		jsonErr(w, "facility expired", 403)
		return
	}
	if req.AmountKobo > f.AvailableKobo {
		jsonErr(w, fmt.Sprintf("exceeds available limit (available_kobo=%d, requested_kobo=%d)", f.AvailableKobo, req.AmountKobo), 403)
		return
	}

	facTB, err := ensureFacilityTBAccount(ctx, f.FacilityID)
	if err != nil {
		jsonErr(w, "facility TB account unavailable: "+err.Error(), 502)
		return
	}

	seq := drawSeq + 1
	transferKey := fmt.Sprintf("od:%s:%d", f.FacilityID, seq)
	if err := odTransfer(ctx, transferKey, facTB, custTB, req.AmountKobo, transferDrawdown); err != nil {
		jsonErr(w, "ledger transfer failed — drawdown NOT executed: "+err.Error(), 502)
		return
	}

	balanceBefore := f.UsedKobo
	f.UsedKobo += req.AmountKobo
	f.AvailableKobo = f.LimitKobo - f.UsedKobo
	transfer := ODTransfer{
		TransferID:    transferKey,
		FacilityID:    f.FacilityID,
		AmountKobo:    req.AmountKobo,
		Type:          "drawdown",
		BalanceBefore: balanceBefore,
		BalanceAfter:  f.UsedKobo,
		CreatedAt:     time.Now(),
	}
	if _, err := tx.ExecContext(ctx, `UPDATE tb_overdraft_facilities SET used_kobo=$1, available_kobo=$2, draw_seq=$3 WHERE facility_id=$4`,
		f.UsedKobo, f.AvailableKobo, seq, f.FacilityID); err != nil {
		jsonErr(w, "db error", 500)
		return
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO tb_od_transfers (transfer_id, facility_id, amount_kobo, type, balance_before_kobo, balance_after_kobo, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (transfer_id) DO NOTHING`,
		transfer.TransferID, transfer.FacilityID, transfer.AmountKobo, transfer.Type, transfer.BalanceBefore, transfer.BalanceAfter, transfer.CreatedAt); err != nil {
		jsonErr(w, "db error", 500)
		return
	}
	if err := tx.Commit(); err != nil {
		jsonErr(w, "commit failed", 500)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"transfer":       transfer,
		"facility":       f,
		"tb_transfer_id": u128Hex(detID(transferKey)),
		"tb_result":      "success",
	})
}

func repayHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AccountID  string `json:"account_id"`
		AmountKobo int64  `json:"amount_kobo"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "invalid request", 400)
		return
	}
	if req.AmountKobo <= 0 {
		jsonErr(w, "amount_kobo must be positive", 400)
		return
	}
	if db == nil || tbClient == nil {
		jsonErr(w, "store or ledger unavailable — repayment NOT executed", 503)
		return
	}
	custTB, err := parseTBAccountID(req.AccountID)
	if err != nil {
		jsonErr(w, "account_id must be the customer TB account id (hex): "+err.Error(), 400)
		return
	}
	if accts, err := tbClient.LookupAccounts(r.Context(), []tbclient.Uint128{custTB}); err != nil || len(accts) == 0 {
		jsonErr(w, "customer TB account not found", 422)
		return
	}

	ctx := r.Context()
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		jsonErr(w, "db error", 500)
		return
	}
	defer tx.Rollback()

	var f OverdraftFacility
	var repaySeq int64
	err = tx.QueryRowContext(ctx, `SELECT facility_id, account_id, od_account_id, limit_kobo, used_kobo, available_kobo,
		interest_rate_pct, status, created_at, expires_at, repay_seq
		FROM tb_overdraft_facilities WHERE account_id=$1 ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, req.AccountID).
		Scan(&f.FacilityID, &f.AccountID, &f.ODAccountID, &f.LimitKobo, &f.UsedKobo, &f.AvailableKobo,
			&f.InterestRate, &f.Status, &f.CreatedAt, &f.ExpiresAt, &repaySeq)
	if err == sql.ErrNoRows {
		jsonErr(w, "no overdraft facility for this account", 404)
		return
	}
	if err != nil {
		jsonErr(w, "db error", 500)
		return
	}

	repayAmount := req.AmountKobo
	if repayAmount > f.UsedKobo {
		repayAmount = f.UsedKobo
	}
	if repayAmount <= 0 {
		jsonErr(w, "nothing to repay", 400)
		return
	}

	facTB, err := ensureFacilityTBAccount(ctx, f.FacilityID)
	if err != nil {
		jsonErr(w, "facility TB account unavailable: "+err.Error(), 502)
		return
	}

	seq := repaySeq + 1
	transferKey := fmt.Sprintf("od:%s:repay:%d", f.FacilityID, seq)
	if err := odTransfer(ctx, transferKey, custTB, facTB, repayAmount, transferRepayment); err != nil {
		jsonErr(w, "ledger transfer failed — repayment NOT executed: "+err.Error(), 502)
		return
	}

	balanceBefore := f.UsedKobo
	f.UsedKobo -= repayAmount
	f.AvailableKobo = f.LimitKobo - f.UsedKobo
	transfer := ODTransfer{
		TransferID:    transferKey,
		FacilityID:    f.FacilityID,
		AmountKobo:    repayAmount,
		Type:          "repayment",
		BalanceBefore: balanceBefore,
		BalanceAfter:  f.UsedKobo,
		CreatedAt:     time.Now(),
	}
	if _, err := tx.ExecContext(ctx, `UPDATE tb_overdraft_facilities SET used_kobo=$1, available_kobo=$2, repay_seq=$3 WHERE facility_id=$4`,
		f.UsedKobo, f.AvailableKobo, seq, f.FacilityID); err != nil {
		jsonErr(w, "db error", 500)
		return
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO tb_od_transfers (transfer_id, facility_id, amount_kobo, type, balance_before_kobo, balance_after_kobo, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (transfer_id) DO NOTHING`,
		transfer.TransferID, transfer.FacilityID, transfer.AmountKobo, transfer.Type, transfer.BalanceBefore, transfer.BalanceAfter, transfer.CreatedAt); err != nil {
		jsonErr(w, "db error", 500)
		return
	}
	if err := tx.Commit(); err != nil {
		jsonErr(w, "commit failed", 500)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"transfer": transfer, "facility": f, "tb_result": "success"})
}

// checkHandler is the debit-path authorization contract (MN-08) consumed by
// payment-processing-service (R2): on insufficient TB balance for an external
// debit, the debit path calls
//
//	GET /v1/overdraft/check?account_id=<customer account id>&amount=<kobo>
//
// and, when approved, POSTs /v1/tb-overdraft/drawdown with
// {account_id, customer_tb_account_id, amount_kobo} before re-attempting.
func checkHandler(w http.ResponseWriter, r *http.Request) {
	if db == nil {
		jsonErr(w, "store unavailable", 503)
		return
	}
	accountID := r.URL.Query().Get("account_id")
	amount, _ := strconv.ParseInt(r.URL.Query().Get("amount"), 10, 64)
	if accountID == "" {
		jsonErr(w, "account_id is required", 400)
		return
	}
	var facilityID, status string
	var available int64
	var expiresAt time.Time
	err := db.QueryRowContext(r.Context(), `SELECT facility_id, available_kobo, status, expires_at
		FROM tb_overdraft_facilities WHERE account_id=$1 ORDER BY created_at DESC LIMIT 1`, accountID).
		Scan(&facilityID, &available, &status, &expiresAt)
	if err == sql.ErrNoRows {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"approved": false, "available_limit": 0, "reason": "no_facility"})
		return
	}
	if err != nil {
		jsonErr(w, "db error", 500)
		return
	}
	approved := status == "active" && time.Now().Before(expiresAt) && amount > 0 && amount <= available
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"approved":        approved,
		"available_limit": available,
		"facility_id":     facilityID,
	})
}

// accrueHandler (MN-08 interest): computes daily OD interest per active
// facility in integer kobo (ROUND_HALF_UP), persists idempotently per
// facility+date, then triggers interest-accrual-engine-go's batch
// (POST /v1/interest/accrue) when INTEREST_ACCRUAL_URL is configured.
// Engine-side GL posting (Dr 1301 / Cr 4101) requires the engine's eligible
// account feed (S9/R4); the trigger is fail-soft and reported per-call.
func accrueHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", "POST")
		jsonErr(w, "method_not_allowed", 405)
		return
	}
	if db == nil {
		jsonErr(w, "store unavailable — accrual NOT run", 503)
		return
	}
	ctx := r.Context()
	today := time.Now().UTC().Truncate(24 * time.Hour)
	rows, err := db.QueryContext(ctx, `SELECT facility_id, used_kobo, interest_rate_pct
		FROM tb_overdraft_facilities WHERE status='active' AND used_kobo > 0`)
	if err != nil {
		jsonErr(w, "db error", 500)
		return
	}
	defer rows.Close()

	type accrual struct {
		FacilityID string `json:"facility_id"`
		UsedKobo   int64  `json:"used_kobo"`
		Kobo       int64  `json:"interest_kobo"`
		Inserted   bool   `json:"posted"`
	}
	var out []accrual
	for rows.Next() {
		var fid string
		var used int64
		var rate float64
		if err := rows.Scan(&fid, &used, &rate); err != nil {
			continue
		}
		// interest_kobo = ROUND_HALF_UP(used * rate_pct / 100 / 365).
		// rate_pct has ≤4 decimal places (NUMERIC(8,4)): use rate*10^4 as int.
		rateE4 := new(big.Int).SetInt64(int64(rate*10000 + 0.5))
		num := new(big.Int).Mul(new(big.Int).SetInt64(used), rateE4)
		den := new(big.Int).SetInt64(100 * 10000 * 365)
		q, rem := new(big.Int).QuoRem(num, den, new(big.Int))
		if new(big.Int).Mul(rem, big.NewInt(2)).Cmp(den) >= 0 {
			q.Add(q, big.NewInt(1))
		}
		amount := q.Int64()
		res, err := db.ExecContext(ctx, `INSERT INTO od_interest_accruals (facility_id, accrual_date, amount_kobo)
			VALUES ($1,$2,$3) ON CONFLICT (facility_id, accrual_date) DO NOTHING`, fid, today, amount)
		inserted := err == nil
		if n, e := res.RowsAffected(); e == nil {
			inserted = n > 0
		}
		out = append(out, accrual{FacilityID: fid, UsedKobo: used, Kobo: amount, Inserted: inserted})
	}

	engineStatus := "not_configured"
	if url := os.Getenv("INTEREST_ACCRUAL_URL"); url != "" {
		body, _ := json.Marshal(map[string]string{"businessDate": today.Format("2006-01-02")})
		req, _ := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimSuffix(url, "/")+"/v1/interest/accrue", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		if tok := os.Getenv("INTEREST_ACCRUAL_TOKEN"); tok != "" {
			req.Header.Set("Authorization", "Bearer "+tok)
		}
		client := &http.Client{Timeout: 10 * time.Second}
		if resp, err := client.Do(req); err != nil {
			engineStatus = "trigger_failed: " + err.Error()
		} else {
			engineStatus = fmt.Sprintf("triggered: http_%d", resp.StatusCode)
			resp.Body.Close()
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"accrual_date":   today.Format("2006-01-02"),
		"facilities":     out,
		"accrual_engine": engineStatus,
	})
}

func statusHandler(w http.ResponseWriter, r *http.Request) {
	if db == nil {
		jsonErr(w, "store unavailable", 503)
		return
	}
	accountID := r.URL.Query().Get("account_id")
	var f OverdraftFacility
	err := db.QueryRowContext(r.Context(), `SELECT facility_id, account_id, od_account_id, limit_kobo, used_kobo, available_kobo,
		interest_rate_pct, status, created_at, expires_at
		FROM tb_overdraft_facilities WHERE account_id=$1 ORDER BY created_at DESC LIMIT 1`, accountID).
		Scan(&f.FacilityID, &f.AccountID, &f.ODAccountID, &f.LimitKobo, &f.UsedKobo, &f.AvailableKobo,
			&f.InterestRate, &f.Status, &f.CreatedAt, &f.ExpiresAt)
	if err != nil {
		jsonErr(w, "no facility", 404)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"facility": f})
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"healthy","service":"tb-overdraft-protection-go"}`))
}

func initTBClient() {
	var cfg tbclient.Config
	if addr := os.Getenv("TB_ADDRESS"); addr != "" {
		cfg.Addresses = []string{addr}
	}
	var err error
	tbClient, err = tbclient.NewClient(cfg)
	if err != nil {
		log.Printf("[tb-overdraft-protection] TB client init failed (money-moving endpoints fail closed): %v", err)
	}
}

// ── MIDDLEWARE: JWT Validation (JWKS / RS256, fail-closed) ──────────────────

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
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			fetchJWKS(jwtRealmURL())
		}
	}()
}

// tenantFromClaims derives the tenant ONLY from verified token claims — never
// from caller-supplied headers or parameters.
func tenantFromClaims(claims map[string]interface{}) string {
	for _, k := range []string{"tenant_id", "tenantId", "tenant"} {
		if s, ok := claims[k].(string); ok && s != "" {
			return s
		}
	}
	return ""
}

// jwtAuthMiddleware validates Bearer tokens against the Keycloak JWKS endpoint
// (RS256 signature + expiry). Fail-closed: requests without a verifiable token
// get 401. Only health/metrics probes are exempt. Tenant identity is derived
// from the verified claims and stamped onto X-Tenant-ID, overwriting any
// caller-supplied value.
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
			fmt.Fprintf(w, `{"error":"unauthorized","service":%q}`, "tb-overdraft-protection-go")
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"malformed token","service":%q}`, "tb-overdraft-protection-go")
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
		exp, ok := claims["exp"].(float64)
		if !ok {
			http.Error(w, `{"error":"token missing exp claim"}`, http.StatusUnauthorized)
			return
		}
		if time.Now().Unix() >= int64(exp) {
			http.Error(w, `{"error":"token expired"}`, http.StatusUnauthorized)
			return
		}
		if sub, ok := claims["sub"].(string); ok {
			r.Header.Set("X-User-Id", sub)
		}
		// Tenant identity comes ONLY from verified claims; overwrite any
		// caller-supplied tenant header before invoking the handler.
		if tenant := tenantFromClaims(claims); tenant != "" {
			r.Header.Set("X-Tenant-ID", tenant)
		} else {
			r.Header.Del("X-Tenant-ID")
		}
		ctx := context.WithValue(r.Context(), "jwt_claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
func main() {
	shutdown, oerr := otelkit.Init(context.Background(), "tb-overdraft-protection-go")
	if oerr != nil {
		log.Fatalf("otelkit init: %v", oerr)
	}
	defer func() {
		sctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if serr := shutdown(sctx); serr != nil {
			log.Printf("otelkit shutdown: %v", serr)
		}
	}()
	startJWKSRefresh()

	initDB()
	initTBClient()

	mux := http.NewServeMux()
	mux.HandleFunc("/v1/tb-overdraft/create", createFacilityHandler)
	mux.HandleFunc("/v1/tb-overdraft/drawdown", drawdownHandler)
	mux.HandleFunc("/v1/tb-overdraft/repay", repayHandler)
	mux.HandleFunc("/v1/tb-overdraft/status", statusHandler)
	// MN-08: debit-path authorization + interest accrual contracts.
	mux.HandleFunc("/v1/overdraft/check", checkHandler)
	mux.HandleFunc("/v1/overdraft/accrue", accrueHandler)
	mux.HandleFunc("/healthz", healthHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8304"
	}

	server := &http.Server{Addr: ":" + port, Handler: otelkit.HTTPMiddleware(jwtAuthMiddleware(mux))}

	go func() {
		log.Printf("[tb-overdraft-protection-go] Starting on :%s", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("ListenAndServe: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	server.Shutdown(ctx)
	log.Println("[tb-overdraft-protection-go] Shutdown complete")
}
