-- Rollback: 001_create_mojaloop_tb_bridge_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_mojaloop_tb_bridge_updated ON mojaloop_tb_bridge_records;
DROP FUNCTION IF EXISTS update_mojaloop_tb_bridge_timestamp();
DROP FUNCTION IF EXISTS cleanup_mojaloop_tb_bridge_idempotency();
DROP POLICY IF EXISTS mojaloop_tb_bridge_tenant_isolation ON mojaloop_tb_bridge_records;
DROP TABLE IF EXISTS mojaloop_tb_bridge_idempotency;
DROP TABLE IF EXISTS mojaloop_tb_bridge_audit;
DROP TABLE IF EXISTS mojaloop_tb_bridge_records;
COMMIT;
