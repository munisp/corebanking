import React, { useState } from 'react';
import { FiArrowLeft, FiHome, FiPercent, FiTrendingUp } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const MortgageCalculatorScreen: React.FC = () => {
  const navigate = useNavigate();
  const [propertyValue, setPropertyValue] = useState('');
  const [downPayment, setDownPayment] = useState('');
  const [interestRate, setInterestRate] = useState('12.5');
  const [loanTerm, setLoanTerm] = useState(20);
  const [result, setResult] = useState<{
    loanAmount: number;
    monthlyPayment: number;
    totalPayment: number;
    totalInterest: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const pv = parseFloat(propertyValue.replace(/,/g, ''));
    const dp = parseFloat(downPayment.replace(/,/g, ''));
    const rate = parseFloat(interestRate);

    if (!pv || !dp || !rate) { setError('Please fill in all fields with valid numbers'); return; }
    if (dp >= pv) { setError('Down payment must be less than property value'); return; }
    if (rate <= 0 || rate > 100) { setError('Interest rate must be between 0 and 100'); return; }

    const principal = pv - dp;
    const monthlyRate = rate / 100 / 12;
    const n = loanTerm * 12;
    const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
    const totalPayment = monthlyPayment * n;

    setResult({
      loanAmount: principal,
      monthlyPayment,
      totalPayment,
      totalInterest: totalPayment - principal,
    });
  };

  const fmt = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`;

  const terms = [5, 10, 15, 20, 25, 30];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-3">
            <button onClick={() => navigate('/mortgage')} className="p-2 hover:bg-white/10 rounded-full">
              <FiArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">Mortgage Calculator</h1>
              <p className="text-white/70 text-sm">Estimate your monthly payments</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Form */}
        <form onSubmit={calculate} className="space-y-5">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Property Details</h2>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">{error}</div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <FiHome className="inline w-4 h-4 mr-1" />Property Value (₦)
              </label>
              <input type="number" value={propertyValue} onChange={e => setPropertyValue(e.target.value)}
                required min="0" placeholder="e.g. 45000000"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Down Payment (₦)</label>
              <input type="number" value={downPayment} onChange={e => setDownPayment(e.target.value)}
                required min="0" placeholder="e.g. 9000000"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {propertyValue && downPayment && parseFloat(propertyValue) > 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {((parseFloat(downPayment) / parseFloat(propertyValue)) * 100).toFixed(1)}% of property value
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <FiPercent className="inline w-4 h-4 mr-1" />Annual Interest Rate (%)
              </label>
              <input type="number" value={interestRate} onChange={e => setInterestRate(e.target.value)}
                required min="0.1" max="100" step="0.1"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Loan Term</label>
              <div className="grid grid-cols-3 gap-2">
                {terms.map(t => (
                  <button key={t} type="button" onClick={() => setLoanTerm(t)}
                    className={`py-2 rounded-lg text-sm font-medium transition-colors ${loanTerm === t ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                    {t} yrs
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button type="submit"
            className="w-full py-4 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-semibold text-lg transition-colors">
            Calculate
          </button>
        </form>

        {/* Results */}
        {result && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-5 text-center">
              <p className="text-white/80 text-sm mb-1">Monthly Payment</p>
              <p className="text-4xl font-bold text-white">{fmt(result.monthlyPayment)}</p>
            </div>
            <div className="p-5 space-y-0">
              {[
                { label: 'Loan Amount', value: fmt(result.loanAmount), icon: '🏠' },
                { label: 'Total Payment', value: fmt(result.totalPayment), icon: '💰' },
                { label: 'Total Interest', value: fmt(result.totalInterest), icon: '📈' },
                { label: 'Loan Term', value: `${loanTerm} years (${loanTerm * 12} months)`, icon: '📅' },
              ].map((row, i, arr) => (
                <div key={row.label} className={`flex items-center justify-between py-3 ${i < arr.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''}`}>
                  <div className="flex items-center space-x-2">
                    <span>{row.icon}</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">{row.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{row.value}</span>
                </div>
              ))}
            </div>

            {/* Interest breakdown bar */}
            <div className="px-5 pb-5">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Payment Breakdown</p>
              <div className="flex rounded-full overflow-hidden h-4">
                <div
                  className="bg-blue-500"
                  style={{ width: `${(result.loanAmount / result.totalPayment) * 100}%` }}
                  title="Principal"
                />
                <div
                  className="bg-orange-400"
                  style={{ width: `${(result.totalInterest / result.totalPayment) * 100}%` }}
                  title="Interest"
                />
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center space-x-1"><span className="w-3 h-3 bg-blue-500 rounded-full inline-block"></span><span>Principal</span></span>
                <span className="flex items-center space-x-1"><span className="w-3 h-3 bg-orange-400 rounded-full inline-block"></span><span>Interest</span></span>
              </div>
            </div>

            <div className="px-5 pb-5">
              <button onClick={() => navigate('/mortgage/apply')}
                className="w-full py-3 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-semibold transition-colors">
                <FiTrendingUp className="w-4 h-4 inline mr-2" />Apply for Mortgage
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MortgageCalculatorScreen;
