-- Rollback: 001_create_idempotency_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_idempotency_updated ON idempotency_records;
DROP FUNCTION IF EXISTS update_idempotency_timestamp();
DROP FUNCTION IF EXISTS cleanup_idempotency_idempotency();
DROP POLICY IF EXISTS idempotency_tenant_isolation ON idempotency_records;
DROP TABLE IF EXISTS idempotency_idempotency;
DROP TABLE IF EXISTS idempotency_audit;
DROP TABLE IF EXISTS idempotency_records;
COMMIT;
