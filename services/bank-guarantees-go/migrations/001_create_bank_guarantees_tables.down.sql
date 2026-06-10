-- Rollback: 001_create_bank_guarantees_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_bank_guarantees_updated ON bank_guarantees_records;
DROP FUNCTION IF EXISTS update_bank_guarantees_timestamp();
DROP FUNCTION IF EXISTS cleanup_bank_guarantees_idempotency();
DROP POLICY IF EXISTS bank_guarantees_tenant_isolation ON bank_guarantees_records;
DROP TABLE IF EXISTS bank_guarantees_idempotency;
DROP TABLE IF EXISTS bank_guarantees_audit;
DROP TABLE IF EXISTS bank_guarantees_records;
COMMIT;
