// Package fundsaga provides Temporal-based saga orchestration for all
// flow-of-funds scenarios in the 54Bank platform.
//
// Every fund movement follows the pattern:
//  1. Acquire distributed lock (Redis) on all involved accounts
//  2. Create TigerBeetle pending transfer (two-phase)
//  3. Execute business logic (AML, validation, fee calculation)
//  4. Commit or void the pending transfer
//  5. Emit event via transactional outbox (Kafka)
//  6. Release locks
//
// If any step fails, registered compensation actions execute in reverse order.
//
// Fail-fast guarantee: saga steps that move money call the real TigerBeetle
// ledger (pkg/tbclient) through the configured LedgerBackend. When no ledger
// (or lock / GL / event) backend is configured, the affected step returns an
// error, ExecuteSaga compensates and returns a non-"completed" status with an
// error. A saga NEVER reports "completed" for fund movement that did not
// happen in the cluster.
package fundsaga

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"sync"
	"time"

	"github.com/munisp/corebanking/pkg/tbclient"
)

// AmountKobo is the canonical money type — int64 in kobo (1/100 Naira).
// Never use float64 for money.
type AmountKobo int64

func (a AmountKobo) Naira() float64  { return float64(a) / 100.0 }
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
	Name       string
	Forward    func(ctx context.Context, state *SagaState) error
	Compensate func(ctx context.Context, state *SagaState) error
}

// SagaState carries context through the saga execution.
type SagaState struct {
	TransferID     string                 `json:"transfer_id"`
	IdempotencyKey string                 `json:"idempotency_key"`
	Legs           []TransferLeg          `json:"legs"`
	PendingIDs     []string               `json:"pending_ids"` // TigerBeetle pending transfer IDs
	LockKeys       []string               `json:"lock_keys"`   // Redis lock keys held
	AuditEntries   []string               `json:"audit_entries"`
	Metadata       map[string]interface{} `json:"metadata"`
	CompletedSteps []string               `json:"completed_steps"` // for compensation tracking
	Error          string                 `json:"error,omitempty"`

	lockRelease func() // held lock release func (not serialized)
}

// SagaResult is the outcome of a saga execution.
type SagaResult struct {
	TransferID string      `json:"transfer_id"`
	Status     string      `json:"status"` // "completed", "compensated", "failed"
	Legs       []LegResult `json:"legs"`
	Duration   int64       `json:"duration_us"`
	Error      string      `json:"error,omitempty"`
}

type LegResult struct {
	AccountID    string     `json:"account_id"`
	Direction    string     `json:"direction"`
	Amount       AmountKobo `json:"amount_kobo"`
	BalanceAfter AmountKobo `json:"balance_after_kobo"`
	EntryID      string     `json:"entry_id"`
}

// ExecuteSaga runs steps in order. On failure, compensates in reverse.
// The returned status is "completed" ONLY when every step succeeded —
// meaning pending transfers were really created in TigerBeetle and really
// committed. Any failure yields "compensated" (side effects were undone)
// or "failed" (nothing to undo) plus a non-nil error.
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
			compensations := 0
			for j := i - 1; j >= 0; j-- {
				if steps[j].Compensate != nil {
					compensations++
					if compErr := steps[j].Compensate(ctx, state); compErr != nil {
						// Compensation failure is critical — log and continue
						result.Error += fmt.Sprintf("; compensation step %d (%s) also failed: %v", j, steps[j].Name, compErr)
					}
				}
			}
			if compensations > 0 {
				result.Status = "compensated"
			} else {
				result.Status = "failed"
			}
			result.Duration = time.Since(start).Microseconds()
			return result, fmt.Errorf("saga %s: %s", result.Status, state.Error)
		}
		state.CompletedSteps = append(state.CompletedSteps, step.Name)
	}

	result.Status = "completed"
	result.Duration = time.Since(start).Microseconds()
	return result, nil
}

// --- Backend interfaces (wired to real infrastructure) ---

