package main

import (
	"crypto/sha256"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	tb "github.com/tigerbeetle/tigerbeetle-go"
)

// TigerBeetle metrics — counters are only incremented for transfers the
// cluster actually accepted (status reflects the real outcome).
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

// TigerBeetleClient handles TigerBeetle operations for mortgages against a
// real TigerBeetle cluster (official tigerbeetle-go SDK). When the cluster
// cannot be reached, connected=false and every mutating method returns an
// error — no transfer, balance, or reconciliation result is ever simulated.
type TigerBeetleClient struct {
	endpoint  string
	clusterID uint32
	ledgerID  uint32
	mutex     sync.RWMutex
	tb        tb.Client
	connected bool
	// history indexes cluster-confirmed transfers created by this process,
	// keyed by mortgage ID, for GetTransferHistory. Never populated on failure.
	history map[string][]*TigerBeetleTransfer
}

// NewTigerBeetleClient creates a new TigerBeetle client and actually dials
// the cluster. On failure the client is returned with connected=false; all
// mutating operations then fail fast instead of simulating success.
func NewTigerBeetleClient() *TigerBeetleClient {
	endpoint := os.Getenv("TB_ADDRESS")
	if endpoint == "" {
		endpoint = os.Getenv("TIGERBEETLE_ADDRESSES")
	}

	client := &TigerBeetleClient{
		endpoint:  endpoint,
		clusterID: 0,
		ledgerID:  1, // Mortgage ledger
		connected: false,
		history:   make(map[string][]*TigerBeetleTransfer),
	}

	if endpoint == "" {
		log.Printf("TigerBeetle client NOT connected: TB_ADDRESS/TIGERBEETLE_ADDRESSES unset — all ledger operations will fail fast")
		return client
	}

	addresses := strings.Split(endpoint, ",")
	for i := range addresses {
		addresses[i] = strings.TrimSpace(addresses[i])
	}

	tbClient, err := tb.NewClient(tb.ToUint128(uint64(client.clusterID)), addresses)
	if err != nil {
		log.Printf("TigerBeetle client connection FAILED (%v) — all ledger operations will fail fast", err)
		return client
	}

	client.tb = tbClient
	client.connected = true
	log.Printf("TigerBeetle client connected to cluster at %s", endpoint)
	return client
}

// errNotConnected is returned by every operation when the cluster is down.
func (c *TigerBeetleClient) errNotConnected() error {
	return fmt.Errorf("tigerbeetle cluster unavailable (endpoint %q): mortgage ledger operation refused — no funds were moved or recorded", c.endpoint)
}

// accountUint128 maps a mortgage account string ID to a deterministic
// TigerBeetle Uint128 ID (SHA-256 namespaced). Stable across restarts, so
// balances survive process restarts; unlike the previous toy additive hash,
// this is collision-resistant.
func accountUint128(accountID string) tb.Uint128 {
	sum := sha256.Sum256([]byte("54bank/mortgage/" + accountID))
	var b [16]byte
	copy(b[:], sum[:16])
	return tb.BytesToUint128(b)
}

func toLocalUint128(v tb.Uint128) uint128 {
	lo, hi := v.Uint64()
	return uint128{Lo: lo, Hi: hi}
}

func nairaToKoboU64(amount float64) (uint64, error) {
	if amount <= 0 {
		return 0, fmt.Errorf("amount must be positive: %.2f", amount)
	}
	kobo := uint64(amount * 100)
	if kobo == 0 {
		return 0, fmt.Errorf("amount %.2f NGN rounds to zero kobo", amount)
	}
	return kobo, nil
}

// createTransfers submits transfers to the cluster and returns an error
// unless every transfer was created (or already existed, for idempotent
// retries). Metrics reflect the real outcome.
func (c *TigerBeetleClient) createTransfers(transfers []tb.Transfer, opLabel string) error {
	results, err := c.tb.CreateTransfers(transfers)
	if err != nil {
		tbTransfersTotal.WithLabelValues(opLabel, "error").Inc()
		return fmt.Errorf("tigerbeetle create transfers (%s): %w", opLabel, err)
	}
	for _, r := range results {
		if r.Status != tb.TransferCreated && r.Status != tb.TransferExists {
			tbTransfersTotal.WithLabelValues(opLabel, "rejected").Inc()
			return fmt.Errorf("tigerbeetle transfer rejected (%s): status=%v", opLabel, r.Status)
		}
	}
	tbTransfersTotal.WithLabelValues(opLabel, "success").Inc()
	return nil
}

