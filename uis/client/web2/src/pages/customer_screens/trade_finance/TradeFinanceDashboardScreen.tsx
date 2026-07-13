import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiGlobe, FiFileText, FiShield, FiList, FiInfo, FiChevronRight } from 'react-icons/fi';
import { useTenantConfig } from '../../../hooks/useTenantConfig';

interface Product {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  route: string;
  accentColor: string;
}

const TradeFinanceDashboardScreen: React.FC = () => {
  const navigate = useNavigate();
  const { tenant } = useTenantConfig();

  const products: Product[] = [
    {
      icon: <FiFileText size={26} />,
      title: 'Letters of Credit',
      subtitle: 'LC issuance, SWIFT MT700 & amendments',
      route: '/trade-finance/lc',
      accentColor: '#059669',
    },
    {
      icon: <FiShield size={26} />,
      title: 'Bank Guarantees',
      subtitle: 'Performance, payment & bid bond guarantees',
      route: '/trade-finance/bank-guarantees',
      accentColor: '#0369A1',
    },
    {
      icon: <FiList size={26} />,
      title: 'Export Factoring',
      subtitle: 'Invoice discounting & receivables financing',
      route: '/trade-finance/factoring',
      accentColor: '#7C3AED',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* AppBar */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <FiChevronRight className="rotate-180 w-5 h-5 text-gray-700 dark:text-gray-200" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Trade Finance</h1>
        </div>
      </div>

      <div className="p-5 space-y-7">
        {/* Hero banner */}
        <div
          className="w-full rounded-3xl p-6 relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, #065F46, #059669, ${tenant.branding.primary_color}CC)`,
            boxShadow: '0 8px 20px rgba(6,95,70,0.3)',
          }}
        >
          <div className="p-3 rounded-2xl bg-white/20 inline-flex mb-4">
            <FiGlobe size={32} color="white" />
          </div>
          <h2 className="text-white text-2xl font-extrabold mb-1.5">Trade Finance</h2>
          <p className="text-white/85 text-sm leading-relaxed">
            Letters of credit, bank guarantees,<br />
            export factoring & supply chain finance
          </p>
        </div>

        {/* Products */}
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white tracking-wide mb-4">Products</h3>
          <div className="space-y-3.5">
            {products.map((product) => (
              <button
                key={product.route}
                onClick={() => navigate(product.route)}
                className="w-full text-left bg-white dark:bg-gray-800 rounded-2xl p-[18px] flex items-center gap-4 transition-shadow hover:shadow-md"
                style={{
                  border: `1.5px solid ${product.accentColor}26`,
                  boxShadow: `0 4px 16px ${product.accentColor}0F, 0 2px 8px rgba(0,0,0,0.04)`,
                }}
              >
                {/* Icon */}
                <div
                  className="rounded-2xl p-3.5 flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${product.accentColor}26, ${product.accentColor}14)`,
                    color: product.accentColor,
                  }}
                >
                  {product.icon}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold text-gray-900 dark:text-white">{product.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug">{product.subtitle}</p>
                </div>

                {/* Chevron */}
                <FiChevronRight size={16} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Info section */}
        <div
          className="rounded-2xl p-4"
          style={{ backgroundColor: '#05966914', border: '1px solid #05966933' }}
        >
          <div className="flex items-center gap-2 mb-2.5">
            <FiInfo size={18} color="#059669" />
            <span className="font-bold text-[13px] text-gray-900 dark:text-white">About Trade Finance</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Trade finance instruments facilitate domestic and international commerce by reducing payment
            risk between buyers and sellers.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TradeFinanceDashboardScreen;
