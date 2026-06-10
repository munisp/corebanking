-- Rollback: 001_create_grpc_hot_path_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_grpc_hot_path_updated ON grpc_hot_path_records;
DROP FUNCTION IF EXISTS update_grpc_hot_path_timestamp();
DROP FUNCTION IF EXISTS cleanup_grpc_hot_path_idempotency();
DROP POLICY IF EXISTS grpc_hot_path_tenant_isolation ON grpc_hot_path_records;
DROP TABLE IF EXISTS grpc_hot_path_idempotency;
DROP TABLE IF EXISTS grpc_hot_path_audit;
DROP TABLE IF EXISTS grpc_hot_path_records;
COMMIT;
