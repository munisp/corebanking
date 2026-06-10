-- Rollback: 001_create_webhook_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_webhook_engine_updated ON webhook_engine_records;
DROP FUNCTION IF EXISTS update_webhook_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_webhook_engine_idempotency();
DROP POLICY IF EXISTS webhook_engine_tenant_isolation ON webhook_engine_records;
DROP TABLE IF EXISTS webhook_engine_idempotency;
DROP TABLE IF EXISTS webhook_engine_audit;
DROP TABLE IF EXISTS webhook_engine_records;
COMMIT;
