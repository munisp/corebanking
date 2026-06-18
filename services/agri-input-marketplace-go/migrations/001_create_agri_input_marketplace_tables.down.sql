-- Rollback: 001_create_agri_input_marketplace_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_agri_input_marketplace_updated ON agri_input_marketplace_records;
DROP FUNCTION IF EXISTS update_agri_input_marketplace_timestamp();
DROP FUNCTION IF EXISTS cleanup_agri_input_marketplace_idempotency();
DROP POLICY IF EXISTS agri_input_marketplace_tenant_isolation ON agri_input_marketplace_records;
DROP TABLE IF EXISTS agri_input_marketplace_idempotency;
DROP TABLE IF EXISTS agri_input_marketplace_audit;
DROP TABLE IF EXISTS agri_input_marketplace_records;
COMMIT;
