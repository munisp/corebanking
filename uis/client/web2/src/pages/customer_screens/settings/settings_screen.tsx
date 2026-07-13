import { useEffect, useState } from "react";
import { BiSupport } from "react-icons/bi";
import {
  FiBell, FiCheckCircle, FiChevronRight, FiCloud, FiGlobe,
  FiHelpCircle, FiInfo, FiLock, FiLogOut, FiMoon, FiShield,
  FiUser
} from "react-icons/fi";
import { MdFingerprint, MdOutlinePin } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { useTenantConfig } from '../../../hooks/useTenantConfig';
import { usePageTitle } from '../../../hooks/usePageTitle';
import { useTheme } from '../../../contexts/ThemeContext';
import { useTier } from "../../../contexts/TierContext";
import { AuthService } from "../../../services/auth_service";
import { BiometricService } from "../../../services/biometric_service";

const LANGUAGES: Record<string, string> = {
  en: 'English', yo: 'Yorùbá', ig: 'Igbo', ha: 'Hausa',
  fr: 'Français', ar: 'العربية', sw: 'Kiswahili', pt: 'Português',
};

export default function Settings() {
  const navigate = useNavigate();
  const biometricService = new BiometricService();
  const authService = new AuthService();
  const { tierStatus } = useTier();
  const { tenant } = useTenantConfig();
  const { isDark, setThemeMode } = useTheme();
  usePageTitle('Settings');

  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const user = authService.getUser();
  const isVerified = tierStatus.tier >= 2;
  const hasBVN = tierStatus.hasBVN ?? false;
  const currentLang = localStorage.getItem('app_language') || 'en';

  useEffect(() => {
    biometricService.isEnabled().then(setBiometricEnabled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleBiometric = async (value: boolean) => {
    if (value) {
      const success = await biometricService.authenticate();
      if (success) {
        await biometricService.enable();
        setBiometricEnabled(true);
      }
    } else {
      await biometricService.disable();
      setBiometricEnabled(false);
    }
  };

  const handleLogout = async () => {
    if (!window.confirm("Are you sure you want to logout?")) return;
    await authService.logout();
    navigate('/login');
  };

  const primary = tenant.branding.primary_color;
  const secondary = tenant.branding.secondary_color || primary;
  const initials = user?.fullName?.charAt(0).toUpperCase() || 'U';

  return (
    <div className="w-full min-h-screen bg-gray-100 dark:bg-gray-900">

      {/* Gradient Header with Profile */}
      <div
        className="relative pb-10 rounded-b-[32px] shadow-lg"
        style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
      >
        <div className="max-w-2xl mx-auto px-6 pt-6 pb-8 flex flex-col items-center text-center">
          {/* Avatar */}
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold text-white mb-4"
            style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              border: '3px solid rgba(255,255,255,0.35)',
            }}
          >
            {tenant.logo
              ? <img src={tenant.logo} alt="" className="w-16 h-16 object-contain rounded-full" />
              : initials}
          </div>

          <h2 className="text-2xl font-bold text-white tracking-wide">
            {user?.fullName || 'User'}
          </h2>
          <p className="text-white/80 text-sm mt-1">{user?.email || ''}</p>

          {isVerified && (
            <div className="mt-3 flex items-center space-x-1.5 px-4 py-1.5 rounded-full text-white text-xs font-semibold"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)' }}>
              <FiCheckCircle className="w-3.5 h-3.5" />
              <span>Verified Account</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 pb-10 space-y-4">

        {/* Verification & Limits */}
        <SettingsSection title="Verification & Limits">
          <SettingsItem
            icon={<FiShield />}
            primary={primary}
            title={isVerified ? "KYC Verified" : "Complete KYC"}
            subtitle={isVerified ? "Your KYC is verified" : "Increase limits & unlock features"}
            trailing={
              isVerified
                ? <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 font-semibold flex items-center space-x-1"><FiCheckCircle className="w-3 h-3 mr-1" />Verified</span>
                : <span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 font-semibold">Action Required</span>
            }
            onClick={isVerified ? undefined : () => navigate('/kyc-face-verification')}
          />
          <SettingsItem
            icon={<span className="text-base">🪪</span>}
            primary={primary}
            title="BVN Verification"
            subtitle={hasBVN ? "BVN verified" : "Update or verify your BVN"}
            trailing={
              hasBVN
                ? <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 font-semibold flex items-center space-x-1"><FiCheckCircle className="w-3 h-3 mr-1" />Verified</span>
                : undefined
            }
            onClick={hasBVN ? undefined : () => navigate('/bvn-verification')}
          />
        </SettingsSection>

        {/* Account */}
        <SettingsSection title="Account">
          <SettingsItem icon={<FiUser />} primary={primary} title="Profile" subtitle="Edit your personal info" onClick={() => navigate('/complete-profile')} />
          <SettingsItem icon={<FiLock />} primary={primary} title="Change Password" subtitle="Update your password" onClick={() => navigate('/change-password')} />
        </SettingsSection>

        {/* Appearance */}
        <SettingsSection title="Appearance">
          <SettingsSwitchItem
            icon={<FiMoon />}
            primary={primary}
            title="Dark Mode"
            subtitle="Light and dark theme"
            value={isDark}
            onChange={(v) => setThemeMode(v ? 'dark' : 'light')}
          />
          <SettingsItem
            icon={<FiGlobe />}
            primary={primary}
            title="Language"
            subtitle={LANGUAGES[currentLang] || 'English'}
            onClick={() => navigate('/settings/language')}
          />
        </SettingsSection>

        {/* Security */}
        <SettingsSection title="Security">
          <SettingsSwitchItem
            icon={<MdFingerprint />}
            primary={primary}
            title="Biometric Login"
            subtitle="Fingerprint or Face ID"
            value={biometricEnabled}
            onChange={toggleBiometric}
          />
          <SettingsItem
            icon={<MdOutlinePin />}
            primary={primary}
            title="Transaction PIN"
            subtitle="Manage your PIN"
            onClick={() => navigate('/create-pin')}
          />
        </SettingsSection>

        {/* Notifications */}
        <SettingsSection title="Notifications">
          <SettingsSwitchItem
            icon={<FiBell />}
            primary={primary}
            title="Push Notifications"
            subtitle="Receive transaction alerts"
            value={notificationsEnabled}
            onChange={setNotificationsEnabled}
          />
        </SettingsSection>

        {/* Support & Info */}
        <SettingsSection title="Support & Info">
          <SettingsItem icon={<FiHelpCircle />} primary={primary} title="FAQ" subtitle="Common questions" onClick={() => navigate('/faq')} />
          <SettingsItem icon={<BiSupport />} primary={primary} title="Contact Support" subtitle="Get help from us" onClick={() => navigate('/support')} />
          <SettingsItem icon={<FiCloud />} primary={primary} title="Network Status" subtitle="Service status" onClick={() => navigate('/network-monitor')} />
          <SettingsItem
            icon={<FiInfo />}
            primary={primary}
            title={`About ${tenant.displayName || tenant.name}`}
            subtitle="App information"
            onClick={() => alert(`${tenant.displayName || tenant.name}\nVersion 1.0.0\n\nSecure digital banking platform`)}
          />
        </SettingsSection>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full py-4 rounded-2xl border-2 border-red-500 text-red-600 dark:text-red-400 font-semibold flex items-center justify-center space-x-2 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors mt-2"
        >
          <FiLogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>

        <p className="text-center text-gray-400 dark:text-gray-600 text-xs pb-4">
          Version 1.0.0
        </p>
      </div>
    </div>
  );
}

/* ─── Reusable Components ─── */

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1 mb-2">{title}</p>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">
        {children}
      </div>
    </div>
  );
}

