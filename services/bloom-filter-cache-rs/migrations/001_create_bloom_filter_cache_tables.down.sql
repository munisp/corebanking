-- Rollback: 001_create_bloom_filter_cache_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_bloom_filter_cache_updated ON bloom_filter_cache_records;
DROP FUNCTION IF EXISTS update_bloom_filter_cache_timestamp();
DROP FUNCTION IF EXISTS cleanup_bloom_filter_cache_idempotency();
DROP POLICY IF EXISTS bloom_filter_cache_tenant_isolation ON bloom_filter_cache_records;
DROP TABLE IF EXISTS bloom_filter_cache_idempotency;
DROP TABLE IF EXISTS bloom_filter_cache_audit;
DROP TABLE IF EXISTS bloom_filter_cache_records;
COMMIT;
