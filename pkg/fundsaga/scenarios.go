package fundsaga

import (
	"context"
	"fmt"
	"time"
)

// --- Configurable business-action hooks ---
//
// Scenario-specific side effects (schedule updates, mandate validation,
// policy activation, account freeze/archive) are executed through these
// hooks. Until a hook is configured, the corresponding saga step fails
// loudly instead of pretending the side effect happened.

var (
	scheduleUpdater  func(ctx context.Context, orderRef, transferID string) error
	mandateValidator func(ctx context.Context, mandateRef string, amount AmountKobo) error
	policyActivator  func(ctx context.Context, policyRef string, active bool) error
	accountFreezer   func(ctx context.Context, accountID string, frozen bool) error
	accountArchiver  func(ctx context.Context, accountID string, archived bool) error
)

// ConfigureScheduleUpdater installs the standing-order schedule updater.
func ConfigureScheduleUpdater(f func(ctx context.Context, orderRef, transferID string) error) {
	backendMu.Lock()
	defer backendMu.Unlock()
	scheduleUpdater = f
}

// ConfigureMandateValidator installs the direct-debit mandate validator.
func ConfigureMandateValidator(f func(ctx context.Context, mandateRef string, amount AmountKobo) error) {
	backendMu.Lock()
	defer backendMu.Unlock()
	mandateValidator = f
}

// ConfigurePolicyActivator installs the insurance policy activator.
func ConfigurePolicyActivator(f func(ctx context.Context, policyRef string, active bool) error) {
	backendMu.Lock()
	defer backendMu.Unlock()
	policyActivator = f
}

// ConfigureAccountFreezer installs the account freeze/unfreeze hook.
func ConfigureAccountFreezer(f func(ctx context.Context, accountID string, frozen bool) error) {
	backendMu.Lock()
	defer backendMu.Unlock()
	accountFreezer = f
}

// ConfigureAccountArchiver installs the account archive/reactivate hook.
func ConfigureAccountArchiver(f func(ctx context.Context, accountID string, archived bool) error) {
	backendMu.Lock()
	defer backendMu.Unlock()
	accountArchiver = f
}

// --- Scenario 5: Loan Repayment ---

func LoanRepaymentSaga(borrowerID, loanAccountID, interestAccountID string,
	principalKobo, interestKobo AmountKobo) ([]SagaStep, *SagaState) {
	totalKobo := principalKobo + interestKobo
	state := &SagaState{
		TransferID: fmt.Sprintf("REPAY-%d", time.Now().UnixNano()),
		Legs: []TransferLeg{
			{AccountID: borrowerID, Amount: totalKobo, Direction: "debit", Ledger: 1, Code: 5001},
			{AccountID: loanAccountID, Amount: principalKobo, Direction: "credit", Ledger: 3, Code: 5001},
			{AccountID: interestAccountID, Amount: interestKobo, Direction: "credit", Ledger: 4, Code: 5002},
		},
		Metadata: map[string]interface{}{
			"type":           "loan_repayment",
			"principal_kobo": principalKobo,
			"interest_kobo":  interestKobo,
		},
	}
	steps := []SagaStep{
		StepAcquireLock([]string{borrowerID, loanAccountID}, 30*time.Second),
		StepValidateBalances(),
		StepCreatePendingTransfer(),
		StepCommitTransfer(),
		StepPostGL(),
		StepEmitEvent("banking.lending", "loan.repayment.completed"),
		StepReleaseLocks(),
	}
	return steps, state
}

// --- Scenario 7: Fee Collection ---

func BatchFeeCollectionSaga(accounts []string, feeAmounts []AmountKobo,
	feeIncomeAccount string, feeType string) ([]SagaStep, *SagaState) {
	var legs []TransferLeg
	var totalFees AmountKobo
	for i, acct := range accounts {
		legs = append(legs, TransferLeg{
			AccountID: acct, Amount: feeAmounts[i], Direction: "debit", Ledger: 1, Code: 7001,
		})
		totalFees += feeAmounts[i]
	}
	legs = append(legs, TransferLeg{
		AccountID: feeIncomeAccount, Amount: totalFees, Direction: "credit", Ledger: 4, Code: 7001,
	})

	state := &SagaState{
		TransferID: fmt.Sprintf("BFEE-%d", time.Now().UnixNano()),
		Legs:       legs,
		Metadata:   map[string]interface{}{"fee_type": feeType, "account_count": len(accounts)},
	}
	steps := []SagaStep{
		StepAcquireLock(append(accounts, feeIncomeAccount), 120*time.Second),
		StepValidateBalances(),
		StepCreatePendingTransfer(),
		StepCommitTransfer(),
		StepPostGL(),
		StepEmitEvent("banking.fees", "fee.batch.completed"),
		StepReleaseLocks(),
	}
	return steps, state
}

