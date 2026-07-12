import { FiArrowLeft } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useTenantConfig } from '../../../hooks/useTenantConfig';

const SupportScreen = () => {
  const navigate = useNavigate();
  const { tenant } = useTenantConfig();
  const contact = tenant.contact;

  const supportOptions = [
    {
      id: 1,
      title: 'Chat with Support',
      description: 'Get instant help from our support team',
      icon: '💬',
      action: 'chat',
    },
    {
      id: 2,
      title: 'Call Hotline',
      description: `24/7 customer service: ${contact.phone}`,
      icon: '📞',
      action: 'call',
    },
    {
      id: 3,
      title: 'Email Support',
      description: contact.email,
      icon: '✉️',
      action: 'email',
    },
    {
      id: 4,
      title: 'Visit Branch',
      description: contact.address || 'Find nearest branch location',
      icon: '🏢',
      action: 'branch',
    },
  ];

  const handleAction = (action: string) => {
    switch (action) {
      case 'chat':
        if (contact.supportUrl) {
          window.open(contact.supportUrl, '_blank');
        } else {
          alert('Opening chat support - integration needed');
        }
        break;
      case 'call':
        window.location.href = `tel:${contact.phone.replace(/\D/g, '')}`;
        break;
      case 'email':
        window.location.href = `mailto:${contact.email}`;
        break;
      case 'branch':
        alert('Branch locator - integration needed');
        break;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Back Button */}
        <div className="mb-4">
          <button
            onClick={() => navigate('/settings')}
            className="flex items-center text-gray-700 hover:text-[var(--primary-color)] transition"
          >
            <FiArrowLeft size={20} className="mr-2" />
            Back to Settings
          </button>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Customer Support</h1>
        <p className="text-gray-600 mb-6">How can we help you today?</p>

        <div className="grid gap-4 mb-6">
          {supportOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => handleAction(option.action)}
              className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-all text-left"
            >
              <div className="flex items-start gap-4">
                <div className="text-4xl">{option.icon}</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800 mb-1">{option.title}</h3>
                  <p className="text-sm text-gray-600">{option.description}</p>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>

        {/* Quick Links */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4">Quick Links</h2>
          <div className="space-y-3">
            <a href="/faq" className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <span className="text-gray-700">Frequently Asked Questions</span>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
            <a href="/settings" className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <span className="text-gray-700">Account Settings</span>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>

        {/* Operating Hours */}
        <div className="mt-6 border rounded-xl p-4" style={{ backgroundColor: 'var(--primary-color)10', borderColor: 'var(--primary-color)' }}>
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 mt-0.5" fill="currentColor" viewBox="0 0 20 20" style={{ color: 'var(--primary-color)' }}>
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            <div className="text-sm" style={{ color: 'var(--primary-color)' }}>
              <p className="font-semibold mb-1">Operating Hours</p>
              <p>Monday - Friday: 8:00 AM - 6:00 PM</p>
              <p>Saturday: 9:00 AM - 2:00 PM</p>
              <p>Sunday: Closed (Emergency hotline available)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportScreen;
