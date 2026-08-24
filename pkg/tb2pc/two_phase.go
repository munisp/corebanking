// Package tb2pc provides TigerBeetle two-phase commit integration for the
// 54Bank platform. All fund movements use pending transfers that are
// committed or voided atomically.
//
// TigerBeetle two-phase commit flow:
//  1. create_transfers with flags.pending → funds reserved (pending)
//  2. create_transfers with flags.post_pending_transfer → funds committed
//     OR create_transfers with flags.void_pending_transfer → funds released
//
// This ensures atomicity: funds are never in an inconsistent state.
//
// Fail-fast guarantee: every operation calls the real TigerBeetle cluster
// (via pkg/tbclient). When the cluster is not configured/reachable,
// CreatePending/CreateLinkedPending/PostPending/VoidPending return
// ErrTigerBeetleUnavailable — no reservation or posting is ever simulated
// by flipping local bookkeeping.
package tb2pc

import (
	"context"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"log"
	"math"
	"sync"
	"sync/atomic"
	"time"

	"github.com/munisp/corebanking/pkg/tbclient"
)

// AmountKobo — int64 in kobo. Never float64.
type AmountKobo = int64

// TransferFlags mirrors TigerBeetle transfer flags.
type TransferFlags uint16

const (
	FlagNone                TransferFlags = 0
	FlagLinked              TransferFlags = 1 << 0 // linked: all-or-nothing batch
	FlagPending             TransferFlags = 1 << 1 // two-phase: reserve funds
	FlagPostPendingTransfer TransferFlags = 1 << 2 // commit a pending transfer
	FlagVoidPendingTransfer TransferFlags = 1 << 3 // void a pending transfer
	FlagBalancingDebit      TransferFlags = 1 << 4 // debit must not exceed credits
	FlagBalancingCredit     TransferFlags = 1 << 5 // credit must not exceed debits
)

// Transfer represents a TigerBeetle transfer.
type Transfer struct {
	ID              uint128       `json:"id"`
	DebitAccountID  uint128       `json:"debit_account_id"`
	CreditAccountID uint128       `json:"credit_account_id"`
	Amount          AmountKobo    `json:"amount"`
	PendingID       uint128       `json:"pending_id,omitempty"` // for post/void
	Ledger          uint32        `json:"ledger"`
	Code            uint16        `json:"code"`
	Flags           TransferFlags `json:"flags"`
	Timeout         time.Duration `json:"timeout_ns,omitempty"` // pending transfer timeout (nanoseconds; int64 — no uint32 truncation)
	Timestamp       int64         `json:"timestamp"`
	UserData128     uint128       `json:"user_data_128,omitempty"`
}

// uint128 is a 128-bit unsigned integer (TigerBeetle's native ID type).
type uint128 struct {
	Hi uint64 `json:"hi"`
	Lo uint64 `json:"lo"`
}

// NewID creates a uint128 from a uint64 (for convenience).
func NewID(lo uint64) uint128 { return uint128{Hi: 0, Lo: lo} }

// String returns the 32-char hex encoding (big-endian display form).
func (u uint128) String() string {
	var b [16]byte
	binary.BigEndian.PutUint64(b[:8], u.Hi)
	binary.BigEndian.PutUint64(b[8:], u.Lo)
	return hex.EncodeToString(b[:])
}

// parseUint128Hex parses the hex form produced by String().
func parseUint128Hex(s string) (uint128, error) {
	raw, err := hex.DecodeString(s)
	if err != nil || len(raw) != 16 {
		return uint128{}, fmt.Errorf("invalid uint128 hex %q", s)
	}
	return uint128{
		Hi: binary.BigEndian.Uint64(raw[:8]),
		Lo: binary.BigEndian.Uint64(raw[8:]),
	}, nil
}

// toTB converts to the SDK Uint128 (little-endian byte order).
func toTB(u uint128) tbclient.Uint128 {
	return tbclient.Uint128FromU64(u.Lo, u.Hi)
}

// fromTB converts an SDK Uint128 back to the local representation.
func fromTB(v tbclient.Uint128) uint128 {
	lo, hi := v.Uint64()
	return uint128{Lo: lo, Hi: hi}
}

