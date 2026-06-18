-- Rollback: 001_create_relationship_pricing_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_relationship_pricing_updated ON relationship_pricing_records;
DROP FUNCTION IF EXISTS update_relationship_pricing_timestamp();
DROP FUNCTION IF EXISTS cleanup_relationship_pricing_idempotency();
DROP POLICY IF EXISTS relationship_pricing_tenant_isolation ON relationship_pricing_records;
DROP TABLE IF EXISTS relationship_pricing_idempotency;
DROP TABLE IF EXISTS relationship_pricing_audit;
DROP TABLE IF EXISTS relationship_pricing_records;
COMMIT;
