-- Rollback: 001_create_api_key_enforcer_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_api_key_enforcer_updated ON api_key_enforcer_records;
DROP FUNCTION IF EXISTS update_api_key_enforcer_timestamp();
DROP FUNCTION IF EXISTS cleanup_api_key_enforcer_idempotency();
DROP POLICY IF EXISTS api_key_enforcer_tenant_isolation ON api_key_enforcer_records;
DROP TABLE IF EXISTS api_key_enforcer_idempotency;
DROP TABLE IF EXISTS api_key_enforcer_audit;
DROP TABLE IF EXISTS api_key_enforcer_records;
COMMIT;
