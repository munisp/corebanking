-- Rollback: 001_create_portfolio_mgmt_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_portfolio_mgmt_updated ON portfolio_mgmt_records;
DROP FUNCTION IF EXISTS update_portfolio_mgmt_timestamp();
DROP FUNCTION IF EXISTS cleanup_portfolio_mgmt_idempotency();
DROP POLICY IF EXISTS portfolio_mgmt_tenant_isolation ON portfolio_mgmt_records;
DROP TABLE IF EXISTS portfolio_mgmt_idempotency;
DROP TABLE IF EXISTS portfolio_mgmt_audit;
DROP TABLE IF EXISTS portfolio_mgmt_records;
COMMIT;
