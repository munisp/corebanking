import React, { useEffect, useState } from 'react';
import { agricultureService } from '../../../../services/agriculture_service';

const statusLabels = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Disbursed', value: 'disbursed' },
  { label: 'Repaying', value: 'repaying' },
  { label: 'Completed', value: 'completed' },
  { label: 'Defaulted', value: 'defaulted' },
];

const AgriLoansScreen: React.FC = () => {
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [selectedLoan, setSelectedLoan] = useState<any | null>(null);

  useEffect(() => {
    loadLoans();
    // eslint-disable-next-line
  }, [status]);

  const loadLoans = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await agricultureService.getLoans?.({ status: status || undefined });
      setLoans(data || []);
    } catch (e) {
      setError((e as Error).message || 'Failed to load loans');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `₦${(amount / 1000000).toFixed(1)}M`;
    return `₦${amount.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto py-8 px-4">
        <h1 className="text-xl font-bold mb-4">Agriculture Loans</h1>
        <div className="mb-4 flex gap-2 overflow-x-auto">
          {statusLabels.map(s => (
            <button
              key={s.value}
              className={`px-3 py-1 rounded-full border ${status === s.value ? 'bg-green-600 text-white' : 'bg-white text-gray-700'}`}
              onClick={() => setStatus(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
        {loading && <div className="py-8 text-center">Loading...</div>}
        {error && <div className="py-8 text-center text-red-600">{error}</div>}
        {!loading && !error && loans.length === 0 && (
          <div className="py-8 text-center text-gray-500">No agriculture loans found</div>
        )}
        <div className="space-y-4">
          {loans.map(loan => (
            <div
              key={loan.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-pointer border border-green-100 hover:border-green-400"
              onClick={() => setSelectedLoan(loan)}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-lg">{loan.cropType || '-'}</span>
                <span className={`text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700`}>{loan.status?.toUpperCase()}</span>
              </div>
              <div className="text-xs text-gray-500 mb-1">Loan Amount: {formatCurrency(loan.loanAmount || 0)}</div>
              <div className="text-xs text-gray-500">Farmer Name: {loan.farmerName}</div>
              <div className="text-xs text-gray-500">Farm Size: {loan.farmSize}</div>
            </div>
          ))}
        </div>
        {selectedLoan && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 w-full max-w-md relative">
              <button className="absolute top-2 right-2 text-gray-500" onClick={() => setSelectedLoan(null)}>&times;</button>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><span>Loan Details</span></h2>
              <div className="space-y-2">
                <div><span className="font-semibold">Loan ID:</span> {selectedLoan.id}</div>
                <div><span className="font-semibold">Crop Type:</span> {selectedLoan.cropType}</div>
                <div><span className="font-semibold">Farmer Name:</span> {selectedLoan.farmerName}</div>
                <div><span className="font-semibold">Farm Size:</span> {selectedLoan.farmSize}</div>
                <div><span className="font-semibold">Loan Amount:</span> {formatCurrency(selectedLoan.loanAmount || 0)}</div>
                <div><span className="font-semibold">Interest Rate:</span> {selectedLoan.interestRate}%</div>
                <div><span className="font-semibold">Status:</span> {selectedLoan.status}</div>
                <div><span className="font-semibold">Disbursement Date:</span> {selectedLoan.disbursementDate ? new Date(selectedLoan.disbursementDate).toLocaleDateString() : '-'}</div>
                <div><span className="font-semibold">Application Date:</span> {selectedLoan.applicationDate ? new Date(selectedLoan.applicationDate).toLocaleDateString() : '-'}</div>
              </div>
              <div className="mt-6 text-right">
                <button className="px-4 py-2 bg-green-600 text-white rounded" onClick={() => setSelectedLoan(null)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgriLoansScreen;
