import { useEffect, useState } from 'react';

export type NetworkConnectionState = 'online' | 'offline' | 'reconnecting';

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkConnectionState>(() =>
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'online'
  );

  useEffect(() => {
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleOffline = () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      setStatus('offline');
    };

    const handleOnline = () => {
      // Transition through 'reconnecting' briefly before confirming 'online'
      setStatus('reconnecting');
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      reconnectTimeout = setTimeout(() => {
        setStatus('online');
      }, 1200);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    status,
    isOnline: status === 'online',
    isOffline: status === 'offline',
    isReconnecting: status === 'reconnecting',
  };
}

export function useOnlineStatus() {
  const { isOnline } = useNetworkStatus();
  return isOnline;
}
