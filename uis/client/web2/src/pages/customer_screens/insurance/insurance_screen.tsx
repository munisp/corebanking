import { useEffect, useState } from 'react';
import { FiArrowLeft, FiChevronRight, FiShield } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import type { InsuranceClaim, InsurancePolicy } from '../../../services/insurance_service';
import { insuranceService } from '../../../services/insurance_service';

const SECTIONS = [
  { title: 'All Policies', subtitle: 'Browse available plans', icon: '📋', path: '/insurance/all-policies', color: 'from-blue-500 to-indigo-600' },
  { title: 'My Policies', subtitle: 'View active coverage', icon: '🛡️', path: '/insurance/my-policies', color: 'from-green-500 to-emerald-600' },
  { title: 'Claims', subtitle: 'Submit & track claims', icon: '📝', path: '/insurance/claims', color: 'from-rose-500 to-red-600' },
  { title: 'Premium Payments', subtitle: 'Payment history', icon: '💳', path: '/insurance/premium-payments', color: 'from-teal-500 to-cyan-600' },
];

const InsuranceScreen = () => {
  const navigate = useNavigate();
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [myPolicies, myClaims] = await Promise.all([
        insuranceService.getMyPolicies(),
        insuranceService.getClaims(),
      ]);
      setPolicies(myPolicies);
      setClaims(myClaims);
    } catch {
      // non-fatal: show empty state
    } finally {
      setLoading(false);
    }
  };

  const active = policies.filter(p => p.status === 'active').length;
  const totalCoverage = policies.reduce((s, p) => s + p.coverage_amount, 0);
  const pendingClaims = claims.filter(c => c.status === 'pending' || c.status === 'under_review').length;

  const sections = SECTIONS.map(s => {
    if (s.path === '/insurance/my-policies') return { ...s, subtitle: loading ? 'Loading...' : `${active} active` };
    if (s.path === '/insurance/claims') return { ...s, subtitle: loading ? 'Loading...' : `${pendingClaims} pending` };
    return s;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 pt-4 pb-8">
        <div className="px-4 flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-white hover:text-gray-200"
          >
            <FiArrowLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">Insurance</h1>
            <p className="text-sm text-blue-100">Protect what matters most</p>
          </div>
          <FiShield className="text-white" size={28} />
        </div>

        {/* Stats */}
        <div className="px-4">
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-5 border border-white/30">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-white text-2xl font-bold">{loading ? '—' : active}</p>
                <p className="text-white/70 text-xs mt-1">Active Policies</p>
              </div>
              <div>
                <p className="text-white text-2xl font-bold">
                  {loading ? '—' : totalCoverage > 0 ? `₦${(totalCoverage / 1_000_000).toFixed(1)}M` : '₦0'}
                </p>
                <p className="text-white/70 text-xs mt-1">Total Coverage</p>
              </div>
              <div>
                <p className="text-white text-2xl font-bold">{loading ? '—' : pendingClaims}</p>
                <p className="text-white/70 text-xs mt-1">Pending Claims</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Grid */}
      <div className="px-4 -mt-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          {sections.map(section => (
            <button
              key={section.path}
              onClick={() => navigate(section.path)}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all overflow-hidden text-left"
            >
              <div className={`h-1.5 bg-gradient-to-r ${section.color}`} />
              <div className="p-4">
                <div className="text-3xl mb-2">{section.icon}</div>
                <h3 className="font-bold text-gray-900 dark:text-white text-sm">{section.title}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{section.subtitle}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Apply CTA */}
      <div className="px-4 mb-6">
        <button
          onClick={() => navigate('/insurance/apply')}
          className="w-full bg-[var(--primary-color)] text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
        >
          Apply for Insurance
          <FiChevronRight size={20} />
        </button>
      </div>

      {/* Info Section */}
      <div className="px-4">
        <div className="bg-blue-50 dark:bg-gray-800 rounded-xl p-5 border border-blue-100 dark:border-gray-700">
          <div className="flex items-start gap-3">
            <FiShield className="text-[var(--primary-color)] mt-1 shrink-0" size={20} />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Why Choose Our Insurance?</h3>
              <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                <li>• Instant policy activation</li>
                <li>• Easy claims process</li>
                <li>• 24/7 customer support</li>
                <li>• Flexible payment options</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InsuranceScreen;
