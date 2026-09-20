import React from 'react';
import { useNetworkStatus } from '@/src/hooks/useOnlineStatus';
import { WifiOff, RefreshCw } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const { status, isOnline } = useNetworkStatus();

  if (isOnline) return null;

  return (
    <aside
      id="offline-banner"
      aria-label="Estado de conexión a la red"
      role="status"
      aria-live="polite"
      className={`fixed bottom-16 left-4 right-4 md:left-auto md:right-6 md:bottom-6 z-50 flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-xl backdrop-blur-xs transition-all duration-300 ${
        status === 'offline'
          ? 'bg-amber-500 text-black'
          : 'bg-emerald-500 text-black'
      }`}
    >
      <div className="flex items-center gap-2">
        {status === 'offline' ? (
          <>
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>Sin conexión — Navegando en modo lectura local</span>
          </>
        ) : (
          <>
            <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
            <span>Restableciendo conexión con Dynamo ⚡...</span>
          </>
        )}
      </div>
    </aside>
  );
};
