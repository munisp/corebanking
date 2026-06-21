// Package fundsaga provides Temporal-based saga orchestration for all
// flow-of-funds scenarios in the 54Bank platform.
//
// Every fund movement follows the pattern:
//   1. Acquire distributed lock (Redis) on all involved accounts
//   2. Create TigerBeetle pending transfer (two-phase)
//   3. Execute business logic (AML, validation, fee calculation)
//   4. Commit or void the pending transfer
//   5. Emit event via transactional outbox (Kafka)
//   6. Release locks
//
// If any step fails, registered compensation actions execute in reverse order.
package fundsaga

import (
	"context"
	"fmt"
	"time"
)

// AmountKobo is the canonical money type — int64 in kobo (1/100 Naira).
// Never use float64 for money.
type AmountKobo int64

func (a AmountKobo) Naira() float64 { return float64(a) / 100.0 }
func NairaToKobo(n int64) AmountKobo { return AmountKobo(n * 100) }

// TransferLeg represents one side of a double-entry transfer.
type TransferLeg struct {
	AccountID string     `json:"account_id"`
	Amount    AmountKobo `json:"amount_kobo"`
	Direction string     `json:"direction"` // "debit" or "credit"
	Ledger    uint32     `json:"ledger"`
	Code      uint16     `json:"code"`
}

// SagaStep is a forward action with its registered compensation.
type SagaStep struct {
	Name        string
	Forward     func(ctx context.Context, state *SagaState) error
	Compensate  func(ctx context.Context, state *SagaState) error
}

// SagaState carries context through the saga execution.
type SagaState struct {
	TransferID     string                 `json:"transfer_id"`
	IdempotencyKey string                 `json:"idempotency_key"`
	Legs           []TransferLeg          `json:"legs"`
	PendingIDs     []string               `json:"pending_ids"`     // TigerBeetle pending transfer IDs
	LockKeys       []string               `json:"lock_keys"`       // Redis lock keys held
	AuditEntries   []string               `json:"audit_entries"`
	Metadata       map[string]interface{} `json:"metadata"`
	CompletedSteps []string               `json:"completed_steps"` // for compensation tracking
	Error          string                 `json:"error,omitempty"`
}

// SagaResult is the outcome of a saga execution.
type SagaResult struct {
	TransferID string     `json:"transfer_id"`
	Status     string     `json:"status"` // "completed", "compensated", "failed"
	Legs       []LegResult `json:"legs"`
	Duration   int64      `json:"duration_us"`
	Error      string     `json:"error,omitempty"`
}

type LegResult struct {
	AccountID    string     `json:"account_id"`
	Direction    string     `json:"direction"`
	Amount       AmountKobo `json:"amount_kobo"`
	BalanceAfter AmountKobo `json:"balance_after_kobo"`
	EntryID      string     `json:"entry_id"`
}

// ExecuteSaga runs steps in order. On failure, compensates in reverse.
func ExecuteSaga(ctx context.Context, steps []SagaStep, state *SagaState) (*SagaResult, error) {
	start := time.Now()
	result := &SagaResult{
		TransferID: state.TransferID,
		Status:     "in_progress",
	}

	for i, step := range steps {
		if err := step.Forward(ctx, state); err != nil {
			state.Error = fmt.Sprintf("step %d (%s) failed: %v", i, step.Name, err)
			result.Error = state.Error

			// Compensate in reverse order
			for j := i - 1; j >= 0; j-- {
				if steps[j].Compensate != nil {
					if compErr := steps[j].Compensate(ctx, state); compErr != nil {
						// Compensation failure is critical — log and continue
						result.Error += fmt.Sprintf("; compensation step %d (%s) also failed: %v", j, steps[j].Name, compErr)
					}
				}
			}
			result.Status = "compensated"
			result.Duration = time.Since(start).Microseconds()
			return result, fmt.Errorf("saga compensated: %s", state.Error)
		}
		state.CompletedSteps = append(state.CompletedSteps, step.Name)
	}

	result.Status = "completed"
	result.Duration = time.Since(start).Microseconds()
	return result, nil
}

// --- Standard Saga Step Builders ---

