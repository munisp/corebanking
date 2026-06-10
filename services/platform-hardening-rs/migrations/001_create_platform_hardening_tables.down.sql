-- Rollback: 001_create_platform_hardening_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_platform_hardening_updated ON platform_hardening_records;
DROP FUNCTION IF EXISTS update_platform_hardening_timestamp();
DROP FUNCTION IF EXISTS cleanup_platform_hardening_idempotency();
DROP POLICY IF EXISTS platform_hardening_tenant_isolation ON platform_hardening_records;
DROP TABLE IF EXISTS platform_hardening_idempotency;
DROP TABLE IF EXISTS platform_hardening_audit;
DROP TABLE IF EXISTS platform_hardening_records;
COMMIT;
