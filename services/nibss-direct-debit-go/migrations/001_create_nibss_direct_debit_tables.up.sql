-- Migration: 001_create_nibss_direct_debit_tables
-- Service: nibss-direct-debit-go
-- Created: 2026-06-09
-- Description: Initial schema for nibss-direct-debit-go

BEGIN;

-- Main records table
CREATE TABLE IF NOT EXISTS nibss_direct_debit_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    type VARCHAR(64) NOT NULL DEFAULT 'primary',
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    data JSONB NOT NULL DEFAULT '{}',
    amount_kobo BIGINT DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
    reference VARCHAR(128) UNIQUE,
    created_by VARCHAR(128),
    updated_by VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1
);

-- Audit trail table
CREATE TABLE IF NOT EXISTS nibss_direct_debit_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID REFERENCES nibss_direct_debit_records(id),
    action VARCHAR(32) NOT NULL,
    actor VARCHAR(128) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency keys table
CREATE TABLE IF NOT EXISTS nibss_direct_debit_idempotency (
    key VARCHAR(256) PRIMARY KEY,
    response JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_nibss_direct_debit_tenant ON nibss_direct_debit_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nibss_direct_debit_status ON nibss_direct_debit_records(status);
CREATE INDEX IF NOT EXISTS idx_nibss_direct_debit_type ON nibss_direct_debit_records(type);
CREATE INDEX IF NOT EXISTS idx_nibss_direct_debit_created ON nibss_direct_debit_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nibss_direct_debit_reference ON nibss_direct_debit_records(reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nibss_direct_debit_audit_record ON nibss_direct_debit_audit(record_id);
CREATE INDEX IF NOT EXISTS idx_nibss_direct_debit_audit_created ON nibss_direct_debit_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nibss_direct_debit_idempotency_expires ON nibss_direct_debit_idempotency(expires_at);

-- Row-level security
ALTER TABLE nibss_direct_debit_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY nibss_direct_debit_tenant_isolation ON nibss_direct_debit_records
    USING (tenant_id = current_setting('app.tenant_id', true));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_nibss_direct_debit_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_nibss_direct_debit_updated
    BEFORE UPDATE ON nibss_direct_debit_records
    FOR EACH ROW EXECUTE FUNCTION update_nibss_direct_debit_timestamp();

-- Cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_nibss_direct_debit_idempotency()
RETURNS void AS $$
BEGIN
    DELETE FROM nibss_direct_debit_idempotency WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMIT;
