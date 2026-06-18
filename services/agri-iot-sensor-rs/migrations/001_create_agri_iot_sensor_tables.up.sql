-- Migration: 001_create_agri_iot_sensor_tables
-- Service: agri-iot-sensor-rs
-- Created: 2026-06-09
-- Description: Initial schema for agri-iot-sensor-rs

BEGIN;

-- Main records table
CREATE TABLE IF NOT EXISTS agri_iot_sensor_records (
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
CREATE TABLE IF NOT EXISTS agri_iot_sensor_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID REFERENCES agri_iot_sensor_records(id),
    action VARCHAR(32) NOT NULL,
    actor VARCHAR(128) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency keys table
CREATE TABLE IF NOT EXISTS agri_iot_sensor_idempotency (
    key VARCHAR(256) PRIMARY KEY,
    response JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agri_iot_sensor_tenant ON agri_iot_sensor_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agri_iot_sensor_status ON agri_iot_sensor_records(status);
CREATE INDEX IF NOT EXISTS idx_agri_iot_sensor_type ON agri_iot_sensor_records(type);
CREATE INDEX IF NOT EXISTS idx_agri_iot_sensor_created ON agri_iot_sensor_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agri_iot_sensor_reference ON agri_iot_sensor_records(reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agri_iot_sensor_audit_record ON agri_iot_sensor_audit(record_id);
CREATE INDEX IF NOT EXISTS idx_agri_iot_sensor_audit_created ON agri_iot_sensor_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agri_iot_sensor_idempotency_expires ON agri_iot_sensor_idempotency(expires_at);

-- Row-level security
ALTER TABLE agri_iot_sensor_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY agri_iot_sensor_tenant_isolation ON agri_iot_sensor_records
    USING (tenant_id = current_setting('app.tenant_id', true));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_agri_iot_sensor_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_agri_iot_sensor_updated
    BEFORE UPDATE ON agri_iot_sensor_records
    FOR EACH ROW EXECUTE FUNCTION update_agri_iot_sensor_timestamp();

-- Cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_agri_iot_sensor_idempotency()
RETURNS void AS $$
BEGIN
    DELETE FROM agri_iot_sensor_idempotency WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMIT;
