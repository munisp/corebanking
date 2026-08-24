package middleware

import (
	"context"
	"crypto/sha256"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/munisp/corebanking/pkg/tbclient"
)

// A2: Double-Entry Ledger backed by a real TigerBeetle cluster.
// Every monetary operation creates balanced debit/credit transfers in
// TigerBeetle via the official SDK (pkg/tbclient). Nothing is "posted"
// unless the cluster confirms it; when the cluster is unreachable every
// posting method fails fast with an explicit error.

type AccountType int

const (
	AccountTypeAsset     AccountType = 1
	AccountTypeLiability AccountType = 2
	AccountTypeEquity    AccountType = 3
	AccountTypeRevenue   AccountType = 4
	AccountTypeExpense   AccountType = 5
)

type LedgerAccount struct {
	ID            string      `json:"id"`
	Name          string      `json:"name"`
	Code          string      `json:"code"`
	AccountType   AccountType `json:"accountType"`
	Currency      string      `json:"currency"`
	Balance       int64       `json:"balance"` // in minor units (kobo)
	PendingDebit  int64       `json:"pendingDebit"`
	PendingCredit int64       `json:"pendingCredit"`
	TenantID      string      `json:"tenantId"`
	CreatedAt     time.Time   `json:"createdAt"`
}

type TBLedgerEntry struct {
	ID            string    `json:"id"`
	TransactionID string    `json:"transactionId"`
	AccountID     string    `json:"accountId"`
	DebitAmount   int64     `json:"debitAmount"`  // kobo
	CreditAmount  int64     `json:"creditAmount"` // kobo
	Description   string    `json:"description"`
	PostingDate   time.Time `json:"postingDate"`
	ValueDate     time.Time `json:"valueDate"`
	Domain        string    `json:"domain"`
	Reference     string    `json:"reference"`
}

type LedgerTransaction struct {
	ID          string          `json:"id"`
	Entries     []TBLedgerEntry `json:"entries"`
	Description string          `json:"description"`
	Domain      string          `json:"domain"`
	Status      string          `json:"status"` // "pending", "posted", "reversed"
	PostedAt    time.Time       `json:"postedAt"`
	PostedBy    string          `json:"postedBy"`
}

// TigerBeetleLedger posts to a real TigerBeetle cluster. The in-memory
// accounts map holds chart-of-accounts metadata only (names/types — static
// configuration); balances always come from the cluster. The entries slice
// is a journal of entries the cluster has confirmed — never fabricated.
type TigerBeetleLedger struct {
	addresses string
	clusterID uint64
	client    *tbclient.Client // nil when the cluster is unreachable/unconfigured
	mu        sync.RWMutex
	accounts  map[string]*LedgerAccount // CoA metadata (static)
	entries   []TBLedgerEntry           // confirmed postings journal
	txns      []LedgerTransaction       // confirmed transactions
}

// tbLedgerID is the TigerBeetle ledger for NGN minor units (kobo).
const tbLedgerID uint32 = 1

// domainTransferCodes maps business domains to TigerBeetle transfer codes.
var domainTransferCodes = map[string]uint16{
	"teller":        100,
	"loans":         200,
	"trade-finance": 300,
	"insurance":     400,
	"general":       1,
}

func transferCodeFor(domain string) uint16 {
	if c, ok := domainTransferCodes[domain]; ok {
		return c
	}
	return domainTransferCodes["general"]
}

// ledgerAccountUint128 maps a chart-of-accounts code to a deterministic
// TigerBeetle account ID. Numeric CoA codes map 1:1 into the low 64 bits;
// anything else is namespaced via SHA-256 so IDs are stable across restarts.
func ledgerAccountUint128(accountCode string) tbclient.Uint128 {
	if n, err := strconv.ParseUint(strings.TrimSpace(accountCode), 10, 64); err == nil {
		return tbclient.Uint128FromU64(n, 0)
	}
	sum := sha256.Sum256([]byte("54bank/middleware-ledger/" + accountCode))
	var id [16]byte
	copy(id[:], sum[:16])
	return tbclient.BytesToUint128(id)
}

