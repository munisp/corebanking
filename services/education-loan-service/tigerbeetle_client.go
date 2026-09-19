package main

// LN-12 (L13): real TigerBeetle client for the education-loan ledger.
// Adapted from services/mortgage-service/tigerbeetle_client.go (the in-repo
// reference implementation). Money moves in integer kobo only, transfer IDs
// are deterministic over the natural business keys (edu:{disbursement_id}:
// tuition / :student, repay:{payment_id}) so retries are idempotent
// (TransferExists), and every operation fails closed when the cluster is
// unavailable.

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

var (
	eduTBTransfersTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "education_tigerbeetle_transfers_total",
			Help: "Total TigerBeetle transfers (education loans)",
		},
		[]string{"type", "status"},
	)
	eduTBTransferLatency = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "education_tigerbeetle_transfer_latency_seconds",
			Help:    "TigerBeetle transfer latency (education loans)",
			Buckets: []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1},
		},
		[]string{"operation"},
	)
)

func init() {
	prometheus.MustRegister(eduTBTransfersTotal)
	prometheus.MustRegister(eduTBTransferLatency)
}

// EduTransferCode classifies education-loan ledger transfers.
type EduTransferCode uint16

const (
	EduTransferCodeDisbursement    EduTransferCode = 201 // Mint -> institution/student
	EduTransferCodeRepayment       EduTransferCode = 202 // Customer -> loan principal
	EduTransferCodeInterestRepay   EduTransferCode = 203 // Customer -> loan interest
	EduTransferCodeWriteOff        EduTransferCode = 209 // LN-10: write-off
	EduTransferCodePenaltyInterest EduTransferCode = 210 // LN-08: penalty interest accrual
)

// EduTigerBeetleClient is the ledger client for education loans.
type EduTigerBeetleClient struct {
	endpoint  string
	clusterID int
	ledgerID  uint32
	tb        tb.Client
	mutex     sync.RWMutex
	connected bool
}

// NewEduTigerBeetleClient builds the client from TB_ADDRESS /
// TIGERBEETLE_ADDRESSES. When unset or unreachable the client stays
// disconnected and every ledger operation fails fast (fail-closed).
func NewEduTigerBeetleClient() *EduTigerBeetleClient {
	endpoint := os.Getenv("TB_ADDRESS")
	if endpoint == "" {
		endpoint = os.Getenv("TIGERBEETLE_ADDRESSES")
	}

	client := &EduTigerBeetleClient{
		endpoint:  endpoint,
		clusterID: 0,
		ledgerID:  2, // Education-loan ledger (mortgage uses ledger 1)
		connected: false,
	}

	if endpoint == "" {
		log.Printf("TigerBeetle client NOT connected: TB_ADDRESS/TIGERBEETLE_ADDRESSES unset — all education-loan ledger operations will fail fast")
		return client
	}

	addresses := strings.Split(endpoint, ",")
	for i := range addresses {
		addresses[i] = strings.TrimSpace(addresses[i])
	}

	tbClient, err := tb.NewClient(tb.ToUint128(uint64(client.clusterID)), addresses)
	if err != nil {
		log.Printf("TigerBeetle client connection FAILED (%v) — education-loan ledger operations will fail fast", err)
		return client
	}

	client.tb = tbClient
	client.connected = true
	log.Printf("Education-loan TigerBeetle client connected to cluster at %s", endpoint)
	return client
}

func (c *EduTigerBeetleClient) errNotConnected() error {
	return fmt.Errorf("tigerbeetle cluster unavailable (endpoint %q): education-loan ledger operation refused — no funds were moved or recorded", c.endpoint)
}

// eduAccountUint128 maps an education-loan account string ID to a
// deterministic, collision-resistant TigerBeetle Uint128 (SHA-256
// namespaced). Stable across restarts.
func eduAccountUint128(accountID string) tb.Uint128 {
	sum := sha256.Sum256([]byte("54bank/education/" + accountID))
	var b [16]byte
	copy(b[:], sum[:16])
	return tb.BytesToUint128(b)
}

