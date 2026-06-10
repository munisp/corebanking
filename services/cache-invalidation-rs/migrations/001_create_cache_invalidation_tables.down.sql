-- Rollback: 001_create_cache_invalidation_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_cache_invalidation_updated ON cache_invalidation_records;
DROP FUNCTION IF EXISTS update_cache_invalidation_timestamp();
DROP FUNCTION IF EXISTS cleanup_cache_invalidation_idempotency();
DROP POLICY IF EXISTS cache_invalidation_tenant_isolation ON cache_invalidation_records;
DROP TABLE IF EXISTS cache_invalidation_idempotency;
DROP TABLE IF EXISTS cache_invalidation_audit;
DROP TABLE IF EXISTS cache_invalidation_records;
COMMIT;
