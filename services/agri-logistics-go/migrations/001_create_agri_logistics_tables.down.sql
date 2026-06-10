-- Rollback: 001_create_agri_logistics_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_agri_logistics_updated ON agri_logistics_records;
DROP FUNCTION IF EXISTS update_agri_logistics_timestamp();
DROP FUNCTION IF EXISTS cleanup_agri_logistics_idempotency();
DROP POLICY IF EXISTS agri_logistics_tenant_isolation ON agri_logistics_records;
DROP TABLE IF EXISTS agri_logistics_idempotency;
DROP TABLE IF EXISTS agri_logistics_audit;
DROP TABLE IF EXISTS agri_logistics_records;
COMMIT;
