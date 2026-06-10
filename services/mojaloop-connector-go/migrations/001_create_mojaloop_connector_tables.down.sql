-- Rollback: 001_create_mojaloop_connector_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_mojaloop_connector_updated ON mojaloop_connector_records;
DROP FUNCTION IF EXISTS update_mojaloop_connector_timestamp();
DROP FUNCTION IF EXISTS cleanup_mojaloop_connector_idempotency();
DROP POLICY IF EXISTS mojaloop_connector_tenant_isolation ON mojaloop_connector_records;
DROP TABLE IF EXISTS mojaloop_connector_idempotency;
DROP TABLE IF EXISTS mojaloop_connector_audit;
DROP TABLE IF EXISTS mojaloop_connector_records;
COMMIT;
