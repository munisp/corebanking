-- Rollback: 001_create_teller_operations_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_teller_operations_updated ON teller_operations_records;
DROP FUNCTION IF EXISTS update_teller_operations_timestamp();
DROP FUNCTION IF EXISTS cleanup_teller_operations_idempotency();
DROP POLICY IF EXISTS teller_operations_tenant_isolation ON teller_operations_records;
DROP TABLE IF EXISTS teller_operations_idempotency;
DROP TABLE IF EXISTS teller_operations_audit;
DROP TABLE IF EXISTS teller_operations_records;
COMMIT;
