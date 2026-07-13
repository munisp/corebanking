import { useState } from "react";
import {
  FiEye,
  FiEyeOff,
  FiLock,
  FiLogIn,
  FiMail,
  FiMoon,
  FiSun,
} from "react-icons/fi";
import { MdFingerprint } from "react-icons/md";
import { Link, useNavigate } from "react-router-dom";
import AICPA from "../../assets/certifications/aicpa.png";
import ISO from "../../assets/certifications/iso.png";
import NIST from "../../assets/certifications/nist.png";
import PCI from "../../assets/certifications/pci.png";
import { useTheme } from "../../contexts/ThemeContext";
import { useTenantConfig } from "../../hooks/useTenantConfig";

export default function Login() {
  const navigate = useNavigate();
  const { setThemeMode, isDark } = useTheme();
  const { tenant } = useTenantConfig();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [obscure, setObscure] = useState(true);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);

  const biometricAvailable = false;

  const toggleTheme = () => {
    setThemeMode(isDark ? "light" : "dark");
  };

  const handleLogin = async () => {
    if (!email || !password) return;

    setLoading(true);

    try {
      const { authService } = await import("../../services/auth_service");
      await authService.login(email, password);
      // After successful login, navigate to dashboard
      navigate("/dashboard");
    } catch (error) {
      alert(
        "Login failed: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center px-4 py-10 relative">
      {/* Theme Toggle Button */}
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
        aria-label="Toggle theme"
      >
        {isDark ? <FiSun size={20} /> : <FiMoon size={20} />}
      </button>

      <div className="h-[70%] w-full max-w-md bg-white dark:bg-gray-900  justify-around gap-3">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <div
            className="w-24 h-24 rounded-2xl shadow-xl flex items-center justify-center"
            style={{ backgroundColor: tenant.branding.primary_color }}
          >
            {tenant.logo ? (
              <img
                src={tenant.logo}
                alt={tenant.displayName}
                className="w-16 h-16 object-contain"
              />
            ) : (
              <span className="text-white text-4xl font-bold">
                {tenant.name.substring(0, 2).toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* Welcome Text */}
        <h1 className="text-3xl font-bold text-center text-black dark:text-white">
          Welcome to {tenant.displayName}
        </h1>
        <p className="text-center text-gray-500 dark:text-gray-400 mt-1">
          Login to continue to your account
        </p>

        <div className="mt-10 space-y-5">
          {/* Email Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Address
            </label>
            <div
              className="relative flex justify-center items-center pl-10 pr-4 py-5 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 focus:ring-2 outline-none"
              style={
                {
                  "--tw-ring-color": "var(--primary-color)",
                } as React.CSSProperties
              }
            >
              <FiMail
                className=" left-3 top-3"
                size={20}
                style={{ color: "var(--primary-color)" }}
              />
              <input
                type="email"
                className="w-full px-4 bg-transparent dark:text-white"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password
            </label>
            <div className="relative flex justify-center items-center pl-10 pr-4 py-5 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 focus:ring-2 outline-none">
              <FiLock
                className=" left-3 top-3"
                size={20}
                style={{ color: "var(--primary-color)" }}
              />
              <input
                type={obscure ? "password" : "text"}
                className="w-full bg-transparent dark:text-white"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <button
                type="button"
                className="right-3 top-3 text-gray-600 dark:text-gray-400"
                onClick={() => setObscure(!obscure)}
              >
                {obscure ? <FiEye size={20} /> : <FiEyeOff size={20} />}
              </button>
            </div>
          </div>

          {/* Remember Me + Forgot Password */}
          <div className="flex justify-between items-center">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4"
              />
              Remember me
            </label>

            <Link
              to="/forgot-password"
              className="font-semibold text-sm"
              style={{ color: "var(--primary-color)" }}
            >
              Forgot Password?
            </Link>
          </div>

          {/* Login Button */}
          <button
            className="w-full py-4 text-white font-bold rounded-xl shadow hover:opacity-90 transition flex items-center justify-center gap-2"
            style={{ backgroundColor: "var(--primary-color)" }}
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <FiLogIn size={20} />
                Login
              </>
            )}
          </button>
          {/* Biometric Button */}
          {biometricAvailable && (
            <button
              className="w-full py-4 border font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-80 transition"
              style={{
                borderColor: "var(--primary-color)",
                color: "var(--primary-color)",
              }}
            >
              <MdFingerprint size={22} /> Login with Biometric
            </button>
          )}

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700"></div>
            <span className="text-gray-500 dark:text-gray-400 text-sm">OR</span>
            <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700"></div>
          </div>

          {/* Register Link */}
          <p className="text-center text-gray-700 dark:text-gray-300">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="font-bold"
              style={{ color: "var(--primary-color)" }}
            >
              Register
            </Link>
          </p>

          {/* Compliance Certificates */}
          <div className="flex justify-center gap-4 mt-8">
            <img src={AICPA} alt="AICPA" className="h-24 w-auto" />
            <img src={ISO} alt="ISO" className="h-24 w-auto" />
            <img src={NIST} alt="NIST" className="h-24 w-auto" />
            <img src={PCI} alt="PCI" className="h-24 w-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}
