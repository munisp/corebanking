-- Rollback: 001_create_mojaloop_fspiop_callbacks_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_mojaloop_fspiop_callbacks_updated ON mojaloop_fspiop_callbacks_records;
DROP FUNCTION IF EXISTS update_mojaloop_fspiop_callbacks_timestamp();
DROP FUNCTION IF EXISTS cleanup_mojaloop_fspiop_callbacks_idempotency();
DROP POLICY IF EXISTS mojaloop_fspiop_callbacks_tenant_isolation ON mojaloop_fspiop_callbacks_records;
DROP TABLE IF EXISTS mojaloop_fspiop_callbacks_idempotency;
DROP TABLE IF EXISTS mojaloop_fspiop_callbacks_audit;
DROP TABLE IF EXISTS mojaloop_fspiop_callbacks_records;
COMMIT;
