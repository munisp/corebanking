import { useEffect, useRef, useState } from 'react';
import { FiChevronDown, FiMenu, FiMoon, FiSun, FiX } from 'react-icons/fi';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useTenantConfig } from '../hooks/useTenantConfig';
import { AppTour, useTour } from './AppTour';

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { setThemeMode, isDark } = useTheme();
  const { tenant, isFeatureEnabled } = useTenantConfig();
  const { run: tourRun, startTour, stopTour } = useTour();

  const allNavLinks = [
    { name: 'Dashboard', path: '/dashboard', feature: null },
    { name: 'Transfer', path: '/transfer', feature: 'payments' },
    { name: 'Bills', path: '/bills', feature: 'bill_payments' },
    { name: 'Savings', path: '/savings', feature: 'savings' },
    { name: 'Loans', path: '/loan-application', feature: 'loans' },
    { name: 'Active Loans', path: '/active-loans', feature: 'loans' },
    { name: 'LPOs', path: '/lpo-application', feature: 'lpo' },
    { name: 'Active LPOs', path: '/active-lpos', feature: 'lpo' },
    { name: 'Disputes', path: '/disputes', feature: 'dispute' },
    { name: 'Cards', path: '/cards', feature: 'card_management' },
    { name: 'Cheques', path: '/cheques', feature: 'payments' },
    { name: 'FX', path: '/fx', feature: 'fx' },
    { name: 'Investments', path: '/investments', feature: 'investment' },
    { name: 'Pensions', path: '/pensions', feature: 'pension' },
    { name: 'Islamic Banking', path: '/islamic-banking', feature: 'islamic_banking' },
    { name: 'QR Code', path: '/qrcode', feature: 'qr_payments' },
    { name: 'Carbon Credits', path: '/carbon-credits', feature: 'carbon_credits' },
    { name: 'Voice Banking', path: '/voice-banking', feature: null },
    { name: 'Diaspora Banking', path: '/diaspora-banking', feature: 'diaspora_banking' },
    { name: 'Remittance', path: '/remittance', feature: 'remittance' },
    { name: 'eNaira / CBDC', path: '/cbdc', feature: null },
    { name: 'Wealth Management', path: '/wealth-management', feature: 'wealth_management' },
    { name: 'History', path: '/transaction-history', feature: 'reporting' },
    { name: 'Settings', path: '/settings', feature: null },
  ];

  const navLinks = allNavLinks.filter(
    (link) => !link.feature || isFeatureEnabled(link.feature)
  );

  const toggleTheme = () => {
    setThemeMode(isDark ? 'light' : 'dark');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on route change
  useEffect(() => {
    setIsMoreOpen(false);
    setIsOpen(false);
  }, [location.pathname]);

  const navTextColor = isDark ? '#000000' : '#FFFFFF';

  const buttonBase: React.CSSProperties = {
    padding: '8px',
    borderRadius: '8px',
    border: 'none',
    background: 'transparent',
    color: navTextColor,
    cursor: 'pointer',
    transition: 'opacity 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <>
      <nav
        data-tour="nav-bar"
        className="sticky top-0 z-40 flex items-center justify-between w-full"
        style={{
          backgroundColor: 'var(--primary-color)',
          color: navTextColor,
          padding: '16px 24px',
          boxShadow: isDark
            ? '0 1px 3px rgba(0,0,0,0.3)'
            : '0 1px 3px rgba(0,0,0,0.1)',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        {/* Logo */}
        <div
          className="text-xl font-semibold flex items-center gap-2"
          style={{ color: navTextColor, fontSize: '18px', fontWeight: 600 }}
        >
          {tenant.logo && (
            <img
              src={tenant.logo}
              alt={tenant.displayName}
              className="h-8 w-8 object-contain"
            />
          )}
          {tenant.displayName}
        </div>

        {/* Desktop: theme toggle + tour help + More Actions */}
        <div className="hidden md:flex items-center gap-2">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            style={buttonBase}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            aria-label="Toggle theme"
          >
            {isDark ? <FiSun size={20} /> : <FiMoon size={20} />}
          </button>

          {/* Tour help button */}
          <button
            data-tour="tour-help"
            onClick={startTour}
            title="Start guide tour"
            style={{
              ...buttonBase,
              padding: '8px 12px',
              gap: '6px',
              border: `1px solid ${isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.3)'}`,
              borderRadius: '8px',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            aria-label="Start guide tour"
          >
            <span style={{ fontSize: '14px', fontWeight: 700, lineHeight: 1 }}>?</span>
          </button>

          {/* More Actions dropdown */}
          <div ref={moreRef} style={{ position: 'relative' }}>
            <button
              data-tour="nav-more-actions"
              onClick={() => setIsMoreOpen((prev) => !prev)}
              style={{
                ...buttonBase,
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: `1px solid ${isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.3)'}`,
                background: isMoreOpen
                  ? isDark
                    ? 'rgba(0,0,0,0.1)'
                    : 'rgba(255,255,255,0.15)'
                  : 'transparent',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              <span style={{ fontSize: '14px', fontWeight: 500 }}>More Actions</span>
              <FiChevronDown
                size={16}
                style={{
                  transition: 'transform 0.2s ease',
                  transform: isMoreOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            </button>

            {isMoreOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
                  border: `1px solid ${isDark ? '#404040' : '#E0E0E0'}`,
                  borderRadius: '12px',
                  boxShadow: isDark
                    ? '0 8px 24px rgba(0,0,0,0.5)'
                    : '0 8px 24px rgba(0,0,0,0.15)',
                  minWidth: '200px',
                  padding: '8px',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '2px',
                }}
              >
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    style={{
                      display: 'block',
                      padding: '9px 14px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: location.pathname === link.path ? 600 : 400,
                      color:
                        location.pathname === link.path
                          ? 'var(--primary-color)'
                          : isDark ? '#E3E3E3' : '#212121',
                      textDecoration: 'none',
                      backgroundColor:
                        location.pathname === link.path
                          ? isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
                          : 'transparent',
                      transition: 'background 0.15s ease, color 0.15s ease',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => {
                      if (location.pathname !== link.path) {
                        e.currentTarget.style.backgroundColor = isDark ? '#2D2D2D' : '#F3F4F6';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (location.pathname !== link.path) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    {link.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mobile: theme toggle + tour help + hamburger */}
        <div className="md:hidden flex items-center gap-2">
          <button
            onClick={toggleTheme}
            style={{ ...buttonBase, color: 'var(--text-primary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            aria-label="Toggle theme"
          >
            {isDark ? <FiSun size={20} /> : <FiMoon size={20} />}
          </button>
          <button
            data-tour="tour-help"
            onClick={startTour}
            title="Start guide tour"
            style={{ ...buttonBase, color: navTextColor, fontSize: '16px', fontWeight: 700 }}
            aria-label="Start guide tour"
          >
            ?
          </button>
          <button
            onClick={() => setIsOpen(!isOpen)}
            style={{
              ...buttonBase,
              padding: '4px',
              color: navTextColor,
            }}
          >
            {isOpen ? <FiX size={28} /> : <FiMenu size={28} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <ul
            className="absolute top-full left-0 w-full flex flex-col items-center space-y-4 py-4 md:hidden z-50"
            style={{
              backgroundColor: 'var(--surface-color)',
              boxShadow: isDark
                ? '0 4px 16px rgba(0,0,0,0.3)'
                : '0 4px 16px rgba(0,0,0,0.1)',
              borderTop: '1px solid var(--border-color)',
            }}
          >
            {navLinks.map((link) => (
              <li key={link.path}>
                <Link
                  to={link.path}
                  style={{
                    fontSize: '16px',
                    color:
                      location.pathname === link.path
                        ? 'var(--primary-color)'
                        : 'var(--text-primary)',
                    fontWeight: location.pathname === link.path ? 600 : 400,
                    textDecoration: 'none',
                    transition: 'color 0.2s ease',
                  }}
                  onClick={() => setIsOpen(false)}
                  onMouseEnter={(e) => {
                    if (location.pathname !== link.path) {
                      e.currentTarget.style.color = 'var(--primary-color)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (location.pathname !== link.path) {
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }
                  }}
                >
                  {link.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </nav>

      <AppTour run={tourRun} onFinish={stopTour} />
    </>
  );
};

export default Navigation;
