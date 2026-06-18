-- Rollback: 001_create_keycloak_enforcer_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_keycloak_enforcer_updated ON keycloak_enforcer_records;
DROP FUNCTION IF EXISTS update_keycloak_enforcer_timestamp();
DROP FUNCTION IF EXISTS cleanup_keycloak_enforcer_idempotency();
DROP POLICY IF EXISTS keycloak_enforcer_tenant_isolation ON keycloak_enforcer_records;
DROP TABLE IF EXISTS keycloak_enforcer_idempotency;
DROP TABLE IF EXISTS keycloak_enforcer_audit;
DROP TABLE IF EXISTS keycloak_enforcer_records;
COMMIT;
