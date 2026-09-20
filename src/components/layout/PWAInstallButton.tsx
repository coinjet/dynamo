import React, { useState } from 'react';
import { usePWAInstall } from '@/src/hooks/usePWAInstall';
import { Download, Smartphone, X } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If running installed, suppress
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop
  if (isInstallable) {
    return (
      <button
        id="btn-pwa-install"
        onClick={install}
        className="flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/25 transition active:scale-95"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Instalar App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          id="btn-pwa-install-ios"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-full bg-stone-800/80 border border-stone-700 px-3 py-1.5 text-xs font-medium text-stone-300 hover:bg-stone-700 transition"
        >
          <Smartphone className="w-3.5 h-3.5 text-amber-400" />
          <span>Instalar en iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-2xl bg-[#15191E] border border-stone-800 p-6 shadow-2xl text-stone-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-white">Instalar Dynamo en iPhone</h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-stone-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-stone-400 leading-relaxed mb-4">
                1. Toca el botón <strong>Compartir</strong> en la barra de Safari.<br />
                2. Desplázate hacia abajo y selecciona <strong>Agregar a pantalla de inicio</strong>.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 transition"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
