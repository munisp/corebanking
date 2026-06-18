package middleware

import (
	"fmt"
	"log"
	"os"
	"sync"
	"time"
)

// A2: Double-Entry Ledger with TigerBeetle
// Every monetary operation creates balanced debit/credit entries.

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
	Balance       int64       `json:"balance"`       // in minor units (kobo)
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
	Description string        `json:"description"`
	Domain      string        `json:"domain"`
	Status      string        `json:"status"` // "pending", "posted", "reversed"
	PostedAt    time.Time     `json:"postedAt"`
	PostedBy    string        `json:"postedBy"`
}

type TigerBeetleLedger struct {
	addresses string
	clusterID string
	mu        sync.RWMutex
	accounts  map[string]*LedgerAccount
	entries   []TBLedgerEntry
	txns      []LedgerTransaction
}

func NewTigerBeetleLedger() *TigerBeetleLedger {
	addresses := os.Getenv("TIGERBEETLE_ADDRESSES")
	if addresses == "" {
		addresses = "tigerbeetle:3000"
	}
	clusterID := os.Getenv("TIGERBEETLE_CLUSTER_ID")
	if clusterID == "" {
		clusterID = "54bankcluster00000000000000000000"
	}

	ledger := &TigerBeetleLedger{
		addresses: addresses,
		clusterID: clusterID,
		accounts:  make(map[string]*LedgerAccount),
	}
	ledger.seedChartOfAccounts()
	return ledger
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

func (l *TigerBeetleLedger) PostTransaction(txn LedgerTransaction) (*LedgerTransaction, error) {
	l.mu.Lock()
	defer l.mu.Unlock()

	// Validate balanced entries
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

		acct := l.accounts[entry.AccountID]
		acct.Balance += entry.DebitAmount - entry.CreditAmount
		if acct.AccountType == AccountTypeLiability || acct.AccountType == AccountTypeEquity || acct.AccountType == AccountTypeRevenue {
			acct.Balance = -(entry.CreditAmount - entry.DebitAmount) + acct.Balance + (entry.CreditAmount - entry.DebitAmount)
		}

		l.entries = append(l.entries, entry)
		txn.Entries[i] = entry
	}
	l.txns = append(l.txns, txn)

	log.Printf("[TigerBeetle] Posted %s: %d entries, debit=%d credit=%d", txn.ID, len(txn.Entries), totalDebit, totalCredit)
	return &txn, nil
}

func (l *TigerBeetleLedger) GetAccount(id string) (*LedgerAccount, error) {
	l.mu.RLock()
	defer l.mu.RUnlock()
	acct, ok := l.accounts[id]
	if !ok {
		return nil, fmt.Errorf("account %s not found", id)
	}
	return acct, nil
}

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

func (l *TigerBeetleLedger) GetTrialBalance() map[string]int64 {
	l.mu.RLock()
	defer l.mu.RUnlock()
	balance := make(map[string]int64)
	for id, acct := range l.accounts {
		if acct.Balance != 0 {
			balance[id+" "+acct.Name] = acct.Balance
		}
	}
	return balance
}

// Posting rule helpers
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
