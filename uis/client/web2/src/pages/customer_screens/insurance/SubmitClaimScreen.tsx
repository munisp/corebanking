import React, { useEffect, useState } from 'react';
import { FiArrowLeft } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import type { InsurancePolicy } from '../../../services/insurance_service';
import { insuranceService } from '../../../services/insurance_service';

const SubmitClaimScreen: React.FC = () => {
  const navigate = useNavigate();
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [loadingPolicies, setLoadingPolicies] = useState(true);
  const [selectedPolicyId, setSelectedPolicyId] = useState('');
  const [claimAmount, setClaimAmount] = useState('');
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    insuranceService.getMyPolicies()
      .then(data => setPolicies(data.filter(p => p.status === 'active')))
      .catch(() => {/* non-fatal */})
      .finally(() => setLoadingPolicies(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedPolicyId) { setError('Please select a policy'); return; }
    if (!claimAmount || parseFloat(claimAmount) <= 0) { setError('Enter a valid claim amount'); return; }
    if (!description.trim()) { setError('Please describe the incident'); return; }

    setSubmitting(true);
    try {
      await insuranceService.submitClaim({
        policy_id: selectedPolicyId,
        claim_amount: parseFloat(claimAmount),
        incident_date: incidentDate,
        incident_description: description,
      });
      navigate('/insurance/claims');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit claim');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-gradient-to-r from-rose-600 to-red-700">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-3">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full">
              <FiArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">Submit a Claim</h1>
              <p className="text-white/70 text-sm">Report an incident and request coverage</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Claim Details</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Policy</label>
              {loadingPolicies ? (
                <div className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-400 text-sm">Loading policies...</div>
              ) : (
                <select value={selectedPolicyId} onChange={e => setSelectedPolicyId(e.target.value)} required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500">
                  <option value="">— Select a policy —</option>
                  {policies.map(p => (
                    <option key={p.id} value={p.id}>{p.display_name || p.policy_type} (Active)</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Claim Amount (₦)</label>
              <input type="number" value={claimAmount} onChange={e => setClaimAmount(e.target.value)}
                required min="0" step="0.01" placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Incident Date</label>
              <input type="date" value={incidentDate} onChange={e => setIncidentDate(e.target.value)} required
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Incident Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} required rows={4}
                placeholder="Describe what happened in detail..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none" />
            </div>
          </div>

          <button type="submit" disabled={submitting}
            className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold text-lg disabled:opacity-50 transition-colors">
            {submitting ? 'Submitting...' : 'Submit Claim'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SubmitClaimScreen;