// recordHistory indexes a cluster-confirmed transfer for GetTransferHistory.
func (c *TigerBeetleClient) recordHistory(mortgageID string, t tb.Transfer) {
	amt, _ := t.Amount.Uint64()
	rec := &TigerBeetleTransfer{
		ID:              toLocalUint128(t.ID),
		DebitAccountID:  toLocalUint128(t.DebitAccountID),
		CreditAccountID: toLocalUint128(t.CreditAccountID),
		UserData:        toLocalUint128(t.UserData128),
		Timeout:         t.Timeout,
		Ledger:          t.Ledger,
		Code:            t.Code,
		Flags:           t.Flags,
		Amount:          amt,
		Timestamp:       t.Timestamp,
	}
	c.history[mortgageID] = append(c.history[mortgageID], rec)
}

// CreateMortgageAccounts creates all necessary accounts for a mortgage in
// the TigerBeetle cluster. Fails when the cluster is unreachable.
func (c *TigerBeetleClient) CreateMortgageAccounts(tenantID, mortgageID string) (*MortgageAccounts, error) {
	start := time.Now()
	defer func() {
		tbTransferLatency.WithLabelValues("create_accounts").Observe(time.Since(start).Seconds())
	}()

	c.mutex.Lock()
	defer c.mutex.Unlock()

	if !c.connected {
		tbTransfersTotal.WithLabelValues("create_accounts", "error").Inc()
		return nil, c.errNotConnected()
	}

	// Generate account IDs
	baseID := generateAccountID(tenantID, mortgageID)

	accounts := &MortgageAccounts{
		LedgerAccountID:    fmt.Sprintf("%s-LEDGER", baseID),
		PrincipalAccountID: fmt.Sprintf("%s-PRINCIPAL", baseID),
		InterestAccountID:  fmt.Sprintf("%s-INTEREST", baseID),
		EscrowAccountID:    fmt.Sprintf("%s-ESCROW", baseID),
		FeesAccountID:      fmt.Sprintf("%s-FEES", baseID),
	}

	tbAccounts := []tb.Account{
		{ID: accountUint128(accounts.PrincipalAccountID), Ledger: c.ledgerID, Code: uint16(AccountTypeMortgagePrincipal)},
		{ID: accountUint128(accounts.InterestAccountID), Ledger: c.ledgerID, Code: uint16(AccountTypeMortgageInterest)},
		{ID: accountUint128(accounts.EscrowAccountID), Ledger: c.ledgerID, Code: uint16(AccountTypeMortgageEscrow)},
		{ID: accountUint128(accounts.FeesAccountID), Ledger: c.ledgerID, Code: uint16(AccountTypeMortgageFees)},
	}

	results, err := c.tb.CreateAccounts(tbAccounts)
	if err != nil {
		tbTransfersTotal.WithLabelValues("create_accounts", "error").Inc()
		return nil, fmt.Errorf("tigerbeetle create mortgage accounts: %w", err)
	}
	for _, r := range results {
		if r.Status != tb.AccountCreated && r.Status != tb.AccountExists {
			tbTransfersTotal.WithLabelValues("create_accounts", "rejected").Inc()
			return nil, fmt.Errorf("tigerbeetle account creation rejected: status=%v", r.Status)
		}
	}

	// Register account IDs so reconciliation can resolve them later.
	accountRegistry.Lock()
	accountRegistry.byMortgage[mortgageID] = map[string]string{
		"principal": accounts.PrincipalAccountID,
		"interest":  accounts.InterestAccountID,
		"escrow":    accounts.EscrowAccountID,
		"fees":      accounts.FeesAccountID,
	}
	accountRegistry.Unlock()

	log.Printf("Created TigerBeetle accounts for mortgage %s", mortgageID)
	tbTransfersTotal.WithLabelValues("create_accounts", "success").Inc()

	return accounts, nil
}

