package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"
)

// TigerBeetleClient handles communication with TigerBeetle ledger
type TigerBeetleClient struct {
	baseURL    string
	httpClient *http.Client
}

// NewTigerBeetleClient creates a new TigerBeetle client
func NewTigerBeetleClient(baseURL string) *TigerBeetleClient {
	return &TigerBeetleClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// TBAccount represents a TigerBeetle account
type TBAccount struct {
	ID             string `json:"id"`
	Ledger         int    `json:"ledger"`
	Code           int    `json:"code"`
	Flags          int    `json:"flags"`
	UserData128    string `json:"user_data_128"`
	UserData64     string `json:"user_data_64"`
	UserData32     string `json:"user_data_32"`
	DebitsPending  int64  `json:"debits_pending"`
	DebitsPosted   int64  `json:"debits_posted"`
	CreditsPending int64  `json:"credits_pending"`
	CreditsPosted  int64  `json:"credits_posted"`
	Timestamp      int64  `json:"timestamp"`
}

// TBTransfer represents a TigerBeetle transfer
type TBTransfer struct {
	ID            string `json:"id"`
	DebitAccount  string `json:"debit_account_id"`
	CreditAccount string `json:"credit_account_id"`
	Amount        int64  `json:"amount"`
	Ledger        int    `json:"ledger"`
	Code          int    `json:"code"`
	Flags         int    `json:"flags"`
	UserData128   string `json:"user_data_128"`
	UserData64    string `json:"user_data_64"`
	UserData32    string `json:"user_data_32"`
	PendingID     string `json:"pending_id,omitempty"`
	Timeout       int    `json:"timeout"`
	Timestamp     int64  `json:"timestamp"`
}

// Ledger codes for virtual accounts
const (
	LedgerMain           = 1
	LedgerVirtualAccount = 2
	LedgerEscrow         = 3
	LedgerLoanCollection = 4
	LedgerMerchant       = 5
)

// Account codes
const (
	AccountCodeGeneral        = 1000
	AccountCodeLoanCollection = 1001
	AccountCodeMerchant       = 1002
	AccountCodeEscrow         = 1003
	AccountCodeAgent          = 1004
	AccountCodePayroll        = 1005
	AccountCodeNostro         = 9000 // Incoming funds holding
)

// Transfer codes
const (
	TransferCodeCredit   = 1
	TransferCodeDebit    = 2
	TransferCodeReversal = 3
	TransferCodeFee      = 4
)

// CreateEscrowHoldingAccount creates a TigerBeetle account to hold escrow funds until release.
// Only escrow VANs need their own ledger account — all other purposes credit the parent account directly.
func (c *TigerBeetleClient) CreateEscrowHoldingAccount(ctx context.Context, van *VirtualAccount) error {
	account := TBAccount{
		ID:          van.ID,
		Ledger:      LedgerEscrow,
		Code:        AccountCodeEscrow,
		Flags:       0,
		UserData128: van.VAN,
		UserData64:  van.BankID,
		UserData32:  van.CustomerID,
	}

	return c.createAccount(ctx, &account)
}

// createAccount creates an account in TigerBeetle
func (c *TigerBeetleClient) createAccount(ctx context.Context, account *TBAccount) error {
	payload := map[string]interface{}{
		"accounts": []TBAccount{*account},
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal account: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/accounts/create", strings.NewReader(string(jsonData)))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("TigerBeetle returned status %d", resp.StatusCode)
	}

	log.Printf("Created TigerBeetle account %s for VAN %s", account.ID, account.UserData128)
	return nil
}

// CreditVANAccount processes an inbound payment for a VAN.
// Non-escrow VANs credit the parent account directly (VAN is a routing alias, not a balance holder).
// Escrow VANs credit a dedicated holding account until funds are explicitly released.
// The VAN number and reference are stored in UserData so per-VAN history can be queried from TigerBeetle.
func (c *TigerBeetleClient) CreditVANAccount(ctx context.Context, van *VirtualAccount, payment *VANPayment) (string, error) {
	creditAccount := van.ParentAccountID
	if van.Purpose == "escrow" {
		creditAccount = van.ID // escrow holding account created at VAN creation
	}

	transfer := TBTransfer{
		ID:            payment.ID,
		DebitAccount:  "nostro-" + van.BankID,
		CreditAccount: creditAccount,
		Amount:        int64(payment.Amount * 100),
		Ledger:        getLedgerForPurpose(van.Purpose),
		Code:          TransferCodeCredit,
		Flags:         0,
		UserData128:   van.VAN,           // VAN number — enables per-VAN transfer queries
		UserData64:    payment.TransactionRef,
		UserData32:    van.ReferenceID,   // loan ID, merchant ID, etc.
	}

	return c.createTransfer(ctx, &transfer)
}

// ReleaseEscrow transfers held escrow funds to the beneficiary account.
func (c *TigerBeetleClient) ReleaseEscrow(ctx context.Context, van *VirtualAccount, beneficiaryAccountID string) (string, error) {
	balance, err := c.GetAccountBalance(ctx, van.ID)
	if err != nil {
		return "", fmt.Errorf("failed to get escrow balance: %w", err)
	}
	if balance.Available <= 0 {
		return "", fmt.Errorf("no funds available in escrow")
	}

	transferID := fmt.Sprintf("escrow-release-%s-%d", van.ID, time.Now().UnixNano())
	transfer := TBTransfer{
		ID:            transferID,
		DebitAccount:  van.ID,
		CreditAccount: beneficiaryAccountID,
		Amount:        int64(balance.Available * 100),
		Ledger:        LedgerEscrow,
		Code:          TransferCodeDebit,
		Flags:         0,
		UserData128:   van.VAN,
		UserData64:    van.ReferenceID,
		UserData32:    "release",
	}
	return c.createTransfer(ctx, &transfer)
}

// ReverseEscrow returns held escrow funds to the parent account (e.g. dispute or cancellation).
func (c *TigerBeetleClient) ReverseEscrow(ctx context.Context, van *VirtualAccount) (string, error) {
	balance, err := c.GetAccountBalance(ctx, van.ID)
	if err != nil {
		return "", fmt.Errorf("failed to get escrow balance: %w", err)
	}
	if balance.Available <= 0 {
		return "", fmt.Errorf("no funds available in escrow")
	}

	transferID := fmt.Sprintf("escrow-reverse-%s-%d", van.ID, time.Now().UnixNano())
	transfer := TBTransfer{
		ID:            transferID,
		DebitAccount:  van.ID,
		CreditAccount: van.ParentAccountID,
		Amount:        int64(balance.Available * 100),
		Ledger:        LedgerEscrow,
		Code:          TransferCodeReversal,
		Flags:         0,
		UserData128:   van.VAN,
		UserData64:    van.ReferenceID,
		UserData32:    "reverse",
	}
	return c.createTransfer(ctx, &transfer)
}

// createTransfer creates a transfer in TigerBeetle
func (c *TigerBeetleClient) createTransfer(ctx context.Context, transfer *TBTransfer) (string, error) {
	payload := map[string]interface{}{
		"transfers": []TBTransfer{*transfer},
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal transfer: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/transfers/create", strings.NewReader(string(jsonData)))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return "", fmt.Errorf("TigerBeetle returned status %d", resp.StatusCode)
	}

	log.Printf("Created TigerBeetle transfer %s", transfer.ID)
	return transfer.ID, nil
}

// GetAccountBalance retrieves the balance of a VAN sub-account
func (c *TigerBeetleClient) GetAccountBalance(ctx context.Context, accountID string) (*AccountBalance, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/accounts/"+accountID, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("TigerBeetle returned status %d", resp.StatusCode)
	}

	var account TBAccount
	if err := json.NewDecoder(resp.Body).Decode(&account); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &AccountBalance{
		AccountID:      accountID,
		CreditsPosted:  float64(account.CreditsPosted) / 100,
		DebitsPosted:   float64(account.DebitsPosted) / 100,
		CreditsPending: float64(account.CreditsPending) / 100,
		DebitsPending:  float64(account.DebitsPending) / 100,
		Available:      float64(account.CreditsPosted-account.DebitsPosted-account.DebitsPending) / 100,
	}, nil
}

