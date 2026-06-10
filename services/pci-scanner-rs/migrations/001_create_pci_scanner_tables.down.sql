-- Rollback: 001_create_pci_scanner_tables
BEGIN;
DROP TRIGGER IF EXISTS trg_pci_scanner_updated ON pci_scanner_records;
DROP FUNCTION IF EXISTS update_pci_scanner_timestamp();
DROP FUNCTION IF EXISTS cleanup_pci_scanner_idempotency();
DROP POLICY IF EXISTS pci_scanner_tenant_isolation ON pci_scanner_records;
DROP TABLE IF EXISTS pci_scanner_idempotency;
DROP TABLE IF EXISTS pci_scanner_audit;
DROP TABLE IF EXISTS pci_scanner_records;
COMMIT;
