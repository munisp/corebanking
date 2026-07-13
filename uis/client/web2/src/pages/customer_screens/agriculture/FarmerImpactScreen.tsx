import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { agricultureService } from '../../../services/agriculture_service';

interface Achievement {
  achievement_id: string;
  title: string;
  description: string;
  badge_type: string;
  earned_at: string;
  points: number;
}

interface Certificate {
  certificate_id: string;
  farmer_id: string;
  issue_date: string;
  impact_summary: string;
  total_loans: number;
  total_repaid: number;
  yield_improvement: number;
  download_url?: string;
}

interface CreditHistory {
  total_loans: number;
  repaid_loans: number;
  active_loans: number;
  credit_score: number;
  repayment_rate: number;
  last_loan_date: string;
}

const FarmerImpactScreen: React.FC = () => {
  const navigate = useNavigate();
  const [farmerId, setFarmerId] = useState('');
  const [searchId, setSearchId] = useState('');
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [creditHistory, setCreditHistory] = useState<CreditHistory | null>(null);
  const [impactMetrics, setImpactMetrics] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'impact' | 'achievements' | 'credit'>('impact');

  const handleSearch = async () => {
    if (!searchId.trim()) { setError('Enter a farmer ID'); return; }
    setFarmerId(searchId);
    setLoading(true);
    setError('');
    try {
      const [achievementsData, certData, creditData, dashboardData] = await Promise.all([
        agricultureService.getFarmerAchievements(searchId).catch(() => []),
        agricultureService.getImpactCertificate(searchId).catch(() => ({})),
        agricultureService.getFarmerCreditHistory(searchId).catch(() => ({})),
        agricultureService.getFarmerDashboard(searchId).catch(() => ({})),
      ]);
      setAchievements(achievementsData as Achievement[]);
      setCertificate(Object.keys(certData).length ? certData as unknown as Certificate : null);
      setCreditHistory(Object.keys(creditData).length ? creditData as unknown as CreditHistory : null);
      setImpactMetrics(dashboardData);
    } catch {
      setError('Failed to load farmer impact data');
    } finally {
      setLoading(false);
    }
  };

  const getBadgeEmoji = (badgeType?: string) => {
    const map: Record<string, string> = {
      repayment: '💰', yield: '🌾', loyalty: '⭐', innovation: '💡',
      community: '👥', green: '🌿', first_loan: '🏆', milestone: '🎯',
    };
    return map[badgeType || ''] || '🏅';
  };

  const getCreditScoreColor = (score: number) => {
    if (score >= 700) return 'text-green-600';
    if (score >= 500) return 'text-yellow-600';
    return 'text-red-600';
  };

  const tabs = [
    { key: 'impact' as const, label: 'Impact Dashboard', emoji: '📊' },
    { key: 'achievements' as const, label: 'Achievements', emoji: '🏆' },
    { key: 'credit' as const, label: 'Credit History', emoji: '💳' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/agriculture')} className="text-gray-500 hover:text-gray-700 mr-2">←</button>
          <h1 className="text-xl font-bold">Farmer Impact</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Search */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <label className="block text-xs text-gray-500 mb-2 uppercase font-medium">Farmer ID</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Enter farmer ID..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
            >
              Load
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>
        )}

        {loading && (
          <div className="flex justify-center py-10">
            <div className="animate-spin h-10 w-10 border-4 border-green-600 border-t-transparent rounded-full"></div>
          </div>
        )}

        {!loading && farmerId && (
          <>
            {/* Tabs */}
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                    activeTab === tab.key ? 'bg-white dark:bg-gray-700 text-green-700 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  <span>{tab.emoji}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Impact Dashboard */}
            {activeTab === 'impact' && (
              <div className="space-y-4">
                {impactMetrics && Object.keys(impactMetrics).length > 0 ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: 'total_loans', label: 'Total Loans', emoji: '💰' },
                        { key: 'total_disbursed', label: 'Total Disbursed', emoji: '📤', format: 'currency' },
                        { key: 'yield_improvement', label: 'Yield Improvement', emoji: '🌾', format: 'percent' },
                        { key: 'income_increase', label: 'Income Increase', emoji: '📈', format: 'percent' },
                      ].map(({ key, label, emoji, format }) => {
                        const val = impactMetrics[key] as number;
                        return (
                          <div key={key} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                            <p className="text-xs text-gray-500 mb-1">{emoji} {label}</p>
                            <p className="text-xl font-bold text-green-700">
                              {val != null
                                ? format === 'currency'
                                  ? `₦${Number(val).toLocaleString()}`
                                  : format === 'percent'
                                  ? `${Number(val).toFixed(1)}%`
                                  : String(val)
                                : '—'}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Certificate */}
                    {certificate && (
                      <div className="bg-gradient-to-br from-green-600 to-emerald-700 text-white rounded-xl p-5 shadow">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-3xl">🏆</span>
                          <div>
                            <p className="font-bold text-lg">Impact Certificate</p>
                            <p className="text-green-100 text-sm">
                              Issued: {certificate.issue_date ? new Date(certificate.issue_date).toLocaleDateString() : '—'}
                            </p>
                          </div>
                        </div>
                        <p className="text-green-100 text-sm mb-4">{certificate.impact_summary || 'Recognised for contributions to agricultural development'}</p>
                        <div className="grid grid-cols-3 gap-3 border-t border-green-500/50 pt-3">
                          <div className="text-center">
                            <p className="text-xs text-green-200">Loans</p>
                            <p className="font-bold">{certificate.total_loans ?? '—'}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-green-200">Repaid</p>
                            <p className="font-bold">₦{certificate.total_repaid ? Number(certificate.total_repaid).toLocaleString() : '—'}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-green-200">Yield +</p>
                            <p className="font-bold">{certificate.yield_improvement != null ? `${certificate.yield_improvement}%` : '—'}</p>
                          </div>
                        </div>
                        {certificate.download_url && (
                          <a
                            href={certificate.download_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-4 block text-center py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium"
                          >
                            📥 Download Certificate
                          </a>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500">
                    <p className="text-4xl mb-3">📊</p>
                    <p>No impact data found for this farmer</p>
                  </div>
                )}
              </div>
            )}

            {/* Achievements */}
            {activeTab === 'achievements' && (
              <div className="space-y-3">
                {achievements.length === 0 ? (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500">
                    <p className="text-4xl mb-3">🏅</p>
                    <p>No achievements yet</p>
                    <p className="text-xs mt-2">Complete loans and improve yields to earn badges</p>
                  </div>
                ) : (
                  achievements.map((a, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-center gap-4">
                      <span className="text-4xl">{getBadgeEmoji(a.badge_type)}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800 dark:text-white">{a.title}</p>
                        <p className="text-sm text-gray-500">{a.description}</p>
                        {a.earned_at && (
                          <p className="text-xs text-gray-400 mt-1">
                            Earned: {new Date(a.earned_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      {a.points != null && (
                        <span className="text-sm font-bold text-green-600">+{a.points}pts</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Credit History */}
            {activeTab === 'credit' && (
              <div className="space-y-4">
                {creditHistory ? (
                  <>
                    {/* Credit Score */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 text-center">
                      <p className="text-xs text-gray-500 uppercase mb-2">Credit Score</p>
                      <p className={`text-5xl font-bold mb-2 ${getCreditScoreColor(creditHistory.credit_score || 0)}`}>
                        {creditHistory.credit_score ?? '—'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {(creditHistory.credit_score || 0) >= 700 ? 'Excellent' :
                         (creditHistory.credit_score || 0) >= 500 ? 'Good' : 'Needs Improvement'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                        <p className="text-xs text-gray-500">Total Loans</p>
                        <p className="text-2xl font-bold text-gray-800 dark:text-white">{creditHistory.total_loans ?? '—'}</p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                        <p className="text-xs text-gray-500">Repaid</p>
                        <p className="text-2xl font-bold text-green-600">{creditHistory.repaid_loans ?? '—'}</p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                        <p className="text-xs text-gray-500">Active</p>
                        <p className="text-2xl font-bold text-blue-600">{creditHistory.active_loans ?? '—'}</p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                        <p className="text-xs text-gray-500">Repayment Rate</p>
                        <p className="text-2xl font-bold text-green-600">
                          {creditHistory.repayment_rate != null ? `${Number(creditHistory.repayment_rate).toFixed(1)}%` : '—'}
                        </p>
                      </div>
                    </div>

                    {creditHistory.last_loan_date && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                        <p className="text-xs text-gray-500">Last Loan Date</p>
                        <p className="font-medium text-gray-800 dark:text-white">
                          {new Date(creditHistory.last_loan_date).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500">
                    <p className="text-4xl mb-3">💳</p>
                    <p>No credit history found</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {!farmerId && !loading && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500">
            <p className="text-4xl mb-3">🔍</p>
            <p>Enter a farmer ID above to view impact data</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FarmerImpactScreen;
