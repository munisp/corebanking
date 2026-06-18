-- Rollback: 001_create_optimistic_ui_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_optimistic_ui_engine_updated ON optimistic_ui_engine_records;
DROP FUNCTION IF EXISTS update_optimistic_ui_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_optimistic_ui_engine_idempotency();
DROP POLICY IF EXISTS optimistic_ui_engine_tenant_isolation ON optimistic_ui_engine_records;
DROP TABLE IF EXISTS optimistic_ui_engine_idempotency;
DROP TABLE IF EXISTS optimistic_ui_engine_audit;
DROP TABLE IF EXISTS optimistic_ui_engine_records;
COMMIT;
