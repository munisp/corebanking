-- Rollback: 001_create_pension_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_pension_updated ON pension_records;
DROP FUNCTION IF EXISTS update_pension_timestamp();
DROP FUNCTION IF EXISTS cleanup_pension_idempotency();
DROP POLICY IF EXISTS pension_tenant_isolation ON pension_records;
DROP TABLE IF EXISTS pension_idempotency;
DROP TABLE IF EXISTS pension_audit;
DROP TABLE IF EXISTS pension_records;
COMMIT;
