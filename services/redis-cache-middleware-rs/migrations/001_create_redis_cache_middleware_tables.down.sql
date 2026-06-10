-- Rollback: 001_create_redis_cache_middleware_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_redis_cache_middleware_updated ON redis_cache_middleware_records;
DROP FUNCTION IF EXISTS update_redis_cache_middleware_timestamp();
DROP FUNCTION IF EXISTS cleanup_redis_cache_middleware_idempotency();
DROP POLICY IF EXISTS redis_cache_middleware_tenant_isolation ON redis_cache_middleware_records;
DROP TABLE IF EXISTS redis_cache_middleware_idempotency;
DROP TABLE IF EXISTS redis_cache_middleware_audit;
DROP TABLE IF EXISTS redis_cache_middleware_records;
COMMIT;
