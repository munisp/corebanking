-- Rollback: 001_create_tigerbeetle_adapter_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_tigerbeetle_adapter_updated ON tigerbeetle_adapter_records;
DROP FUNCTION IF EXISTS update_tigerbeetle_adapter_timestamp();
DROP FUNCTION IF EXISTS cleanup_tigerbeetle_adapter_idempotency();
DROP POLICY IF EXISTS tigerbeetle_adapter_tenant_isolation ON tigerbeetle_adapter_records;
DROP TABLE IF EXISTS tigerbeetle_adapter_idempotency;
DROP TABLE IF EXISTS tigerbeetle_adapter_audit;
DROP TABLE IF EXISTS tigerbeetle_adapter_records;
COMMIT;
