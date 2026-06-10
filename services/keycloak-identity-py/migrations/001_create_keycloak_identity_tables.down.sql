-- Rollback: 001_create_keycloak_identity_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_keycloak_identity_updated ON keycloak_identity_records;
DROP FUNCTION IF EXISTS update_keycloak_identity_timestamp();
DROP FUNCTION IF EXISTS cleanup_keycloak_identity_idempotency();
DROP POLICY IF EXISTS keycloak_identity_tenant_isolation ON keycloak_identity_records;
DROP TABLE IF EXISTS keycloak_identity_idempotency;
DROP TABLE IF EXISTS keycloak_identity_audit;
DROP TABLE IF EXISTS keycloak_identity_records;
COMMIT;