// ErrTigerBeetleUnavailable is returned by every two-phase operation when no
// TigerBeetle cluster connection exists. Funds are NOT reserved, posted, or
// voided in that state — callers must surface the failure.
var ErrTigerBeetleUnavailable = fmt.Errorf("tb2pc: tigerbeetle cluster unavailable — set TIGERBEETLE_ADDRESSES/TB_ADDRESS or use NewTwoPhaseCommitManagerWithClient")

// transferPoster is the subset of the ledger client the manager needs.
// *tbclient.Client satisfies it; tests may substitute a recording double.
type transferPoster interface {
	CreateTransfers(ctx context.Context, transfers []tbclient.Transfer) ([]tbclient.CreateTransferResult, error)
}

// PendingTransfer represents an in-flight two-phase transfer.
type PendingTransfer struct {
	Transfer  Transfer  `json:"transfer"`
	CreatedAt time.Time `json:"created_at"`
	TimeoutAt time.Time `json:"timeout_at"`
	Status    string    `json:"status"` // "pending", "posted", "voided", "expired"
}

// TwoPhaseCommitManager manages pending transfers against a real
// TigerBeetle cluster. The in-memory map only tracks the status of
// transfers that exist in the cluster; it is never the system of record.
type TwoPhaseCommitManager struct {
	mu         sync.RWMutex
	pending    map[uint128]*PendingTransfer
	tb         transferPoster
	clusterErr error
	idCounter  uint64
	posted     int64
	voided     int64
	expired    int64
	timeout    time.Duration // default pending timeout (int64 nanoseconds — uint32 truncation of e.g. 60s to ~4.2s was a confirmed incident)
}

// NewTwoPhaseCommitManager creates a manager connected to the cluster
// configured via TIGERBEETLE_ADDRESSES / TB_ADDRESS (see pkg/tbclient).
// When the connection cannot be established, every operation returns
// ErrTigerBeetleUnavailable.
func NewTwoPhaseCommitManager(defaultTimeout time.Duration) *TwoPhaseCommitManager {
	mgr := &TwoPhaseCommitManager{
		pending: make(map[uint128]*PendingTransfer),
		timeout: defaultTimeout,
	}
	client, err := tbclient.NewClient(tbclient.Config{})
	if err != nil {
		mgr.clusterErr = err
		log.Printf("[tb2pc] FATAL: TigerBeetle cluster unreachable (%v) — all two-phase operations will fail with ErrTigerBeetleUnavailable", err)
	} else {
		mgr.tb = client
	}
	go mgr.expireLoop()
	return mgr
}

// NewTwoPhaseCommitManagerWithClient creates a manager over an existing
// connected tbclient.Client. A nil client yields fail-fast behavior.
func NewTwoPhaseCommitManagerWithClient(defaultTimeout time.Duration, client *tbclient.Client) *TwoPhaseCommitManager {
	mgr := &TwoPhaseCommitManager{
		pending: make(map[uint128]*PendingTransfer),
		timeout: defaultTimeout,
	}
	if client == nil {
		mgr.clusterErr = fmt.Errorf("nil tbclient")
	} else {
		mgr.tb = client
	}
	go mgr.expireLoop()
	return mgr
}

// newManagerWithPoster wires a custom transfer poster (used by tests).
func newManagerWithPoster(defaultTimeout time.Duration, poster transferPoster) *TwoPhaseCommitManager {
	mgr := &TwoPhaseCommitManager{
		pending: make(map[uint128]*PendingTransfer),
		timeout: defaultTimeout,
		tb:      poster,
	}
	if poster == nil {
		mgr.clusterErr = fmt.Errorf("nil transfer poster")
	}
	go mgr.expireLoop()
	return mgr
}

// Available reports whether the manager can reach the cluster.
func (m *TwoPhaseCommitManager) Available() bool { return m.tb != nil }

func (m *TwoPhaseCommitManager) unavailableErr() error {
	if m.clusterErr != nil {
		return fmt.Errorf("%w: %v", ErrTigerBeetleUnavailable, m.clusterErr)
	}
	return ErrTigerBeetleUnavailable
}

