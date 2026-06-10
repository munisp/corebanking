-- Rollback: 001_create_white_label_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_white_label_engine_updated ON white_label_engine_records;
DROP FUNCTION IF EXISTS update_white_label_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_white_label_engine_idempotency();
DROP POLICY IF EXISTS white_label_engine_tenant_isolation ON white_label_engine_records;
DROP TABLE IF EXISTS white_label_engine_idempotency;
DROP TABLE IF EXISTS white_label_engine_audit;
DROP TABLE IF EXISTS white_label_engine_records;
COMMIT;
