import { useState } from 'react';
import { FiArrowLeft, FiPlus, FiSend, FiTrash2, FiX } from 'react-icons/fi';
import { usePageTitle } from '../../../hooks/usePageTitle';

interface TransferRow {
  id: number;
  accountNumber: string;
  accountName: string;
  bankCode: string;
  amount: string;
  narration: string;
}

interface BatchResult {
  batch_id: string;
  total: number;
  succeeded: number;
  failed: number;
  success_rate_pct: number;
  results: Array<{ index: number; status: string; response?: any; error?: string }>;
}

let _rowId = 0;
const newRow = (): TransferRow => ({
  id: ++_rowId,
  accountNumber: '',
  accountName: '',
  bankCode: '',
  amount: '',
  narration: '',
});

export default function BulkTransferScreen() {
  usePageTitle('Bulk Transfer');

  const [rows, setRows] = useState<TransferRow[]>([newRow()]);
  const [pin, setPin] = useState('');
  const [batchLabel, setBatchLabel] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [error, setError] = useState('');

  const totalAmount = rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  const updateRow = (id: number, field: keyof TransferRow, value: string) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));

  const removeRow = (id: number) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));

  const validate = () => {
    if (!pin || pin.length < 4) return 'Enter your 4-digit PIN.';
    for (const r of rows) {
      if (!r.accountNumber) return 'All rows need an account number.';
      if (!r.amount || parseFloat(r.amount) <= 0) return 'All rows need a valid amount.';
      if (!r.narration) return 'All rows need a narration.';
    }
    return '';
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setIsProcessing(true);
    setShowConfirm(false);

    try {
      const { paymentService } = await import('../../../services/payment_service');
      const res = await paymentService.bulkPayment({
        batchId: batchLabel || undefined,
        pin,
        transfers: rows.map((r) => ({
          accountNumber: r.accountNumber,
          amount: r.amount,
          narration: r.narration,
          accountName: r.accountName || undefined,
          bankCode: r.bankCode || undefined,
        })),
      });

      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setError(res.message);
      }
    } catch (e: any) {
      setError(e.message || 'Unexpected error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setRows([newRow()]);
    setPin('');
    setBatchLabel('');
    setResult(null);
    setError('');
  };

  // ── Results screen ───────────────────────────────────────────────────
  if (result) {
    return (
      <div className="w-full min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-6 md:px-8">
        <div className="max-w-2xl mx-auto space-y-5">
          <div className="flex items-center gap-2 mb-4">
            <button onClick={handleReset} className="text-gray-900 dark:text-white">
              <FiArrowLeft size={20} />
            </button>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Batch Results</h1>
          </div>

          {/* Summary */}
          <div className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))' }}>
            <p className="text-sm text-white/80 mb-1">Batch ID: {result.batch_id}</p>
            <div className="flex justify-between text-sm mt-3">
              <div className="text-center">
                <p className="text-2xl font-bold">{result.total}</p>
                <p className="text-white/80">Total</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-300">{result.succeeded}</p>
                <p className="text-white/80">Passed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-300">{result.failed}</p>
                <p className="text-white/80">Failed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{result.success_rate_pct.toFixed(0)}%</p>
                <p className="text-white/80">Success</p>
              </div>
            </div>
          </div>

          {/* Per-item results */}
          <div className="space-y-3">
            {result.results.map((item, i) => {
              const row = rows[item.index];
              return (
                <div key={i} className={`rounded-xl p-4 border ${
                  item.status === 'success'
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800'
                }`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">
                        {row?.accountNumber || `Row ${item.index + 1}`}
                      </p>
                      {row && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          ₦{parseFloat(row.amount).toLocaleString()} · {row.narration}
                        </p>
                      )}
                      {item.error && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">{item.error}</p>
                      )}
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      item.status === 'success'
                        ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
                        : 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={handleReset}
            className="w-full py-4 rounded-lg text-lg font-semibold text-white hover:opacity-90 transition"
            style={{ backgroundColor: 'var(--primary-color)' }}
          >
            New Batch
          </button>
        </div>
      </div>
    );
  }

  // ── Main form ────────────────────────────────────────────────────────
  return (
    <div className="w-full min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-6 md:px-8">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => history.back()} className="text-gray-900 dark:text-white">
            <FiArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Bulk Transfer</h1>
        </div>

        {/* Banner */}
        <div className="p-6 rounded-2xl shadow-md text-white" style={{ background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))' }}>
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-xl">
              <FiSend size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Bulk Transfer</h2>
              <p className="text-white/80 text-sm">Send to multiple accounts at once</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/20 flex justify-between text-sm">
            <span className="text-white/80">{rows.length} recipient{rows.length !== 1 ? 's' : ''}</span>
            <span className="font-semibold">₦{totalAmount.toLocaleString()}</span>
          </div>
        </div>

        {/* Batch label */}
        <div>
          <label className="font-medium text-gray-700 dark:text-gray-300">Batch Label (Optional)</label>
          <input
            className="mt-1 w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 dark:text-white"
            value={batchLabel}
            onChange={(e) => setBatchLabel(e.target.value)}
            placeholder="e.g. June Salaries"
          />
        </div>

        {/* Recipients */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="font-medium text-gray-700 dark:text-gray-300">Recipients</label>
            <button
              onClick={() => setRows((prev) => [...prev, newRow()])}
              className="flex items-center gap-1 text-sm font-semibold px-3 py-1.5 rounded-lg text-white"
              style={{ backgroundColor: 'var(--primary-color)' }}
            >
              <FiPlus size={14} /> Add Row
            </button>
          </div>

          <div className="space-y-4">
            {rows.map((row, idx) => (
              <div key={row.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">#{idx + 1}</span>
                  {rows.length > 1 && (
                    <button onClick={() => removeRow(row.id)} className="text-red-500 hover:text-red-700">
                      <FiTrash2 size={16} />
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  <input
                    className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white text-sm"
                    placeholder="Account number *"
                    value={row.accountNumber}
                    maxLength={10}
                    onChange={(e) => updateRow(row.id, 'accountNumber', e.target.value.replace(/\D/g, ''))}
                  />
                  <input
                    className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white text-sm"
                    placeholder="Account name (optional)"
                    value={row.accountName}
                    onChange={(e) => updateRow(row.id, 'accountName', e.target.value)}
                  />
                  <div className="flex gap-2">
                    <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 bg-gray-50 dark:bg-gray-700 flex-1">
                      <span className="text-gray-500 dark:text-gray-400 text-sm">₦</span>
                      <input
                        className="ml-1 w-full p-2 bg-transparent dark:text-white text-sm outline-none"
                        placeholder="Amount *"
                        value={row.amount}
                        onChange={(e) => updateRow(row.id, 'amount', e.target.value.replace(/[^\d.]/g, ''))}
                      />
                    </div>
                    <input
                      className="w-28 p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white text-sm"
                      placeholder="Bank code"
                      value={row.bankCode}
                      onChange={(e) => updateRow(row.id, 'bankCode', e.target.value)}
                    />
                  </div>
                  <input
                    className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white text-sm"
                    placeholder="Narration *"
                    value={row.narration}
                    onChange={(e) => updateRow(row.id, 'narration', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PIN */}
        <div>
          <label className="font-medium text-gray-700 dark:text-gray-300">PIN *</label>
          <input
            type="password"
            maxLength={4}
            className="mt-1 w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 dark:text-white"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="Enter 4-digit PIN"
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <button
          className="w-full py-4 rounded-lg text-lg font-semibold text-white hover:opacity-90 transition"
          style={{ backgroundColor: 'var(--primary-color)' }}
          onClick={() => { const e = validate(); if (e) { setError(e); } else { setError(''); setShowConfirm(true); } }}
        >
          Review & Send
        </button>
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold" style={{ color: 'var(--primary-color)' }}>Confirm Batch</h2>
              <button onClick={() => setShowConfirm(false)}>
                <FiX size={20} className="text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <div className="space-y-2 text-sm mb-5 max-h-60 overflow-y-auto">
              {rows.map((r, i) => (
                <div key={r.id} className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">
                    {r.accountName || r.accountNumber}
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">({r.narration})</span>
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">₦{parseFloat(r.amount).toLocaleString()}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between font-semibold text-gray-900 dark:text-white mb-5">
              <span>Total ({rows.length} transfers)</span>
              <span>₦{totalAmount.toLocaleString()}</span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isProcessing}
                className="flex-1 py-3 rounded-lg text-white font-semibold hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: 'var(--primary-color)' }}
              >
                {isProcessing ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent animate-spin rounded-full mx-auto" />
                ) : 'Send Batch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
