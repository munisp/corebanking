-- Rollback: 001_create_avro_schema_registry_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_avro_schema_registry_updated ON avro_schema_registry_records;
DROP FUNCTION IF EXISTS update_avro_schema_registry_timestamp();
DROP FUNCTION IF EXISTS cleanup_avro_schema_registry_idempotency();
DROP POLICY IF EXISTS avro_schema_registry_tenant_isolation ON avro_schema_registry_records;
DROP TABLE IF EXISTS avro_schema_registry_idempotency;
DROP TABLE IF EXISTS avro_schema_registry_audit;
DROP TABLE IF EXISTS avro_schema_registry_records;
COMMIT;
