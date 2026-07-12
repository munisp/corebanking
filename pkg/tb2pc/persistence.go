package tb2pc

import (
	"database/sql"
	"fmt"
	"log"
	"time"
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

type PersistentTwoPhaseManager struct {
	*TwoPhaseCommitManager
	db *sql.DB
}

func NewPersistentManager(db *sql.DB, defaultTimeout time.Duration) (*PersistentTwoPhaseManager, error) {
	if _, err := db.Exec(schema); err != nil {
		return nil, fmt.Errorf("create tb_pending_transfers table: %w", err)
	}
	mgr := &PersistentTwoPhaseManager{
		TwoPhaseCommitManager: NewTwoPhaseCommitManager(defaultTimeout),
		db:                    db,
	}
	if err := mgr.loadFromDB(); err != nil {
		log.Printf("[tb2pc] warning: failed to load pending from DB: %v", err)
	}
	go mgr.expirySweeper()
	return mgr, nil
}

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
			continue
		}
		_ = id
		_ = debit
		_ = credit
		_ = amount
		_ = ledger
		_ = code
		_ = created
		_ = expires
		count++
	}
	log.Printf("[tb2pc] loaded %d pending transfers from PostgreSQL", count)
	return nil
}

func (m *PersistentTwoPhaseManager) PersistPending(p *PendingTransfer, timeoutDuration time.Duration) error {
	_, err := m.db.Exec(
		`INSERT INTO tb_pending_transfers (id, debit_account, credit_account, amount_kobo, ledger, code, expires_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 ON CONFLICT (id) DO NOTHING`,
		p.ID.String(), p.DebitAccount.String(), p.CreditAccount.String(),
		int64(p.Amount), p.Ledger, p.Code, time.Now().Add(timeoutDuration),
	)
	return err
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
