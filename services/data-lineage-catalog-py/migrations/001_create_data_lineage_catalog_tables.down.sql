-- Rollback: 001_create_data_lineage_catalog_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_data_lineage_catalog_updated ON data_lineage_catalog_records;
DROP FUNCTION IF EXISTS update_data_lineage_catalog_timestamp();
DROP FUNCTION IF EXISTS cleanup_data_lineage_catalog_idempotency();
DROP POLICY IF EXISTS data_lineage_catalog_tenant_isolation ON data_lineage_catalog_records;
DROP TABLE IF EXISTS data_lineage_catalog_idempotency;
DROP TABLE IF EXISTS data_lineage_catalog_audit;
DROP TABLE IF EXISTS data_lineage_catalog_records;
COMMIT;
