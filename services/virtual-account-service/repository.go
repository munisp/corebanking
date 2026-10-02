package main

// W12-C3-P2-B2 (GO-SVC-FIELD-MAPS): PostgreSQL repository layer for the
// virtual-account domain. The VirtualAccountService in-memory maps
// (accounts / accountsByID / payments / allocations, main.go:129-132) were
// removed; all state is served from these tables.
//
// Money-correctness note: balances are NOT held here. TigerBeetle remains
// the balance-of-record (tigerbeetle_integration.go — "VAN is a routing
// alias, not a balance holder"; escrow VANs get TB holding accounts).
// VirtualAccount.TotalReceived/PaymentCount are lifetime receipt counters
// reconciled against TigerBeetle via ReconcileVANBalance; they are updated
// in the same PG transaction that records the payment, after the
// (idempotent) TigerBeetle transfer succeeds.

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

// errVanNotFound mirrors the legacy "VAN not found" sentinel behaviour.
var errVanNotFound = errors.New("van not found")

// vanDomainDDL creates the domain tables (idempotent, boot-time).
var vanDomainDDL = []string{
	`CREATE TABLE IF NOT EXISTS virtual_accounts (
		id TEXT PRIMARY KEY,
		van TEXT NOT NULL,
		bank_id TEXT NOT NULL,
		customer_id TEXT,
		reference_type TEXT,
		reference_id TEXT,
		status TEXT NOT NULL DEFAULT 'active',
		payload JSONB NOT NULL,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`,
	// Natural-key idempotency: a VAN is globally unique (NUBAN number).
	`CREATE UNIQUE INDEX IF NOT EXISTS uq_virtual_accounts_van ON virtual_accounts(van)`,
	`CREATE INDEX IF NOT EXISTS idx_virtual_accounts_bank ON virtual_accounts(bank_id)`,
	`CREATE INDEX IF NOT EXISTS idx_virtual_accounts_customer ON virtual_accounts(bank_id, customer_id)`,
	`CREATE INDEX IF NOT EXISTS idx_virtual_accounts_reference ON virtual_accounts(bank_id, reference_type, reference_id)`,
	`CREATE TABLE IF NOT EXISTS van_payments (
		id TEXT PRIMARY KEY,
		van TEXT NOT NULL,
		van_id TEXT,
		bank_id TEXT NOT NULL,
		session_id TEXT,
		transaction_ref TEXT,
		status TEXT NOT NULL,
		payload JSONB NOT NULL,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`,
	`CREATE INDEX IF NOT EXISTS idx_van_payments_van ON van_payments(van)`,
	`CREATE INDEX IF NOT EXISTS idx_van_payments_bank ON van_payments(bank_id)`,
	// Storage-level replay guards (natural keys) complementing
	// processed_inbound_payments dedup.
	`CREATE UNIQUE INDEX IF NOT EXISTS uq_van_payments_session ON van_payments(session_id) WHERE session_id IS NOT NULL AND session_id <> ''`,
	`CREATE UNIQUE INDEX IF NOT EXISTS uq_van_payments_txref ON van_payments(transaction_ref) WHERE transaction_ref IS NOT NULL AND transaction_ref <> ''`,
	// Register item main.go:132 (allocations map): the map was never read or
	// written outside the constructor (dead store) — removed. Table
	// provisioned per register target postgres:van_allocations.
	`CREATE TABLE IF NOT EXISTS van_allocations (
		id TEXT PRIMARY KEY,
		bank_id TEXT NOT NULL,
		prefix TEXT,
		payload JSONB NOT NULL,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	)`,
}

// initVanDomainStore applies the domain DDL on the shared handle.
func initVanDomainStore(db *sql.DB) error {
	for _, stmt := range vanDomainDDL {
		if _, err := db.Exec(stmt); err != nil {
			return fmt.Errorf("van domain DDL failed: %w\n%s", err, stmt)
		}
	}
	return nil
}

func vanCtx() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), 15*time.Second)
}

// errVanStoreUnavailable is returned when DATABASE_URL is unset/unreachable.
var errVanStoreUnavailable = errors.New("van store unavailable (DATABASE_URL not configured)")

// saveAccount upserts a virtual account row (idempotent on id and van).
func saveAccount(ctx context.Context, db *sql.DB, a *VirtualAccount) error {
	if db == nil {
		return errVanStoreUnavailable
	}
	payload, err := json.Marshal(a)
	if err != nil {
		return err
	}
	_, err = db.ExecContext(ctx, `INSERT INTO virtual_accounts
		(id, van, bank_id, customer_id, reference_type, reference_id, status, payload, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
		ON CONFLICT (id) DO UPDATE SET
			status = EXCLUDED.status, payload = EXCLUDED.payload, updated_at = NOW()`,
		a.ID, a.VAN, a.BankID, a.CustomerID, a.ReferenceType, a.ReferenceID, a.Status, payload)
	return err
}

func scanAccount(payload []byte) (*VirtualAccount, error) {
	var a VirtualAccount
	if err := json.Unmarshal(payload, &a); err != nil {
		return nil, err
	}
	return &a, nil
}

func getAccountByVAN(ctx context.Context, db *sql.DB, van string) (*VirtualAccount, error) {
	if db == nil {
		return nil, errVanStoreUnavailable
	}
	var payload []byte
	err := db.QueryRowContext(ctx, `SELECT payload FROM virtual_accounts WHERE van = $1`, van).Scan(&payload)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, errVanNotFound
	}
	if err != nil {
		return nil, err
	}
	return scanAccount(payload)
}