// ErrTigerBeetleUnavailable is returned by every posting path when the
// TigerBeetle cluster cannot be reached. Callers (HTTP handlers) must
// surface this as 502/503 — money has NOT moved.
var ErrTigerBeetleUnavailable = fmt.Errorf("tigerbeetle ledger unavailable: cluster client not configured or connection failed (set TIGERBEETLE_ADDRESSES)")

func NewTigerBeetleLedger() *TigerBeetleLedger {
	addresses := os.Getenv("TIGERBEETLE_ADDRESSES")
	clusterIDStr := os.Getenv("TIGERBEETLE_CLUSTER_ID")
	var clusterID uint64
	if clusterIDStr != "" {
		if n, err := strconv.ParseUint(clusterIDStr, 10, 64); err == nil {
			clusterID = n
		}
	}

	ledger := &TigerBeetleLedger{
		addresses: addresses,
		clusterID: clusterID,
		accounts:  make(map[string]*LedgerAccount),
	}
	ledger.seedChartOfAccounts()

	client, err := tbclient.NewClient(tbclient.Config{ClusterID: clusterID})
	if err != nil {
		// Fail fast at posting time: PostTransaction and the Post* helpers
		// return ErrTigerBeetleUnavailable and never report "posted".
		log.Printf("[TigerBeetle] FATAL: cannot connect to cluster (%v) — ledger postings will fail with 503 until the cluster is reachable", err)
		ledger.client = nil
	} else {
		ledger.client = client
		log.Printf("[TigerBeetle] ledger connected to cluster %d at %s", clusterID, addresses)
	}
	return ledger
}

// Available reports whether the ledger has a live cluster connection.
func (l *TigerBeetleLedger) Available() bool {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.client != nil
}

