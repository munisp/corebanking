-- Migration: 001_create_baas_embedded_finance_tables
-- Service: baas-embedded-finance-go
-- Created: 2026-06-09
-- Description: Initial schema for baas-embedded-finance-go

BEGIN;

-- Main records table
CREATE TABLE IF NOT EXISTS baas_embedded_finance_records (
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
CREATE TABLE IF NOT EXISTS baas_embedded_finance_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID REFERENCES baas_embedded_finance_records(id),
    action VARCHAR(32) NOT NULL,
    actor VARCHAR(128) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency keys table
CREATE TABLE IF NOT EXISTS baas_embedded_finance_idempotency (
    key VARCHAR(256) PRIMARY KEY,
    response JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_baas_embedded_finance_tenant ON baas_embedded_finance_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_baas_embedded_finance_status ON baas_embedded_finance_records(status);
CREATE INDEX IF NOT EXISTS idx_baas_embedded_finance_type ON baas_embedded_finance_records(type);
CREATE INDEX IF NOT EXISTS idx_baas_embedded_finance_created ON baas_embedded_finance_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_baas_embedded_finance_reference ON baas_embedded_finance_records(reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_baas_embedded_finance_audit_record ON baas_embedded_finance_audit(record_id);
CREATE INDEX IF NOT EXISTS idx_baas_embedded_finance_audit_created ON baas_embedded_finance_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_baas_embedded_finance_idempotency_expires ON baas_embedded_finance_idempotency(expires_at);

-- Row-level security
ALTER TABLE baas_embedded_finance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY baas_embedded_finance_tenant_isolation ON baas_embedded_finance_records
    USING (tenant_id = current_setting('app.tenant_id', true));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_baas_embedded_finance_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_baas_embedded_finance_updated
    BEFORE UPDATE ON baas_embedded_finance_records
    FOR EACH ROW EXECUTE FUNCTION update_baas_embedded_finance_timestamp();

-- Cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_baas_embedded_finance_idempotency()
RETURNS void AS $$
BEGIN
    DELETE FROM baas_embedded_finance_idempotency WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMIT;
