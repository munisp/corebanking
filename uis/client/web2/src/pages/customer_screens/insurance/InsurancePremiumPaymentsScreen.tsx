import React, { useEffect, useState } from 'react';
import { FiArrowLeft, FiCheckCircle, FiClock, FiRefreshCw } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import type { PremiumPayment } from '../../../services/insurance_service';
import { insuranceService } from '../../../services/insurance_service';

const statusColor = (s: string) => {
  if (s === 'paid' || s === 'completed') return 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30';
  if (s === 'pending') return 'text-orange-700 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30';
  if (s === 'failed') return 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30';
  return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-700';
};

const InsurancePremiumPaymentsScreen: React.FC = () => {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<PremiumPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try { setLoading(true); setError(null); setPayments(await insuranceService.getPremiumPayments()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load premium payments'); }
    finally { setLoading(false); }
  };

  const totalPaid = payments.filter(p => p.status === 'paid' || p.status === 'completed').reduce((s, p) => s + p.amount, 0);
  const pending = payments.filter(p => p.status === 'pending').length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-gradient-to-r from-teal-600 to-cyan-700">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <button onClick={() => navigate('/insurance')} className="p-2 hover:bg-white/10 rounded-full">
                <FiArrowLeft className="w-5 h-5 text-white" />
              </button>
              <h1 className="text-2xl font-bold text-white">Premium Payments</h1>
            </div>
            <button onClick={load} className="p-2 hover:bg-white/10 rounded-full"><FiRefreshCw className="w-5 h-5 text-white" /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-white/70 text-sm">Total Paid</p>
              <p className="text-2xl font-bold text-white">{loading ? '—' : `₦${totalPaid.toLocaleString()}`}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-white/70 text-sm">Pending</p>
              <p className="text-2xl font-bold text-white">{loading ? '—' : pending}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {error && <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">{error} <button onClick={load} className="underline ml-2">Retry</button></div>}
        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin h-10 w-10 border-4 border-teal-500 border-t-transparent rounded-full"></div></div>
        ) : payments.length === 0 ? (
          <div className="text-center py-20 text-gray-500 dark:text-gray-400">No premium payments found.</div>
        ) : (
          <div className="space-y-3">
            {payments.map(payment => (
              <div key={payment.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${payment.status === 'paid' || payment.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-orange-100 dark:bg-orange-900/30'}`}>
                    {payment.status === 'paid' || payment.status === 'completed'
                      ? <FiCheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                      : <FiClock className="w-5 h-5 text-orange-600 dark:text-orange-400" />}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">₦{payment.amount.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(payment.payment_date).toLocaleDateString()} · {payment.payment_method}
                    </p>
                    {payment.transaction_reference && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">Ref: {payment.transaction_reference}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${statusColor(payment.status)}`}>{payment.status}</span>
                  {payment.next_payment_date && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Next: {new Date(payment.next_payment_date).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default InsurancePremiumPaymentsScreen;
