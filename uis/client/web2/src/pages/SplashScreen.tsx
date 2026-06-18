import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTenantConfig } from '../hooks/useTenantConfig';

const SplashScreen: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, hasCompletedOnboarding } = useAuth();
  const { tenant } = useTenantConfig();
  console.log('Loaded tenant in SplashScreen:', tenant);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isLoading) {
        if (isAuthenticated) {
          // User is logged in
          if (hasCompletedOnboarding) {
            navigate('/dashboard');
          } else {
            navigate('/register');
          }
        } else {
          // User not logged in, check if they've seen onboarding
          const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
          if (hasSeenOnboarding === 'true') {
            navigate('/login');
          } else {
            navigate('/register');
          }
        }
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate, isAuthenticated, isLoading, hasCompletedOnboarding]);

  return (
    <AnimatePresence>
      <motion.div
        className="w-full h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-700 via-blue-900 to-indigo-900"
        style={{
          background: `linear-gradient(135deg, ${tenant.branding.primary_color} 0%, ${tenant.branding.secondary_color} 100%)`
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Logo */}
        <motion.div
          className="w-28 h-28 rounded-3xl bg-white flex items-center justify-center shadow-xl"
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 100, damping: 10 }}
        >
          {tenant.logo ? (
            <img src={tenant.logo} alt={tenant.displayName} className="w-20 h-20 object-contain" />
          ) : (
            <span className="text-5xl font-bold" style={{ color: tenant.branding.primary_color }}>
              {tenant.name.substring(0, 2).toUpperCase()}
            </span>
          )}
        </motion.div>

        {/* App Name */}
        <motion.h1
          className="mt-8 text-4xl md:text-5xl font-bold text-white tracking-wider"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          {tenant.displayName}
        </motion.h1>

        {/* Tagline */}
        <motion.p
          className="mt-2 text-white text-opacity-80 tracking-wide"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          Your Financial Partner
        </motion.p>

        {/* Loading Spinner */}
        <motion.div
          className="mt-10 w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        />
      </motion.div>
    </AnimatePresence>
  );
};

export default SplashScreen;
