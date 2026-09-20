package main

// LN-13 (L14): real TigerBeetle client for the agricultural-loan ledger.
// Previously DisburseLoan/RepayLoan were SQL status flips with a
// body-supplied amount and no ledger movement. Money moves in integer kobo,
// transfer IDs are deterministic (agri:{loan_id}:disb, repay-agri:{payment_id})
// so retries are idempotent, and every operation fails closed when the
// cluster is unavailable.

import (
	"crypto/sha256"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"

	tb "github.com/tigerbeetle/tigerbeetle-go"
)

// AgriTransferCode classifies agricultural-loan ledger transfers.
type AgriTransferCode uint16

const (
	AgriTransferCodeDisbursement AgriTransferCode = 301
	AgriTransferCodeRepayment    AgriTransferCode = 302
)

// AgriTigerBeetleClient is the ledger client for agricultural loans.
type AgriTigerBeetleClient struct {
	endpoint  string
	ledgerID  uint32
	tb        tb.Client
	mutex     sync.RWMutex
	connected bool
}

// NewAgriTigerBeetleClient builds the client from TB_ADDRESS /
// TIGERBEETLE_ADDRESSES. When unset/unreachable, every ledger operation
// fails fast (fail-closed).
func NewAgriTigerBeetleClient() *AgriTigerBeetleClient {
	endpoint := os.Getenv("TB_ADDRESS")
	if endpoint == "" {
		endpoint = os.Getenv("TIGERBEETLE_ADDRESSES")
	}

	client := &AgriTigerBeetleClient{
		endpoint:  endpoint,
		ledgerID:  3, // Agricultural-loan ledger
		connected: false,
	}

	if endpoint == "" {
		log.Printf("[agricultural-service] TigerBeetle NOT connected: TB_ADDRESS/TIGERBEETLE_ADDRESSES unset — loan disbursement/repayment will fail fast")
		return client
	}

	addresses := strings.Split(endpoint, ",")
	for i := range addresses {
		addresses[i] = strings.TrimSpace(addresses[i])
	}

	tbClient, err := tb.NewClient(tb.ToUint128(0), addresses)
	if err != nil {
		log.Printf("[agricultural-service] TigerBeetle connection FAILED (%v) — loan ledger operations will fail fast", err)
		return client
	}

	client.tb = tbClient
	client.connected = true
	log.Printf("[agricultural-service] TigerBeetle client connected at %s", endpoint)
	return client
}

func (c *AgriTigerBeetleClient) errNotConnected() error {
	return fmt.Errorf("tigerbeetle cluster unavailable (endpoint %q): agricultural-loan ledger operation refused — no funds were moved or recorded", c.endpoint)
}

func agriAccountUint128(accountID string) tb.Uint128 {
	sum := sha256.Sum256([]byte("54bank/agriculture/" + accountID))
	var b [16]byte
	copy(b[:], sum[:16])
	return tb.BytesToUint128(b)
}

func agriNairaToKoboU64(amount float64) (uint64, error) {
	if amount <= 0 {
		return 0, fmt.Errorf("amount must be positive: %.2f", amount)
	}
	kobo := uint64(amount * 100)
	if kobo == 0 {
		return 0, fmt.Errorf("amount %.2f NGN rounds to zero kobo", amount)
	}
	return kobo, nil
}

func (c *AgriTigerBeetleClient) createTransfers(transfers []tb.Transfer, opLabel string) error {
	results, err := c.tb.CreateTransfers(transfers)
	if err != nil {
		return fmt.Errorf("tigerbeetle create transfers (%s): %w", opLabel, err)
	}
	for _, r := range results {
		if r.Status != tb.TransferCreated && r.Status != tb.TransferExists {
			return fmt.Errorf("tigerbeetle transfer rejected (%s): status=%v", opLabel, r.Status)
		}
	}
	return nil
}

// CreateAgriDisbursementTransfer moves the approved amount from the bank
// funds account to the farmer's account. Deterministic ID
// agri:{loan_id}:disb — idempotent under retry.
func (c *AgriTigerBeetleClient) CreateAgriDisbursementTransfer(sourceAccountID, farmerAccountID string, amount float64, loanID string) (string, error) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	if !c.connected {
		return "", c.errNotConnected()
	}
	kobo, err := agriNairaToKoboU64(amount)
	if err != nil {
		return "", err
	}

	transferID := fmt.Sprintf("agri:%s:disb", loanID)
	transfer := tb.Transfer{
		ID:              agriAccountUint128(transferID),
		DebitAccountID:  agriAccountUint128(sourceAccountID),
		CreditAccountID: agriAccountUint128(farmerAccountID),
		Ledger:          c.ledgerID,
		Code:            uint16(AgriTransferCodeDisbursement),
		Amount:          tb.ToUint128(kobo),
	}
	if err := c.createTransfers([]tb.Transfer{transfer}, "disbursement"); err != nil {
		return "", err
	}
	log.Printf("[agricultural-service] disbursement transfer %s: %.2f NGN (cluster-confirmed)", transferID, amount)
	return transferID, nil
}

// ReverseAgriDisbursement compensates a completed disbursement with the
// exact mirror transfer. Idempotent via deterministic -REV ID.
func (c *AgriTigerBeetleClient) ReverseAgriDisbursement(sourceAccountID, farmerAccountID string, amount float64, loanID string) error {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	if !c.connected {
		return c.errNotConnected()
	}
	kobo, err := agriNairaToKoboU64(amount)
	if err != nil {
		return err
	}

	transfer := tb.Transfer{
		ID:              agriAccountUint128(fmt.Sprintf("agri:%s:disb-REV", loanID)),
		DebitAccountID:  agriAccountUint128(farmerAccountID),
		CreditAccountID: agriAccountUint128(sourceAccountID),
		Ledger:          c.ledgerID,
		Code:            uint16(AgriTransferCodeDisbursement),
		Amount:          tb.ToUint128(kobo),
	}
	if err := c.createTransfers([]tb.Transfer{transfer}, "disbursement_reversal"); err != nil {
		return err
	}
	log.Printf("[agricultural-service] reversed disbursement for loan %s (cluster-confirmed)", loanID)
	return nil
}

// CreateAgriRepaymentTransfer moves a repayment from the farmer's account to
// the loan's outstanding-balance account. Deterministic ID
// repay-agri:{payment_id}.
func (c *AgriTigerBeetleClient) CreateAgriRepaymentTransfer(farmerAccountID, loanAccountID string, amount float64, paymentID string) (string, error) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	if !c.connected {
		return "", c.errNotConnected()
	}
	kobo, err := agriNairaToKoboU64(amount)
	if err != nil {
		return "", err
	}

	transferID := fmt.Sprintf("repay-agri:%s", paymentID)
	transfer := tb.Transfer{
		ID:              agriAccountUint128(transferID),
		DebitAccountID:  agriAccountUint128(farmerAccountID),
		CreditAccountID: agriAccountUint128(loanAccountID),
		Ledger:          c.ledgerID,
		Code:            uint16(AgriTransferCodeRepayment),
		Amount:          tb.ToUint128(kobo),
	}
	if err := c.createTransfers([]tb.Transfer{transfer}, "repayment"); err != nil {
		return "", err
	}
	log.Printf("[agricultural-service] repayment transfer %s: %.2f NGN (cluster-confirmed)", transferID, amount)
	return transferID, nil
}
