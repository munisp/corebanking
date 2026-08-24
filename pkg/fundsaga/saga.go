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
	"math"
	"math/big"
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
	// Currency is the ISO 4217 currency of the amount ("" means the platform
	// default, NGN). Balance validation is enforced PER CURRENCY: a leg set
	// that mixes currencies must balance within each currency — summing NGN
	// and USD amounts into one numeric total is meaningless and is rejected.
	Currency string `json:"currency,omitempty"`
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

	// StepKeys holds the deterministic idempotency key of every step that
	// has run (derived from the saga identity + step index). CurrentStepKey
	// is the key of the step currently executing — money-moving steps use it
	// as the ledger reference so a retried step replays idempotently.
	StepKeys       []string `json:"step_keys,omitempty"`
	CurrentStepKey string   `json:"current_step_key,omitempty"`

	lockRelease func() // held lock release func (not serialized)
}

// SagaResult is the outcome of a saga execution.
type SagaResult struct {
	TransferID string      `json:"transfer_id"`
	Status     string      `json:"status"` // "completed", "compensated", "compensation_failed", "failed"
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

// stepIdempotencyKey derives the deterministic idempotency key for saga step
// i from the saga identity (caller-supplied IdempotencyKey when present, else
// TransferID). Retried sagas with the same identity replay steps under the
// same keys, so ledger operations yield idempotent-exists instead of
// duplicates.
func stepIdempotencyKey(state *SagaState, stepIndex int, stepName string) string {
	base := state.IdempotencyKey
	if base == "" {
		base = state.TransferID
	}
	sum := sha256.Sum256([]byte(fmt.Sprintf("54bank/fundsaga/%s/step/%d/%s", base, stepIndex, stepName)))
	return hex.EncodeToString(sum[:16])
}

// ExecuteSaga runs steps in order. On failure, compensates in reverse.
// The returned status is "completed" ONLY when every step succeeded —
// meaning pending transfers were really created in TigerBeetle and really
// committed. A failure yields "failed" (nothing to undo), "compensated"
// (every compensation succeeded), or "compensation_failed" (at least one
// compensation failed — side effects may remain; the error carries the
// detail) plus a non-nil error. "compensated" is NEVER reported when a
// compensation errored.
func ExecuteSaga(ctx context.Context, steps []SagaStep, state *SagaState) (*SagaResult, error) {
	start := time.Now()
	result := &SagaResult{
		TransferID: state.TransferID,
		Status:     "in_progress",
	}

	for i, step := range steps {
		state.CurrentStepKey = stepIdempotencyKey(state, i, step.Name)
		state.StepKeys = append(state.StepKeys, state.CurrentStepKey)
		if err := step.Forward(ctx, state); err != nil {
			state.Error = fmt.Sprintf("step %d (%s) failed: %v", i, step.Name, err)
			result.Error = state.Error

			// Compensate in reverse order
			compensations := 0
			compFailed := false
			for j := i - 1; j >= 0; j-- {
				if steps[j].Compensate != nil {
					compensations++
					state.CurrentStepKey = stepIdempotencyKey(state, j, steps[j].Name) + ":compensate"
					if compErr := steps[j].Compensate(ctx, state); compErr != nil {
						// Compensation failure is critical — propagate it:
						// the saga did NOT fully unwind and must not report
						// "compensated".
						compFailed = true
						result.Error += fmt.Sprintf("; compensation step %d (%s) also failed: %v", j, steps[j].Name, compErr)
					}
				}
			}
			switch {
			case compFailed:
				result.Status = "compensation_failed"
			case compensations > 0:
				result.Status = "compensated"
			default:
				result.Status = "failed"
			}
			result.Duration = time.Since(start).Microseconds()
			return result, fmt.Errorf("saga %s: %s", result.Status, result.Error)
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
	backendMu      sync.RWMutex
	ledger         LedgerBackend
	lockBackend    LockBackend
	glPoster       func(ctx context.Context, state *SagaState) error
	eventEmitter   func(ctx context.Context, topic, eventType string, state *SagaState) error
	fxRateProvider FXRateProvider
)

// ErrLedgerNotConfigured is returned by fund-movement steps when no ledger
// backend has been configured. Sagas fail (never "completed") in this state.
var ErrLedgerNotConfigured = fmt.Errorf("fundsaga: TigerBeetle ledger backend not configured — refusing to move funds (call fundsaga.ConfigureLedger or ConfigureLedgerFromEnv)")

// ErrLockBackendNotConfigured is returned when distributed locks are
// unavailable; fund movement without locking is refused.
var ErrLockBackendNotConfigured = fmt.Errorf("fundsaga: distributed lock backend not configured (call fundsaga.ConfigureLocks)")

// ErrFXRateSourceNotConfigured is returned when a cross-border saga is built
// without an FX rate source. Caller-supplied or assumed rates are refused.
var ErrFXRateSourceNotConfigured = fmt.Errorf("fundsaga: FX rate source not configured — refusing cross-border conversion (call fundsaga.ConfigureFXRateSource)")

// FXRateProvider resolves the FX rate for a currency pair on a value date
// from an authoritative rate table/service. The rate is expressed in basis
// points of minor units: receiveMinor = sendMinor * rateBps / 10000.
// Implementations must return an error when no rate is available — there is
// no fallback rate.
type FXRateProvider func(fromCurrency, toCurrency string, valueDate time.Time) (rateBps int64, err error)

// ConfigureFXRateSource installs the FX rate source used by cross-border
// sagas. Until configured, CrossBorderRemittanceSaga fails fast.
func ConfigureFXRateSource(p FXRateProvider) {
	backendMu.Lock()
	defer backendMu.Unlock()
	fxRateProvider = p
}

func currentFXRateProvider() FXRateProvider {
	backendMu.RLock()
	defer backendMu.RUnlock()
	return fxRateProvider
}

// convertAmountKobo converts amount at rateBps/10000 using arbitrary
// precision arithmetic. The result must fit int64 and be positive — overflow
// or round-to-zero is an error, never a silently wrapped/truncated amount.
func convertAmountKobo(amount AmountKobo, rateBps int64) (AmountKobo, error) {
	if amount <= 0 {
		return 0, fmt.Errorf("amount must be positive: %d", amount)
	}
	if rateBps <= 0 {
		return 0, fmt.Errorf("fx rate must be positive: %d bps", rateBps)
	}
	prod := new(big.Int).Mul(big.NewInt(int64(amount)), big.NewInt(rateBps))
	q := new(big.Int).Quo(prod, big.NewInt(10000))
	if !q.IsInt64() {
		return 0, fmt.Errorf("fx conversion overflow: %d * %d bps exceeds int64 minor units", int64(amount), rateBps)
	}
	out := q.Int64()
	if out <= 0 {
		return 0, fmt.Errorf("fx conversion of %d minor units at %d bps rounds to zero", int64(amount), rateBps)
	}
	return AmountKobo(out), nil
}

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

// deterministicTransferID derives a stable TigerBeetle transfer ID from a
// saga step reference + leg index (sha256, namespaced). A retried saga step
// resubmits the SAME transfer IDs, so the cluster returns TransferExists
// instead of applying a duplicate.
func deterministicTransferID(reference string, index int) tbclient.Uint128 {
	sum := sha256.Sum256([]byte(fmt.Sprintf("54bank/fundsaga/transfer/%s/%d", reference, index)))
	var b [16]byte
	copy(b[:], sum[:16])
	return tbclient.BytesToUint128(b)
}

func (b *tigerBeetleLedgerBackend) CreatePendingTransfers(ctx context.Context, transfers []LedgerTransfer, timeoutSecs uint32) ([]string, error) {
	if len(transfers) == 0 {
		return nil, fmt.Errorf("no transfers to reserve")
	}
	tbTransfers := make([]tbclient.Transfer, 0, len(transfers))
	for i, t := range transfers {
		if t.Amount <= 0 {
			return nil, fmt.Errorf("transfer amount must be positive: %d kobo", t.Amount)
		}
		tbTransfers = append(tbTransfers, tbclient.Transfer{
			ID:              deterministicTransferID(t.Reference, i),
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
	op := "void_pending"
	if post {
		op = "post_pending"
	}
	for i, hexID := range pendingIDs {
		pid, err := pendingIDToUint128(hexID)
		if err != nil {
			return err
		}
		flags := tbclient.TransferFlags{Linked: true, VoidPendingTransfer: true}
		if post {
			flags = tbclient.TransferFlags{Linked: true, PostPendingTransfer: true}
		}
		transfers = append(transfers, tbclient.Transfer{
			// Deterministic post/void ID: a retried post/void of the same
			// pending transfer replays idempotently (TransferExists).
			ID:        deterministicTransferID(op+":"+hexID, i),
			PendingID: pid,
			Flags:     flags.ToUint16(),
		})
	}
	if post {
		transfers[len(transfers)-1].Flags = tbclient.TransferFlags{PostPendingTransfer: true}.ToUint16()
	} else {
		transfers[len(transfers)-1].Flags = tbclient.TransferFlags{VoidPendingTransfer: true}.ToUint16()
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
	for i, t := range transfers {
		tbTransfers = append(tbTransfers, tbclient.Transfer{
			ID:              deterministicTransferID(reference, i),
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

// defaultCurrency is assumed for legs without an explicit currency.
const defaultCurrency = "NGN"

func legCurrency(leg TransferLeg) string {
	if leg.Currency == "" {
		return defaultCurrency
	}
	return leg.Currency
}

// pairLegs decomposes balanced debit/credit legs into individual
// debit-account → credit-account transfers (waterfall pairing). Legs of
// different currencies are NEVER paired into one transfer: a single ledger
// transfer moves one currency, so a cross-currency pair is a construction
// error and is refused.
func pairLegs(legs []TransferLeg, reference string) ([]LedgerTransfer, error) {
	type side struct {
		accountID string
		ledger    uint32
		code      uint16
		currency  string
		remaining AmountKobo
	}
	var debits, credits []side
	for _, leg := range legs {
		if leg.Amount <= 0 {
			continue
		}
		if leg.Direction == "debit" {
			debits = append(debits, side{leg.AccountID, leg.Ledger, leg.Code, legCurrency(leg), leg.Amount})
		} else {
			credits = append(credits, side{leg.AccountID, leg.Ledger, leg.Code, legCurrency(leg), leg.Amount})
		}
	}
	if len(debits) == 0 || len(credits) == 0 {
		return nil, fmt.Errorf("no debit/credit legs to pair")
	}
	var out []LedgerTransfer
	di, ci := 0, 0
	for di < len(debits) && ci < len(credits) {
		if debits[di].currency != credits[ci].currency {
			return nil, fmt.Errorf("cross-currency pairing refused: debit %s (%s) vs credit %s (%s)",
				debits[di].accountID, debits[di].currency, credits[ci].accountID, credits[ci].currency)
		}
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
			// Validate double-entry PER CURRENCY: debits must equal credits
			// within each currency. Summing amounts across currencies into one
			// numeric total is meaningless (a cross-border leg set is balanced
			// only when every currency balances on its own). Addition is
			// overflow-checked.
			type totals struct{ debit, credit AmountKobo }
			byCurrency := map[string]*totals{}
			for _, leg := range state.Legs {
				cur := legCurrency(leg)
				t := byCurrency[cur]
				if t == nil {
					t = &totals{}
					byCurrency[cur] = t
				}
				if leg.Direction == "debit" {
					if int64(t.debit) > math.MaxInt64-int64(leg.Amount) {
						return fmt.Errorf("debit total overflow for currency %s", cur)
					}
					t.debit += leg.Amount
				} else {
					if int64(t.credit) > math.MaxInt64-int64(leg.Amount) {
						return fmt.Errorf("credit total overflow for currency %s", cur)
					}
					t.credit += leg.Amount
				}
			}
			for _, cur := range sortStrings(mapKeys(byCurrency)) {
				t := byCurrency[cur]
				if t.debit != t.credit {
					return fmt.Errorf("double-entry imbalance in %s: debit=%d credit=%d minor units", cur, t.debit, t.credit)
				}
			}
			return nil
		},
		Compensate: nil, // validation has no side effects
	}
}

// StepCreatePendingTransfer creates real TigerBeetle pending transfers
// (funds reserved in the cluster). Fails fast when no ledger is configured.
// The step's idempotency key (saga ID + step index) is the ledger reference,
// so a retried step yields TransferExists instead of duplicate reservations.
func StepCreatePendingTransfer() SagaStep {
	return SagaStep{
		Name: "create_pending_transfer",
		Forward: func(ctx context.Context, state *SagaState) error {
			lb := currentLedger()
			if lb == nil {
				return ErrLedgerNotConfigured
			}
			reference := state.TransferID
			if state.CurrentStepKey != "" {
				reference = state.CurrentStepKey
			}
			transfers, err := pairLegs(state.Legs, reference)
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
			// Idempotency: the reversal reference is derived from the saga
			// step key when available, so a retried compensation replays
			// against the same deterministic ledger transfer IDs.
			reference := fmt.Sprintf("REV-%s", state.TransferID)
			if state.CurrentStepKey != "" {
				reference = "REV-" + state.CurrentStepKey
			}
			return lb.CreateReversalTransfers(ctx, reversed, reference)
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
//
// Invariants enforced (H-08):
//   - The FX rate is resolved from the configured rate source (currency pair +
//     value date), NEVER taken from the caller. Without a configured rate
//     source the saga fails fast with ErrFXRateSourceNotConfigured.
//   - The conversion uses overflow-safe arbitrary-precision arithmetic; the
//     receive amount must fit int64 and be positive.
//   - Legs carry explicit currencies: the send side (sender debit + nostro
//     credit) is NGN, the receive side (vostro debit + beneficiary credit) is
//     receiveCurrency. Balance validation is enforced per currency, and
//     pairLegs refuses to pair legs of different currencies into one transfer.
func CrossBorderRemittanceSaga(senderID, beneficiaryID string, sendAmountKobo AmountKobo, receiveCurrency string) ([]SagaStep, *SagaState, error) {
	provider := currentFXRateProvider()
	if provider == nil {
		return nil, nil, ErrFXRateSourceNotConfigured
	}
	if receiveCurrency == "" || receiveCurrency == defaultCurrency {
		return nil, nil, fmt.Errorf("cross-border saga requires a foreign receive currency, got %q", receiveCurrency)
	}
	valueDate := time.Now().UTC().Truncate(24 * time.Hour)
	fxRate, err := provider(defaultCurrency, receiveCurrency, valueDate)
	if err != nil {
		return nil, nil, fmt.Errorf("fx rate lookup %s/%s for %s: %w", defaultCurrency, receiveCurrency, valueDate.Format("2006-01-02"), err)
	}
	receiveAmount, err := convertAmountKobo(sendAmountKobo, fxRate)
	if err != nil {
		return nil, nil, fmt.Errorf("fx conversion %s->%s: %w", defaultCurrency, receiveCurrency, err)
	}
	state := &SagaState{
		TransferID: fmt.Sprintf("REMIT-%d", time.Now().UnixNano()),
		Legs: []TransferLeg{
			{AccountID: senderID, Amount: sendAmountKobo, Direction: "debit", Ledger: 1, Code: 4001, Currency: defaultCurrency},
			{AccountID: "nostro-" + receiveCurrency, Amount: sendAmountKobo, Direction: "credit", Ledger: 5, Code: 4001, Currency: defaultCurrency},
			{AccountID: "vostro-" + receiveCurrency, Amount: receiveAmount, Direction: "debit", Ledger: 6, Code: 4001, Currency: receiveCurrency},
			{AccountID: beneficiaryID, Amount: receiveAmount, Direction: "credit", Ledger: 1, Code: 4001, Currency: receiveCurrency},
		},
		Metadata: map[string]interface{}{
			"fx_rate_bps":      fxRate,
			"fx_value_date":    valueDate.Format("2006-01-02"),
			"send_currency":    defaultCurrency,
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
	return steps, state, nil
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

// mapKeys returns the keys of a string-keyed map (order normalized by the
// caller via sortStrings where deterministic output is required).
func mapKeys[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
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
