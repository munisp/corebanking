-- Rollback: 001_create_agri_evoucher_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_agri_evoucher_updated ON agri_evoucher_records;
DROP FUNCTION IF EXISTS update_agri_evoucher_timestamp();
DROP FUNCTION IF EXISTS cleanup_agri_evoucher_idempotency();
DROP POLICY IF EXISTS agri_evoucher_tenant_isolation ON agri_evoucher_records;
DROP TABLE IF EXISTS agri_evoucher_idempotency;
DROP TABLE IF EXISTS agri_evoucher_audit;
DROP TABLE IF EXISTS agri_evoucher_records;
COMMIT;
