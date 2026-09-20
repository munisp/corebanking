package main

import (
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
	"strconv"
	"strings"
	"sync"
	"tbclient"
	"time"

	_ "github.com/lib/pq"
)

// Cheque clearing (MN-21 rework): persisted lifecycle with REAL money movement.
//  - Postgres is the source of truth (in-memory map deleted).
//  - Amounts are integer kobo (float64 deleted; legacy float `amount` in NGN
//    is converted with ROUND_HALF_UP and logged as deprecated).
//  - Presentment places a REAL hold: TB pending transfer drawer → clearing
//    suspense (env CHEQUE_SUSPENSE_ACCOUNT_ID), deterministic id
//    detID("chq:{cheque_id}:hold"), timeout = return window.
//  - Clearing posts the pending transfer (id detID("chq:{id}:post")) and, when
//    the payee is an in-house TB account, settles suspense → payee
//    (id detID("chq:{id}:settle")); interbank payees remain in suspense for
//    settlement-clearing-go (documented handoff).
//  - Dishonor voids the pending transfer (id detID("chq:{id}:void")) and posts
//    a balanced dishonor-fee journal to gl-engine-go (env GL_ENGINE_URL;
//    Dr 2101 / Cr 4201, CHEQUE_DISHONOR_FEE_KOBO) — fail-soft with a durable
//    outbox row (cheque_outbox) retried by a background ticker.
//  - Return-window job: auto-dishonors unconfirmed cheques after
//    CHEQUE_RETURN_WINDOW_DAYS (default 2).

