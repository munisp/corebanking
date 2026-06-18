-- Rollback: 001_create_query_cache_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_query_cache_engine_updated ON query_cache_engine_records;
DROP FUNCTION IF EXISTS update_query_cache_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_query_cache_engine_idempotency();
DROP POLICY IF EXISTS query_cache_engine_tenant_isolation ON query_cache_engine_records;
DROP TABLE IF EXISTS query_cache_engine_idempotency;
DROP TABLE IF EXISTS query_cache_engine_audit;
DROP TABLE IF EXISTS query_cache_engine_records;
COMMIT;
