-- Rollback: 001_create_hot_data_cache_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_hot_data_cache_updated ON hot_data_cache_records;
DROP FUNCTION IF EXISTS update_hot_data_cache_timestamp();
DROP FUNCTION IF EXISTS cleanup_hot_data_cache_idempotency();
DROP POLICY IF EXISTS hot_data_cache_tenant_isolation ON hot_data_cache_records;
DROP TABLE IF EXISTS hot_data_cache_idempotency;
DROP TABLE IF EXISTS hot_data_cache_audit;
DROP TABLE IF EXISTS hot_data_cache_records;
COMMIT;
