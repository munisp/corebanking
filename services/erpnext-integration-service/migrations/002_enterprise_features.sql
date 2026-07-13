-- Migration: Add enterprise configuration and monitoring tables
-- Date: 2026-02-07

-- Sync Configuration Table
CREATE TABLE IF NOT EXISTS sync_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) UNIQUE NOT NULL,
    auto_sync_enabled BOOLEAN DEFAULT false,
    sync_frequency VARCHAR(50) DEFAULT 'hourly',
    sync_time_of_day VARCHAR(5),
    batch_size INTEGER DEFAULT 100,
    parallel_connections INTEGER DEFAULT 3,
    timeout_seconds INTEGER DEFAULT 30,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Retry Policy Configuration Table
CREATE TABLE IF NOT EXISTS retry_policy_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) UNIQUE NOT NULL,
    max_retries INTEGER DEFAULT 3,
    initial_delay_seconds INTEGER DEFAULT 1,
    max_delay_seconds INTEGER DEFAULT 60,
    backoff_multiplier DECIMAL(5,2) DEFAULT 2.0,
    retry_on_status_codes JSONB DEFAULT '[408, 429, 500, 502, 503, 504]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification Configuration Table
CREATE TABLE IF NOT EXISTS notification_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) UNIQUE NOT NULL,
    email_notifications_enabled BOOLEAN DEFAULT false,
    notification_emails JSONB DEFAULT '[]',
    notify_on_sync_failure BOOLEAN DEFAULT true,
    notify_on_reconciliation_mismatch BOOLEAN DEFAULT true,
    notify_on_payment_failure BOOLEAN DEFAULT true,
    notify_on_high_value_transactions BOOLEAN DEFAULT true,
    high_value_threshold DECIMAL(15,2) DEFAULT 10000,
    slack_webhook_url TEXT,
    teams_webhook_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Security Configuration Table
CREATE TABLE IF NOT EXISTS security_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) UNIQUE NOT NULL,
    require_approval_for_payments_above DECIMAL(15,2) DEFAULT 5000,
    require_approval_for_config_changes BOOLEAN DEFAULT true,
    session_timeout_minutes INTEGER DEFAULT 30,
    allowed_ip_ranges JSONB DEFAULT '["0.0.0.0/0"]',
    mfa_required BOOLEAN DEFAULT false,
    audit_log_retention_days INTEGER DEFAULT 90,
    encryption_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Log Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255),
    changes JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    status VARCHAR(20) DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Exception Tracking Table
CREATE TABLE IF NOT EXISTS exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'open',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    data JSONB,
    assigned_to VARCHAR(255),
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);

CREATE INDEX IF NOT EXISTS idx_exceptions_tenant_id ON exceptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_exceptions_status ON exceptions(status);
CREATE INDEX IF NOT EXISTS idx_exceptions_severity ON exceptions(severity);
CREATE INDEX IF NOT EXISTS idx_exceptions_created_at ON exceptions(created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE sync_configs IS 'Configuration for ERP synchronization schedules and behavior';
COMMENT ON TABLE retry_policy_configs IS 'Retry policy configuration for failed API calls';
COMMENT ON TABLE notification_configs IS 'Notification preferences for system events';
COMMENT ON TABLE security_configs IS 'Security and compliance configuration settings';
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for all system activities';
COMMENT ON TABLE exceptions IS 'Exception tracking and management for operational issues';
