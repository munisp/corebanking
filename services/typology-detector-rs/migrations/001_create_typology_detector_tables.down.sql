-- Rollback: 001_create_typology_detector_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_typology_detector_updated ON typology_detector_records;
DROP FUNCTION IF EXISTS update_typology_detector_timestamp();
DROP FUNCTION IF EXISTS cleanup_typology_detector_idempotency();
DROP POLICY IF EXISTS typology_detector_tenant_isolation ON typology_detector_records;
DROP TABLE IF EXISTS typology_detector_idempotency;
DROP TABLE IF EXISTS typology_detector_audit;
DROP TABLE IF EXISTS typology_detector_records;
COMMIT;
