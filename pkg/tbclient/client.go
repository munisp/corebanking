// Package tbclient provides a production-ready TigerBeetle client for 54Bank.
// Uses the official tigerbeetle-go SDK to connect to a real TigerBeetle cluster.
// Optionally maintains a PostgreSQL audit trail for compliance/reporting.
package tbclient

import (
	"context"
	"database/sql"
	"encoding/binary"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
	"time"

	tb "github.com/tigerbeetle/tigerbeetle-go"
	_ "github.com/lib/pq"
)

// Re-export SDK types so downstream services import only this package.
type (
	Account              = tb.Account
	Transfer             = tb.Transfer
	Uint128              = tb.Uint128
	AccountFlags         = tb.AccountFlags
	TransferFlags        = tb.TransferFlags
	CreateAccountResult  = tb.CreateAccountResult
	CreateTransferResult = tb.CreateTransferResult
)

// Re-export SDK functions.
var (
	ToUint128      = tb.ToUint128
	BytesToUint128 = tb.BytesToUint128
)

// Re-export SDK status constants.
var (
	AccountCreated  = tb.AccountCreated
	AccountExists   = tb.AccountExists
	TransferCreated = tb.TransferCreated
	TransferExists  = tb.TransferExists
)

// ID generates a TigerBeetle time-based unique identifier.
func ID() Uint128 {
	return tb.ID()
}

// Uint128FromU64 constructs a Uint128 from low and high 64-bit halves (little-endian).
func Uint128FromU64(lo, hi uint64) Uint128 {
	var buf [16]byte
	binary.LittleEndian.PutUint64(buf[:8], lo)
	binary.LittleEndian.PutUint64(buf[8:], hi)
	return BytesToUint128(buf)
}

// Uint128Low returns the lower 64 bits of a Uint128 value.
func Uint128Low(v Uint128) uint64 {
	lo, _ := v.Uint64()
	return lo
}

// Client wraps the official TigerBeetle client with optional PostgreSQL audit trail.
type Client struct {
	tb      tb.Client
	auditDB *sql.DB
	mu      sync.RWMutex
	closed  bool
}

// Config holds client configuration.
type Config struct {
	// ClusterID is the TigerBeetle cluster identifier (default: 0).
	ClusterID uint64

	// Addresses is the list of TigerBeetle replica addresses.
	// Format: "3000" or "127.0.0.1:3000".
	// Falls back to TB_ADDRESS or TIGERBEETLE_ADDRESSES env vars.
	Addresses []string

	// AuditDatabaseURL is an optional PostgreSQL connection string for audit trail.
	// If empty, checks TIGERBEETLE_AUDIT_DB_URL env var. If still empty, no audit.
	AuditDatabaseURL string
}

// NewClient creates a production TigerBeetle client connected to a real cluster.
// Returns an error if no addresses are configured or if the connection fails.
func NewClient(cfg Config) (*Client, error) {
	addresses := cfg.Addresses
	if len(addresses) == 0 {
		if env := os.Getenv("TB_ADDRESS"); env != "" {
			addresses = strings.Split(env, ",")
		} else if env := os.Getenv("TIGERBEETLE_ADDRESSES"); env != "" {
			addresses = strings.Split(env, ",")
		}
	}

	if len(addresses) == 0 {
		return nil, fmt.Errorf("tbclient: no TigerBeetle addresses configured — set TB_ADDRESS or TIGERBEETLE_ADDRESSES env var, or pass Config.Addresses")
	}

	for i := range addresses {
		addresses[i] = strings.TrimSpace(addresses[i])
	}

	clusterID := tb.ToUint128(cfg.ClusterID)

	log.Printf("[tbclient] connecting to TigerBeetle cluster %d at %v", cfg.ClusterID, addresses)

	tbClient, err := tb.NewClient(clusterID, addresses)
	if err != nil {
		return nil, fmt.Errorf("tbclient: failed to connect to TigerBeetle cluster: %w", err)
	}

	log.Printf("[tbclient] connected to TigerBeetle cluster %d (%d replicas)", cfg.ClusterID, len(addresses))

	c := &Client{tb: tbClient}

	// Optional audit trail
	auditDSN := cfg.AuditDatabaseURL
	if auditDSN == "" {
		auditDSN = os.Getenv("TIGERBEETLE_AUDIT_DB_URL")
	}
	if auditDSN != "" {
		auditDB, err := sql.Open("postgres", auditDSN)
		if err != nil {
			log.Printf("[tbclient] WARNING: audit DB connection failed (non-fatal): %v", err)
		} else {
			auditDB.SetMaxOpenConns(10)
			auditDB.SetMaxIdleConns(3)
			auditDB.SetConnMaxLifetime(5 * time.Minute)
			if err := auditDB.Ping(); err != nil {
				log.Printf("[tbclient] WARNING: audit DB ping failed (non-fatal): %v", err)
				auditDB.Close()
			} else {
				c.auditDB = auditDB
				if err := c.initAuditSchema(); err != nil {
					log.Printf("[tbclient] WARNING: audit schema init failed (non-fatal): %v", err)
				} else {
					log.Printf("[tbclient] audit trail enabled (PostgreSQL)")
				}
			}
		}
	}

	return c, nil
}

