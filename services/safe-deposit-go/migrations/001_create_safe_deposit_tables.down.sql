-- Rollback: 001_create_safe_deposit_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_safe_deposit_updated ON safe_deposit_records;
DROP FUNCTION IF EXISTS update_safe_deposit_timestamp();
DROP FUNCTION IF EXISTS cleanup_safe_deposit_idempotency();
DROP POLICY IF EXISTS safe_deposit_tenant_isolation ON safe_deposit_records;
DROP TABLE IF EXISTS safe_deposit_idempotency;
DROP TABLE IF EXISTS safe_deposit_audit;
DROP TABLE IF EXISTS safe_deposit_records;
COMMIT;
