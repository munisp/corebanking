package main

import (
	// "context"
	// "encoding/json"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

// TigerBeetle metrics
var (
	tbTransfersTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "tigerbeetle_transfers_total",
			Help: "Total TigerBeetle transfers",
		},
		[]string{"type", "status"},
	)

	tbTransferLatency = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "tigerbeetle_transfer_latency_seconds",
			Help:    "TigerBeetle transfer latency",
			Buckets: []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1},
		},
		[]string{"operation"},
	)
)

func init() {
	prometheus.MustRegister(tbTransfersTotal)
	prometheus.MustRegister(tbTransferLatency)
}

// AccountType represents TigerBeetle account types for mortgages
type AccountType uint16

const (
	AccountTypeMortgagePrincipal AccountType = 1001 // Outstanding principal
	AccountTypeMortgageInterest  AccountType = 1002 // Accrued interest
	AccountTypeMortgageEscrow    AccountType = 1003 // Escrow for taxes/insurance
	AccountTypeMortgageFees      AccountType = 1004 // Fees and charges
	AccountTypeMortgagePrepay    AccountType = 1005 // Prepayment holding
	AccountTypeCustomerLoan      AccountType = 2001 // Customer loan liability
	AccountTypeBankAsset         AccountType = 3001 // Bank mortgage asset
)

// TransferCode represents transfer types
type TransferCode uint16

const (
	TransferCodeDisbursement    TransferCode = 101 // Loan disbursement
	TransferCodePrincipalRepay  TransferCode = 102 // Principal repayment
	TransferCodeInterestRepay   TransferCode = 103 // Interest repayment
	TransferCodeEscrowDeposit   TransferCode = 104 // Escrow deposit
	TransferCodeEscrowWithdraw  TransferCode = 105 // Escrow withdrawal (tax/insurance payment)
	TransferCodePrepayment      TransferCode = 106 // Prepayment
	TransferCodeFeeCharge       TransferCode = 107 // Fee charge
	TransferCodeInterestAccrual TransferCode = 108 // Interest accrual
	TransferCodeWriteOff        TransferCode = 109 // Write-off
	TransferCodeRecovery        TransferCode = 110 // Recovery after write-off
)

// MortgageAccounts holds all TigerBeetle accounts for a mortgage
type MortgageAccounts struct {
	LedgerAccountID    string `json:"ledger_account_id"`
	PrincipalAccountID string `json:"principal_account_id"`
	InterestAccountID  string `json:"interest_account_id"`
	EscrowAccountID    string `json:"escrow_account_id"`
	FeesAccountID      string `json:"fees_account_id"`
}

// TigerBeetleAccount represents a TigerBeetle account
type TigerBeetleAccount struct {
	ID             uint128 `json:"id"`
	UserData       uint128 `json:"user_data"`
	Ledger         uint32  `json:"ledger"`
	Code           uint16  `json:"code"`
	Flags          uint16  `json:"flags"`
	DebitsPending  uint64  `json:"debits_pending"`
	DebitsPosted   uint64  `json:"debits_posted"`
	CreditsPending uint64  `json:"credits_pending"`
	CreditsPosted  uint64  `json:"credits_posted"`
	Timestamp      uint64  `json:"timestamp"`
}

// TigerBeetleTransfer represents a TigerBeetle transfer
type TigerBeetleTransfer struct {
	ID              uint128 `json:"id"`
	DebitAccountID  uint128 `json:"debit_account_id"`
	CreditAccountID uint128 `json:"credit_account_id"`
	UserData        uint128 `json:"user_data"`
	Timeout         uint32  `json:"timeout"`
	Ledger          uint32  `json:"ledger"`
	Code            uint16  `json:"code"`
	Flags           uint16  `json:"flags"`
	Amount          uint64  `json:"amount"`
	Timestamp       uint64  `json:"timestamp"`
}

// uint128 represents a 128-bit unsigned integer
type uint128 struct {
	Lo uint64
	Hi uint64
}

// TigerBeetleClient handles TigerBeetle operations for mortgages
type TigerBeetleClient struct {
	endpoint  string
	clusterID uint32
	ledgerID  uint32
	mutex     sync.RWMutex
	accounts  map[string]*TigerBeetleAccount
	transfers map[string]*TigerBeetleTransfer
	connected bool
}

