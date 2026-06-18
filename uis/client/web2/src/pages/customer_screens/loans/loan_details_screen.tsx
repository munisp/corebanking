import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { paymentService } from '../../../services/payment_service';
import { useAuth } from '../../../contexts/AuthContext';
import { usePageTitle } from '../../../hooks/usePageTitle';
import { getErrorMessage } from '../../../utils/error_utils';

interface LoanDetails {
  id: string;
  loan_application_id: string;
  amount: number;
  interestRate: number;
  duration: number;
  status: string;
  monthlyPayment: number;
  totalRepayment: number;
  disbursementDate: string;
  maturityDate: string;
  purpose: string;
  monthly_income?: number;
  existing_debt?: number;
  collateral_value?: number;
  credit_score?: number;
  employment_status?: string;
  employment_duration?: number;
  bank_statement_score?: number;
  bvn_verified?: boolean;
  nin_verified?: boolean;
}

const LoanDetailsScreen = () => {
  const navigate = useNavigate();
  const { id, loan_application_id } = useParams<{ id?: string; loan_application_id?: string }>();
  const { user } = useAuth();
  usePageTitle('Loan Details');
  const [loanDetails, setLoanDetails] = useState<LoanDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentPin, setPaymentPin] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    const loadLoanDetails = async () => {
      // Use loan_application_id if available, otherwise fall back to id for backward compatibility
      const loanApplicationId = loan_application_id || id;
      console.log('Loading loan details for loan_application_id:', loanApplicationId); // Debug log
      
      if (!loanApplicationId) {
        console.error('No loan application ID in URL params');
        setError('No loan application ID provided in URL');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        console.log('Importing loan service...'); // Debug log
        const { loanService } = await import('../../../services/loan_service');
        
        console.log('Calling getLoanById with loan_application_id:', loanApplicationId); // Debug log
        const loan = await loanService.getLoanById(loanApplicationId);
        
        console.log('Loan data received:', loan); // Debug log
        
        if (!loan) {
          setError('Loan not found');
          setLoading(false);
          return;
        }
        
        // Calculate monthly payment and total repayment if not provided
        const loanAmount = loan.loan_amount || loan.amount || 0;
        const interestRate = loan.LoanInterestRatePercent || loan.interestRate || 0;
        const termMonths = loan.requested_term || loan.term || loan.duration || 0;
        
        // Simple calculation: Monthly payment = (Principal + Interest) / Term
        // Total repayment = Principal * (1 + (Interest Rate / 100) * (Term / 12))
        const monthlyInterestRate = interestRate / 100 / 12;
        const monthlyPayment = termMonths > 0 && loanAmount > 0
          ? (loanAmount * monthlyInterestRate * Math.pow(1 + monthlyInterestRate, termMonths)) / 
            (Math.pow(1 + monthlyInterestRate, termMonths) - 1)
          : 0;
        const totalRepayment = termMonths > 0 && loanAmount > 0
          ? loanAmount * (1 + (interestRate / 100) * (termMonths / 12))
          : loanAmount;
        
        // Calculate maturity date from LoanStartedAt if available
        let maturityDate = 'N/A';
        if (loan.LoanStartedAt && termMonths > 0) {
          const startDate = new Date(loan.LoanStartedAt);
          startDate.setMonth(startDate.getMonth() + termMonths);
          maturityDate = startDate.toLocaleDateString();
        }
        
        setLoanDetails({
          id: loan.id || loan.loan_application_id || '',
          loan_application_id: loan.loan_application_id || loan.id || '',
          amount: loanAmount,
          interestRate: interestRate,
          duration: termMonths,
          status: loan.status || 'pending',
          monthlyPayment: loan.monthly_payment || loan.monthlyPayment || monthlyPayment,
          totalRepayment: loan.total_repayment || loan.totalRepayment || totalRepayment,
          disbursementDate: loan.LoanStartedAt ? new Date(loan.LoanStartedAt).toLocaleDateString() : 'N/A',
          maturityDate: maturityDate,
          purpose: loan.loan_purpose || loan.purpose || 'N/A',
          monthly_income: loan.monthly_income,
          existing_debt: loan.existing_debt,
          collateral_value: loan.collateral_value,
          credit_score: loan.credit_score,
          employment_status: loan.employment_status,
          employment_duration: loan.employment_duration,
          bank_statement_score: loan.bank_statement_score,
          bvn_verified: loan.bvn_verified,
          nin_verified: loan.nin_verified,
        });
      } catch (error) {
        console.error('Failed to load loan details:', error);
        setError(getErrorMessage(error, 'Failed to load loan details'));
      } finally {
        setLoading(false);
      }
    };

    loadLoanDetails();
  }, [id, loan_application_id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary-color)] mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading loan details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-[var(--primary-color)] text-white rounded-lg hover:bg-[var(--primary-color)]"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!loanDetails) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">Loan not found</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-[var(--primary-color)] text-white rounded-lg hover:bg-[var(--primary-color)]"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-4 px-4">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => navigate(-1)} className="text-gray-600 dark:text-gray-400 mb-6 hover:text-gray-800 dark:hover:text-gray-200">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Loan Application Details</h1>

        {/* Status Card */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-6 shadow-lg mb-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm opacity-90">Loan Status</p>
              <p className="text-2xl font-bold">{loanDetails.status}</p>
            </div>
            <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold">₦{loanDetails.amount.toLocaleString()}</p>
          <p className="text-sm opacity-90 mt-1">Loan Amount</p>
        </div>

        {/* Details */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-800 dark:text-white mb-4">Loan Details</h2>
          <div className="space-y-4">
            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Loan Application ID</span>
              <span className="font-semibold text-gray-800 dark:text-white">{loanDetails.loan_application_id}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Purpose</span>
              <span className="font-semibold text-gray-800 dark:text-white">{loanDetails.purpose}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Interest Rate</span>
              <span className="font-semibold text-gray-800 dark:text-white">{loanDetails.interestRate}% per annum</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Duration</span>
              <span className="font-semibold text-gray-800 dark:text-white">{loanDetails.duration} months</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Monthly Payment</span>
              <span className="font-semibold text-[var(--primary-color)] dark:text-[var(--primary-color)]">₦{loanDetails.monthlyPayment.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Total Repayment</span>
              <span className="font-semibold text-gray-800 dark:text-white">₦{loanDetails.totalRepayment.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Disbursement Date</span>
              <span className="font-semibold text-gray-800 dark:text-white">{loanDetails.disbursementDate}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600 dark:text-gray-400">Maturity Date</span>
              <span className="font-semibold text-gray-800 dark:text-white">{loanDetails.maturityDate}</span>
            </div>
          </div>
        </div>

        {/* Additional Information */}
        {(loanDetails.credit_score || loanDetails.monthly_income || loanDetails.employment_status) && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6 border border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-800 dark:text-white mb-4">Additional Information</h2>
            <div className="space-y-4">
              {loanDetails.credit_score && (
                <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Credit Score</span>
                  <span className="font-semibold text-gray-800 dark:text-white">{loanDetails.credit_score}</span>
                </div>
              )}
              {loanDetails.monthly_income && (
                <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Monthly Income</span>
                  <span className="font-semibold text-gray-800 dark:text-white">₦{loanDetails.monthly_income.toLocaleString()}</span>
                </div>
              )}
              {loanDetails.existing_debt !== undefined && (
                <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Existing Debt</span>
                  <span className="font-semibold text-gray-800 dark:text-white">₦{loanDetails.existing_debt.toLocaleString()}</span>
                </div>
              )}
              {loanDetails.collateral_value && (
                <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Collateral Value</span>
                  <span className="font-semibold text-gray-800 dark:text-white">₦{loanDetails.collateral_value.toLocaleString()}</span>
                </div>
              )}
              {loanDetails.employment_status && (
                <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Employment Status</span>
                  <span className="font-semibold text-gray-800 dark:text-white capitalize">{loanDetails.employment_status}</span>
                </div>
              )}
              {loanDetails.employment_duration && (
                <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Employment Duration</span>
                  <span className="font-semibold text-gray-800 dark:text-white">{loanDetails.employment_duration} months</span>
                </div>
              )}
              {loanDetails.bank_statement_score !== undefined && (
                <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">Bank Statement Score</span>
                  <span className="font-semibold text-gray-800 dark:text-white">{loanDetails.bank_statement_score}%</span>
                </div>
              )}
              <div className="flex justify-between py-2">
                <span className="text-gray-600 dark:text-gray-400">Verification Status</span>
                <div className="flex gap-2">
                  {loanDetails.bvn_verified && (
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold rounded">BVN</span>
                  )}
                  {loanDetails.nin_verified && (
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold rounded">NIN</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {(loanDetails.status?.toLowerCase() === 'active' || loanDetails.status?.toLowerCase() === 'disbursed' || loanDetails.status?.toLowerCase() === 'approved') && (
            <button
              onClick={() => setShowPaymentModal(true)}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Make Payment
            </button>
          )}

          <button
            onClick={() => alert('Download loan agreement - API integration needed')}
            className="w-full bg-[var(--primary-color)] hover:bg-[var(--primary-color)] text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download Agreement
          </button>

          <button
            onClick={() => navigate('/loan-application')}
            className="w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-white py-3 rounded-xl font-semibold transition-colors"
          >
            Apply for Another Loan
          </button>
        </div>

        {/* Payment Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Make Loan Payment</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Payment Amount (₦)
                  </label>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => {
                      setPaymentAmount(e.target.value);
                      setPaymentError(null);
                    }}
                    placeholder={`Enter amount (max: ₦${loanDetails.totalRepayment.toLocaleString()})`}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                    min="0"
                    max={loanDetails.totalRepayment}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Monthly payment: ₦{loanDetails.monthlyPayment.toLocaleString()}
                  </p>
                </div>

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
                      setPaymentAmount('');
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
                      if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
                        setPaymentError('Please enter a valid payment amount');
                        return;
                      }
                      if (parseFloat(paymentAmount) > loanDetails.totalRepayment) {
                        setPaymentError(`Amount cannot exceed total repayment of ₦${loanDetails.totalRepayment.toLocaleString()}`);
                        return;
                      }
                      if (!paymentPin || paymentPin.length !== 4) {
                        setPaymentError('Please enter a valid 4-digit PIN');
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
                        
                        const result = await paymentService.payLoan({
                          loanId: loanDetails.loan_application_id || loanDetails.id,
                          payer: accountId,
                          amount: parseFloat(paymentAmount),
                          pin: paymentPin,
                        });

                        if (result.success) {
                          alert(`Payment successful!\nAmount: ₦${parseFloat(paymentAmount).toLocaleString()}\n${result.message}`);
                          setShowPaymentModal(false);
                          setPaymentAmount('');
                          setPaymentPin('');
                          // Reload loan details
                          window.location.reload();
                        } else {
                          setPaymentError(result.message || 'Payment failed. Please try again.');
                        }
                      } catch (err: unknown) {
                        setPaymentError(err instanceof Error ? err.message : 'An error occurred. Please try again.');
                      } finally {
                        setIsProcessingPayment(false);
                      }
                    }}
                    disabled={isProcessingPayment}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-3 rounded-xl font-semibold transition-colors"
                  >
                    {isProcessingPayment ? 'Processing...' : 'Confirm Payment'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoanDetailsScreen;