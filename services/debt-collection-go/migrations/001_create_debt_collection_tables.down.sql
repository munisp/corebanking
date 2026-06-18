-- Rollback: 001_create_debt_collection_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_debt_collection_updated ON debt_collection_records;
DROP FUNCTION IF EXISTS update_debt_collection_timestamp();
DROP FUNCTION IF EXISTS cleanup_debt_collection_idempotency();
DROP POLICY IF EXISTS debt_collection_tenant_isolation ON debt_collection_records;
DROP TABLE IF EXISTS debt_collection_idempotency;
DROP TABLE IF EXISTS debt_collection_audit;
DROP TABLE IF EXISTS debt_collection_records;
COMMIT;
