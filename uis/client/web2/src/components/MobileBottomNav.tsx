import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTenantConfig } from '../hooks/useTenantConfig';
import { useTheme } from '../contexts/ThemeContext';

interface NavItem {
  label: string;
  path: string;
  matchPaths: string[];
  icon: (active: boolean, color: string) => React.ReactNode;
}

const items: NavItem[] = [
  {
    label: 'Home',
    path: '/dashboard',
    matchPaths: ['/dashboard'],
    icon: (active, color) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? color : 'none'} stroke={active ? color : 'currentColor'} strokeWidth={active ? 0 : 1.75} xmlns="http://www.w3.org/2000/svg">
        {active ? (
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        )}
      </svg>
    ),
  },
  {
    label: 'Transactions',
    path: '/transaction-history',
    matchPaths: ['/transaction-history', '/transaction', '/receipt', '/bank-statement'],
    icon: (active, color) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? color : 'none'} stroke={active ? color : 'currentColor'} strokeWidth={active ? 0 : 1.75} xmlns="http://www.w3.org/2000/svg">
        {active ? (
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        )}
      </svg>
    ),
  },
  {
    label: 'Savings',
    path: '/savings',
    matchPaths: ['/savings'],
    icon: (active, color) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? color : 'none'} stroke={active ? color : 'currentColor'} strokeWidth={active ? 0 : 1.75} xmlns="http://www.w3.org/2000/svg">
        {active ? (
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14H11V8h2v8zm0-10H11V4h2v2z" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        )}
      </svg>
    ),
  },
  {
    label: 'Settings',
    path: '/settings',
    matchPaths: ['/settings', '/support', '/faq', '/network-monitor'],
    icon: (active, color) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? color : 'none'} stroke={active ? color : 'currentColor'} strokeWidth={active ? 0 : 1.75} xmlns="http://www.w3.org/2000/svg">
        {active ? (
          <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96a7.04 7.04 0 00-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87a.49.49 0 00.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 00-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        )}
        {!active && <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />}
      </svg>
    ),
  },
];

const MobileBottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { tenant } = useTenantConfig();
  const { isDark } = useTheme();
  const primaryColor = tenant.branding.primary_color;

  const isActive = (item: NavItem) =>
    item.matchPaths.some(p => location.pathname === p || location.pathname.startsWith(p + '/'));

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around"
      style={{
        height: 70,
        paddingBottom: 'env(safe-area-inset-bottom)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        backgroundColor: isDark ? 'rgba(30,30,30,0.85)' : 'rgba(255,255,255,0.85)',
        borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        boxShadow: isDark ? '0 -4px 20px rgba(0,0,0,0.3)' : '0 -4px 20px rgba(0,0,0,0.08)',
      }}
    >
      {items.map(item => {
        const active = isActive(item);
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all"
            style={{ color: active ? primaryColor : isDark ? '#9CA3AF' : '#6B7280' }}
          >
            <div
              className="transition-transform"
              style={{ transform: active ? 'scale(1.05)' : 'scale(1)' }}
            >
              {item.icon(active, primaryColor)}
            </div>
            <span
              className="text-[10px] font-medium leading-none"
              style={{ color: active ? primaryColor : isDark ? '#9CA3AF' : '#6B7280', fontWeight: active ? 700 : 500 }}
            >
              {item.label}
            </span>
            {active && (
              <div
                className="absolute bottom-0 w-1 h-1 rounded-full"
                style={{ backgroundColor: primaryColor }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
};

export default MobileBottomNav;
