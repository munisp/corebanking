-- Rollback: 001_create_art_adversarial_robustness_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_art_adversarial_robustness_updated ON art_adversarial_robustness_records;
DROP FUNCTION IF EXISTS update_art_adversarial_robustness_timestamp();
DROP FUNCTION IF EXISTS cleanup_art_adversarial_robustness_idempotency();
DROP POLICY IF EXISTS art_adversarial_robustness_tenant_isolation ON art_adversarial_robustness_records;
DROP TABLE IF EXISTS art_adversarial_robustness_idempotency;
DROP TABLE IF EXISTS art_adversarial_robustness_audit;
DROP TABLE IF EXISTS art_adversarial_robustness_records;
COMMIT;
