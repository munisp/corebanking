import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import { usePageTitle } from "../../../hooks/usePageTitle";
import { lpoService } from "../../../services/lpo_service";
import { paymentService } from "../../../services/payment_service";
import { getErrorMessage } from "../../../utils/error_utils";

interface LPODetails {
  id?: string;
  supplier_id: string;
  tenant_id: string;
  lpo_number: string;
  issuing_organization: string;
  lpo_amount: number;
  financing_amount: number;
  repayment_days: number;
  lpo_document_url: string;
  status?: string;
}

export default function LPODetailsScreen() {
  const { id, lpo_id } = useParams<{ id?: string; lpo_id?: string }>();
  const { user } = useAuth();
  usePageTitle('LPO Details');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lpoDetails, setLpoDetails] = useState<LPODetails | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentPin, setPaymentPin] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    const loadDetails = async () => {
      // Use lpo_id if available, otherwise fall back to id for backward compatibility
      const lpoId = lpo_id || id;
      if (!lpoId) {
        setErrorMessage("No LPO ID provided");
        setLoading(false);
        return;
      }
      
      try {
        const data = await lpoService.fetchLPODetails(lpoId);
        setLpoDetails({ ...data, id: lpoId } as LPODetails);
      } catch (err: unknown) {
        setErrorMessage(getErrorMessage(err, "Failed to load LPO details"));
      } finally {
        setLoading(false);
      }
    };

    loadDetails();
  }, [id, lpo_id]);

  const buildRow = (title: string, value: unknown) => (
    <div className="flex py-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      <div className="flex-1 font-semibold text-gray-700 dark:text-gray-300">{title}:</div>
      <div className="flex-2 text-gray-900 dark:text-white">{String(value ?? "N/A")}</div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin h-10 w-10 border-4 border-[var(--primary-color)] border-t-transparent rounded-full"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading LPO details...</span>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <p className="text-red-600 dark:text-red-400">{errorMessage}</p>
      </div>
    );
  }

  if (!lpoDetails) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-4 px-4">
      <div className="max-w-3xl mx-auto p-6 bg-white dark:bg-gray-800 shadow-md rounded-md border border-gray-200 dark:border-gray-700">
        <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">LPO Details</h1>

      {buildRow("Supplier ID", lpoDetails.supplier_id)}
      {buildRow("Tenant ID", lpoDetails.tenant_id)}
      {buildRow("LPO Number", lpoDetails.lpo_number)}
      {buildRow("Issuing Org", lpoDetails.issuing_organization)}
      {buildRow("LPO Amount", `₦${lpoDetails.lpo_amount.toLocaleString()}`)}
      {buildRow("Financing Amount", `₦${lpoDetails.financing_amount.toLocaleString()}`)}
      {buildRow("Repayment Days", lpoDetails.repayment_days)}
      {/* {buildRow(
        "Document URL",
        <a
          href={lpoDetails.lpo_document_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--primary-color)] dark:text-[var(--primary-color)] underline"
        >
          {lpoDetails.lpo_document_url}
        </a>
      )} */}

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => setShowPaymentModal(true)}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Pay LPO
        </button>
        <button
          onClick={() => window.open(lpoDetails.lpo_document_url, "_blank")}
          className="flex-1 bg-[var(--primary-color)] hover:bg-[var(--primary-color)] text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          View Document
        </button>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Pay LPO</h2>
            
            <div className="mb-4 p-4 bg-blue-50 dark:bg-[var(--primary-color)]/20 rounded-xl">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">LPO Number:</span>
                <span className="font-semibold text-gray-900 dark:text-white">{lpoDetails.id}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Financing Amount:</span>
                <span className="font-bold text-[var(--primary-color)] dark:text-[var(--primary-color)]">₦{lpoDetails.financing_amount.toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Transaction PIN
                </label>
                <input
                  type="password"
                  value={paymentPin}
                  onChange={(e) => {
                    setPaymentPin(e.target.value);
                    setPaymentError(null);
                  }}
                  placeholder="Enter your PIN"
                  maxLength={4}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              {paymentError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
                  {paymentError}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setPaymentPin('');
                    setPaymentError(null);
                  }}
                  className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white py-3 rounded-xl font-semibold transition-colors"
                  disabled={isProcessingPayment}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!paymentPin || paymentPin.length !== 4) {
                      setPaymentError('Please enter a valid 4-digit PIN');
                      return;
                    }

                    if (!lpoDetails.id && !lpoDetails.lpo_number) {
                      setPaymentError('LPO ID is missing');
                      return;
                    }

                    setIsProcessingPayment(true);
                    setPaymentError(null);

                    try {
                      const accountId = localStorage.getItem('account_id') || user?.id || '';
                      if (!accountId) {
                        setPaymentError('Account ID not found. Please ensure you are logged in.');
                        return;
                      }
                      
                      // Use LPO number as lpo_id (e.g., "LP01765019914") as expected by the API
                      const lpoId =  lpoDetails.id || '';
                      if (!lpoId) {
                        setPaymentError('LPO ID is missing');
                        return;
                      }
                      
                      const result = await paymentService.payLPO({
                        lpoId: lpoId,
                        payer: accountId,
                        pin: paymentPin,
                      });

                      if (result.success) {
                        alert(`Payment successful!\nAmount: ₦${lpoDetails.financing_amount.toLocaleString()}\n${result.message}`);
                        setShowPaymentModal(false);
                        setPaymentPin('');
                        // Reload LPO details
                        window.location.reload();
                      } else {
                        setPaymentError(result.message || 'Payment failed. Please try again.');
                      }
                    } catch (err: unknown) {
                      setPaymentError(getErrorMessage(err, 'An error occurred. Please try again.'));
                    } finally {
                      setIsProcessingPayment(false);
                    }
                  }}
                  disabled={isProcessingPayment}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-3 rounded-xl font-semibold transition-colors"
                >
                  {isProcessingPayment ? 'Processing...' : `Pay ₦${lpoDetails.financing_amount.toLocaleString()}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
