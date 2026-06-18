-- Rollback: 001_create_fatca_crs_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_fatca_crs_updated ON fatca_crs_records;
DROP FUNCTION IF EXISTS update_fatca_crs_timestamp();
DROP FUNCTION IF EXISTS cleanup_fatca_crs_idempotency();
DROP POLICY IF EXISTS fatca_crs_tenant_isolation ON fatca_crs_records;
DROP TABLE IF EXISTS fatca_crs_idempotency;
DROP TABLE IF EXISTS fatca_crs_audit;
DROP TABLE IF EXISTS fatca_crs_records;
COMMIT;
