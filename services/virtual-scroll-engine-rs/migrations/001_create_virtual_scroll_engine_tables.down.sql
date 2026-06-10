-- Rollback: 001_create_virtual_scroll_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_virtual_scroll_engine_updated ON virtual_scroll_engine_records;
DROP FUNCTION IF EXISTS update_virtual_scroll_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_virtual_scroll_engine_idempotency();
DROP POLICY IF EXISTS virtual_scroll_engine_tenant_isolation ON virtual_scroll_engine_records;
DROP TABLE IF EXISTS virtual_scroll_engine_idempotency;
DROP TABLE IF EXISTS virtual_scroll_engine_audit;
DROP TABLE IF EXISTS virtual_scroll_engine_records;
COMMIT;
