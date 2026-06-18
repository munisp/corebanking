-- Rollback: 001_create_livestock_finance_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_livestock_finance_updated ON livestock_finance_records;
DROP FUNCTION IF EXISTS update_livestock_finance_timestamp();
DROP FUNCTION IF EXISTS cleanup_livestock_finance_idempotency();
DROP POLICY IF EXISTS livestock_finance_tenant_isolation ON livestock_finance_records;
DROP TABLE IF EXISTS livestock_finance_idempotency;
DROP TABLE IF EXISTS livestock_finance_audit;
DROP TABLE IF EXISTS livestock_finance_records;
COMMIT;
