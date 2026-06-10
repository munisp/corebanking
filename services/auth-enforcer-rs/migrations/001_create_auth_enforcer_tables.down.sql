-- Rollback: 001_create_auth_enforcer_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_auth_enforcer_updated ON auth_enforcer_records;
DROP FUNCTION IF EXISTS update_auth_enforcer_timestamp();
DROP FUNCTION IF EXISTS cleanup_auth_enforcer_idempotency();
DROP POLICY IF EXISTS auth_enforcer_tenant_isolation ON auth_enforcer_records;
DROP TABLE IF EXISTS auth_enforcer_idempotency;
DROP TABLE IF EXISTS auth_enforcer_audit;
DROP TABLE IF EXISTS auth_enforcer_records;
COMMIT;
