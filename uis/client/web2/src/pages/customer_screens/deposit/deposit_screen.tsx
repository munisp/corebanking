import { useState } from 'react';
import { FiArrowLeft } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const DepositScreen = () => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'cash' | 'qr' | null>(null);

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    if (!selectedMethod) {
      alert('Please select a deposit method');
      return;
    }

    // If QR code method selected, navigate to QR code page
    if (selectedMethod === 'qr') {
      navigate('/qrcode');
      return;
    }

    setLoading(true);
    
    try {
      const { apiService } = await import('../../../services/api_service');
      const { AppConfig } = await import('../../../config/app_config');
      
      const response = await apiService.post(`${AppConfig.walletEndpoint}/deposit`, {
        amount: parseFloat(amount),
        method: selectedMethod,
      });
      
      // Type guard for response.data
      const data = response.data as { success?: boolean; message?: string };
      if (data && data.success) {
        alert(`Deposit of ₦${amount} via ${selectedMethod} initiated successfully`);
        navigate('/dashboard');
      } else {
        throw new Error((data && data.message) || 'Deposit failed');
      }
    } catch (error) {
      alert('Deposit failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Back Button */}
        <div className="mb-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center text-gray-700 dark:text-gray-300 hover:text-[var(--primary-color)] dark:hover:text-[var(--primary-color)] transition"
          >
            <FiArrowLeft size={20} className="mr-2" />
            Back to Dashboard
          </button>
        </div>
        
        {/* Header Card */}
        <div className="bg-linear-to-r var(--primary-color) var(--secondary-color) rounded-2xl p-6 shadow-lg mb-6">
          <div className="flex items-center">
            <div className="h-14 w-14 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div className="ml-4">
              <h1 className="text-white text-xl font-bold">Deposit Funds</h1>
              <p className="text-white text-opacity-80 text-sm">Add money to your wallet using cash or QR</p>
            </div>
          </div>
        </div>

        {/* Amount Input */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm mb-4">
          <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-3">Enter Amount</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400 text-lg">₦</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': 'var(--primary-color)' } as React.CSSProperties}
            />
          </div>
        </div>

        {/* Deposit Methods */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm mb-6">
          <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-4">Select Deposit Method</label>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setSelectedMethod('cash')}
              className={`p-6 border-2 rounded-xl transition-all ${
                selectedMethod === 'cash'
                  ? 'dark:bg-gray-700'
                  : 'border-gray-200 dark:border-gray-600 hover:opacity-80'
              }`}
              style={selectedMethod === 'cash' ? { borderColor: 'var(--primary-color)', backgroundColor: 'var(--primary-color)10' } : {}}
            >
              <svg className="w-12 h-12 mx-auto mb-3 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="font-semibold text-gray-800 dark:text-gray-200">Cash Deposit</span>
            </button>

            <button
              onClick={() => setSelectedMethod('qr')}
              className={`p-6 border-2 rounded-xl transition-all ${
                selectedMethod === 'qr'
                  ? 'dark:bg-gray-700'
                  : 'border-gray-200 dark:border-gray-600 hover:opacity-80'
              }`}
              style={selectedMethod === 'qr' ? { borderColor: 'var(--primary-color)', backgroundColor: 'var(--primary-color)10' } : {}}
            >
              <svg className="w-12 h-12 mx-auto mb-3 text-[var(--primary-color)] dark:text-[var(--primary-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              <span className="font-semibold text-gray-800 dark:text-gray-200">QR Code</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleDeposit}
            disabled={loading || !amount || !selectedMethod}
            className="w-full btn-primary disabled:bg-gray-400 py-4 rounded-xl font-semibold shadow-lg"
          >
            {loading ? 'Processing...' : 'Confirm Deposit'}
          </button>

          <button
            onClick={() => navigate(-1)}
            className="w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 py-4 rounded-xl font-semibold transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* Info Card */}
        <div className="mt-6 dark:bg-gray-800 border dark:border-gray-700 rounded-xl p-4" style={{ backgroundColor: 'var(--primary-color)10', borderColor: 'var(--primary-color)' }}>
          <div className="flex items-start">
            <svg className="w-5 h-5 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20" style={{ color: 'var(--primary-color)' }}>
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="text-sm" style={{ color: 'var(--primary-color)' }}>
              <p className="font-semibold mb-1">Deposit Information</p>
              <p>Cash deposits are processed instantly. QR code deposits require scanning at an authorized agent.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DepositScreen;
