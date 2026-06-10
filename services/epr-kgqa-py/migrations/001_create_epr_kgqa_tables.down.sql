-- Rollback: 001_create_epr_kgqa_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_epr_kgqa_updated ON epr_kgqa_records;
DROP FUNCTION IF EXISTS update_epr_kgqa_timestamp();
DROP FUNCTION IF EXISTS cleanup_epr_kgqa_idempotency();
DROP POLICY IF EXISTS epr_kgqa_tenant_isolation ON epr_kgqa_records;
DROP TABLE IF EXISTS epr_kgqa_idempotency;
DROP TABLE IF EXISTS epr_kgqa_audit;
DROP TABLE IF EXISTS epr_kgqa_records;
COMMIT;
