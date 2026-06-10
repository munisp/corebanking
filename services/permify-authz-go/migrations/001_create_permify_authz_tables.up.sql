-- Migration: 001_create_permify_authz_tables
-- Service: permify-authz-go
-- Created: 2026-06-09
-- Description: Initial schema for permify-authz-go

BEGIN;

-- Main records table
CREATE TABLE IF NOT EXISTS permify_authz_records (
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
CREATE TABLE IF NOT EXISTS permify_authz_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID REFERENCES permify_authz_records(id),
    action VARCHAR(32) NOT NULL,
    actor VARCHAR(128) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency keys table
CREATE TABLE IF NOT EXISTS permify_authz_idempotency (
    key VARCHAR(256) PRIMARY KEY,
    response JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_permify_authz_tenant ON permify_authz_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_permify_authz_status ON permify_authz_records(status);
CREATE INDEX IF NOT EXISTS idx_permify_authz_type ON permify_authz_records(type);
CREATE INDEX IF NOT EXISTS idx_permify_authz_created ON permify_authz_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_permify_authz_reference ON permify_authz_records(reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_permify_authz_audit_record ON permify_authz_audit(record_id);
CREATE INDEX IF NOT EXISTS idx_permify_authz_audit_created ON permify_authz_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_permify_authz_idempotency_expires ON permify_authz_idempotency(expires_at);

-- Row-level security
ALTER TABLE permify_authz_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY permify_authz_tenant_isolation ON permify_authz_records
    USING (tenant_id = current_setting('app.tenant_id', true));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_permify_authz_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_permify_authz_updated
    BEFORE UPDATE ON permify_authz_records
    FOR EACH ROW EXECUTE FUNCTION update_permify_authz_timestamp();

-- Cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_permify_authz_idempotency()
RETURNS void AS $$
BEGIN
    DELETE FROM permify_authz_idempotency WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMIT;
