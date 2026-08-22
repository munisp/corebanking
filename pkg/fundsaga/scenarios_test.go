package fundsaga

import (
	"context"
	"fmt"
	"testing"
	"time"
)

// testFXRateProvider is the deterministic rate source used by tests:
// 1 NGN = 0.0013 USD → 13 basis points of minor units.
func testFXRateProvider(fromCurrency, toCurrency string, valueDate time.Time) (int64, error) {
	if fromCurrency == "NGN" && toCurrency == "USD" {
		return 13, nil
	}
	return 0, fmt.Errorf("no test rate for %s/%s", fromCurrency, toCurrency)
}

func TestLoanRepaymentSaga_DoubleEntry(t *testing.T) {
	steps, state := LoanRepaymentSaga("borrower", "loan-acct", "interest-acct", 90000, 10000)
	if len(steps) != 7 {
		t.Errorf("got %d steps, want 7", len(steps))
	}
	assertDoubleEntry(t, state.Legs)
}

func TestBatchFeeCollectionSaga_DoubleEntry(t *testing.T) {
	accounts := []string{"cust-1", "cust-2", "cust-3"}
	fees := []AmountKobo{500, 750, 1000}
	_, state := BatchFeeCollectionSaga(accounts, fees, "fee-income", "monthly")
	assertDoubleEntry(t, state.Legs)

	// Total fee should be 2250
	var totalDebit AmountKobo
	for _, leg := range state.Legs {
		if leg.Direction == "debit" {
			totalDebit += leg.Amount
		}
	}
	if totalDebit != 2250 {
		t.Errorf("total fees = %d, want 2250", totalDebit)
	}
}

func TestStandingOrderSaga(t *testing.T) {
	steps, state := StandingOrderSaga("sender", "receiver", 100000, "SO-001")
	if len(steps) != 8 { // includes update_schedule step
		t.Errorf("got %d steps, want 8", len(steps))
	}
	assertDoubleEntry(t, state.Legs)
}

func TestDirectDebitSaga(t *testing.T) {
	steps, state := DirectDebitSaga("debtor", "creditor", 250000, "MAND-001")
	if len(steps) != 9 { // includes validate_mandate step
		t.Errorf("got %d steps, want 9", len(steps))
	}
	assertDoubleEntry(t, state.Legs)
}

func TestCardHoldAndSettlement(t *testing.T) {
	holdSteps, holdState := CardHoldSaga("cardholder", 50000, "AUTH-123")
	if len(holdSteps) != 4 { // no commit step — hold remains pending
		t.Errorf("hold saga has %d steps, want 4", len(holdSteps))
	}
	assertDoubleEntry(t, holdState.Legs)

	settleSteps, settleState := CardSettlementSaga("cardholder", "merchant", 50000, "AUTH-123")
	if len(settleSteps) != 5 {
		t.Errorf("settlement saga has %d steps, want 5", len(settleSteps))
	}
	assertDoubleEntry(t, settleState.Legs)
}

func TestPaymentReversalSaga(t *testing.T) {
	_, state := PaymentReversalSaga("ORIG-001", "sender", "receiver", 100000, "customer_request")
	assertDoubleEntry(t, state.Legs)
	// Verify reversal reverses the legs
	if state.Legs[0].AccountID != "receiver" || state.Legs[0].Direction != "debit" {
		t.Error("reversal should debit original receiver")
	}
	if state.Legs[1].AccountID != "sender" || state.Legs[1].Direction != "credit" {
		t.Error("reversal should credit original sender")
	}
}

func TestAgentCashInCashOut(t *testing.T) {
	_, cashInState := AgentCashInSaga("agent", "customer", 500000)
	assertDoubleEntry(t, cashInState.Legs)

	_, cashOutState := AgentCashOutSaga("customer", "agent", 300000)
	assertDoubleEntry(t, cashOutState.Legs)
}

func TestInsurancePremiumSaga(t *testing.T) {
	steps, state := InsurancePremiumSaga("customer", "insurer", 25000, "POL-001")
	if len(steps) != 8 { // includes activate_policy step
		t.Errorf("got %d steps, want 8", len(steps))
	}
	assertDoubleEntry(t, state.Legs)
}

