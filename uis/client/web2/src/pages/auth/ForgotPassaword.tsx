import { useState } from "react";
import { FiCheckCircle, FiInfo, FiMail, FiSend } from "react-icons/fi";
import { Link, useNavigate } from "react-router-dom";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [resetKeycloakId, setResetKeycloakId] = useState("");

  const validateEmail = (value: string) => {
    const pattern = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;
    return pattern.test(value);
  };

  const handleSubmit = async () => {
    if (!email) {
      setErrorMessage("Please enter your email");
      return;
    }

    if (!validateEmail(email)) {
      setErrorMessage("Please enter a valid email");
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const { authService } = await import('../../services/auth_service');
      const response = await authService.forgotPassword(email);
      setResetKeycloakId(response.keycloak_id);
      localStorage.setItem('password_reset_keycloak_id', response.keycloak_id);
      setShowSuccessModal(true);
    } catch (error) {
      setErrorMessage('Failed to send reset link: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white p-6 flex flex-col items-center">
      {/* App Bar */}
      <div className="w-full max-w-md mb-6">
        <Link to="/login" className="text-[var(--primary-color)] font-semibold text-sm">
          ← Back
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Forgot Password</h1>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-md">
        {/* Icon Circle */}
        <div className="flex justify-center mb-6">
          <div className="w-28 h-28 rounded-full bg-blue-50 flex items-center justify-center">
            <FiMail size={48} className="text-[var(--primary-color)]" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-center">Reset Password</h2>
        <p className="text-gray-600 text-center mt-2">
          Enter your email address and we'll send you a reset link.
        </p>

        {/* Error message */}
        {errorMessage && (
          <div className="bg-red-100 text-red-700 mt-4 p-3 rounded-lg text-sm">
            {errorMessage}
          </div>
        )}

        {/* Email Field */}
        <div className="mt-6">
          <label className="text-gray-700 font-medium text-sm">Email Address</label>
          <div className="flex items-center border border-gray-300 rounded-lg bg-gray-50 px-3 mt-1">
            <FiMail className="text-[var(--primary-color)] mr-3" />
            <input
              type="email"
              placeholder="Enter your email"
              className="w-full py-3 bg-transparent outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full mt-6 bg-[var(--primary-color)] text-white py-3 rounded-lg font-semibold disabled:bg-gray-300"
        >
          {isSubmitting ? (
            <div className="flex justify-center">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <FiSend size={18} /> Send Reset Link
            </div>
          )}
        </button>

        {/* Back to login */}
        <div className="text-center mt-6">
          <Link to="/login" className="text-[var(--primary-color)] font-semibold">
            Back to Login
          </Link>
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex gap-3">
          <FiInfo className="text-amber-700 mt-1" />
          <p className="text-sm text-amber-800">
            Didn't receive the email? Check your spam folder or try again later.
          </p>
        </div>
      </div>

      {/* ─────────────────────────────────────────────── */}
      {/* SUCCESS MODAL */}
      {/* ─────────────────────────────────────────────── */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-8 w-full max-w-sm text-center shadow-xl">
            <div className="w-24 h-24 mx-auto rounded-full bg-green-50 flex items-center justify-center">
              <FiCheckCircle size={64} className="text-green-600" />
            </div>

            <h3 className="mt-6 text-2xl font-bold">Check Your Email</h3>

            <p className="text-gray-600 mt-2">
              We’ve sent a password reset link to:
            </p>
            <p className="font-semibold mt-1">{email}</p>

            <button
              onClick={() => {
                setShowSuccessModal(false);
                navigate('/reset-password', {
                  state: {
                    email,
                    keycloakId: resetKeycloakId,
                  },
                });
              }}
              className="w-full mt-6 bg-[var(--primary-color)] text-white py-3 rounded-lg font-semibold"
            >
              Continue to Reset Password
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