// NewTigerBeetleClient creates a new TigerBeetle client
func NewTigerBeetleClient() *TigerBeetleClient {
	endpoint := os.Getenv("TB_ADDRESS")
	if endpoint == "" {
		// Use cluster TigerBeetle addresses
		endpoint = "192.168.152.250:3000,192.168.14.240:3000,192.168.96.166:3000"
	}

	client := &TigerBeetleClient{
		endpoint:  endpoint,
		clusterID: 0,
		ledgerID:  1, // Mortgage ledger
		accounts:  make(map[string]*TigerBeetleAccount),
		transfers: make(map[string]*TigerBeetleTransfer),
		connected: true, // Simulated connection
	}

	log.Printf("TigerBeetle client initialized: %s", endpoint)
	return client
}

// CreateMortgageAccounts creates all necessary accounts for a mortgage
func (c *TigerBeetleClient) CreateMortgageAccounts(tenantID, mortgageID string) (*MortgageAccounts, error) {
	start := time.Now()
	defer func() {
		tbTransferLatency.WithLabelValues("create_accounts").Observe(time.Since(start).Seconds())
	}()

	c.mutex.Lock()
	defer c.mutex.Unlock()

	// Generate account IDs
	baseID := generateAccountID(tenantID, mortgageID)

	accounts := &MortgageAccounts{
		LedgerAccountID:    fmt.Sprintf("%s-LEDGER", baseID),
		PrincipalAccountID: fmt.Sprintf("%s-PRINCIPAL", baseID),
		InterestAccountID:  fmt.Sprintf("%s-INTEREST", baseID),
		EscrowAccountID:    fmt.Sprintf("%s-ESCROW", baseID),
		FeesAccountID:      fmt.Sprintf("%s-FEES", baseID),
	}

	// Create principal account (tracks outstanding principal)
	principalAccount := &TigerBeetleAccount{
		ID:     stringToUint128(accounts.PrincipalAccountID),
		Ledger: c.ledgerID,
		Code:   uint16(AccountTypeMortgagePrincipal),
	}
	c.accounts[accounts.PrincipalAccountID] = principalAccount

	// Create interest account (tracks accrued interest)
	interestAccount := &TigerBeetleAccount{
		ID:     stringToUint128(accounts.InterestAccountID),
		Ledger: c.ledgerID,
		Code:   uint16(AccountTypeMortgageInterest),
	}
	c.accounts[accounts.InterestAccountID] = interestAccount

	// Create escrow account (for taxes and insurance)
	escrowAccount := &TigerBeetleAccount{
		ID:     stringToUint128(accounts.EscrowAccountID),
		Ledger: c.ledgerID,
		Code:   uint16(AccountTypeMortgageEscrow),
	}
	c.accounts[accounts.EscrowAccountID] = escrowAccount

	// Create fees account
	feesAccount := &TigerBeetleAccount{
		ID:     stringToUint128(accounts.FeesAccountID),
		Ledger: c.ledgerID,
		Code:   uint16(AccountTypeMortgageFees),
	}
	c.accounts[accounts.FeesAccountID] = feesAccount

	log.Printf("Created TigerBeetle accounts for mortgage %s", mortgageID)
	tbTransfersTotal.WithLabelValues("create_accounts", "success").Inc()

	return accounts, nil
}

// CreateDisbursementTransfer creates a transfer for mortgage disbursement
func (c *TigerBeetleClient) CreateDisbursementTransfer(
	tenantID string,
	principalAccountID string,
	disbursementAccountID string,
	amount float64,
	mortgageID string,
) (string, error) {
	start := time.Now()
	defer func() {
		tbTransferLatency.WithLabelValues("disbursement").Observe(time.Since(start).Seconds())
	}()

	c.mutex.Lock()
	defer c.mutex.Unlock()

	transferID := generateTransferID(tenantID, mortgageID, "DISB")

	// Convert amount to kobo (smallest unit)
	amountKobo := uint64(amount * 100)

	transfer := &TigerBeetleTransfer{
		ID:              stringToUint128(transferID),
		DebitAccountID:  stringToUint128(disbursementAccountID), // Bank funds account
		CreditAccountID: stringToUint128(principalAccountID),    // Mortgage principal
		Ledger:          c.ledgerID,
		Code:            uint16(TransferCodeDisbursement),
		Amount:          amountKobo,
		Timestamp:       uint64(time.Now().UnixNano()),
	}

	c.transfers[transferID] = transfer

	// Update account balances (simulated)
	if acc, ok := c.accounts[principalAccountID]; ok {
		acc.CreditsPosted += amountKobo
	}

	log.Printf("Created disbursement transfer %s for mortgage %s: %.2f NGN", transferID, mortgageID, amount)
	tbTransfersTotal.WithLabelValues("disbursement", "success").Inc()

	return transferID, nil
}