func TestQRPaymentSaga_FeesSplit(t *testing.T) {
	_, state := QRPaymentSaga("customer", "merchant", "fee-account", 100000, 2500)
	assertDoubleEntry(t, state.Legs)

	// Verify fee split
	merchantCredit := state.Legs[1].Amount
	feeCredit := state.Legs[2].Amount
	if merchantCredit+feeCredit != 100000 {
		t.Errorf("merchant(%d) + fee(%d) = %d, want 100000", merchantCredit, feeCredit, merchantCredit+feeCredit)
	}
}

func TestAccountClosureSaga(t *testing.T) {
	steps, state := AccountClosureSaga("customer", "settlement-acct", 500000, 2500, 1000)
	if len(steps) != 9 { // includes freeze and archive steps
		t.Errorf("got %d steps, want 9", len(steps))
	}
	assertDoubleEntry(t, state.Legs)

	// Verify net payout
	netPayout := state.Metadata["net_payout_kobo"].(AmountKobo)
	expected := AmountKobo(500000 + 1000 - 2500)
	if netPayout != expected {
		t.Errorf("net payout = %d, want %d", netPayout, expected)
	}
}

func TestAllSagasExecuteWithCompensation(t *testing.T) {
	type sagaFactory struct {
		name    string
		factory func() ([]SagaStep, *SagaState)
	}

	factories := []sagaFactory{
		{"P2P", func() ([]SagaStep, *SagaState) { return P2PTransferSaga("A", "B", 10000) }},
		{"Salary", func() ([]SagaStep, *SagaState) { return BulkSalarySaga("C", []string{"D"}, []AmountKobo{10000}) }},
		{"Loan", func() ([]SagaStep, *SagaState) { return LoanDisbursementSaga("L", "B", 50000) }},
		{"Remittance", func() ([]SagaStep, *SagaState) {
			steps, state, err := CrossBorderRemittanceSaga("S", "R", 100000, "USD")
			if err != nil {
				return nil, nil
			}
			return steps, state
		}},
		{"Fee", func() ([]SagaStep, *SagaState) { return FeeCollectionSaga("C", "F", 500, "monthly") }},
		{"Repayment", func() ([]SagaStep, *SagaState) { return LoanRepaymentSaga("B", "L", "I", 90000, 10000) }},
		{"StandingOrder", func() ([]SagaStep, *SagaState) { return StandingOrderSaga("A", "B", 5000, "SO-1") }},
		{"DirectDebit", func() ([]SagaStep, *SagaState) { return DirectDebitSaga("D", "C", 8000, "M-1") }},
		{"CardHold", func() ([]SagaStep, *SagaState) { return CardHoldSaga("CH", 5000, "A1") }},
		{"Reversal", func() ([]SagaStep, *SagaState) { return PaymentReversalSaga("O1", "S", "R", 3000, "test") }},
		{"CashIn", func() ([]SagaStep, *SagaState) { return AgentCashInSaga("AG", "CU", 20000) }},
		{"CashOut", func() ([]SagaStep, *SagaState) { return AgentCashOutSaga("CU", "AG", 15000) }},
		{"Premium", func() ([]SagaStep, *SagaState) { return InsurancePremiumSaga("CU", "IN", 3000, "P1") }},
		{"QR", func() ([]SagaStep, *SagaState) { return QRPaymentSaga("CU", "ME", "FE", 10000, 250) }},
		{"Closure", func() ([]SagaStep, *SagaState) { return AccountClosureSaga("CU", "SE", 100000, 500, 200) }},
	}

	installTestBackends(t)
	for _, sf := range factories {
		t.Run(sf.name+"_success", func(t *testing.T) {
			steps, state := sf.factory()
			result, err := ExecuteSaga(context.Background(), steps, state)
			if err != nil {
				t.Fatalf("saga %s failed: %v", sf.name, err)
			}
			if result.Status != "completed" {
				t.Errorf("saga %s status = %s, want completed", sf.name, result.Status)
			}
			if len(state.PendingIDs) == 0 {
				t.Errorf("saga %s completed without any pending transfer IDs", sf.name)
			}
		})
	}
}

// --- Fail-fast behavior: without real backends, fund movement must NOT
// report "completed". ---

