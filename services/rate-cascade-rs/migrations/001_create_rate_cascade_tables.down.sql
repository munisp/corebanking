-- Rollback: 001_create_rate_cascade_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_rate_cascade_updated ON rate_cascade_records;
DROP FUNCTION IF EXISTS update_rate_cascade_timestamp();
DROP FUNCTION IF EXISTS cleanup_rate_cascade_idempotency();
DROP POLICY IF EXISTS rate_cascade_tenant_isolation ON rate_cascade_records;
DROP TABLE IF EXISTS rate_cascade_idempotency;
DROP TABLE IF EXISTS rate_cascade_audit;
DROP TABLE IF EXISTS rate_cascade_records;
COMMIT;
