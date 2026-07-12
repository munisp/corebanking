import { useRef } from 'react';
import { FiCheckCircle, FiDownload, FiX } from 'react-icons/fi';
import { useTenant } from '../contexts/TenantContext';

interface TransferReceiptProps {
  isOpen: boolean;
  onClose: () => void;
  transferData: {
    amount: string;
    recipientName: string;
    recipientAccount: string;
    bank: string;
    narration: string;
    reference: string;
    date: string;
    status: 'success' | 'failed' | 'pending';
  };
}

const TransferReceipt = ({ isOpen, onClose, transferData }: TransferReceiptProps) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const { tenant } = useTenant();

  if (!isOpen) return null;

  const handleDownload = () => {
    // Create a more detailed receipt for download
    const receiptContent = `
═══════════════════════════════════════
       ${tenant.displayName.toUpperCase()} TRANSFER RECEIPT
═══════════════════════════════════════

Transaction Details
───────────────────────────────────────
Reference:      ${transferData.reference}
Date & Time:    ${transferData.date}
Status:         ${transferData.status.toUpperCase()}

═══════════════════════════════════════

Transfer Information
───────────────────────────────────────
Amount:         ₦${transferData.amount}
Recipient:      ${transferData.recipientName}
Account:        ${transferData.recipientAccount}
Bank:           ${transferData.bank}
Narration:      ${transferData.narration || 'N/A'}

═══════════════════════════════════════

Thank you for banking with ${tenant.displayName}
Support: ${tenant.contact.email} | ${tenant.contact.phone}

═══════════════════════════════════════
    `;

    const blob = new Blob([receiptContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tenant.name}_Receipt_${transferData.reference}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div 
          className="p-6 rounded-t-2xl relative"
          style={{
            background: `linear-gradient(135deg, ${tenant.branding.primary_color} 0%, ${tenant.branding.secondary_color} 100%)`
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full p-2 transition"
          >
            <FiX size={24} />
          </button>

          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full mb-4 shadow-lg">
              <FiCheckCircle size={48} style={{ color: tenant.branding.successColor || '#10B981' }} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Transfer Successful!</h2>
            <p className="text-white text-opacity-90">Your money has been sent</p>
          </div>
        </div>

        {/* Receipt Content */}
        <div ref={receiptRef} className="p-6">
          {/* Amount */}
          <div className="text-center mb-6 pb-6 border-b-2 border-dashed dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Amount Sent</p>
            <p className="text-4xl font-bold text-gray-900 dark:text-white">₦{transferData.amount}</p>
          </div>

          {/* Details */}
          <div className="space-y-4 mb-6">
            <div className="flex justify-between items-start">
              <span className="text-sm text-gray-600 dark:text-gray-400">Recipient</span>
              <span className="font-semibold text-gray-900 dark:text-white text-right max-w-50">
                {transferData.recipientName}
              </span>
            </div>

            <div className="flex justify-between items-start">
              <span className="text-sm text-gray-600 dark:text-gray-400">Account Number</span>
              <span className="font-semibold text-gray-900 dark:text-white">{transferData.recipientAccount}</span>
            </div>

            <div className="flex justify-between items-start">
              <span className="text-sm text-gray-600 dark:text-gray-400">Bank</span>
              <span className="font-semibold text-gray-900 dark:text-white text-right max-w-50">
                {transferData.bank}
              </span>
            </div>

            {transferData.narration && (
              <div className="flex justify-between items-start">
                <span className="text-sm text-gray-600 dark:text-gray-400">Narration</span>
                <span className="font-semibold text-gray-900 dark:text-white text-right max-w-50">
                  {transferData.narration}
                </span>
              </div>
            )}

            <div className="pt-4 border-t dark:border-gray-700">
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Reference</span>
                <span className="font-mono text-xs text-gray-900 dark:text-white">{transferData.reference}</span>
              </div>

              <div className="flex justify-between items-start">
                <span className="text-sm text-gray-600 dark:text-gray-400">Date & Time</span>
                <span className="text-xs text-gray-900 dark:text-white">{transferData.date}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 text-white py-3 rounded-xl font-semibold transition-all hover:opacity-90"
              style={{ 
                backgroundColor: tenant.branding.primary_color,
              }}
            >
              <FiDownload size={20} />
              Download Receipt
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-full mt-3 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white py-3 font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransferReceipt;
