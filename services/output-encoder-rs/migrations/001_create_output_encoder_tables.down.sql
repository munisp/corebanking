-- Rollback: 001_create_output_encoder_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_output_encoder_updated ON output_encoder_records;
DROP FUNCTION IF EXISTS update_output_encoder_timestamp();
DROP FUNCTION IF EXISTS cleanup_output_encoder_idempotency();
DROP POLICY IF EXISTS output_encoder_tenant_isolation ON output_encoder_records;
DROP TABLE IF EXISTS output_encoder_idempotency;
DROP TABLE IF EXISTS output_encoder_audit;
DROP TABLE IF EXISTS output_encoder_records;
COMMIT;