func (l *TigerBeetleLedger) seedChartOfAccounts() {
	coa := []LedgerAccount{
		// Assets
		{ID: "1000", Name: "Cash on Hand", Code: "1000", AccountType: AccountTypeAsset, Currency: "NGN"},
		{ID: "1100", Name: "Cash at Bank", Code: "1100", AccountType: AccountTypeAsset, Currency: "NGN"},
		{ID: "1200", Name: "Loans Receivable", Code: "1200", AccountType: AccountTypeAsset, Currency: "NGN"},
		{ID: "1210", Name: "Mortgage Loans Receivable", Code: "1210", AccountType: AccountTypeAsset, Currency: "NGN"},
		{ID: "1220", Name: "Education Loans Receivable", Code: "1220", AccountType: AccountTypeAsset, Currency: "NGN"},
		{ID: "1230", Name: "Agriculture Loans Receivable", Code: "1230", AccountType: AccountTypeAsset, Currency: "NGN"},
		{ID: "1240", Name: "Islamic Finance Receivable", Code: "1240", AccountType: AccountTypeAsset, Currency: "NGN"},
		{ID: "1250", Name: "Group Loans Receivable", Code: "1250", AccountType: AccountTypeAsset, Currency: "NGN"},
		{ID: "1300", Name: "Trade Finance Assets", Code: "1300", AccountType: AccountTypeAsset, Currency: "NGN"},
		{ID: "1400", Name: "Fixed Assets", Code: "1400", AccountType: AccountTypeAsset, Currency: "NGN"},
		{ID: "1500", Name: "Investment Securities", Code: "1500", AccountType: AccountTypeAsset, Currency: "NGN"},
		// Liabilities
		{ID: "2000", Name: "Customer Deposits", Code: "2000", AccountType: AccountTypeLiability, Currency: "NGN"},
		{ID: "2100", Name: "Savings Deposits", Code: "2100", AccountType: AccountTypeLiability, Currency: "NGN"},
		{ID: "2200", Name: "Fixed Deposits", Code: "2200", AccountType: AccountTypeLiability, Currency: "NGN"},
		{ID: "2300", Name: "Esusu Group Deposits", Code: "2300", AccountType: AccountTypeLiability, Currency: "NGN"},
		{ID: "2400", Name: "Virtual Account Balances", Code: "2400", AccountType: AccountTypeLiability, Currency: "NGN"},
		{ID: "2500", Name: "Interbank Borrowings", Code: "2500", AccountType: AccountTypeLiability, Currency: "NGN"},
		{ID: "2600", Name: "LC Obligations", Code: "2600", AccountType: AccountTypeLiability, Currency: "NGN"},
		// Equity
		{ID: "3000", Name: "Share Capital", Code: "3000", AccountType: AccountTypeEquity, Currency: "NGN"},
		{ID: "3100", Name: "Retained Earnings", Code: "3100", AccountType: AccountTypeEquity, Currency: "NGN"},
		{ID: "3200", Name: "Statutory Reserves", Code: "3200", AccountType: AccountTypeEquity, Currency: "NGN"},
		// Revenue
		{ID: "4000", Name: "Interest Income", Code: "4000", AccountType: AccountTypeRevenue, Currency: "NGN"},
		{ID: "4100", Name: "Fee Income", Code: "4100", AccountType: AccountTypeRevenue, Currency: "NGN"},
		{ID: "4200", Name: "Commission Income", Code: "4200", AccountType: AccountTypeRevenue, Currency: "NGN"},
		{ID: "4300", Name: "Trade Finance Fees", Code: "4300", AccountType: AccountTypeRevenue, Currency: "NGN"},
		{ID: "4400", Name: "FX Trading Income", Code: "4400", AccountType: AccountTypeRevenue, Currency: "NGN"},
		{ID: "4500", Name: "Insurance Premium Income", Code: "4500", AccountType: AccountTypeRevenue, Currency: "NGN"},
		// Expenses
		{ID: "5000", Name: "Interest Expense", Code: "5000", AccountType: AccountTypeExpense, Currency: "NGN"},
		{ID: "5100", Name: "Provision for Bad Debts", Code: "5100", AccountType: AccountTypeExpense, Currency: "NGN"},
		{ID: "5200", Name: "Operating Expenses", Code: "5200", AccountType: AccountTypeExpense, Currency: "NGN"},
		{ID: "5300", Name: "Agent Commission Expense", Code: "5300", AccountType: AccountTypeExpense, Currency: "NGN"},
	}
	for i := range coa {
		coa[i].CreatedAt = time.Now()
		l.accounts[coa[i].ID] = &coa[i]
	}
}

// ensureClusterAccounts idempotently creates the CoA accounts referenced by
// this transaction in the TigerBeetle cluster (AccountExists is tolerated).
func (l *TigerBeetleLedger) ensureClusterAccounts(ctx context.Context, txn *LedgerTransaction) error {
	seen := make(map[string]bool)
	var accounts []tbclient.Account
	for _, entry := range txn.Entries {
		if seen[entry.AccountID] {
			continue
		}
		seen[entry.AccountID] = true
		meta, ok := l.accounts[entry.AccountID]
		if !ok {
			return fmt.Errorf("account %s not found in chart of accounts", entry.AccountID)
		}
		accounts = append(accounts, tbclient.Account{
			ID:     ledgerAccountUint128(entry.AccountID),
			Ledger: tbLedgerID,
			Code:   uint16(meta.AccountType),
		})
	}
	results, err := l.client.CreateAccounts(ctx, accounts)
	if err != nil {
		return fmt.Errorf("tigerbeetle create accounts: %w", err)
	}
	for _, r := range results {
		if r.Status != tbclient.AccountCreated && r.Status != tbclient.AccountExists {
			return fmt.Errorf("tigerbeetle create account rejected: status=%v", r.Status)
		}
	}
	return nil
}

