import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppConfig } from '../../../config/app_config';
import { User } from '../../../models/user';
import { apiService } from '../../../services/api_service';

const CreatePinScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePinInput = (digit: string) => {
    if (isConfirming) {
      if (confirmPin.length < 4) {
        const newConfirmPin = confirmPin + digit;
        setConfirmPin(newConfirmPin);
        if (newConfirmPin.length === 4) {
          validatePin(newConfirmPin);
        }
      }
    } else {
      if (pin.length < 4) {
        const newPin = pin + digit;
        setPin(newPin);
        if (newPin.length === 4) {
          setIsConfirming(true);
        }
      }
    }
  };

  const handleDelete = () => {
    if (isConfirming) {
      setConfirmPin(confirmPin.slice(0, -1));
    } else {
      setPin(pin.slice(0, -1));
    }
  };

  const validatePin = async (confirmValue: string) => {
    if (pin !== confirmValue) {
      setError('PINs do not match. Please try again.');
      setPin('');
      setConfirmPin('');
      setIsConfirming(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Check if keycloak_id exists (user already created in Keycloak)
      const keycloakIdStr = localStorage.getItem('keycloak_id');
      
      if (keycloakIdStr) {
        // Flow 1: User already exists in Keycloak, only create PIN
        let keycloakData: any;
        let customerId: string;

        try {
          // Try to parse as JSON first
          keycloakData = JSON.parse(keycloakIdStr);
          customerId = keycloakData.id || keycloakData.customerId || keycloakData.userId;
        } catch (parseError) {
          // If parsing fails, assume it's a plain string ID
          console.log('keycloak_id is not JSON, treating as plain string:', keycloakIdStr);
          customerId = keycloakIdStr.trim();
        }
        
        if (!customerId) {
          throw new Error('Customer ID not found. Please start registration again.');
        }

        console.log('Using Keycloak flow with customer ID:', customerId);

        // Submit PIN to dedicated endpoint
        const pinResponse = await apiService.post(`${AppConfig.accountEndpoint}/account/setup-pin`, {
          pin: pin,
        });

        if (pinResponse.status !== 201 && pinResponse.status !== 200) {
          const data = pinResponse.data as { message?: string; data?: any };
          throw new Error((data && data.message) || 'Failed to set PIN');
        }

        const data = pinResponse.data as { data?: any };
        const pinData = (data && data.data) || data;
        
        // Clear keycloak_id and other onboarding data
        localStorage.removeItem('keycloak_id');
        localStorage.removeItem('onboarding_account_type');
        localStorage.removeItem('onboarding_bvn');
        localStorage.removeItem('onboarding_address');
        localStorage.removeItem('onboarding_city');
        localStorage.removeItem('onboarding_state');
        localStorage.removeItem('onboarding_postal_code');

        // Navigate to external KYC verification link or success page
        const verificationUrl = pinData.verification;
        if (verificationUrl) {
          window.location.href = verificationUrl;
        } else {
          navigate('/pin-created');
        }
      } else {
        // Flow 2: Normal flow - create customer and then PIN
        console.log('Using normal flow - creating customer first');
        
        const onboardingDataStr = localStorage.getItem('onboarding_data');
        if (!onboardingDataStr) {
          throw new Error('Onboarding data not found. Please start registration again.');
        }
        
        let onboardingData: any;
        try {
          onboardingData = JSON.parse(onboardingDataStr);
        } catch (parseError) {
          console.error('Failed to parse onboarding data:', parseError);
          console.error('Raw onboarding data:', onboardingDataStr);
          throw new Error('Invalid onboarding data. Please start registration again.');
        }

        // Get additional onboarding data from location state or localStorage
        const accountType = (location.state as any)?.accountType || localStorage.getItem('onboarding_account_type') || 'individual';
        const bvn = (location.state as any)?.bvn || localStorage.getItem('onboarding_bvn') || '';
        const address = (location.state as any)?.address || localStorage.getItem('onboarding_address') || '';
        const city = (location.state as any)?.city || localStorage.getItem('onboarding_city') || '';
        const state = (location.state as any)?.state || localStorage.getItem('onboarding_state') || '';
        const postalCode = (location.state as any)?.postalCode || localStorage.getItem('onboarding_postal_code') || '';

        // Step 1: Create customer or business account with onboarding data (without PIN)
        let customerResponse;
        if (accountType === 'business') {
          const businessName = localStorage.getItem('onboarding_business_name') || '';
          const tin = localStorage.getItem('onboarding_tin') || '';
          const cac = localStorage.getItem('onboarding_cac') || '';

          if (!businessName || !tin || !cac) {
            throw new Error('Business details incomplete. Please restart the business registration.');
          }

          customerResponse = await apiService.post(`${AppConfig.orchestratorEndpoint}/business`, {
            email: onboardingData.email,
            password: onboardingData.password,
            firstName: onboardingData.firstName,
            lastName: onboardingData.lastName,
            phone: onboardingData.phoneNumber,
            uin: onboardingData.uin || undefined,
            businessName,
            tin,
            cac,
            address: address || '',
            city: city || '',
            state: state || '',
            postalCode: postalCode || '',
          });
        } else {
          customerResponse = await apiService.post(`${AppConfig.orchestratorEndpoint}/customer`, {
            email: onboardingData.email,
            password: onboardingData.password,
            firstName: onboardingData.firstName,
            lastName: onboardingData.lastName,
            phone: onboardingData.phoneNumber,
            accountType,
            bvn: bvn || undefined,
            uin: onboardingData.uin || undefined,
            address: address || '',
            city: city || '',
            state: state || '',
            postalCode: postalCode || '',
            country: 'Nigeria',
          });
        }

        if (customerResponse.status !== 201 && customerResponse.status !== 200) {
          const data = customerResponse.data as { message?: string; data?: any };
          throw new Error((data && data.message) || 'Failed to create customer');
        }

        const data = customerResponse.data as { data?: any };
        const customerData = (data && data.data) || data;
        
        // Store user data if available
        if (customerData.user) {
          const user = User.fromJson(customerData.user);
          localStorage.setItem('user_data', JSON.stringify(user.toJson()));
        }

        // Get customerId or userId for PIN submission
        const customerId = customerData.customer?.id || customerData.user?.id || customerData.id;
        
        if (!customerId) {
          throw new Error('Customer ID not found in response');
        }

        console.log('Customer created, now submitting PIN for ID:', customerId);

        // Step 2: Submit PIN to dedicated endpoint
        const pinResponse = await apiService.post(`${AppConfig.orchestratorEndpoint}/customer/${customerId}/pin`, {
          pin: pin,
        });

        if (pinResponse.status !== 201 && pinResponse.status !== 200) {
          const pinDataObj = pinResponse.data as { message?: string; data?: any };
          throw new Error(pinDataObj.message || 'Failed to set PIN');
        }

        const pinDataObj = pinResponse.data as { data?: any };
        const pinData = pinDataObj.data || pinDataObj;
        
        // Clear onboarding data
        localStorage.removeItem('onboarding_data');
        localStorage.removeItem('onboarding_account_type');
        localStorage.removeItem('onboarding_bvn');
        localStorage.removeItem('onboarding_address');
        localStorage.removeItem('onboarding_city');
        localStorage.removeItem('onboarding_state');
        localStorage.removeItem('onboarding_postal_code');
        localStorage.removeItem('onboarding_business_name');
        localStorage.removeItem('onboarding_tin');
        localStorage.removeItem('onboarding_cac');

        // Navigate to external KYC verification link
        const verificationUrl = pinData.verification || customerData.verification;
        if (verificationUrl) {
          window.location.href = verificationUrl;
        } else {
          // Fallback if verification URL is not provided
          navigate('/pin-created');
        }
      }
    } catch (err: unknown) {
      console.error('Error in validatePin:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete registration');
      setPin('');
      setConfirmPin('');
      setIsConfirming(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-800 py-8 px-4">
      <div className="max-w-md mx-auto">
        <button onClick={() => navigate(-1)} className="text-white mb-6">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="text-center mb-8">
          <div className="mx-auto w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-white text-2xl font-bold mb-2">
            {isConfirming ? 'Confirm Your PIN' : 'Create Your PIN'}
          </h1>
          <p className="text-white text-opacity-80">
            {isConfirming ? 'Re-enter your 4-digit PIN' : 'Enter a 4-digit PIN to secure your account'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500 bg-opacity-20 border border-red-300 rounded-lg">
            <p className="text-white text-sm text-center">{error}</p>
          </div>
        )}

        {/* PIN Display */}
        <div className="flex justify-center gap-4 mb-12">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className={`w-14 h-14 rounded-full border-2 border-white flex items-center justify-center ${
                (isConfirming ? confirmPin.length : pin.length) > index
                  ? 'bg-white'
                  : 'bg-transparent'
              }`}
            >
              {(isConfirming ? confirmPin.length : pin.length) > index && (
                <div className="w-3 h-3 bg-[var(--primary-color)] rounded-full"></div>
              )}
            </div>
          ))}
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div className="text-center mb-6">
            <p className="text-white text-sm">Setting up your account...</p>
          </div>
        )}

        {/* Number Pad */}
        <div className="bg-white rounded-2xl p-6 shadow-xl">
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handlePinInput(num.toString())}
                disabled={loading}
                className="h-16 text-2xl font-semibold text-gray-800 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
              >
                {num}
              </button>
            ))}
            <div className="h-16"></div>
            <button
              onClick={() => handlePinInput('0')}
              disabled={loading}
              className="h-16 text-2xl font-semibold text-gray-800 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
            >
              0
            </button>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="h-16 flex items-center justify-center hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePinScreen;