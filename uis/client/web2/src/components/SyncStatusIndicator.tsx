import React from 'react';
import { FiCheckCircle, FiClock, FiRefreshCw, FiXCircle } from 'react-icons/fi';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { useTenantTheme } from '../hooks/useTenantTheme';

/**
 * Component to display sync status indicator
 */
export const SyncStatusIndicator: React.FC = () => {
  const status = useSyncStatus();
  const { tenant } = useTenantTheme();

  if (status.pendingCount === 0 && status.failedCount === 0) {
    return null;
  }

  const getStatusIcon = () => {
    if (status.isSyncing) {
      return <FiRefreshCw className="animate-spin" size={16} />;
    }
    if (status.failedCount > 0) {
      return <FiXCircle size={16} />;
    }
    if (status.pendingCount > 0) {
      return <FiClock size={16} />;
    }
    return <FiCheckCircle size={16} />;
  };

  const getStatusText = () => {
    if (status.isSyncing) {
      return 'Syncing...';
    }
    if (status.failedCount > 0) {
      return `${status.failedCount} failed`;
    }
    if (status.pendingCount > 0) {
      return `${status.pendingCount} pending`;
    }
    return 'Synced';
  };

  const getStatusColor = () => {
    if (status.isSyncing) {
      return tenant.branding.primary_color;
    }
    if (status.failedCount > 0) {
      return tenant.branding.errorColor || '#D32F2F';
    }
    if (status.pendingCount > 0) {
      return tenant.branding.warningColor || '#FFA726';
    }
    return tenant.branding.successColor || '#66BB6A';
  };

  return (
    <div
      className="fixed bottom-20 right-4 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg px-4 py-2 flex items-center gap-2 border"
      style={{
        borderColor: `${getStatusColor()}40`,
        backgroundColor: tenant.branding.surfaceColor || 'var(--surface-color)',
      }}
    >
      <div style={{ color: getStatusColor() }}>
        {getStatusIcon()}
      </div>
      <span
        className="text-sm font-medium"
        style={{ color: tenant.branding.textPrimaryColor || 'var(--text-primary-color)' }}
      >
        {getStatusText()}
      </span>
    </div>
  );
};

