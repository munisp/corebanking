-- Rollback: 001_create_fast_json_serializer_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_fast_json_serializer_updated ON fast_json_serializer_records;
DROP FUNCTION IF EXISTS update_fast_json_serializer_timestamp();
DROP FUNCTION IF EXISTS cleanup_fast_json_serializer_idempotency();
DROP POLICY IF EXISTS fast_json_serializer_tenant_isolation ON fast_json_serializer_records;
DROP TABLE IF EXISTS fast_json_serializer_idempotency;
DROP TABLE IF EXISTS fast_json_serializer_audit;
DROP TABLE IF EXISTS fast_json_serializer_records;
COMMIT;