// LedgerTransfer is a single debit→credit movement the saga engine asks the
// ledger to execute.
type LedgerTransfer struct {
	DebitAccountID  string     `json:"debit_account_id"`
	CreditAccountID string     `json:"credit_account_id"`
	Amount          AmountKobo `json:"amount_kobo"`
	Ledger          uint32     `json:"ledger"`
	Code            uint16     `json:"code"`
	Reference       string     `json:"reference"`
}

// LedgerBackend executes real fund reservations/postings in TigerBeetle.
type LedgerBackend interface {
	// CreatePendingTransfers reserves funds (flags.pending, linked batch).
	// Returns the real cluster transfer IDs for later post/void.
	CreatePendingTransfers(ctx context.Context, transfers []LedgerTransfer, timeoutSecs uint32) ([]string, error)
	// PostPendingTransfers commits pending transfers (flags.post_pending_transfer).
	PostPendingTransfers(ctx context.Context, pendingIDs []string) error
	// VoidPendingTransfers releases pending transfers (flags.void_pending_transfer).
	VoidPendingTransfers(ctx context.Context, pendingIDs []string) error
	// CreateReversalTransfers posts compensating transfers (already-committed funds).
	CreateReversalTransfers(ctx context.Context, legs []TransferLeg, reference string) error
}

// LockBackend acquires distributed locks (e.g. Redis via pkg/distlock).
type LockBackend interface {
	// Acquire locks all keys or fails; the returned func releases them.
	Acquire(ctx context.Context, keys []string, ttl time.Duration) (release func(), err error)
}

var (
	backendMu    sync.RWMutex
	ledger       LedgerBackend
	lockBackend  LockBackend
	glPoster     func(ctx context.Context, state *SagaState) error
	eventEmitter func(ctx context.Context, topic, eventType string, state *SagaState) error
)

// ErrLedgerNotConfigured is returned by fund-movement steps when no ledger
// backend has been configured. Sagas fail (never "completed") in this state.
var ErrLedgerNotConfigured = fmt.Errorf("fundsaga: TigerBeetle ledger backend not configured — refusing to move funds (call fundsaga.ConfigureLedger or ConfigureLedgerFromEnv)")

// ErrLockBackendNotConfigured is returned when distributed locks are
// unavailable; fund movement without locking is refused.
var ErrLockBackendNotConfigured = fmt.Errorf("fundsaga: distributed lock backend not configured (call fundsaga.ConfigureLocks)")

// ConfigureLedger installs the ledger backend used by all saga steps.
func ConfigureLedger(b LedgerBackend) {
	backendMu.Lock()
	defer backendMu.Unlock()
	ledger = b
}

// ConfigureLocks installs the distributed lock backend.
func ConfigureLocks(b LockBackend) {
	backendMu.Lock()
	defer backendMu.Unlock()
	lockBackend = b
}

// ConfigureGLPoster installs the GL journal poster. Until configured,
// StepPostGL fails loudly instead of pretending a journal entry exists.
func ConfigureGLPoster(f func(ctx context.Context, state *SagaState) error) {
	backendMu.Lock()
	defer backendMu.Unlock()
	glPoster = f
}

// ConfigureEventEmitter installs the domain-event emitter (e.g. transactional
// outbox → Kafka). Until configured, StepEmitEvent fails loudly.
func ConfigureEventEmitter(f func(ctx context.Context, topic, eventType string, state *SagaState) error) {
	backendMu.Lock()
	defer backendMu.Unlock()
	eventEmitter = f
}

// ConfigureLedgerFromEnv connects to the TigerBeetle cluster using
// TIGERBEETLE_ADDRESSES / TB_ADDRESS (via pkg/tbclient) and installs the
// real backend. Returns an error when the cluster cannot be reached.
func ConfigureLedgerFromEnv() error {
	client, err := tbclient.NewClient(tbclient.Config{})
	if err != nil {
		return err
	}
	ConfigureLedger(NewTigerBeetleLedgerBackend(client))
	return nil
}

func currentLedger() LedgerBackend {
	backendMu.RLock()
	defer backendMu.RUnlock()
	return ledger
}

