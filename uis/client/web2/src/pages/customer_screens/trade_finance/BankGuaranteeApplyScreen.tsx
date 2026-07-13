import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiChevronRight } from 'react-icons/fi';
import { tradeFinanceService } from '../../../services/trade_finance_service';

const BG_TYPES = ['performance', 'payment', 'bid_bond', 'advance_payment'];
const CURRENCIES = ['NGN', 'USD', 'EUR', 'GBP'];

function titleCase(s: string): string {
  return s.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const BankGuaranteeApplyScreen: React.FC = () => {
  const navigate = useNavigate();

  const [bgType, setBgType] = useState('performance');
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [expiryDate, setExpiryDate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const validate = () => {
    if (!beneficiaryName.trim()) return 'Enter beneficiary name';
    const n = parseFloat(amount);
    if (!amount || isNaN(n) || n <= 0) return 'Enter a valid amount';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }

    setLoading(true);
    setError(null);

    const data: Record<string, any> = {
      type: bgType,
      beneficiary_name: beneficiaryName.trim(),
      amount: parseFloat(amount),
      currency,
    };
    if (expiryDate) data.expiry_date = expiryDate;
    if (purpose.trim()) data.purpose = purpose.trim();

    const result = await tradeFinanceService.createBankGuarantee(data);
    setLoading(false);
    if (result.success) {
      setSuccess(true);
      setTimeout(() => navigate('/trade-finance/bank-guarantees'), 1500);
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
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Request Bank Guarantee</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-5 max-w-2xl mx-auto pb-10">
        {/* Guarantee Details */}
        <Section title="Guarantee Details">
          <FormField label="Guarantee Type *">
            <select value={bgType} onChange={e => setBgType(e.target.value)} className={selectCls('#0369A1')}>
              {BG_TYPES.map(t => <option key={t} value={t}>{titleCase(t)}</option>)}
            </select>
          </FormField>

          <FormField label="Beneficiary Name *">
            <input
              type="text"
              value={beneficiaryName}
              onChange={e => setBeneficiaryName(e.target.value)}
              placeholder="Enter beneficiary name"
              className={inputCls('#0369A1')}
            />
          </FormField>
        </Section>

        {/* Financial Terms */}
        <Section title="Financial Terms">
          <div className="flex gap-3">
            <FormField label="Amount *" className="flex-1">
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className={inputCls('#0369A1')}
              />
            </FormField>
            <FormField label="Currency *" className="w-28">
              <select value={currency} onChange={e => setCurrency(e.target.value)} className={selectCls('#0369A1')}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </FormField>
          </div>

          <FormField label="Expiry Date (optional)">
            <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className={inputCls('#0369A1')} />
          </FormField>
        </Section>

        {/* Purpose */}
        <Section title="Purpose">
          <FormField label="Purpose / Description (optional)">
            <textarea
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              placeholder="Describe the purpose of this guarantee..."
              rows={3}
              className={`${inputCls('#0369A1')} resize-none`}
            />
          </FormField>
        </Section>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-sm border border-blue-200 dark:border-blue-800">
            Bank guarantee request submitted! Redirecting…
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 rounded-xl text-white font-bold text-base flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#0369A1' }}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            'Submit Request'
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

const inputCls = (accent: string) =>
  `w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent text-sm`;

const selectCls = (accent: string) =>
  `w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 text-sm appearance-none`;

export default BankGuaranteeApplyScreen;