// AccountBalance represents the balance of an account
type AccountBalance struct {
	AccountID      string  `json:"account_id"`
	CreditsPosted  float64 `json:"credits_posted"`
	DebitsPosted   float64 `json:"debits_posted"`
	CreditsPending float64 `json:"credits_pending"`
	DebitsPending  float64 `json:"debits_pending"`
	Available      float64 `json:"available"`
}

// GetTransferHistory retrieves transfer history for an account
func (c *TigerBeetleClient) GetTransferHistory(ctx context.Context, accountID string, limit int) ([]TBTransfer, error) {
	url := fmt.Sprintf("%s/accounts/%s/transfers?limit=%d", c.baseURL, accountID, limit)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("TigerBeetle returned status %d", resp.StatusCode)
	}

	var transfers []TBTransfer
	if err := json.NewDecoder(resp.Body).Decode(&transfers); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return transfers, nil
}

// CreatePendingTransfer creates a pending (two-phase) transfer.
// Credits the parent account for non-escrow VANs, or the escrow holding account for escrow VANs.
func (c *TigerBeetleClient) CreatePendingTransfer(ctx context.Context, van *VirtualAccount, amount float64, reference string) (string, error) {
	transferID := fmt.Sprintf("pending-%s-%d", van.ID, time.Now().UnixNano())

	creditAccount := van.ParentAccountID
	if van.Purpose == "escrow" {
		creditAccount = van.ID
	}

	transfer := TBTransfer{
		ID:            transferID,
		DebitAccount:  "nostro-" + van.BankID,
		CreditAccount: creditAccount,
		Amount:        int64(amount * 100),
		Ledger:        getLedgerForPurpose(van.Purpose),
		Code:          TransferCodeCredit,
		Flags:         1, // Pending flag
		UserData128:   van.VAN,
		UserData64:    reference,
		Timeout:       86400, // 24 hours
	}

	return c.createTransfer(ctx, &transfer)
}

