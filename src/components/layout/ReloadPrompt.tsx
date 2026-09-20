import React, { useState, useEffect } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { RefreshCw, X, Zap } from 'lucide-react';

export const ReloadPrompt: React.FC = () => {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateSW, setUpdateSW] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const update = registerSW({
        onNeedRefresh() {
          setNeedRefresh(true);
        },
        onOfflineReady() {},
      });
      setUpdateSW(() => update);
    }
  }, []);

  const handleUpdate = () => {
    if (updateSW) {
      updateSW(true);
    }
  };

  const handleDismiss = () => {
    setNeedRefresh(false);
  };

  if (!needRefresh) return null;

  return (
    <aside
      id="pwa-update-prompt"
      aria-label="Actualización de la aplicación"
      role="alert"
      className="fixed top-4 left-4 right-4 md:left-auto md:right-6 md:top-6 z-50 max-w-md rounded-2xl border border-amber-500/40 bg-[#141A20]/95 p-4 text-stone-200 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-300"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-black">
          <Zap className="h-5 w-5 fill-black" />
        </div>
        <div className="flex-1 space-y-1">
          <h4 className="text-xs sm:text-sm font-bold text-white">Nueva versión disponible de Dynamo</h4>
          <p className="text-[11px] sm:text-xs text-stone-400 leading-relaxed">
            Hay mejoras de rendimiento y estabilidad listas. Actualiza para aplicar los cambios sin perder tu sesión ni datos.
          </p>
          <div className="flex items-center gap-2 pt-2">
            <button
              id="btn-pwa-update-confirm"
              onClick={handleUpdate}
              className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-black hover:bg-amber-400 transition active:scale-95 shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Actualizar ahora ⚡</span>
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-lg px-2.5 py-1.5 text-xs text-stone-400 hover:text-stone-200 hover:bg-stone-800/60 transition"
            >
              Más tarde
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Cerrar aviso de actualización"
          className="rounded-lg p-1 text-stone-400 hover:text-white hover:bg-stone-800 transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
};