// --- Scenario 8: Interest Accrual ---

func InterestAccrualSaga(customerID, accrualAccountID string,
	interestKobo AmountKobo) ([]SagaStep, *SagaState) {
	state := &SagaState{
		TransferID: fmt.Sprintf("INT-%d", time.Now().UnixNano()),
		Legs: []TransferLeg{
			{AccountID: accrualAccountID, Amount: interestKobo, Direction: "debit", Ledger: 5, Code: 8001},
			{AccountID: customerID, Amount: interestKobo, Direction: "credit", Ledger: 1, Code: 8001},
		},
		Metadata: map[string]interface{}{"type": "interest_accrual"},
	}
	steps := []SagaStep{
		StepAcquireLock([]string{customerID}, 10*time.Second),
		StepValidateBalances(),
		StepCreatePendingTransfer(),
		StepCommitTransfer(),
		StepPostGL(),
		StepEmitEvent("accounting.ledger", "interest.accrued"),
		StepReleaseLocks(),
	}
	return steps, state
}

// --- Scenario 9: Standing Order ---

func StandingOrderSaga(senderID, receiverID string, amount AmountKobo,
	orderRef string) ([]SagaStep, *SagaState) {
	state := &SagaState{
		TransferID: fmt.Sprintf("SO-%s-%d", orderRef, time.Now().UnixNano()),
		Legs: []TransferLeg{
			{AccountID: senderID, Amount: amount, Direction: "debit", Ledger: 1, Code: 9001},
			{AccountID: receiverID, Amount: amount, Direction: "credit", Ledger: 1, Code: 9001},
		},
		Metadata: map[string]interface{}{
			"type":      "standing_order",
			"order_ref": orderRef,
		},
	}

	// Standing order adds a step to update the next execution date
	updateScheduleStep := SagaStep{
		Name: "update_schedule",
		Forward: func(ctx context.Context, s *SagaState) error {
			backendMu.RLock()
			f := scheduleUpdater
			backendMu.RUnlock()
			if f == nil {
				return fmt.Errorf("fundsaga: schedule updater not configured (ConfigureScheduleUpdater) — next_execution_date NOT updated")
			}
			return f(ctx, orderRef, s.TransferID)
		},
		Compensate: func(ctx context.Context, s *SagaState) error {
			// Revert schedule update (hook must be idempotent)
			return nil
		},
	}

	steps := []SagaStep{
		StepAcquireLock([]string{senderID, receiverID}, 30*time.Second),
		StepValidateBalances(),
		StepCreatePendingTransfer(),
		StepCommitTransfer(),
		updateScheduleStep,
		StepPostGL(),
		StepEmitEvent("banking.payments", "standing_order.executed"),
		StepReleaseLocks(),
	}
	return steps, state
}

// --- Scenario 10: Direct Debit ---

func DirectDebitSaga(debtorID, creditorID string, amount AmountKobo,
	mandateRef string) ([]SagaStep, *SagaState) {
	state := &SagaState{
		TransferID: fmt.Sprintf("DD-%s-%d", mandateRef, time.Now().UnixNano()),
		Legs: []TransferLeg{
			{AccountID: debtorID, Amount: amount, Direction: "debit", Ledger: 1, Code: 10001},
			{AccountID: creditorID, Amount: amount, Direction: "credit", Ledger: 1, Code: 10001},
		},
		Metadata: map[string]interface{}{
			"type":        "direct_debit",
			"mandate_ref": mandateRef,
		},
	}

	// Validate mandate is active and not expired
	validateMandate := SagaStep{
		Name: "validate_mandate",
		Forward: func(ctx context.Context, s *SagaState) error {
			backendMu.RLock()
			f := mandateValidator
			backendMu.RUnlock()
			if f == nil {
				return fmt.Errorf("fundsaga: mandate validator not configured (ConfigureMandateValidator) — mandate %s NOT verified", mandateRef)
			}
			return f(ctx, mandateRef, amount)
		},
		Compensate: nil,
	}

	steps := []SagaStep{
		validateMandate,
		StepAcquireLock([]string{debtorID, creditorID}, 30*time.Second),
		StepValidateBalances(),
		StepAMLScreen(),
		StepCreatePendingTransfer(),
		StepCommitTransfer(),
		StepPostGL(),
		StepEmitEvent("banking.payments", "direct_debit.executed"),
		StepReleaseLocks(),
	}
	return steps, state
}

