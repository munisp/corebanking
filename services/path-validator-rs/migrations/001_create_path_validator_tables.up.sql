-- Migration: 001_create_path_validator_tables
-- Service: path-validator-rs
-- Created: 2026-06-09
-- Description: Initial schema for path-validator-rs

BEGIN;

-- Main records table
CREATE TABLE IF NOT EXISTS path_validator_records (
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
CREATE TABLE IF NOT EXISTS path_validator_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID REFERENCES path_validator_records(id),
    action VARCHAR(32) NOT NULL,
    actor VARCHAR(128) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency keys table
CREATE TABLE IF NOT EXISTS path_validator_idempotency (
    key VARCHAR(256) PRIMARY KEY,
    response JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_path_validator_tenant ON path_validator_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_path_validator_status ON path_validator_records(status);
CREATE INDEX IF NOT EXISTS idx_path_validator_type ON path_validator_records(type);
CREATE INDEX IF NOT EXISTS idx_path_validator_created ON path_validator_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_path_validator_reference ON path_validator_records(reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_path_validator_audit_record ON path_validator_audit(record_id);
CREATE INDEX IF NOT EXISTS idx_path_validator_audit_created ON path_validator_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_path_validator_idempotency_expires ON path_validator_idempotency(expires_at);

-- Row-level security
ALTER TABLE path_validator_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY path_validator_tenant_isolation ON path_validator_records
    USING (tenant_id = current_setting('app.tenant_id', true));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_path_validator_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_path_validator_updated
    BEFORE UPDATE ON path_validator_records
    FOR EACH ROW EXECUTE FUNCTION update_path_validator_timestamp();

-- Cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_path_validator_idempotency()
RETURNS void AS $$
BEGIN
    DELETE FROM path_validator_idempotency WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMIT;
