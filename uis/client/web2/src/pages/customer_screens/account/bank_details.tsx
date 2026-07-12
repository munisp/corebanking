import { ClipboardDocumentIcon } from "@heroicons/react/24/outline";
import React, { useEffect, useState } from "react";
import { WalletService } from "../../../services/wallet_service";

interface Wallet {
  balance: number;
  accountNumber?: string;
}

const BankDetailsScreen: React.FC = () => {
  const walletService = new WalletService();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWallet = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await walletService.getMyWallet();
      setWallet(data);
    } catch (err: any) {
      setError(err.toString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWallet();
  }, []);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    alert(`${label} copied to clipboard`);
  };

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="loader"></div>
      </div>
    );

  if (error)
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <svg
          className="w-16 h-16 text-red-300 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="text-gray-600 mb-6">{error}</p>
        <button
          onClick={loadWallet}
          className="px-4 py-2 bg-[var(--primary-color)] text-white rounded-lg"
        >
          Retry
        </button>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Wallet Balance Card */}
        <div className="bg-gradient-to-r var(--primary-color) var(--secondary-color) text-white p-6 rounded-2xl shadow-lg">
          <div className="flex justify-between items-center mb-6">
            <div className="p-3 bg-white bg-opacity-20 rounded-lg">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 9V7a5 5 0 00-10 0v2H5v10h14V9h-2z"
                />
              </svg>
            </div>
            <button>
              <svg
                className="w-6 h-6"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M6 10a2 2 0 114 0 2 2 0 01-4 0zM12 10a2 2 0 114 0 2 2 0 01-4 0z" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-white/90">Wallet Balance</p>
          <p className="text-4xl font-bold mt-2">
            ₦{wallet?.balance.toFixed(2)}
          </p>
        </div>

        {/* Account Details */}
        <div className="bg-white p-6 rounded-xl shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-gray-800">Account Information</h2>

          {/* Account Number */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <svg
                  className="w-5 h-5 text-[var(--primary-color)]"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2a10 10 0 00-10 10v10h20V12a10 10 0 00-10-10zM7 14h10v2H7v-2z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-500">Account Number</p>
                <p className="font-semibold text-gray-800">
                  {wallet?.accountNumber || "N/A"}
                </p>
              </div>
            </div>
            <button
              onClick={() =>
                wallet?.accountNumber &&
                copyToClipboard(wallet.accountNumber, "Account number")
              }
              className="p-2 text-gray-600 hover:text-gray-900"
            >
              <ClipboardDocumentIcon className="w-5 h-5" />
            </button>
          </div>

          <hr />

          {/* Bank Name */}
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <svg
                className="w-5 h-5 text-[var(--primary-color)]"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 12l10 5 10-5v6H2v-6z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">Bank Name</p>
              <p className="font-semibold text-gray-800">Your Bank Name</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button className="flex-1 px-4 py-3 border border-gray-300 rounded-lg flex items-center justify-center gap-2">
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M10 5v10m5-5H5" />
            </svg>
            Add Money
          </button>
          <button className="flex-1 px-4 py-3 bg-[var(--primary-color)] text-white rounded-lg flex items-center justify-center gap-2">
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M3 10h14M10 3l7 7-7 7" />
            </svg>
            Transfer
          </button>
        </div>
      </div>
    </div>
  );
};

export default BankDetailsScreen;
