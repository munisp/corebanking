-- Rollback: 001_create_grpc_gateway_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_grpc_gateway_updated ON grpc_gateway_records;
DROP FUNCTION IF EXISTS update_grpc_gateway_timestamp();
DROP FUNCTION IF EXISTS cleanup_grpc_gateway_idempotency();
DROP POLICY IF EXISTS grpc_gateway_tenant_isolation ON grpc_gateway_records;
DROP TABLE IF EXISTS grpc_gateway_idempotency;
DROP TABLE IF EXISTS grpc_gateway_audit;
DROP TABLE IF EXISTS grpc_gateway_records;
COMMIT;
