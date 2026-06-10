-- Rollback: 001_create_swift_messaging_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_swift_messaging_updated ON swift_messaging_records;
DROP FUNCTION IF EXISTS update_swift_messaging_timestamp();
DROP FUNCTION IF EXISTS cleanup_swift_messaging_idempotency();
DROP POLICY IF EXISTS swift_messaging_tenant_isolation ON swift_messaging_records;
DROP TABLE IF EXISTS swift_messaging_idempotency;
DROP TABLE IF EXISTS swift_messaging_audit;
DROP TABLE IF EXISTS swift_messaging_records;
COMMIT;
