-- Rollback: 001_create_quality_certification_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_quality_certification_updated ON quality_certification_records;
DROP FUNCTION IF EXISTS update_quality_certification_timestamp();
DROP FUNCTION IF EXISTS cleanup_quality_certification_idempotency();
DROP POLICY IF EXISTS quality_certification_tenant_isolation ON quality_certification_records;
DROP TABLE IF EXISTS quality_certification_idempotency;
DROP TABLE IF EXISTS quality_certification_audit;
DROP TABLE IF EXISTS quality_certification_records;
COMMIT;