func eduNairaToKoboU64(amount float64) (uint64, error) {
	if amount <= 0 {
		return 0, fmt.Errorf("amount must be positive: %.2f", amount)
	}
	kobo := uint64(amount * 100)
	if kobo == 0 {
		return 0, fmt.Errorf("amount %.2f NGN rounds to zero kobo", amount)
	}
	return kobo, nil
}

func (c *EduTigerBeetleClient) createTransfers(transfers []tb.Transfer, opLabel string) error {
	results, err := c.tb.CreateTransfers(transfers)
	if err != nil {
		eduTBTransfersTotal.WithLabelValues(opLabel, "error").Inc()
		return fmt.Errorf("tigerbeetle create transfers (%s): %w", opLabel, err)
	}
	for _, r := range results {
		if r.Status != tb.TransferCreated && r.Status != tb.TransferExists {
			eduTBTransfersTotal.WithLabelValues(opLabel, "rejected").Inc()
			return fmt.Errorf("tigerbeetle transfer rejected (%s): status=%v", opLabel, r.Status)
		}
	}
	eduTBTransfersTotal.WithLabelValues(opLabel, "success").Inc()
	return nil
}

// CreateTwoLegDisbursement moves funds for one scheduled disbursement:
// mint/funds account -> institution (tuition) and -> student (accommodation
// + other). Both legs are submitted as one linked TigerBeetle batch so they
// are atomic. Transfer IDs are deterministic (edu:{disbursement_id}:tuition /
// :student) — a retried disbursement maps to the same IDs and the cluster
// answers TransferExists instead of moving funds twice.
// Amounts ALWAYS come from the persisted disbursement record, never the
// request body (LN-12).
func (c *EduTigerBeetleClient) CreateTwoLegDisbursement(
	sourceAccountID string,
	institutionAccountID string,
	studentAccountID string,
	tuitionAmount float64,
	studentAmount float64,
	disbursementID string,
) (string, error) {
	start := time.Now()
	defer func() {
		eduTBTransferLatency.WithLabelValues("disbursement").Observe(time.Since(start).Seconds())
	}()

	c.mutex.Lock()
	defer c.mutex.Unlock()

	if !c.connected {
		return "", c.errNotConnected()
	}

	tuitionKobo, err := eduNairaToKoboU64(tuitionAmount)
	if err != nil {
		return "", fmt.Errorf("tuition leg: %w", err)
	}
	baseID := fmt.Sprintf("edu:%s", disbursementID)

	var transfers []tb.Transfer
	tuitionLeg := tb.Transfer{
		ID:              eduAccountUint128(baseID + ":tuition"),
		DebitAccountID:  eduAccountUint128(sourceAccountID),
		CreditAccountID: eduAccountUint128(institutionAccountID),
		Ledger:          c.ledgerID,
		Code:            uint16(EduTransferCodeDisbursement),
		Amount:          tb.ToUint128(tuitionKobo),
		Flags:           tb.TransferFlags{Linked: true}.ToUint16(),
	}
	transfers = append(transfers, tuitionLeg)

	if studentAmount > 0 {
		studentKobo, err := eduNairaToKoboU64(studentAmount)
		if err != nil {
			return "", fmt.Errorf("student leg: %w", err)
		}
		transfers = append(transfers, tb.Transfer{
			ID:              eduAccountUint128(baseID + ":student"),
			DebitAccountID:  eduAccountUint128(sourceAccountID),
			CreditAccountID: eduAccountUint128(studentAccountID),
			Ledger:          c.ledgerID,
			Code:            uint16(EduTransferCodeDisbursement),
			Amount:          tb.ToUint128(studentKobo),
			Flags:           tb.TransferFlags{}.ToUint16(), // closes the linked chain
		})
	} else {
		// Single leg: must not carry the linked flag.
		transfers[0].Flags = tb.TransferFlags{}.ToUint16()
	}

	if err := c.createTransfers(transfers, "disbursement"); err != nil {
		return "", err
	}

	log.Printf("Created education disbursement %s: tuition %.2f NGN, student %.2f NGN (cluster-confirmed)",
		baseID, tuitionAmount, studentAmount)
	return baseID, nil
}

