-- Rollback: 001_create_token_rotation_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_token_rotation_updated ON token_rotation_records;
DROP FUNCTION IF EXISTS update_token_rotation_timestamp();
DROP FUNCTION IF EXISTS cleanup_token_rotation_idempotency();
DROP POLICY IF EXISTS token_rotation_tenant_isolation ON token_rotation_records;
DROP TABLE IF EXISTS token_rotation_idempotency;
DROP TABLE IF EXISTS token_rotation_audit;
DROP TABLE IF EXISTS token_rotation_records;
COMMIT;
