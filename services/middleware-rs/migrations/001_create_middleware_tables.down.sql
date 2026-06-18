-- Rollback: 001_create_middleware_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_middleware_updated ON middleware_records;
DROP FUNCTION IF EXISTS update_middleware_timestamp();
DROP FUNCTION IF EXISTS cleanup_middleware_idempotency();
DROP POLICY IF EXISTS middleware_tenant_isolation ON middleware_records;
DROP TABLE IF EXISTS middleware_idempotency;
DROP TABLE IF EXISTS middleware_audit;
DROP TABLE IF EXISTS middleware_records;
COMMIT;