// pairEntries decomposes balanced debit/credit entries into individual
// TigerBeetle transfers (one debit account → one credit account each).
func pairEntries(txn *LedgerTransaction) ([]tbclient.Transfer, error) {
	type side struct {
		accountID string
		remaining int64
	}
	var debits, credits []side
	for _, e := range txn.Entries {
		if e.DebitAmount > 0 {
			debits = append(debits, side{e.AccountID, e.DebitAmount})
		}
		if e.CreditAmount > 0 {
			credits = append(credits, side{e.AccountID, e.CreditAmount})
		}
	}
	if len(debits) == 0 || len(credits) == 0 {
		return nil, fmt.Errorf("transaction has no debit/credit legs")
	}

	code := transferCodeFor(txn.Domain)
	var transfers []tbclient.Transfer
	di, ci := 0, 0
	for di < len(debits) && ci < len(credits) {
		amt := debits[di].remaining
		if credits[ci].remaining < amt {
			amt = credits[ci].remaining
		}
		flags := tbclient.TransferFlags{Linked: true}.ToUint16()
		transfers = append(transfers, tbclient.Transfer{
			ID:              tbclient.ID(),
			DebitAccountID:  ledgerAccountUint128(debits[di].accountID),
			CreditAccountID: ledgerAccountUint128(credits[ci].accountID),
			Amount:          tbclient.ToUint128(uint64(amt)),
			Ledger:          tbLedgerID,
			Code:            code,
			Flags:           flags,
		})
		debits[di].remaining -= amt
		credits[ci].remaining -= amt
		if debits[di].remaining == 0 {
			di++
		}
		if credits[ci].remaining == 0 {
			ci++
		}
	}
	if di != len(debits) || ci != len(credits) {
		return nil, fmt.Errorf("internal error: unbalanced pairing")
	}
	// The last transfer in a linked chain must not carry the linked flag.
	if len(transfers) > 0 {
		transfers[len(transfers)-1].Flags = tbclient.TransferFlags{}.ToUint16()
	}
	return transfers, nil
}

func (l *TigerBeetleLedger) PostTransaction(txn LedgerTransaction) (*LedgerTransaction, error) {
	// The write lock is taken BEFORE any access to l.accounts/l.entries/l.txns
	// — the map is also written below (balance refresh) and must never be
	// read concurrently (fatal concurrent map read/write).
	l.mu.Lock()
	defer l.mu.Unlock()

	// Validate balanced entries before touching the cluster.
	var totalDebit, totalCredit int64
	for _, entry := range txn.Entries {
		totalDebit += entry.DebitAmount
		totalCredit += entry.CreditAmount
		if _, ok := l.accounts[entry.AccountID]; !ok {
			return nil, fmt.Errorf("account %s not found", entry.AccountID)
		}
	}
	if totalDebit != totalCredit {
		return nil, fmt.Errorf("unbalanced transaction: debit=%d credit=%d", totalDebit, totalCredit)
	}
	if totalDebit <= 0 {
		return nil, fmt.Errorf("transaction amount must be positive")
	}

	if l.client == nil {
		return nil, ErrTigerBeetleUnavailable
	}

	ctx := context.Background()
	if err := l.ensureClusterAccounts(ctx, &txn); err != nil {
		return nil, err
	}

	transfers, err := pairEntries(&txn)
	if err != nil {
		return nil, err
	}

	results, err := l.client.CreateTransfers(ctx, transfers)
	if err != nil {
		return nil, fmt.Errorf("tigerbeetle create transfers: %w", err)
	}
	for _, r := range results {
		if r.Status != tbclient.TransferCreated && r.Status != tbclient.TransferExists {
			return nil, fmt.Errorf("tigerbeetle transfer rejected: status=%v", r.Status)
		}
	}

	// The cluster has confirmed the transfers — only now mark as posted.
	txn.Status = "posted"
	txn.PostedAt = time.Now()
	txn.ID = fmt.Sprintf("TXN-%d", time.Now().UnixNano())

	for i, entry := range txn.Entries {
		entry.ID = fmt.Sprintf("ENT-%d-%d", time.Now().UnixNano(), i)
		entry.TransactionID = txn.ID
		entry.PostingDate = time.Now()
		if entry.ValueDate.IsZero() {
			entry.ValueDate = time.Now()
		}
		l.entries = append(l.entries, entry)
		txn.Entries[i] = entry

		// Refresh the metadata balance from the real cluster state.
		if bal, berr := l.client.GetAccountBalance(ctx, ledgerAccountUint128(entry.AccountID)); berr == nil {
			l.accounts[entry.AccountID].Balance = bal
		} else {
			log.Printf("[TigerBeetle] WARNING: balance refresh failed for %s: %v", entry.AccountID, berr)
		}
	}
	l.txns = append(l.txns, txn)

	log.Printf("[TigerBeetle] Posted %s: %d entries, debit=%d credit=%d (cluster-confirmed)", txn.ID, len(txn.Entries), totalDebit, totalCredit)
	return &txn, nil
}

