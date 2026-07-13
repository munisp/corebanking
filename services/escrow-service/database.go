package main

import (
	"context"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

// createTables creates the escrow_contracts table if it does not exist
func createTables(db *pgxpool.Pool) error {
	tableStmt := `
CREATE TABLE IF NOT EXISTS escrow_contracts (
	id UUID PRIMARY KEY,
	contract_number VARCHAR(100) NOT NULL,
	tenant_id VARCHAR(100) NOT NULL,
	use_case VARCHAR(50) NOT NULL,
	title VARCHAR(255) NOT NULL,
	description TEXT,
	total_amount NUMERIC(20,2) NOT NULL,
	currency VARCHAR(10) NOT NULL,
	parties JSONB,
	funding_deadline TIMESTAMP,
	fulfillment_deadline TIMESTAMP,
	dispute_window_days INT,
	auto_release_after_days INT,
	status VARCHAR(50),
	tigerbeetle_account_id VARCHAR(100),
	metadata JSONB,
	fee_type VARCHAR(50),
	fee_rate NUMERIC(10,4),
	fee_amount NUMERIC(20,2),
	fee_payer VARCHAR(100),
	template_id VARCHAR(100),
	funded_at TIMESTAMP,
	completed_at TIMESTAMP,
	created_by VARCHAR(100),
	created_at TIMESTAMP DEFAULT NOW(),
	updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_escrow_tenant ON escrow_contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_escrow_status ON escrow_contracts(status);
CREATE INDEX IF NOT EXISTS idx_escrow_created ON escrow_contracts(created_at);

CREATE TABLE IF NOT EXISTS escrow_milestones (
	id UUID PRIMARY KEY,
	contract_id UUID NOT NULL REFERENCES escrow_contracts(id) ON DELETE CASCADE,
	sequence_number INT NOT NULL,
	name VARCHAR(255) NOT NULL,
	description TEXT,
	amount NUMERIC(20,2) NOT NULL,
	percentage NUMERIC(5,2),
	deadline TIMESTAMP,
	status VARCHAR(50),
	funded_at TIMESTAMP,
	completed_at TIMESTAMP,
	released_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_milestone_contract ON escrow_milestones(contract_id);

CREATE TABLE IF NOT EXISTS escrow_transactions (
	id UUID PRIMARY KEY,
	contract_id UUID NOT NULL REFERENCES escrow_contracts(id) ON DELETE CASCADE,
	milestone_id UUID,
	transaction_type VARCHAR(50) NOT NULL,
	amount NUMERIC(20,2) NOT NULL,
	currency VARCHAR(10) NOT NULL,
	from_party_id VARCHAR(100),
	to_party_id VARCHAR(100),
	tigerbeetle_transfer_id VARCHAR(100),
	reference VARCHAR(100),
	external_reference VARCHAR(100),
	status VARCHAR(50),
	metadata JSONB,
	created_at TIMESTAMP DEFAULT NOW(),
	completed_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_txn_contract ON escrow_transactions(contract_id);
CREATE INDEX IF NOT EXISTS idx_txn_milestone ON escrow_transactions(milestone_id);
`
	_, err := db.Exec(context.Background(), tableStmt)
	if err != nil {
		log.Printf("Error creating escrow_contracts table: %v", err)
		return err
	}
	log.Println("escrow_contracts table created/verified")
	return nil
}
