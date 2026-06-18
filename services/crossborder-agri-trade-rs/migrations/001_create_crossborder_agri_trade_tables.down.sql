-- Rollback: 001_create_crossborder_agri_trade_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_crossborder_agri_trade_updated ON crossborder_agri_trade_records;
DROP FUNCTION IF EXISTS update_crossborder_agri_trade_timestamp();
DROP FUNCTION IF EXISTS cleanup_crossborder_agri_trade_idempotency();
DROP POLICY IF EXISTS crossborder_agri_trade_tenant_isolation ON crossborder_agri_trade_records;
DROP TABLE IF EXISTS crossborder_agri_trade_idempotency;
DROP TABLE IF EXISTS crossborder_agri_trade_audit;
DROP TABLE IF EXISTS crossborder_agri_trade_records;
COMMIT;