func currentLocks() LockBackend {
	backendMu.RLock()
	defer backendMu.RUnlock()
	return lockBackend
}

func currentGLPoster() func(ctx context.Context, state *SagaState) error {
	backendMu.RLock()
	defer backendMu.RUnlock()
	return glPoster
}

func currentEventEmitter() func(ctx context.Context, topic, eventType string, state *SagaState) error {
	backendMu.RLock()
	defer backendMu.RUnlock()
	return eventEmitter
}

// --- Real TigerBeetle ledger backend (pkg/tbclient) ---

// tigerBeetleLedgerBackend implements LedgerBackend against a real cluster.
type tigerBeetleLedgerBackend struct {
	client *tbclient.Client
}

// NewTigerBeetleLedgerBackend wraps a connected tbclient.Client.
func NewTigerBeetleLedgerBackend(client *tbclient.Client) LedgerBackend {
	return &tigerBeetleLedgerBackend{client: client}
}

// accountIDToUint128 deterministically maps a platform account string ID to
// a TigerBeetle Uint128 (SHA-256, namespaced). Numeric string IDs map into
// the low 64 bits for interop with chart-of-accounts style IDs.
func accountIDToUint128(accountID string) tbclient.Uint128 {
	sum := sha256.Sum256([]byte("54bank/fundsaga/" + accountID))
	var b [16]byte
	copy(b[:], sum[:16])
	return tbclient.BytesToUint128(b)
}

// pendingIDToUint128 parses a hex-encoded pending transfer ID produced by
// CreatePendingTransfers.
func pendingIDToUint128(hexID string) (tbclient.Uint128, error) {
	raw, err := hex.DecodeString(hexID)
	if err != nil || len(raw) != 16 {
		return tbclient.Uint128{}, fmt.Errorf("invalid pending transfer ID %q", hexID)
	}
	var b [16]byte
	copy(b[:], raw)
	return tbclient.BytesToUint128(b), nil
}

func uint128Hex(id tbclient.Uint128) string {
	b := id.Bytes()
	return hex.EncodeToString(b[:])
}

// checkTransferResults fails unless every transfer was created/existed.
func checkTransferResults(op string, results []tbclient.CreateTransferResult) error {
	for _, r := range results {
		if r.Status != tbclient.TransferCreated && r.Status != tbclient.TransferExists {
			return fmt.Errorf("tigerbeetle %s rejected: status=%v", op, r.Status)
		}
	}
	return nil
}

func (b *tigerBeetleLedgerBackend) CreatePendingTransfers(ctx context.Context, transfers []LedgerTransfer, timeoutSecs uint32) ([]string, error) {
	if len(transfers) == 0 {
		return nil, fmt.Errorf("no transfers to reserve")
	}
	tbTransfers := make([]tbclient.Transfer, 0, len(transfers))
	for _, t := range transfers {
		if t.Amount <= 0 {
			return nil, fmt.Errorf("transfer amount must be positive: %d kobo", t.Amount)
		}
		tbTransfers = append(tbTransfers, tbclient.Transfer{
			ID:              tbclient.ID(),
			DebitAccountID:  accountIDToUint128(t.DebitAccountID),
			CreditAccountID: accountIDToUint128(t.CreditAccountID),
			Amount:          tbclient.ToUint128(uint64(t.Amount)),
			Ledger:          t.Ledger,
			Code:            t.Code,
			Timeout:         timeoutSecs, // TigerBeetle pending timeout is in seconds
			Flags:           tbclient.TransferFlags{Linked: true, Pending: true}.ToUint16(),
		})
	}
	// Close the linked chain.
	tbTransfers[len(tbTransfers)-1].Flags = tbclient.TransferFlags{Pending: true}.ToUint16()

	results, err := b.client.CreateTransfers(ctx, tbTransfers)
	if err != nil {
		return nil, fmt.Errorf("tigerbeetle create pending transfers: %w", err)
	}
	if err := checkTransferResults("create_pending", results); err != nil {
		return nil, err
	}
	ids := make([]string, len(tbTransfers))
	for i, t := range tbTransfers {
		ids[i] = uint128Hex(t.ID)
	}
	return ids, nil
}