// CommitPendingTransfer commits a pending transfer
func (c *TigerBeetleClient) CommitPendingTransfer(ctx context.Context, pendingID string) error {
	transfer := TBTransfer{
		ID:        fmt.Sprintf("commit-%s", pendingID),
		PendingID: pendingID,
		Flags:     2, // Post pending flag
	}

	_, err := c.createTransfer(ctx, &transfer)
	return err
}

// VoidPendingTransfer voids a pending transfer
func (c *TigerBeetleClient) VoidPendingTransfer(ctx context.Context, pendingID string) error {
	transfer := TBTransfer{
		ID:        fmt.Sprintf("void-%s", pendingID),
		PendingID: pendingID,
		Flags:     4, // Void pending flag
	}

	_, err := c.createTransfer(ctx, &transfer)
	return err
}

// Helper functions

func getLedgerForPurpose(purpose string) int {
	ledgers := map[string]int{
		"loan_collection": LedgerLoanCollection,
		"merchant":        LedgerMerchant,
		"escrow":          LedgerEscrow,
		"agent":           LedgerVirtualAccount,
		"payroll":         LedgerVirtualAccount,
		"general":         LedgerVirtualAccount,
	}
	if ledger, ok := ledgers[purpose]; ok {
		return ledger
	}
	return LedgerVirtualAccount
}

// EnsureNostroAccount ensures the bank's nostro account exists
func (c *TigerBeetleClient) EnsureNostroAccount(ctx context.Context, bankID string) error {
	accountID := "nostro-" + bankID

	// Check if account exists
	_, err := c.GetAccountBalance(ctx, accountID)
	if err == nil {
		return nil // Account exists
	}

	// Create nostro account
	account := TBAccount{
		ID:          accountID,
		Ledger:      LedgerMain,
		Code:        AccountCodeNostro,
		Flags:       0,
		UserData128: "nostro",
		UserData64:  bankID,
		UserData32:  "incoming",
	}

	return c.createAccount(ctx, &account)
}

// ReconcileVANBalance reconciles the VAN's recorded TotalReceived against TigerBeetle.
// Escrow VANs have their own holding account, so we query its balance directly.
// Non-escrow VANs credit the parent account directly; we pass their payments sum as ledgerTotal.
func (c *TigerBeetleClient) ReconcileVANBalance(ctx context.Context, van *VirtualAccount, ledgerTotal float64) (*ReconciliationResult, error) {
	if van.Purpose == "escrow" {
		balance, err := c.GetAccountBalance(ctx, van.ID)
		if err != nil {
			return nil, err
		}
		ledgerTotal = balance.CreditsPosted - balance.DebitsPosted
	}

	diff := van.TotalReceived - ledgerTotal
	result := &ReconciliationResult{
		VANID:        van.ID,
		VAN:          van.VAN,
		LocalBalance: van.TotalReceived,
		LedgerBalance: ledgerTotal,
		Difference:   diff,
		IsReconciled: diff > -0.01 && diff < 0.01,
		ReconciledAt: time.Now(),
	}
	if result.IsReconciled {
		result.Difference = 0
	}

	return result, nil
}

// ReconciliationResult represents the result of a balance reconciliation
type ReconciliationResult struct {
	VANID         string    `json:"van_id"`
	VAN           string    `json:"van"`
	LocalBalance  float64   `json:"local_balance"`
	LedgerBalance float64   `json:"ledger_balance"`
	Difference    float64   `json:"difference"`
	IsReconciled  bool      `json:"is_reconciled"`
	ReconciledAt  time.Time `json:"reconciled_at"`
}
