import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiAlertCircle } from 'react-icons/fi';
import type { Mortgage } from '../../../models/mortgage';
import { mortgageService } from '../../../services/mortgage_service';

const MortgageDetailScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [mortgage, setMortgage] = useState<Mortgage | null>(null);
  const [schedule, setSchedule] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) loadData(id);
  }, [id]);

  const loadData = async (mortgageId: string) => {
    try {
      setLoading(true);
      setError(null);
      const [m, s] = await Promise.all([
        mortgageService.getMortgageById(mortgageId),
        mortgageService.getRepaymentSchedule(mortgageId),
      ]);
      setMortgage(m);
      setSchedule(s);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load mortgage');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n);

  const formatDate = (d: Date | undefined) =>
    d ? new Intl.DateTimeFormat('en-NG', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(d)) : 'N/A';

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': case 'approved': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <span className="text-gray-500 dark:text-gray-400 text-sm">{label}</span>
      <span className="font-medium text-gray-900 dark:text-white text-sm text-right max-w-[60%]">{value}</span>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin h-10 w-10 border-4 border-[var(--primary-color)] border-t-transparent rounded-full" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading mortgage...</span>
      </div>
    );
  }

  if (error || !mortgage) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 dark:bg-gray-900 gap-4">
        <FiAlertCircle className="w-16 h-16 text-red-400" />
        <p className="text-red-600 dark:text-red-400">{error ?? 'Mortgage not found'}</p>
        <button onClick={() => navigate(-1)} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm">Go Back</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-8">
      {/* Header */}
      <div className="bg-[var(--primary-color)] text-white p-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-white/80 hover:text-white mb-4 text-sm">
          <FiArrowLeft /> Back
        </button>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-white/70 text-sm">Mortgage Application</p>
            <p className="text-white/80 text-sm mt-1">{mortgage.propertyAddress || 'Property'}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(mortgage.status)}`}>
            {mortgage.status.toUpperCase()}
          </span>
        </div>
        <p className="text-4xl font-bold mt-4">{formatCurrency(mortgage.loanAmount)}</p>
        <p className="text-white/70 text-sm mt-1">Loan Amount</p>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">

        {/* Property Details */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Property Details</h2>
          <Row label="Address" value={mortgage.propertyAddress || 'N/A'} />
          <Row label="Property Type" value={mortgage.propertyType || 'N/A'} />
          {mortgage.propertyValue > 0 && <Row label="Property Value" value={formatCurrency(mortgage.propertyValue)} />}
          <Row label="Application Date" value={formatDate(mortgage.applicationDate)} />
          {mortgage.approvalDate && <Row label="Approval Date" value={formatDate(mortgage.approvalDate)} />}
        </div>

        {/* Loan Details */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Loan Details</h2>
          <Row label="Down Payment" value={formatCurrency(mortgage.downPayment)} />
          <Row label="Loan Term" value={`${mortgage.loanTerm} years`} />
          <Row label="Interest Rate" value={`${mortgage.interestRate}%`} />
          {mortgage.description && <Row label="Description" value={mortgage.description} />}
        </div>

        {/* Monthly Payment */}
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Monthly Payment</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">
                {formatCurrency(mortgage.monthlyPayment)}
              </p>
              <p className="text-gray-400 text-xs mt-1">
                Total: {formatCurrency(mortgage.monthlyPayment * mortgage.loanTerm * 12)}
              </p>
            </div>
          </div>
        </div>

        {/* Repayment Schedule */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Repayment Schedule</h2>
          {schedule.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">Schedule available after approval</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">#</th>
                    <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">Due Date</th>
                    <th className="text-right py-2 text-gray-500 dark:text-gray-400 font-medium">Principal</th>
                    <th className="text-right py-2 text-gray-500 dark:text-gray-400 font-medium">Interest</th>
                    <th className="text-right py-2 text-gray-500 dark:text-gray-400 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.slice(0, 12).map((entry, i) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                      <td className="py-2 text-gray-600 dark:text-gray-300">{String(entry.installment_number ?? entry.period ?? i + 1)}</td>
                      <td className="py-2 text-gray-600 dark:text-gray-300">{String(entry.due_date ?? '').substring(0, 10)}</td>
                      <td className="py-2 text-gray-900 dark:text-white text-right">{formatCurrency(Number(entry.principal_amount ?? entry.principal ?? 0))}</td>
                      <td className="py-2 text-gray-900 dark:text-white text-right">{formatCurrency(Number(entry.interest_amount ?? entry.interest ?? 0))}</td>
                      <td className="py-2 text-right">
                        <span className={`text-xs px-2 py-1 rounded-full ${entry.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {String(entry.status ?? 'pending')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {schedule.length > 12 && (
                <p className="text-gray-400 text-xs mt-3">+ {schedule.length - 12} more instalments</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MortgageDetailScreen;