func (l *TigerBeetleLedger) GetAccount(id string) (*LedgerAccount, error) {
	l.mu.RLock()
	meta, ok := l.accounts[id]
	if !ok {
		l.mu.RUnlock()
		return nil, fmt.Errorf("account %s not found", id)
	}
	// Copy the metadata struct while still under the read lock: the writer
	// (PostTransaction balance refresh) mutates *meta in place.
	acct := *meta
	client := l.client
	l.mu.RUnlock()

	if client == nil {
		return nil, ErrTigerBeetleUnavailable
	}

	bal, err := client.GetAccountBalanceFull(context.Background(), ledgerAccountUint128(id))
	if err != nil {
		return nil, fmt.Errorf("tigerbeetle balance lookup for %s: %w", id, err)
	}
	acct.Balance = bal.NetBalance
	acct.PendingDebit = int64(bal.DebitsPending)
	acct.PendingCredit = int64(bal.CreditsPending)
	return &acct, nil
}

// GetAccountEntries returns journal entries confirmed by the cluster for an
// account. Entries are recorded only after the cluster confirms the posting.
func (l *TigerBeetleLedger) GetAccountEntries(accountID string) []TBLedgerEntry {
	l.mu.RLock()
	defer l.mu.RUnlock()
	var result []TBLedgerEntry
	for _, e := range l.entries {
		if e.AccountID == accountID {
			result = append(result, e)
		}
	}
	return result
}

// GetTrialBalance returns real cluster balances for every CoA account with a
// non-zero balance. When the cluster is unreachable it returns an empty map
// and logs the failure — callers needing hard guarantees should use
// GetAccount (which returns an error) instead.
func (l *TigerBeetleLedger) GetTrialBalance() map[string]int64 {
	l.mu.RLock()
	client := l.client
	ids := make([]string, 0, len(l.accounts))
	for id := range l.accounts {
		ids = append(ids, id)
	}
	l.mu.RUnlock()

	balance := make(map[string]int64)
	if client == nil {
		log.Printf("[TigerBeetle] trial balance unavailable: %v", ErrTigerBeetleUnavailable)
		return balance
	}
	for _, id := range ids {
		bal, err := client.GetAccountBalance(context.Background(), ledgerAccountUint128(id))
		if err != nil {
			log.Printf("[TigerBeetle] trial balance: lookup failed for %s: %v", id, err)
			continue
		}
		if bal != 0 {
			l.mu.RLock()
			name := l.accounts[id].Name
			l.mu.RUnlock()
			balance[id+" "+name] = bal
		}
	}
	return balance
}

