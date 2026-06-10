-- Rollback: 001_create_route_schema_enforcer_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_route_schema_enforcer_updated ON route_schema_enforcer_records;
DROP FUNCTION IF EXISTS update_route_schema_enforcer_timestamp();
DROP FUNCTION IF EXISTS cleanup_route_schema_enforcer_idempotency();
DROP POLICY IF EXISTS route_schema_enforcer_tenant_isolation ON route_schema_enforcer_records;
DROP TABLE IF EXISTS route_schema_enforcer_idempotency;
DROP TABLE IF EXISTS route_schema_enforcer_audit;
DROP TABLE IF EXISTS route_schema_enforcer_records;
COMMIT;
