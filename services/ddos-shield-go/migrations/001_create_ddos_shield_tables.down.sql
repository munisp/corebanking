-- Rollback: 001_create_ddos_shield_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_ddos_shield_updated ON ddos_shield_records;
DROP FUNCTION IF EXISTS update_ddos_shield_timestamp();
DROP FUNCTION IF EXISTS cleanup_ddos_shield_idempotency();
DROP POLICY IF EXISTS ddos_shield_tenant_isolation ON ddos_shield_records;
DROP TABLE IF EXISTS ddos_shield_idempotency;
DROP TABLE IF EXISTS ddos_shield_audit;
DROP TABLE IF EXISTS ddos_shield_records;
COMMIT;
