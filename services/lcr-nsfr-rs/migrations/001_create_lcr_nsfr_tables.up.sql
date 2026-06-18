-- Migration: 001_create_lcr_nsfr_tables
-- Service: lcr-nsfr-rs
-- Created: 2026-06-09
-- Description: Initial schema for lcr-nsfr-rs

BEGIN;

-- Main records table
CREATE TABLE IF NOT EXISTS lcr_nsfr_records (
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
CREATE TABLE IF NOT EXISTS lcr_nsfr_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID REFERENCES lcr_nsfr_records(id),
    action VARCHAR(32) NOT NULL,
    actor VARCHAR(128) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency keys table
CREATE TABLE IF NOT EXISTS lcr_nsfr_idempotency (
    key VARCHAR(256) PRIMARY KEY,
    response JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lcr_nsfr_tenant ON lcr_nsfr_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lcr_nsfr_status ON lcr_nsfr_records(status);
CREATE INDEX IF NOT EXISTS idx_lcr_nsfr_type ON lcr_nsfr_records(type);
CREATE INDEX IF NOT EXISTS idx_lcr_nsfr_created ON lcr_nsfr_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lcr_nsfr_reference ON lcr_nsfr_records(reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lcr_nsfr_audit_record ON lcr_nsfr_audit(record_id);
CREATE INDEX IF NOT EXISTS idx_lcr_nsfr_audit_created ON lcr_nsfr_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lcr_nsfr_idempotency_expires ON lcr_nsfr_idempotency(expires_at);

-- Row-level security
ALTER TABLE lcr_nsfr_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY lcr_nsfr_tenant_isolation ON lcr_nsfr_records
    USING (tenant_id = current_setting('app.tenant_id', true));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_lcr_nsfr_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lcr_nsfr_updated
    BEFORE UPDATE ON lcr_nsfr_records
    FOR EACH ROW EXECUTE FUNCTION update_lcr_nsfr_timestamp();

-- Cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_lcr_nsfr_idempotency()
RETURNS void AS $$
BEGIN
    DELETE FROM lcr_nsfr_idempotency WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMIT;