func TestSagaFailsFastWithoutLedger(t *testing.T) {
	// Ensure no ledger backend is configured.
	ConfigureLedger(nil)
	ConfigureLocks(nil)
	ConfigureGLPoster(nil)
	ConfigureEventEmitter(nil)

	steps, state := P2PTransferSaga("sender", "receiver", 50000)
	result, err := ExecuteSaga(context.Background(), steps, state)
	if err == nil {
		t.Fatal("expected saga to fail without ledger/lock backends")
	}
	if result.Status == "completed" {
		t.Fatalf("saga reported %q without moving any funds", result.Status)
	}
	if len(state.PendingIDs) != 0 {
		t.Errorf("fabricated pending IDs present: %v", state.PendingIDs)
	}
}

func TestCommitWithoutPendingTransfersFails(t *testing.T) {
	ConfigureLedger(&recordingLedger{})
	step := StepCommitTransfer()
	state := &SagaState{TransferID: "T-1", Metadata: map[string]interface{}{}}
	if err := step.Forward(context.Background(), state); err == nil {
		t.Fatal("commit with no pending transfers must fail")
	}
	ConfigureLedger(nil)
}

// --- Test doubles (test-only; production uses the TigerBeetle backend) ---

type recordingLocks struct{}

func (recordingLocks) Acquire(ctx context.Context, keys []string, ttl time.Duration) (func(), error) {
	return func() {}, nil
}

type recordingLedger struct {
	pendingCreated int
	posted         int
	voided         int
}

func (r *recordingLedger) CreatePendingTransfers(ctx context.Context, transfers []LedgerTransfer, timeoutSecs uint32) ([]string, error) {
	r.pendingCreated += len(transfers)
	ids := make([]string, len(transfers))
	for i := range transfers {
		ids[i] = fmt.Sprintf("TEST-PEND-%d", i)
	}
	return ids, nil
}

func (r *recordingLedger) PostPendingTransfers(ctx context.Context, pendingIDs []string) error {
	r.posted += len(pendingIDs)
	return nil
}

func (r *recordingLedger) VoidPendingTransfers(ctx context.Context, pendingIDs []string) error {
	r.voided += len(pendingIDs)
	return nil
}

func (r *recordingLedger) CreateReversalTransfers(ctx context.Context, legs []TransferLeg, reference string) error {
	return nil
}

// installTestBackends wires recording doubles so the full pipeline can be
// exercised end-to-end, and registers cleanup to remove them afterwards.
func installTestBackends(t *testing.T) {
	t.Helper()
	ConfigureLocks(recordingLocks{})
	ConfigureLedger(&recordingLedger{})
	ConfigureGLPoster(func(ctx context.Context, state *SagaState) error { return nil })
	ConfigureEventEmitter(func(ctx context.Context, topic, eventType string, state *SagaState) error { return nil })
	ConfigureScheduleUpdater(func(ctx context.Context, orderRef, transferID string) error { return nil })
	ConfigureMandateValidator(func(ctx context.Context, mandateRef string, amount AmountKobo) error { return nil })
	ConfigurePolicyActivator(func(ctx context.Context, policyRef string, active bool) error { return nil })
	ConfigureAccountFreezer(func(ctx context.Context, accountID string, frozen bool) error { return nil })
	ConfigureAccountArchiver(func(ctx context.Context, accountID string, archived bool) error { return nil })
	ConfigureFXRateSource(testFXRateProvider)
	t.Cleanup(func() {
		ConfigureLedger(nil)
		ConfigureLocks(nil)
		ConfigureGLPoster(nil)
		ConfigureEventEmitter(nil)
		ConfigureScheduleUpdater(nil)
		ConfigureMandateValidator(nil)
		ConfigurePolicyActivator(nil)
		ConfigureAccountFreezer(nil)
		ConfigureAccountArchiver(nil)
		ConfigureFXRateSource(nil)
	})
}

func assertDoubleEntry(t *testing.T, legs []TransferLeg) {
	t.Helper()
	var totalDebit, totalCredit AmountKobo
	for _, leg := range legs {
		if leg.Direction == "debit" {
			totalDebit += leg.Amount
		} else if leg.Direction == "credit" {
			totalCredit += leg.Amount
		}
	}
	if totalDebit != totalCredit {
		t.Errorf("double-entry imbalance: debit=%d credit=%d", totalDebit, totalCredit)
	}
}
