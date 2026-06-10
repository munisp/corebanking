-- Rollback: 001_create_mojaloop_pisp_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_mojaloop_pisp_updated ON mojaloop_pisp_records;
DROP FUNCTION IF EXISTS update_mojaloop_pisp_timestamp();
DROP FUNCTION IF EXISTS cleanup_mojaloop_pisp_idempotency();
DROP POLICY IF EXISTS mojaloop_pisp_tenant_isolation ON mojaloop_pisp_records;
DROP TABLE IF EXISTS mojaloop_pisp_idempotency;
DROP TABLE IF EXISTS mojaloop_pisp_audit;
DROP TABLE IF EXISTS mojaloop_pisp_records;
COMMIT;
