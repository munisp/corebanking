-- Rollback: 001_create_offline_resilience_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_offline_resilience_updated ON offline_resilience_records;
DROP FUNCTION IF EXISTS update_offline_resilience_timestamp();
DROP FUNCTION IF EXISTS cleanup_offline_resilience_idempotency();
DROP POLICY IF EXISTS offline_resilience_tenant_isolation ON offline_resilience_records;
DROP TABLE IF EXISTS offline_resilience_idempotency;
DROP TABLE IF EXISTS offline_resilience_audit;
DROP TABLE IF EXISTS offline_resilience_records;
COMMIT;
