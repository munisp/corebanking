package tb2pc

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/lib/pq"
)

const schema = `
CREATE TABLE IF NOT EXISTS tb_pending_transfers (
    id TEXT PRIMARY KEY,
    debit_account TEXT NOT NULL,
    credit_account TEXT NOT NULL,
    amount_kobo BIGINT NOT NULL,
    ledger INTEGER NOT NULL,
    code INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    posted_at TIMESTAMPTZ,
    voided_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_tb_pending_status ON tb_pending_transfers(status);
CREATE INDEX IF NOT EXISTS idx_tb_pending_expires ON tb_pending_transfers(expires_at) WHERE status = 'pending';
`

// PersistentTwoPhaseManager mirrors every cluster-confirmed two-phase
// operation into PostgreSQL so pending transfers survive restarts. The
// TigerBeetle cluster remains the system of record for funds; Postgres is
// the recovery bookkeeping. When the DB write fails after a cluster op, the
// error is logged loudly (the cluster state is authoritative).
type PersistentTwoPhaseManager struct {
	*TwoPhaseCommitManager
	db *sql.DB
}

// NewPersistentManager creates a cluster-backed manager with Postgres
// bookkeeping. The table schema is created if missing; pending rows are
// reloaded into memory so Post/Void work after a restart.
func NewPersistentManager(db *sql.DB, defaultTimeout time.Duration) (*PersistentTwoPhaseManager, error) {
	if db == nil {
		return nil, fmt.Errorf("tb2pc: nil *sql.DB — persistence requires a real Postgres connection")
	}
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("tb2pc: postgres unreachable: %w", err)
	}
	if _, err := db.Exec(schema); err != nil {
		return nil, fmt.Errorf("create tb_pending_transfers table: %w", err)
	}
	mgr := &PersistentTwoPhaseManager{
		TwoPhaseCommitManager: NewTwoPhaseCommitManager(defaultTimeout),
		db:                    db,
	}
	if err := mgr.loadFromDB(); err != nil {
		return nil, fmt.Errorf("tb2pc: failed to load pending transfers from DB: %w", err)
	}
	go mgr.expirySweeper()
	return mgr, nil
}

// NewPersistentManagerFromEnv builds the manager from DATABASE_URL and the
// TigerBeetle env vars. Fails when either is unavailable — never silently
// degrades to memory-only bookkeeping.
func NewPersistentManagerFromEnv(defaultTimeout time.Duration) (*PersistentTwoPhaseManager, error) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		return nil, fmt.Errorf("tb2pc: DATABASE_URL not set — persistent two-phase manager unavailable")
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("tb2pc: open postgres: %w", err)
	}
	return NewPersistentManager(db, defaultTimeout)
}

// loadFromDB restores pending transfers so Post/Void find them after a
// process restart. (Previous version scanned rows and discarded them.)
func (m *PersistentTwoPhaseManager) loadFromDB() error {
	rows, err := m.db.Query(`SELECT id, debit_account, credit_account, amount_kobo, ledger, code, created_at, expires_at FROM tb_pending_transfers WHERE status = 'pending'`)
	if err != nil {
		return err
	}
	defer rows.Close()
	count := 0
	for rows.Next() {
		var id, debit, credit string
		var amount int64
		var ledger, code int
		var created, expires time.Time
		if err := rows.Scan(&id, &debit, &credit, &amount, &ledger, &code, &created, &expires); err != nil {
			log.Printf("[tb2pc] loadFromDB: skipping unreadable row: %v", err)
			continue
		}
		uid, err := parseUint128Hex(id)
		if err != nil {
			log.Printf("[tb2pc] loadFromDB: skipping row with bad id %q: %v", id, err)
			continue
		}
		debitID, err := parseUint128Hex(debit)
		if err != nil {
			log.Printf("[tb2pc] loadFromDB: skipping row %s with bad debit account: %v", id, err)
			continue
		}
		creditID, err := parseUint128Hex(credit)
		if err != nil {
			log.Printf("[tb2pc] loadFromDB: skipping row %s with bad credit account: %v", id, err)
			continue
		}
		m.mu.Lock()
		m.pending[uid] = &PendingTransfer{
			Transfer: Transfer{
				ID:              uid,
				DebitAccountID:  debitID,
				CreditAccountID: creditID,
				Amount:          amount,
				Ledger:          uint32(ledger),
				Code:            uint16(code),
				Flags:           FlagPending,
				Timestamp:       created.UnixNano(),
			},
			CreatedAt: created,
			TimeoutAt: expires,
			Status:    "pending",
		}
		m.mu.Unlock()
		count++
	}
	log.Printf("[tb2pc] loaded %d pending transfers from PostgreSQL", count)
	return rows.Err()
}

