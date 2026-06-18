import { useState } from "react";
import { FiCheckCircle, FiCreditCard, FiEye, FiEyeOff, FiLock, FiMail, FiMoon, FiPhone, FiSun, FiUser, FiXCircle } from "react-icons/fi";
import { Link, useNavigate } from "react-router-dom";
import AICPA from "../../assets/certifications/aicpa.png";
import ISO from "../../assets/certifications/iso.png";
import NIST from "../../assets/certifications/nist.png";
import PCI from "../../assets/certifications/pci.png";
import { useTheme } from "../../contexts/ThemeContext";
import { useTenantConfig } from "../../hooks/useTenantConfig";

export default function Register() {
  const navigate = useNavigate();
  const { setThemeMode, isDark } = useTheme();
  const { tenant } = useTenantConfig();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [uin, setUin] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Verification states
  const [phoneStatus, setPhoneStatus] = useState<'idle' | 'verifying' | 'success' | 'fail'>("idle");
  const [phoneMsg, setPhoneMsg] = useState("");
  const [ninStatus, setNinStatus] = useState<'idle' | 'verifying' | 'success' | 'fail'>("idle");
  const [ninMsg, setNinMsg] = useState("");
  // Verification handlers
  const verifyField = async (type: 'phone' | 'nin', value: string) => {
    const { verificationService } = await import('../../services/verification_service');
    if (!value) return;
    if (type === 'phone') {
      setPhoneStatus('verifying');
      setPhoneMsg('');
    } else if (type === 'nin') {
      setNinStatus('verifying');
      setNinMsg('');
    }
    const res = await verificationService.verify({ type, value });
    if (type === 'phone') {
      setPhoneStatus(res.success ? 'success' : 'fail');
      setPhoneMsg(res.message);
    } else if (type === 'nin') {
      setNinStatus(res.success ? 'success' : 'fail');
      setNinMsg(res.message);
    }
  };

  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [agreeTerms, setAgreeTerms] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const toggleTheme = () => {
    setThemeMode(isDark ? 'light' : 'dark');
  };

  // Password validation function
  const validatePassword = (pwd: string) => {
    const hasMinLength = pwd.length >= 8;
    const hasNumber = /\d/.test(pwd);
    const hasUpperCase = /[A-Z]/.test(pwd);
    const hasLowerCase = /[a-z]/.test(pwd);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd);

    return {
      isValid: hasMinLength && hasNumber && hasUpperCase && hasLowerCase && hasSpecialChar,
      hasMinLength,
      hasNumber,
      hasUpperCase,
      hasLowerCase,
      hasSpecialChar,
    };
  };

  const passwordValidation = validatePassword(password);

  const handleRegister = async () => {
    if (!firstName || !lastName || !email || !phone || !uin || !password || !confirmPassword) {
      setErrorMessage("Please fill all the fields");
      return;
    }

    if (!passwordValidation.isValid) {
      setErrorMessage("Password does not meet requirements");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match");
      return;
    }

    if (!agreeTerms) {
      setErrorMessage("You must accept Terms & Conditions");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const { verificationService } = await import('../../services/verification_service');
      // Verify phone
      const phoneRes = await verificationService.verify({ type: 'phone', value: phone });
      if (!phoneRes.success) {
        setErrorMessage(phoneRes.message);
        setLoading(false);
        return;
      }
      // Verify NIN
      const ninRes = await verificationService.verify({ type: 'nin', value: uin });
      if (!ninRes.success) {
        setErrorMessage(ninRes.message);
        setLoading(false);
        return;
      }

      const { authService } = await import('../../services/auth_service');
      const result = await authService.register({
        email,
        password,
        firstName,
        lastName,
        phoneNumber: phone,
        uin: uin || undefined,
      });
      // Persist registration data for onboarding
      localStorage.setItem('onboarding_email', email);
      localStorage.setItem('onboarding_firstName', firstName);
      localStorage.setItem('onboarding_lastName', lastName);
      localStorage.setItem('onboarding_phone', phone);
      localStorage.setItem('onboarding_uin', uin);
      localStorage.setItem('onboarding_password', password);
      // After successful registration, start onboarding
      navigate('/onboarding-start', { state: { email: result.email } });
    } catch (error) {
      setErrorMessage('Registration failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col items-center p-6 relative">
      {/* Theme Toggle Button */}
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
        aria-label="Toggle theme"
      >
        {isDark ? <FiSun size={20} /> : <FiMoon size={20} />}
      </button>

      {/* Header */}
      {/* <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold mb-4 dark:text-white">Create Account</h1>
      </div> */}

      {/* Card */}
      <div className="w-full max-w-md bg-white dark:bg-gray-800 shadow-lg rounded-2xl p-8">
        
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 text-white rounded-2xl flex items-center justify-center text-4xl font-bold shadow-lg" style={{ backgroundColor: tenant.branding.primary_color }}>
            {tenant.logo ? (
              <img src={tenant.logo} alt={tenant.name} className="w-16 h-16 object-contain" />
            ) : (
              tenant.name.substring(0, 2).toUpperCase()
            )}
          </div>
        </div>

        <h2 className="text-center text-2xl font-bold text-gray-900 dark:text-white">
          Welcome to {tenant.name}!
        </h2>
        <p className="text-center text-gray-600 dark:text-gray-400 text-sm mt-1">
          Create your account to get started
        </p>

        {/* Error Message */}
        {errorMessage && (
          <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-3 rounded-lg mt-4 text-sm">
            {errorMessage}
          </div>
        )}

        {/* Form */}
        <div className="space-y-4 mt-6">
          {/* First Name */}
          <div className="flex items-center bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3">
            <FiUser className="mr-3" style={{ color: 'var(--primary-color)' }} />
            <input
              type="text"
              className="w-full bg-transparent py-3 outline-none dark:text-white"
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>

          {/* Last Name */}
          <div className="flex items-center bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3">
            <FiUser className="mr-3" style={{ color: 'var(--primary-color)' }} />
            <input
              type="text"
              className="w-full bg-transparent py-3 outline-none dark:text-white"
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>

          {/* Email */}
          <div className="flex items-center bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3">
            <FiMail className="mr-3" style={{ color: 'var(--primary-color)' }} />
            <input
              type="email"
              className="w-full bg-transparent py-3 outline-none dark:text-white"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Phone */}
          <div className="flex items-center bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 relative">
            <FiPhone className="mr-3" style={{ color: 'var(--primary-color)' }} />
            <span className="text-gray-500 dark:text-gray-400 mr-1">+234</span>
            <input
              type="tel"
              className="w-full bg-transparent py-3 outline-none dark:text-white"
              placeholder="Phone Number"
              value={phone}
              onChange={e => {
                setPhone(e.target.value);
                setPhoneStatus('idle');
                setPhoneMsg('');
              }}
              onBlur={e => verifyField('phone', e.target.value)}
            />
            {phoneStatus === 'success' && <FiCheckCircle className="absolute right-3 text-green-500" />}
            {phoneStatus === 'fail' && <FiXCircle className="absolute right-3 text-red-500" />}
          </div>
          {phoneStatus === 'success' && <div className="text-green-600 text-xs ml-2">{phoneMsg}</div>}
          {phoneStatus === 'fail' && <div className="text-red-600 text-xs ml-2">{phoneMsg}</div>}

          {/* UIN - Unique Identification Number */}
          <div className="flex items-center bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 relative">
            <FiCreditCard className="mr-3" style={{ color: 'var(--primary-color)' }} />
            <input
              type="text"
              className="w-full bg-transparent py-3 outline-none dark:text-white"
              placeholder="National Identification Number (NIN)"
              value={uin}
              onChange={e => {
                setUin(e.target.value);
                setNinStatus('idle');
                setNinMsg('');
              }}
              onBlur={e => verifyField('nin', e.target.value)}
            />
            {ninStatus === 'success' && <FiCheckCircle className="absolute right-3 text-green-500" />}
            {ninStatus === 'fail' && <FiXCircle className="absolute right-3 text-red-500" />}
          </div>
          {ninStatus === 'success' && <div className="text-green-600 text-xs ml-2">{ninMsg}</div>}
          {ninStatus === 'fail' && <div className="text-red-600 text-xs ml-2">{ninMsg}</div>}

          {/* Password */}
          <div>
            <div className="flex items-center bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3">
              <FiLock className="mr-3" style={{ color: 'var(--primary-color)' }} />
              <input
              type={showPass ? "text" : "password"}
              className="w-full bg-transparent py-3 outline-none dark:text-white"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button onClick={() => setShowPass(!showPass)} className="text-gray-500 dark:text-gray-400">
              {showPass ? <FiEyeOff /> : <FiEye />}
            </button>
            </div>
            {password && (
              <div className="mt-2 text-xs space-y-1">
                <div className={`flex items-center gap-2 ${passwordValidation.hasMinLength ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  <span>{passwordValidation.hasMinLength ? '✓' : '○'}</span>
                  <span>At least 8 characters</span>
                </div>
                <div className={`flex items-center gap-2 ${passwordValidation.hasNumber ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  <span>{passwordValidation.hasNumber ? '✓' : '○'}</span>
                  <span>At least one number</span>
                </div>
                <div className={`flex items-center gap-2 ${passwordValidation.hasUpperCase ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  <span>{passwordValidation.hasUpperCase ? '✓' : '○'}</span>
                  <span>At least one uppercase letter</span>
                </div>
                <div className={`flex items-center gap-2 ${passwordValidation.hasLowerCase ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  <span>{passwordValidation.hasLowerCase ? '✓' : '○'}</span>
                  <span>At least one lowercase letter</span>
                </div>
                <div className={`flex items-center gap-2 ${passwordValidation.hasSpecialChar ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  <span>{passwordValidation.hasSpecialChar ? '✓' : '○'}</span>
                  <span>At least one special character</span>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="flex items-center bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3">
            <FiLock className="mr-3" style={{ color: 'var(--primary-color)' }} />
            <input
              type={showConfirmPass ? "text" : "password"}
              className="w-full bg-transparent py-3 outline-none dark:text-white"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <button
              onClick={() => setShowConfirmPass(!showConfirmPass)}
              className="text-gray-500 dark:text-gray-400"
            >
              {showConfirmPass ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>

          {/* Terms */}
          <div className="flex items-start mt-2">
            <input
              type="checkbox"
              className="mt-1 w-4 h-4"
              checked={agreeTerms}
              onChange={() => setAgreeTerms(!agreeTerms)}
            />
            <p className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              I agree to the{" "}
              <span className="font-semibold underline cursor-pointer" style={{ color: 'var(--primary-color)' }}>
                Terms and Conditions
              </span>
            </p>
          </div>

          {/* Register Button */}
          <button
            onClick={handleRegister}
            disabled={loading}
            className="w-full text-white py-3 rounded-lg font-bold mt-4 disabled:bg-gray-300 hover:opacity-90 transition"
            style={{ backgroundColor: loading ? undefined : 'var(--primary-color)' }}
          >
            {loading ? "Loading..." : "Create Account"}
          </button>

          {/* Divider */}
          <div className="flex items-center my-6">
            <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700"></div>
            <span className="px-3 text-gray-500 dark:text-gray-400 text-sm">OR</span>
            <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700"></div>
          </div>

          {/* Login Link */}
          <p className="text-center text-gray-700 dark:text-gray-300">
            Already have an account?{" "}
            <Link to="/login" className="font-bold" style={{ color: 'var(--primary-color)' }}>
              Login
            </Link>
          </p>
        </div>
      {/* Compliance Certificates */}
      <div className="flex justify-center gap-4 mt-8">
        <img src={AICPA} alt="AICPA" className="h-24 w-auto" />
        <img src={ISO} alt="ISO" className="h-24 w-auto" />
        <img src={NIST} alt="NIST" className="h-24 w-auto" />
        <img src={PCI} alt="PCI" className="h-24 w-auto" />
      </div>
    </div>
  </div>
);
}
