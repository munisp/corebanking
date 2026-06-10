-- Rollback: 001_create_cheque_clearing_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_cheque_clearing_updated ON cheque_clearing_records;
DROP FUNCTION IF EXISTS update_cheque_clearing_timestamp();
DROP FUNCTION IF EXISTS cleanup_cheque_clearing_idempotency();
DROP POLICY IF EXISTS cheque_clearing_tenant_isolation ON cheque_clearing_records;
DROP TABLE IF EXISTS cheque_clearing_idempotency;
DROP TABLE IF EXISTS cheque_clearing_audit;
DROP TABLE IF EXISTS cheque_clearing_records;
COMMIT;