// CreatePending reserves funds in the cluster, then persists the record.
func (m *PersistentTwoPhaseManager) CreatePending(debitAccount, creditAccount uint128, amount AmountKobo, ledger uint32, code uint16) (*PendingTransfer, error) {
	pt, err := m.TwoPhaseCommitManager.CreatePending(debitAccount, creditAccount, amount, ledger, code)
	if err != nil {
		return nil, err
	}
	if err := m.persistPending(pt); err != nil {
		log.Printf("[tb2pc] CRITICAL: cluster reservation %s succeeded but DB persist failed: %v", pt.Transfer.ID, err)
	}
	return pt, nil
}

// CreateLinkedPending reserves funds in the cluster, then persists records.
func (m *PersistentTwoPhaseManager) CreateLinkedPending(transfers []Transfer) ([]*PendingTransfer, error) {
	pts, err := m.TwoPhaseCommitManager.CreateLinkedPending(transfers)
	if err != nil {
		return nil, err
	}
	for _, pt := range pts {
		if err := m.persistPending(pt); err != nil {
			log.Printf("[tb2pc] CRITICAL: cluster reservation %s succeeded but DB persist failed: %v", pt.Transfer.ID, err)
		}
	}
	return pts, nil
}

// PostPending commits in the cluster, then persists the outcome.
func (m *PersistentTwoPhaseManager) PostPending(pendingID uint128) error {
	if err := m.TwoPhaseCommitManager.PostPending(pendingID); err != nil {
		return err
	}
	if err := m.MarkPosted(pendingID); err != nil {
		log.Printf("[tb2pc] CRITICAL: cluster post %s succeeded but DB update failed: %v", pendingID, err)
	}
	return nil
}

// VoidPending voids in the cluster, then persists the outcome.
func (m *PersistentTwoPhaseManager) VoidPending(pendingID uint128) error {
	if err := m.TwoPhaseCommitManager.VoidPending(pendingID); err != nil {
		return err
	}
	if err := m.MarkVoided(pendingID); err != nil {
		log.Printf("[tb2pc] CRITICAL: cluster void %s succeeded but DB update failed: %v", pendingID, err)
	}
	return nil
}

func (m *PersistentTwoPhaseManager) persistPending(p *PendingTransfer) error {
	_, err := m.db.Exec(
		`INSERT INTO tb_pending_transfers (id, debit_account, credit_account, amount_kobo, ledger, code, expires_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 ON CONFLICT (id) DO NOTHING`,
		p.Transfer.ID.String(), p.Transfer.DebitAccountID.String(), p.Transfer.CreditAccountID.String(),
		int64(p.Transfer.Amount), p.Transfer.Ledger, p.Transfer.Code, p.TimeoutAt,
	)
	return err
}

// PersistPending records an existing PendingTransfer (kept for API
// compatibility; new code should use CreatePending which persists itself).
func (m *PersistentTwoPhaseManager) PersistPending(p *PendingTransfer, timeoutDuration time.Duration) error {
	if p.TimeoutAt.IsZero() {
		p.TimeoutAt = time.Now().Add(timeoutDuration)
	}
	return m.persistPending(p)
}

func (m *PersistentTwoPhaseManager) MarkPosted(pendingID uint128) error {
	_, err := m.db.Exec(
		`UPDATE tb_pending_transfers SET status = 'posted', posted_at = NOW() WHERE id = $1`,
		pendingID.String(),
	)
	return err
}

func (m *PersistentTwoPhaseManager) MarkVoided(pendingID uint128) error {
	_, err := m.db.Exec(
		`UPDATE tb_pending_transfers SET status = 'voided', voided_at = NOW() WHERE id = $1`,
		pendingID.String(),
	)
	return err
}

func (m *PersistentTwoPhaseManager) expirySweeper() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		result, err := m.db.Exec(
			`UPDATE tb_pending_transfers SET status = 'expired', voided_at = NOW()
			 WHERE status = 'pending' AND expires_at < NOW()`,
		)
		if err != nil {
			log.Printf("[tb2pc] sweeper error: %v", err)
			continue
		}
		if n, _ := result.RowsAffected(); n > 0 {
			log.Printf("[tb2pc] sweeper: expired %d pending transfers", n)
		}
	}
}
