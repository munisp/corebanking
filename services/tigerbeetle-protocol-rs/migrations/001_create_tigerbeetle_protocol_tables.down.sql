-- Rollback: 001_create_tigerbeetle_protocol_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_tigerbeetle_protocol_updated ON tigerbeetle_protocol_records;
DROP FUNCTION IF EXISTS update_tigerbeetle_protocol_timestamp();
DROP FUNCTION IF EXISTS cleanup_tigerbeetle_protocol_idempotency();
DROP POLICY IF EXISTS tigerbeetle_protocol_tenant_isolation ON tigerbeetle_protocol_records;
DROP TABLE IF EXISTS tigerbeetle_protocol_idempotency;
DROP TABLE IF EXISTS tigerbeetle_protocol_audit;
DROP TABLE IF EXISTS tigerbeetle_protocol_records;
COMMIT;
