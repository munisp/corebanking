-- Rollback: 001_create_iso20022_hub_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_iso20022_hub_updated ON iso20022_hub_records;
DROP FUNCTION IF EXISTS update_iso20022_hub_timestamp();
DROP FUNCTION IF EXISTS cleanup_iso20022_hub_idempotency();
DROP POLICY IF EXISTS iso20022_hub_tenant_isolation ON iso20022_hub_records;
DROP TABLE IF EXISTS iso20022_hub_idempotency;
DROP TABLE IF EXISTS iso20022_hub_audit;
DROP TABLE IF EXISTS iso20022_hub_records;
COMMIT;
