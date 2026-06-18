-- Rollback: 001_create_reconciliation_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_reconciliation_engine_updated ON reconciliation_engine_records;
DROP FUNCTION IF EXISTS update_reconciliation_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_reconciliation_engine_idempotency();
DROP POLICY IF EXISTS reconciliation_engine_tenant_isolation ON reconciliation_engine_records;
DROP TABLE IF EXISTS reconciliation_engine_idempotency;
DROP TABLE IF EXISTS reconciliation_engine_audit;
DROP TABLE IF EXISTS reconciliation_engine_records;
COMMIT;
