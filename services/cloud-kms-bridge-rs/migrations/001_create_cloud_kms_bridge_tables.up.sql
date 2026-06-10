-- Migration: 001_create_cloud_kms_bridge_tables
-- Service: cloud-kms-bridge-rs
-- Created: 2026-06-09
-- Description: Initial schema for cloud-kms-bridge-rs

BEGIN;

-- Main records table
CREATE TABLE IF NOT EXISTS cloud_kms_bridge_records (
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
CREATE TABLE IF NOT EXISTS cloud_kms_bridge_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID REFERENCES cloud_kms_bridge_records(id),
    action VARCHAR(32) NOT NULL,
    actor VARCHAR(128) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency keys table
CREATE TABLE IF NOT EXISTS cloud_kms_bridge_idempotency (
    key VARCHAR(256) PRIMARY KEY,
    response JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cloud_kms_bridge_tenant ON cloud_kms_bridge_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cloud_kms_bridge_status ON cloud_kms_bridge_records(status);
CREATE INDEX IF NOT EXISTS idx_cloud_kms_bridge_type ON cloud_kms_bridge_records(type);
CREATE INDEX IF NOT EXISTS idx_cloud_kms_bridge_created ON cloud_kms_bridge_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cloud_kms_bridge_reference ON cloud_kms_bridge_records(reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cloud_kms_bridge_audit_record ON cloud_kms_bridge_audit(record_id);
CREATE INDEX IF NOT EXISTS idx_cloud_kms_bridge_audit_created ON cloud_kms_bridge_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cloud_kms_bridge_idempotency_expires ON cloud_kms_bridge_idempotency(expires_at);

-- Row-level security
ALTER TABLE cloud_kms_bridge_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY cloud_kms_bridge_tenant_isolation ON cloud_kms_bridge_records
    USING (tenant_id = current_setting('app.tenant_id', true));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_cloud_kms_bridge_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cloud_kms_bridge_updated
    BEFORE UPDATE ON cloud_kms_bridge_records
    FOR EACH ROW EXECUTE FUNCTION update_cloud_kms_bridge_timestamp();

-- Cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_cloud_kms_bridge_idempotency()
RETURNS void AS $$
BEGIN
    DELETE FROM cloud_kms_bridge_idempotency WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMIT;
