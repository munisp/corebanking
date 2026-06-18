-- Rollback: 001_create_api_analytics_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_api_analytics_updated ON api_analytics_records;
DROP FUNCTION IF EXISTS update_api_analytics_timestamp();
DROP FUNCTION IF EXISTS cleanup_api_analytics_idempotency();
DROP POLICY IF EXISTS api_analytics_tenant_isolation ON api_analytics_records;
DROP TABLE IF EXISTS api_analytics_idempotency;
DROP TABLE IF EXISTS api_analytics_audit;
DROP TABLE IF EXISTS api_analytics_records;
COMMIT;
