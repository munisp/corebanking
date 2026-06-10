-- Rollback: 001_create_cocoindex_pipeline_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_cocoindex_pipeline_updated ON cocoindex_pipeline_records;
DROP FUNCTION IF EXISTS update_cocoindex_pipeline_timestamp();
DROP FUNCTION IF EXISTS cleanup_cocoindex_pipeline_idempotency();
DROP POLICY IF EXISTS cocoindex_pipeline_tenant_isolation ON cocoindex_pipeline_records;
DROP TABLE IF EXISTS cocoindex_pipeline_idempotency;
DROP TABLE IF EXISTS cocoindex_pipeline_audit;
DROP TABLE IF EXISTS cocoindex_pipeline_records;
COMMIT;
