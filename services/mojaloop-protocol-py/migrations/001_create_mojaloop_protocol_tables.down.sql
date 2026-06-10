-- Rollback: 001_create_mojaloop_protocol_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_mojaloop_protocol_updated ON mojaloop_protocol_records;
DROP FUNCTION IF EXISTS update_mojaloop_protocol_timestamp();
DROP FUNCTION IF EXISTS cleanup_mojaloop_protocol_idempotency();
DROP POLICY IF EXISTS mojaloop_protocol_tenant_isolation ON mojaloop_protocol_records;
DROP TABLE IF EXISTS mojaloop_protocol_idempotency;
DROP TABLE IF EXISTS mojaloop_protocol_audit;
DROP TABLE IF EXISTS mojaloop_protocol_records;
COMMIT;
