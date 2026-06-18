-- Rollback: 001_create_ddos_protection_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_ddos_protection_updated ON ddos_protection_records;
DROP FUNCTION IF EXISTS update_ddos_protection_timestamp();
DROP FUNCTION IF EXISTS cleanup_ddos_protection_idempotency();
DROP POLICY IF EXISTS ddos_protection_tenant_isolation ON ddos_protection_records;
DROP TABLE IF EXISTS ddos_protection_idempotency;
DROP TABLE IF EXISTS ddos_protection_audit;
DROP TABLE IF EXISTS ddos_protection_records;
COMMIT;
