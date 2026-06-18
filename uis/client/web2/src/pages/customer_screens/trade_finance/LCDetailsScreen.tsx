import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiFileText, FiChevronRight, FiTag, FiUsers, FiList, FiCalendar, FiPackage } from 'react-icons/fi';
import type { LetterOfCredit } from '../../../models/trade_finance';

function statusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'issued':    return '#3B82F6';
    case 'confirmed': return '#22C55E';
    case 'draft':     return '#F97316';
    case 'amended':   return '#A855F7';
    case 'expired':
    case 'cancelled': return '#EF4444';
    default:          return '#9CA3AF';
  }
}

function formatAmount(amount: number, currency: string): string {
  return `${currency} ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function capitalise(s: string) {
  return s.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const LCDetailsScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const lc = location.state?.lc as LetterOfCredit | undefined;

  if (!lc) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">LC data not found.</p>
      </div>
    );
  }

  const color = statusColor(lc.status);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* AppBar */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <FiChevronRight className="rotate-180 w-5 h-5 text-gray-700 dark:text-gray-200" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">LC Details</h1>
        </div>
      </div>

      <div className="p-5 space-y-4 max-w-2xl mx-auto pb-10">
        {/* Status header card */}
        <div
          className="w-full rounded-2xl p-5 flex flex-col items-center text-center"
          style={{ background: `linear-gradient(135deg, ${color}26, ${color}0D)`, border: `1px solid ${color}4D` }}
        >
          <div className="p-4 rounded-full mb-3" style={{ backgroundColor: `${color}33` }}>
            <FiFileText size={36} color={color} />
          </div>
          <p className="text-lg font-extrabold text-gray-900 dark:text-white mb-2">
            {lc.beneficiaryName || 'Letter of Credit'}
          </p>
          <p className="text-2xl font-black mb-2" style={{ color }}>{formatAmount(lc.amount, lc.currency)}</p>
          <span
            className="px-4 py-1.5 rounded-full text-[13px] font-bold tracking-wide"
            style={{ backgroundColor: `${color}33`, color, border: `1px solid ${color}66` }}
          >
            {lc.status.toUpperCase()}
          </span>
        </div>

        {/* LC Reference */}
        <SectionCard title="LC Reference" icon={<FiTag size={16} />}>
          {lc.lcRef && <DetailRow label="LC Reference" value={lc.lcRef} mono />}
          {lc.swiftRef && <DetailRow label="SWIFT Ref" value={lc.swiftRef} mono />}
          <DetailRow label="ID" value={lc.id} mono />
          <DetailRow label="Type" value={capitalise(lc.type)} />
        </SectionCard>

        {/* Parties */}
        <SectionCard title="Parties" icon={<FiUsers size={16} />}>
          {lc.applicantId && <DetailRow label="Applicant ID" value={lc.applicantId} mono />}
          <DetailRow label="Beneficiary" value={lc.beneficiaryName || '—'} />
          {lc.beneficiaryCountry && <DetailRow label="Beneficiary Country" value={lc.beneficiaryCountry} />}
        </SectionCard>

        {/* Terms */}
        <SectionCard title="Terms" icon={<FiList size={16} />}>
          <DetailRow label="Currency" value={lc.currency} />
          <DetailRow label="Amount" value={formatAmount(lc.amount, lc.currency)} highlight />
          {lc.availableBy && <DetailRow label="Available By" value={lc.availableBy} />}
          {lc.expiryDate && <DetailRow label="Expiry Date" value={lc.expiryDate} />}
          {lc.placeOfExpiry && <DetailRow label="Place of Expiry" value={lc.placeOfExpiry} />}
        </SectionCard>

        {/* Goods Description */}
        {lc.goodsDescription && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2.5">
              <FiPackage size={16} className="text-[#1A73E8]" />
              <span className="font-bold text-[13px] text-gray-900 dark:text-white">Goods Description</span>
            </div>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">{lc.goodsDescription}</p>
          </div>
        )}

        {/* Dates */}
        <SectionCard title="Dates" icon={<FiCalendar size={16} />}>
          {lc.createdAt && <DetailRow label="Created" value={formatDate(lc.createdAt)} />}
          {lc.issuedAt && <DetailRow label="Issued" value={formatDate(lc.issuedAt)} />}
        </SectionCard>
      </div>
    </div>
  );
};

const SectionCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700">
    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
      <span className="text-[#1A73E8]">{icon}</span>
      <span className="font-bold text-[13px] text-gray-900 dark:text-white">{title}</span>
    </div>
    <div className="divide-y divide-gray-50 dark:divide-gray-700/50">{children}</div>
  </div>
);

const DetailRow: React.FC<{ label: string; value: string; highlight?: boolean; mono?: boolean }> = ({ label, value, highlight, mono }) => (
  <div className="flex items-start justify-between gap-4 px-4 py-2.5">
    <span className="text-[13px] text-gray-500 dark:text-gray-400 flex-shrink-0">{label}</span>
    <span
      className={`text-[13px] text-right flex-1 ${mono ? 'font-mono' : ''} ${
        highlight ? 'font-extrabold text-[#1A73E8]' : 'font-semibold text-gray-900 dark:text-white'
      }`}
    >
      {value}
    </span>
  </div>
);

export default LCDetailsScreen;
