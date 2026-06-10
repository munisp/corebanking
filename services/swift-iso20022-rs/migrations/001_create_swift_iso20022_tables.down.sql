-- Rollback: 001_create_swift_iso20022_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_swift_iso20022_updated ON swift_iso20022_records;
DROP FUNCTION IF EXISTS update_swift_iso20022_timestamp();
DROP FUNCTION IF EXISTS cleanup_swift_iso20022_idempotency();
DROP POLICY IF EXISTS swift_iso20022_tenant_isolation ON swift_iso20022_records;
DROP TABLE IF EXISTS swift_iso20022_idempotency;
DROP TABLE IF EXISTS swift_iso20022_audit;
DROP TABLE IF EXISTS swift_iso20022_records;
COMMIT;
