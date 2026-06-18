-- Rollback: 001_create_epr_kgqa_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_epr_kgqa_engine_updated ON epr_kgqa_engine_records;
DROP FUNCTION IF EXISTS update_epr_kgqa_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_epr_kgqa_engine_idempotency();
DROP POLICY IF EXISTS epr_kgqa_engine_tenant_isolation ON epr_kgqa_engine_records;
DROP TABLE IF EXISTS epr_kgqa_engine_idempotency;
DROP TABLE IF EXISTS epr_kgqa_engine_audit;
DROP TABLE IF EXISTS epr_kgqa_engine_records;
COMMIT;