// timeoutSeconds converts the configured timeout to TigerBeetle's
// seconds-based pending timeout (minimum 1s, capped at uint32 max).
// The manager stores the timeout as time.Duration (int64 nanoseconds), so
// values above ~4.29s are no longer truncated by a uint32 nanosecond
// conversion.
func (m *TwoPhaseCommitManager) timeoutSeconds() uint32 {
	secs := m.timeout / time.Second
	if secs < 1 {
		secs = 1
	}
	if secs > time.Duration(math.MaxUint32) {
		secs = time.Duration(math.MaxUint32)
	}
	return uint32(secs)
}

// submit sends transfers to the cluster and fails unless all were created
// (or already existed — idempotent retry).
func (m *TwoPhaseCommitManager) submit(op string, transfers []tbclient.Transfer) error {
	results, err := m.tb.CreateTransfers(context.Background(), transfers)
	if err != nil {
		return fmt.Errorf("tigerbeetle %s: %w", op, err)
	}
	for _, r := range results {
		if r.Status != tbclient.TransferCreated && r.Status != tbclient.TransferExists {
			return fmt.Errorf("tigerbeetle %s rejected: status=%v", op, r.Status)
		}
	}
	return nil
}

// CreatePending creates a pending (reserved) transfer in the cluster.
// Funds are held but not yet committed.
func (m *TwoPhaseCommitManager) CreatePending(debitAccount, creditAccount uint128, amount AmountKobo, ledger uint32, code uint16) (*PendingTransfer, error) {
	if amount <= 0 {
		return nil, fmt.Errorf("amount must be positive: %d", amount)
	}
	if m.tb == nil {
		return nil, m.unavailableErr()
	}

	now := time.Now()
	timeout := m.timeout
	id := fromTB(tbclient.ID())

	transfer := Transfer{
		ID:              id,
		DebitAccountID:  debitAccount,
		CreditAccountID: creditAccount,
		Amount:          amount,
		Ledger:          ledger,
		Code:            code,
		Flags:           FlagPending,
		Timeout:         m.timeout,
		Timestamp:       now.UnixNano(),
	}

	err := m.submit("create_pending", []tbclient.Transfer{{
		ID:              toTB(id),
		DebitAccountID:  toTB(debitAccount),
		CreditAccountID: toTB(creditAccount),
		Amount:          tbclient.ToUint128(uint64(amount)),
		Ledger:          ledger,
		Code:            code,
		Timeout:         m.timeoutSeconds(),
		Flags:           tbclient.TransferFlags{Pending: true}.ToUint16(),
	}})
	if err != nil {
		return nil, err
	}

	pt := &PendingTransfer{
		Transfer:  transfer,
		CreatedAt: now,
		TimeoutAt: now.Add(timeout),
		Status:    "pending",
	}

	m.mu.Lock()
	m.pending[id] = pt
	m.mu.Unlock()

	return pt, nil
}

