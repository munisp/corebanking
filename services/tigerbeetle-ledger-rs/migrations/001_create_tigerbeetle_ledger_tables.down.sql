-- Rollback: 001_create_tigerbeetle_ledger_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_tigerbeetle_ledger_updated ON tigerbeetle_ledger_records;
DROP FUNCTION IF EXISTS update_tigerbeetle_ledger_timestamp();
DROP FUNCTION IF EXISTS cleanup_tigerbeetle_ledger_idempotency();
DROP POLICY IF EXISTS tigerbeetle_ledger_tenant_isolation ON tigerbeetle_ledger_records;
DROP TABLE IF EXISTS tigerbeetle_ledger_idempotency;
DROP TABLE IF EXISTS tigerbeetle_ledger_audit;
DROP TABLE IF EXISTS tigerbeetle_ledger_records;
COMMIT;