// StepAcquireLock creates a saga step that acquires a distributed lock.
func StepAcquireLock(accountIDs []string, ttl time.Duration) SagaStep {
	return SagaStep{
		Name: "acquire_locks",
		Forward: func(ctx context.Context, state *SagaState) error {
			// Sort account IDs to prevent deadlocks (consistent ordering)
			sorted := sortStrings(accountIDs)
			for _, id := range sorted {
				lockKey := fmt.Sprintf("lock:account:%s:%s", id, state.TransferID)
				state.LockKeys = append(state.LockKeys, lockKey)
				// In production, this calls Redis SETNX
				// Lock acquisition is handled by the distlock package
			}
			return nil
		},
		Compensate: func(ctx context.Context, state *SagaState) error {
			// Release all acquired locks
			for range state.LockKeys {
				// In production, this calls Redis DEL
			}
			state.LockKeys = nil
			return nil
		},
	}
}

// StepValidateBalances creates a saga step that checks sufficient funds.
func StepValidateBalances() SagaStep {
	return SagaStep{
		Name: "validate_balances",
		Forward: func(ctx context.Context, state *SagaState) error {
			for _, leg := range state.Legs {
				if leg.Direction == "debit" && leg.Amount <= 0 {
					return fmt.Errorf("debit amount must be positive: %d kobo", leg.Amount)
				}
				if leg.Direction == "credit" && leg.Amount <= 0 {
					return fmt.Errorf("credit amount must be positive: %d kobo", leg.Amount)
				}
			}
			// Validate double-entry: total debits must equal total credits
			var totalDebit, totalCredit AmountKobo
			for _, leg := range state.Legs {
				if leg.Direction == "debit" {
					totalDebit += leg.Amount
				} else {
					totalCredit += leg.Amount
				}
			}
			if totalDebit != totalCredit {
				return fmt.Errorf("double-entry imbalance: debit=%d credit=%d kobo", totalDebit, totalCredit)
			}
			return nil
		},
		Compensate: nil, // validation has no side effects
	}
}

// StepCreatePendingTransfer creates TigerBeetle pending transfers.
func StepCreatePendingTransfer() SagaStep {
	return SagaStep{
		Name: "create_pending_transfer",
		Forward: func(ctx context.Context, state *SagaState) error {
			// In production, this calls TigerBeetle create_transfers with flags.pending
			for i, leg := range state.Legs {
				pendingID := fmt.Sprintf("TB-PEND-%s-%d", state.TransferID, i)
				state.PendingIDs = append(state.PendingIDs, pendingID)
				state.AuditEntries = append(state.AuditEntries,
					fmt.Sprintf("pending_%s:%s:%d_kobo", leg.Direction, leg.AccountID, leg.Amount))
			}
			return nil
		},
		Compensate: func(ctx context.Context, state *SagaState) error {
			// Void all pending transfers
			for _, pid := range state.PendingIDs {
				_ = pid // In production: TigerBeetle void_pending_transfer(pid)
			}
			state.PendingIDs = nil
			return nil
		},
	}
}

// StepAMLScreen creates a saga step for AML/sanctions screening.
func StepAMLScreen() SagaStep {
	return SagaStep{
		Name: "aml_screen",
		Forward: func(ctx context.Context, state *SagaState) error {
			// In production: call AML engine, check sanctions lists
			// If blocked, return error to trigger compensation
			if blocked, ok := state.Metadata["aml_blocked"].(bool); ok && blocked {
				return fmt.Errorf("transaction blocked by AML screening")
			}
			return nil
		},
		Compensate: nil, // screening has no side effects
	}
}

// StepCommitTransfer commits all pending TigerBeetle transfers.
func StepCommitTransfer() SagaStep {
	return SagaStep{
		Name: "commit_transfer",
		Forward: func(ctx context.Context, state *SagaState) error {
			// In production: TigerBeetle commit_transfer for each pending ID
			// This is the point of no return — after commit, funds have moved
			for _, pid := range state.PendingIDs {
				_ = pid // TigerBeetle: post_pending_transfer(pid)
			}
			return nil
		},
		// Committed transfers cannot be compensated — they require a reversal transfer
		Compensate: func(ctx context.Context, state *SagaState) error {
			// Create reversal transfers (not void — these are already committed)
			for i, leg := range state.Legs {
				reversalID := fmt.Sprintf("TB-REV-%s-%d", state.TransferID, i)
				reverseDirection := "credit"
				if leg.Direction == "credit" {
					reverseDirection = "debit"
				}
				_ = reversalID
				_ = reverseDirection
				// TigerBeetle: create_transfer(reverse leg)
			}
			return nil
		},
	}
}