// Posting rule helpers. Each returns ErrTigerBeetleUnavailable (never a
// fabricated "posted" result) when the cluster is unreachable.
func PostTellerDeposit(ledger *TigerBeetleLedger, amount int64, ref, actor string) (*LedgerTransaction, error) {
	return ledger.PostTransaction(LedgerTransaction{
		Description: "Teller cash deposit",
		Domain:      "teller",
		PostedBy:    actor,
		Entries: []TBLedgerEntry{
			{AccountID: "1000", DebitAmount: amount, Description: "Cash received", Reference: ref, Domain: "teller"},
			{AccountID: "2000", CreditAmount: amount, Description: "Customer deposit", Reference: ref, Domain: "teller"},
		},
	})
}

func PostTellerWithdrawal(ledger *TigerBeetleLedger, amount int64, ref, actor string) (*LedgerTransaction, error) {
	return ledger.PostTransaction(LedgerTransaction{
		Description: "Teller cash withdrawal",
		Domain:      "teller",
		PostedBy:    actor,
		Entries: []TBLedgerEntry{
			{AccountID: "2000", DebitAmount: amount, Description: "Customer withdrawal", Reference: ref, Domain: "teller"},
			{AccountID: "1000", CreditAmount: amount, Description: "Cash disbursed", Reference: ref, Domain: "teller"},
		},
	})
}

func PostLoanDisbursement(ledger *TigerBeetleLedger, amount int64, loanAccount, ref, actor string) (*LedgerTransaction, error) {
	return ledger.PostTransaction(LedgerTransaction{
		Description: "Loan disbursement",
		Domain:      "loans",
		PostedBy:    actor,
		Entries: []TBLedgerEntry{
			{AccountID: loanAccount, DebitAmount: amount, Description: "Loan receivable", Reference: ref, Domain: "loans"},
			{AccountID: "1100", CreditAmount: amount, Description: "Bank funding", Reference: ref, Domain: "loans"},
		},
	})
}

func PostLoanRepayment(ledger *TigerBeetleLedger, principal, interest int64, loanAccount, ref, actor string) (*LedgerTransaction, error) {
	return ledger.PostTransaction(LedgerTransaction{
		Description: "Loan repayment",
		Domain:      "loans",
		PostedBy:    actor,
		Entries: []TBLedgerEntry{
			{AccountID: "1100", DebitAmount: principal + interest, Description: "Cash received", Reference: ref, Domain: "loans"},
			{AccountID: loanAccount, CreditAmount: principal, Description: "Principal repayment", Reference: ref, Domain: "loans"},
			{AccountID: "4000", CreditAmount: interest, Description: "Interest income", Reference: ref, Domain: "loans"},
		},
	})
}

func PostLCIssuance(ledger *TigerBeetleLedger, amount int64, fee int64, ref, actor string) (*LedgerTransaction, error) {
	return ledger.PostTransaction(LedgerTransaction{
		Description: "Letter of Credit issuance",
		Domain:      "trade-finance",
		PostedBy:    actor,
		Entries: []TBLedgerEntry{
			{AccountID: "1300", DebitAmount: amount, Description: "LC contingent asset", Reference: ref, Domain: "trade-finance"},
			{AccountID: "2600", CreditAmount: amount, Description: "LC obligation", Reference: ref, Domain: "trade-finance"},
			{AccountID: "1100", DebitAmount: fee, Description: "LC fee received", Reference: ref, Domain: "trade-finance"},
			{AccountID: "4300", CreditAmount: fee, Description: "Trade finance fee income", Reference: ref, Domain: "trade-finance"},
		},
	})
}

func PostInsurancePremium(ledger *TigerBeetleLedger, amount int64, ref, actor string) (*LedgerTransaction, error) {
	return ledger.PostTransaction(LedgerTransaction{
		Description: "Insurance premium collection",
		Domain:      "insurance",
		PostedBy:    actor,
		Entries: []TBLedgerEntry{
			{AccountID: "1100", DebitAmount: amount, Description: "Premium received", Reference: ref, Domain: "insurance"},
			{AccountID: "4500", CreditAmount: amount, Description: "Premium income", Reference: ref, Domain: "insurance"},
		},
	})
}
