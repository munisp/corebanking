import React from 'react';
import { FiRefreshCw, FiWifiOff } from 'react-icons/fi';
import { useTenantTheme } from '../hooks/useTenantTheme';

interface OfflineScreenProps {
  message?: string;
  onRetry?: () => void;
}

export const OfflineScreen: React.FC<OfflineScreenProps> = ({ 
  message = 'You are currently offline',
  onRetry 
}) => {
  const { getPrimaryBgStyle, getPrimaryHoverStyle, tenant } = useTenantTheme();

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center px-4"
      style={{ 
        backgroundColor: tenant.branding.backgroundColor || 'var(--background-color)',
        color: tenant.branding.textPrimaryColor || 'var(--text-primary-color)'
      }}
    >
      <div 
        className="max-w-md w-full rounded-2xl p-8 text-center shadow-lg"
        style={{ 
          backgroundColor: tenant.branding.surfaceColor || 'var(--surface-color)',
        }}
      >
        <div 
          className="w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center"
          style={{ 
            backgroundColor: `${tenant.branding.primary_color}20`,
          }}
        >
          <FiWifiOff 
            size={48} 
            style={{ color: tenant.branding.primary_color }}
          />
        </div>
        
        <h1 
          className="text-2xl font-bold mb-3"
          style={{ color: tenant.branding.textPrimaryColor || 'var(--text-primary-color)' }}
        >
          No Internet Connection
        </h1>
        
        <p 
          className="mb-6"
          style={{ color: tenant.branding.textSecondaryColor || 'var(--text-secondary-color)' }}
        >
          {message}. Please check your connection and try again.
        </p>

        <button
          onClick={handleRetry}
          className="w-full py-3 px-6 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
          style={getPrimaryBgStyle()}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = getPrimaryHoverStyle().backgroundColor;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = tenant.branding.primary_color;
          }}
        >
          <FiRefreshCw size={20} />
          <span>Try Again</span>
        </button>

        <div 
          className="mt-6 pt-6 border-t"
          style={{ borderColor: `${tenant.branding.primary_color}30` }}
        >
          <p 
            className="text-sm"
            style={{ color: tenant.branding.textSecondaryColor || 'var(--text-secondary-color)' }}
          >
            Some features like Dashboard, Cards, and Transfers are available offline
          </p>
        </div>
      </div>
    </div>
  );
};
