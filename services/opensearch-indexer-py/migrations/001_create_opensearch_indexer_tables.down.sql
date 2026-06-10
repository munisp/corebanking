-- Rollback: 001_create_opensearch_indexer_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_opensearch_indexer_updated ON opensearch_indexer_records;
DROP FUNCTION IF EXISTS update_opensearch_indexer_timestamp();
DROP FUNCTION IF EXISTS cleanup_opensearch_indexer_idempotency();
DROP POLICY IF EXISTS opensearch_indexer_tenant_isolation ON opensearch_indexer_records;
DROP TABLE IF EXISTS opensearch_indexer_idempotency;
DROP TABLE IF EXISTS opensearch_indexer_audit;
DROP TABLE IF EXISTS opensearch_indexer_records;
COMMIT;
