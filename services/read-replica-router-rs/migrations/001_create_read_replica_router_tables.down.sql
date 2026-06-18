-- Rollback: 001_create_read_replica_router_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_read_replica_router_updated ON read_replica_router_records;
DROP FUNCTION IF EXISTS update_read_replica_router_timestamp();
DROP FUNCTION IF EXISTS cleanup_read_replica_router_idempotency();
DROP POLICY IF EXISTS read_replica_router_tenant_isolation ON read_replica_router_records;
DROP TABLE IF EXISTS read_replica_router_idempotency;
DROP TABLE IF EXISTS read_replica_router_audit;
DROP TABLE IF EXISTS read_replica_router_records;
COMMIT;
