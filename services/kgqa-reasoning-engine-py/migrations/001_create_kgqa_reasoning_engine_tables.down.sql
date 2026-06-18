-- Rollback: 001_create_kgqa_reasoning_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_kgqa_reasoning_engine_updated ON kgqa_reasoning_engine_records;
DROP FUNCTION IF EXISTS update_kgqa_reasoning_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_kgqa_reasoning_engine_idempotency();
DROP POLICY IF EXISTS kgqa_reasoning_engine_tenant_isolation ON kgqa_reasoning_engine_records;
DROP TABLE IF EXISTS kgqa_reasoning_engine_idempotency;
DROP TABLE IF EXISTS kgqa_reasoning_engine_audit;
DROP TABLE IF EXISTS kgqa_reasoning_engine_records;
COMMIT;
