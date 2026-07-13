import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiChevronRight, FiCreditCard, FiInfo, FiRefreshCw } from 'react-icons/fi';
import type { BNPLApplication, BNPLRepayment } from '../../../models/bnpl';
import { bnplService } from '../../../services/bnpl_service';
import { useTheme } from '../../../contexts/ThemeContext';

const formatCurrency = (amount: number) =>
  `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (date: string) => {
  try {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return date;
  }
};

const statusColor = (status: string): { bg: string; text: string; border: string } => {
  switch (status?.toLowerCase()) {
    case 'approved': return { bg: '#ECFDF5', text: '#059669', border: '#6EE7B7' };
    case 'active':   return { bg: '#EFF6FF', text: '#2563EB', border: '#93C5FD' };
    case 'pending':  return { bg: '#FFFBEB', text: '#D97706', border: '#FCD34D' };
    case 'declined': return { bg: '#FEF2F2', text: '#DC2626', border: '#FCA5A5' };
    case 'completed': return { bg: '#F9FAFB', text: '#6B7280', border: '#D1D5DB' };
    case 'paid':     return { bg: '#ECFDF5', text: '#059669', border: '#6EE7B7' };
    case 'overdue':  return { bg: '#FEF2F2', text: '#DC2626', border: '#FCA5A5' };
    default:         return { bg: '#F9FAFB', text: '#6B7280', border: '#D1D5DB' };
  }
};

type Tab = 'overview' | 'schedule';

const BNPLDetailsScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark } = useTheme();
  const app = location.state?.application as BNPLApplication | undefined;

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [schedule, setSchedule] = useState<BNPLRepayment[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'schedule' && schedule.length === 0 && !loadingSchedule && app) {
      fetchSchedule();
    }
  }, [activeTab]);

  const fetchSchedule = async () => {
    if (!app) return;
    setLoadingSchedule(true);
    setScheduleError(null);
    try {
      const data = await bnplService.getRepaymentSchedule(app.applicationId);
      setSchedule(data);
    } catch (e) {
      setScheduleError(e instanceof Error ? e.message : 'Failed to load schedule');
    } finally {
      setLoadingSchedule(false);
    }
  };

  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const borderCol = isDark ? '#333' : '#E5E7EB';
  const textPrimary = isDark ? '#F3F4F6' : '#111827';
  const textSecondary = isDark ? '#9CA3AF' : '#6B7280';
  const divider = isDark ? '#374151' : '#F3F4F6';

  if (!app) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 bg-gray-50 dark:bg-gray-900">
        <FiCreditCard size={56} className="text-gray-300 dark:text-gray-600" />
        <p className="text-gray-500 dark:text-gray-400">No application data found.</p>
        <button
          onClick={() => navigate('/bnpl')}
          className="px-6 py-3 rounded-xl text-white font-semibold"
          style={{ backgroundColor: 'var(--primary-color)' }}
        >
          Back to BNPL
        </button>
      </div>
    );
  }

  const sc = statusColor(app.status);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* AppBar */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <FiChevronRight className="rotate-180 w-5 h-5 text-gray-700 dark:text-gray-200" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">BNPL Details</h1>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-4 gap-6">
          {(['overview', 'schedule'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-semibold capitalize border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-[var(--primary-color)] text-[var(--primary-color)]'
                  : 'border-transparent text-gray-500 dark:text-gray-400'
              }`}
            >
              {tab === 'overview' ? 'Overview' : 'Repayment Schedule'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-5 max-w-2xl mx-auto space-y-4 pb-10">
        {activeTab === 'overview' ? (
          <>
            {/* Status header */}
            <div
              className="rounded-2xl p-5 text-center"
              style={{ backgroundColor: sc.bg, border: `1px solid ${sc.border}` }}
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ backgroundColor: `${sc.text}22` }}
              >
                <FiCreditCard size={32} style={{ color: sc.text }} />
              </div>
              <p className="text-lg font-extrabold mb-2" style={{ color: textPrimary }}>
                {app.productDescription || 'BNPL Purchase'}
              </p>
              <span
                className="inline-block px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase"
                style={{ backgroundColor: `${sc.text}22`, color: sc.text, border: `1px solid ${sc.border}` }}
              >
                {app.status}
              </span>
            </div>

            {/* Financial Summary */}
            <SectionCard title="Financial Summary" icon={<span>💰</span>}>
              <DetailRow label="Purchase Amount" value={formatCurrency(app.purchaseAmount)} textPrimary={textPrimary} textSecondary={textSecondary} divider={divider} />
              <DetailRow label="Per Instalment" value={formatCurrency(app.installmentAmount)} textPrimary={textPrimary} textSecondary={textSecondary} divider={divider} />
              <DetailRow label="Total Instalments" value={`${app.installmentCount}×`} textPrimary={textPrimary} textSecondary={textSecondary} divider={divider} />
              <DetailRow label="Interest Rate" value={`${app.interestRate.toFixed(2)}%`} textPrimary={textPrimary} textSecondary={textSecondary} divider={divider} />
              <DetailRow
                label="Total Repayment"
                value={formatCurrency(app.installmentAmount * app.installmentCount)}
                highlight
                highlightColor="var(--primary-color)"
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                divider={divider}
              />
            </SectionCard>

            {/* Application Details */}
            <SectionCard title="Application Details" icon={<FiInfo size={16} />}>
              <DetailRow label="Application ID" value={app.applicationId} monospace textPrimary={textPrimary} textSecondary={textSecondary} divider={divider} />
              {app.merchantId && <DetailRow label="Merchant ID" value={app.merchantId} textPrimary={textPrimary} textSecondary={textSecondary} divider={divider} />}
              {app.creditScore > 0 && <DetailRow label="Credit Score" value={app.creditScore.toString()} textPrimary={textPrimary} textSecondary={textSecondary} divider={divider} />}
              <DetailRow label="BVN Verified" value={app.bvnVerified ? 'Yes' : 'No'} textPrimary={textPrimary} textSecondary={textSecondary} divider={divider} />
              <DetailRow label="Applied On" value={formatDate(app.createdAt)} textPrimary={textPrimary} textSecondary={textSecondary} divider={divider} />
              <DetailRow label="Last Updated" value={formatDate(app.updatedAt)} textPrimary={textPrimary} textSecondary={textSecondary} divider={divider} last />
            </SectionCard>
          </>
        ) : loadingSchedule ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-10 h-10 border-4 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : scheduleError ? (
          <div className="flex flex-col items-center py-20 gap-4">
            <p className="text-red-500 text-sm">{scheduleError}</p>
            <button
              onClick={fetchSchedule}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold"
              style={{ backgroundColor: 'var(--primary-color)' }}
            >
              <FiRefreshCw size={16} /> Retry
            </button>
          </div>
        ) : schedule.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-4">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: '#7C3AED1A' }}>
              <span style={{ fontSize: 40 }}>📅</span>
            </div>
            <p className="text-base font-semibold" style={{ color: textPrimary }}>No schedule available</p>
            <p className="text-sm text-center" style={{ color: textSecondary }}>
              Schedule will appear once the application is approved
            </p>
            <button
              onClick={fetchSchedule}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border"
              style={{ color: 'var(--primary-color)', borderColor: 'var(--primary-color)' }}
            >
              <FiRefreshCw size={14} /> Refresh
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {schedule.map((item, idx) => {
              const isc = statusColor(item.status);
              return (
                <div
                  key={item.id ?? idx}
                  className="flex items-center gap-3.5 p-4 rounded-2xl"
                  style={{ backgroundColor: cardBg, border: `1px solid ${isc.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                    style={{ backgroundColor: `${isc.text}20`, color: isc.text }}
                  >
                    #{item.installmentNo ?? idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: textPrimary }}>
                      Due: {formatDate(item.dueDate)}
                    </p>
                    {item.paidAt && (
                      <p className="text-xs mt-0.5" style={{ color: textSecondary }}>
                        Paid: {formatDate(item.paidAt)}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-bold" style={{ color: textPrimary }}>
                      {formatCurrency(item.amount)}
                    </p>
                    <span
                      className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                      style={{ backgroundColor: `${isc.text}20`, color: isc.text }}
                    >
                      {item.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const SectionCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => {
  const { isDark } = useTheme();
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
        border: `1px solid ${isDark ? '#333' : '#E5E7EB'}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      <div className="flex items-center gap-2 px-4 py-3.5 border-b" style={{ borderColor: isDark ? '#374151' : '#F3F4F6' }}>
        <span style={{ color: 'var(--primary-color)' }}>{icon}</span>
        <h3 className="text-sm font-bold" style={{ color: isDark ? '#F3F4F6' : '#111827' }}>{title}</h3>
      </div>
      {children}
    </div>
  );
};

interface DetailRowProps {
  label: string;
  value: string;
  highlight?: boolean;
  highlightColor?: string;
  monospace?: boolean;
  last?: boolean;
  textPrimary: string;
  textSecondary: string;
  divider: string;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, value, highlight, highlightColor, monospace, last, textPrimary, textSecondary, divider }) => (
  <div
    className="flex items-start justify-between px-4 py-3"
    style={{ borderBottom: last ? 'none' : `1px solid ${divider}` }}
  >
    <span className="text-sm flex-1" style={{ color: textSecondary }}>{label}</span>
    <span
      className="text-sm ml-4 text-right flex-1"
      style={{
        color: highlight ? highlightColor : textPrimary,
        fontWeight: highlight ? 800 : 600,
        fontFamily: monospace ? 'monospace' : undefined,
      }}
    >
      {value}
    </span>
  </div>
);

export default BNPLDetailsScreen;