// CreateDisbursementTransfer creates a transfer for mortgage disbursement
// in the cluster. The transfer either lands in TigerBeetle or an error is
// returned — balances are never updated locally.
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

	if !c.connected {
		return "", c.errNotConnected()
	}

	amountKobo, err := nairaToKoboU64(amount)
	if err != nil {
		return "", err
	}

	transferID := generateTransferID(tenantID, mortgageID, "DISB")

	transfer := tb.Transfer{
		ID:              accountUint128(transferID),
		DebitAccountID:  accountUint128(disbursementAccountID), // Bank funds account
		CreditAccountID: accountUint128(principalAccountID),    // Mortgage principal
		Ledger:          c.ledgerID,
		Code:            uint16(TransferCodeDisbursement),
		Amount:          tb.ToUint128(amountKobo),
	}

	if err := c.createTransfers([]tb.Transfer{transfer}, "disbursement"); err != nil {
		return "", err
	}
	c.recordHistory(mortgageID, transfer)

	log.Printf("Created disbursement transfer %s for mortgage %s: %.2f NGN (cluster-confirmed)", transferID, mortgageID, amount)
	return transferID, nil
}

// paymentAllocation is the schedule-derived waterfall split of a payment.
type paymentAllocation struct {
	InterestKobo  uint64
	PrincipalKobo uint64
	EscrowKobo    uint64
}

// allocatePayment derives the payment waterfall from the actual repayment
// schedule stored for this mortgage (interest → escrow → scheduled principal,
// remainder to principal prepayment). It never invents a percentage split:
// when no schedule data exists it returns an error.
func allocatePayment(mortgageID string, totalKobo uint64) (*paymentAllocation, error) {
	schedule, err := fetchRepaymentSchedule(mortgageID)
	if err != nil {
		return nil, fmt.Errorf("cannot allocate payment for mortgage %s: repayment schedule lookup failed: %w", mortgageID, err)
	}
	if len(schedule) == 0 {
		return nil, fmt.Errorf("cannot allocate payment for mortgage %s: no repayment schedule exists — refusing to invent an interest/principal/escrow split", mortgageID)
	}

	alloc := &paymentAllocation{}
	remaining := totalKobo

	// Waterfall over unpaid (or partially paid) schedule entries in order.
	for _, entry := range schedule {
		if remaining == 0 {
			break
		}
		if entry.Status == "paid" {
			continue
		}
		entryTotalKobo := uint64(entry.TotalAmount * 100)
		entryPaidKobo := uint64(entry.PaidAmount * 100)
		entryRemaining := entryTotalKobo
		if entryPaidKobo < entryTotalKobo {
			entryRemaining = entryTotalKobo - entryPaidKobo
		}
		if entryRemaining == 0 {
			continue
		}

		take := remaining
		if take > entryRemaining {
			take = entryRemaining
		}

		// Split the taken amount across this entry's scheduled components
		// proportionally to the entry's own composition. The principal
		// component falls out as the residual below.
		interestKobo := uint64(entry.InterestAmount * 100)
		escrowKobo := uint64(entry.EscrowAmount * 100)
		if interestKobo+escrowKobo > entryTotalKobo {
			// Degenerate schedule row: treat everything as principal rather
			// than fabricating component amounts.
			interestKobo, escrowKobo = 0, 0
		}

		if entryTotalKobo > 0 {
			alloc.InterestKobo += take * interestKobo / entryTotalKobo
			alloc.EscrowKobo += take * escrowKobo / entryTotalKobo
		}
		remaining -= take
	}

	// Whatever was not consumed by scheduled dues reduces principal.
	alloc.PrincipalKobo = totalKobo - alloc.InterestKobo - alloc.EscrowKobo
	return alloc, nil
}

