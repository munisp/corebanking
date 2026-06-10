-- Rollback: 001_create_atm_management_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_atm_management_updated ON atm_management_records;
DROP FUNCTION IF EXISTS update_atm_management_timestamp();
DROP FUNCTION IF EXISTS cleanup_atm_management_idempotency();
DROP POLICY IF EXISTS atm_management_tenant_isolation ON atm_management_records;
DROP TABLE IF EXISTS atm_management_idempotency;
DROP TABLE IF EXISTS atm_management_audit;
DROP TABLE IF EXISTS atm_management_records;
COMMIT;
