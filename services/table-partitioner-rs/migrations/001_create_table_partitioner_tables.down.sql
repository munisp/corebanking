-- Rollback: 001_create_table_partitioner_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_table_partitioner_updated ON table_partitioner_records;
DROP FUNCTION IF EXISTS update_table_partitioner_timestamp();
DROP FUNCTION IF EXISTS cleanup_table_partitioner_idempotency();
DROP POLICY IF EXISTS table_partitioner_tenant_isolation ON table_partitioner_records;
DROP TABLE IF EXISTS table_partitioner_idempotency;
DROP TABLE IF EXISTS table_partitioner_audit;
DROP TABLE IF EXISTS table_partitioner_records;
COMMIT;