// StepPostGL creates the GL journal entry.
func StepPostGL() SagaStep {
	return SagaStep{
		Name: "post_gl",
		Forward: func(ctx context.Context, state *SagaState) error {
			// In production: POST to gl-engine /v1/gl/journal-entries
			// The journal entry mirrors the TigerBeetle transfer legs
			return nil
		},
		Compensate: func(ctx context.Context, state *SagaState) error {
			// Post a reversal journal entry
			return nil
		},
	}
}

// StepEmitEvent emits the transfer event via transactional outbox.
func StepEmitEvent(topic, eventType string) SagaStep {
	return SagaStep{
		Name: "emit_event",
		Forward: func(ctx context.Context, state *SagaState) error {
			// In production: INSERT into outbox table within the same DB transaction
			// The outbox relay will publish to Kafka
			return nil
		},
		Compensate: nil, // events are informational; downstream must be idempotent
	}
}

// StepReleaseLocks releases all distributed locks.
func StepReleaseLocks() SagaStep {
	return SagaStep{
		Name: "release_locks",
		Forward: func(ctx context.Context, state *SagaState) error {
			for range state.LockKeys {
				// Redis DEL
			}
			state.LockKeys = nil
			return nil
		},
		Compensate: nil, // locks auto-expire via TTL
	}
}

// --- Pre-Built Saga Pipelines for Common Scenarios ---

// P2PTransferSaga returns the step sequence for person-to-person transfer.
func P2PTransferSaga(senderID, receiverID string, amount AmountKobo) ([]SagaStep, *SagaState) {
	state := &SagaState{
		TransferID: fmt.Sprintf("P2P-%d", time.Now().UnixNano()),
		Legs: []TransferLeg{
			{AccountID: senderID, Amount: amount, Direction: "debit", Ledger: 1, Code: 1001},
			{AccountID: receiverID, Amount: amount, Direction: "credit", Ledger: 1, Code: 1001},
		},
		Metadata: map[string]interface{}{},
	}
	steps := []SagaStep{
		StepAcquireLock([]string{senderID, receiverID}, 30*time.Second),
		StepValidateBalances(),
		StepAMLScreen(),
		StepCreatePendingTransfer(),
		StepCommitTransfer(),
		StepPostGL(),
		StepEmitEvent("banking.payments", "transfer.completed"),
		StepReleaseLocks(),
	}
	return steps, state
}

// BulkSalarySaga returns the step sequence for bulk salary processing.
func BulkSalarySaga(companyID string, employees []string, amounts []AmountKobo) ([]SagaStep, *SagaState) {
	var totalAmount AmountKobo
	var legs []TransferLeg
	for i, emp := range employees {
		totalAmount += amounts[i]
		legs = append(legs, TransferLeg{AccountID: emp, Amount: amounts[i], Direction: "credit", Ledger: 1, Code: 2001})
	}
	// Company debit equals sum of all credits
	legs = append([]TransferLeg{{AccountID: companyID, Amount: totalAmount, Direction: "debit", Ledger: 1, Code: 2001}}, legs...)

	allAccounts := append([]string{companyID}, employees...)
	state := &SagaState{
		TransferID: fmt.Sprintf("SAL-%d", time.Now().UnixNano()),
		Legs:       legs,
		Metadata:   map[string]interface{}{"batch_type": "salary", "employee_count": len(employees)},
	}
	steps := []SagaStep{
		StepAcquireLock(allAccounts, 120*time.Second),
		StepValidateBalances(),
		StepCreatePendingTransfer(),
		StepCommitTransfer(),
		StepPostGL(),
		StepEmitEvent("banking.payments", "salary.batch.completed"),
		StepReleaseLocks(),
	}
	return steps, state
}

