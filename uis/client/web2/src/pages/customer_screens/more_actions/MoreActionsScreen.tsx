import React, { useState } from 'react';
import {
    FiAward,
    FiClock,
    FiCreditCard,
    FiDollarSign,
    FiFileText,
    FiGift,
    FiGlobe,
    FiHome,
    FiLayers,
    FiPieChart,
    FiSearch,
    FiShield,
    FiTrendingUp,
    FiUsers,
    FiX,
    FiZap,
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useTenantConfig } from '../../../hooks/useTenantConfig';

interface ActionItem {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  route: string;
  keywords: string[];
  feature?: string; // Optional feature flag requirement
}

const MoreActionsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { tenant } = useTenantConfig();
  const [searchQuery, setSearchQuery] = useState('');

  // const parseColor = (colorString: string) => {
  //   try {
  //     return colorString.startsWith('#') ? colorString : `#${colorString}`;
  //   } catch (e) {
  //     return '#3B82F6'; // Default blue
  //   }
  // };

  const allActions: ActionItem[] = [
    {
      icon: <FiLayers size={24} />,
      title: 'Bulk Transfer',
      subtitle: 'Send to multiple accounts at once',
      route: '/bulk-transfer',
      keywords: ['bulk', 'batch', 'salary', 'multiple', 'transfer', 'mass', 'payroll'],
    },
    {
      icon: <FiDollarSign size={24} />,
      title: 'Pay Bills',
      subtitle: 'Electricity, cable TV, internet & more',
      route: '/bills',
      keywords: ['bill', 'pay', 'electricity', 'cable', 'internet', 'utility'],
    },
    {
      icon: <FiGift size={24} />,
      title: 'Credits & Rewards',
      subtitle: 'View and redeem reward points',
      route: '/rewards',
      keywords: ['reward', 'credit', 'points', 'redeem', 'gift'],
    },
    {
      icon: <FiShield size={24} />,
      title: 'Insurance',
      subtitle: 'Protect your assets',
      route: '/insurance',
      keywords: ['insurance', 'protect', 'cover', 'policy', 'claim'],
    },
    {
      icon: <FiGlobe size={24} />,
      title: 'Carbon Credits',
      subtitle: 'Offset your carbon footprint',
      route: '/carbon-credits',
      keywords: ['carbon', 'credit', 'environment', 'green', 'offset'],
    },
    {
      icon: <FiGlobe size={24} />,
      title: 'Trade Finance',
      subtitle: 'Letters of credit, bank guarantees & factoring',
      route: '/trade-finance',
      keywords: ['trade', 'finance', 'letter', 'credit', 'bank', 'guarantee', 'factoring', 'lc', 'swift', 'export'],
    },
    {
      icon: <FiShield size={24} />,
      title: 'Escrow Banking',
      subtitle: 'Secure third-party transactions',
      route: '/escrow',
      keywords: ['escrow', 'secure', 'third-party', 'transaction', 'safe'],
    },
    {
      icon: <FiTrendingUp size={24} />,
      title: 'Agriculture Banking',
      subtitle: 'Farm and agribusiness solutions',
      route: '/agriculture',
      keywords: ['agriculture', 'farm', 'farmer', 'crop', 'agri', 'loan'],
    },
    {
      icon: <FiZap size={24} />,
      title: 'Islamic Banking',
      subtitle: 'Shariah-compliant financial products',
      route: '/islamic-banking',
      keywords: ['islamic', 'shariah', 'murabaha', 'musharaka', 'ijara', 'takaful', 'sukuk'],
    },
    {
      icon: <FiTrendingUp size={24} />,
      title: 'Active Loans',
      subtitle: 'View your loan applications',
      route: '/active-loans',
      keywords: ['loan', 'active', 'borrow', 'credit'],
    },
    {
      icon: <FiFileText size={24} />,
      title: 'Active LPOs',
      subtitle: 'View your LPO applications',
      route: '/active-lpos',
      keywords: ['lpo', 'purchase', 'order'],
    },
    {
      icon: <FiPieChart size={24} />,
      title: 'Savings',
      subtitle: 'Manage your savings plans',
      route: '/savings',
      keywords: ['save', 'savings', 'goal', 'target'],
    },
    {
      icon: <FiAward size={24} />,
      title: 'Pension',
      subtitle: 'RSA accounts, PFA contributions & retirement funds',
      route: '/pensions',
      keywords: ['pension', 'rsa', 'pfa', 'retirement', 'contribution', 'fund'],
    },
    {
      icon: <FiHome size={24} />,
      title: 'Mortgage Banking',
      subtitle: 'Home loan solutions',
      route: '/mortgage',
      keywords: ['mortgage', 'home', 'property', 'loan', 'house'],
    },
    {
      icon: <FiFileText size={24} />,
      title: 'Education Banking',
      subtitle: 'Finance your education',
      route: '/education-loans',
      keywords: ['education', 'school', 'tuition', 'student', 'loan'],
    },
    {
      icon: <FiUsers size={24} />,
      title: 'Esusu (Rotating Savings)',
      subtitle: 'Join or create savings groups',
      route: '/esusu',
      keywords: ['esusu', 'rotating', 'savings', 'group', 'cooperative'],
    },
    {
      icon: <FiShield size={24} />,
      title: 'Disputes',
      subtitle: 'Manage transaction disputes',
      route: '/disputes',
      keywords: ['dispute', 'complaint', 'issue', 'problem'],
    },
    {
      icon: <FiFileText size={24} />,
      title: 'Bank Statement',
      subtitle: 'Download your statement',
      route: '/bank-statement',
      keywords: ['statement', 'download', 'pdf', 'history'],
    },
    {
      icon: <FiCreditCard size={24} />,
      title: 'Cards',
      subtitle: 'Manage your cards',
      route: '/cards',
      keywords: ['card', 'credit', 'debit'],
    },
    {
      icon: <FiClock size={24} />,
      title: 'Transaction History',
      subtitle: 'View all transactions',
      route: '/transaction-history',
      keywords: ['transaction', 'history', 'all', 'list'],
    },
    {
      icon: <FiFileText size={24} />,
      title: 'QR Code',
      subtitle: 'Scan or show your QR',
      route: '/qrcode',
      keywords: ['qr', 'code', 'scan', 'show'],
    },
  ];

  // Filter by search query only (mobile doesn't filter by features in this screen)
  const filteredActions = searchQuery
    ? allActions.filter((action) => {
        const query = searchQuery.toLowerCase().trim();
        return (
          action.title.toLowerCase().includes(query) ||
          action.subtitle.toLowerCase().includes(query) ||
          action.keywords.some((keyword) => keyword.includes(query))
        );
      })
    : allActions;

  const handleActionClick = (route: string) => {
    navigate(route);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* AppBar - matching mobile exactly */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="px-4 py-4">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">More Actions</h1>
        </div>
      </div>

      {/* Search bar - matching mobile: padding 16 all around */}
      <div className="p-4">
        <div className="relative">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search actions..."
            className="w-full pl-12 pr-12 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors"
            >
              <FiX className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Actions list - matching mobile: ListView with padding horizontal 16, margin bottom 12 */}
      <div className="px-4 pb-6">
        {filteredActions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <FiSearch className="w-16 h-16 text-gray-400 dark:text-gray-500 mb-4 opacity-50" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No actions found</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Try a different search term</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredActions.map((action, index) => (
              <button
                key={index}
                onClick={() => handleActionClick(action.route)}
                className="w-full bg-white dark:bg-gray-800 rounded-xl p-0 shadow-none hover:shadow-md transition-all border border-gray-200 dark:border-gray-700 text-left"
                style={{ marginBottom: '12px' }}
              >
                <div className="flex items-center gap-4 p-4">
                  {/* Icon container - matching mobile: padding 8, rounded 8, primary color with 0.1 opacity */}
                  <div 
                    className="rounded-lg flex-shrink-0"
                    style={{ 
                      padding: '8px',
                      backgroundColor: `${tenant.branding.primary_color}1A`,
                      color: tenant.branding.primary_color
                    }}
                  >
                    {action.icon}
                  </div>
                  {/* Content - matching mobile: title fontWeight 600, subtitle fontSize 12 */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1" style={{ fontWeight: 600 }}>
                      {action.title}
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400" style={{ fontSize: '12px', opacity: 0.7 }}>
                      {action.subtitle}
                    </p>
                  </div>
                  {/* Chevron - matching mobile: opacity 0.5 */}
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.5 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MoreActionsScreen;
