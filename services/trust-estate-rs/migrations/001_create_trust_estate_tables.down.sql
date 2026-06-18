-- Rollback: 001_create_trust_estate_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_trust_estate_updated ON trust_estate_records;
DROP FUNCTION IF EXISTS update_trust_estate_timestamp();
DROP FUNCTION IF EXISTS cleanup_trust_estate_idempotency();
DROP POLICY IF EXISTS trust_estate_tenant_isolation ON trust_estate_records;
DROP TABLE IF EXISTS trust_estate_idempotency;
DROP TABLE IF EXISTS trust_estate_audit;
DROP TABLE IF EXISTS trust_estate_records;
COMMIT;
