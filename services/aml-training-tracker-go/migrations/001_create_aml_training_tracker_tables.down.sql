-- Rollback: 001_create_aml_training_tracker_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_aml_training_tracker_updated ON aml_training_tracker_records;
DROP FUNCTION IF EXISTS update_aml_training_tracker_timestamp();
DROP FUNCTION IF EXISTS cleanup_aml_training_tracker_idempotency();
DROP POLICY IF EXISTS aml_training_tracker_tenant_isolation ON aml_training_tracker_records;
DROP TABLE IF EXISTS aml_training_tracker_idempotency;
DROP TABLE IF EXISTS aml_training_tracker_audit;
DROP TABLE IF EXISTS aml_training_tracker_records;
COMMIT;
