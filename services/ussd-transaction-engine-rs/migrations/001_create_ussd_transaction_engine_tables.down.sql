-- Rollback: 001_create_ussd_transaction_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_ussd_transaction_engine_updated ON ussd_transaction_engine_records;
DROP FUNCTION IF EXISTS update_ussd_transaction_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_ussd_transaction_engine_idempotency();
DROP POLICY IF EXISTS ussd_transaction_engine_tenant_isolation ON ussd_transaction_engine_records;
DROP TABLE IF EXISTS ussd_transaction_engine_idempotency;
DROP TABLE IF EXISTS ussd_transaction_engine_audit;
DROP TABLE IF EXISTS ussd_transaction_engine_records;
COMMIT;
