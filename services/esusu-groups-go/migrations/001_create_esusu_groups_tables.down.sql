-- Rollback: 001_create_esusu_groups_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_esusu_groups_updated ON esusu_groups_records;
DROP FUNCTION IF EXISTS update_esusu_groups_timestamp();
DROP FUNCTION IF EXISTS cleanup_esusu_groups_idempotency();
DROP POLICY IF EXISTS esusu_groups_tenant_isolation ON esusu_groups_records;
DROP TABLE IF EXISTS esusu_groups_idempotency;
DROP TABLE IF EXISTS esusu_groups_audit;
DROP TABLE IF EXISTS esusu_groups_records;
COMMIT;
