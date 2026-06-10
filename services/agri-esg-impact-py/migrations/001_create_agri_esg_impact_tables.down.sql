-- Rollback: 001_create_agri_esg_impact_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_agri_esg_impact_updated ON agri_esg_impact_records;
DROP FUNCTION IF EXISTS update_agri_esg_impact_timestamp();
DROP FUNCTION IF EXISTS cleanup_agri_esg_impact_idempotency();
DROP POLICY IF EXISTS agri_esg_impact_tenant_isolation ON agri_esg_impact_records;
DROP TABLE IF EXISTS agri_esg_impact_idempotency;
DROP TABLE IF EXISTS agri_esg_impact_audit;
DROP TABLE IF EXISTS agri_esg_impact_records;
COMMIT;
