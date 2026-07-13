import { useEffect, useState } from "react";
import {
  FiArrowLeft,
  FiClock,
  FiInfo,
  FiSend,
  FiWifi,
  FiWifiOff,
} from "react-icons/fi";
import { useLocation } from "react-router-dom";
import TransferReceipt from "../../../components/TransferReceipt";
import { useOnlineStatus } from "../../../hooks/useOnlineStatus";
import { usePageTitle } from "../../../hooks/usePageTitle";
import { dbManager, type PendingTransfer } from "../../../utils/indexedDB";
import { ScheduleTransferModal } from "./ScheduleTransferModal";

// Commented out Bank interface - bank list functionality disabled
// interface Bank {
//   name: string;
//   code: string;
// }

interface TransferData {
  amount: string;
  recipientName: string;
  recipientAccount: string;
  bank: string;
  narration: string;
  reference: string;
  date: string;
  status: 'success' | 'pending' | 'failed';
}

export default function Transfer() {
  usePageTitle('Transfer');
  // Commented out bank list functionality
  // const [banks, setBanks] = useState<Bank[]>([]);
  // const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [payerAccountId, setPayerAccountId] = useState<string>("");
  const [payeeAccountId, setPayeeAccountId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pin, setPin] = useState("");

  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [transferData, setTransferData] = useState<TransferData | null>(null);
  const [pendingTransfers, setPendingTransfers] = useState<PendingTransfer[]>([]);
  const [showOfflineAlert, setShowOfflineAlert] = useState(false);
  const [isLoadingAccount, setIsLoadingAccount] = useState(true);
  
  const isOnline = useOnlineStatus();

  // Import payment service
  const loadPaymentService = async () => {
    const { paymentService } = await import('../../../services/payment_service');
    return paymentService;
  };

  // Get location state for pre-filled data from QR code
  const location = useLocation();
  const qrData = location.state as { recipientAccountId?: string; amount?: string; note?: string } | null;

  // Load user's primary account ID on mount
  useEffect(() => {
    (async () => {
      try {
        setIsLoadingAccount(true);
        // const { accountService } = await import('../../../services/account_service');
        const { getKeycloakId } = await import('../../../utils/auth_utils');
        const keycloakId = getKeycloakId();
        if (keycloakId) {
          // Get user accounts and find primary account
          const accounts: Array<{ id: string; isPrimary?: boolean }> = await [];
          // const accounts: Array<{ id: string; isPrimary?: boolean }> = await accountService.getUserAccounts(keycloakId);
          const primaryAccount = accounts.find(acc => acc.isPrimary) || accounts[0];
          if (primaryAccount) {
            setPayerAccountId(primaryAccount.id || '44');
          }
        }
      } catch (error) {
        console.error('Failed to load user account:', error);
      } finally {
        setIsLoadingAccount(false);
      }
    })();

    // Pre-fill data from QR code if available
    if (qrData) {
      if (qrData.recipientAccountId) {
        setPayeeAccountId(qrData.recipientAccountId);
      }
      if (qrData.amount) {
        setAmount(qrData.amount);
      }
      if (qrData.note) {
        setNote(qrData.note);
      }
    }
  }, [qrData]);

  // Commented out bank list loading
  // useEffect(() => {
  //   (async () => {
  //     try {
  //       const service = await loadPaymentService();
  //       const banksList = await service.getBanks();
  //       setBanks(banksList);
  //     } catch (error) {
  //       console.error('Failed to load banks:', error);
  //     }
  //   })();
  // }, []);

  // ─────────────────────────────────────────────
  //  Load pending transfers
  // ─────────────────────────────────────────────
  const loadPendingTransfers = async () => {
    try {
      const pending = await dbManager.getPendingTransfers();
      setPendingTransfers(pending);
    } catch (error) {
      console.error('Failed to load pending transfers:', error);
    }
  };

  useEffect(() => {
    loadPendingTransfers();
  }, []);

  // Auto-sync when connection is restored
  useEffect(() => {
    if (isOnline && pendingTransfers.length > 0) {
      const syncOnReconnect = async () => {
        try {
          console.log('[TransferScreen] Connection restored, syncing pending transfers...');
          const { syncService } = await import('../../../services/sync_service');
          const result = await syncService.syncPendingTransfers();
          console.log('[TransferScreen] Sync result:', result);
          
          // Check for transfer failures and notify user
          const failures = syncService.getTransferFailures();
          if (failures.length > 0) {
            failures.forEach((failure) => {
              alert(failure.message);
            });
          }
          
          // Reload pending transfers to update UI
          await loadPendingTransfers();
          
          // Also sync scheduled transfers
          await syncService.syncScheduledTransfers();
        } catch (error) {
          console.error('[TransferScreen] Failed to sync on reconnect:', error);
        }
      };
      
      // Small delay to ensure connection is stable
      const timeoutId = setTimeout(() => {
        syncOnReconnect();
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [isOnline, pendingTransfers.length]);

  // Commented out account verification
  // const verifyAccount = async () => {
  //   if (accountNumber.length !== 10 || !selectedBank) {
  //     return;
  //   }
  //   setIsVerifying(true);
  //   setAccountName(null);
  //   try {
  //     const service = await loadPaymentService();
  //     const result = await service.verifyAccount(accountNumber, selectedBank);
  //     setAccountName(result.accountName);
  //   } catch (error) {
  //     console.error('Account verification failed:', error);
  //     alert('Could not verify account number');
  //   } finally {
  //     setIsVerifying(false);
  //   }
  // };

  // ─────────────────────────────────────────────
  // Process transfer
  // ─────────────────────────────────────────────
  const handleTransfer = async () => {
    if ( !payeeAccountId || !amount || !pin) {
      alert('Please fill in all required fields');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setIsProcessing(true);

    // Check if offline
    if (!isOnline) {
      try {
        // Save transfer to IndexedDB for later sync
        const now = Date.now();
        const accountId = localStorage.getItem('account_id') || payerAccountId || '';
        const pendingTransfer: PendingTransfer = {
          payer: Number(accountId),
          payee: Number(payeeAccountId),
          amount: parseFloat(amount) || amount,
          note: note || "Transfer",
          pin: pin,
          timestamp: now,
          status: 'pending',
          // Legacy fields for backward compatibility
          recipientName: "Account " + payeeAccountId,
          recipientAccount: payeeAccountId,
          bankCode: "",
          bankName: "",
          narration: note,
        };

        await dbManager.addPendingTransfer(pendingTransfer);

        // Register background sync
        try {
          const { syncService } = await import('../../../services/sync_service');
          await syncService.registerBackgroundSync('sync-pending-transfers');
        } catch (error) {
          console.error('Failed to register background sync:', error);
        }

        setIsProcessing(false);
        setShowConfirmModal(false);
        setShowOfflineAlert(true);
        
        // Reload pending transfers
        await loadPendingTransfers();

        // Reset form after a delay
        setTimeout(() => {
          setShowOfflineAlert(false);
          handleCloseReceipt();
        }, 3000);

        return;
      } catch (error) {
        console.error('Failed to save offline transfer:', error);
        alert('Failed to save transfer. Please try again.');
        setIsProcessing(false);
        return;
      }
    }

    // Online - process normally
    try {
      const service = await loadPaymentService();
      const result = await service.transfer({
        payerAccountId: payerAccountId,
        payeeAccountId: payeeAccountId,
        amount: amountNum,
        note: note || "Transfer",
        pin: pin,
      });

      if (result.success) {
        setIsProcessing(false);
        setShowConfirmModal(false);

        // Generate receipt data from transaction
        const currentDate = new Date();
        const receiptData = {
          amount: amount,
          recipientName: "Account " + payeeAccountId,
          recipientAccount: payeeAccountId,
          bank: "",
          narration: note || "Transfer",
          reference: result.data?.reference || `TXN${Date.now()}`,
          date: currentDate.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          status: 'success' as const
        };

        setTransferData(receiptData);
        setShowReceipt(true);
      } else {
        alert(result.message || 'Transfer failed');
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Transfer failed:', error);
      alert('Transfer failed. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleCloseReceipt = () => {
    setShowReceipt(false);
    // Reset form
    setPayeeAccountId("");
    setAmount("");
    setNote("");
    setPin("");
  };

  // ─────────────────────────────────────────────
  // UI
  // ─────────────────────────────────────────────
  if (isLoadingAccount) {
    return (
      <div className="w-full min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary-color)] mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading account...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-6 md:px-8">
      <div className="max-w-2xl mx-auto space-y-5">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => history.back()} className="text-gray-900 dark:text-white">
            <FiArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Transfer Money</h1>
        </div>
        
        {/* Online/Offline Status */}
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
          isOnline 
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
        }`}>
          {isOnline ? <FiWifi size={16} /> : <FiWifiOff size={16} />}
          <span>{isOnline ? 'Online' : 'Offline'}</span>
        </div>
      </div>

      {/* Offline Alert */}
      {showOfflineAlert && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-800 rounded-xl">
          <div className="flex items-start gap-3">
            <FiClock className="text-yellow-600 dark:text-yellow-400 mt-1" size={20} />
            <div>
              <p className="font-semibold text-yellow-800 dark:text-yellow-300">Transfer Saved</p>
              <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                Your transfer has been saved and will be processed when you're back online.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pending Transfers */}
      {pendingTransfers.length > 0 && (
        <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--primary-color)10', borderColor: 'var(--primary-color)' }}>
          <div className="flex items-start gap-3">
            <FiClock className="mt-1" size={20} style={{ color: 'var(--primary-color)' }} />
            <div className="flex-1">
              <p className="font-semibold" style={{ color: 'var(--primary-color)' }}>
                {pendingTransfers.length} Pending Transfer{pendingTransfers.length > 1 ? 's' : ''}
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--primary-color)' }}>
                {isOnline 
                  ? 'Click "Sync Now" to process transfers' 
                  : 'Will be processed when you\'re back online'}
              </p>
              {isOnline && (
                <button
                  onClick={async () => {
                    try {
                      const { syncService } = await import('../../../services/sync_service');
                      const result = await syncService.syncPendingTransfers();
                      console.log('Manual sync result:', result);
                      
                      // Check for transfer failures and notify user
                      const failures = syncService.getTransferFailures();
                      if (failures.length > 0) {
                        failures.forEach((failure) => {
                          alert(failure.message);
                        });
                      }
                      
                      await loadPendingTransfers();
                      if (result.success > 0) {
                        alert(`Successfully synced ${result.success} transfer(s)`);
                      } else if (result.failed > 0 && failures.length === 0) {
                        // Only show generic message if no specific failures were shown
                        alert(`Failed to sync ${result.failed} transfer(s). Please check the console for details.`);
                      }
                    } catch (error) {
                      console.error('Manual sync failed:', error);
                      alert('Failed to sync transfers. Please try again.');
                    }
                  }}
                  className="mt-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                  style={{ backgroundColor: 'var(--primary-color)' }}
                >
                  Sync Now
                </button>
              )}
              <div className="mt-2 space-y-2">
                {pendingTransfers.slice(0, 3).map((transfer, idx) => (
                  <div key={transfer.id || idx} className="text-sm flex justify-between" style={{ color: 'var(--primary-color)' }}>
                    <span>₦{transfer.amount} → {transfer.recipientName || `Account ${transfer.payee || transfer.recipientAccount}`}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      transfer.status === 'pending' ? 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200' :
                      transfer.status === 'syncing' ? 'text-white' : 
                      'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200'
                    }`} style={transfer.status === 'syncing' ? { backgroundColor: 'var(--primary-color)' } : {}}>
                      {transfer.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gradient card */}
      <div className="bg-linear-to-br from-[var(--primary-color)] to-[var(--secondary-color)]  p-6 rounded-2xl shadow-md text-white mb-6">
        <div className="flex items-center gap-4">
          <div className="bg-white/20 p-3 rounded-xl">
            <FiSend size={28} />
          </div>

          <div>
            <h2 className="text-xl font-bold">Send Money</h2>
            <p className="text-white/80 text-sm">
              Transfer to any bank account
            </p>
          </div>
        </div>
      </div>

      {/* FORM */}
      <div className="space-y-5">
        {/* Payer Account ID (read-only, from user's account) */}
        {payerAccountId && (
          <div>
            <label className="font-medium text-gray-700 dark:text-gray-300">From Account</label>
            <input
              className="mt-1 w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-700 dark:text-white"
              value={payerAccountId}
              readOnly
              disabled
            />
          </div>
        )}

        {/* Payee Account ID */}
        <div>
          <label className="font-medium text-gray-700 dark:text-gray-300">Payee Account ID *</label>
          <input
            className="mt-1 w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 dark:text-white"
            type="number"
            value={payeeAccountId}
            onChange={(e) => setPayeeAccountId(e.target.value.replace(/\D/g, ""))}
            placeholder="Enter payee account ID (e.g., 35)"
            required
          />
        </div>

        {/* Commented out bank selection and account verification */}
        {/* Bank Dropdown */}
        {/* <div>
          <label className="font-medium text-gray-700 dark:text-gray-300">Select Bank</label>
          <select
            className="mt-1 w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 dark:text-white"
            value={selectedBank ?? ""}
            onChange={(e) => {
              setSelectedBank(e.target.value);
              setAccountName(null);
            }}
          >
            <option value="">Choose a bank</option>
            {banks.map((b, i) => (
              <option key={i} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>
        </div> */}

        {/* Account number */}
        {/* <div>
          <label className="font-medium text-gray-700 dark:text-gray-300">Account Number</label>
          <div className="relative">
            <input
              className="mt-1 w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg pr-12 bg-white dark:bg-gray-800 dark:text-white"
              maxLength={10}
              value={accountNumber}
              onChange={(e) =>
                setAccountNumber(e.target.value.replace(/\D/g, ""))
              }
              placeholder="0123456789"
            />
            <div className="absolute right-3 top-3">
              {isVerifying ? (
                <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--primary-color)', borderTopColor: 'transparent' }}></div>
              ) : accountName ? (
                <FiCheckCircle className="text-green-600 dark:text-green-400" size={22} />
              ) : (
                <button onClick={verifyAccount}>
                  <FiSearch size={20} className="text-gray-600 dark:text-gray-400" />
                </button>
              )}
            </div>
          </div>
        </div> */}

        {/* Account Name Card */}
        {/* {accountName && (
          <div className="p-4 bg-green-50 dark:bg-green-900/30 border border-green-300 dark:border-green-800 rounded-xl flex gap-3">
            <div className="bg-green-600 dark:bg-green-500 text-white p-2 rounded-lg">
              <FiUser />
            </div>
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400">Account Name</p>
              <p className="font-semibold text-lg text-gray-900 dark:text-white">{accountName}</p>
            </div>
          </div>
        )} */}

        {/* Amount */}
        <div>
          <label className="font-medium text-gray-700 dark:text-gray-300">Amount</label>
          <div className="flex items-center border border-gray-300 dark:border-gray-700 rounded-lg p-3 mt-1 bg-white dark:bg-gray-800">
            <span className="font-bold text-gray-700 dark:text-gray-300">₦</span>
            <input
              className="ml-2 w-full outline-none bg-transparent dark:text-white"
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value.replace(/\D/g, ""))
              }
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Note */}
        <div>
          <label className="font-medium text-gray-700 dark:text-gray-300">Note (Optional)</label>
          <input
            maxLength={50}
            className="mt-1 w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 dark:text-white"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Payment for services"
          />
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              type="button"
              onClick={() => setNote("QR Payment")}
              className="flex items-center gap-1 px-3 py-1 text-xs rounded-full border transition-colors"
              style={{
                borderColor: note === "QR Payment" ? 'var(--primary-color)' : undefined,
                backgroundColor: note === "QR Payment" ? 'var(--primary-color)' : undefined,
                color: note === "QR Payment" ? 'white' : undefined,
              }}
              title="Payment made via QR code scan"
            >
              <span>QR Payment</span>
            </button>
            <button
              type="button"
              onClick={() => setNote("Offline Transaction")}
              className="flex items-center gap-1 px-3 py-1 text-xs rounded-full border transition-colors"
              style={{
                borderColor: note === "Offline Transaction" ? 'var(--primary-color)' : undefined,
                backgroundColor: note === "Offline Transaction" ? 'var(--primary-color)' : undefined,
                color: note === "Offline Transaction" ? 'white' : undefined,
              }}
              title="Transaction queued while device was offline"
            >
              <span>Offline Transaction</span>
            </button>
          </div>
        </div>

        {/* PIN */}
        <div>
          <label className="font-medium text-gray-700 dark:text-gray-300">PIN *</label>
          <input
            type="password"
            maxLength={4}
            className="mt-1 w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 dark:text-white"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder="Enter 4-digit PIN"
            required
          />
        </div>

        {/* Info Banner */}
        <div className="flex gap-3 p-3 rounded-lg border" style={{ backgroundColor: 'var(--primary-color)10', borderColor: 'var(--primary-color)' }}>
          <FiInfo className="mt-1" style={{ color: 'var(--primary-color)' }} />
          <p className="text-sm" style={{ color: 'var(--primary-color)' }}>
            Ensure the account details are correct before proceeding.
          </p>
        </div>

        {/* Transfer Button */}
        <button
          className="w-full text-white py-4 rounded-lg text-lg font-semibold hover:opacity-90 transition"
          style={{ backgroundColor: 'var(--primary-color)' }}
          onClick={() => setShowConfirmModal(true)}
        >
          Continue Transfer
        </button>
      </div>

      {/* ───────────────────────────────────────────── */}
      {/* CONFIRMATION MODAL */}
      {/* ───────────────────────────────────────────── */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-[var(--primary-color)] dark:text-[var(--primary-color)] mb-4">
              Confirm Transfer
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Amount:</span>
                <span className="font-semibold text-gray-900 dark:text-white">₦{amount}</span>
              </div>

              <div className="border-t border-gray-300 dark:border-gray-700" />

              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">From Account:</span>
                <span className="font-semibold text-gray-900 dark:text-white">{payerAccountId || "N/A"}</span>
              </div>

              <div className="border-t border-gray-300 dark:border-gray-700" />

              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">To Account:</span>
                <span className="font-semibold text-gray-900 dark:text-white">{payeeAccountId}</span>
              </div>

              <div className="border-t border-gray-300 dark:border-gray-700" />

              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Note:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {note || "N/A"}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setShowScheduleModal(true);
                }}
                className="px-4 py-2 border-2 rounded-lg flex items-center gap-2"
                style={{ 
                  borderColor: 'var(--primary-color)',
                  color: 'var(--primary-color)'
                }}
              >
                <FiClock size={16} />
                Offline Transfer
              </button>

              <button
                onClick={handleTransfer}
                className="px-4 py-2 bg-[var(--primary-color)] dark:bg-[var(--primary-color)] text-white rounded-lg"
              >
                {isProcessing ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent animate-spin rounded-full" />
                ) : (
                  "Send Now"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Receipt */}
      {showReceipt && transferData && (
        <TransferReceipt
          isOpen={showReceipt}
          onClose={handleCloseReceipt}
          transferData={transferData}
        />
      )}

      {/* Schedule Transfer Modal */}
      {showScheduleModal && (
        <ScheduleTransferModal
          isOpen={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          transferData={{
            payer: payerAccountId || localStorage.getItem('account_id') || undefined,
            payee: payeeAccountId,
            amount: amount,
            note: note || "Transfer",
            pin: pin, // Pass PIN to offline transfer
            // Legacy fields for display
            recipientName: `Account ${payeeAccountId}`,
            recipientAccount: payeeAccountId,
            bankCode: "",
            bankName: "",
            narration: note || "Transfer",
          }}
          onScheduled={() => {
            setShowScheduleModal(false);
            // Reset form
            setPayeeAccountId("");
            setAmount("");
            setNote("");
            setPin("");
            // Reload pending transfers to show scheduled ones
            loadPendingTransfers();
          }}
        />
      )}
      </div>
    </div>
  );
}
