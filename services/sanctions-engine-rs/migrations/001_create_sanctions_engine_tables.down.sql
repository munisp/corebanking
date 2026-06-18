-- Rollback: 001_create_sanctions_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_sanctions_engine_updated ON sanctions_engine_records;
DROP FUNCTION IF EXISTS update_sanctions_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_sanctions_engine_idempotency();
DROP POLICY IF EXISTS sanctions_engine_tenant_isolation ON sanctions_engine_records;
DROP TABLE IF EXISTS sanctions_engine_idempotency;
DROP TABLE IF EXISTS sanctions_engine_audit;
DROP TABLE IF EXISTS sanctions_engine_records;
COMMIT;
