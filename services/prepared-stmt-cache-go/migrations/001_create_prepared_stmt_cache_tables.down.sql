-- Rollback: 001_create_prepared_stmt_cache_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_prepared_stmt_cache_updated ON prepared_stmt_cache_records;
DROP FUNCTION IF EXISTS update_prepared_stmt_cache_timestamp();
DROP FUNCTION IF EXISTS cleanup_prepared_stmt_cache_idempotency();
DROP POLICY IF EXISTS prepared_stmt_cache_tenant_isolation ON prepared_stmt_cache_records;
DROP TABLE IF EXISTS prepared_stmt_cache_idempotency;
DROP TABLE IF EXISTS prepared_stmt_cache_audit;
DROP TABLE IF EXISTS prepared_stmt_cache_records;
COMMIT;
