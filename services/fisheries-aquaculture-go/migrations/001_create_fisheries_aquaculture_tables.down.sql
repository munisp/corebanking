-- Rollback: 001_create_fisheries_aquaculture_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_fisheries_aquaculture_updated ON fisheries_aquaculture_records;
DROP FUNCTION IF EXISTS update_fisheries_aquaculture_timestamp();
DROP FUNCTION IF EXISTS cleanup_fisheries_aquaculture_idempotency();
DROP POLICY IF EXISTS fisheries_aquaculture_tenant_isolation ON fisheries_aquaculture_records;
DROP TABLE IF EXISTS fisheries_aquaculture_idempotency;
DROP TABLE IF EXISTS fisheries_aquaculture_audit;
DROP TABLE IF EXISTS fisheries_aquaculture_records;
COMMIT;
