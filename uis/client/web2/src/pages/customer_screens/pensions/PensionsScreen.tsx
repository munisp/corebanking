import React, { useCallback, useEffect, useState } from 'react';
import { pensionService } from '../../../services/pension_service';
import type { PensionAccount, PensionContribution, CreatePensionPayload } from '../../../services/pension_service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PFAs = [
  'ARM Pension',
  'Stanbic IBTC Pension',
  'NLPC PFA',
  'Premium Pension Limited',
  'Leadway Pensure PFA',
  'AXA Mansard Pension',
  'Crusader Sterling Pensions',
  'Sigma Pensions',
  'Trustfund Pensions',
];

const PFA_LIST = [
  { name: 'Premium Pension Limited', aum: '₦1.2 Trillion',  rating: 4.5, roi: '12.5%' },
  { name: 'Stanbic IBTC Pension',    aum: '₦980 Billion',   rating: 4.3, roi: '11.8%' },
  { name: 'ARM Pension Managers',    aum: '₦850 Billion',   rating: 4.4, roi: '12.1%' },
  { name: 'Leadway Pensure PFA',     aum: '₦720 Billion',   rating: 4.2, roi: '11.5%' },
  { name: 'NLPC PFA',               aum: '₦540 Billion',   rating: 4.0, roi: '11.0%' },
  { name: 'Sigma Pensions',          aum: '₦430 Billion',   rating: 3.9, roi: '10.8%' },
];

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `₦${(n / 1_000).toFixed(0)}K`;
  return `₦${n.toLocaleString()}`;
}