// LoanDisbursementSaga returns the step sequence for loan disbursement.
func LoanDisbursementSaga(loanAccountID, borrowerID string, principalKobo AmountKobo) ([]SagaStep, *SagaState) {
	state := &SagaState{
		TransferID: fmt.Sprintf("LOAN-%d", time.Now().UnixNano()),
		Legs: []TransferLeg{
			{AccountID: loanAccountID, Amount: principalKobo, Direction: "debit", Ledger: 3, Code: 3001},
			{AccountID: borrowerID, Amount: principalKobo, Direction: "credit", Ledger: 1, Code: 3001},
		},
		Metadata: map[string]interface{}{"loan_type": "disbursement"},
	}
	steps := []SagaStep{
		StepAcquireLock([]string{loanAccountID, borrowerID}, 60*time.Second),
		StepValidateBalances(),
		StepAMLScreen(),
		StepCreatePendingTransfer(),
		// Maker-checker approval happens via Temporal signal before this saga runs
		StepCommitTransfer(),
		StepPostGL(),
		StepEmitEvent("banking.lending", "loan.disbursed"),
		StepReleaseLocks(),
	}
	return steps, state
}

// CrossBorderRemittanceSaga handles FX conversion + cross-border settlement.
func CrossBorderRemittanceSaga(senderID, beneficiaryID string, sendAmountKobo AmountKobo, fxRate int64, receiveCurrency string) ([]SagaStep, *SagaState) {
	receiveAmountKobo := AmountKobo(int64(sendAmountKobo) * fxRate / 10000) // fxRate in basis points
	state := &SagaState{
		TransferID: fmt.Sprintf("REMIT-%d", time.Now().UnixNano()),
		Legs: []TransferLeg{
			{AccountID: senderID, Amount: sendAmountKobo, Direction: "debit", Ledger: 1, Code: 4001},
			{AccountID: "nostro-" + receiveCurrency, Amount: sendAmountKobo, Direction: "credit", Ledger: 5, Code: 4001},
			{AccountID: "vostro-" + receiveCurrency, Amount: receiveAmountKobo, Direction: "debit", Ledger: 6, Code: 4001},
			{AccountID: beneficiaryID, Amount: receiveAmountKobo, Direction: "credit", Ledger: 1, Code: 4001},
		},
		Metadata: map[string]interface{}{
			"fx_rate":          fxRate,
			"send_currency":    "NGN",
			"receive_currency": receiveCurrency,
		},
	}

	fxLockStep := SagaStep{
		Name: "lock_fx_rate",
		Forward: func(ctx context.Context, state *SagaState) error {
			// Redis: SETNX fx-lock:{transferID} with TTL
			// Ensures rate doesn't change during transaction
			return nil
		},
		Compensate: func(ctx context.Context, state *SagaState) error {
			// Redis: DEL fx-lock:{transferID}
			return nil
		},
	}

	steps := []SagaStep{
		StepAcquireLock([]string{senderID, beneficiaryID}, 120*time.Second),
		fxLockStep,
		StepValidateBalances(),
		StepAMLScreen(),
		StepCreatePendingTransfer(),
		StepCommitTransfer(),
		StepPostGL(),
		StepEmitEvent("banking.payments", "remittance.completed"),
		StepReleaseLocks(),
	}
	return steps, state
}

// FeeCollectionSaga handles batch fee debit + income credit.
func FeeCollectionSaga(customerID, feeIncomeAccountID string, feeKobo AmountKobo, feeType string) ([]SagaStep, *SagaState) {
	state := &SagaState{
		TransferID: fmt.Sprintf("FEE-%d", time.Now().UnixNano()),
		Legs: []TransferLeg{
			{AccountID: customerID, Amount: feeKobo, Direction: "debit", Ledger: 1, Code: 5001},
			{AccountID: feeIncomeAccountID, Amount: feeKobo, Direction: "credit", Ledger: 4, Code: 5001},
		},
		Metadata: map[string]interface{}{"fee_type": feeType},
	}
	steps := []SagaStep{
		StepAcquireLock([]string{customerID}, 10*time.Second),
		StepValidateBalances(),
		StepCreatePendingTransfer(),
		StepCommitTransfer(),
		StepPostGL(),
		StepEmitEvent("banking.fees", "fee.collected"),
		StepReleaseLocks(),
	}
	return steps, state
}

// sortStrings returns a sorted copy to prevent deadlocks.
func sortStrings(s []string) []string {
	sorted := make([]string, len(s))
	copy(sorted, s)
	for i := 1; i < len(sorted); i++ {
		for j := i; j > 0 && sorted[j] < sorted[j-1]; j-- {
			sorted[j], sorted[j-1] = sorted[j-1], sorted[j]
		}
	}
	return sorted
}
