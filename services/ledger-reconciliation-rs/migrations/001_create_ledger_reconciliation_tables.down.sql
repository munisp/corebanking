-- Rollback: 001_create_ledger_reconciliation_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_ledger_reconciliation_updated ON ledger_reconciliation_records;
DROP FUNCTION IF EXISTS update_ledger_reconciliation_timestamp();
DROP FUNCTION IF EXISTS cleanup_ledger_reconciliation_idempotency();
DROP POLICY IF EXISTS ledger_reconciliation_tenant_isolation ON ledger_reconciliation_records;
DROP TABLE IF EXISTS ledger_reconciliation_idempotency;
DROP TABLE IF EXISTS ledger_reconciliation_audit;
DROP TABLE IF EXISTS ledger_reconciliation_records;
COMMIT;