func (c *Client) initAuditSchema() error {
	if c.auditDB == nil {
		return nil
	}
	schema := `
	CREATE TABLE IF NOT EXISTS tb_audit_accounts (
		id BYTEA PRIMARY KEY,
		ledger INT NOT NULL,
		code SMALLINT NOT NULL,
		flags SMALLINT NOT NULL DEFAULT 0,
		user_data_128 BYTEA,
		user_data_64 BIGINT DEFAULT 0,
		user_data_32 INT DEFAULT 0,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);
	CREATE TABLE IF NOT EXISTS tb_audit_transfers (
		id BYTEA PRIMARY KEY,
		debit_account_id BYTEA NOT NULL,
		credit_account_id BYTEA NOT NULL,
		amount BYTEA NOT NULL,
		pending_id BYTEA,
		user_data_128 BYTEA,
		user_data_64 BIGINT DEFAULT 0,
		user_data_32 INT DEFAULT 0,
		timeout INT DEFAULT 0,
		ledger INT NOT NULL,
		code SMALLINT NOT NULL,
		flags SMALLINT NOT NULL DEFAULT 0,
		timestamp BIGINT NOT NULL DEFAULT 0,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);
	CREATE INDEX IF NOT EXISTS idx_tb_audit_transfers_debit ON tb_audit_transfers(debit_account_id);
	CREATE INDEX IF NOT EXISTS idx_tb_audit_transfers_credit ON tb_audit_transfers(credit_account_id);`
	_, err := c.auditDB.Exec(schema)
	return err
}

// CreateAccounts creates accounts in the TigerBeetle cluster.
// ctx is accepted for interface compatibility but TB operations are not cancellable.
func (c *Client) CreateAccounts(_ context.Context, accounts []Account) ([]CreateAccountResult, error) {
	c.mu.RLock()
	if c.closed {
		c.mu.RUnlock()
		return nil, fmt.Errorf("tbclient: client closed")
	}
	c.mu.RUnlock()

	results, err := c.tb.CreateAccounts(accounts)
	if err != nil {
		return nil, fmt.Errorf("tbclient: create accounts: %w", err)
	}

	if c.auditDB != nil {
		go c.auditCreateAccounts(accounts, results)
	}

	return results, nil
}

func (c *Client) auditCreateAccounts(accounts []Account, results []CreateAccountResult) {
	failed := make(map[int]bool)
	for i, r := range results {
		if r.Status != tb.AccountCreated && r.Status != tb.AccountExists {
			failed[i] = true
		}
	}
	for i, acct := range accounts {
		if failed[i] {
			continue
		}
		idBytes := acct.ID.Bytes()
		udBytes := acct.UserData128.Bytes()
		_, err := c.auditDB.Exec(
			`INSERT INTO tb_audit_accounts (id, ledger, code, flags, user_data_128, user_data_64, user_data_32)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)
			 ON CONFLICT (id) DO NOTHING`,
			idBytes[:], acct.Ledger, acct.Code, acct.Flags,
			udBytes[:], acct.UserData64, acct.UserData32,
		)
		if err != nil {
			log.Printf("[tbclient] audit: failed to record account: %v", err)
		}
	}
}

// CreateTransfers creates transfers (journal entries) in the TigerBeetle cluster.
func (c *Client) CreateTransfers(_ context.Context, transfers []Transfer) ([]CreateTransferResult, error) {
	c.mu.RLock()
	if c.closed {
		c.mu.RUnlock()
		return nil, fmt.Errorf("tbclient: client closed")
	}
	c.mu.RUnlock()

	results, err := c.tb.CreateTransfers(transfers)
	if err != nil {
		return nil, fmt.Errorf("tbclient: create transfers: %w", err)
	}

	if c.auditDB != nil {
		go c.auditCreateTransfers(transfers, results)
	}

	return results, nil
}