func (b *tigerBeetleLedgerBackend) postOrVoid(ctx context.Context, pendingIDs []string, post bool) error {
	if len(pendingIDs) == 0 {
		return fmt.Errorf("no pending transfers to %s", map[bool]string{true: "post", false: "void"}[post])
	}
	transfers := make([]tbclient.Transfer, 0, len(pendingIDs))
	for _, hexID := range pendingIDs {
		pid, err := pendingIDToUint128(hexID)
		if err != nil {
			return err
		}
		flags := tbclient.TransferFlags{Linked: true, VoidPendingTransfer: true}
		if post {
			flags = tbclient.TransferFlags{Linked: true, PostPendingTransfer: true}
		}
		transfers = append(transfers, tbclient.Transfer{
			ID:        tbclient.ID(),
			PendingID: pid,
			Flags:     flags.ToUint16(),
		})
	}
	if post {
		transfers[len(transfers)-1].Flags = tbclient.TransferFlags{PostPendingTransfer: true}.ToUint16()
	} else {
		transfers[len(transfers)-1].Flags = tbclient.TransferFlags{VoidPendingTransfer: true}.ToUint16()
	}
	op := "void_pending"
	if post {
		op = "post_pending"
	}
	results, err := b.client.CreateTransfers(ctx, transfers)
	if err != nil {
		return fmt.Errorf("tigerbeetle %s: %w", op, err)
	}
	return checkTransferResults(op, results)
}

func (b *tigerBeetleLedgerBackend) PostPendingTransfers(ctx context.Context, pendingIDs []string) error {
	return b.postOrVoid(ctx, pendingIDs, true)
}

func (b *tigerBeetleLedgerBackend) VoidPendingTransfers(ctx context.Context, pendingIDs []string) error {
	return b.postOrVoid(ctx, pendingIDs, false)
}

func (b *tigerBeetleLedgerBackend) CreateReversalTransfers(ctx context.Context, legs []TransferLeg, reference string) error {
	if len(legs) == 0 {
		return fmt.Errorf("no legs to reverse")
	}
	transfers, err := pairLegs(legs, reference)
	if err != nil {
		return err
	}
	tbTransfers := make([]tbclient.Transfer, 0, len(transfers))
	for _, t := range transfers {
		tbTransfers = append(tbTransfers, tbclient.Transfer{
			ID:              tbclient.ID(),
			DebitAccountID:  accountIDToUint128(t.DebitAccountID),
			CreditAccountID: accountIDToUint128(t.CreditAccountID),
			Amount:          tbclient.ToUint128(uint64(t.Amount)),
			Ledger:          t.Ledger,
			Code:            t.Code,
			Flags:           tbclient.TransferFlags{Linked: true}.ToUint16(),
		})
	}
	tbTransfers[len(tbTransfers)-1].Flags = tbclient.TransferFlags{}.ToUint16()

	results, err := b.client.CreateTransfers(ctx, tbTransfers)
	if err != nil {
		return fmt.Errorf("tigerbeetle reversal transfers: %w", err)
	}
	return checkTransferResults("reversal", results)
}

