-- Rollback: 001_create_ctr_auto_filer_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_ctr_auto_filer_updated ON ctr_auto_filer_records;
DROP FUNCTION IF EXISTS update_ctr_auto_filer_timestamp();
DROP FUNCTION IF EXISTS cleanup_ctr_auto_filer_idempotency();
DROP POLICY IF EXISTS ctr_auto_filer_tenant_isolation ON ctr_auto_filer_records;
DROP TABLE IF EXISTS ctr_auto_filer_idempotency;
DROP TABLE IF EXISTS ctr_auto_filer_audit;
DROP TABLE IF EXISTS ctr_auto_filer_records;
COMMIT;