// --- Scenario 11: Card Hold + Settlement ---

func CardHoldSaga(cardholderID string, amount AmountKobo,
	authCode string) ([]SagaStep, *SagaState) {
	state := &SagaState{
		TransferID: fmt.Sprintf("HOLD-%s-%d", authCode, time.Now().UnixNano()),
		Legs: []TransferLeg{
			{AccountID: cardholderID, Amount: amount, Direction: "debit", Ledger: 1, Code: 11001},
			{AccountID: "card-hold-suspense", Amount: amount, Direction: "credit", Ledger: 7, Code: 11001},
		},
		Metadata: map[string]interface{}{
			"type":      "card_hold",
			"auth_code": authCode,
			"hold_type": "pending",
		},
	}
	steps := []SagaStep{
		StepAcquireLock([]string{cardholderID}, 10*time.Second),
		StepValidateBalances(),
		StepCreatePendingTransfer(), // TigerBeetle pending = hold
		// Do NOT commit yet — hold remains pending until settlement
		StepReleaseLocks(),
	}
	return steps, state
}

func CardSettlementSaga(cardholderID, merchantID string, amount AmountKobo,
	authCode string) ([]SagaStep, *SagaState) {
	state := &SagaState{
		TransferID: fmt.Sprintf("SETTLE-%s-%d", authCode, time.Now().UnixNano()),
		Legs: []TransferLeg{
			{AccountID: "card-hold-suspense", Amount: amount, Direction: "debit", Ledger: 7, Code: 11002},
			{AccountID: merchantID, Amount: amount, Direction: "credit", Ledger: 1, Code: 11002},
		},
		Metadata: map[string]interface{}{
			"type":      "card_settlement",
			"auth_code": authCode,
		},
	}
	steps := []SagaStep{
		StepAcquireLock([]string{merchantID}, 10*time.Second),
		// Post the original hold (TigerBeetle: post_pending_transfer)
		StepCommitTransfer(),
		StepPostGL(),
		StepEmitEvent("banking.payments", "card.settled"),
		StepReleaseLocks(),
	}
	return steps, state
}

// --- Scenario 12: Payment Reversal ---

func PaymentReversalSaga(originalTransferID string, senderID, receiverID string,
	amount AmountKobo, reason string) ([]SagaStep, *SagaState) {
	state := &SagaState{
		TransferID: fmt.Sprintf("REV-%s-%d", originalTransferID, time.Now().UnixNano()),
		Legs: []TransferLeg{
			// Reverse: credit back the original sender, debit the original receiver
			{AccountID: receiverID, Amount: amount, Direction: "debit", Ledger: 1, Code: 12001},
			{AccountID: senderID, Amount: amount, Direction: "credit", Ledger: 1, Code: 12001},
		},
		Metadata: map[string]interface{}{
			"type":                 "reversal",
			"original_transfer_id": originalTransferID,
			"reason":               reason,
		},
	}
	steps := []SagaStep{
		StepAcquireLock([]string{senderID, receiverID}, 30*time.Second),
		StepValidateBalances(),
		StepCreatePendingTransfer(),
		StepCommitTransfer(),
		StepPostGL(), // contra entries
		StepEmitEvent("banking.payments", "payment.reversed"),
		StepReleaseLocks(),
	}
	return steps, state
}

// --- Scenario 15: Agent Cash-In / Cash-Out ---

