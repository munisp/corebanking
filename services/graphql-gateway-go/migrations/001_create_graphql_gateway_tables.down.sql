-- Rollback: 001_create_graphql_gateway_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_graphql_gateway_updated ON graphql_gateway_records;
DROP FUNCTION IF EXISTS update_graphql_gateway_timestamp();
DROP FUNCTION IF EXISTS cleanup_graphql_gateway_idempotency();
DROP POLICY IF EXISTS graphql_gateway_tenant_isolation ON graphql_gateway_records;
DROP TABLE IF EXISTS graphql_gateway_idempotency;
DROP TABLE IF EXISTS graphql_gateway_audit;
DROP TABLE IF EXISTS graphql_gateway_records;
COMMIT;
