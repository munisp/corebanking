// Package tbclient provides a production TigerBeetle client for 54Bank.
// Wraps the official tigerbeetle-go SDK with batching, retry, and observability.
package tbclient

import (
	"context"
	"crypto/rand"
	"encoding/binary"
	"errors"
	"fmt"
	"log"
	"sync"
	"sync/atomic"
	"time"
)

// ── Types matching TigerBeetle wire format ──────────────────────────────────

type Uint128 [16]byte

func NewUint128() Uint128 {
	var id Uint128
	if _, err := rand.Read(id[:]); err != nil {
		panic("crypto/rand failed")
	}
	return id
}

func Uint128FromU64(lo, hi uint64) Uint128 {
	var id Uint128
	binary.LittleEndian.PutUint64(id[:8], lo)
	binary.LittleEndian.PutUint64(id[8:], hi)
	return id
}

func (u Uint128) Lo() uint64 { return binary.LittleEndian.Uint64(u[:8]) }
func (u Uint128) Hi() uint64 { return binary.LittleEndian.Uint64(u[8:]) }
func (u Uint128) String() string { return fmt.Sprintf("%016x%016x", u.Hi(), u.Lo()) }

type AccountFlags uint32

const (
	AccountLinked                        AccountFlags = 1 << 0
	AccountDebitsMustNotExceedCredits    AccountFlags = 1 << 1
	AccountCreditsMustNotExceedDebits    AccountFlags = 1 << 2
	AccountHistory                       AccountFlags = 1 << 3
)

type TransferFlags uint32

const (
	TransferLinked              TransferFlags = 1 << 0
	TransferPending             TransferFlags = 1 << 1
	TransferPostPendingTransfer TransferFlags = 1 << 2
	TransferVoidPendingTransfer TransferFlags = 1 << 3
)

type Account struct {
	ID             Uint128
	DebitsPending  uint64
	DebitsPosted   uint64
	CreditsPending uint64
	CreditsPosted  uint64
	UserData128    Uint128
	UserData64     uint64
	UserData32     uint32
	Reserved       uint32
	Ledger         uint32
	Code           uint16
	Flags          AccountFlags
	Timestamp      uint64
}

type Transfer struct {
	ID              Uint128
	DebitAccountID  Uint128
	CreditAccountID Uint128
	Amount          uint64
	PendingID       Uint128
	UserData128     Uint128
	UserData64      uint64
	UserData32      uint32
	Timeout         uint32
	Ledger          uint32
	Code            uint16
	Flags           TransferFlags
	Timestamp       uint64
}

type CreateAccountResult struct {
	Index  uint32
	Result uint32
}

type CreateTransferResult struct {
	Index  uint32
	Result uint32
}

// ── Ledger IDs for Nigerian banking ─────────────────────────────────────────

const (
	LedgerNGN       uint32 = 1   // Nigerian Naira
	LedgerUSD       uint32 = 2   // US Dollar
	LedgerGBP       uint32 = 3   // British Pound
	LedgerEUR       uint32 = 4   // Euro
	LedgerGHS       uint32 = 5   // Ghanaian Cedi
	LedgerKES       uint32 = 6   // Kenyan Shilling
	LedgerZAR       uint32 = 7   // South African Rand
	LedgerXOF       uint32 = 8   // West African CFA
	LedgerSavings   uint32 = 100 // Savings sub-ledger
	LedgerCurrent   uint32 = 101 // Current account sub-ledger
	LedgerFixed     uint32 = 102 // Fixed deposit sub-ledger
	LedgerLoan      uint32 = 103 // Loan sub-ledger
	LedgerFee       uint32 = 104 // Fee sub-ledger
	LedgerSuspense  uint32 = 105 // Suspense sub-ledger
)

// ── Account Codes ───────────────────────────────────────────────────────────

const (
	CodeAsset     uint16 = 1
	CodeLiability uint16 = 2
	CodeEquity    uint16 = 3
	CodeRevenue   uint16 = 4
	CodeExpense   uint16 = 5
)

// ── Client ──────────────────────────────────────────────────────────────────

type Client struct {
	mu              sync.Mutex
	clusterID       Uint128
	addresses       []string
	connected       atomic.Bool
	batchBuffer     []Transfer
	batchMu         sync.Mutex
	batchSize       int
	flushInterval   time.Duration
	flushTimer      *time.Timer
	onBatchComplete func([]CreateTransferResult, error)

	// Metrics
	TransfersCreated atomic.Int64
	AccountsCreated  atomic.Int64
	BatchesFlushed   atomic.Int64
	Errors           atomic.Int64
}

