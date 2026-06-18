-- Rollback: 001_create_gl_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_gl_engine_updated ON gl_engine_records;
DROP FUNCTION IF EXISTS update_gl_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_gl_engine_idempotency();
DROP POLICY IF EXISTS gl_engine_tenant_isolation ON gl_engine_records;
DROP TABLE IF EXISTS gl_engine_idempotency;
DROP TABLE IF EXISTS gl_engine_audit;
DROP TABLE IF EXISTS gl_engine_records;
COMMIT;
