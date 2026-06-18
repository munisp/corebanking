-- Rollback: 001_create_tigerbeetle_sync_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_tigerbeetle_sync_updated ON tigerbeetle_sync_records;
DROP FUNCTION IF EXISTS update_tigerbeetle_sync_timestamp();
DROP FUNCTION IF EXISTS cleanup_tigerbeetle_sync_idempotency();
DROP POLICY IF EXISTS tigerbeetle_sync_tenant_isolation ON tigerbeetle_sync_records;
DROP TABLE IF EXISTS tigerbeetle_sync_idempotency;
DROP TABLE IF EXISTS tigerbeetle_sync_audit;
DROP TABLE IF EXISTS tigerbeetle_sync_records;
COMMIT;
