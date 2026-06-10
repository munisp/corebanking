-- Rollback: 001_create_key_rotation_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_key_rotation_engine_updated ON key_rotation_engine_records;
DROP FUNCTION IF EXISTS update_key_rotation_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_key_rotation_engine_idempotency();
DROP POLICY IF EXISTS key_rotation_engine_tenant_isolation ON key_rotation_engine_records;
DROP TABLE IF EXISTS key_rotation_engine_idempotency;
DROP TABLE IF EXISTS key_rotation_engine_audit;
DROP TABLE IF EXISTS key_rotation_engine_records;
COMMIT;
