-- Migration: 001_create_immutable_audit_tables
-- Service: immutable-audit-rs
-- Created: 2026-06-09
-- Description: Initial schema for immutable-audit-rs

BEGIN;

-- Main records table
CREATE TABLE IF NOT EXISTS immutable_audit_records (
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
CREATE TABLE IF NOT EXISTS immutable_audit_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID REFERENCES immutable_audit_records(id),
    action VARCHAR(32) NOT NULL,
    actor VARCHAR(128) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency keys table
CREATE TABLE IF NOT EXISTS immutable_audit_idempotency (
    key VARCHAR(256) PRIMARY KEY,
    response JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_immutable_audit_tenant ON immutable_audit_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_immutable_audit_status ON immutable_audit_records(status);
CREATE INDEX IF NOT EXISTS idx_immutable_audit_type ON immutable_audit_records(type);
CREATE INDEX IF NOT EXISTS idx_immutable_audit_created ON immutable_audit_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_immutable_audit_reference ON immutable_audit_records(reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_immutable_audit_audit_record ON immutable_audit_audit(record_id);
CREATE INDEX IF NOT EXISTS idx_immutable_audit_audit_created ON immutable_audit_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_immutable_audit_idempotency_expires ON immutable_audit_idempotency(expires_at);

-- Row-level security
ALTER TABLE immutable_audit_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY immutable_audit_tenant_isolation ON immutable_audit_records
    USING (tenant_id = current_setting('app.tenant_id', true));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_immutable_audit_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_immutable_audit_updated
    BEFORE UPDATE ON immutable_audit_records
    FOR EACH ROW EXECUTE FUNCTION update_immutable_audit_timestamp();

-- Cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_immutable_audit_idempotency()
RETURNS void AS $$
BEGIN
    DELETE FROM immutable_audit_idempotency WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMIT;
