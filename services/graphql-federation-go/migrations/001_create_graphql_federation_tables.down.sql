-- Rollback: 001_create_graphql_federation_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_graphql_federation_updated ON graphql_federation_records;
DROP FUNCTION IF EXISTS update_graphql_federation_timestamp();
DROP FUNCTION IF EXISTS cleanup_graphql_federation_idempotency();
DROP POLICY IF EXISTS graphql_federation_tenant_isolation ON graphql_federation_records;
DROP TABLE IF EXISTS graphql_federation_idempotency;
DROP TABLE IF EXISTS graphql_federation_audit;
DROP TABLE IF EXISTS graphql_federation_records;
COMMIT;