const STATUS_COLORS: Record<string, string> = {
  active:    'bg-emerald-100 text-emerald-700',
  inactive:  'bg-amber-100 text-amber-700',
  withdrawn: 'bg-gray-100 text-gray-500',
  posted:    'bg-emerald-100 text-emerald-700',
  pending:   'bg-amber-100 text-amber-700',
  failed:    'bg-red-100 text-red-700',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, color = 'text-gray-900' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function ContributionBar({ label, amount, total, color }: { label: string; amount: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min((amount / total) * 100, 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className={`font-bold ${color}`}>{fmt(amount)}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${color === 'text-blue-600' ? 'bg-blue-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
      </div>
      <p className={`text-xs mt-0.5 ${color}`}>{pct.toFixed(1)}%</p>
    </div>
  );
}

// ─── Register Account Modal ───────────────────────────────────────────────────

interface RegisterModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function RegisterModal({ onClose, onSuccess }: RegisterModalProps) {
  const [form, setForm] = useState<CreatePensionPayload>({
    customer_name: '',
    account_type: 'individual',
    pfa: '',
    rsa_number: '',
    currency: 'NGN',
    status: 'active',
    employer_contribution: 0,
    employee_contribution: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(key: keyof CreatePensionPayload, value: string | number) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.pfa) { setError('Please select a PFA.'); return; }
    setLoading(true);
    setError('');
    try {
      await pensionService.createAccount(form);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register account');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <h2 className="text-xl font-bold mb-1">Register Pension Account</h2>
          <p className="text-sm text-gray-500 mb-5">Open a new RSA or employer pension fund account.</p>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer / Fund Name *</label>
              <input
                required
                value={form.customer_name}
                onChange={(e) => set('customer_name', e.target.value)}
                placeholder="Full name or fund name"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Type *</label>
                <select
                  value={form.account_type}
                  onChange={(e) => set('account_type', e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                >
                  <option value="individual">Individual</option>
                  <option value="employer">Employer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                <select
                  value={form.currency}
                  onChange={(e) => set('currency', e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                >
                  <option value="NGN">NGN</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">RSA Number *</label>
              <input
                required
                value={form.rsa_number}
                onChange={(e) => set('rsa_number', e.target.value)}
                placeholder="e.g. PEN-12345678"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PFA *</label>
              <select
                value={form.pfa}
                onChange={(e) => set('pfa', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
              >
                <option value="">Select PFA…</option>
                {PFAs.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employer Contribution</label>
                <input
                  type="number"
                  min="0"
                  value={form.employer_contribution}
                  onChange={(e) => set('employer_contribution', Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee Contribution</label>
                <input
                  type="number"
                  min="0"
                  value={form.employee_contribution}
                  onChange={(e) => set('employee_contribution', Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-60"
                style={{ backgroundColor: 'var(--primary-color, #3B82F6)' }}
              >
                {loading ? 'Registering…' : 'Register Account'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Account Detail Modal ─────────────────────────────────────────────────────

function AccountDetailModal({
  account,
  onClose,
  onRefresh,
}: {
  account: PensionAccount;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [tab, setTab] = useState<'overview' | 'contributions'>('overview');
  const [contributions, setContributions] = useState<PensionContribution[]>([]);
  const [contribLoading, setContribLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (tab === 'contributions') {
      setContribLoading(true);
      pensionService.getContributions(account.id)
        .then(setContributions)
        .catch(() => setContributions([]))
        .finally(() => setContribLoading(false));
    }
  }, [tab, account.id]);

  async function handleAction(action: 'pause' | 'resume' | 'withdraw') {
    if (action === 'withdraw' && !confirm(`Withdraw account for ${account.customer_name}? This cannot be undone.`)) return;
    setActionLoading(true);
    try {
      await pensionService[action](account.id);
      onRefresh();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  }

  const employerPct = account.total_contributions > 0
    ? Math.round((account.employer_contribution / account.total_contributions) * 100)
    : 0;
  const statusColor = STATUS_COLORS[account.status] ?? 'bg-gray-100 text-gray-500';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold">{account.customer_name}</h2>
              <div className="flex gap-2 mt-1">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusColor}`}>{account.status}</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">{account.account_type}</span>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
          </div>

          {/* Tabs */}
          <div className="flex border-b mb-4">
            {(['overview', 'contributions'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
                  tab === t ? 'border-[var(--primary-color,#3B82F6)] text-[var(--primary-color,#3B82F6)]' : 'border-transparent text-gray-500'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <div className="space-y-4">
              {/* RSA card */}
              <div className="rounded-2xl p-4 text-white" style={{ background: 'linear-gradient(135deg, var(--primary-color, #3B82F6), #1e40af)' }}>
                <p className="text-xs text-white/70 mb-1">RSA Balance</p>
                <p className="text-3xl font-bold">{fmt(account.total_contributions)}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-white/60">RSA Number</p>
                    <p className="font-semibold">{account.rsa_number}</p>
                  </div>
                  <div>
                    <p className="text-white/60">PFA</p>
                    <p className="font-semibold">{account.pfa}</p>
                  </div>
                  <div>
                    <p className="text-white/60">Currency</p>
                    <p className="font-semibold">{account.currency}</p>
                  </div>
                  <div>
                    <p className="text-white/60">Type</p>
                    <p className="font-semibold capitalize">{account.account_type}</p>
                  </div>
                </div>
              </div>

              {/* Contribution breakdown */}
              <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                <p className="text-sm font-semibold">Contribution Breakdown</p>
                <ContributionBar label="Employer Contribution" amount={account.employer_contribution} total={account.total_contributions} color="text-blue-600" />
                <ContributionBar label="Employee Contribution" amount={account.employee_contribution} total={account.total_contributions} color="text-green-600" />
                <div className="flex justify-between border-t pt-2">
                  <span className="text-sm text-gray-600">Employer</span>
                  <span className="text-sm font-bold">{employerPct}%</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {account.status === 'active' && (
                  <button
                    disabled={actionLoading}
                    onClick={() => handleAction('pause')}
                    className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
                  >
                    {actionLoading ? '…' : 'Pause Account'}
                  </button>
                )}
                {account.status === 'inactive' && (
                  <button
                    disabled={actionLoading}
                    onClick={() => handleAction('resume')}
                    className="flex-1 py-2.5 rounded-xl border text-sm font-medium text-white disabled:opacity-60 transition-colors"
                    style={{ backgroundColor: 'var(--primary-color, #3B82F6)' }}
                  >
                    {actionLoading ? '…' : 'Resume Account'}
                  </button>
                )}
                {account.status !== 'withdrawn' && (
                  <button
                    disabled={actionLoading}
                    onClick={() => handleAction('withdraw')}
                    className="flex-1 py-2.5 rounded-xl bg-red-50 border border-red-200 text-sm font-medium text-red-700 disabled:opacity-60 transition-colors"
                  >
                    {actionLoading ? '…' : 'Withdraw'}
                  </button>
                )}
              </div>
            </div>
          )}

          {tab === 'contributions' && (
            <div>
              {contribLoading ? (
                <p className="text-center text-gray-400 py-8">Loading contributions…</p>
              ) : contributions.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No contributions recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {contributions.map((c) => (
                    <div key={c.id} className="bg-gray-50 rounded-xl p-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">{c.date}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-500'}`}>{c.status}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Employer</span>
                        <span className="text-blue-700 font-medium">{fmt(c.employer)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Employee</span>
                        <span className="text-green-700 font-medium">{fmt(c.employee)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold border-t pt-2">
                        <span>Total</span>
                        <span>{fmt(c.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

type Tab = 'my-rsa' | 'accounts' | 'pfa-list';

const PensionsScreen: React.FC = () => {
  const [tab, setTab] = useState<Tab>('my-rsa');
  const [accounts, setAccounts] = useState<PensionAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [registerOpen, setRegisterOpen] = useState(false);
  const [selected, setSelected] = useState<PensionAccount | null>(null);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await pensionService.listAccounts();
      setAccounts(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pension accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  // For "My RSA" tab show the first individual account for the current user,
  // or the first account overall as a representative view.
  const primaryAccount = accounts.find((a) => a.account_type === 'individual') ?? accounts[0] ?? null;
  const totalContribs = accounts.reduce((s, a) => s + a.total_contributions, 0);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'my-rsa',    label: 'My RSA' },
    { key: 'accounts',  label: 'Accounts' },
    { key: 'pfa-list',  label: 'PFA List' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* App bar */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Pensions</h1>
          <button
            onClick={() => setRegisterOpen(true)}
            className="text-sm font-medium px-4 py-2 rounded-xl text-white"
            style={{ backgroundColor: 'var(--primary-color, #3B82F6)' }}
          >
            + Register
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-4">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key
                  ? 'border-[var(--primary-color,#3B82F6)] text-[var(--primary-color,#3B82F6)]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-[var(--primary-color,#3B82F6)] rounded-full animate-spin" />
          </div>
        )}

        {error && !loading && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
            <button onClick={loadAccounts} className="ml-2 underline font-medium">Retry</button>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* My RSA Tab */}
            {tab === 'my-rsa' && (
              <div className="space-y-4">
                {/* Stats row */}
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Total Accounts" value={accounts.length} />
                  <StatCard label="Total Contributions" value={fmt(totalContribs)} color="text-[var(--primary-color,#3B82F6)]" />
                </div>

                {primaryAccount ? (
                  <>
                    {/* RSA Balance Card */}
                    <div className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg, var(--primary-color,#3B82F6), #1e3a8a)' }}>
                      <p className="text-xs text-white/70 mb-1">RSA Balance</p>
                      <p className="text-4xl font-bold">{fmt(primaryAccount.total_contributions)}</p>
                      <div className="mt-4 bg-white/10 rounded-xl p-3 space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-white/70">RSA Number</span>
                          <span className="font-semibold">{primaryAccount.rsa_number}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/70">PFA</span>
                          <span className="font-semibold">{primaryAccount.pfa}</span>
                        </div>
                      </div>
                    </div>

                    {/* Contribution breakdown */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
                      <p className="text-sm font-semibold">Contribution Breakdown</p>
                      <ContributionBar label="Employer Contribution" amount={primaryAccount.employer_contribution} total={primaryAccount.total_contributions} color="text-blue-600" />
                      <ContributionBar label="Employee Contribution" amount={primaryAccount.employee_contribution} total={primaryAccount.total_contributions} color="text-green-600" />
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-sm font-bold">Total Balance</span>
                        <span className="text-sm font-bold">{fmt(primaryAccount.total_contributions)}</span>
                      </div>
                    </div>

                    {/* Quick actions */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => setSelected(primaryAccount)}
                        className="flex-1 py-3 rounded-2xl border border-gray-300 text-sm font-medium text-gray-700 dark:text-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => { setTab('accounts'); }}
                        className="flex-1 py-3 rounded-2xl text-sm font-medium text-white transition-colors"
                        style={{ backgroundColor: 'var(--primary-color, #3B82F6)' }}
                      >
                        All Accounts
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-16">
                    <div className="text-5xl mb-4">🏦</div>
                    <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1">No pension account found</p>
                    <p className="text-sm text-gray-500 mb-4">Register an account to get started.</p>
                    <button
                      onClick={() => setRegisterOpen(true)}
                      className="px-6 py-2.5 rounded-xl text-sm font-medium text-white"
                      style={{ backgroundColor: 'var(--primary-color, #3B82F6)' }}
                    >
                      Register Account
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Accounts Tab */}
            {tab === 'accounts' && (
              <div className="space-y-3">
                {accounts.length === 0 ? (
                  <div className="text-center py-16">
                    <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1">No accounts</p>
                    <p className="text-sm text-gray-500">Register a pension account to get started.</p>
                  </div>
                ) : (
                  accounts.map((a) => {
                    const statusColor = STATUS_COLORS[a.status] ?? 'bg-gray-100 text-gray-500';
                    return (
                      <button
                        key={a.id}
                        onClick={() => setSelected(a)}
                        className="w-full bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 text-left hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{a.customer_name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{a.rsa_number} · {a.pfa}</p>
                          </div>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusColor}`}>{a.status}</span>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                          <p className="text-xs text-gray-500 mb-1">Total Contributions</p>
                          <p className="text-xl font-bold text-gray-900 dark:text-white">{fmt(a.total_contributions)}</p>
                        </div>
                        <div className="flex justify-between mt-3 text-sm">
                          <div>
                            <p className="text-xs text-gray-500">Employer</p>
                            <p className="font-semibold text-blue-600">{fmt(a.employer_contribution)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Employee</p>
                            <p className="font-semibold text-green-600">{fmt(a.employee_contribution)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Type</p>
                            <p className="font-semibold capitalize text-gray-700 dark:text-gray-300">{a.account_type}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {/* PFA List Tab */}
            {tab === 'pfa-list' && (
              <div className="space-y-3">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 text-sm text-blue-700 dark:text-blue-300">
                  Compare licensed Pension Fund Administrators to find the best fit for your retirement goals.
                </div>
                {PFA_LIST.map((pfa) => (
                  <div key={pfa.name} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-start gap-3 mb-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
                        style={{ backgroundColor: 'var(--primary-color, #3B82F6)' }}
                      >
                        {pfa.name[0]}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 dark:text-white text-sm">{pfa.name}</p>
                        <p className="text-xs text-gray-500">AUM: {pfa.aum}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center">
                        <p className="text-lg font-bold text-amber-500">⭐ {pfa.rating}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Rating</p>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center">
                        <p className="text-lg font-bold text-green-600">{pfa.roi}</p>
                        <p className="text-xs text-gray-500 mt-0.5">ROI</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {registerOpen && (
        <RegisterModal onClose={() => setRegisterOpen(false)} onSuccess={loadAccounts} />
      )}

      {selected && (
        <AccountDetailModal
          account={selected}
          onClose={() => setSelected(null)}
          onRefresh={loadAccounts}
        />
      )}
    </div>
  );
};

export default PensionsScreen;
