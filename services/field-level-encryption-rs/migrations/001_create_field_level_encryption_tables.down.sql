-- Rollback: 001_create_field_level_encryption_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_field_level_encryption_updated ON field_level_encryption_records;
DROP FUNCTION IF EXISTS update_field_level_encryption_timestamp();
DROP FUNCTION IF EXISTS cleanup_field_level_encryption_idempotency();
DROP POLICY IF EXISTS field_level_encryption_tenant_isolation ON field_level_encryption_records;
DROP TABLE IF EXISTS field_level_encryption_idempotency;
DROP TABLE IF EXISTS field_level_encryption_audit;
DROP TABLE IF EXISTS field_level_encryption_records;
COMMIT;
