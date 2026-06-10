-- Rollback: 001_create_mojaloop_admin_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_mojaloop_admin_updated ON mojaloop_admin_records;
DROP FUNCTION IF EXISTS update_mojaloop_admin_timestamp();
DROP FUNCTION IF EXISTS cleanup_mojaloop_admin_idempotency();
DROP POLICY IF EXISTS mojaloop_admin_tenant_isolation ON mojaloop_admin_records;
DROP TABLE IF EXISTS mojaloop_admin_idempotency;
DROP TABLE IF EXISTS mojaloop_admin_audit;
DROP TABLE IF EXISTS mojaloop_admin_records;
COMMIT;
