import { useState } from 'react';
import { FiArrowLeft, FiBriefcase, FiUser } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../../contexts/TenantContext';

const AccountTypeScreen = () => {
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const primaryColor = tenant.branding.primary_color || '#2563eb';
  // const backgroundColor = tenant.branding.backgroundColor || '#fff';
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const handleContinue = () => {
    if (selectedType) {
      localStorage.setItem('onboarding_account_type', selectedType);
      if (selectedType === 'business') {
        navigate('/business-details');
      } else {
        navigate('/bvn-verification', { state: { accountType: selectedType } });
      }
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col items-center p-6 relative">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 shadow-lg rounded-2xl p-8 mt-10">
        <button
          type="button"
          className="flex items-center gap-2 text-base font-semibold mb-6 focus:outline-none hover:underline"
          style={{ color: primaryColor }}
          onClick={() => navigate('/onboarding-start')}
        >
          <FiArrowLeft size={20} />
          Back
        </button>
        <h1 className="text-3xl font-extrabold mb-2 text-primary-900 dark:text-primary-100 tracking-tight">Select Account Type</h1>
        <p className="text-base font-medium text-gray-800 dark:text-gray-200 mb-8">Choose the type of account that best fits your needs.</p>
        <div className="space-y-4 mb-6">
          <div
            onClick={() => setSelectedType('individual')}
            className="flex items-start rounded-xl cursor-pointer px-4 py-5"
            style={{
              border: `2px solid ${selectedType === 'individual' ? primaryColor : '#e5e7eb'}`,
              background: selectedType === 'individual' ? primaryColor + '10' : '#fff',
            }}
          >
            <div className="p-3 rounded-xl mr-4" style={{ background: selectedType === 'individual' ? primaryColor + '20' : '#f3f4f6' }}>
              <FiUser size={28} color={selectedType === 'individual' ? primaryColor : '#666'} />
            </div>
            <div>
              <h3
                className={`text-xl font-bold mb-1 ${selectedType === 'individual' ? '' : 'text-primary-900 dark:text-primary-100'}`}
                style={selectedType === 'individual' ? { color: primaryColor } : {}}
              >
                Individual Account
              </h3>
              <p className={`text-base font-semibold mb-2 ${selectedType === 'individual' ? '' : 'text-gray-800 dark:text-gray-200'}`} style={selectedType === 'individual' ? { color: primaryColor } : {}}>
                For personal banking needs
              </p>
              <ul className={`text-sm pl-4 list-disc font-medium ${selectedType === 'individual' ? '' : 'text-gray-900 dark:text-gray-100'}`} style={selectedType === 'individual' ? { color: primaryColor } : {}}>
                <li>Personal savings and transactions</li>
                <li>Bill payments and transfers</li>
                <li>Loan applications up to ₦5M</li>
              </ul>
            </div>
          </div>
          <div
            onClick={() => setSelectedType('business')}
            className="flex items-start rounded-xl cursor-pointer px-4 py-5"
            style={{
              border: `2px solid ${selectedType === 'business' ? primaryColor : '#e5e7eb'}`,
              background: selectedType === 'business' ? primaryColor + '10' : '#fff',
            }}
          >
            <div className="p-3 rounded-xl mr-4" style={{ background: selectedType === 'business' ? primaryColor + '20' : '#f3f4f6' }}>
              <FiBriefcase size={28} color={selectedType === 'business' ? primaryColor : '#666'} />
            </div>
            <div>
              <h3
                className={`text-xl font-bold mb-1 ${selectedType === 'business' ? '' : 'text-primary-900 dark:text-primary-100'}`}
                style={selectedType === 'business' ? { color: primaryColor } : {}}
              >
                Business Account
              </h3>
              <p className={`text-base font-semibold mb-2 ${selectedType === 'business' ? '' : 'text-gray-800 dark:text-gray-200'}`} style={selectedType === 'business' ? { color: primaryColor } : {}}>
                For companies and organizations
              </p>
              <ul className={`text-sm pl-4 list-disc font-medium ${selectedType === 'business' ? '' : 'text-gray-900 dark:text-gray-100'}`} style={selectedType === 'business' ? { color: primaryColor } : {}}>
                <li>Business banking and payroll</li>
                <li>LPO financing and invoicing</li>
                <li>Higher transaction limits</li>
              </ul>
            </div>
          </div>
        </div>
        <button
          className="w-full h-14 rounded-xl font-bold text-lg mt-6"
          style={{ background: primaryColor, color: '#fff' }}
          disabled={!selectedType}
          onClick={handleContinue}
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default AccountTypeScreen;
