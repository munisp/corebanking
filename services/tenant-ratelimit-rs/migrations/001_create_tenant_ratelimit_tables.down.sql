-- Rollback: 001_create_tenant_ratelimit_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_tenant_ratelimit_updated ON tenant_ratelimit_records;
DROP FUNCTION IF EXISTS update_tenant_ratelimit_timestamp();
DROP FUNCTION IF EXISTS cleanup_tenant_ratelimit_idempotency();
DROP POLICY IF EXISTS tenant_ratelimit_tenant_isolation ON tenant_ratelimit_records;
DROP TABLE IF EXISTS tenant_ratelimit_idempotency;
DROP TABLE IF EXISTS tenant_ratelimit_audit;
DROP TABLE IF EXISTS tenant_ratelimit_records;
COMMIT;
