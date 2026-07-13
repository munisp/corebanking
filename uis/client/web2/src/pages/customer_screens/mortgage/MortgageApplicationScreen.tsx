import React, { useState } from 'react';
import { FiArrowLeft, FiDollarSign, FiHome, FiMapPin, FiPercent } from 'react-icons/fi';
import { FaCalculator } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import type { MortgageApplicationRequest } from '../../../models/mortgage';
import { mortgageService } from '../../../services/mortgage_service';

const MortgageApplicationScreen: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showCalculator] = useState(true);

  // Form state
  const [formData, setFormData] = useState<MortgageApplicationRequest>({
    productType: 'fixed_rate',
    propertyAddress: '',
    propertyType: 'Apartment',
    propertyValue: 0,
    loanAmount: 0,
    downPayment: 0,
    loanTerm: 20,
    interestRate: 12.5,
    employmentType: '',
    monthlyGrossIncome: 0,
    description: '',
  });

  const [calculatedPayment, setCalculatedPayment] = useState<number>(0);

  const handleInputChange = (field: keyof MortgageApplicationRequest, value: string | number) => {
    const updatedData = { ...formData, [field]: value };
    setFormData(updatedData);

    // Auto-calculate down payment if property value or loan amount changes
    if (field === 'propertyValue' || field === 'loanAmount') {
      const propValue = field === 'propertyValue' ? Number(value) : updatedData.propertyValue;
      const loan = field === 'loanAmount' ? Number(value) : updatedData.loanAmount;
      updatedData.downPayment = propValue - loan;
      setFormData(updatedData);
    }

    // Calculate monthly payment
    if (updatedData.loanAmount > 0 && updatedData.loanTerm > 0 && updatedData.interestRate > 0) {
      const payment = mortgageService.calculateMonthlyPayment(
        updatedData.loanAmount,
        updatedData.interestRate,
        updatedData.loanTerm
      );
      setCalculatedPayment(payment);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.propertyAddress.trim()) {
      alert('Please enter property address');
      return;
    }

    if (formData.propertyValue <= 0 || formData.loanAmount <= 0) {
      alert('Please enter valid property value and loan amount');
      return;
    }

    if (formData.loanAmount > formData.propertyValue * 0.9) {
      alert('Loan amount cannot exceed 90% of property value');
      return;
    }

    try {
      setLoading(true);
      const result = await mortgageService.applyForMortgage(formData);
      
      if (result.success) {
        alert(result.message);
        navigate('/mortgages');
      } else {
        alert(result.message);
      }
    } catch (error) {
      alert('Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-700 dark:to-purple-700">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-3 mb-4">
            <button
              onClick={() => navigate('/mortgages')}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <FiArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-2xl font-bold text-white">Mortgage Application</h1>
          </div>
          <p className="text-white/90 text-sm">Complete the form below to apply for a mortgage</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Property Details */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex items-center space-x-2 mb-6">
              <FiHome className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Property Details</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Mortgage Product Type
                </label>
                <select
                  value={formData.productType}
                  onChange={(e) => handleInputChange('productType', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="fixed_rate">Fixed Rate</option>
                  <option value="variable_rate">Variable Rate</option>
                  <option value="nhf_backed">NHF Backed</option>
                  <option value="fmbn_backed">FMBN Backed</option>
                  <option value="construction_loan">Construction Loan</option>
                  <option value="equity_release">Equity Release</option>
                  <option value="buy_to_let">Buy to Let</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <div className="flex items-center space-x-2">
                    <FiMapPin className="w-4 h-4" />
                    <span>Property Address</span>
                  </div>
                </label>
                <input
                  type="text"
                  value={formData.propertyAddress}
                  onChange={(e) => handleInputChange('propertyAddress', e.target.value)}
                  placeholder="Enter full property address"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Property Type
                  </label>
                  <select
                    value={formData.propertyType}
                    onChange={(e) => handleInputChange('propertyType', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="Apartment">Apartment</option>
                    <option value="House">House</option>
                    <option value="Townhouse">Townhouse</option>
                    <option value="Condo">Condo</option>
                    <option value="Land">Land</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Property Value (₦)
                  </label>
                  <input
                    type="number"
                    value={formData.propertyValue || ''}
                    onChange={(e) => handleInputChange('propertyValue', Number(e.target.value))}
                    placeholder="0.00"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Loan Details */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex items-center space-x-2 mb-6">
              <FiDollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Loan Details</h2>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Loan Amount (₦)
                  </label>
                  <input
                    type="number"
                    value={formData.loanAmount || ''}
                    onChange={(e) => handleInputChange('loanAmount', Number(e.target.value))}
                    placeholder="0.00"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Down Payment (₦)
                  </label>
                  <input
                    type="number"
                    value={formData.downPayment || ''}
                    readOnly
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-600 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <div className="flex items-center space-x-2">
                      <FiPercent className="w-4 h-4" />
                      <span>Interest Rate (%)</span>
                    </div>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.interestRate || ''}
                    onChange={(e) => handleInputChange('interestRate', Number(e.target.value))}
                    placeholder="12.5"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Loan Term (Years)
                  </label>
                  <select
                    value={formData.loanTerm}
                    onChange={(e) => handleInputChange('loanTerm', Number(e.target.value))}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value={10}>10 years</option>
                    <option value={15}>15 years</option>
                    <option value={20}>20 years</option>
                    <option value={25}>25 years</option>
                    <option value={30}>30 years</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Employment Type (Optional)
                  </label>
                  <select
                    value={formData.employmentType || ''}
                    onChange={(e) => handleInputChange('employmentType', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Select...</option>
                    <option value="employed">Employed</option>
                    <option value="self_employed">Self Employed</option>
                    <option value="business_owner">Business Owner</option>
                    <option value="contract">Contract</option>
                    <option value="retired">Retired</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Monthly Gross Income (₦, Optional)
                  </label>
                  <input
                    type="number"
                    value={formData.monthlyGrossIncome || ''}
                    onChange={(e) => handleInputChange('monthlyGrossIncome', Number(e.target.value))}
                    placeholder="0.00"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Additional Information (Optional)
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Any additional details about the property or application..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                />
              </div>
            </div>
          </div>

          {/* Calculator */}
          {showCalculator && calculatedPayment > 0 && (
            <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-xl shadow-sm p-6 border border-green-200 dark:border-green-800">
              <div className="flex items-center space-x-2 mb-4">
                <FaCalculator className="w-5 h-5 text-green-600 dark:text-green-400" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Estimated Monthly Payment</h2>
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold text-green-600 dark:text-green-400 mb-2">
                  {formatCurrency(calculatedPayment)}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Based on {formatCurrency(formData.loanAmount)} at {formData.interestRate}% for {formData.loanTerm} years
                </p>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={() => navigate('/mortgages')}
              className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-[var(--primary-color)] hover:opacity-90 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MortgageApplicationScreen;
