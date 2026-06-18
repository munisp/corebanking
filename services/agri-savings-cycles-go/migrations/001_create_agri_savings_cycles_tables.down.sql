-- Rollback: 001_create_agri_savings_cycles_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_agri_savings_cycles_updated ON agri_savings_cycles_records;
DROP FUNCTION IF EXISTS update_agri_savings_cycles_timestamp();
DROP FUNCTION IF EXISTS cleanup_agri_savings_cycles_idempotency();
DROP POLICY IF EXISTS agri_savings_cycles_tenant_isolation ON agri_savings_cycles_records;
DROP TABLE IF EXISTS agri_savings_cycles_idempotency;
DROP TABLE IF EXISTS agri_savings_cycles_audit;
DROP TABLE IF EXISTS agri_savings_cycles_records;
COMMIT;
