-- Rollback: 001_create_gl_regulatory_pipeline_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_gl_regulatory_pipeline_updated ON gl_regulatory_pipeline_records;
DROP FUNCTION IF EXISTS update_gl_regulatory_pipeline_timestamp();
DROP FUNCTION IF EXISTS cleanup_gl_regulatory_pipeline_idempotency();
DROP POLICY IF EXISTS gl_regulatory_pipeline_tenant_isolation ON gl_regulatory_pipeline_records;
DROP TABLE IF EXISTS gl_regulatory_pipeline_idempotency;
DROP TABLE IF EXISTS gl_regulatory_pipeline_audit;
DROP TABLE IF EXISTS gl_regulatory_pipeline_records;
COMMIT;
