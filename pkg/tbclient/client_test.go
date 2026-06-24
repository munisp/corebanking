package tbclient

import (
	"context"
	"testing"
	"time"
)

func TestNewClient(t *testing.T) {
	cfg := DefaultConfig()
	c, err := NewClient(cfg)
	if err != nil {
		t.Fatalf("NewClient failed: %v", err)
	}
	defer c.Close()
	if !c.connected.Load() {
		t.Fatal("client should be connected")
	}
}

func TestCreateAccounts(t *testing.T) {
	c, _ := NewClient(DefaultConfig())
	defer c.Close()
	accounts := []Account{
		{ID: NewUint128(), Ledger: LedgerNGN, Code: CodeAsset},
		{ID: NewUint128(), Ledger: LedgerNGN, Code: CodeLiability, Flags: AccountCreditsMustNotExceedDebits},
	}
	results, err := c.CreateAccounts(context.Background(), accounts)
	if err != nil {
		t.Fatalf("CreateAccounts: %v", err)
	}
	if len(results) != 0 {
		t.Fatalf("expected 0 errors, got %d", len(results))
	}
	if c.AccountsCreated.Load() != 2 {
		t.Fatalf("expected 2 accounts created, got %d", c.AccountsCreated.Load())
	}
}

func TestCreateTransferZeroAmountRejected(t *testing.T) {
	c, _ := NewClient(DefaultConfig())
	defer c.Close()
	transfers := []Transfer{{ID: NewUint128(), Amount: 0}}
	results, _ := c.CreateTransfers(context.Background(), transfers)
	if len(results) != 1 || results[0].Result != 1 {
		t.Fatal("zero amount should be rejected")
	}
}

func TestCreateTransferSelfTransferRejected(t *testing.T) {
	c, _ := NewClient(DefaultConfig())
	defer c.Close()
	id := NewUint128()
	transfers := []Transfer{{ID: NewUint128(), DebitAccountID: id, CreditAccountID: id, Amount: 1000}}
	results, _ := c.CreateTransfers(context.Background(), transfers)
	if len(results) != 1 || results[0].Result != 2 {
		t.Fatal("self-transfer should be rejected")
	}
}

func TestLinkedTransfers(t *testing.T) {
	c, _ := NewClient(DefaultConfig())
	defer c.Close()
	a1, a2, a3 := NewUint128(), NewUint128(), NewUint128()
	transfers := []Transfer{
		{ID: NewUint128(), DebitAccountID: a1, CreditAccountID: a2, Amount: 5000, Ledger: LedgerNGN, Code: 1},
		{ID: NewUint128(), DebitAccountID: a2, CreditAccountID: a3, Amount: 5000, Ledger: LedgerNGN, Code: 1},
	}
	results, err := c.CreateLinkedTransfers(context.Background(), transfers)
	if err != nil {
		t.Fatalf("linked transfers: %v", err)
	}
	if len(results) != 0 {
		t.Fatalf("expected 0 errors, got %d", len(results))
	}
}

func TestTwoPhaseCommit(t *testing.T) {
	c, _ := NewClient(DefaultConfig())
	defer c.Close()
	debit, credit := NewUint128(), NewUint128()
	pending, err := c.CreatePendingTransfer(debit, credit, 100000, LedgerNGN, 1, 30)
	if err != nil {
		t.Fatalf("pending: %v", err)
	}
	if err := c.PostPendingTransfer(pending.ID); err != nil {
		t.Fatalf("post: %v", err)
	}
}

func TestBatchEnqueue(t *testing.T) {
	cfg := DefaultConfig()
	cfg.BatchSize = 3
	cfg.FlushInterval = 100 * time.Millisecond
	c, _ := NewClient(cfg)
	defer c.Close()
	flushed := make(chan struct{}, 1)
	c.onBatchComplete = func(_ []CreateTransferResult, _ error) {
		select {
		case flushed <- struct{}{}:
		default:
		}
	}
	a1, a2 := NewUint128(), NewUint128()
	for i := 0; i < 3; i++ {
		c.EnqueueTransfer(Transfer{ID: NewUint128(), DebitAccountID: a1, CreditAccountID: a2, Amount: uint64(i+1) * 100, Ledger: LedgerNGN, Code: 1})
	}
	select {
	case <-flushed:
	case <-time.After(time.Second):
		t.Fatal("batch should have flushed")
	}
	if c.TransfersCreated.Load() < 3 {
		t.Fatalf("expected >= 3 transfers, got %d", c.TransfersCreated.Load())
	}
}

func TestLedgerConstants(t *testing.T) {
	if LedgerNGN != 1 { t.Fatal("NGN should be 1") }
	if LedgerSavings != 100 { t.Fatal("Savings should be 100") }
	if LedgerLoan != 103 { t.Fatal("Loan should be 103") }
}

func TestStats(t *testing.T) {
	c, _ := NewClient(DefaultConfig())
	defer c.Close()
	stats := c.Stats()
	if stats["transfers_created"] != 0 { t.Fatal("should start at 0") }
}
