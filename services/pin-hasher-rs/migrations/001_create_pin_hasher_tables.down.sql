-- Rollback: 001_create_pin_hasher_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_pin_hasher_updated ON pin_hasher_records;
DROP FUNCTION IF EXISTS update_pin_hasher_timestamp();
DROP FUNCTION IF EXISTS cleanup_pin_hasher_idempotency();
DROP POLICY IF EXISTS pin_hasher_tenant_isolation ON pin_hasher_records;
DROP TABLE IF EXISTS pin_hasher_idempotency;
DROP TABLE IF EXISTS pin_hasher_audit;
DROP TABLE IF EXISTS pin_hasher_records;
COMMIT;