// ReverseDisbursement compensates a completed disbursement with the exact
// mirror transfer(s). Reversal IDs are derived from the original IDs, so a
// retried compensation is idempotent. An error return means the funds remain
// moved and MUST be surfaced as compensation_failed by the caller.
func (c *EduTigerBeetleClient) ReverseDisbursement(
	sourceAccountID string,
	institutionAccountID string,
	studentAccountID string,
	tuitionAmount float64,
	studentAmount float64,
	disbursementID string,
) error {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	if !c.connected {
		return c.errNotConnected()
	}

	baseID := fmt.Sprintf("edu:%s", disbursementID)
	var transfers []tb.Transfer
	if tuitionAmount > 0 {
		kobo, err := eduNairaToKoboU64(tuitionAmount)
		if err != nil {
			return err
		}
		transfers = append(transfers, tb.Transfer{
			ID:              eduAccountUint128(baseID + ":tuition-REV"),
			DebitAccountID:  eduAccountUint128(institutionAccountID),
			CreditAccountID: eduAccountUint128(sourceAccountID),
			Ledger:          c.ledgerID,
			Code:            uint16(EduTransferCodeDisbursement),
			Amount:          tb.ToUint128(kobo),
			Flags:           tb.TransferFlags{Linked: true}.ToUint16(),
		})
	}
	if studentAmount > 0 {
		kobo, err := eduNairaToKoboU64(studentAmount)
		if err != nil {
			return err
		}
		transfers = append(transfers, tb.Transfer{
			ID:              eduAccountUint128(baseID + ":student-REV"),
			DebitAccountID:  eduAccountUint128(studentAccountID),
			CreditAccountID: eduAccountUint128(sourceAccountID),
			Ledger:          c.ledgerID,
			Code:            uint16(EduTransferCodeDisbursement),
			Amount:          tb.ToUint128(kobo),
			Flags:           tb.TransferFlags{}.ToUint16(),
		})
	}
	if len(transfers) == 0 {
		return fmt.Errorf("nothing to reverse for disbursement %s", disbursementID)
	}
	// Only one leg: drop the linked flag.
	if len(transfers) == 1 {
		transfers[0].Flags = tb.TransferFlags{}.ToUint16()
	}

	if err := c.createTransfers(transfers, "disbursement_reversal"); err != nil {
		return err
	}
	log.Printf("Reversed education disbursement %s (cluster-confirmed)", baseID)
	return nil
}

