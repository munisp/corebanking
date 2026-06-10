-- Rollback: 001_create_carbon_esg_tracker_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_carbon_esg_tracker_updated ON carbon_esg_tracker_records;
DROP FUNCTION IF EXISTS update_carbon_esg_tracker_timestamp();
DROP FUNCTION IF EXISTS cleanup_carbon_esg_tracker_idempotency();
DROP POLICY IF EXISTS carbon_esg_tracker_tenant_isolation ON carbon_esg_tracker_records;
DROP TABLE IF EXISTS carbon_esg_tracker_idempotency;
DROP TABLE IF EXISTS carbon_esg_tracker_audit;
DROP TABLE IF EXISTS carbon_esg_tracker_records;
COMMIT;
