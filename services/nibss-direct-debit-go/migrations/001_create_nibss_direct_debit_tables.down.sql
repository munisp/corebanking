-- Rollback: 001_create_nibss_direct_debit_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_nibss_direct_debit_updated ON nibss_direct_debit_records;
DROP FUNCTION IF EXISTS update_nibss_direct_debit_timestamp();
DROP FUNCTION IF EXISTS cleanup_nibss_direct_debit_idempotency();
DROP POLICY IF EXISTS nibss_direct_debit_tenant_isolation ON nibss_direct_debit_records;
DROP TABLE IF EXISTS nibss_direct_debit_idempotency;
DROP TABLE IF EXISTS nibss_direct_debit_audit;
DROP TABLE IF EXISTS nibss_direct_debit_records;
COMMIT;