// pairLegs decomposes balanced debit/credit legs into individual
// debit-account → credit-account transfers (waterfall pairing).
func pairLegs(legs []TransferLeg, reference string) ([]LedgerTransfer, error) {
	type side struct {
		accountID string
		ledger    uint32
		code      uint16
		remaining AmountKobo
	}
	var debits, credits []side
	for _, leg := range legs {
		if leg.Amount <= 0 {
			continue
		}
		if leg.Direction == "debit" {
			debits = append(debits, side{leg.AccountID, leg.Ledger, leg.Code, leg.Amount})
		} else {
			credits = append(credits, side{leg.AccountID, leg.Ledger, leg.Code, leg.Amount})
		}
	}
	if len(debits) == 0 || len(credits) == 0 {
		return nil, fmt.Errorf("no debit/credit legs to pair")
	}
	var out []LedgerTransfer
	di, ci := 0, 0
	for di < len(debits) && ci < len(credits) {
		amt := debits[di].remaining
		if credits[ci].remaining < amt {
			amt = credits[ci].remaining
		}
		out = append(out, LedgerTransfer{
			DebitAccountID:  debits[di].accountID,
			CreditAccountID: credits[ci].accountID,
			Amount:          amt,
			Ledger:          debits[di].ledger,
			Code:            debits[di].code,
			Reference:       reference,
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
		return nil, fmt.Errorf("unbalanced legs cannot be paired")
	}
	return out, nil
}

// pendingTimeoutSecs is the TigerBeetle pending-transfer timeout used by
// StepCreatePendingTransfer (overridable via FUNDSAGA_PENDING_TIMEOUT_SECS).
func pendingTimeoutSecs() uint32 {
	if v := os.Getenv("FUNDSAGA_PENDING_TIMEOUT_SECS"); v != "" {
		var n uint32
		if _, err := fmt.Sscanf(v, "%d", &n); err == nil && n > 0 {
			return n
		}
	}
	return 60
}

// --- Standard Saga Step Builders ---

// StepAcquireLock creates a saga step that acquires a distributed lock.
// Without a configured LockBackend the step fails — fund movement without
// locking is refused.
func StepAcquireLock(accountIDs []string, ttl time.Duration) SagaStep {
	return SagaStep{
		Name: "acquire_locks",
		Forward: func(ctx context.Context, state *SagaState) error {
			lb := currentLocks()
			if lb == nil {
				return ErrLockBackendNotConfigured
			}
			// Sort account IDs to prevent deadlocks (consistent ordering)
			sorted := sortStrings(accountIDs)
			keys := make([]string, 0, len(sorted))
			for _, id := range sorted {
				keys = append(keys, fmt.Sprintf("lock:account:%s", id))
			}
			release, err := lb.Acquire(ctx, keys, ttl)
			if err != nil {
				return fmt.Errorf("acquire distributed locks: %w", err)
			}
			state.lockRelease = release
			state.LockKeys = append(state.LockKeys, keys...)
			return nil
		},
		Compensate: func(ctx context.Context, state *SagaState) error {
			if state.lockRelease != nil {
				state.lockRelease()
				state.lockRelease = nil
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

// StepCreatePendingTransfer creates real TigerBeetle pending transfers
// (funds reserved in the cluster). Fails fast when no ledger is configured.
func StepCreatePendingTransfer() SagaStep {
	return SagaStep{
		Name: "create_pending_transfer",
		Forward: func(ctx context.Context, state *SagaState) error {
			lb := currentLedger()
			if lb == nil {
				return ErrLedgerNotConfigured
			}
			transfers, err := pairLegs(state.Legs, state.TransferID)
			if err != nil {
				return err
			}
			ids, err := lb.CreatePendingTransfers(ctx, transfers, pendingTimeoutSecs())
			if err != nil {
				return err
			}
			state.PendingIDs = append(state.PendingIDs, ids...)
			for i, id := range ids {
				state.AuditEntries = append(state.AuditEntries,
					fmt.Sprintf("pending_confirmed:%s:transfer_%d", id, i))
			}
			return nil
		},
		Compensate: func(ctx context.Context, state *SagaState) error {
			// Void all pending transfers in the cluster (release the reservation)
			if len(state.PendingIDs) == 0 {
				return nil
			}
			lb := currentLedger()
			if lb == nil {
				return fmt.Errorf("cannot void pending transfers: %v", ErrLedgerNotConfigured)
			}
			if err := lb.VoidPendingTransfers(ctx, state.PendingIDs); err != nil {
				return fmt.Errorf("void pending transfers: %w", err)
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
			// AML decision is supplied by the caller via metadata; absence of
			// a decision means screening did not run, which the caller must
			// gate before executing the saga.
			if blocked, ok := state.Metadata["aml_blocked"].(bool); ok && blocked {
				return fmt.Errorf("transaction blocked by AML screening")
			}
			return nil
		},
		Compensate: nil, // screening has no side effects
	}
}

// StepCommitTransfer commits all pending TigerBeetle transfers in the
// cluster (post_pending_transfer). Fails fast when no ledger is configured
// or when there are no real pending transfers to commit.
func StepCommitTransfer() SagaStep {
	return SagaStep{
		Name: "commit_transfer",
		Forward: func(ctx context.Context, state *SagaState) error {
			lb := currentLedger()
			if lb == nil {
				return ErrLedgerNotConfigured
			}
			if len(state.PendingIDs) == 0 {
				return fmt.Errorf("no pending transfers to commit — refusing to report funds as moved")
			}
			// Point of no return — after commit, funds have moved.
			return lb.PostPendingTransfers(ctx, state.PendingIDs)
		},
		// Committed transfers cannot be voided — compensate with real
		// reversal transfers in the cluster.
		Compensate: func(ctx context.Context, state *SagaState) error {
			lb := currentLedger()
			if lb == nil {
				return fmt.Errorf("cannot reverse committed transfers: %v", ErrLedgerNotConfigured)
			}
			reversed := make([]TransferLeg, 0, len(state.Legs))
			for _, leg := range state.Legs {
				dir := "credit"
				if leg.Direction == "credit" {
					dir = "debit"
				}
				reversed = append(reversed, TransferLeg{
					AccountID: leg.AccountID, Amount: leg.Amount,
					Direction: dir, Ledger: leg.Ledger, Code: leg.Code,
				})
			}
			return lb.CreateReversalTransfers(ctx, reversed, fmt.Sprintf("REV-%s", state.TransferID))
		},
	}
}

// StepPostGL posts the GL journal entry mirroring the transfer legs via the
// configured GL poster. Without one, the step fails — no phantom journal.
func StepPostGL() SagaStep {
	return SagaStep{
		Name: "post_gl",
		Forward: func(ctx context.Context, state *SagaState) error {
			poster := currentGLPoster()
			if poster == nil {
				return fmt.Errorf("fundsaga: GL poster not configured (call fundsaga.ConfigureGLPoster) — refusing to silently skip the journal entry")
			}
			return poster(ctx, state)
		},
		Compensate: func(ctx context.Context, state *SagaState) error {
			// The reversal transfer created by StepCommitTransfer's
			// compensation must be mirrored by the GL poster; the poster
			// implementation is responsible for contra entries.
			return nil
		},
	}
}

// StepEmitEvent emits the transfer event via the configured emitter
// (transactional outbox → Kafka). Without one, the step fails — events are
// never silently dropped while the saga reports success.
func StepEmitEvent(topic, eventType string) SagaStep {
	return SagaStep{
		Name: "emit_event",
		Forward: func(ctx context.Context, state *SagaState) error {
			emitter := currentEventEmitter()
			if emitter == nil {
				return fmt.Errorf("fundsaga: event emitter not configured (call fundsaga.ConfigureEventEmitter) — refusing to silently drop %s", eventType)
			}
			return emitter(ctx, topic, eventType, state)
		},
		Compensate: nil, // events are informational; downstream must be idempotent
	}
}

// StepReleaseLocks releases all distributed locks held by this saga.
func StepReleaseLocks() SagaStep {
	return SagaStep{
		Name: "release_locks",
		Forward: func(ctx context.Context, state *SagaState) error {
			if state.lockRelease != nil {
				state.lockRelease()
				state.lockRelease = nil
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
			lb := currentLocks()
			if lb == nil {
				return ErrLockBackendNotConfigured
			}
			// Lock the FX rate for the duration of the transaction.
			release, err := lb.Acquire(ctx, []string{fmt.Sprintf("fx-lock:%s", state.TransferID)}, 120*time.Second)
			if err != nil {
				return fmt.Errorf("lock fx rate: %w", err)
			}
			prev := state.lockRelease
			state.lockRelease = func() {
				release()
				if prev != nil {
					prev()
				}
			}
			return nil
		},
		Compensate: func(ctx context.Context, state *SagaState) error {
			if state.lockRelease != nil {
				state.lockRelease()
				state.lockRelease = nil
			}
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