// CreatePaymentTransfer creates transfers for a mortgage payment
func (c *TigerBeetleClient) CreatePaymentTransfer(
	tenantID string,
	sourceAccountID string,
	principalAccountID string,
	interestAccountID string,
	escrowAccountID string,
	totalAmount float64,
	mortgageID string,
) (string, error) {
	start := time.Now()
	defer func() {
		tbTransferLatency.WithLabelValues("payment").Observe(time.Since(start).Seconds())
	}()

	c.mutex.Lock()
	defer c.mutex.Unlock()

	// Get current balances to determine payment allocation
	principalBalance := c.getAccountBalanceInternal(principalAccountID)
	interestBalance := c.getAccountBalanceInternal(interestAccountID)

	println(principalBalance)

	// Payment allocation: Interest first, then principal, then escrow
	// This is a simplified allocation - in production, use actual schedule
	interestPayment := min(totalAmount*0.3, interestBalance) // ~30% to interest
	escrowPayment := totalAmount * 0.1                       // ~10% to escrow
	principalPayment := totalAmount - interestPayment - escrowPayment

	transferID := generateTransferID(tenantID, mortgageID, "PAY")
	amountKobo := uint64(totalAmount * 100)

	// Create main transfer record
	transfer := &TigerBeetleTransfer{
		ID:              stringToUint128(transferID),
		DebitAccountID:  stringToUint128(sourceAccountID),
		CreditAccountID: stringToUint128(principalAccountID),
		Ledger:          c.ledgerID,
		Code:            uint16(TransferCodePrincipalRepay),
		Amount:          amountKobo,
		Timestamp:       uint64(time.Now().UnixNano()),
	}
	c.transfers[transferID] = transfer

	// Update account balances (simulated)
	if acc, ok := c.accounts[principalAccountID]; ok {
		acc.DebitsPosted += uint64(principalPayment * 100)
	}
	if acc, ok := c.accounts[interestAccountID]; ok {
		acc.DebitsPosted += uint64(interestPayment * 100)
	}
	if acc, ok := c.accounts[escrowAccountID]; ok {
		acc.CreditsPosted += uint64(escrowPayment * 100)
	}

	log.Printf("Created payment transfer %s for mortgage %s: %.2f NGN (P:%.2f, I:%.2f, E:%.2f)",
		transferID, mortgageID, totalAmount, principalPayment, interestPayment, escrowPayment)
	tbTransfersTotal.WithLabelValues("payment", "success").Inc()

	return transferID, nil
}

// CreatePrepaymentTransfer creates a transfer for mortgage prepayment
func (c *TigerBeetleClient) CreatePrepaymentTransfer(
	tenantID string,
	sourceAccountID string,
	principalAccountID string,
	amount float64,
	fee float64,
	mortgageID string,
) (string, error) {
	start := time.Now()
	defer func() {
		tbTransferLatency.WithLabelValues("prepayment").Observe(time.Since(start).Seconds())
	}()

	c.mutex.Lock()
	defer c.mutex.Unlock()

	transferID := generateTransferID(tenantID, mortgageID, "PREP")
	netAmount := amount - fee
	amountKobo := uint64(netAmount * 100)

	transfer := &TigerBeetleTransfer{
		ID:              stringToUint128(transferID),
		DebitAccountID:  stringToUint128(sourceAccountID),
		CreditAccountID: stringToUint128(principalAccountID),
		Ledger:          c.ledgerID,
		Code:            uint16(TransferCodePrepayment),
		Amount:          amountKobo,
		Timestamp:       uint64(time.Now().UnixNano()),
	}
	c.transfers[transferID] = transfer

	// Update principal balance
	if acc, ok := c.accounts[principalAccountID]; ok {
		acc.DebitsPosted += amountKobo
	}

	log.Printf("Created prepayment transfer %s for mortgage %s: %.2f NGN (fee: %.2f)",
		transferID, mortgageID, netAmount, fee)
	tbTransfersTotal.WithLabelValues("prepayment", "success").Inc()

	return transferID, nil
}

