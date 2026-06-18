-- Rollback: 001_create_ussd_sim_toolkit_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_ussd_sim_toolkit_updated ON ussd_sim_toolkit_records;
DROP FUNCTION IF EXISTS update_ussd_sim_toolkit_timestamp();
DROP FUNCTION IF EXISTS cleanup_ussd_sim_toolkit_idempotency();
DROP POLICY IF EXISTS ussd_sim_toolkit_tenant_isolation ON ussd_sim_toolkit_records;
DROP TABLE IF EXISTS ussd_sim_toolkit_idempotency;
DROP TABLE IF EXISTS ussd_sim_toolkit_audit;
DROP TABLE IF EXISTS ussd_sim_toolkit_records;
COMMIT;
