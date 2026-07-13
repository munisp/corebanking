import React, { useEffect, useState } from 'react';
import { FiArrowLeft, FiExternalLink, FiRefreshCw, FiShield, FiTrash2, FiToggleLeft, FiToggleRight } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../../services/api_service';
import { useTenantConfig } from '../../../hooks/useTenantConfig';

interface TPPConsent {
  id: string;
  tppName: string;
  tppLogo?: string;
  scopes: string[];
  grantedAt: string;
  expiresAt?: string;
  isActive: boolean;
  dataAccess: string[];
}

const OpenBankingConsentScreen: React.FC = () => {
  const navigate = useNavigate();
  const { isFeatureEnabled } = useTenantConfig();
  const [consents, setConsents] = useState<TPPConsent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const featureEnabled = isFeatureEnabled('open_banking');

  useEffect(() => {
    if (featureEnabled) loadConsents();
    else setLoading(false);
  }, [featureEnabled]);

  const loadConsents = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.get('/open-banking/v1/consents');
      const data = response.data as { items?: TPPConsent[] } | TPPConsent[];
      setConsents(Array.isArray(data) ? data : (data as { items?: TPPConsent[] }).items ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load consents');
    } finally {
      setLoading(false);
    }
  };

  const revokeConsent = async (consentId: string) => {
    if (!window.confirm('Revoke this data access consent? The third-party app will lose access immediately.')) return;
    try {
      setRevoking(consentId);
      await apiService.delete(`/open-banking/v1/consents/${consentId}`);
      setConsents((prev) => prev.filter((c) => c.id !== consentId));
    } catch {
      alert('Failed to revoke consent. Please try again.');
    } finally {
      setRevoking(null);
    }
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (!featureEnabled) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiShield className="w-10 h-10 text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Open Banking Unavailable</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Open Banking is not enabled for your account. Contact support to enable this feature.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin h-10 w-10 border-4 border-[var(--primary-color)] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/settings')}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <FiArrowLeft className="w-5 h-5 text-white" />
              </button>
              <h1 className="text-2xl font-bold text-white">Open Banking Consents</h1>
            </div>
            <button
              onClick={loadConsents}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <FiRefreshCw className="w-5 h-5 text-white" />
            </button>
          </div>
          <p className="text-white/80 text-sm pl-12">
            Manage which third-party apps can access your financial data
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Info banner */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <div className="flex items-start space-x-3">
            <FiShield className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Your data, your control</p>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                You can revoke any third-party app's access to your data at any time. Revoking access is immediate and permanent.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center justify-between">
            <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
            <button onClick={loadConsents} className="text-sm text-red-600 font-medium hover:underline">Retry</button>
          </div>
        )}

        {consents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-6">
              <FiShield className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Active Consents</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm max-w-xs">
              You haven't granted any third-party apps access to your account data yet.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {consents.map((consent) => (
              <div
                key={consent.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden"
              >
                <div className="p-5">
                  {/* TPP header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center">
                        {consent.tppLogo ? (
                          <img src={consent.tppLogo} alt={consent.tppName} className="w-8 h-8 object-contain" />
                        ) : (
                          <FiExternalLink className="w-6 h-6 text-gray-500" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">{consent.tppName}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Granted {formatDate(consent.grantedAt)}
                          {consent.expiresAt ? ` · Expires ${formatDate(consent.expiresAt)}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      {consent.isActive ? (
                        <FiToggleRight className="w-6 h-6 text-green-500" />
                      ) : (
                        <FiToggleLeft className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Scopes */}
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      Data Access
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(consent.dataAccess.length > 0 ? consent.dataAccess : consent.scopes).map((scope) => (
                        <span
                          key={scope}
                          className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-full"
                        >
                          {scope.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Revoke button */}
                  <button
                    onClick={() => revokeConsent(consent.id)}
                    disabled={revoking === consent.id}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                  >
                    <FiTrash2 className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {revoking === consent.id ? 'Revoking...' : 'Revoke Access'}
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OpenBankingConsentScreen;
