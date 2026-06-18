-- Rollback: 001_create_redis_cache_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_redis_cache_updated ON redis_cache_records;
DROP FUNCTION IF EXISTS update_redis_cache_timestamp();
DROP FUNCTION IF EXISTS cleanup_redis_cache_idempotency();
DROP POLICY IF EXISTS redis_cache_tenant_isolation ON redis_cache_records;
DROP TABLE IF EXISTS redis_cache_idempotency;
DROP TABLE IF EXISTS redis_cache_audit;
DROP TABLE IF EXISTS redis_cache_records;
COMMIT;
