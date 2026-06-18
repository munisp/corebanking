-- Rollback: 001_create_banking_clearing_ops_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_banking_clearing_ops_updated ON banking_clearing_ops_records;
DROP FUNCTION IF EXISTS update_banking_clearing_ops_timestamp();
DROP FUNCTION IF EXISTS cleanup_banking_clearing_ops_idempotency();
DROP POLICY IF EXISTS banking_clearing_ops_tenant_isolation ON banking_clearing_ops_records;
DROP TABLE IF EXISTS banking_clearing_ops_idempotency;
DROP TABLE IF EXISTS banking_clearing_ops_audit;
DROP TABLE IF EXISTS banking_clearing_ops_records;
COMMIT;
