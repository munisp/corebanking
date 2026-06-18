-- Rollback: 001_create_nirsal_credit_guarantee_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_nirsal_credit_guarantee_updated ON nirsal_credit_guarantee_records;
DROP FUNCTION IF EXISTS update_nirsal_credit_guarantee_timestamp();
DROP FUNCTION IF EXISTS cleanup_nirsal_credit_guarantee_idempotency();
DROP POLICY IF EXISTS nirsal_credit_guarantee_tenant_isolation ON nirsal_credit_guarantee_records;
DROP TABLE IF EXISTS nirsal_credit_guarantee_idempotency;
DROP TABLE IF EXISTS nirsal_credit_guarantee_audit;
DROP TABLE IF EXISTS nirsal_credit_guarantee_records;
COMMIT;
