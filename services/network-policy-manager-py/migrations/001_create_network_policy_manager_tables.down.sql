-- Rollback: 001_create_network_policy_manager_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_network_policy_manager_updated ON network_policy_manager_records;
DROP FUNCTION IF EXISTS update_network_policy_manager_timestamp();
DROP FUNCTION IF EXISTS cleanup_network_policy_manager_idempotency();
DROP POLICY IF EXISTS network_policy_manager_tenant_isolation ON network_policy_manager_records;
DROP TABLE IF EXISTS network_policy_manager_idempotency;
DROP TABLE IF EXISTS network_policy_manager_audit;
DROP TABLE IF EXISTS network_policy_manager_records;
COMMIT;
