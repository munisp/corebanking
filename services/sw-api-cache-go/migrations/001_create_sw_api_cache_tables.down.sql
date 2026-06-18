-- Rollback: 001_create_sw_api_cache_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_sw_api_cache_updated ON sw_api_cache_records;
DROP FUNCTION IF EXISTS update_sw_api_cache_timestamp();
DROP FUNCTION IF EXISTS cleanup_sw_api_cache_idempotency();
DROP POLICY IF EXISTS sw_api_cache_tenant_isolation ON sw_api_cache_records;
DROP TABLE IF EXISTS sw_api_cache_idempotency;
DROP TABLE IF EXISTS sw_api_cache_audit;
DROP TABLE IF EXISTS sw_api_cache_records;
COMMIT;
