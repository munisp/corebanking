-- Rollback: 001_create_body_limit_enforcer_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_body_limit_enforcer_updated ON body_limit_enforcer_records;
DROP FUNCTION IF EXISTS update_body_limit_enforcer_timestamp();
DROP FUNCTION IF EXISTS cleanup_body_limit_enforcer_idempotency();
DROP POLICY IF EXISTS body_limit_enforcer_tenant_isolation ON body_limit_enforcer_records;
DROP TABLE IF EXISTS body_limit_enforcer_idempotency;
DROP TABLE IF EXISTS body_limit_enforcer_audit;
DROP TABLE IF EXISTS body_limit_enforcer_records;
COMMIT;
