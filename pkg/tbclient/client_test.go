package tbclient

import (
	"context"
	"os"
	"testing"

	tb "github.com/tigerbeetle/tigerbeetle-go"
)

func skipIfNoCluster(t *testing.T) {
	t.Helper()
	if os.Getenv("TB_ADDRESS") == "" && os.Getenv("TIGERBEETLE_ADDRESSES") == "" {
		t.Skip("no TigerBeetle cluster configured (set TB_ADDRESS or TIGERBEETLE_ADDRESSES)")
	}
}

func testClient(t *testing.T) *Client {
	t.Helper()
	skipIfNoCluster(t)
	c, err := NewClient(Config{ClusterID: 0})
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	t.Cleanup(func() { c.Close() })
	return c
}

func TestNewClientRejectsNoAddresses(t *testing.T) {
	os.Unsetenv("TB_ADDRESS")
	os.Unsetenv("TIGERBEETLE_ADDRESSES")
	_, err := NewClient(Config{})
	if err == nil {
		t.Fatal("expected error when no addresses configured")
	}
}

func TestUint128Helpers(t *testing.T) {
	// ToUint128 round-trip
	u := tb.ToUint128(12345)
	lo := Uint128Low(u)
	if lo != 12345 {
		t.Errorf("Uint128Low(ToUint128(12345)) = %d, want 12345", lo)
	}

	// Uint128FromU64 round-trip
	u2 := Uint128FromU64(42, 7)
	lo2, hi2 := u2.Uint64()
	if lo2 != 42 || hi2 != 7 {
		t.Errorf("Uint128FromU64(42,7) = (%d,%d), want (42,7)", lo2, hi2)
	}

	// ID generates non-zero
	id := ID()
	lo3, hi3 := id.Uint64()
	if lo3 == 0 && hi3 == 0 {
		t.Error("ID() returned zero")
	}
}

func TestCreateAndLookupAccounts(t *testing.T) {
	c := testClient(t)
	ctx := context.Background()

	acctID := ID()
	results, err := c.CreateAccounts(ctx, []Account{
		{ID: acctID, Ledger: 1, Code: 1},
	})
	if err != nil {
		t.Fatalf("CreateAccounts: %v", err)
	}

	// In v0.17, results only contain entries for failures
	for _, r := range results {
		if r.Status != tb.AccountCreated && r.Status != tb.AccountExists {
			t.Fatalf("account creation failed: status=%v", r.Status)
		}
	}

	accounts, err := c.LookupAccounts(ctx, []Uint128{acctID})
	if err != nil {
		t.Fatalf("LookupAccounts: %v", err)
	}
	if len(accounts) != 1 {
		t.Fatalf("expected 1 account, got %d", len(accounts))
	}
	if accounts[0].Ledger != 1 {
		t.Errorf("expected ledger=1, got %d", accounts[0].Ledger)
	}
}

func TestCreateTransferUpdatesBalances(t *testing.T) {
	c := testClient(t)
	ctx := context.Background()

	debitID := ID()
	creditID := ID()
	_, err := c.CreateAccounts(ctx, []Account{
		{ID: debitID, Ledger: 1, Code: 1},
		{ID: creditID, Ledger: 1, Code: 1},
	})
	if err != nil {
		t.Fatalf("CreateAccounts: %v", err)
	}

	xferID := ID()
	results, err := c.CreateTransfers(ctx, []Transfer{
		{
			ID:              xferID,
			DebitAccountID:  debitID,
			CreditAccountID: creditID,
			Amount:          tb.ToUint128(1000),
			Ledger:          1,
			Code:            1,
		},
	})
	if err != nil {
		t.Fatalf("CreateTransfers: %v", err)
	}
	for _, r := range results {
		if r.Status != tb.TransferCreated && r.Status != tb.TransferExists {
			t.Fatalf("transfer failed: status=%v", r.Status)
		}
	}

	bal, err := c.GetAccountBalance(ctx, creditID)
	if err != nil {
		t.Fatalf("GetAccountBalance credit: %v", err)
	}
	if bal != 1000 {
		t.Errorf("credit balance: want 1000, got %d", bal)
	}

	bal, err = c.GetAccountBalance(ctx, debitID)
	if err != nil {
		t.Fatalf("GetAccountBalance debit: %v", err)
	}
	if bal != -1000 {
		t.Errorf("debit balance: want -1000, got %d", bal)
	}
}

