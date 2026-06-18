-- Rollback: 001_create_hsm_key_manager_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_hsm_key_manager_updated ON hsm_key_manager_records;
DROP FUNCTION IF EXISTS update_hsm_key_manager_timestamp();
DROP FUNCTION IF EXISTS cleanup_hsm_key_manager_idempotency();
DROP POLICY IF EXISTS hsm_key_manager_tenant_isolation ON hsm_key_manager_records;
DROP TABLE IF EXISTS hsm_key_manager_idempotency;
DROP TABLE IF EXISTS hsm_key_manager_audit;
DROP TABLE IF EXISTS hsm_key_manager_records;
COMMIT;
