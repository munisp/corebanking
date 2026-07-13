import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { OfflineScreen } from '../components/OfflineScreen';

interface WithOfflineDetectionProps {
  allowOffline?: boolean;
}

/**
 * Higher-order component that wraps a component with offline detection
 * If allowOffline is false and user is offline, shows offline screen
 */
export function withOfflineDetection<P extends object>(
  Component: React.ComponentType<P>,
  allowOffline: boolean = false
) {
  return (props: P & WithOfflineDetectionProps) => {
    const isOnline = useOnlineStatus();

    // If offline and this route doesn't allow offline access, show offline screen
    if (!isOnline && !allowOffline) {
      return <OfflineScreen />;
    }

    return <Component {...props} />;
  };
}
