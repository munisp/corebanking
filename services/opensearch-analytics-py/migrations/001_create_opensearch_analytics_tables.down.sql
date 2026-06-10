-- Rollback: 001_create_opensearch_analytics_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_opensearch_analytics_updated ON opensearch_analytics_records;
DROP FUNCTION IF EXISTS update_opensearch_analytics_timestamp();
DROP FUNCTION IF EXISTS cleanup_opensearch_analytics_idempotency();
DROP POLICY IF EXISTS opensearch_analytics_tenant_isolation ON opensearch_analytics_records;
DROP TABLE IF EXISTS opensearch_analytics_idempotency;
DROP TABLE IF EXISTS opensearch_analytics_audit;
DROP TABLE IF EXISTS opensearch_analytics_records;
COMMIT;
