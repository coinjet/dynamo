import React from 'react';
import { Zap, ShieldAlert } from 'lucide-react';

export const MissingConfigView: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0A0D10] text-[#E6EDF3] flex flex-col items-center justify-center p-6 selection:bg-amber-500 selection:text-black">
      <div className="w-full max-w-md rounded-2xl border border-stone-800 bg-[#12161B] p-8 text-center shadow-2xl space-y-6">
        <div className="flex justify-center">
          <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Zap className="w-7 h-7 fill-amber-500 text-amber-500 animate-pulse" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-white tracking-tight">
            Servicio temporalmente no disponible
          </h1>
          <p className="text-xs text-stone-400 leading-relaxed">
            La plataforma se encuentra en fase de despliegue y configuración inicial de infraestructura segura. Por favor, vuelve a intentarlo más tarde.
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 text-[11px] text-stone-400 border-t border-stone-800/80 pt-4">
          <ShieldAlert className="w-4 h-4 text-amber-500/70" />
          <span>Dynamo • Red Efímera Segura</span>
        </div>
      </div>
    </div>
  );
};