func (c *Client) auditCreateTransfers(transfers []Transfer, results []CreateTransferResult) {
	failed := make(map[int]bool)
	for i, r := range results {
		if r.Status != tb.TransferCreated && r.Status != tb.TransferExists {
			failed[i] = true
		}
	}
	for i, xfer := range transfers {
		if failed[i] {
			continue
		}
		idBytes := xfer.ID.Bytes()
		debitBytes := xfer.DebitAccountID.Bytes()
		creditBytes := xfer.CreditAccountID.Bytes()
		amountBytes := xfer.Amount.Bytes()
		udBytes := xfer.UserData128.Bytes()
		var pendingID interface{}
		if xfer.PendingID != tb.ToUint128(0) {
			pidBytes := xfer.PendingID.Bytes()
			pendingID = pidBytes[:]
		}
		_, err := c.auditDB.Exec(
			`INSERT INTO tb_audit_transfers (id, debit_account_id, credit_account_id, amount, pending_id, user_data_128, user_data_64, user_data_32, timeout, ledger, code, flags, timestamp)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
			 ON CONFLICT (id) DO NOTHING`,
			idBytes[:], debitBytes[:], creditBytes[:], amountBytes[:],
			pendingID, udBytes[:], xfer.UserData64, xfer.UserData32,
			xfer.Timeout, xfer.Ledger, xfer.Code, xfer.Flags, xfer.Timestamp,
		)
		if err != nil {
			log.Printf("[tbclient] audit: failed to record transfer: %v", err)
		}
	}
}

// LookupAccounts fetches accounts by their IDs from the TigerBeetle cluster.
func (c *Client) LookupAccounts(_ context.Context, ids []Uint128) ([]Account, error) {
	c.mu.RLock()
	if c.closed {
		c.mu.RUnlock()
		return nil, fmt.Errorf("tbclient: client closed")
	}
	c.mu.RUnlock()

	accounts, err := c.tb.LookupAccounts(ids)
	if err != nil {
		return nil, fmt.Errorf("tbclient: lookup accounts: %w", err)
	}
	return accounts, nil
}

// LookupTransfers fetches transfers by their IDs from the TigerBeetle cluster.
func (c *Client) LookupTransfers(_ context.Context, ids []Uint128) ([]Transfer, error) {
	c.mu.RLock()
	if c.closed {
		c.mu.RUnlock()
		return nil, fmt.Errorf("tbclient: client closed")
	}
	c.mu.RUnlock()

	transfers, err := c.tb.LookupTransfers(ids)
	if err != nil {
		return nil, fmt.Errorf("tbclient: lookup transfers: %w", err)
	}
	return transfers, nil
}

// BalanceInfo provides detailed balance information for an account.
// All amounts are in the lowest denomination (e.g., kobo for NGN).
type BalanceInfo struct {
	DebitsPending  uint64
	DebitsPosted   uint64
	CreditsPending uint64
	CreditsPosted  uint64
	NetBalance     int64 // CreditsPosted - DebitsPosted (lower 64 bits)
}

// GetAccountBalance returns the net balance (credits_posted - debits_posted) for an account.
// Returns the lower 64 bits which is sufficient for banking amounts.
func (c *Client) GetAccountBalance(ctx context.Context, id Uint128) (int64, error) {
	accounts, err := c.LookupAccounts(ctx, []Uint128{id})
	if err != nil {
		return 0, err
	}
	if len(accounts) == 0 {
		return 0, fmt.Errorf("tbclient: account not found")
	}
	acct := accounts[0]
	credits := Uint128Low(acct.CreditsPosted)
	debits := Uint128Low(acct.DebitsPosted)
	return int64(credits) - int64(debits), nil
}

// GetAccountBalanceFull returns detailed balance info for an account.
func (c *Client) GetAccountBalanceFull(ctx context.Context, id Uint128) (*BalanceInfo, error) {
	accounts, err := c.LookupAccounts(ctx, []Uint128{id})
	if err != nil {
		return nil, err
	}
	if len(accounts) == 0 {
		return nil, fmt.Errorf("tbclient: account not found")
	}
	acct := accounts[0]
	return &BalanceInfo{
		DebitsPending:  Uint128Low(acct.DebitsPending),
		DebitsPosted:   Uint128Low(acct.DebitsPosted),
		CreditsPending: Uint128Low(acct.CreditsPending),
		CreditsPosted:  Uint128Low(acct.CreditsPosted),
		NetBalance:     int64(Uint128Low(acct.CreditsPosted)) - int64(Uint128Low(acct.DebitsPosted)),
	}, nil
}

// Close closes the TigerBeetle client connection and audit DB.
func (c *Client) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.closed {
		return nil
	}
	c.closed = true
	c.tb.Close()
	if c.auditDB != nil {
		return c.auditDB.Close()
	}
	return nil
}
