-- Rollback: 001_create_interactive_ussd_agri_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_interactive_ussd_agri_updated ON interactive_ussd_agri_records;
DROP FUNCTION IF EXISTS update_interactive_ussd_agri_timestamp();
DROP FUNCTION IF EXISTS cleanup_interactive_ussd_agri_idempotency();
DROP POLICY IF EXISTS interactive_ussd_agri_tenant_isolation ON interactive_ussd_agri_records;
DROP TABLE IF EXISTS interactive_ussd_agri_idempotency;
DROP TABLE IF EXISTS interactive_ussd_agri_audit;
DROP TABLE IF EXISTS interactive_ussd_agri_records;
COMMIT;
