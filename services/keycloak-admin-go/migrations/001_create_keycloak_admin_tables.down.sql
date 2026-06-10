-- Rollback: 001_create_keycloak_admin_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_keycloak_admin_updated ON keycloak_admin_records;
DROP FUNCTION IF EXISTS update_keycloak_admin_timestamp();
DROP FUNCTION IF EXISTS cleanup_keycloak_admin_idempotency();
DROP POLICY IF EXISTS keycloak_admin_tenant_isolation ON keycloak_admin_records;
DROP TABLE IF EXISTS keycloak_admin_idempotency;
DROP TABLE IF EXISTS keycloak_admin_audit;
DROP TABLE IF EXISTS keycloak_admin_records;
COMMIT;