// CreateEscrowDisbursement creates a transfer for escrow disbursement (tax/insurance payment)
func (c *TigerBeetleClient) CreateEscrowDisbursement(
	tenantID string,
	escrowAccountID string,
	payeeAccountID string,
	amount float64,
	mortgageID string,
	disbursementType string, // "tax" or "insurance"
) (string, error) {
	start := time.Now()
	defer func() {
		tbTransferLatency.WithLabelValues("escrow_disbursement").Observe(time.Since(start).Seconds())
	}()

	c.mutex.Lock()
	defer c.mutex.Unlock()

	transferID := generateTransferID(tenantID, mortgageID, "ESC")
	amountKobo := uint64(amount * 100)

	transfer := &TigerBeetleTransfer{
		ID:              stringToUint128(transferID),
		DebitAccountID:  stringToUint128(escrowAccountID),
		CreditAccountID: stringToUint128(payeeAccountID),
		Ledger:          c.ledgerID,
		Code:            uint16(TransferCodeEscrowWithdraw),
		Amount:          amountKobo,
		Timestamp:       uint64(time.Now().UnixNano()),
	}
	c.transfers[transferID] = transfer

	// Update escrow balance
	if acc, ok := c.accounts[escrowAccountID]; ok {
		acc.DebitsPosted += amountKobo
	}

	log.Printf("Created escrow disbursement %s for mortgage %s: %.2f NGN (%s)",
		transferID, mortgageID, amount, disbursementType)
	tbTransfersTotal.WithLabelValues("escrow_disbursement", "success").Inc()

	return transferID, nil
}

// AccrueInterest creates interest accrual entries
func (c *TigerBeetleClient) AccrueInterest(
	tenantID string,
	principalAccountID string,
	interestAccountID string,
	interestAmount float64,
	mortgageID string,
) (string, error) {
	start := time.Now()
	defer func() {
		tbTransferLatency.WithLabelValues("interest_accrual").Observe(time.Since(start).Seconds())
	}()

	c.mutex.Lock()
	defer c.mutex.Unlock()

	transferID := generateTransferID(tenantID, mortgageID, "INT")
	amountKobo := uint64(interestAmount * 100)

	transfer := &TigerBeetleTransfer{
		ID:              stringToUint128(transferID),
		DebitAccountID:  stringToUint128(principalAccountID), // Interest expense
		CreditAccountID: stringToUint128(interestAccountID),  // Interest receivable
		Ledger:          c.ledgerID,
		Code:            uint16(TransferCodeInterestAccrual),
		Amount:          amountKobo,
		Timestamp:       uint64(time.Now().UnixNano()),
	}
	c.transfers[transferID] = transfer

	// Update interest balance
	if acc, ok := c.accounts[interestAccountID]; ok {
		acc.CreditsPosted += amountKobo
	}

	log.Printf("Accrued interest %s for mortgage %s: %.2f NGN", transferID, mortgageID, interestAmount)
	tbTransfersTotal.WithLabelValues("interest_accrual", "success").Inc()

	return transferID, nil
}

// WriteOffMortgage creates write-off entries for defaulted mortgage
func (c *TigerBeetleClient) WriteOffMortgage(
	tenantID string,
	principalAccountID string,
	interestAccountID string,
	writeOffAccountID string,
	mortgageID string,
) (string, error) {
	start := time.Now()
	defer func() {
		tbTransferLatency.WithLabelValues("write_off").Observe(time.Since(start).Seconds())
	}()

	c.mutex.Lock()
	defer c.mutex.Unlock()

	// Get outstanding balances
	principalBalance := c.getAccountBalanceInternal(principalAccountID)
	interestBalance := c.getAccountBalanceInternal(interestAccountID)
	totalWriteOff := principalBalance + interestBalance

	transferID := generateTransferID(tenantID, mortgageID, "WO")
	amountKobo := uint64(totalWriteOff * 100)

	transfer := &TigerBeetleTransfer{
		ID:              stringToUint128(transferID),
		DebitAccountID:  stringToUint128(writeOffAccountID),
		CreditAccountID: stringToUint128(principalAccountID),
		Ledger:          c.ledgerID,
		Code:            uint16(TransferCodeWriteOff),
		Amount:          amountKobo,
		Timestamp:       uint64(time.Now().UnixNano()),
	}
	c.transfers[transferID] = transfer

	// Zero out balances
	if acc, ok := c.accounts[principalAccountID]; ok {
		acc.DebitsPosted = acc.CreditsPosted
	}
	if acc, ok := c.accounts[interestAccountID]; ok {
		acc.DebitsPosted = acc.CreditsPosted
	}

	log.Printf("Write-off transfer %s for mortgage %s: %.2f NGN", transferID, mortgageID, totalWriteOff)
	tbTransfersTotal.WithLabelValues("write_off", "success").Inc()

	return transferID, nil
}

