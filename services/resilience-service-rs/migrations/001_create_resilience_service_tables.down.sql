-- Rollback: 001_create_resilience_service_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_resilience_service_updated ON resilience_service_records;
DROP FUNCTION IF EXISTS update_resilience_service_timestamp();
DROP FUNCTION IF EXISTS cleanup_resilience_service_idempotency();
DROP POLICY IF EXISTS resilience_service_tenant_isolation ON resilience_service_records;
DROP TABLE IF EXISTS resilience_service_idempotency;
DROP TABLE IF EXISTS resilience_service_audit;
DROP TABLE IF EXISTS resilience_service_records;
COMMIT;
