-- Migration: 001_create_satellite_crop_monitor_tables
-- Service: satellite-crop-monitor-rs
-- Created: 2026-06-09
-- Description: Initial schema for satellite-crop-monitor-rs

BEGIN;

-- Main records table
CREATE TABLE IF NOT EXISTS satellite_crop_monitor_records (
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
CREATE TABLE IF NOT EXISTS satellite_crop_monitor_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID REFERENCES satellite_crop_monitor_records(id),
    action VARCHAR(32) NOT NULL,
    actor VARCHAR(128) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency keys table
CREATE TABLE IF NOT EXISTS satellite_crop_monitor_idempotency (
    key VARCHAR(256) PRIMARY KEY,
    response JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_satellite_crop_monitor_tenant ON satellite_crop_monitor_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_satellite_crop_monitor_status ON satellite_crop_monitor_records(status);
CREATE INDEX IF NOT EXISTS idx_satellite_crop_monitor_type ON satellite_crop_monitor_records(type);
CREATE INDEX IF NOT EXISTS idx_satellite_crop_monitor_created ON satellite_crop_monitor_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_satellite_crop_monitor_reference ON satellite_crop_monitor_records(reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_satellite_crop_monitor_audit_record ON satellite_crop_monitor_audit(record_id);
CREATE INDEX IF NOT EXISTS idx_satellite_crop_monitor_audit_created ON satellite_crop_monitor_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_satellite_crop_monitor_idempotency_expires ON satellite_crop_monitor_idempotency(expires_at);

-- Row-level security
ALTER TABLE satellite_crop_monitor_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY satellite_crop_monitor_tenant_isolation ON satellite_crop_monitor_records
    USING (tenant_id = current_setting('app.tenant_id', true));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_satellite_crop_monitor_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_satellite_crop_monitor_updated
    BEFORE UPDATE ON satellite_crop_monitor_records
    FOR EACH ROW EXECUTE FUNCTION update_satellite_crop_monitor_timestamp();

-- Cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_satellite_crop_monitor_idempotency()
RETURNS void AS $$
BEGIN
    DELETE FROM satellite_crop_monitor_idempotency WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMIT;
