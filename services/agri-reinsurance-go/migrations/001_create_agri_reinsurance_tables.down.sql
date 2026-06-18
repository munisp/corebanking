-- Rollback: 001_create_agri_reinsurance_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_agri_reinsurance_updated ON agri_reinsurance_records;
DROP FUNCTION IF EXISTS update_agri_reinsurance_timestamp();
DROP FUNCTION IF EXISTS cleanup_agri_reinsurance_idempotency();
DROP POLICY IF EXISTS agri_reinsurance_tenant_isolation ON agri_reinsurance_records;
DROP TABLE IF EXISTS agri_reinsurance_idempotency;
DROP TABLE IF EXISTS agri_reinsurance_audit;
DROP TABLE IF EXISTS agri_reinsurance_records;
COMMIT;