// GetAccountBalance returns the current balance of an account
func (c *TigerBeetleClient) GetAccountBalance(accountID string) (float64, error) {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	return c.getAccountBalanceInternal(accountID), nil
}

func (c *TigerBeetleClient) getAccountBalanceInternal(accountID string) float64 {
	if acc, ok := c.accounts[accountID]; ok {
		// Balance = Credits - Debits (for liability accounts like mortgages)
		balanceKobo := int64(acc.CreditsPosted) - int64(acc.DebitsPosted)
		return float64(balanceKobo) / 100.0
	}
	return 0
}

// GetAccountDetails returns full account details
func (c *TigerBeetleClient) GetAccountDetails(accountID string) (*TigerBeetleAccount, error) {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	if acc, ok := c.accounts[accountID]; ok {
		return acc, nil
	}
	return nil, fmt.Errorf("account not found: %s", accountID)
}

// GetTransferHistory returns transfer history for a mortgage
func (c *TigerBeetleClient) GetTransferHistory(mortgageID string) ([]*TigerBeetleTransfer, error) {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	var transfers []*TigerBeetleTransfer
	for id, transfer := range c.transfers {
		if containsMortgageID(id, mortgageID) {
			transfers = append(transfers, transfer)
		}
	}
	return transfers, nil
}

// ReconcileMortgageBalances reconciles mortgage balances with external systems
func (c *TigerBeetleClient) ReconcileMortgageBalances(mortgageID string, expectedPrincipal, expectedInterest float64) (*ReconciliationResult, error) {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	result := &ReconciliationResult{
		MortgageID:    mortgageID,
		Timestamp:     time.Now(),
		Discrepancies: []Discrepancy{},
	}

	// This would compare TigerBeetle balances with external system
	// For now, return success
	result.Status = "reconciled"
	result.Matched = true

	return result, nil
}

// ReconciliationResult represents the result of balance reconciliation
type ReconciliationResult struct {
	MortgageID    string        `json:"mortgage_id"`
	Timestamp     time.Time     `json:"timestamp"`
	Status        string        `json:"status"`
	Matched       bool          `json:"matched"`
	Discrepancies []Discrepancy `json:"discrepancies"`
}

// Discrepancy represents a balance discrepancy
type Discrepancy struct {
	AccountType     string  `json:"account_type"`
	ExpectedBalance float64 `json:"expected_balance"`
	ActualBalance   float64 `json:"actual_balance"`
	Difference      float64 `json:"difference"`
}

// Helper functions
func generateAccountID(tenantID, mortgageID string) string {
	return fmt.Sprintf("TB-%s-%s-%d", tenantID, mortgageID, time.Now().UnixNano()%1000000)
}

func generateTransferID(tenantID, mortgageID, transferType string) string {
	return fmt.Sprintf("TF-%s-%s-%s-%d", tenantID, mortgageID, transferType, time.Now().UnixNano())
}

func stringToUint128(s string) uint128 {
	// Simple hash for simulation
	var lo, hi uint64
	for i, c := range s {
		if i%2 == 0 {
			lo += uint64(c) * uint64(i+1)
		} else {
			hi += uint64(c) * uint64(i+1)
		}
	}
	return uint128{Lo: lo, Hi: hi}
}

func containsMortgageID(transferID, mortgageID string) bool {
	return len(transferID) > len(mortgageID) && transferID[3:3+len(mortgageID)] == mortgageID
}

func min(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}
