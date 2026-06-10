-- Rollback: 001_create_soil_analysis_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_soil_analysis_updated ON soil_analysis_records;
DROP FUNCTION IF EXISTS update_soil_analysis_timestamp();
DROP FUNCTION IF EXISTS cleanup_soil_analysis_idempotency();
DROP POLICY IF EXISTS soil_analysis_tenant_isolation ON soil_analysis_records;
DROP TABLE IF EXISTS soil_analysis_idempotency;
DROP TABLE IF EXISTS soil_analysis_audit;
DROP TABLE IF EXISTS soil_analysis_records;
COMMIT;