// CreateRepaymentTransfer moves a repayment from the customer account into
// the loan's ledger accounts, interest-first (reads the accrued-interest
// balance from the cluster; the remainder goes to principal). The transfer
// ID is deterministic (repay:{payment_id}) for idempotent retries.
func (c *EduTigerBeetleClient) CreateRepaymentTransfer(
	customerAccountID string,
	principalAccountID string,
	interestAccountID string,
	amount float64,
	paymentID string,
) (string, error) {
	start := time.Now()
	defer func() {
		eduTBTransferLatency.WithLabelValues("repayment").Observe(time.Since(start).Seconds())
	}()

	c.mutex.Lock()
	defer c.mutex.Unlock()

	if !c.connected {
		return "", c.errNotConnected()
	}

	amountKobo, err := eduNairaToKoboU64(amount)
	if err != nil {
		return "", err
	}

	// Interest-first waterfall from the real accrued-interest balance.
	interestKobo := uint64(0)
	if interestAccountID != "" {
		interestBalance, berr := c.getAccountBalanceInternal(interestAccountID)
		if berr != nil {
			return "", fmt.Errorf("cannot read accrued interest balance: %w", berr)
		}
		if interestBalance > 0 {
			interestKobo = uint64(interestBalance * 100)
			if interestKobo > amountKobo {
				interestKobo = amountKobo
			}
		}
	}
	principalKobo := amountKobo - interestKobo

	transferID := fmt.Sprintf("repay:%s", paymentID)
	source := eduAccountUint128(customerAccountID)

	var transfers []tb.Transfer
	if interestKobo > 0 {
		transfers = append(transfers, tb.Transfer{
			ID:              eduAccountUint128(transferID + ":interest"),
			DebitAccountID:  source,
			CreditAccountID: eduAccountUint128(interestAccountID),
			Ledger:          c.ledgerID,
			Code:            uint16(EduTransferCodeInterestRepay),
			Amount:          tb.ToUint128(interestKobo),
			Flags:           tb.TransferFlags{Linked: true}.ToUint16(),
		})
	}
	if principalKobo > 0 {
		transfers = append(transfers, tb.Transfer{
			ID:              eduAccountUint128(transferID + ":principal"),
			DebitAccountID:  source,
			CreditAccountID: eduAccountUint128(principalAccountID),
			Ledger:          c.ledgerID,
			Code:            uint16(EduTransferCodeRepayment),
			Amount:          tb.ToUint128(principalKobo),
			Flags:           tb.TransferFlags{}.ToUint16(),
		})
	}
	if len(transfers) == 0 {
		return "", fmt.Errorf("repayment allocation produced no transfers for payment %s", paymentID)
	}
	transfers[len(transfers)-1].Flags = tb.TransferFlags{}.ToUint16()

	if err := c.createTransfers(transfers, "repayment"); err != nil {
		return "", err
	}

	log.Printf("Created repayment transfer %s: %.2f NGN (I:%d P:%d kobo, cluster-confirmed)",
		transferID, amount, interestKobo, principalKobo)
	return transferID, nil
}

// CreateWriteOffTransfer (LN-10) moves the outstanding principal balance to
// a write-off (charge-off) account. Deterministic ID: writeoff:{loan_id}.
func (c *EduTigerBeetleClient) CreateWriteOffTransfer(
	principalAccountID string,
	writeOffAccountID string,
	amount float64,
	loanID string,
) (string, error) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	if !c.connected {
		return "", c.errNotConnected()
	}

	amountKobo, err := eduNairaToKoboU64(amount)
	if err != nil {
		return "", err
	}

	transferID := fmt.Sprintf("writeoff:%s", loanID)
	transfer := tb.Transfer{
		ID:              eduAccountUint128(transferID),
		DebitAccountID:  eduAccountUint128(principalAccountID),
		CreditAccountID: eduAccountUint128(writeOffAccountID),
		Ledger:          c.ledgerID,
		Code:            uint16(EduTransferCodeWriteOff),
		Amount:          tb.ToUint128(amountKobo),
	}

	if err := c.createTransfers([]tb.Transfer{transfer}, "write_off"); err != nil {
		return "", err
	}
	log.Printf("Created write-off transfer %s for education loan %s: %.2f NGN (cluster-confirmed)", transferID, loanID, amount)
	return transferID, nil
}

// GetAccountBalance reads credits-posted minus debits-posted from the
// cluster. Fails closed when the cluster is unavailable (LN-06).
func (c *EduTigerBeetleClient) GetAccountBalance(accountID string) (float64, error) {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	if !c.connected {
		return 0, c.errNotConnected()
	}
	return c.getAccountBalanceInternal(accountID)
}

// Callers must hold at least a read lock.
func (c *EduTigerBeetleClient) getAccountBalanceInternal(accountID string) (float64, error) {
	accounts, err := c.tb.LookupAccounts([]tb.Uint128{eduAccountUint128(accountID)})
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
