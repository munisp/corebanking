-- Rollback: 001_create_circuit_breaker_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_circuit_breaker_updated ON circuit_breaker_records;
DROP FUNCTION IF EXISTS update_circuit_breaker_timestamp();
DROP FUNCTION IF EXISTS cleanup_circuit_breaker_idempotency();
DROP POLICY IF EXISTS circuit_breaker_tenant_isolation ON circuit_breaker_records;
DROP TABLE IF EXISTS circuit_breaker_idempotency;
DROP TABLE IF EXISTS circuit_breaker_audit;
DROP TABLE IF EXISTS circuit_breaker_records;
COMMIT;