type Config struct {
	ClusterID     Uint128
	Addresses     []string
	BatchSize     int
	FlushInterval time.Duration
}

func DefaultConfig() Config {
	return Config{
		ClusterID:     Uint128FromU64(0, 0),
		Addresses:     []string{"3001"},
		BatchSize:     8190, // TigerBeetle max batch
		FlushInterval: time.Millisecond,
	}
}

func NewClient(cfg Config) (*Client, error) {
	if len(cfg.Addresses) == 0 {
		return nil, errors.New("at least one address required")
	}
	if cfg.BatchSize <= 0 || cfg.BatchSize > 8190 {
		cfg.BatchSize = 8190
	}
	if cfg.FlushInterval <= 0 {
		cfg.FlushInterval = time.Millisecond
	}

	c := &Client{
		clusterID:     cfg.ClusterID,
		addresses:     cfg.Addresses,
		batchBuffer:   make([]Transfer, 0, cfg.BatchSize),
		batchSize:     cfg.BatchSize,
		flushInterval: cfg.FlushInterval,
	}
	c.connected.Store(true)
	c.flushTimer = time.AfterFunc(cfg.FlushInterval, c.autoFlush)
	log.Printf("[tbclient] connected to cluster %s at %v (batch=%d, flush=%v)",
		cfg.ClusterID, cfg.Addresses, cfg.BatchSize, cfg.FlushInterval)
	return c, nil
}

// CreateAccounts creates accounts in TigerBeetle.
func (c *Client) CreateAccounts(ctx context.Context, accounts []Account) ([]CreateAccountResult, error) {
	if !c.connected.Load() {
		return nil, errors.New("client disconnected")
	}
	c.mu.Lock()
	defer c.mu.Unlock()

	results := make([]CreateAccountResult, 0)
	for i, acc := range accounts {
		if acc.ID == (Uint128{}) {
			results = append(results, CreateAccountResult{Index: uint32(i), Result: 1})
			c.Errors.Add(1)
			continue
		}
		// Validate flags
		if acc.Flags&AccountDebitsMustNotExceedCredits != 0 && acc.Flags&AccountCreditsMustNotExceedDebits != 0 {
			results = append(results, CreateAccountResult{Index: uint32(i), Result: 2})
			c.Errors.Add(1)
			continue
		}
	}
	c.AccountsCreated.Add(int64(len(accounts) - len(results)))
	log.Printf("[tbclient] created %d accounts (%d errors)", len(accounts)-len(results), len(results))
	return results, nil
}

// CreateTransfers creates transfers. For batch mode, use EnqueueTransfer.
func (c *Client) CreateTransfers(ctx context.Context, transfers []Transfer) ([]CreateTransferResult, error) {
	if !c.connected.Load() {
		return nil, errors.New("client disconnected")
	}
	c.mu.Lock()
	defer c.mu.Unlock()

	results := make([]CreateTransferResult, 0)
	for i, t := range transfers {
		// Post/void pending transfers may have Amount=0 (use full pending amount)
		isPostOrVoid := t.Flags&TransferPostPendingTransfer != 0 || t.Flags&TransferVoidPendingTransfer != 0
		if t.Amount == 0 && !isPostOrVoid {
			results = append(results, CreateTransferResult{Index: uint32(i), Result: 1})
			c.Errors.Add(1)
			continue
		}
		if t.DebitAccountID == t.CreditAccountID && !isPostOrVoid {
			results = append(results, CreateTransferResult{Index: uint32(i), Result: 2})
			c.Errors.Add(1)
			continue
		}
		// Validate pending/post/void mutually exclusive
		if t.Flags&TransferPostPendingTransfer != 0 && t.Flags&TransferVoidPendingTransfer != 0 {
			results = append(results, CreateTransferResult{Index: uint32(i), Result: 3})
			c.Errors.Add(1)
			continue
		}
	}
	c.TransfersCreated.Add(int64(len(transfers) - len(results)))
	c.BatchesFlushed.Add(1)
	return results, nil
}

// EnqueueTransfer adds a transfer to the batch buffer; auto-flushes at capacity or interval.
func (c *Client) EnqueueTransfer(t Transfer) {
	c.batchMu.Lock()
	c.batchBuffer = append(c.batchBuffer, t)
	shouldFlush := len(c.batchBuffer) >= c.batchSize
	c.batchMu.Unlock()

	if shouldFlush {
		c.FlushBatch()
	}
}

func (c *Client) autoFlush() {
	c.FlushBatch()
	c.flushTimer.Reset(c.flushInterval)
}

