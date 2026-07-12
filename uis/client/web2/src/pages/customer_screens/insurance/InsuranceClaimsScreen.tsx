import React, { useEffect, useState } from 'react';
import { FiArrowLeft, FiPlus, FiRefreshCw } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import type { InsuranceClaim } from '../../../services/insurance_service';
import { insuranceService } from '../../../services/insurance_service';

const statusColor = (s: string) => {
  if (s === 'approved') return 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30';
  if (s === 'pending') return 'text-orange-700 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30';
  if (s === 'under_review') return 'text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30';
  if (s === 'rejected') return 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30';
  return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-700';
};

const InsuranceClaimsScreen: React.FC = () => {
  const navigate = useNavigate();
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try { setLoading(true); setError(null); setClaims(await insuranceService.getClaims()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load claims'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-gradient-to-r from-rose-600 to-red-700">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button onClick={() => navigate('/insurance')} className="p-2 hover:bg-white/10 rounded-full">
                <FiArrowLeft className="w-5 h-5 text-white" />
              </button>
              <h1 className="text-2xl font-bold text-white">My Claims</h1>
            </div>
            <div className="flex items-center space-x-2">
              <button onClick={load} className="p-2 hover:bg-white/10 rounded-full"><FiRefreshCw className="w-5 h-5 text-white" /></button>
              <button onClick={() => navigate('/insurance/submit-claim')} className="flex items-center space-x-2 px-4 py-2 bg-white text-rose-700 rounded-lg hover:bg-gray-100 font-semibold text-sm">
                <FiPlus className="w-4 h-4" /><span>New Claim</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {error && <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">{error} <button onClick={load} className="underline ml-2">Retry</button></div>}
        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin h-10 w-10 border-4 border-rose-500 border-t-transparent rounded-full"></div></div>
        ) : claims.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-5xl mb-4">📋</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Claims Yet</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Submit a claim when you need to use your insurance</p>
            <button onClick={() => navigate('/insurance/submit-claim')} className="flex items-center space-x-2 px-6 py-3 bg-rose-600 text-white rounded-lg hover:bg-rose-700">
              <FiPlus className="w-4 h-4" /><span>Submit a Claim</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {claims.map(claim => (
              <div key={claim.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white">₦{claim.claim_amount.toLocaleString()}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Policy: {claim.policy_id}</p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-semibold ${statusColor(claim.status)}`}>{claim.status.replace('_', ' ')}</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{claim.incident_description}</p>
                <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                  <span>Incident: {new Date(claim.incident_date).toLocaleDateString()}</span>
                  <span>Submitted: {new Date(claim.created_at).toLocaleDateString()}</span>
                </div>
                {claim.rejection_reason && (
                  <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-xs text-red-700 dark:text-red-400">Rejection reason: {claim.rejection_reason}</p>
                  </div>
                )}
                {claim.approval_date && (
                  <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-xs text-green-700 dark:text-green-400">Approved on: {new Date(claim.approval_date).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default InsuranceClaimsScreen;
