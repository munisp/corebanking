package main

// TigerBeetle ledger-of-record integration for STK (SIM Toolkit) banking.
//
// TigerBeetle (via pkg/tbclient) is the authoritative ledger. The PostgreSQL
// accounts.balance column is a READ-MODEL updated only AFTER the cluster
// confirms the transfer. If the read-model update fails after a confirmed TB
// transfer, a compensating reverse transfer is posted (mirroring
// virtual-account-service's ReverseEscrow compensation); if compensation
// itself fails the operation is logged at CRITICAL for manual reconciliation.
//
// Fail-closed: when no TigerBeetle cluster is reachable (TB_ADDRESS /
// TIGERBEETLE_ADDRESSES unset), every money-movement operation fails and NO
// PostgreSQL balance row is touched.

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"log"
	"math"

	"github.com/munisp/corebanking/pkg/tbclient"
)

// errLedgerInsufficientFunds is returned when the debited account cannot cover
// the transfer at the ledger level (defense-in-depth pre-check or a cluster
// rejection). Callers map it to the user-facing "Insufficient balance" reply.
var errLedgerInsufficientFunds = errors.New("insufficient funds at ledger")

// Transfer codes used on the NGN ledger (ledger id 1), mirroring the
// core-banking-go convention.
const (
	tbLedgerID            uint32 = 1
	tbCodeP2PTransfer     uint16 = 1
	tbCodeAirtimePurchase uint16 = 2
	tbCodeBillPayment     uint16 = 3
)

// maxLedgerAmountNaira caps a single movement at ₦1 trillion — guards the
// float64→uint64 conversion from overflow/wrap (mirrors core-banking-go).
const maxLedgerAmountNaira = 1e12

type tbLedger struct {
	client  *tbclient.Client
	connErr error // non-nil when the cluster was unreachable at boot
}

// newTBLedger connects to the TigerBeetle cluster. Boot continues on failure
// (like core-banking-go's initLedger): every money operation then fails
// closed with connErr and PostgreSQL read-model rows are never touched.
func newTBLedger() *tbLedger {
	client, err := tbclient.NewClient(tbclient.Config{})
	if err != nil {
		log.Printf("[stk-service] FATAL: TigerBeetle cluster unreachable (%v) — all balance movements will FAIL CLOSED", err)
		return &tbLedger{connErr: err}
	}
	log.Printf("[stk-service] connected to TigerBeetle cluster (ledger of record)")
	return &tbLedger{client: client}
}

func (l *tbLedger) close() {
	if l != nil && l.client != nil {
		l.client.Close()
	}
}

// ledgerAccountUint128 deterministically maps a platform account ID to a
// TigerBeetle Uint128 (SHA-256, namespaced). Stable across restarts and
// shared across services crediting/debiting the same platform account.
func ledgerAccountUint128(accountID string) tbclient.Uint128 {
	sum := sha256.Sum256([]byte("54bank/ledger/account/" + accountID))
	var b [16]byte
	copy(b[:], sum[:16])
	return tbclient.BytesToUint128(b)
}

// ledgerIDFromKey derives a deterministic TigerBeetle ID from an operation's
// idempotency key, so a retried operation yields TransferExists instead of a
// duplicate posting.
func ledgerIDFromKey(kind, key string) tbclient.Uint128 {
	sum := sha256.Sum256([]byte("54bank/stk-service/idem/" + kind + "/" + key))
	var b [16]byte
	copy(b[:], sum[:16])
	return tbclient.BytesToUint128(b)
}

// nairaToKobo converts a NGN amount to TB integer minor units (kobo).
// Rejects non-finite, non-positive, oversized, or sub-kobo-precision amounts
// rather than silently rounding (mirrors core-banking-go validatePostingAmount).
func nairaToKobo(amount float64) (uint64, error) {
	if amount != amount || math.IsInf(amount, 0) {
		return 0, fmt.Errorf("amount must be finite")
	}
	if amount <= 0 {
		return 0, fmt.Errorf("amount must be positive")
	}
	if amount > maxLedgerAmountNaira {
		return 0, fmt.Errorf("amount %.2f exceeds maximum ledger limit %.0f naira", amount, maxLedgerAmountNaira)
	}
	if amount*100 != math.Round(amount*100) {
		return 0, fmt.Errorf("amount %.10f has sub-kobo precision", amount)
	}
	kobo := uint64(math.Round(amount * 100))
	if kobo == 0 {
		return 0, fmt.Errorf("amount %.4f rounds to zero minor units", amount)
	}
	return kobo, nil
}

