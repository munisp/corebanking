-- Rollback: 001_create_equipment_leasing_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_equipment_leasing_updated ON equipment_leasing_records;
DROP FUNCTION IF EXISTS update_equipment_leasing_timestamp();
DROP FUNCTION IF EXISTS cleanup_equipment_leasing_idempotency();
DROP POLICY IF EXISTS equipment_leasing_tenant_isolation ON equipment_leasing_records;
DROP TABLE IF EXISTS equipment_leasing_idempotency;
DROP TABLE IF EXISTS equipment_leasing_audit;
DROP TABLE IF EXISTS equipment_leasing_records;
COMMIT;
