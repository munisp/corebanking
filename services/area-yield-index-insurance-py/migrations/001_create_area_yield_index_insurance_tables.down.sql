-- Rollback: 001_create_area_yield_index_insurance_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_area_yield_index_insurance_updated ON area_yield_index_insurance_records;
DROP FUNCTION IF EXISTS update_area_yield_index_insurance_timestamp();
DROP FUNCTION IF EXISTS cleanup_area_yield_index_insurance_idempotency();
DROP POLICY IF EXISTS area_yield_index_insurance_tenant_isolation ON area_yield_index_insurance_records;
DROP TABLE IF EXISTS area_yield_index_insurance_idempotency;
DROP TABLE IF EXISTS area_yield_index_insurance_audit;
DROP TABLE IF EXISTS area_yield_index_insurance_records;
COMMIT;
