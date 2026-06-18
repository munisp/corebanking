import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { agricultureService } from '../../../services/agriculture_service';

interface GovProgram {
  program_id: string;
  code: string;
  name: string;
  description: string;
  interest_rate: number;
  max_loan_amount: number;
  eligible_crops: string[];
  is_active: boolean;
  provider?: string;
}

interface EligibilityResult {
  eligible: boolean;
  reason?: string;
  max_amount?: number;
  conditions?: string[];
}

const GovernmentProgramsScreen: React.FC = () => {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<GovProgram[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedProgram, setSelectedProgram] = useState<GovProgram | null>(null);
  const [loanId, setLoanId] = useState('');
  const [eligibilityResult, setEligibilityResult] = useState<EligibilityResult | null>(null);
  const [view, setView] = useState<'list' | 'detail'>('list');

  useEffect(() => {
    fetchPrograms();
  }, []);

  const fetchPrograms = async () => {
    setLoading(true);
    try {
      const data = await agricultureService.getGovernmentPrograms();
      setPrograms(data as unknown as GovProgram[]);
    } catch {
      setError('Failed to load government programs');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckEligibility = async () => {
    if (!selectedProgram || !loanId.trim()) { setError('Enter a loan ID'); return; }
    setSubmitting(true);
    setError('');
    setEligibilityResult(null);
    try {
      const result = await agricultureService.checkProgramEligibility(selectedProgram.code, loanId);
      setEligibilityResult(result as unknown as EligibilityResult);
    } catch {
      setError('Failed to check eligibility');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnroll = async () => {
    if (!selectedProgram || !loanId.trim()) { setError('Enter a loan ID to enroll'); return; }
    if (!eligibilityResult?.eligible) { setError('Check eligibility first'); return; }
    setSubmitting(true);
    setError('');
    try {
      await agricultureService.enrollInProgram(selectedProgram.code, loanId);
      setSuccess(`Successfully enrolled in ${selectedProgram.name}!`);
      setLoanId('');
      setEligibilityResult(null);
      setView('list');
    } catch {
      setError('Failed to enroll in program');
    } finally {
      setSubmitting(false);
    }
  };

  const getProgramEmoji = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('anchor') || n.includes('nirsal')) return '⚓';
    if (n.includes('youth') || n.includes('agric')) return '🌱';
    if (n.includes('cbn') || n.includes('bank')) return '🏦';
    if (n.includes('anchor') || n.includes('out')) return '🔗';
    if (n.includes('fadama') || n.includes('world')) return '🌍';
    return '🏛️';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => view === 'detail' ? setView('list') : navigate('/agriculture')}
            className="text-gray-500 hover:text-gray-700 mr-2"
          >
            ←
          </button>
          <h1 className="text-xl font-bold">
            {view === 'detail' && selectedProgram ? selectedProgram.name : 'Government Programs'}
          </h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg text-sm flex items-center gap-2">
            ✅ {success}
            <button className="ml-auto" onClick={() => setSuccess('')}>✕</button>
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-sm flex items-center gap-2">
            ❌ {error}
            <button className="ml-auto" onClick={() => setError('')}>✕</button>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-10">
            <div className="animate-spin h-10 w-10 border-4 border-green-600 border-t-transparent rounded-full"></div>
          </div>
        )}

        {/* Programs List */}
        {!loading && view === 'list' && (
          <div className="space-y-3">
            {programs.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500">
                <p className="text-4xl mb-3">🏛️</p>
                <p>No government programs available</p>
              </div>
            ) : (
              programs.map((prog, i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => { setSelectedProgram(prog); setView('detail'); setError(''); setEligibilityResult(null); }}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">{getProgramEmoji(prog.name)}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-gray-800 dark:text-white">{prog.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${prog.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {prog.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 font-mono mb-2">{prog.code}</p>
                      {prog.description && <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">{prog.description}</p>}
                      <div className="flex gap-4 text-sm">
                        <div>
                          <p className="text-xs text-gray-500">Interest Rate</p>
                          <p className="font-semibold text-green-600">{prog.interest_rate != null ? `${prog.interest_rate}%` : '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Max Loan</p>
                          <p className="font-semibold">{prog.max_loan_amount ? `₦${prog.max_loan_amount.toLocaleString()}` : '—'}</p>
                        </div>
                      </div>
                    </div>
                    <span className="text-gray-400">›</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Program Detail + Enrollment */}
        {!loading && view === 'detail' && selectedProgram && (
          <div className="space-y-4">
            {/* Info Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-4xl">{getProgramEmoji(selectedProgram.name)}</span>
                <div>
                  <h2 className="font-bold text-gray-800 dark:text-white">{selectedProgram.name}</h2>
                  <p className="text-xs text-gray-500 font-mono">{selectedProgram.code}</p>
                </div>
              </div>
              {selectedProgram.description && (
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{selectedProgram.description}</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Interest Rate</p>
                  <p className="font-bold text-green-600 text-lg">{selectedProgram.interest_rate != null ? `${selectedProgram.interest_rate}%` : '—'}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Max Loan Amount</p>
                  <p className="font-bold text-lg">{selectedProgram.max_loan_amount ? `₦${selectedProgram.max_loan_amount.toLocaleString()}` : '—'}</p>
                </div>
              </div>
              {selectedProgram.eligible_crops?.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-gray-500 mb-2">Eligible Crops</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedProgram.eligible_crops.map((c, j) => (
                      <span key={j} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full capitalize">{c}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Eligibility Check */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
              <h3 className="font-semibold text-gray-800 dark:text-white mb-3">Check Eligibility & Enroll</h3>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={loanId}
                  onChange={(e) => setLoanId(e.target.value)}
                  placeholder="Enter your loan ID"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <button
                  onClick={handleCheckEligibility}
                  disabled={submitting}
                  className="px-4 py-2 border border-green-600 text-green-600 rounded-lg text-sm font-medium hover:bg-green-50 disabled:opacity-50"
                >
                  {submitting ? '...' : 'Check'}
                </button>
              </div>

              {eligibilityResult && (
                <div className={`p-4 rounded-lg mb-4 ${eligibilityResult.eligible ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span>{eligibilityResult.eligible ? '✅' : '❌'}</span>
                    <span className={`font-semibold ${eligibilityResult.eligible ? 'text-green-700' : 'text-red-700'}`}>
                      {eligibilityResult.eligible ? 'Eligible for this program' : 'Not eligible'}
                    </span>
                  </div>
                  {eligibilityResult.reason && (
                    <p className="text-sm text-gray-600">{eligibilityResult.reason}</p>
                  )}
                  {eligibilityResult.max_amount && (
                    <p className="text-sm font-medium mt-1">Max amount: ₦{eligibilityResult.max_amount.toLocaleString()}</p>
                  )}
                  {eligibilityResult.conditions?.length ? (
                    <ul className="mt-2 space-y-1">
                      {eligibilityResult.conditions.map((c, j) => (
                        <li key={j} className="text-xs text-gray-600">• {c}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )}

              {eligibilityResult?.eligible && selectedProgram.is_active && (
                <button
                  onClick={handleEnroll}
                  disabled={submitting}
                  className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {submitting ? 'Enrolling...' : `Enroll in ${selectedProgram.name}`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GovernmentProgramsScreen;
