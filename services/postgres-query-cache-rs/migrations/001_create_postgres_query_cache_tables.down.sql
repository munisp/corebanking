-- Rollback: 001_create_postgres_query_cache_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_postgres_query_cache_updated ON postgres_query_cache_records;
DROP FUNCTION IF EXISTS update_postgres_query_cache_timestamp();
DROP FUNCTION IF EXISTS cleanup_postgres_query_cache_idempotency();
DROP POLICY IF EXISTS postgres_query_cache_tenant_isolation ON postgres_query_cache_records;
DROP TABLE IF EXISTS postgres_query_cache_idempotency;
DROP TABLE IF EXISTS postgres_query_cache_audit;
DROP TABLE IF EXISTS postgres_query_cache_records;
COMMIT;