// CreateLinkedPending creates multiple pending transfers that are all-or-nothing.
func (m *TwoPhaseCommitManager) CreateLinkedPending(transfers []Transfer) ([]*PendingTransfer, error) {
	if len(transfers) == 0 {
		return nil, fmt.Errorf("no transfers supplied")
	}
	if m.tb == nil {
		return nil, m.unavailableErr()
	}

	now := time.Now()
	timeout := m.timeout

	// Validate: amounts positive; totals balanced per ledger is the caller's
	// responsibility (TigerBeetle enforces account-level invariants).
	for _, t := range transfers {
		if t.Amount <= 0 {
			return nil, fmt.Errorf("all amounts must be positive")
		}
	}

	tbTransfers := make([]tbclient.Transfer, 0, len(transfers))
	for i := range transfers {
		id := fromTB(tbclient.ID())
		transfers[i].ID = id
		transfers[i].Flags = FlagPending | FlagLinked
		transfers[i].Timeout = m.timeout
		transfers[i].Timestamp = now.UnixNano()

		tbTransfers = append(tbTransfers, tbclient.Transfer{
			ID:              toTB(id),
			DebitAccountID:  toTB(transfers[i].DebitAccountID),
			CreditAccountID: toTB(transfers[i].CreditAccountID),
			Amount:          tbclient.ToUint128(uint64(transfers[i].Amount)),
			Ledger:          transfers[i].Ledger,
			Code:            transfers[i].Code,
			Timeout:         m.timeoutSeconds(),
			Flags:           tbclient.TransferFlags{Linked: true, Pending: true}.ToUint16(),
		})
	}
	// Close the linked chain.
	transfers[len(transfers)-1].Flags = FlagPending
	tbTransfers[len(tbTransfers)-1].Flags = tbclient.TransferFlags{Pending: true}.ToUint16()

	if err := m.submit("create_linked_pending", tbTransfers); err != nil {
		return nil, err
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	results := make([]*PendingTransfer, 0, len(transfers))
	for i := range transfers {
		pt := &PendingTransfer{
			Transfer:  transfers[i],
			CreatedAt: now,
			TimeoutAt: now.Add(timeout),
			Status:    "pending",
		}
		m.pending[transfers[i].ID] = pt
		results = append(results, pt)
	}

	return results, nil
}

// getPending validates that a pending transfer exists and is committable.
func (m *TwoPhaseCommitManager) getPending(pendingID uint128) (*PendingTransfer, error) {
	pt, ok := m.pending[pendingID]
	if !ok {
		return nil, fmt.Errorf("pending transfer not found: %v", pendingID)
	}
	if pt.Status != "pending" {
		return nil, fmt.Errorf("transfer already %s", pt.Status)
	}
	if time.Now().After(pt.TimeoutAt) {
		pt.Status = "expired"
		atomic.AddInt64(&m.expired, 1)
		return nil, fmt.Errorf("pending transfer expired at %v", pt.TimeoutAt)
	}
	return pt, nil
}

// PostPending commits a pending transfer in the cluster — funds are now final.
func (m *TwoPhaseCommitManager) PostPending(pendingID uint128) error {
	if m.tb == nil {
		return m.unavailableErr()
	}

	m.mu.Lock()
	pt, err := m.getPending(pendingID)
	m.mu.Unlock()
	if err != nil {
		return err
	}

	if err := m.submit("post_pending", []tbclient.Transfer{{
		ID:        tbclient.ID(),
		PendingID: toTB(pendingID),
		Flags:     tbclient.TransferFlags{PostPendingTransfer: true}.ToUint16(),
	}}); err != nil {
		return err
	}

	m.mu.Lock()
	pt.Status = "posted"
	m.mu.Unlock()
	atomic.AddInt64(&m.posted, 1)
	return nil
}

// VoidPending voids a pending transfer in the cluster — reserved funds are released.
func (m *TwoPhaseCommitManager) VoidPending(pendingID uint128) error {
	if m.tb == nil {
		return m.unavailableErr()
	}

	m.mu.Lock()
	pt, err := m.getPending(pendingID)
	m.mu.Unlock()
	if err != nil {
		return err
	}

	if err := m.submit("void_pending", []tbclient.Transfer{{
		ID:        tbclient.ID(),
		PendingID: toTB(pendingID),
		Flags:     tbclient.TransferFlags{VoidPendingTransfer: true}.ToUint16(),
	}}); err != nil {
		return err
	}

	m.mu.Lock()
	pt.Status = "voided"
	m.mu.Unlock()
	atomic.AddInt64(&m.voided, 1)
	return nil
}

// Stats returns the current state of the two-phase commit manager.
func (m *TwoPhaseCommitManager) Stats() map[string]interface{} {
	m.mu.RLock()
	pendingCount := 0
	for _, pt := range m.pending {
		if pt.Status == "pending" {
			pendingCount++
		}
	}
	m.mu.RUnlock()

	return map[string]interface{}{
		"pending_count":     pendingCount,
		"total_posted":      atomic.LoadInt64(&m.posted),
		"total_voided":      atomic.LoadInt64(&m.voided),
		"total_expired":     atomic.LoadInt64(&m.expired),
		"cluster_available": m.tb != nil,
	}
}

// expireLoop periodically marks timed-out pending transfers as expired in
// local bookkeeping. The cluster independently enforces pending timeouts —
// an expired pending transfer can never be posted by the cluster.
func (m *TwoPhaseCommitManager) expireLoop() {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for range ticker.C {
		now := time.Now()
		m.mu.Lock()
		for _, pt := range m.pending {
			if pt.Status == "pending" && now.After(pt.TimeoutAt) {
				pt.Status = "expired"
				atomic.AddInt64(&m.expired, 1)
			}
		}
		m.mu.Unlock()
	}
}
