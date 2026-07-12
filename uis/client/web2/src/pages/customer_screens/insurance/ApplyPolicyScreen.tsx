import React, { useState } from 'react';
import { FiArrowLeft, FiPlus, FiTrash2 } from 'react-icons/fi';
import { useLocation, useNavigate } from 'react-router-dom';
import type { InsuranceTemplate } from '../../../services/insurance_service';
import { insuranceService } from '../../../services/insurance_service';

const POLICY_TYPES = [
  { value: 'health', label: 'Health', icon: '🏥' },
  { value: 'life', label: 'Life', icon: '❤️' },
  { value: 'auto', label: 'Auto', icon: '🚗' },
  { value: 'travel', label: 'Travel', icon: '✈️' },
  { value: 'crop', label: 'Crop', icon: '🌾' },
  { value: 'flight', label: 'Flight', icon: '🛫' },
];

const ApplyPolicyScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const template = location.state?.template as InsuranceTemplate | undefined;

  const [policyType, setPolicyType] = useState(template ? template.insurance_type : 'health');
  const [coverageAmount, setCoverageAmount] = useState(template ? String(template.coverage_amount) : '');
  const [durationMonths, setDurationMonths] = useState(template ? String(template.duration_months) : '');
  const [beneficiaries, setBeneficiaries] = useState<string[]>(['']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addBeneficiary = () => setBeneficiaries(prev => [...prev, '']);
  const removeBeneficiary = (i: number) => setBeneficiaries(prev => prev.filter((_, idx) => idx !== i));
  const updateBeneficiary = (i: number, val: string) =>
    setBeneficiaries(prev => prev.map((b, idx) => (idx === i ? val : b)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const filledBeneficiaries = beneficiaries.filter(b => b.trim());
    if (!coverageAmount || parseFloat(coverageAmount) <= 0) { setError('Enter a valid coverage amount'); return; }
    if (!durationMonths || parseInt(durationMonths) <= 0) { setError('Enter a valid duration'); return; }

    setSubmitting(true);
    try {
      await insuranceService.applyForPolicy({
        policy_type: policyType,
        coverage_amount: parseFloat(coverageAmount),
        duration_months: parseInt(durationMonths),
        beneficiaries: filledBeneficiaries,
        template_id: template?.id,
      });
      navigate('/insurance/my-policies');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedType = POLICY_TYPES.find(t => t.value === policyType);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-3">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full">
              <FiArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">Apply for Policy</h1>
              {template && <p className="text-white/70 text-sm">{template.display_name}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Policy Type */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Policy Type</h2>
            <div className="grid grid-cols-3 gap-3">
              {POLICY_TYPES.map(type => (
                <button key={type.value} type="button" onClick={() => setPolicyType(type.value)}
                  className={`flex flex-col items-center p-3 rounded-lg border-2 transition-colors ${policyType === type.value ? 'border-[var(--primary-color)] bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'}`}>
                  <span className="text-2xl mb-1">{type.icon}</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Coverage & Duration */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Coverage Details</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Coverage Amount (₦)</label>
              <input type="number" value={coverageAmount} onChange={e => setCoverageAmount(e.target.value)}
                required min="0" step="1000" placeholder="e.g. 5000000"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration (months)</label>
              <input type="number" value={durationMonths} onChange={e => setDurationMonths(e.target.value)}
                required min="1" max="120" placeholder="e.g. 12"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]" />
            </div>
          </div>

          {/* Beneficiaries */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 dark:text-white">Beneficiaries <span className="text-gray-400 font-normal text-sm">(optional)</span></h2>
              <button type="button" onClick={addBeneficiary} className="flex items-center space-x-1 text-sm text-[var(--primary-color)] hover:opacity-80">
                <FiPlus className="w-4 h-4" /><span>Add</span>
              </button>
            </div>
            <div className="space-y-2">
              {beneficiaries.map((b, i) => (
                <div key={i} className="flex items-center space-x-2">
                  <input value={b} onChange={e => updateBeneficiary(i, e.target.value)}
                    placeholder={`Beneficiary ${i + 1} name`}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]" />
                  {beneficiaries.length > 1 && (
                    <button type="button" onClick={() => removeBeneficiary(i)} className="p-2 text-red-500 hover:text-red-700">
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          {coverageAmount && durationMonths && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Summary</h3>
              <div className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
                <p>Type: <strong>{selectedType?.label} Insurance</strong></p>
                <p>Coverage: <strong>₦{parseFloat(coverageAmount || '0').toLocaleString()}</strong></p>
                <p>Duration: <strong>{durationMonths} months</strong></p>
              </div>
            </div>
          )}

          <button type="submit" disabled={submitting}
            className="w-full py-4 bg-[var(--primary-color)] text-white rounded-xl font-semibold text-lg hover:opacity-90 disabled:opacity-50 transition-opacity">
            {submitting ? 'Submitting...' : 'Submit Application'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ApplyPolicyScreen;
