import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { OfflineScreen } from '../components/OfflineScreen';

interface OfflineGuardProps {
  children: React.ReactNode;
  allowOffline?: boolean;
  fallback?: React.ReactNode;
}

/**
 * Component that guards routes from offline access
 * Usage:
 * 
 * <OfflineGuard allowOffline={true}>
 *   <Dashboard />
 * </OfflineGuard>
 * 
 * Or in routes:
 * <Route path="/dashboard" element={
 *   <OfflineGuard allowOffline={true}>
 *     <Dashboard />
 *   </OfflineGuard>
 * } />
 */
export const OfflineGuard: React.FC<OfflineGuardProps> = ({ 
  children, 
  allowOffline = false,
  fallback 
}) => {
  const isOnline = useOnlineStatus();
  const showContent = isOnline || allowOffline;

  if (!showContent) {
    return fallback ? <>{fallback}</> : <OfflineScreen />;
  }

  return <>{children}</>;
};

/**
 * Example usage in App.tsx:
 * 
 * // Pages that work offline
 * <Route path="/dashboard" element={
 *   <OfflineGuard allowOffline={true}>
 *     <Dashboard />
 *   </OfflineGuard>
 * } />
 * 
 * <Route path="/transfer" element={
 *   <OfflineGuard allowOffline={true}>
 *     <Transfer />
 *   </OfflineGuard>
 * } />
 * 
 * // Pages that require online connection
 * <Route path="/loan-application" element={
 *   <OfflineGuard allowOffline={false}>
 *     <LoansApplicationScreen />
 *   </OfflineGuard>
 * } />
 * 
 * <Route path="/settings" element={
 *   <OfflineGuard>
 *     <Settings />
 *   </OfflineGuard>
 * } />
 */
