-- Rollback: 001_create_fluvio_wasm_transform_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_fluvio_wasm_transform_updated ON fluvio_wasm_transform_records;
DROP FUNCTION IF EXISTS update_fluvio_wasm_transform_timestamp();
DROP FUNCTION IF EXISTS cleanup_fluvio_wasm_transform_idempotency();
DROP POLICY IF EXISTS fluvio_wasm_transform_tenant_isolation ON fluvio_wasm_transform_records;
DROP TABLE IF EXISTS fluvio_wasm_transform_idempotency;
DROP TABLE IF EXISTS fluvio_wasm_transform_audit;
DROP TABLE IF EXISTS fluvio_wasm_transform_records;
COMMIT;
