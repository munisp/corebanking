import React, { useState } from 'react';
import { FiClock, FiWifiOff, FiX } from 'react-icons/fi';
// import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
import { useTenantTheme } from '../../../hooks/useTenantTheme';
import { syncService } from '../../../services/sync_service';
import { dbManager, type PendingTransfer } from '../../../utils/indexedDB';

interface ScheduleTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  transferData: {
    payer?: string | number;
    payee: string | number;
    amount: string;
    note?: string;
    pin?: string;
    // Legacy fields
    recipientName?: string;
    recipientAccount?: string;
    bankCode?: string;
    bankName?: string;
    narration?: string;
  };
  onScheduled: () => void;
}

export const ScheduleTransferModal: React.FC<ScheduleTransferModalProps> = ({
  isOpen,
  onClose,
  transferData,
  onScheduled,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  // const isOnline = useOnlineStatus();
  const { getPrimaryBgStyle, getPrimaryHoverStyle, tenant } = useTenantTheme();

  if (!isOpen) return null;

  const handleSaveOfflineTransfer = async () => {
    setIsSaving(true);
    try {
      // Save as pending transfer (will execute immediately when online)
      const accountId = localStorage.getItem('account_id') || '';
      const pendingTransfer: PendingTransfer = {
        payer: Number(transferData.payer || accountId),
        payee: Number(transferData.payee),
        amount: parseFloat(transferData.amount) || transferData.amount,
        note: transferData.note || transferData.narration || "Transfer",
        pin: transferData.pin || '',
        timestamp: Date.now(),
        status: 'pending',
        // Legacy fields for backward compatibility
        recipientName: transferData.recipientName,
        recipientAccount: String(transferData.payee),
        bankCode: transferData.bankCode || "",
        bankName: transferData.bankName || "",
        narration: transferData.narration || transferData.note || "Transfer",
      };

      await dbManager.addPendingTransfer(pendingTransfer);

      // Register background sync (non-blocking - don't fail if this doesn't work)
      try {
        await syncService.registerBackgroundSync('sync-pending-transfers');
      } catch (syncError) {
        // Background sync registration is optional - log but don't fail
        console.warn('Background sync registration failed (this is okay):', syncError);
      }

      alert('Transfer saved offline. It will be executed automatically when you come back online.');
      onScheduled();
      onClose();
    } catch (error) {
      console.error('Failed to save offline transfer:', error);
      alert('Failed to save offline transfer. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6"
        style={{ backgroundColor: tenant.branding.surfaceColor || 'var(--surface-color)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 
            className="text-2xl font-bold"
            style={{ color: tenant.branding.textPrimaryColor || 'var(--text-primary-color)' }}
          >
            Offline Transfer
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <FiX size={24} />
          </button>
        </div>

          <div className="space-y-4 mb-6">
          <div 
            className="p-4 rounded-xl"
            style={{ backgroundColor: `${tenant.branding.primary_color}10` }}
          >
            <div className="flex justify-between items-center mb-2">
              <span 
                className="text-sm"
                style={{ color: tenant.branding.textSecondaryColor || 'var(--text-secondary-color)' }}
              >
                Amount:
              </span>
              <span 
                className="font-bold"
                style={{ color: tenant.branding.primary_color }}
              >
                ₦{parseFloat(transferData.amount).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span 
                className="text-sm"
                style={{ color: tenant.branding.textSecondaryColor || 'var(--text-secondary-color)' }}
              >
                Recipient:
              </span>
              <span 
                className="font-semibold"
                style={{ color: tenant.branding.textPrimaryColor || 'var(--text-primary-color)' }}
              >
                {transferData.recipientName || `Account ${transferData.payee}`}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span 
                className="text-sm"
                style={{ color: tenant.branding.textSecondaryColor || 'var(--text-secondary-color)' }}
              >
                Account:
              </span>
              <span 
                className="font-mono text-sm"
                style={{ color: tenant.branding.textPrimaryColor || 'var(--text-primary-color)' }}
              >
                {transferData.recipientAccount || String(transferData.payee)}
              </span>
            </div>
          </div>

          <div 
            className="p-4 rounded-xl flex items-start gap-3"
            style={{ 
              backgroundColor: `${tenant.branding.primary_color}10`,
              borderColor: `${tenant.branding.primary_color}40`,
            }}
          >
            <FiWifiOff 
              size={20} 
              style={{ color: tenant.branding.primary_color }}
              className="mt-1"
            />
            <div>
              <p 
                className="font-semibold mb-1"
                style={{ color: tenant.branding.textPrimaryColor || 'var(--text-primary-color)' }}
              >
                Offline Transfer
              </p>
              <p 
                className="text-sm"
                style={{ color: tenant.branding.textSecondaryColor || 'var(--text-secondary-color)' }}
              >
                This transfer will be saved and executed automatically as soon as you come back online.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 px-6 py-3 border-2 rounded-xl font-semibold transition-colors"
            style={{
              borderColor: `${tenant.branding.primary_color}40`,
              color: tenant.branding.textPrimaryColor || 'var(--text-primary-color)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSaveOfflineTransfer}
            disabled={isSaving}
            className="flex-1 px-6 py-3 rounded-xl font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            style={getPrimaryBgStyle()}
            onMouseEnter={(e) => {
              if (!isSaving) {
                e.currentTarget.style.backgroundColor = getPrimaryHoverStyle().backgroundColor;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = tenant.branding.primary_color;
            }}
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <FiClock size={16} />
                <span>Save Offline Transfer</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

