-- Rollback: 001_create_pin_block_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_pin_block_engine_updated ON pin_block_engine_records;
DROP FUNCTION IF EXISTS update_pin_block_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_pin_block_engine_idempotency();
DROP POLICY IF EXISTS pin_block_engine_tenant_isolation ON pin_block_engine_records;
DROP TABLE IF EXISTS pin_block_engine_idempotency;
DROP TABLE IF EXISTS pin_block_engine_audit;
DROP TABLE IF EXISTS pin_block_engine_records;
COMMIT;
