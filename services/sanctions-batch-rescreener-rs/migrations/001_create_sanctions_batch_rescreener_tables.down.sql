-- Rollback: 001_create_sanctions_batch_rescreener_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_sanctions_batch_rescreener_updated ON sanctions_batch_rescreener_records;
DROP FUNCTION IF EXISTS update_sanctions_batch_rescreener_timestamp();
DROP FUNCTION IF EXISTS cleanup_sanctions_batch_rescreener_idempotency();
DROP POLICY IF EXISTS sanctions_batch_rescreener_tenant_isolation ON sanctions_batch_rescreener_records;
DROP TABLE IF EXISTS sanctions_batch_rescreener_idempotency;
DROP TABLE IF EXISTS sanctions_batch_rescreener_audit;
DROP TABLE IF EXISTS sanctions_batch_rescreener_records;
COMMIT;