type Cheque struct {
	ID             string     `json:"id"`
	TenantID       string     `json:"tenant_id"`
	ChequeNumber   string     `json:"cheque_number"`
	AmountKobo     int64      `json:"amount_kobo"`
	Currency       string     `json:"currency"`
	DrawerAccount  string     `json:"drawer_account"` // TB account id (hex)
	PayeeAccount   string     `json:"payee_account"`  // TB account id (hex) or external ref
	BankCode       string     `json:"bank_code"`
	BranchCode     string     `json:"branch_code"`
	Status         string     `json:"status"` // pending | clearing | cleared | dishonored | returned
	HoldTransferID string     `json:"hold_transfer_id,omitempty"`
	PresentedAt    time.Time  `json:"presented_at"`
	ClearedAt      *time.Time `json:"cleared_at,omitempty"`
	DishonorReason string     `json:"dishonor_reason,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

var (
	db       *sql.DB
	tbClient *tbclient.Client
)

const (
	tbLedgerNGN uint32 = 1 // matches account-service TB provisioning (ledger=1, code=1)
	tbCode      uint16 = 1
)

// detID derives a deterministic TB Uint128 from a human-meaningful key
// (SHA-256, first 128 bits) ⇒ idempotent retries.
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

// parseTBAccountID parses a big-endian hex TB account id (mirrors the SDK's
// HexStringToUint128, not re-exported by pkg/tbclient).
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
	for i := 0; i < n/2; i++ {
		b[i], b[n-1-i] = b[n-1-i], b[i]
	}
	return tbclient.BytesToUint128(b), nil
}

// ngnToKoboHalfUp converts a legacy float NGN amount to integer kobo with
// explicit ROUND_HALF_UP (deprecation path only; new callers send amount_kobo).
func ngnToKoboHalfUp(amount float64) int64 {
	r := new(big.Rat).SetFloat64(amount)
	r.Mul(r, big.NewRat(100, 1))
	num, den := r.Num(), r.Denom()
	q, rem := new(big.Int).QuoRem(num, den, new(big.Int))
	if new(big.Int).Mul(rem, big.NewInt(2)).Cmp(den) >= 0 {
		q.Add(q, big.NewInt(1))
	}
	return q.Int64()
}

func newID() string { return fmt.Sprintf("chq_%d", time.Now().UnixNano()) }

func jsonErr(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func jsonOK(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Printf("[cheque-clearing] WARNING: DATABASE_URL unset — cheque endpoints fail closed (503)")
		return
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("DB error: %v", err)
		db = nil
		return
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	for _, stmt := range []string{
		`CREATE TABLE IF NOT EXISTS cheques (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			cheque_number TEXT NOT NULL,
			amount_kobo BIGINT NOT NULL,
			currency TEXT NOT NULL DEFAULT 'NGN',
			drawer_account TEXT NOT NULL,
			payee_account TEXT NOT NULL,
			bank_code TEXT,
			branch_code TEXT,
			status TEXT NOT NULL DEFAULT 'pending',
			hold_transfer_id TEXT,
			dishonor_reason TEXT,
			presented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			cleared_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE (tenant_id, cheque_number, drawer_account)
		)`,
		`CREATE TABLE IF NOT EXISTS cheque_outbox (
			id BIGSERIAL PRIMARY KEY,
			cheque_id TEXT NOT NULL,
			kind TEXT NOT NULL,
			payload JSONB NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			sent_at TIMESTAMPTZ
		)`,
	} {
		if _, err := db.Exec(stmt); err != nil {
			log.Printf("schema: %v", err)
		}
	}
	log.Println("[cheque-clearing] Schema initialized")
}

func initTBClient() {
	var cfg tbclient.Config
	if addr := os.Getenv("TB_ADDRESS"); addr != "" {
		cfg.Addresses = []string{addr}
	}
	var err error
	tbClient, err = tbclient.NewClient(cfg)
	if err != nil {
		log.Printf("[cheque-clearing] TB client init failed (money-moving endpoints fail closed): %v", err)
	}
}

func returnWindowDays() int {
	if v, err := strconv.Atoi(os.Getenv("CHEQUE_RETURN_WINDOW_DAYS")); err == nil && v > 0 {
		return v
	}
	return 2
}

// placeHold creates the TB pending transfer drawer → clearing-suspense.
func placeHold(ctx context.Context, chequeID string, drawer tbclient.Uint128, amountKobo int64) (string, error) {
	suspenseHex := os.Getenv("CHEQUE_SUSPENSE_ACCOUNT_ID")
	if suspenseHex == "" {
		return "", fmt.Errorf("CHEQUE_SUSPENSE_ACCOUNT_ID is not configured")
	}
	suspense, err := parseTBAccountID(suspenseHex)
	if err != nil {
		return "", fmt.Errorf("CHEQUE_SUSPENSE_ACCOUNT_ID invalid: %w", err)
	}
	holdID := detID("chq:" + chequeID + ":hold")
	results, err := tbClient.CreateTransfers(ctx, []tbclient.Transfer{{
		ID:              holdID,
		DebitAccountID:  drawer,
		CreditAccountID: suspense,
		Amount:          tbclient.ToUint128(uint64(amountKobo)),
		Ledger:          tbLedgerNGN,
		Code:            tbCode,
		Flags:           tbclient.TransferFlags{Pending: true}.ToUint16(),
		Timeout:         uint32(returnWindowDays()) * 86400,
	}})
	if err != nil {
		return "", fmt.Errorf("tb pending transfer: %w", err)
	}
	for _, r := range results {
		if r.Status != tbclient.TransferExists { // deterministic id ⇒ retry-safe
			return "", fmt.Errorf("tb pending transfer rejected: status=%d", uint32(r.Status))
		}
	}
	return u128Hex(holdID), nil
}

// settleHold posts (clear) or voids (dishonor) the pending hold transfer.
func settleHold(ctx context.Context, chequeID, holdHex string, amountKobo int64, post bool) error {
	holdID, err := parseTBAccountID(holdHex)
	if err != nil {
		return fmt.Errorf("stored hold id invalid: %w", err)
	}
	suffix := ":void"
	flags := tbclient.TransferFlags{VoidPendingTransfer: true}
	if post {
		suffix = ":post"
		flags = tbclient.TransferFlags{PostPendingTransfer: true}
	}
	results, err := tbClient.CreateTransfers(ctx, []tbclient.Transfer{{
		ID:        detID("chq:" + chequeID + suffix),
		PendingID: holdID,
		Amount:    tbclient.ToUint128(uint64(amountKobo)),
		Ledger:    tbLedgerNGN,
		Code:      tbCode,
		Flags:     flags.ToUint16(),
	}})
	if err != nil {
		return fmt.Errorf("tb settle: %w", err)
	}
	for _, r := range results {
		if r.Status != tbclient.TransferExists {
			return fmt.Errorf("tb settle rejected: status=%d", uint32(r.Status))
		}
	}
	return nil
}

// settlePayee posts the second clearing leg suspense → payee (in-house only).
func settlePayee(ctx context.Context, chequeID string, payee tbclient.Uint128, amountKobo int64) error {
	suspense, err := parseTBAccountID(os.Getenv("CHEQUE_SUSPENSE_ACCOUNT_ID"))
	if err != nil {
		return fmt.Errorf("CHEQUE_SUSPENSE_ACCOUNT_ID invalid: %w", err)
	}
	results, err := tbClient.CreateTransfers(ctx, []tbclient.Transfer{{
		ID:              detID("chq:" + chequeID + ":settle"),
		DebitAccountID:  suspense,
		CreditAccountID: payee,
		Amount:          tbclient.ToUint128(uint64(amountKobo)),
		Ledger:          tbLedgerNGN,
		Code:            tbCode,
	}})
	if err != nil {
		return fmt.Errorf("tb settle leg: %w", err)
	}
	for _, r := range results {
		if r.Status != tbclient.TransferExists {
			return fmt.Errorf("tb settle leg rejected: status=%d", uint32(r.Status))
		}
	}
	return nil
}

// postDishonorFee posts the balanced dishonor-fee journal to gl-engine-go
// (Dr 2101 customer deposits / Cr 4201 fee income). Fail-soft: on failure a
// durable outbox row is queued for retry (cheque_outbox).
func postDishonorFee(ctx context.Context, c *Cheque) {
	fee := int64(0)
	if v, err := strconv.ParseInt(os.Getenv("CHEQUE_DISHONOR_FEE_KOBO"), 10, 64); err == nil {
		fee = v
	}
	if fee <= 0 {
		return
	}
	payload := map[string]any{
		"tenantId":       c.TenantID,
		"currency":       c.Currency,
		"transactionRef": "chq:" + c.ID + ":dishonor-fee",
		"narration":      fmt.Sprintf("Cheque %s dishonor fee (%s)", c.ChequeNumber, c.DishonorReason),
		"lines": []map[string]any{
			{"accountId": c.DrawerAccount, "glAccountCode": "2101", "type": "debit", "amount_kobo": fee, "narration": "cheque dishonor fee"},
			{"accountId": "fee-income", "glAccountCode": "4201", "type": "credit", "amount_kobo": fee, "narration": "cheque dishonor fee income"},
		},
	}
	if err := callGLJournal(ctx, payload); err != nil {
		log.Printf("[cheque-clearing] dishonor fee journal failed (queued to outbox): %v", err)
		raw, _ := json.Marshal(payload)
		if db != nil {
			if _, derr := db.ExecContext(context.Background(), `INSERT INTO cheque_outbox (cheque_id, kind, payload) VALUES ($1,'dishonor_fee_journal',$2)`, c.ID, raw); derr != nil {
				log.Printf("[cheque-clearing] outbox insert failed: %v", derr)
			}
		}
	}
}

func callGLJournal(ctx context.Context, payload map[string]any) error {
	base := strings.TrimSuffix(os.Getenv("GL_ENGINE_URL"), "/")
	if base == "" {
		return fmt.Errorf("GL_ENGINE_URL is not configured")
	}
	raw, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, base+"/v1/gl/journal", strings.NewReader(string(raw)))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if tok := os.Getenv("GL_ENGINE_TOKEN"); tok != "" {
		req.Header.Set("Authorization", "Bearer "+tok)
	}
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("gl-engine returned http_%d", resp.StatusCode)
	}
	return nil
}

// outboxWorker retries queued dishonor-fee journals (fail-soft recovery).
func outboxWorker() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		if db == nil {
			continue
		}
		rows, err := db.Query(`SELECT id, payload FROM cheque_outbox WHERE sent_at IS NULL ORDER BY id LIMIT 50`)
		if err != nil {
			continue
		}
		type item struct {
			id      int64
			payload []byte
		}
		var items []item
		for rows.Next() {
			var it item
			if rows.Scan(&it.id, &it.payload) == nil {
				items = append(items, it)
			}
		}
		rows.Close()
		for _, it := range items {
			var payload map[string]any
			if json.Unmarshal(it.payload, &payload) != nil {
				db.Exec(`UPDATE cheque_outbox SET sent_at=NOW() WHERE id=$1`, it.id) // poison: drop
				continue
			}
			ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			if err := callGLJournal(ctx, payload); err != nil {
				cancel()
				continue
			}
			cancel()
			db.Exec(`UPDATE cheque_outbox SET sent_at=NOW() WHERE id=$1`, it.id)
		}
	}
}

// returnWindowWorker auto-dishonors cheques still in 'clearing' past the
// return window (unconfirmed presentments).
func returnWindowWorker() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		if db == nil {
			continue
		}
		rows, err := db.Query(`SELECT id FROM cheques WHERE status='clearing' AND presented_at < NOW() - ($1 || ' days')::interval`, strconv.Itoa(returnWindowDays()))
		if err != nil {
			continue
		}
		var ids []string
		for rows.Next() {
			var id string
			if rows.Scan(&id) == nil {
				ids = append(ids, id)
			}
		}
		rows.Close()
		for _, id := range ids {
			log.Printf("[cheque-clearing] return window elapsed — auto-dishonoring %s", id)
			dishonorCheque(id, "return_window_elapsed")
		}
	}
}

// ── DB-backed lifecycle ──────────────────────────────────────────────────────

func listCheques(tenantID, status string, page, limit int) ([]*Cheque, int) {
	if db == nil {
		return []*Cheque{}, 0
	}
	q := `SELECT id, tenant_id, cheque_number, amount_kobo, currency, drawer_account, payee_account,
		COALESCE(bank_code,''), COALESCE(branch_code,''), status, COALESCE(hold_transfer_id,''),
		presented_at, cleared_at, COALESCE(dishonor_reason,''), created_at, updated_at FROM cheques`
	var args []any
	var where []string
	if tenantID != "" {
		args = append(args, tenantID)
		where = append(where, fmt.Sprintf("tenant_id=$%d", len(args)))
	}
	if status != "" {
		args = append(args, status)
		where = append(where, fmt.Sprintf("status=$%d", len(args)))
	}
	if len(where) > 0 {
		q += " WHERE " + strings.Join(where, " AND ")
	}
	var total int
	countQ := `SELECT COUNT(*) FROM cheques`
	if len(where) > 0 {
		countQ += " WHERE " + strings.Join(where, " AND ")
	}
	db.QueryRow(countQ, args...).Scan(&total)
	q += fmt.Sprintf(" ORDER BY created_at DESC LIMIT %d OFFSET %d", limit, (page-1)*limit)
	rows, err := db.Query(q, args...)
	if err != nil {
		return []*Cheque{}, 0
	}
	defer rows.Close()
	out := []*Cheque{}
	for rows.Next() {
		c := &Cheque{}
		if rows.Scan(&c.ID, &c.TenantID, &c.ChequeNumber, &c.AmountKobo, &c.Currency, &c.DrawerAccount,
			&c.PayeeAccount, &c.BankCode, &c.BranchCode, &c.Status, &c.HoldTransferID,
			&c.PresentedAt, &c.ClearedAt, &c.DishonorReason, &c.CreatedAt, &c.UpdatedAt) == nil {
			out = append(out, c)
		}
	}
	return out, total
}

func getCheque(id string) (*Cheque, bool) {
	if db == nil {
		return nil, false
	}
	c := &Cheque{}
	err := db.QueryRow(`SELECT id, tenant_id, cheque_number, amount_kobo, currency, drawer_account, payee_account,
		COALESCE(bank_code,''), COALESCE(branch_code,''), status, COALESCE(hold_transfer_id,''),
		presented_at, cleared_at, COALESCE(dishonor_reason,''), created_at, updated_at FROM cheques WHERE id=$1`, id).
		Scan(&c.ID, &c.TenantID, &c.ChequeNumber, &c.AmountKobo, &c.Currency, &c.DrawerAccount,
			&c.PayeeAccount, &c.BankCode, &c.BranchCode, &c.Status, &c.HoldTransferID,
			&c.PresentedAt, &c.ClearedAt, &c.DishonorReason, &c.CreatedAt, &c.UpdatedAt)
	return c, err == nil
}

// clearCheque posts the pending hold (drawer→suspense) and settles to the
// payee when in-house. Conditional UPDATE guards the state transition.
func clearCheque(id string) (*Cheque, int, string) {
	c, ok := getCheque(id)
	if !ok {
		return nil, 404, "cheque not found"
	}
	if c.Status != "clearing" && c.Status != "pending" {
		return nil, 409, "cheque is " + c.Status
	}
	if tbClient == nil {
		return nil, 503, "ledger unavailable — clearing NOT executed"
	}
	if c.HoldTransferID == "" {
		return nil, 409, "no hold placed at presentment"
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := settleHold(ctx, c.ID, c.HoldTransferID, c.AmountKobo, true); err != nil {
		return nil, 502, "failed to post hold: " + err.Error()
	}
	settleNote := "suspense"
	if payee, err := parseTBAccountID(c.PayeeAccount); err == nil {
		if err := settlePayee(ctx, c.ID, payee, c.AmountKobo); err != nil {
			return nil, 502, "hold posted but payee settle failed — funds remain in suspense: " + err.Error()
		}
		settleNote = "payee"
	} else {
		// Interbank payee: funds stay in clearing suspense for
		// settlement-clearing-go to sweep (documented handoff).
		settleNote = "suspense_interbank"
	}
	res, err := db.Exec(`UPDATE cheques SET status='cleared', cleared_at=NOW(), updated_at=NOW() WHERE id=$1 AND status IN ('pending','clearing')`, id)
	if err != nil {
		return nil, 500, "db error"
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return nil, 409, "cheque state changed concurrently"
	}
	c, _ = getCheque(id)
	log.Printf("[cheque-clearing] cleared %s (settled to %s)", id, settleNote)
	return c, 200, ""
}

// dishonorCheque voids the hold and posts the dishonor-fee journal (fail-soft
// via outbox). Used by the /dishonor route and the return-window job.
func dishonorCheque(id, reason string) (*Cheque, int, string) {
	c, ok := getCheque(id)
	if !ok {
		return nil, 404, "cheque not found"
	}
	if c.Status != "clearing" && c.Status != "pending" {
		return nil, 409, "cheque is " + c.Status
	}
	if c.HoldTransferID != "" {
		if tbClient == nil {
			return nil, 503, "ledger unavailable — hold NOT voided"
		}
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		if err := settleHold(ctx, c.ID, c.HoldTransferID, c.AmountKobo, false); err != nil {
			return nil, 502, "failed to void hold: " + err.Error()
		}
	}
	res, err := db.Exec(`UPDATE cheques SET status='dishonored', dishonor_reason=$2, updated_at=NOW() WHERE id=$1 AND status IN ('pending','clearing')`, id, reason)
	if err != nil {
		return nil, 500, "db error"
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return nil, 409, "cheque state changed concurrently"
	}
	c, _ = getCheque(id)
	postDishonorFee(context.Background(), c)
	return c, 200, ""
}

// ── Handlers ─────────────────────────────────────────────────────────────────

func handleList(w http.ResponseWriter, r *http.Request) {
	if db == nil {
		jsonErr(w, "store unavailable", http.StatusServiceUnavailable)
		return
	}
	tenantID := r.URL.Query().Get("tenantId")
	if tenantID == "" {
		tenantID = r.URL.Query().Get("tenant_id")
	}
	status := r.URL.Query().Get("status")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 || limit > 100 {
		limit = 20
	}
	items, total := listCheques(tenantID, status, page, limit)
	jsonOK(w, map[string]any{"items": items, "total": total, "page": page, "limit": limit})
}

func handleSubmit(w http.ResponseWriter, r *http.Request) {
	if db == nil || tbClient == nil {
		jsonErr(w, "store or ledger unavailable — presentment NOT accepted", http.StatusServiceUnavailable)
		return
	}
	tenantID := r.Header.Get("x-tenant-id")
	if tenantID == "" {
		tenantID = r.URL.Query().Get("tenantId")
	}
	if tenantID == "" {
		jsonErr(w, "x-tenant-id header required", http.StatusBadRequest)
		return
	}
	var req struct {
		ChequeNumber  string  `json:"cheque_number"`
		AmountKobo    int64   `json:"amount_kobo"`
		Amount        float64 `json:"amount"` // DEPRECATED (NGN float) — converted ROUND_HALF_UP
		Currency      string  `json:"currency"`
		DrawerAccount string  `json:"drawer_account"` // TB account id (hex)
		PayeeAccount  string  `json:"payee_account"`
		BankCode      string  `json:"bank_code"`
		BranchCode    string  `json:"branch_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "invalid request body", http.StatusBadRequest)
		return
	}
	amountKobo := req.AmountKobo
	if amountKobo <= 0 && req.Amount > 0 {
		amountKobo = ngnToKoboHalfUp(req.Amount)
		log.Printf("[cheque-clearing] DEPRECATED float amount %.2f NGN converted to %d kobo (ROUND_HALF_UP)", req.Amount, amountKobo)
	}
	if req.ChequeNumber == "" || amountKobo <= 0 || req.DrawerAccount == "" || req.PayeeAccount == "" {
		jsonErr(w, "cheque_number, amount_kobo, drawer_account and payee_account are required", http.StatusBadRequest)
		return
	}
	if req.Currency == "" {
		req.Currency = "NGN"
	}
	drawer, err := parseTBAccountID(req.DrawerAccount)
	if err != nil {
		jsonErr(w, "drawer_account must be a TB account id (hex): "+err.Error(), http.StatusBadRequest)
		return
	}
	// Fail-closed: the drawer account must really exist in TB.
	if accts, err := tbClient.LookupAccounts(r.Context(), []tbclient.Uint128{drawer}); err != nil || len(accts) == 0 {
		jsonErr(w, "drawer TB account not found", 422)
		return
	}

	// Idempotent presentment: same (tenant, cheque_number, drawer) returns the
	// existing record instead of double-placing the hold.
	if existing, found := findChequeByNumber(tenantID, req.ChequeNumber, req.DrawerAccount); found {
		w.WriteHeader(http.StatusOK)
		jsonOK(w, existing)
		return
	}

	c := &Cheque{
		ID: newID(), TenantID: tenantID, ChequeNumber: req.ChequeNumber,
		AmountKobo: amountKobo, Currency: req.Currency,
		DrawerAccount: req.DrawerAccount, PayeeAccount: req.PayeeAccount,
		BankCode: req.BankCode, BranchCode: req.BranchCode,
		Status: "pending", PresentedAt: time.Now(),
	}

	// MN-21: REAL hold on presentment — TB pending transfer drawer→suspense.
	holdHex, err := placeHold(r.Context(), c.ID, drawer, amountKobo)
	if err != nil {
		jsonErr(w, "failed to place hold — presentment NOT accepted: "+err.Error(), 502)
		return
	}
	c.HoldTransferID = holdHex
	c.Status = "clearing"

	if _, err := db.Exec(`INSERT INTO cheques (id, tenant_id, cheque_number, amount_kobo, currency, drawer_account, payee_account, bank_code, branch_code, status, hold_transfer_id, presented_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		c.ID, c.TenantID, c.ChequeNumber, c.AmountKobo, c.Currency, c.DrawerAccount, c.PayeeAccount,
		c.BankCode, c.BranchCode, c.Status, c.HoldTransferID, c.PresentedAt); err != nil {
		jsonErr(w, "db error: "+err.Error(), 500)
		return
	}
	w.WriteHeader(http.StatusCreated)
	if saved, ok := getCheque(c.ID); ok {
		jsonOK(w, saved)
		return
	}
	jsonOK(w, c)
}

func findChequeByNumber(tenantID, number, drawer string) (*Cheque, bool) {
	if db == nil {
		return nil, false
	}
	var id string
	err := db.QueryRow(`SELECT id FROM cheques WHERE tenant_id=$1 AND cheque_number=$2 AND drawer_account=$3`, tenantID, number, drawer).Scan(&id)
	if err != nil {
		return nil, false
	}
	return getCheque(id)
}

// ── Router ───────────────────────────────────────────────────────────────────

func route(w http.ResponseWriter, r *http.Request) {
	p := r.URL.Path
	m := r.Method

	// R3-NEW-6: no wildcard origin — echo the request Origin only when it is
	// on the CORS_ALLOWED_ORIGINS allowlist (comma-separated; restrictive default).
	allowedOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
	if allowedOrigins == "" {
		allowedOrigins = "https://dashboard.54bank.ng"
	}
	origin := r.Header.Get("Origin")
	for _, allowed := range strings.Split(allowedOrigins, ",") {
		if strings.TrimSpace(allowed) == origin && origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			break
		}
	}
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "*")
	if m == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	switch {
	case p == "/healthz" || p == "/health" || p == "/livez" || p == "/readyz":
		jsonOK(w, map[string]string{"status": "ok", "service": "cheque-clearing-go"})

	case p == "/api/v1/cheques" && m == http.MethodGet:
		handleList(w, r)

	case p == "/api/v1/cheques" && m == http.MethodPost:
		handleSubmit(w, r)

	case p == "/api/v1/cheques/stats" && m == http.MethodGet:
		if db == nil {
			jsonErr(w, "store unavailable", http.StatusServiceUnavailable)
			return
		}
		tenantID := r.URL.Query().Get("tenantId")
		jsonOK(w, chequeStats(tenantID))

	case strings.HasPrefix(p, "/api/v1/cheques/") && strings.HasSuffix(p, "/approve"):
		id := strings.TrimSuffix(strings.TrimPrefix(p, "/api/v1/cheques/"), "/approve")
		c, code, msg := clearCheque(id)
		if code != 200 {
			jsonErr(w, msg, code)
			return
		}
		jsonOK(w, c)

	case strings.HasPrefix(p, "/api/v1/cheques/") && strings.HasSuffix(p, "/dishonor"):
		id := strings.TrimSuffix(strings.TrimPrefix(p, "/api/v1/cheques/"), "/dishonor")
		var body struct {
			Reason string `json:"reason"`
		}
		json.NewDecoder(r.Body).Decode(&body)
		reason := body.Reason
		if reason == "" {
			reason = "insufficient funds"
		}
		c, code, msg := dishonorCheque(id, reason)
		if code != 200 {
			jsonErr(w, msg, code)
			return
		}
		jsonOK(w, c)

	case strings.HasPrefix(p, "/api/v1/cheques/") && m == http.MethodGet:
		id := strings.TrimPrefix(p, "/api/v1/cheques/")
		c, ok := getCheque(id)
		if !ok {
			jsonErr(w, "cheque not found", http.StatusNotFound)
			return
		}
		jsonOK(w, c)

	default:
		jsonErr(w, fmt.Sprintf("not found: %s %s", m, p), http.StatusNotFound)
	}
}

// chequeStats aggregates from Postgres in integer kobo (float64 deleted).
func chequeStats(tenantID string) map[string]any {
	counts := map[string]int{"pending": 0, "clearing": 0, "cleared": 0, "dishonored": 0, "returned": 0}
	var totalAmount int64
	q := `SELECT status, COUNT(*), COALESCE(SUM(amount_kobo),0) FROM cheques`
	var args []any
	if tenantID != "" {
		q += ` WHERE tenant_id=$1`
		args = append(args, tenantID)
	}
	q += ` GROUP BY status`
	rows, err := db.Query(q, args...)
	if err != nil {
		return map[string]any{"error": "db error"}
	}
	defer rows.Close()
	total := 0
	for rows.Next() {
		var st string
		var n int
		var sum int64
		if rows.Scan(&st, &n, &sum) == nil {
			counts[st] = n
			total += n
			totalAmount += sum
		}
	}
	return map[string]any{"total": total, "total_amount_kobo": totalAmount, "by_status": counts}
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
			fmt.Fprintf(w, `{"error":"unauthorized","service":%q}}`, "cheque-clearing-go")
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		parts := strings.Split(token, ".")
		if len(parts) != 3 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(401)
			fmt.Fprintf(w, `{"error":"malformed token","service":%q}}`, "cheque-clearing-go")
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
	startJWKSRefresh()
	initDB()
	initTBClient()
	// MN-21: durable outbox retry + return-window auto-dishonor.
	go outboxWorker()
	go returnWindowWorker()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	http.HandleFunc("/", route)
	log.Printf("cheque-clearing-go listening on :%s", port)
	if err := http.ListenAndServe(":"+port, jwtAuthMiddleware(http.DefaultServeMux)); err != nil {
		log.Fatal(err)
	}
}
