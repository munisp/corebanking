-- Rollback: 001_create_permify_authz_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_permify_authz_updated ON permify_authz_records;
DROP FUNCTION IF EXISTS update_permify_authz_timestamp();
DROP FUNCTION IF EXISTS cleanup_permify_authz_idempotency();
DROP POLICY IF EXISTS permify_authz_tenant_isolation ON permify_authz_records;
DROP TABLE IF EXISTS permify_authz_idempotency;
DROP TABLE IF EXISTS permify_authz_audit;
DROP TABLE IF EXISTS permify_authz_records;
COMMIT;
