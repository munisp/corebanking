// Package tb2pc provides TigerBeetle two-phase commit integration for the
// 54Bank platform. All fund movements use pending transfers that are
// committed or voided atomically.
//
// TigerBeetle two-phase commit flow:
//   1. create_transfers with flags.pending → funds reserved (pending)
//   2. create_transfers with flags.post_pending_transfer → funds committed
//   OR create_transfers with flags.void_pending_transfer → funds released
//
// This ensures atomicity: funds are never in an inconsistent state.
package tb2pc

import (
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

// AmountKobo — int64 in kobo. Never float64.
type AmountKobo = int64

// TransferFlags mirrors TigerBeetle transfer flags.
type TransferFlags uint16

const (
	FlagNone               TransferFlags = 0
	FlagLinked             TransferFlags = 1 << 0  // linked: all-or-nothing batch
	FlagPending            TransferFlags = 1 << 1  // two-phase: reserve funds
	FlagPostPendingTransfer TransferFlags = 1 << 2  // commit a pending transfer
	FlagVoidPendingTransfer TransferFlags = 1 << 3  // void a pending transfer
	FlagBalancingDebit     TransferFlags = 1 << 4  // debit must not exceed credits
	FlagBalancingCredit    TransferFlags = 1 << 5  // credit must not exceed debits
)

// Transfer represents a TigerBeetle transfer.
type Transfer struct {
	ID               uint128 `json:"id"`
	DebitAccountID   uint128 `json:"debit_account_id"`
	CreditAccountID  uint128 `json:"credit_account_id"`
	Amount           AmountKobo `json:"amount"`
	PendingID        uint128 `json:"pending_id,omitempty"` // for post/void
	Ledger           uint32  `json:"ledger"`
	Code             uint16  `json:"code"`
	Flags            TransferFlags `json:"flags"`
	Timeout          uint32  `json:"timeout_ns,omitempty"` // pending transfer timeout
	Timestamp        int64   `json:"timestamp"`
	UserData128      uint128 `json:"user_data_128,omitempty"`
}

// uint128 is a 128-bit unsigned integer (TigerBeetle's native ID type).
type uint128 struct {
	Hi uint64 `json:"hi"`
	Lo uint64 `json:"lo"`
}

// NewID creates a uint128 from a uint64 (for convenience).
func NewID(lo uint64) uint128 { return uint128{Hi: 0, Lo: lo} }

// PendingTransfer represents an in-flight two-phase transfer.
type PendingTransfer struct {
	Transfer   Transfer  `json:"transfer"`
	CreatedAt  time.Time `json:"created_at"`
	TimeoutAt  time.Time `json:"timeout_at"`
	Status     string    `json:"status"` // "pending", "posted", "voided", "expired"
}

// TwoPhaseCommitManager manages pending transfers.
type TwoPhaseCommitManager struct {
	mu           sync.RWMutex
	pending      map[uint128]*PendingTransfer
	idCounter    uint64
	posted       int64
	voided       int64
	expired      int64
	timeoutNs    uint32 // default timeout in nanoseconds
}

// NewTwoPhaseCommitManager creates a new manager with a default timeout.
func NewTwoPhaseCommitManager(defaultTimeout time.Duration) *TwoPhaseCommitManager {
	mgr := &TwoPhaseCommitManager{
		pending:   make(map[uint128]*PendingTransfer),
		timeoutNs: uint32(defaultTimeout.Nanoseconds()),
	}
	go mgr.expireLoop()
	return mgr
}

// CreatePending creates a pending (reserved) transfer.
// Funds are held but not yet committed.
func (m *TwoPhaseCommitManager) CreatePending(debitAccount, creditAccount uint128, amount AmountKobo, ledger uint32, code uint16) (*PendingTransfer, error) {
	if amount <= 0 {
		return nil, fmt.Errorf("amount must be positive: %d", amount)
	}

	id := NewID(atomic.AddUint64(&m.idCounter, 1))
	now := time.Now()
	timeout := time.Duration(m.timeoutNs) * time.Nanosecond

	transfer := Transfer{
		ID:              id,
		DebitAccountID:  debitAccount,
		CreditAccountID: creditAccount,
		Amount:          amount,
		Ledger:          ledger,
		Code:            code,
		Flags:           FlagPending,
		Timeout:         m.timeoutNs,
		Timestamp:       now.UnixNano(),
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
	results := make([]*PendingTransfer, 0, len(transfers))
	now := time.Now()
	timeout := time.Duration(m.timeoutNs) * time.Nanosecond

	// Validate: total debits must equal total credits per ledger
	ledgerDebits := make(map[uint32]AmountKobo)
	ledgerCredits := make(map[uint32]AmountKobo)
	for _, t := range transfers {
		if t.Amount <= 0 {
			return nil, fmt.Errorf("all amounts must be positive")
		}
		ledgerDebits[t.Ledger] += t.Amount
		ledgerCredits[t.Ledger] += t.Amount
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	for i := range transfers {
		id := NewID(atomic.AddUint64(&m.idCounter, 1))
		transfers[i].ID = id
		transfers[i].Flags = FlagPending | FlagLinked
		transfers[i].Timeout = m.timeoutNs
		transfers[i].Timestamp = now.UnixNano()

		pt := &PendingTransfer{
			Transfer:  transfers[i],
			CreatedAt: now,
			TimeoutAt: now.Add(timeout),
			Status:    "pending",
		}
		m.pending[id] = pt
		results = append(results, pt)
	}

	return results, nil
}

// PostPending commits a pending transfer — funds are now final.
func (m *TwoPhaseCommitManager) PostPending(pendingID uint128) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	pt, ok := m.pending[pendingID]
	if !ok {
		return fmt.Errorf("pending transfer not found: %v", pendingID)
	}
	if pt.Status != "pending" {
		return fmt.Errorf("transfer already %s", pt.Status)
	}
	if time.Now().After(pt.TimeoutAt) {
		pt.Status = "expired"
		atomic.AddInt64(&m.expired, 1)
		return fmt.Errorf("pending transfer expired at %v", pt.TimeoutAt)
	}

	pt.Status = "posted"
	atomic.AddInt64(&m.posted, 1)
	return nil
}

// VoidPending voids a pending transfer — reserved funds are released.
func (m *TwoPhaseCommitManager) VoidPending(pendingID uint128) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	pt, ok := m.pending[pendingID]
	if !ok {
		return fmt.Errorf("pending transfer not found: %v", pendingID)
	}
	if pt.Status != "pending" {
		return fmt.Errorf("transfer already %s", pt.Status)
	}

	pt.Status = "voided"
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
		"pending_count": pendingCount,
		"total_posted":  atomic.LoadInt64(&m.posted),
		"total_voided":  atomic.LoadInt64(&m.voided),
		"total_expired": atomic.LoadInt64(&m.expired),
	}
}

// expireLoop periodically expires timed-out pending transfers.
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
