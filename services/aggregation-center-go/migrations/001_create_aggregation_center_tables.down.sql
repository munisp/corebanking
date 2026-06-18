-- Rollback: 001_create_aggregation_center_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_aggregation_center_updated ON aggregation_center_records;
DROP FUNCTION IF EXISTS update_aggregation_center_timestamp();
DROP FUNCTION IF EXISTS cleanup_aggregation_center_idempotency();
DROP POLICY IF EXISTS aggregation_center_tenant_isolation ON aggregation_center_records;
DROP TABLE IF EXISTS aggregation_center_idempotency;
DROP TABLE IF EXISTS aggregation_center_audit;
DROP TABLE IF EXISTS aggregation_center_records;
COMMIT;
