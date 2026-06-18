import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiChevronRight, FiInfo } from 'react-icons/fi';
import { tradeFinanceService } from '../../../services/trade_finance_service';

const CURRENCIES = ['NGN', 'USD', 'EUR', 'GBP'];

const FactoringApplyScreen: React.FC = () => {
  const navigate = useNavigate();

  const [debtorName, setDebtorName] = useState('');
  const [invoiceTotal, setInvoiceTotal] = useState('');
  const [factoringAmount, setFactoringAmount] = useState('');
  const [discountRate, setDiscountRate] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const suggestedFactoring = invoiceTotal ? (parseFloat(invoiceTotal) * 0.8).toFixed(2) : null;

  const validate = () => {
    if (!debtorName.trim()) return 'Enter debtor / buyer name';
    const total = parseFloat(invoiceTotal);
    if (!invoiceTotal || isNaN(total) || total <= 0) return 'Enter a valid invoice total';
    const fa = parseFloat(factoringAmount);
    if (!factoringAmount || isNaN(fa) || fa <= 0) return 'Enter a valid factoring amount';
    if (fa > total) return 'Factoring amount cannot exceed invoice total';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }

    setLoading(true);
    setError(null);

    const data: Record<string, any> = {
      debtor_name: debtorName.trim(),
      invoice_total: parseFloat(invoiceTotal),
      factoring_amount: parseFloat(factoringAmount),
      currency,
    };
    const dr = parseFloat(discountRate);
    if (!isNaN(dr) && dr > 0) data.discount_rate = dr;

    const result = await tradeFinanceService.createFactoringApplication(data);
    setLoading(false);
    if (result.success) {
      setSuccess(true);
      setTimeout(() => navigate('/trade-finance/factoring'), 1500);
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* AppBar */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <FiChevronRight className="rotate-180 w-5 h-5 text-gray-700 dark:text-gray-200" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Apply for Export Factoring</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-5 max-w-2xl mx-auto pb-10">
        {/* Info banner */}
        <div
          className="flex items-start gap-3 p-3.5 rounded-2xl"
          style={{ backgroundColor: '#7C3AED0F', border: '1px solid #7C3AED33' }}
        >
          <FiInfo size={18} color="#7C3AED" className="flex-shrink-0 mt-0.5" />
          <p className="text-[12px] text-gray-600 dark:text-gray-400 leading-relaxed">
            Convert your export invoices into immediate cash. Up to 80% of invoice value.
          </p>
        </div>

        {/* Debtor Information */}
        <Section title="Debtor Information">
          <FormField label="Debtor / Buyer Name *">
            <input
              type="text"
              value={debtorName}
              onChange={e => setDebtorName(e.target.value)}
              placeholder="Enter debtor or buyer name"
              className={inputCls}
            />
          </FormField>
        </Section>

        {/* Invoice Details */}
        <Section title="Invoice Details">
          <div className="flex gap-3">
            <FormField label="Invoice Total *" className="flex-1">
              <input
                type="number"
                value={invoiceTotal}
                onChange={e => setInvoiceTotal(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className={inputCls}
              />
            </FormField>
            <FormField label="Currency *" className="w-28">
              <select value={currency} onChange={e => setCurrency(e.target.value)} className={selectCls}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </FormField>
          </div>

          <FormField label={`Factoring Amount *${suggestedFactoring ? ` — Suggested: ${suggestedFactoring} (80%)` : ''}`}>
            <input
              type="number"
              value={factoringAmount}
              onChange={e => setFactoringAmount(e.target.value)}
              placeholder={suggestedFactoring ?? '0.00'}
              min="0"
              step="0.01"
              className={inputCls}
            />
          </FormField>

          <FormField label="Discount Rate % (optional)">
            <input
              type="number"
              value={discountRate}
              onChange={e => setDiscountRate(e.target.value)}
              placeholder="e.g. 2.5"
              min="0"
              step="0.01"
              className={inputCls}
            />
          </FormField>
        </Section>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 text-sm border border-purple-200 dark:border-purple-800">
            Factoring application submitted! Redirecting…
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 rounded-xl text-white font-bold text-base flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#7C3AED' }}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            'Submit Application'
          )}
        </button>
      </form>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 space-y-3 shadow-sm border border-gray-100 dark:border-gray-700">
    <h3 className="text-base font-semibold text-gray-900 dark:text-white pb-1 border-b border-gray-100 dark:border-gray-700">{title}</h3>
    {children}
  </div>
);

const FormField: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
  <div className={`space-y-1.5 ${className ?? ''}`}>
    <label className="text-[13px] font-medium text-gray-600 dark:text-gray-400">{label}</label>
    {children}
  </div>
);

const inputCls = 'w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent text-sm';
const selectCls = 'w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7C3AED] text-sm appearance-none';

export default FactoringApplyScreen;
