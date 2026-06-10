-- Rollback: 001_create_mojaloop_crossborder_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_mojaloop_crossborder_updated ON mojaloop_crossborder_records;
DROP FUNCTION IF EXISTS update_mojaloop_crossborder_timestamp();
DROP FUNCTION IF EXISTS cleanup_mojaloop_crossborder_idempotency();
DROP POLICY IF EXISTS mojaloop_crossborder_tenant_isolation ON mojaloop_crossborder_records;
DROP TABLE IF EXISTS mojaloop_crossborder_idempotency;
DROP TABLE IF EXISTS mojaloop_crossborder_audit;
DROP TABLE IF EXISTS mojaloop_crossborder_records;
COMMIT;
