-- Migration: 001_create_developer_portal_tables
-- Service: developer-portal-go
-- Created: 2026-06-09
-- Description: Initial schema for developer-portal-go

BEGIN;

-- Main records table
CREATE TABLE IF NOT EXISTS developer_portal_records (
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
CREATE TABLE IF NOT EXISTS developer_portal_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID REFERENCES developer_portal_records(id),
    action VARCHAR(32) NOT NULL,
    actor VARCHAR(128) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency keys table
CREATE TABLE IF NOT EXISTS developer_portal_idempotency (
    key VARCHAR(256) PRIMARY KEY,
    response JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_developer_portal_tenant ON developer_portal_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_developer_portal_status ON developer_portal_records(status);
CREATE INDEX IF NOT EXISTS idx_developer_portal_type ON developer_portal_records(type);
CREATE INDEX IF NOT EXISTS idx_developer_portal_created ON developer_portal_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_developer_portal_reference ON developer_portal_records(reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_developer_portal_audit_record ON developer_portal_audit(record_id);
CREATE INDEX IF NOT EXISTS idx_developer_portal_audit_created ON developer_portal_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_developer_portal_idempotency_expires ON developer_portal_idempotency(expires_at);

-- Row-level security
ALTER TABLE developer_portal_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY developer_portal_tenant_isolation ON developer_portal_records
    USING (tenant_id = current_setting('app.tenant_id', true));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_developer_portal_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_developer_portal_updated
    BEFORE UPDATE ON developer_portal_records
    FOR EACH ROW EXECUTE FUNCTION update_developer_portal_timestamp();

-- Cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_developer_portal_idempotency()
RETURNS void AS $$
BEGIN
    DELETE FROM developer_portal_idempotency WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMIT;