// CreatePaymentTransfer creates transfers for a mortgage payment. The
// interest/principal/escrow split is derived from the mortgage's actual
// repayment schedule (see allocatePayment); without schedule data the
// payment is rejected rather than allocated by hardcoded percentages.
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

	if !c.connected {
		return "", c.errNotConnected()
	}

	amountKobo, err := nairaToKoboU64(totalAmount)
	if err != nil {
		return "", err
	}

	alloc, err := allocatePayment(mortgageID, amountKobo)
	if err != nil {
		tbTransfersTotal.WithLabelValues("payment", "error").Inc()
		return "", err
	}

	transferID := generateTransferID(tenantID, mortgageID, "PAY")
	source := accountUint128(sourceAccountID)

	type leg struct {
		credit string
		amount uint64
		code   TransferCode
	}
	legs := []leg{
		{interestAccountID, alloc.InterestKobo, TransferCodeInterestRepay},
		{principalAccountID, alloc.PrincipalKobo, TransferCodePrincipalRepay},
		{escrowAccountID, alloc.EscrowKobo, TransferCodeEscrowDeposit},
	}

	var transfers []tb.Transfer
	for _, l := range legs {
		if l.amount == 0 {
			continue
		}
		flags := tb.TransferFlags{Linked: true}.ToUint16()
		transfers = append(transfers, tb.Transfer{
			ID:              accountUint128(fmt.Sprintf("%s-%s", transferID, l.credit)),
			DebitAccountID:  source,
			CreditAccountID: accountUint128(l.credit),
			Ledger:          c.ledgerID,
			Code:            uint16(l.code),
			Amount:          tb.ToUint128(l.amount),
			Flags:           flags,
		})
	}
	if len(transfers) == 0 {
		return "", fmt.Errorf("payment allocation produced no transfers for mortgage %s", mortgageID)
	}
	// Close the linked chain: the last transfer must not be linked.
	transfers[len(transfers)-1].Flags = tb.TransferFlags{}.ToUint16()

	if err := c.createTransfers(transfers, "payment"); err != nil {
		return "", err
	}
	for _, t := range transfers {
		c.recordHistory(mortgageID, t)
	}

	log.Printf("Created payment transfer %s for mortgage %s: %.2f NGN (P:%d I:%d E:%d kobo, cluster-confirmed)",
		transferID, mortgageID, totalAmount, alloc.PrincipalKobo, alloc.InterestKobo, alloc.EscrowKobo)
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

	if !c.connected {
		return "", c.errNotConnected()
	}

	transferID := generateTransferID(tenantID, mortgageID, "PREP")
	netAmount := amount - fee
	amountKobo, err := nairaToKoboU64(netAmount)
	if err != nil {
		return "", fmt.Errorf("prepayment net of fee invalid: %w", err)
	}

	transfer := tb.Transfer{
		ID:              accountUint128(transferID),
		DebitAccountID:  accountUint128(sourceAccountID),
		CreditAccountID: accountUint128(principalAccountID),
		Ledger:          c.ledgerID,
		Code:            uint16(TransferCodePrepayment),
		Amount:          tb.ToUint128(amountKobo),
	}

	if err := c.createTransfers([]tb.Transfer{transfer}, "prepayment"); err != nil {
		return "", err
	}
	c.recordHistory(mortgageID, transfer)

	log.Printf("Created prepayment transfer %s for mortgage %s: %.2f NGN (fee: %.2f, cluster-confirmed)",
		transferID, mortgageID, netAmount, fee)
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

	if !c.connected {
		return "", c.errNotConnected()
	}

	transferID := generateTransferID(tenantID, mortgageID, "ESC")
	amountKobo, err := nairaToKoboU64(amount)
	if err != nil {
		return "", err
	}

	transfer := tb.Transfer{
		ID:              accountUint128(transferID),
		DebitAccountID:  accountUint128(escrowAccountID),
		CreditAccountID: accountUint128(payeeAccountID),
		Ledger:          c.ledgerID,
		Code:            uint16(TransferCodeEscrowWithdraw),
		Amount:          tb.ToUint128(amountKobo),
	}

	if err := c.createTransfers([]tb.Transfer{transfer}, "escrow_disbursement"); err != nil {
		return "", err
	}
	c.recordHistory(mortgageID, transfer)

	log.Printf("Created escrow disbursement %s for mortgage %s: %.2f NGN (%s, cluster-confirmed)",
		transferID, mortgageID, amount, disbursementType)
	return transferID, nil
}