func AgentCashInSaga(agentID, customerID string, amount AmountKobo) ([]SagaStep, *SagaState) {
	state := &SagaState{
		TransferID: fmt.Sprintf("CASHIN-%d", time.Now().UnixNano()),
		Legs: []TransferLeg{
			{AccountID: agentID, Amount: amount, Direction: "debit", Ledger: 1, Code: 15001},     // agent float decreases
			{AccountID: customerID, Amount: amount, Direction: "credit", Ledger: 1, Code: 15001}, // customer balance increases
		},
		Metadata: map[string]interface{}{"type": "cash_in"},
	}
	steps := []SagaStep{
		StepAcquireLock([]string{agentID, customerID}, 30*time.Second),
		StepValidateBalances(),
		StepCreatePendingTransfer(),
		StepCommitTransfer(),
		StepPostGL(),
		StepEmitEvent("banking.agent", "cash_in.completed"),
		StepReleaseLocks(),
	}
	return steps, state
}

func AgentCashOutSaga(customerID, agentID string, amount AmountKobo) ([]SagaStep, *SagaState) {
	state := &SagaState{
		TransferID: fmt.Sprintf("CASHOUT-%d", time.Now().UnixNano()),
		Legs: []TransferLeg{
			{AccountID: customerID, Amount: amount, Direction: "debit", Ledger: 1, Code: 15002}, // customer balance decreases
			{AccountID: agentID, Amount: amount, Direction: "credit", Ledger: 1, Code: 15002},   // agent float increases
		},
		Metadata: map[string]interface{}{"type": "cash_out"},
	}
	steps := []SagaStep{
		StepAcquireLock([]string{customerID, agentID}, 30*time.Second),
		StepValidateBalances(),
		StepCreatePendingTransfer(),
		StepCommitTransfer(),
		StepPostGL(),
		StepEmitEvent("banking.agent", "cash_out.completed"),
		StepReleaseLocks(),
	}
	return steps, state
}

// --- Scenario 17: Insurance Premium ---

func InsurancePremiumSaga(customerID, insurerAccountID string,
	premiumKobo AmountKobo, policyRef string) ([]SagaStep, *SagaState) {
	state := &SagaState{
		TransferID: fmt.Sprintf("PREM-%s-%d", policyRef, time.Now().UnixNano()),
		Legs: []TransferLeg{
			{AccountID: customerID, Amount: premiumKobo, Direction: "debit", Ledger: 1, Code: 17001},
			{AccountID: insurerAccountID, Amount: premiumKobo, Direction: "credit", Ledger: 1, Code: 17001},
		},
		Metadata: map[string]interface{}{"type": "insurance_premium", "policy_ref": policyRef},
	}

	activatePolicy := SagaStep{
		Name: "activate_policy",
		Forward: func(ctx context.Context, s *SagaState) error {
			backendMu.RLock()
			f := policyActivator
			backendMu.RUnlock()
			if f == nil {
				return fmt.Errorf("fundsaga: policy activator not configured (ConfigurePolicyActivator) — policy %s NOT activated", policyRef)
			}
			// Only activate policy after payment is confirmed
			return f(ctx, policyRef, true)
		},
		Compensate: func(ctx context.Context, s *SagaState) error {
			// Deactivate policy on payment reversal
			backendMu.RLock()
			f := policyActivator
			backendMu.RUnlock()
			if f == nil {
				return nil
			}
			return f(ctx, policyRef, false)
		},
	}

	steps := []SagaStep{
		StepAcquireLock([]string{customerID}, 10*time.Second),
		StepValidateBalances(),
		StepCreatePendingTransfer(),
		StepCommitTransfer(),
		activatePolicy,
		StepPostGL(),
		StepEmitEvent("insurance.premium", "premium.collected"),
		StepReleaseLocks(),
	}
	return steps, state
}

// --- Scenario 19: QR / NQR Payment ---

func QRPaymentSaga(customerID, merchantID, feeAccountID string,
	paymentKobo, feeKobo AmountKobo) ([]SagaStep, *SagaState) {
	state := &SagaState{
		TransferID: fmt.Sprintf("QR-%d", time.Now().UnixNano()),
		Legs: []TransferLeg{
			{AccountID: customerID, Amount: paymentKobo, Direction: "debit", Ledger: 1, Code: 19001},
			{AccountID: merchantID, Amount: paymentKobo - feeKobo, Direction: "credit", Ledger: 1, Code: 19001},
			{AccountID: feeAccountID, Amount: feeKobo, Direction: "credit", Ledger: 4, Code: 19002},
		},
		Metadata: map[string]interface{}{
			"type":                 "qr_payment",
			"fee_kobo":             feeKobo,
			"net_to_merchant_kobo": paymentKobo - feeKobo,
		},
	}
	steps := []SagaStep{
		StepAcquireLock([]string{customerID, merchantID}, 10*time.Second),
		StepValidateBalances(),
		StepAMLScreen(),
		StepCreatePendingTransfer(),
		StepCommitTransfer(),
		StepPostGL(),
		StepEmitEvent("banking.payments", "qr_payment.completed"),
		StepReleaseLocks(),
	}
	return steps, state
}

