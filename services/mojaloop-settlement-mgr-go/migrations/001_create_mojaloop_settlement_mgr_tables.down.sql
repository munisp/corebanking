-- Rollback: 001_create_mojaloop_settlement_mgr_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_mojaloop_settlement_mgr_updated ON mojaloop_settlement_mgr_records;
DROP FUNCTION IF EXISTS update_mojaloop_settlement_mgr_timestamp();
DROP FUNCTION IF EXISTS cleanup_mojaloop_settlement_mgr_idempotency();
DROP POLICY IF EXISTS mojaloop_settlement_mgr_tenant_isolation ON mojaloop_settlement_mgr_records;
DROP TABLE IF EXISTS mojaloop_settlement_mgr_idempotency;
DROP TABLE IF EXISTS mojaloop_settlement_mgr_audit;
DROP TABLE IF EXISTS mojaloop_settlement_mgr_records;
COMMIT;
