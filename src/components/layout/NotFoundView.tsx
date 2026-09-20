import React from 'react';
import { Zap, Home, ArrowLeft } from 'lucide-react';

interface NotFoundViewProps {
  onGoHome: () => void;
}

export const NotFoundView: React.FC<NotFoundViewProps> = ({ onGoHome }) => {
  return (
    <main
      id="view-not-found"
      className="flex flex-1 flex-col items-center justify-center p-6 text-center text-stone-300 min-h-[60vh]"
    >
      <div className="w-full max-w-md rounded-2xl border border-[#21272E] bg-[#12161A] p-8 sm:p-10 shadow-2xl space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
          <Zap className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-mono font-semibold tracking-wider text-amber-400 uppercase">Error 404</span>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Página no encontrada</h1>
          <p className="text-xs sm:text-sm text-stone-400 leading-relaxed max-w-sm mx-auto">
            La ruta solicitada no existe o el contenido efímero ha culminado su ciclo de vida en la red Dynamo.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            id="btn-not-found-home"
            onClick={onGoHome}
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-xs sm:text-sm font-bold text-black hover:bg-amber-400 transition active:scale-95 shadow-md"
          >
            <Home className="h-4 w-4" />
            <span>Volver a Dynamo</span>
          </button>
          <button
            onClick={() => window.history.back()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-[#2A3441] bg-[#161D24] px-4 py-2.5 text-xs sm:text-sm font-medium text-stone-300 hover:text-white hover:bg-[#1B232C] transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Regresar</span>
          </button>
        </div>
      </div>
    </main>
  );
};
