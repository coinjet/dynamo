import React from 'react';
import { Zap, Clock, Shield, Sparkles, ArrowRight, UserPlus, LogIn, Lock } from 'lucide-react';

interface LandingHeroProps {
  onStartExploring: () => void;
  onOpenAuth: () => void;
  onOpenRegister?: () => void;
  onOpenLogin?: () => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({
  onStartExploring,
  onOpenAuth,
  onOpenRegister,
  onOpenLogin,
}) => {
  const handleRegister = onOpenRegister || onOpenAuth;
  const handleLogin = onOpenLogin || onOpenAuth;

  return (
    <div className="space-y-8 py-2 sm:py-6">
      {/* Manifesto / Hero Header */}
      <section className="relative overflow-hidden rounded-3xl border border-[#21272E] bg-gradient-to-b from-[#161D24] to-[#0E1216] p-6 sm:p-10 shadow-2xl">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-4">
            <Zap className="w-3.5 h-3.5 fill-amber-400" />
            <span>Manifiesto Dynamo</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight mb-4">
            Palabras con pulso. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-orange-400">
              Microcontenido efímero impulsado por energía.
            </span>
          </h1>

          <p className="text-sm sm:text-base text-stone-300 leading-relaxed mb-6 font-normal">
            En Dynamo, cada pensamiento nace con <strong>24 horas de vida natural</strong>. Sin algoritmos opacos acumulando rencor por años. Solo lo que la comunidad decide recargar mediante energía <strong>⚡</strong> extiende su presencia.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              id="hero-register-btn"
              onClick={handleRegister}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-xs sm:text-sm font-bold text-black hover:bg-amber-400 active:scale-95 transition shadow-lg shadow-amber-500/20"
            >
              <UserPlus className="w-4 h-4 stroke-[2.5]" />
              <span>Crear Cuenta (16+)</span>
            </button>

            <button
              id="hero-login-btn"
              onClick={handleLogin}
              className="flex items-center gap-2 rounded-xl border border-stone-700 bg-stone-800/60 px-4 py-2.5 text-xs sm:text-sm font-medium text-stone-200 hover:bg-stone-700 hover:text-white transition"
            >
              <LogIn className="w-4 h-4" />
              <span>Iniciar Sesión</span>
            </button>

            <button
              id="hero-explore-btn"
              onClick={onStartExploring}
              className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-stone-400 hover:text-amber-400 transition"
            >
              <span>Explorar feed</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* 3 Pillars */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-stone-300">
        <div className="rounded-2xl border border-[#1F262E] bg-[#12161A] p-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 mb-3">
            <Clock className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white mb-1">Caducidad Natural</h3>
          <p className="text-xs text-stone-400 leading-relaxed">
            24 horas iniciales. El texto efímero nos libera de la censura del pasado y fomenta la honestidad del presente.
          </p>
        </div>

        <div className="rounded-2xl border border-[#1F262E] bg-[#12161A] p-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 mb-3">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white mb-1">Privacidad Absoluta</h3>
          <p className="text-xs text-stone-400 leading-relaxed">
            Tu correo nunca es público. Sin rastreadores comerciales ni venta de datos. Tu perfil solo muestra lo que decides compartir.
          </p>
        </div>

        <div className="rounded-2xl border border-[#1F262E] bg-[#12161A] p-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 mb-3">
            <Shield className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white mb-1">Seguridad por Diseño</h3>
          <p className="text-xs text-stone-400 leading-relaxed">
            Protección estricta de privacidad, autenticación segura de cuentas y moderación activa contra el acoso y spam.
          </p>
        </div>
      </section>
    </div>
  );
};
