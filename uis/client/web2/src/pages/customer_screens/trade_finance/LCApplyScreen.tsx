import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiChevronRight } from 'react-icons/fi';
import { tradeFinanceService } from '../../../services/trade_finance_service';

const LC_TYPES = ['irrevocable', 'revocable', 'standby', 'confirmed'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'NGN', 'CNY'];
const AVAILABLE_BY = ['sight', 'deferred', 'acceptance', 'negotiation'];

const LCApplyScreen: React.FC = () => {
  const navigate = useNavigate();

  const [type, setType] = useState('irrevocable');
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [beneficiaryCountry, setBeneficiaryCountry] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [availableBy, setAvailableBy] = useState('sight');
  const [expiryDate, setExpiryDate] = useState('');
  const [placeOfExpiry, setPlaceOfExpiry] = useState('');
  const [goodsDescription, setGoodsDescription] = useState('');
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
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    setError(null);

    const data: Record<string, any> = {
      type,
      beneficiary_name: beneficiaryName.trim(),
      amount: parseFloat(amount),
      currency,
      available_by: availableBy,
    };
    if (beneficiaryCountry.trim()) data.beneficiary_country = beneficiaryCountry.trim();
    if (expiryDate) data.expiry_date = expiryDate;
    if (placeOfExpiry.trim()) data.place_of_expiry = placeOfExpiry.trim();
    if (goodsDescription.trim()) data.goods_description = goodsDescription.trim();

    const result = await tradeFinanceService.createLC(data);
    setLoading(false);
    if (result.success) {
      setSuccess(true);
      setTimeout(() => navigate('/trade-finance/lc'), 1500);
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
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Apply for Letter of Credit</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-5 max-w-2xl mx-auto pb-10">
        {/* LC Details */}
        <Section title="LC Details">
          <FormField label="LC Type *">
            <select value={type} onChange={e => setType(e.target.value)} className={selectCls}>
              {LC_TYPES.map(t => <option key={t} value={t}>{capitalize(t)}</option>)}
            </select>
          </FormField>

          <FormField label="Beneficiary Name *">
            <input
              type="text"
              value={beneficiaryName}
              onChange={e => setBeneficiaryName(e.target.value)}
              placeholder="Enter beneficiary name"
              className={inputCls}
            />
          </FormField>

          <FormField label="Beneficiary Country (optional)">
            <input
              type="text"
              value={beneficiaryCountry}
              onChange={e => setBeneficiaryCountry(e.target.value)}
              placeholder="e.g. United States"
              className={inputCls}
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
                className={inputCls}
              />
            </FormField>
            <FormField label="Currency *" className="w-28">
              <select value={currency} onChange={e => setCurrency(e.target.value)} className={selectCls}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </FormField>
          </div>

          <FormField label="Available By *">
            <select value={availableBy} onChange={e => setAvailableBy(e.target.value)} className={selectCls}>
              {AVAILABLE_BY.map(o => <option key={o} value={o}>{capitalize(o)}</option>)}
            </select>
          </FormField>

          <FormField label="Expiry Date (optional)">
            <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className={inputCls} />
          </FormField>

          <FormField label="Place of Expiry (optional)">
            <input
              type="text"
              value={placeOfExpiry}
              onChange={e => setPlaceOfExpiry(e.target.value)}
              placeholder="e.g. Lagos, Nigeria"
              className={inputCls}
            />
          </FormField>
        </Section>

        {/* Goods & Documents */}
        <Section title="Goods & Documents">
          <FormField label="Goods Description (optional)">
            <textarea
              value={goodsDescription}
              onChange={e => setGoodsDescription(e.target.value)}
              placeholder="Describe the goods being financed..."
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </FormField>
        </Section>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm border border-green-200 dark:border-green-800">
            LC application submitted successfully! Redirecting…
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 rounded-xl text-white font-bold text-base flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#059669' }}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            'Submit LC Application'
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

const inputCls = 'w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#059669] focus:border-transparent text-sm';
const selectCls = 'w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#059669] text-sm appearance-none';

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default LCApplyScreen;