// AccrueInterest creates interest accrual entries in the cluster.
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

	if !c.connected {
		return "", c.errNotConnected()
	}

	transferID := generateTransferID(tenantID, mortgageID, "INT")
	amountKobo, err := nairaToKoboU64(interestAmount)
	if err != nil {
		return "", err
	}

	transfer := tb.Transfer{
		ID:              accountUint128(transferID),
		DebitAccountID:  accountUint128(principalAccountID), // Interest expense
		CreditAccountID: accountUint128(interestAccountID),  // Interest receivable
		Ledger:          c.ledgerID,
		Code:            uint16(TransferCodeInterestAccrual),
		Amount:          tb.ToUint128(amountKobo),
	}

	if err := c.createTransfers([]tb.Transfer{transfer}, "interest_accrual"); err != nil {
		return "", err
	}
	c.recordHistory(mortgageID, transfer)

	log.Printf("Accrued interest %s for mortgage %s: %.2f NGN (cluster-confirmed)", transferID, mortgageID, interestAmount)
	return transferID, nil
}

// WriteOffMortgage creates write-off entries for defaulted mortgage. The
// write-off amount is the actual outstanding balance read from the cluster;
// if the cluster says nothing is outstanding, no write-off is created.
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

	if !c.connected {
		return "", c.errNotConnected()
	}

	// Read actual outstanding balances from the cluster.
	principalBalance, err := c.getAccountBalanceInternal(principalAccountID)
	if err != nil {
		return "", fmt.Errorf("write-off aborted, cannot read principal balance: %w", err)
	}
	interestBalance, err := c.getAccountBalanceInternal(interestAccountID)
	if err != nil {
		return "", fmt.Errorf("write-off aborted, cannot read interest balance: %w", err)
	}
	totalWriteOff := principalBalance + interestBalance
	if totalWriteOff <= 0 {
		return "", fmt.Errorf("write-off refused for mortgage %s: cluster shows no outstanding balance (principal=%.2f interest=%.2f)",
			mortgageID, principalBalance, interestBalance)
	}

	transferID := generateTransferID(tenantID, mortgageID, "WO")
	amountKobo, err := nairaToKoboU64(totalWriteOff)
	if err != nil {
		return "", err
	}

	transfer := tb.Transfer{
		ID:              accountUint128(transferID),
		DebitAccountID:  accountUint128(writeOffAccountID),
		CreditAccountID: accountUint128(principalAccountID),
		Ledger:          c.ledgerID,
		Code:            uint16(TransferCodeWriteOff),
		Amount:          tb.ToUint128(amountKobo),
	}

	if err := c.createTransfers([]tb.Transfer{transfer}, "write_off"); err != nil {
		return "", err
	}
	c.recordHistory(mortgageID, transfer)

	log.Printf("Write-off transfer %s for mortgage %s: %.2f NGN (cluster-confirmed)", transferID, mortgageID, totalWriteOff)
	return transferID, nil
}

// GetAccountBalance returns the current balance of an account from the
// cluster. Errors when the cluster is unreachable or the account is unknown.
func (c *TigerBeetleClient) GetAccountBalance(accountID string) (float64, error) {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	if !c.connected {
		return 0, c.errNotConnected()
	}
	return c.getAccountBalanceInternal(accountID)
}

// getAccountBalanceInternal reads credits-posted minus debits-posted from
// the cluster (liability-style balance for mortgage accounts).
// Callers must hold at least a read lock.
func (c *TigerBeetleClient) getAccountBalanceInternal(accountID string) (float64, error) {
	accounts, err := c.tb.LookupAccounts([]tb.Uint128{accountUint128(accountID)})
	if err != nil {
		return 0, fmt.Errorf("tigerbeetle lookup account %s: %w", accountID, err)
	}
	if len(accounts) == 0 {
		return 0, fmt.Errorf("tigerbeetle account not found: %s", accountID)
	}
	credits, _ := accounts[0].CreditsPosted.Uint64()
	debits, _ := accounts[0].DebitsPosted.Uint64()
	return float64(int64(credits)-int64(debits)) / 100.0, nil
}

// GetAccountDetails returns full account details from the cluster.
func (c *TigerBeetleClient) GetAccountDetails(accountID string) (*TigerBeetleAccount, error) {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	if !c.connected {
		return nil, c.errNotConnected()
	}

	accounts, err := c.tb.LookupAccounts([]tb.Uint128{accountUint128(accountID)})
	if err != nil {
		return nil, fmt.Errorf("tigerbeetle lookup account %s: %w", accountID, err)
	}
	if len(accounts) == 0 {
		return nil, fmt.Errorf("account not found: %s", accountID)
	}
	a := accounts[0]
	dp, _ := a.DebitsPending.Uint64()
	dpo, _ := a.DebitsPosted.Uint64()
	cp, _ := a.CreditsPending.Uint64()
	cpo, _ := a.CreditsPosted.Uint64()
	return &TigerBeetleAccount{
		ID:             toLocalUint128(a.ID),
		UserData:       toLocalUint128(a.UserData128),
		Ledger:         a.Ledger,
		Code:           a.Code,
		Flags:          a.Flags,
		DebitsPending:  dp,
		DebitsPosted:   dpo,
		CreditsPending: cp,
		CreditsPosted:  cpo,
		Timestamp:      a.Timestamp,
	}, nil
}

