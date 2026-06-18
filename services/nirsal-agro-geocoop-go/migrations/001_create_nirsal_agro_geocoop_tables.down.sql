-- Rollback: 001_create_nirsal_agro_geocoop_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_nirsal_agro_geocoop_updated ON nirsal_agro_geocoop_records;
DROP FUNCTION IF EXISTS update_nirsal_agro_geocoop_timestamp();
DROP FUNCTION IF EXISTS cleanup_nirsal_agro_geocoop_idempotency();
DROP POLICY IF EXISTS nirsal_agro_geocoop_tenant_isolation ON nirsal_agro_geocoop_records;
DROP TABLE IF EXISTS nirsal_agro_geocoop_idempotency;
DROP TABLE IF EXISTS nirsal_agro_geocoop_audit;
DROP TABLE IF EXISTS nirsal_agro_geocoop_records;
COMMIT;
