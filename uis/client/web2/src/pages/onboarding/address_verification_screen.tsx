import { useState } from 'react';
import { FiArrowLeft } from 'react-icons/fi';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTier } from '../../contexts/TierContext';

const AddressVerificationScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // const accountType = (location.state as any)?.accountType || 'individual';
  const { updateTierStatus } = useTier();
  
  // Check if this is from KYC (settings) or onboarding
  const isFromKYC = location.pathname.includes('/kyc-');

  const [formData, setFormData] = useState({
    address: '',
    city: '',
    state: '',
    postalCode: '',
  });

  const nigerianStates = [
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
    'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
    'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi',
    'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun',
    'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Store address data for later use in customer creation (no API call)
    if (formData.address && formData.city && formData.state) {
      localStorage.setItem('onboarding_address', formData.address);
      localStorage.setItem('onboarding_city', formData.city);
      localStorage.setItem('onboarding_state', formData.state);
      if (formData.postalCode) {
        localStorage.setItem('onboarding_postal_code', formData.postalCode);
      }
    }
    if (isFromKYC) {
      // Update tier status when address verified from KYC
      updateTierStatus({ hasAddress: true });
      alert('Address verified successfully! Your account has been upgraded to Tier 3 - Full Access.');
      navigate('/settings');
    } else {
      // Onboarding flow: call orchestrator, then go to completion screen
      try {
        const address    = localStorage.getItem('onboarding_address')    || formData.address;
        const city       = localStorage.getItem('onboarding_city')       || formData.city;
        const stateVal   = localStorage.getItem('onboarding_state')      || formData.state;
        const postalCode = localStorage.getItem('onboarding_postal_code')|| formData.postalCode || '';
        const email      = localStorage.getItem('onboarding_email')      || '';
        const phone      = localStorage.getItem('onboarding_phone')      || '';
        const firstName  = localStorage.getItem('onboarding_firstName')  || '';
        const lastName   = localStorage.getItem('onboarding_lastName')   || '';
        const uin        = localStorage.getItem('onboarding_uin') || localStorage.getItem('onboarding_bvn') || '';
        const password   = localStorage.getItem('onboarding_password')   || '';
        const accountType = localStorage.getItem('onboarding_account_type') || 'individual';

        let tenantId = localStorage.getItem('tenantId') || localStorage.getItem('onboarding_tenantId') || '';
        if (!tenantId) {
          const tenantConfigStr = localStorage.getItem('tenant_config');
          if (tenantConfigStr) {
            try {
              const tenantConfig = JSON.parse(tenantConfigStr);
              tenantId = tenantConfig.tenant_id || tenantConfig.id || '';
              if (tenantId) localStorage.setItem('onboarding_tenantId', tenantId);
            } catch { /* ignore */ }
          }
        }

        const { apiService } = await import('../../services/api_service');
        type OnboardingResponse = { verification?: string };

        let response;
        if (accountType === 'business') {
          const businessName = localStorage.getItem('onboarding_business_name') || '';
          const tin          = localStorage.getItem('onboarding_tin')           || '';
          const cac          = localStorage.getItem('onboarding_cac')           || '';
          response = await apiService.post<OnboardingResponse>('/orchestrator/business', {
            email, firstName, lastName, phone, uin, password,
            businessName, tin, cac,
            address, city, state: stateVal, postalCode,
            tenantId,
          });
        } else {
          response = await apiService.post<OnboardingResponse>('/orchestrator/customer', {
            email, firstName, lastName, phone, uin, password,
            address, city, state: stateVal, postalCode,
            tenantId,
          });
        }

        const verificationLink = response?.data?.verification;
        navigate('/onboarding-completion', { state: { verificationLink, accountType } });
      } catch {
        const accountType = localStorage.getItem('onboarding_account_type') || 'individual';
        navigate('/onboarding-completion', { state: { accountType } });
      }
    }
  };

  // handleSkip is not used. Remove or implement if needed.

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Back Button */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-700 dark:text-gray-300 hover:text-(--primary-color) dark:hover:text-(--primary-color) transition"
          >
            <FiArrowLeft size={20} className="mr-2" />
            Back
          </button>
        </div>

        {/* Progress */}
        <div className="mb-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Step 5 of 5 - Address Verification</p>
          <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-(--primary-color) w-full"></div>
          </div>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">Verify Your Address</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Provide your current residential address
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 mb-8">
          {/* Street Address */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Street Address
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Enter your house address"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-(--primary-color) focus:border-transparent bg-transparent dark:text-white"
            />
          </div>

          {/* City */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              City
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="Enter city"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-(--primary-color) focus:border-transparent bg-transparent dark:text-white"
            />
          </div>

          {/* State */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              State
            </label>
            <select
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-(--primary-color) focus:border-transparent bg-transparent dark:bg-gray-800 dark:text-white"
            >
              <option value="">Select state</option>
              {nigerianStates.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </div>

          {/* Postal Code */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Postal Code
            </label>
            <input
              type="text"
              value={formData.postalCode}
              onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
              placeholder="Enter postal code (optional)"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-(--primary-color) focus:border-transparent bg-transparent dark:text-white"
            />
          </div>


          {/* Submit Button */}
          <div className="space-y-3">
          <button
            type="submit"
            className="w-full btn-primary py-4 rounded-xl font-semibold shadow-lg"
          >
              Continue
            </button>
            {/* <button
              type="button"
              onClick={handleSkip}
              className="w-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 py-4 rounded-xl font-semibold transition-colors"
            >
              Skip for now
          </button> */}
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddressVerificationScreen;
