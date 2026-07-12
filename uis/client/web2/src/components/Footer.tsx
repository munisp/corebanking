// ...existing code...
import { FiFacebook, FiInstagram, FiLinkedin, FiTwitter } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import AICPA from "../assets/certifications/aicpa.png";
import ISO from "../assets/certifications/iso.png";
import NIST from "../assets/certifications/nist.png";
import PCI from "../assets/certifications/pci.png";
import { useTheme } from '../contexts/ThemeContext';
import { useTenantConfig } from '../hooks/useTenantConfig';

const Footer = () => {
  const { tenant, isFeatureEnabled } = useTenantConfig();
  const { isDark } = useTheme();
  const contact = tenant.contact;
  const socialMedia = contact.socialMedia;

  return (
    <footer className="text-white" style={{ 
      backgroundColor: isDark ? '#1f2937' : 'var(--primary-color)'
    }}>
      <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row justify-between">
        {/* Logo & Description */}
        <div className="mb-8 md:mb-0">
          <h2 className="text-2xl font-bold mb-2">{tenant.displayName}</h2>
          <p className="text-gray-200 dark:text-gray-400 max-w-xs">
            Your trusted banking partner. Secure, fast, and reliable transactions.
          </p>
          {contact.email && (
            <p className="text-gray-200 dark:text-gray-400 mt-2">
              Email: {contact.email}
            </p>
          )}
          {contact.phone && (
            <p className="text-gray-200 dark:text-gray-400">
              Phone: {contact.phone}
            </p>
          )}
        </div>

        {/* Navigation Links */}
        <div className="flex flex-col md:flex-row md:space-x-12 mb-8 md:mb-0">
          <div className="mb-6 md:mb-0">
            <h3 className="font-semibold mb-2">Products</h3>
            <ul className="space-y-1 text-gray-200 dark:text-gray-400">
              <li><Link to="/dashboard" className="hover:text-white dark:hover:text-gray-200">Dashboard</Link></li>
              {isFeatureEnabled('payments') && (
                <li><Link to="/transfer" className="hover:text-white dark:hover:text-gray-200">Transfer</Link></li>
              )}
              <li><Link to="/bills" className="hover:text-white dark:hover:text-gray-200">Bills</Link></li>
              {isFeatureEnabled('loans') && (
                <li><Link to="/loan-Application" className="hover:text-white dark:hover:text-gray-200">Loans</Link></li>
              )}
              {isFeatureEnabled('insurance') && (
                <li><Link to="/insurance" className="hover:text-white dark:hover:text-gray-200">Insurance</Link></li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Company</h3>
            <ul className="space-y-1 text-gray-200 dark:text-gray-400">
              <li><Link to="/settings" className="hover:text-white dark:hover:text-gray-200">Settings</Link></li>
              <li><Link to="/notifications" className="hover:text-white dark:hover:text-gray-200">Notifications</Link></li>
              <li><Link to="/bank-details" className="hover:text-white dark:hover:text-gray-200">Bank Details</Link></li>
              <li><Link to="/transaction-history" className="hover:text-white dark:hover:text-gray-200">Transaction History</Link></li>
              {contact.supportUrl && (
                <li><a href={contact.supportUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white dark:hover:text-gray-200">Support</a></li>
              )}
            </ul>
          </div>
        </div>

        {/* Social Icons */}
        <div className="flex space-x-4 text-2xl justify-center md:justify-start">
          {socialMedia?.facebook && (
            <a href={socialMedia.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-gray-200 dark:hover:text-gray-400"><FiFacebook /></a>
          )}
          {socialMedia?.twitter && (
            <a href={socialMedia.twitter} target="_blank" rel="noopener noreferrer" className="hover:text-gray-200 dark:hover:text-gray-400"><FiTwitter /></a>
          )}
          {socialMedia?.instagram && (
            <a href={socialMedia.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-gray-200 dark:hover:text-gray-400"><FiInstagram /></a>
          )}
          {socialMedia?.linkedin && (
            <a href={socialMedia.linkedin} target="_blank" rel="noopener noreferrer" className="hover:text-gray-200 dark:hover:text-gray-400"><FiLinkedin /></a>
          )}
        </div>
      </div>

      {/* Compliance Certificates */}
      <div className="flex justify-center gap-4 py-4">
        <img src={AICPA} alt="AICPA" className="h-24 w-auto" />
        <img src={ISO} alt="ISO" className="h-24 w-auto" />
        <img src={NIST} alt="NIST" className="h-24 w-auto" />
        <img src={PCI} alt="PCI" className="h-24 w-auto" />
      </div>
      <div className="bg-[var(--primary-color)] dark:bg-gray-950 text-gray-300 dark:text-gray-500 text-center py-4 text-sm">
        &copy; {new Date().getFullYear()} {tenant.displayName}. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
