-- Rollback: 001_create_secrets_rotation_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_secrets_rotation_updated ON secrets_rotation_records;
DROP FUNCTION IF EXISTS update_secrets_rotation_timestamp();
DROP FUNCTION IF EXISTS cleanup_secrets_rotation_idempotency();
DROP POLICY IF EXISTS secrets_rotation_tenant_isolation ON secrets_rotation_records;
DROP TABLE IF EXISTS secrets_rotation_idempotency;
DROP TABLE IF EXISTS secrets_rotation_audit;
DROP TABLE IF EXISTS secrets_rotation_records;
COMMIT;
