-- Rollback: 001_create_tigerbeetle_multicurrency_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_tigerbeetle_multicurrency_updated ON tigerbeetle_multicurrency_records;
DROP FUNCTION IF EXISTS update_tigerbeetle_multicurrency_timestamp();
DROP FUNCTION IF EXISTS cleanup_tigerbeetle_multicurrency_idempotency();
DROP POLICY IF EXISTS tigerbeetle_multicurrency_tenant_isolation ON tigerbeetle_multicurrency_records;
DROP TABLE IF EXISTS tigerbeetle_multicurrency_idempotency;
DROP TABLE IF EXISTS tigerbeetle_multicurrency_audit;
DROP TABLE IF EXISTS tigerbeetle_multicurrency_records;
COMMIT;
