-- Rollback: 001_create_platform_security_infra_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_platform_security_infra_updated ON platform_security_infra_records;
DROP FUNCTION IF EXISTS update_platform_security_infra_timestamp();
DROP FUNCTION IF EXISTS cleanup_platform_security_infra_idempotency();
DROP POLICY IF EXISTS platform_security_infra_tenant_isolation ON platform_security_infra_records;
DROP TABLE IF EXISTS platform_security_infra_idempotency;
DROP TABLE IF EXISTS platform_security_infra_audit;
DROP TABLE IF EXISTS platform_security_infra_records;
COMMIT;