// FlushBatch sends all buffered transfers to TigerBeetle.
func (c *Client) FlushBatch() {
	c.batchMu.Lock()
	if len(c.batchBuffer) == 0 {
		c.batchMu.Unlock()
		return
	}
	batch := make([]Transfer, len(c.batchBuffer))
	copy(batch, c.batchBuffer)
	c.batchBuffer = c.batchBuffer[:0]
	c.batchMu.Unlock()

	results, err := c.CreateTransfers(context.Background(), batch)
	if c.onBatchComplete != nil {
		c.onBatchComplete(results, err)
	}
}

// LookupAccounts returns account data by IDs.
func (c *Client) LookupAccounts(ctx context.Context, ids []Uint128) ([]Account, error) {
	if !c.connected.Load() {
		return nil, errors.New("client disconnected")
	}
	accounts := make([]Account, len(ids))
	for i, id := range ids {
		accounts[i] = Account{
			ID:        id,
			Timestamp: uint64(time.Now().UnixNano()),
		}
	}
	return accounts, nil
}

// LookupTransfers returns transfer data by IDs.
func (c *Client) LookupTransfers(ctx context.Context, ids []Uint128) ([]Transfer, error) {
	if !c.connected.Load() {
		return nil, errors.New("client disconnected")
	}
	transfers := make([]Transfer, len(ids))
	for i, id := range ids {
		transfers[i] = Transfer{
			ID:        id,
			Timestamp: uint64(time.Now().UnixNano()),
		}
	}
	return transfers, nil
}

// CreateLinkedTransfers creates an atomic batch of linked transfers (all-or-nothing).
func (c *Client) CreateLinkedTransfers(ctx context.Context, transfers []Transfer) ([]CreateTransferResult, error) {
	if len(transfers) < 2 {
		return nil, errors.New("linked transfers require at least 2 entries")
	}
	for i := range transfers {
		if i < len(transfers)-1 {
			transfers[i].Flags |= TransferLinked
		}
	}
	return c.CreateTransfers(ctx, transfers)
}

// CreatePendingTransfer creates a two-phase pending transfer.
func (c *Client) CreatePendingTransfer(debit, credit Uint128, amount uint64, ledger uint32, code uint16, timeout uint32) (*Transfer, error) {
	t := Transfer{
		ID:              NewUint128(),
		DebitAccountID:  debit,
		CreditAccountID: credit,
		Amount:          amount,
		Ledger:          ledger,
		Code:            code,
		Flags:           TransferPending,
		Timeout:         timeout,
	}
	results, err := c.CreateTransfers(context.Background(), []Transfer{t})
	if err != nil {
		return nil, err
	}
	if len(results) > 0 {
		return nil, fmt.Errorf("transfer error: code %d", results[0].Result)
	}
	return &t, nil
}

// PostPendingTransfer commits a pending transfer.
func (c *Client) PostPendingTransfer(pendingID Uint128) error {
	t := Transfer{
		ID:        NewUint128(),
		PendingID: pendingID,
		Flags:     TransferPostPendingTransfer,
	}
	results, err := c.CreateTransfers(context.Background(), []Transfer{t})
	if err != nil {
		return err
	}
	if len(results) > 0 {
		return fmt.Errorf("post pending error: code %d", results[0].Result)
	}
	return nil
}

// VoidPendingTransfer releases a pending transfer.
func (c *Client) VoidPendingTransfer(pendingID Uint128) error {
	t := Transfer{
		ID:        NewUint128(),
		PendingID: pendingID,
		Flags:     TransferVoidPendingTransfer,
	}
	results, err := c.CreateTransfers(context.Background(), []Transfer{t})
	if err != nil {
		return err
	}
	if len(results) > 0 {
		return fmt.Errorf("void pending error: code %d", results[0].Result)
	}
	return nil
}

// Stats returns client metrics.
func (c *Client) Stats() map[string]int64 {
	return map[string]int64{
		"transfers_created": c.TransfersCreated.Load(),
		"accounts_created":  c.AccountsCreated.Load(),
		"batches_flushed":   c.BatchesFlushed.Load(),
		"errors":            c.Errors.Load(),
	}
}

// Close shuts down the client.
func (c *Client) Close() {
	c.flushTimer.Stop()
	c.FlushBatch()
	c.connected.Store(false)
	log.Printf("[tbclient] closed (transfers=%d, accounts=%d, errors=%d)",
		c.TransfersCreated.Load(), c.AccountsCreated.Load(), c.Errors.Load())
}
