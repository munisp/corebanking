-- Rollback: 001_create_leasing_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_leasing_updated ON leasing_records;
DROP FUNCTION IF EXISTS update_leasing_timestamp();
DROP FUNCTION IF EXISTS cleanup_leasing_idempotency();
DROP POLICY IF EXISTS leasing_tenant_isolation ON leasing_records;
DROP TABLE IF EXISTS leasing_idempotency;
DROP TABLE IF EXISTS leasing_audit;
DROP TABLE IF EXISTS leasing_records;
COMMIT;