func TestPendingTransferFlow(t *testing.T) {
	c := testClient(t)
	ctx := context.Background()

	debitID := ID()
	creditID := ID()
	_, _ = c.CreateAccounts(ctx, []Account{
		{ID: debitID, Ledger: 1, Code: 1},
		{ID: creditID, Ledger: 1, Code: 1},
	})

	// Create pending transfer (Flags bit 1 = Pending)
	pendingFlags := tb.TransferFlags{Pending: true}
	xferID := ID()
	_, err := c.CreateTransfers(ctx, []Transfer{
		{
			ID:              xferID,
			DebitAccountID:  debitID,
			CreditAccountID: creditID,
			Amount:          tb.ToUint128(500),
			Ledger:          1,
			Code:            1,
			Flags:           pendingFlags.ToUint16(),
			Timeout:         3600, // 1hr timeout
		},
	})
	if err != nil {
		t.Fatalf("pending transfer: %v", err)
	}

	// Check pending balances
	accounts, _ := c.LookupAccounts(ctx, []Uint128{debitID})
	if len(accounts) == 0 {
		t.Fatal("debit account not found after pending transfer")
	}
	dpLo := Uint128Low(accounts[0].DebitsPending)
	if dpLo != 500 {
		t.Errorf("expected debits_pending=500, got %d", dpLo)
	}

	// Post the pending transfer
	postFlags := tb.TransferFlags{PostPendingTransfer: true}
	postID := ID()
	_, err = c.CreateTransfers(ctx, []Transfer{
		{
			ID:              postID,
			DebitAccountID:  debitID,
			CreditAccountID: creditID,
			Amount:          tb.ToUint128(500),
			PendingID:       xferID,
			Ledger:          1,
			Code:            1,
			Flags:           postFlags.ToUint16(),
		},
	})
	if err != nil {
		t.Fatalf("post pending: %v", err)
	}

	// Verify: pending=0, posted=500
	accounts, _ = c.LookupAccounts(ctx, []Uint128{debitID})
	dpLo = Uint128Low(accounts[0].DebitsPending)
	if dpLo != 0 {
		t.Errorf("after post: expected debits_pending=0, got %d", dpLo)
	}
	dpPosted := Uint128Low(accounts[0].DebitsPosted)
	if dpPosted != 500 {
		t.Errorf("after post: expected debits_posted=500, got %d", dpPosted)
	}
}

func TestOverdraftProtection(t *testing.T) {
	c := testClient(t)
	ctx := context.Background()

	// DebitsMustNotExceedCredits = can't debit more than credits (overdraft protection)
	flags := tb.AccountFlags{DebitsMustNotExceedCredits: true}
	debitID := ID()
	creditID := ID()
	_, _ = c.CreateAccounts(ctx, []Account{
		{ID: debitID, Ledger: 1, Code: 1, Flags: flags.ToUint16()},
		{ID: creditID, Ledger: 1, Code: 1},
	})

	// Transfer 1000 from empty constrained account — should fail
	xferID := ID()
	results, err := c.CreateTransfers(ctx, []Transfer{
		{
			ID:              xferID,
			DebitAccountID:  debitID,
			CreditAccountID: creditID,
			Amount:          tb.ToUint128(1000),
			Ledger:          1,
			Code:            1,
		},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Should have a failure result for the overdraft
	hasFailure := false
	for _, r := range results {
		if r.Status != tb.TransferCreated && r.Status != tb.TransferExists {
			hasFailure = true
			break
		}
	}
	if !hasFailure {
		t.Error("expected overdraft rejection, but transfer succeeded")
	}
}

func TestGetAccountBalanceFull(t *testing.T) {
	c := testClient(t)
	ctx := context.Background()

	acctID := ID()
	_, _ = c.CreateAccounts(ctx, []Account{
		{ID: acctID, Ledger: 1, Code: 1},
	})

	info, err := c.GetAccountBalanceFull(ctx, acctID)
	if err != nil {
		t.Fatalf("GetAccountBalanceFull: %v", err)
	}
	if info.NetBalance != 0 {
		t.Errorf("new account net balance: want 0, got %d", info.NetBalance)
	}
	if info.DebitsPosted != 0 || info.CreditsPosted != 0 {
		t.Errorf("new account: want 0/0 posted, got %d/%d", info.DebitsPosted, info.CreditsPosted)
	}
}
