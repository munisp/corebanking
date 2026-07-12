import React, { useEffect, useState } from 'react';
import { FiCalendar, FiClock, FiCreditCard, FiDollarSign, FiPause, FiPlay, FiPlus, FiRepeat, FiX, FiXCircle } from 'react-icons/fi';
import '../../../App.css';
import { useAuth } from '../../../contexts/AuthContext';
// import { useTheme } from '../../../contexts/ThemeContext';
import type { ScheduledPayment } from '../../../services/scheduled_payment_service';
import { scheduledPaymentService } from '../../../services/scheduled_payment_service';

const ScheduledPaymentsScreen: React.FC = () => {
  const { user } = useAuth();
  // ...existing code...
  const [scheduledPayments, setScheduledPayments] = useState<ScheduledPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // Create form state
  const [recipientName, setRecipientName] = useState('');
  const [recipientAccount, setRecipientAccount] = useState('');
  const [recipientBank, setRecipientBank] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<ScheduledPayment['frequency']>('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    loadScheduledPayments();
  }, []);

  const loadScheduledPayments = async () => {
    try {
      setLoading(true);
      const data = await scheduledPaymentService.getScheduledPayments();
      setScheduledPayments(data);
    } catch (error) {
      console.error('Failed to load scheduled payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateScheduledPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setCreateLoading(true);
      const result = await scheduledPaymentService.createScheduledPayment({
        accountId: user.id,
        recipientName,
        recipientAccount,
        recipientBank,
        amount: parseFloat(amount),
        frequency,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : undefined,
        description,
      });

      if (result.success) {
        alert(result.message);
        setShowCreateModal(false);
        loadScheduledPayments();
        // Reset form
        setRecipientName('');
        setRecipientAccount('');
        setRecipientBank('');
        setAmount('');
        setFrequency('monthly');
        setStartDate('');
        setEndDate('');
        setDescription('');
      } else {
        alert(result.message);
      }
    } catch {
      alert('Failed to create scheduled payment');
    } finally {
      setCreateLoading(false);
    }
  };

  const handlePausePayment = async (paymentId: string) => {
    try {
      const result = await scheduledPaymentService.pauseScheduledPayment(paymentId);
      if (result.success) {
        alert(result.message);
        loadScheduledPayments();
      } else {
        alert(result.message);
      }
    } catch {
      alert('Failed to pause payment');
    }
  };

  const handleResumePayment = async (paymentId: string) => {
    try {
      const result = await scheduledPaymentService.resumeScheduledPayment(paymentId);
      if (result.success) {
        alert(result.message);
        loadScheduledPayments();
      } else {
        alert(result.message);
      }
    } catch {
      alert('Failed to resume payment');
    }
  };

  const handleCancelPayment = async (paymentId: string) => {
    if (!window.confirm('Are you sure you want to cancel this scheduled payment?')) return;

    try {
      const result = await scheduledPaymentService.cancelScheduledPayment(paymentId);
      if (result.success) {
        alert(result.message);
        loadScheduledPayments();
      } else {
        alert(result.message);
      }
    } catch {
      alert('Failed to cancel payment');
    }
  };

  const getStatusColor = (status: ScheduledPayment['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'paused':
        return 'bg-orange-500';
      case 'completed':
        return 'bg-[var(--primary-color)]';
      case 'cancelled':
        return 'bg-gray-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getFrequencyIcon = () => <FiRepeat size={20} />;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 dark:border-gray-700 border-t-[var(--primary-color)] mx-auto mb-4"></div>
          <p className="text-lg font-medium text-gray-600 dark:text-gray-400">Loading scheduled payments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Scheduled Payments</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Automate your recurring payments</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-2 px-6 py-3 rounded-lg shadow-md hover:shadow-lg transition-shadow"
          >
            <FiPlus size={20} />
            Schedule Payment
          </button>
        </div>

        {/* Payments Grid */}
        {scheduledPayments.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
            <FiCalendar size={64} className="mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No scheduled payments</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Schedule a payment to automate recurring transfers</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-lg"
            >
              <FiPlus size={20} />
              Schedule Payment
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {scheduledPayments.map((payment) => (
              <div
                key={payment.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-shadow overflow-hidden"
              >
                {/* Card Header */}
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 p-6 text-white">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-white/20 p-3 rounded-lg">
                        {getFrequencyIcon()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{payment.recipientName}</h3>
                        <p className="text-purple-100 text-sm">{payment.recipientBank}</p>
                      </div>
                    </div>
                    <span className={`${getStatusColor(payment.status)} px-3 py-1 rounded-full text-xs font-bold text-white`}>
                      {payment.status.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="flex items-baseline gap-2">
                    <FiDollarSign size={24} />
                    <p className="text-3xl font-bold">₦{payment.amount.toLocaleString()}</p>
                    <span className="text-purple-100 text-sm ml-2 capitalize">/ {payment.frequency}</span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-6">
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <FiCreditCard size={16} />
                      <span className="text-sm">Account: {payment.recipientAccount}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <FiCalendar size={16} />
                      <span className="text-sm">Next: {new Date(payment.nextExecutionDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <FiClock size={16} />
                      <span className="text-sm">
                        Executions: {payment.executionCount}
                        {payment.maxExecutions && ` / ${payment.maxExecutions}`}
                      </span>
                    </div>
                  </div>

                  {payment.description && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400 italic">{payment.description}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    {payment.status === 'active' && (
                      <button
                        onClick={() => handlePausePayment(payment.id)}
                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                      >
                        <FiPause size={16} />
                        Pause
                      </button>
                    )}
                    {payment.status === 'paused' && (
                      <button
                        onClick={() => handleResumePayment(payment.id)}
                        className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                      >
                        <FiPlay size={16} />
                        Resume
                      </button>
                    )}
                    {(payment.status === 'active' || payment.status === 'paused') && (
                      <button
                        onClick={() => handleCancelPayment(payment.id)}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                      >
                        <FiXCircle size={16} />
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Scheduled Payment Modal */}
        {showCreateModal && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Schedule Payment</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <FiX size={24} />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleCreateScheduledPayment} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Recipient Name
                    </label>
                    <input
                      type="text"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="e.g., John Doe"
                      required
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Account Number
                    </label>
                    <input
                      type="text"
                      value={recipientAccount}
                      onChange={(e) => setRecipientAccount(e.target.value)}
                      placeholder="Enter account number"
                      required
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      value={recipientBank}
                      onChange={(e) => setRecipientBank(e.target.value)}
                      placeholder="e.g., First Bank"
                      required
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">₦</span>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        required
                        min="0"
                        step="0.01"
                        className="w-full pl-8 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent transition-colors"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Frequency
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as ScheduledPayment['frequency'])}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent transition-colors"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {frequency === 'daily' && 'Payment will be made every day'}
                    {frequency === 'weekly' && 'Payment will be made every week'}
                    {frequency === 'monthly' && 'Payment will be made every month'}
                    {frequency === 'yearly' && 'Payment will be made every year'}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      End Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate || new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What is this payment for?"
                    rows={3}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent transition-colors resize-none"
                  />
                </div>

                {/* Modal Footer */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="flex-1 btn-primary py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {createLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Scheduling...
                      </>
                    ) : (
                      <>
                        <FiPlus size={20} />
                        Schedule Payment
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScheduledPaymentsScreen;
