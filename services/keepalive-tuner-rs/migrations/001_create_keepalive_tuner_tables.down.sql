-- Rollback: 001_create_keepalive_tuner_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_keepalive_tuner_updated ON keepalive_tuner_records;
DROP FUNCTION IF EXISTS update_keepalive_tuner_timestamp();
DROP FUNCTION IF EXISTS cleanup_keepalive_tuner_idempotency();
DROP POLICY IF EXISTS keepalive_tuner_tenant_isolation ON keepalive_tuner_records;
DROP TABLE IF EXISTS keepalive_tuner_idempotency;
DROP TABLE IF EXISTS keepalive_tuner_audit;
DROP TABLE IF EXISTS keepalive_tuner_records;
COMMIT;