// GetTransferHistory returns the cluster-confirmed transfers this process
// created for a mortgage. (Process-local index; the cluster remains the
// system of record.)
func (c *TigerBeetleClient) GetTransferHistory(mortgageID string) ([]*TigerBeetleTransfer, error) {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	transfers := c.history[mortgageID]
	if transfers == nil {
		transfers = []*TigerBeetleTransfer{}
	}
	return transfers, nil
}

// ReconcileMortgageBalances compares real cluster balances against the
// expected values supplied by the caller and reports actual discrepancies.
// If the cluster cannot be reached, the result is status "failed" with
// Matched=false and an error is returned — reconciliation is never faked.
func (c *TigerBeetleClient) ReconcileMortgageBalances(mortgageID string, expectedPrincipal, expectedInterest float64) (*ReconciliationResult, error) {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	result := &ReconciliationResult{
		MortgageID:    mortgageID,
		Timestamp:     time.Now(),
		Discrepancies: []Discrepancy{},
	}

	if !c.connected {
		result.Status = "failed"
		result.Matched = false
		return result, c.errNotConnected()
	}

	// Resolve this mortgage's account IDs from the account registry
	// (populated on successful CreateMortgageAccounts). Without known
	// accounts we cannot reconcile honestly.
	accountIDs := c.knownAccountIDs(mortgageID)
	if len(accountIDs) == 0 {
		result.Status = "failed"
		result.Matched = false
		return result, fmt.Errorf("cannot reconcile mortgage %s: no TigerBeetle accounts known for it in this process", mortgageID)
	}
	principalAccountID := accountIDs["principal"]
	interestAccountID := accountIDs["interest"]

	const tolerance = 0.005 // half a kobo
	matched := true

	actualPrincipal, err := c.getAccountBalanceInternal(principalAccountID)
	if err != nil {
		result.Status = "failed"
		result.Matched = false
		return result, fmt.Errorf("reconciliation failed for mortgage %s: %w", mortgageID, err)
	}
	if d := actualPrincipal - expectedPrincipal; d > tolerance || d < -tolerance {
		matched = false
		result.Discrepancies = append(result.Discrepancies, Discrepancy{
			AccountType:     "principal",
			ExpectedBalance: expectedPrincipal,
			ActualBalance:   actualPrincipal,
			Difference:      d,
		})
	}

	actualInterest, err := c.getAccountBalanceInternal(interestAccountID)
	if err != nil {
		result.Status = "failed"
		result.Matched = false
		return result, fmt.Errorf("reconciliation failed for mortgage %s: %w", mortgageID, err)
	}
	if d := actualInterest - expectedInterest; d > tolerance || d < -tolerance {
		matched = false
		result.Discrepancies = append(result.Discrepancies, Discrepancy{
			AccountType:     "interest",
			ExpectedBalance: expectedInterest,
			ActualBalance:   actualInterest,
			Difference:      d,
		})
	}

	result.Matched = matched
	if matched {
		result.Status = "reconciled"
	} else {
		result.Status = "mismatched"
	}
	return result, nil
}

// accountRegistry records which cluster account string IDs belong to each
// mortgage (principal/interest/escrow/fees), populated on successful
// CreateMortgageAccounts. Used by reconciliation.
var accountRegistry = struct {
	sync.RWMutex
	byMortgage map[string]map[string]string
}{byMortgage: make(map[string]map[string]string)}

// knownAccountIDs returns the registered account IDs for a mortgage.
func (c *TigerBeetleClient) knownAccountIDs(mortgageID string) map[string]string {
	accountRegistry.RLock()
	defer accountRegistry.RUnlock()
	return accountRegistry.byMortgage[mortgageID]
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