function SettingsItem({
  icon, primary, title, subtitle, trailing, onClick,
}: {
  icon: React.ReactNode;
  primary: string;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3.5 ${onClick ? 'hover:bg-gray-50 dark:hover:bg-gray-700/50 active:bg-gray-100 transition-colors' : 'opacity-90'}`}
    >
      <div className="flex items-center space-x-3">
        <span className="text-xl w-8 h-8 flex items-center justify-center rounded-xl" style={{ color: primary, backgroundColor: `${primary}18` }}>
          {icon}
        </span>
        <div className="text-left">
          <p className="text-sm font-medium text-gray-900 dark:text-white">{title}</p>
          {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center space-x-2">
        {trailing}
        {onClick && <FiChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />}
      </div>
    </Tag>
  );
}

function SettingsSwitchItem({
  icon, primary, title, subtitle, value, onChange,
}: {
  icon: React.ReactNode;
  primary: string;
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <div className="flex items-center space-x-3">
        <span className="text-xl w-8 h-8 flex items-center justify-center rounded-xl" style={{ color: primary, backgroundColor: `${primary}18` }}>
          {icon}
        </span>
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">{title}</p>
          {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
        <div
          className="w-11 h-6 rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:h-5 after:w-5 after:rounded-full after:transition-all peer-checked:after:translate-x-5"
          style={{ backgroundColor: value ? primary : '#D1D5DB' }}
        />
      </label>
    </div>
  );
}
