import React, { useEffect, useState } from 'react';
import { FiArrowLeft, FiCreditCard, FiShoppingCart, FiInfo } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import type { BNPLApplicationRequest } from '../../../models/bnpl';
import { bnplService } from '../../../services/bnpl_service';
import type { Business } from '../../../services/business_service';
import { businessService } from '../../../services/business_service';

const BNPLApplyScreen: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [purchaseAmount, setPurchaseAmount] = useState(0);
  const [installmentCount, setInstallmentCount] = useState(3);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [businessSearch, setBusinessSearch] = useState('');
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const [showBusinessDropdown, setShowBusinessDropdown] = useState(false);
  const [productDescription, setProductDescription] = useState('');
  const [creditScore, setCreditScore] = useState('');
  const [bvnVerified, setBvnVerified] = useState(false);

  useEffect(() => {
    businessService.getBusinesses().then((list) => {
      setBusinesses(list);
      setLoadingBusinesses(false);
    });
  }, []);

  const interestRate = installmentCount <= 3 ? 0 : 1.5 * (installmentCount - 3);
  const totalAmount = purchaseAmount * (1 + interestRate / 100);
  const perInstalment = installmentCount > 0 ? totalAmount / installmentCount : 0;

  const formatCurrency = (amount: number) =>
    `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (purchaseAmount <= 0) {
      alert('Please enter a valid purchase amount');
      return;
    }

    try {
      setLoading(true);
      const payload: BNPLApplicationRequest = {
        purchase_amount: purchaseAmount,
        installment_count: installmentCount,
        bvn_verified: bvnVerified,
        ...(selectedBusiness && { merchant_id: selectedBusiness.id }),
        ...(productDescription.trim() && { product_description: productDescription.trim() }),
        ...(creditScore.trim() && { credit_score: parseInt(creditScore.trim(), 10) }),
      };

      const result = await bnplService.createApplication(payload);

      if (result.success) {
        alert(result.message);
        navigate('/bnpl');
      } else {
        alert(result.message);
      }
    } catch {
      alert('Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    'w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white';
  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-600 dark:from-violet-700 dark:to-purple-700">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-3 mb-2">
            <button
              onClick={() => navigate('/bnpl')}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <FiArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-2xl font-bold text-white">BNPL Application</h1>
          </div>
          <p className="text-white/80 text-sm pl-12">Shop now, pay in easy instalments</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Purchase Details */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex items-center space-x-2 mb-6">
              <FiShoppingCart className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Purchase Details</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Purchase Amount (₦) *</label>
                <input
                  type="number"
                  value={purchaseAmount || ''}
                  min="0"
                  step="0.01"
                  onChange={(e) => setPurchaseAmount(Number(e.target.value))}
                  placeholder="0.00"
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Product Description</label>
                <input
                  type="text"
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  placeholder="e.g., Samsung Galaxy S24, Laptop, Refrigerator"
                  className={inputCls}
                />
              </div>
              <div className="relative">
                <label className={labelCls}>Merchant Business (optional)</label>
                <input
                  type="text"
                  value={selectedBusiness ? selectedBusiness.name : businessSearch}
                  onChange={(e) => {
                    setBusinessSearch(e.target.value);
                    setSelectedBusiness(null);
                    setShowBusinessDropdown(true);
                  }}
                  onFocus={() => setShowBusinessDropdown(true)}
                  placeholder={loadingBusinesses ? 'Loading businesses...' : 'Search registered businesses'}
                  className={inputCls}
                  disabled={loadingBusinesses}
                  autoComplete="off"
                />
                {showBusinessDropdown && !selectedBusiness && (
                  <div className="absolute z-10 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-52 overflow-y-auto mt-1">
                    {businesses
                      .filter((b) =>
                        b.name.toLowerCase().includes(businessSearch.toLowerCase()) ||
                        b.registration_number.toLowerCase().includes(businessSearch.toLowerCase())
                      )
                      .map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
                          onClick={() => {
                            setSelectedBusiness(b);
                            setBusinessSearch('');
                            setShowBusinessDropdown(false);
                          }}
                        >
                          <span className="font-medium text-gray-900 dark:text-white">{b.name}</span>
                          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                            Reg: {b.registration_number}
                          </span>
                        </button>
                      ))}
                    {businesses.filter((b) =>
                      b.name.toLowerCase().includes(businessSearch.toLowerCase()) ||
                      b.registration_number.toLowerCase().includes(businessSearch.toLowerCase())
                    ).length === 0 && (
                      <p className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">No businesses found</p>
                    )}
                  </div>
                )}
                {selectedBusiness && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Reg: {selectedBusiness.registration_number} · {selectedBusiness.verification_status}
                    <button
                      type="button"
                      className="ml-2 text-violet-600 dark:text-violet-400 underline"
                      onClick={() => { setSelectedBusiness(null); setBusinessSearch(''); }}
                    >
                      Change
                    </button>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Repayment Plan */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex items-center space-x-2 mb-6">
              <FiCreditCard className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Repayment Plan</h2>
            </div>
            <div>
              <label className={labelCls}>Number of Instalments *</label>
              <select
                value={installmentCount}
                onChange={(e) => setInstallmentCount(Number(e.target.value))}
                className={inputCls}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => {
                  const rate = n <= 3 ? '0%' : `${(1.5 * (n - 3)).toFixed(1)}%`;
                  return (
                    <option key={n} value={n}>
                      {n} instalment{n > 1 ? 's' : ''} — {rate} interest
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Live summary */}
            {purchaseAmount > 0 && (
              <div className="mt-4 p-4 bg-violet-50 dark:bg-violet-900/20 rounded-lg border border-violet-200 dark:border-violet-800">
                <div className="flex items-center space-x-2 mb-3">
                  <FiInfo className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">
                    Payment Summary
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Interest Rate</p>
                    <p className="text-lg font-bold text-violet-600 dark:text-violet-400">
                      {interestRate.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Amount</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {formatCurrency(totalAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Per Instalment</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {formatCurrency(perInstalment)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Optional Details */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Additional Details</h2>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Credit Score (optional)</label>
                <input
                  type="number"
                  value={creditScore}
                  min="0"
                  max="850"
                  onChange={(e) => setCreditScore(e.target.value)}
                  placeholder="e.g., 700"
                  className={inputCls}
                />
              </div>
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="bvnVerified"
                  checked={bvnVerified}
                  onChange={(e) => setBvnVerified(e.target.checked)}
                  className="w-4 h-4 text-violet-600 border-gray-300 rounded focus:ring-violet-500"
                />
                <label htmlFor="bvnVerified" className="text-sm text-gray-700 dark:text-gray-300">
                  My BVN (Bank Verification Number) is verified
                </label>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={() => navigate('/bnpl')}
              className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-[var(--primary-color)] hover:opacity-90 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BNPLApplyScreen;