func getAccountByID(ctx context.Context, db *sql.DB, id string) (*VirtualAccount, error) {
	if db == nil {
		return nil, errVanStoreUnavailable
	}
	var payload []byte
	err := db.QueryRowContext(ctx, `SELECT payload FROM virtual_accounts WHERE id = $1`, id).Scan(&payload)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, errVanNotFound
	}
	if err != nil {
		return nil, err
	}
	return scanAccount(payload)
}

// listAccounts returns accounts for a bank (bankID empty = all banks,
// preserving the legacy SearchVANs behaviour).
func listAccounts(ctx context.Context, db *sql.DB, bankID string) ([]*VirtualAccount, error) {
	if db == nil {
		return nil, errVanStoreUnavailable
	}
	query := `SELECT payload FROM virtual_accounts`
	args := []interface{}{}
	if bankID != "" {
		query += ` WHERE bank_id = $1`
		args = append(args, bankID)
	}
	query += ` ORDER BY created_at`
	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*VirtualAccount
	for rows.Next() {
		var payload []byte
		if err := rows.Scan(&payload); err != nil {
			return nil, err
		}
		a, err := scanAccount(payload)
		if err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// insertPayment records a payment (idempotent on id; natural-key unique
// indexes on session_id / transaction_ref guard replays).
func insertPayment(ctx context.Context, db *sql.DB, p *VANPayment) error {
	if db == nil {
		return errVanStoreUnavailable
	}
	payload, err := json.Marshal(p)
	if err != nil {
		return err
	}
	_, err = db.ExecContext(ctx, `INSERT INTO van_payments
		(id, van, van_id, bank_id, session_id, transaction_ref, status, payload)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, payload = EXCLUDED.payload`,
		p.ID, p.VAN, p.VANID, p.BankID, p.SessionID, p.TransactionRef, p.Status, payload)
	return err
}

// updatePaymentFields persists post-hoc payment mutations (webhook result).
func updatePayment(ctx context.Context, db *sql.DB, p *VANPayment) error {
	return insertPayment(ctx, db, p) // upsert semantics
}

func listPaymentsByVAN(ctx context.Context, db *sql.DB, van string, limit int) ([]*VANPayment, error) {
	if db == nil {
		return nil, errVanStoreUnavailable
	}
	query := `SELECT payload FROM van_payments WHERE van = $1 ORDER BY created_at`
	args := []interface{}{van}
	if limit > 0 {
		query += ` LIMIT $2`
		args = append(args, limit)
	}
	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*VANPayment
	for rows.Next() {
		var payload []byte
		if err := rows.Scan(&payload); err != nil {
			return nil, err
		}
		var p VANPayment
		if err := json.Unmarshal(payload, &p); err != nil {
			return nil, err
		}
		out = append(out, &p)
	}
	return out, rows.Err()
}

// recordPaymentTx atomically (one tx): locks the account row, applies fn to
// the account (counter updates / single-use close), and inserts the payment.
// Runs AFTER the idempotent TigerBeetle transfer — same ordering as the
// legacy in-memory mutations.
func recordPaymentTx(ctx context.Context, db *sql.DB, payment *VANPayment, fn func(a *VirtualAccount)) error {
	if db == nil {
		return errVanStoreUnavailable
	}
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var payload []byte
	err = tx.QueryRowContext(ctx, `SELECT payload FROM virtual_accounts WHERE van = $1 FOR UPDATE`, payment.VAN).Scan(&payload)
	if errors.Is(err, sql.ErrNoRows) {
		return errVanNotFound
	}
	if err != nil {
		return err
	}
	account, err := scanAccount(payload)
	if err != nil {
		return err
	}
	fn(account)

	accPayload, err := json.Marshal(account)
	if err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE virtual_accounts SET status=$2, payload=$3, updated_at=NOW() WHERE id=$1`,
		account.ID, account.Status, accPayload); err != nil {
		return err
	}

	payPayload, err := json.Marshal(payment)
	if err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO van_payments
		(id, van, van_id, bank_id, session_id, transaction_ref, status, payload)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, payload = EXCLUDED.payload`,
		payment.ID, payment.VAN, payment.VANID, payment.BankID, payment.SessionID, payment.TransactionRef, payment.Status, payPayload); err != nil {
		return err
	}
	return tx.Commit()
}

// updateAccountStatusTx sets a VAN status transactionally (SELECT FOR UPDATE).
func updateAccountStatusTx(ctx context.Context, db *sql.DB, van, status string) (*VirtualAccount, error) {
	if db == nil {
		return nil, errVanStoreUnavailable
	}
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	var payload []byte
	err = tx.QueryRowContext(ctx, `SELECT payload FROM virtual_accounts WHERE van = $1 FOR UPDATE`, van).Scan(&payload)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, errVanNotFound
	}
	if err != nil {
		return nil, err
	}
	account, err := scanAccount(payload)
	if err != nil {
		return nil, err
	}
	account.Status = status
	account.UpdatedAt = time.Now()
	newPayload, err := json.Marshal(account)
	if err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE virtual_accounts SET status=$2, payload=$3, updated_at=NOW() WHERE id=$1`,
		account.ID, status, newPayload); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return account, nil
}
