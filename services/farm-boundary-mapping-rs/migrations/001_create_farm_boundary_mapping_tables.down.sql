-- Rollback: 001_create_farm_boundary_mapping_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_farm_boundary_mapping_updated ON farm_boundary_mapping_records;
DROP FUNCTION IF EXISTS update_farm_boundary_mapping_timestamp();
DROP FUNCTION IF EXISTS cleanup_farm_boundary_mapping_idempotency();
DROP POLICY IF EXISTS farm_boundary_mapping_tenant_isolation ON farm_boundary_mapping_records;
DROP TABLE IF EXISTS farm_boundary_mapping_idempotency;
DROP TABLE IF EXISTS farm_boundary_mapping_audit;
DROP TABLE IF EXISTS farm_boundary_mapping_records;
COMMIT;