// --- Scenario 20: Account Closure ---

func AccountClosureSaga(customerID, settlementAccountID string,
	finalBalanceKobo, pendingFeesKobo, accruedInterestKobo AmountKobo) ([]SagaStep, *SagaState) {
	netPayoutKobo := finalBalanceKobo + accruedInterestKobo - pendingFeesKobo
	var legs []TransferLeg
	if pendingFeesKobo > 0 {
		legs = append(legs, TransferLeg{
			AccountID: customerID, Amount: pendingFeesKobo, Direction: "debit", Ledger: 1, Code: 20001,
		})
		legs = append(legs, TransferLeg{
			AccountID: "fee-income", Amount: pendingFeesKobo, Direction: "credit", Ledger: 4, Code: 20001,
		})
	}
	if accruedInterestKobo > 0 {
		legs = append(legs, TransferLeg{
			AccountID: "interest-expense", Amount: accruedInterestKobo, Direction: "debit", Ledger: 5, Code: 20002,
		})
		legs = append(legs, TransferLeg{
			AccountID: customerID, Amount: accruedInterestKobo, Direction: "credit", Ledger: 1, Code: 20002,
		})
	}
	if netPayoutKobo > 0 {
		legs = append(legs, TransferLeg{
			AccountID: customerID, Amount: netPayoutKobo, Direction: "debit", Ledger: 1, Code: 20003,
		})
		legs = append(legs, TransferLeg{
			AccountID: settlementAccountID, Amount: netPayoutKobo, Direction: "credit", Ledger: 1, Code: 20003,
		})
	}

	state := &SagaState{
		TransferID: fmt.Sprintf("CLOSE-%d", time.Now().UnixNano()),
		Legs:       legs,
		Metadata: map[string]interface{}{
			"type":                  "account_closure",
			"final_balance_kobo":    finalBalanceKobo,
			"pending_fees_kobo":     pendingFeesKobo,
			"accrued_interest_kobo": accruedInterestKobo,
			"net_payout_kobo":       netPayoutKobo,
		},
	}

	freezeAccount := SagaStep{
		Name: "freeze_account",
		Forward: func(ctx context.Context, s *SagaState) error {
			backendMu.RLock()
			f := accountFreezer
			backendMu.RUnlock()
			if f == nil {
				return fmt.Errorf("fundsaga: account freezer not configured (ConfigureAccountFreezer) — account %s NOT frozen; closure aborted", customerID)
			}
			// Freeze the account to prevent new transactions during closure
			return f(ctx, customerID, true)
		},
		Compensate: func(ctx context.Context, s *SagaState) error {
			// Unfreeze if closure fails
			backendMu.RLock()
			f := accountFreezer
			backendMu.RUnlock()
			if f == nil {
				return nil
			}
			return f(ctx, customerID, false)
		},
	}

	archiveAccount := SagaStep{
		Name: "archive_account",
		Forward: func(ctx context.Context, s *SagaState) error {
			backendMu.RLock()
			f := accountArchiver
			backendMu.RUnlock()
			if f == nil {
				return fmt.Errorf("fundsaga: account archiver not configured (ConfigureAccountArchiver) — account %s NOT archived", customerID)
			}
			// Move account to archive/closed status
			return f(ctx, customerID, true)
		},
		Compensate: func(ctx context.Context, s *SagaState) error {
			// Reactivate if downstream fails
			backendMu.RLock()
			f := accountArchiver
			backendMu.RUnlock()
			if f == nil {
				return nil
			}
			return f(ctx, customerID, false)
		},
	}

	steps := []SagaStep{
		StepAcquireLock([]string{customerID}, 120*time.Second),
		freezeAccount,
		StepValidateBalances(),
		StepCreatePendingTransfer(),
		StepCommitTransfer(),
		StepPostGL(),
		archiveAccount,
		StepEmitEvent("banking.accounts", "account.closed"),
		StepReleaseLocks(),
	}
	return steps, state
}
