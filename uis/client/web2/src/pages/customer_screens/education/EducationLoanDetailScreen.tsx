import React, { useEffect, useState } from 'react';
import {
  FiArrowLeft, FiBook, FiCalendar, FiCheckCircle, FiClock,
  FiDollarSign, FiRefreshCw, FiXCircle
} from 'react-icons/fi';
import { useNavigate, useParams } from 'react-router-dom';
import type { EducationLoan } from '../../../models/education_loan';
import { educationLoanService } from '../../../services/education_loan_service';

const EducationLoanDetailScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loan, setLoan] = useState<EducationLoan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (id) loadLoan(id);
  }, [id]);

  const loadLoan = async (loanId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await educationLoanService.getEducationLoanById(loanId);
      setLoan(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load education loan');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOffer = async () => {
    if (!id || !window.confirm('Accept this loan offer?')) return;
    setActionLoading(true);
    try {
      await educationLoanService.acceptOffer(id);
      await loadLoan(id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to accept offer');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectOffer = async () => {
    if (!id || !window.confirm('Reject this loan offer? This cannot be undone.')) return;
    setActionLoading(true);
    try {
      await educationLoanService.rejectOffer(id);
      navigate('/education-loans');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reject offer');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400';
      case 'pending': return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400';
      case 'approved': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400';
      case 'rejected': return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400';
      case 'completed': return 'text-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-gray-400';
      default: return 'text-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-gray-400';
    }
  };

  const formatCurrency = (amount: number) =>
    `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin h-12 w-12 border-4 border-[var(--primary-color)] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !loan) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center px-4">
        <div className="text-red-500 text-5xl mb-4">⚠</div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Failed to load loan</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
        <button
          onClick={() => id && loadLoan(id)}
          className="flex items-center space-x-2 px-6 py-3 bg-[var(--primary-color)] text-white rounded-lg hover:opacity-90"
        >
          <FiRefreshCw className="w-4 h-4" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const monthlyPayment = loan.totalAmount / (loan.loanTerm * 12);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 dark:from-indigo-700 dark:to-blue-700">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate('/education-loans')}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <FiArrowLeft className="w-5 h-5 text-white" />
            </button>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(loan.status)}`}>
              {loan.status}
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              <FiBook className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{loan.institution}</h1>
              <p className="text-white/80">{loan.courseOfStudy} · {loan.studyLevel}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Total Amount */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Loan Amount</p>
          <p className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
            {formatCurrency(loan.totalAmount)}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Est. monthly repayment: {formatCurrency(monthlyPayment)}
          </p>
        </div>

        {/* Financial Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Cost Breakdown</h2>
          <div className="space-y-3">
            {[
              { label: 'Tuition Fees', value: loan.tuitionFees, icon: FiBook },
              { label: 'Living Expenses', value: loan.livingExpenses, icon: FiDollarSign },
              { label: 'Books & Materials', value: loan.booksMaterials, icon: FiBook },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
                    <Icon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <span className="text-gray-600 dark:text-gray-400">{label}</span>
                </div>
                <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Loan Terms */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Loan Terms</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Interest Rate', value: `${loan.interestRate}% APR`, icon: FiDollarSign },
              { label: 'Loan Term', value: `${loan.loanTerm} years`, icon: FiClock },
              { label: 'Course Start', value: formatDate(loan.courseStartDate), icon: FiCalendar },
              { label: 'Course End', value: formatDate(loan.courseEndDate), icon: FiCalendar },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mt-0.5">
                  <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Application Timeline */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Timeline</h2>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Applied:</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(loan.applicationDate)}</span>
            </div>
            {loan.approvalDate && (
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Approved:</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(loan.approvalDate)}</span>
              </div>
            )}
          </div>
        </div>

        {loan.description && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Additional Notes</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">{loan.description}</p>
          </div>
        )}

        {/* Accept/Reject actions for approved loans awaiting acceptance */}
        {loan.status?.toLowerCase() === 'approved' && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">Loan Offer Ready</h2>
            <p className="text-blue-700 dark:text-blue-300 text-sm mb-4">
              Your education loan has been approved. Please accept or reject the offer below.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleAcceptOffer}
                disabled={actionLoading}
                className="flex-1 flex items-center justify-center space-x-2 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 font-semibold transition-colors"
              >
                <FiCheckCircle className="w-5 h-5" />
                <span>{actionLoading ? 'Processing...' : 'Accept Offer'}</span>
              </button>
              <button
                onClick={handleRejectOffer}
                disabled={actionLoading}
                className="flex-1 flex items-center justify-center space-x-2 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 font-semibold transition-colors"
              >
                <FiXCircle className="w-5 h-5" />
                <span>{actionLoading ? 'Processing...' : 'Reject Offer'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EducationLoanDetailScreen;