// settlementAccountID returns the deterministic platform-level settlement
// account for outbound flows whose counterparty is outside 54Bank
// (external transfers, airtime, billers).
func settlementAccountID(purpose string) string {
	return "settlement/stk-service/" + purpose
}

// ensureAccount idempotently creates a TB account on first use
// (AccountExists tolerated). Customer accounts are created with
// DEBITS_MUST_NOT_EXCEED_CREDITS so they can never be overdrafted at the
// ledger level; settlement accounts carry no flags.
func (l *tbLedger) ensureAccount(ctx context.Context, accountID string, customer bool) (tbclient.Uint128, error) {
	tbID := ledgerAccountUint128(accountID)
	var flags uint16
	if customer {
		flags = tbclient.AccountFlags{DebitsMustNotExceedCredits: true}.ToUint16()
	}
	results, err := l.client.CreateAccounts(ctx, []tbclient.Account{
		{ID: tbID, Ledger: tbLedgerID, Code: 1, Flags: flags},
	})
	if err != nil {
		return tbclient.Uint128{}, fmt.Errorf("tigerbeetle create account: %w", err)
	}
	for _, r := range results {
		if r.Status != tbclient.AccountCreated && r.Status != tbclient.AccountExists {
			return tbclient.Uint128{}, fmt.Errorf("tigerbeetle account rejected: %v", r.Status)
		}
	}
	return tbID, nil
}

// move executes the authoritative ledger movement as a TigerBeetle transfer:
// debit debitAccountID, credit creditAccountID. idempotencyKey (the
// operation's transaction reference) makes retries cluster-safe. customerDebit
// / customerCredit select the account flags used on first-use provisioning.
func (l *tbLedger) move(ctx context.Context, debitAccountID, creditAccountID string, customerDebit, customerCredit bool, amount float64, idempotencyKey string, code uint16) error {
	if l == nil || l.client == nil {
		return fmt.Errorf("tigerbeetle ledger unavailable: %v", l.connErr)
	}
	kobo, err := nairaToKobo(amount)
	if err != nil {
		return err
	}

	debitTB, err := l.ensureAccount(ctx, debitAccountID, customerDebit)
	if err != nil {
		return err
	}
	creditTB, err := l.ensureAccount(ctx, creditAccountID, customerCredit)
	if err != nil {
		return err
	}

	// Defense-in-depth balance pre-check: accounts created before the
	// DEBITS_MUST_NOT_EXCEED_CREDITS flag was introduced may not have it.
	if bal, balErr := l.client.GetAccountBalance(ctx, debitTB); balErr == nil && bal < int64(kobo) {
		return errLedgerInsufficientFunds
	}

	transferID := ledgerIDFromKey("move", idempotencyKey)
	tresults, err := l.client.CreateTransfers(ctx, []tbclient.Transfer{{
		ID:              transferID,
		DebitAccountID:  debitTB,
		CreditAccountID: creditTB,
		Amount:          tbclient.ToUint128(kobo),
		Ledger:          tbLedgerID,
		Code:            code,
	}})
	if err != nil {
		return fmt.Errorf("tigerbeetle create transfer: %w", err)
	}
	for _, r := range tresults {
		switch r.Status {
		case tbclient.TransferCreated, tbclient.TransferExists:
			return nil
		case tbclient.TransferExceedsCredits:
			return errLedgerInsufficientFunds
		default:
			return fmt.Errorf("tigerbeetle transfer rejected: %v", r.Status)
		}
	}
	return nil
}

// compensate reverses a confirmed transfer whose PostgreSQL read-model update
// failed (mirrors virtual-account-service ReverseEscrow compensation). The
// reverse transfer is itself idempotent via idempotencyKey+"-REV".
func (l *tbLedger) compensate(ctx context.Context, debitAccountID, creditAccountID string, customerDebit, customerCredit bool, amount float64, idempotencyKey string, code uint16) {
	if err := l.move(ctx, creditAccountID, debitAccountID, customerCredit, customerDebit, amount, idempotencyKey+"-REV", code); err != nil {
		log.Printf("[stk-service] CRITICAL: ledger compensation FAILED ref=%s debit=%s credit=%s amount=%.2f: %v — manual reconciliation required",
			idempotencyKey, debitAccountID, creditAccountID, amount, err)
		return
	}
	log.Printf("[stk-service] ledger compensation posted ref=%s (read-model update failed; transfer reversed)", idempotencyKey)
}
