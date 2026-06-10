-- Rollback: 001_create_connection_pooler_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_connection_pooler_updated ON connection_pooler_records;
DROP FUNCTION IF EXISTS update_connection_pooler_timestamp();
DROP FUNCTION IF EXISTS cleanup_connection_pooler_idempotency();
DROP POLICY IF EXISTS connection_pooler_tenant_isolation ON connection_pooler_records;
DROP TABLE IF EXISTS connection_pooler_idempotency;
DROP TABLE IF EXISTS connection_pooler_audit;
DROP TABLE IF EXISTS connection_pooler_records;
COMMIT;
