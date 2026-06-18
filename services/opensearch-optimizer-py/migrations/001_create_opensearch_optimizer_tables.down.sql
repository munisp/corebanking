-- Rollback: 001_create_opensearch_optimizer_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_opensearch_optimizer_updated ON opensearch_optimizer_records;
DROP FUNCTION IF EXISTS update_opensearch_optimizer_timestamp();
DROP FUNCTION IF EXISTS cleanup_opensearch_optimizer_idempotency();
DROP POLICY IF EXISTS opensearch_optimizer_tenant_isolation ON opensearch_optimizer_records;
DROP TABLE IF EXISTS opensearch_optimizer_idempotency;
DROP TABLE IF EXISTS opensearch_optimizer_audit;
DROP TABLE IF EXISTS opensearch_optimizer_records;
COMMIT;
