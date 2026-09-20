import React, { useState, useEffect } from 'react';
import { systemConfigService } from '@/src/modules/systemConfig/systemConfigService';
import { SystemSettings } from '@/src/modules/systemConfig/systemConfigTypes';
import { AlertOctagon, Wrench, AlertTriangle } from 'lucide-react';

export const GlobalBanner: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  useEffect(() => {
    let isMounted = true;
    const check = async () => {
      try {
        const s = await systemConfigService.getSettings();
        if (isMounted) setSettings(s);
      } catch {
        // Silently ignore
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!settings) return null;

  if (settings.emergency_mode) {
    return (
      <div
        id="banner-emergency-mode"
        className="w-full bg-red-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 shadow-md animate-pulse sticky top-0 z-50"
      >
        <AlertOctagon className="w-4 h-4 shrink-0" />
        <span>
          MODO DE EMERGENCIA ACTIVO: Ciertas funciones operan bajo restricciones preventivas.
        </span>
      </div>
    );
  }

  if (settings.maintenance_mode) {
    return (
      <div
        id="banner-maintenance-mode"
        className="w-full bg-amber-500 text-black px-4 py-1.5 text-xs font-semibold flex items-center justify-center gap-2 shadow-sm sticky top-0 z-50"
      >
        <Wrench className="w-4 h-4 shrink-0" />
        <span>
          {settings.maintenance_notice ||
            'MODO DE MANTENIMIENTO: La plataforma se encuentra en mantenimiento preventivo. La lectura de contenido permanece disponible.'}
        </span>
      </div>
    );
  }

  if (settings.maintenance_notice) {
    return (
      <div
        id="banner-maintenance-notice"
        className="w-full bg-amber-500 text-black px-4 py-1.5 text-xs font-semibold flex items-center justify-center gap-2 shadow-sm sticky top-0 z-50"
      >
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>{settings.maintenance_notice}</span>
      </div>
    );
  }

  return null;
};
