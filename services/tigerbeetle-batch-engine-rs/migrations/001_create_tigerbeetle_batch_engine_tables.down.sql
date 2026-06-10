-- Rollback: 001_create_tigerbeetle_batch_engine_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_tigerbeetle_batch_engine_updated ON tigerbeetle_batch_engine_records;
DROP FUNCTION IF EXISTS update_tigerbeetle_batch_engine_timestamp();
DROP FUNCTION IF EXISTS cleanup_tigerbeetle_batch_engine_idempotency();
DROP POLICY IF EXISTS tigerbeetle_batch_engine_tenant_isolation ON tigerbeetle_batch_engine_records;
DROP TABLE IF EXISTS tigerbeetle_batch_engine_idempotency;
DROP TABLE IF EXISTS tigerbeetle_batch_engine_audit;
DROP TABLE IF EXISTS tigerbeetle_batch_engine_records;
COMMIT;
