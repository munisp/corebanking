-- Rollback: 001_create_wealth_mgmt_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_wealth_mgmt_updated ON wealth_mgmt_records;
DROP FUNCTION IF EXISTS update_wealth_mgmt_timestamp();
DROP FUNCTION IF EXISTS cleanup_wealth_mgmt_idempotency();
DROP POLICY IF EXISTS wealth_mgmt_tenant_isolation ON wealth_mgmt_records;
DROP TABLE IF EXISTS wealth_mgmt_idempotency;
DROP TABLE IF EXISTS wealth_mgmt_audit;
DROP TABLE IF EXISTS wealth_mgmt_records;
COMMIT;
