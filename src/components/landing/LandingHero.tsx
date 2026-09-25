import React, { useState, useEffect } from 'react';
import {
  Zap,
  Clock,
  Shield,
  ArrowRight,
  Flame,
  MessageCircleOff,
  Scroll,
  HeartOff,
  Compass,
  CheckCircle2,
  Sparkles,
  MapPin,
  Lock,
} from 'lucide-react';
import { referralsService } from '@/src/modules/referrals/referralsService';

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
  const [referralCode, setReferralCode] = useState<string | null>(null);

  useEffect(() => {
    const code = referralsService.getStoredReferralCode();
    if (code) {
      setReferralCode(code);
    }
  }, []);

  const handleJoinClick = () => {
    const code = referralsService.getStoredReferralCode();
    if (code) {
      referralsService.trackEvent(code, 'signup_started');
    }
    if (onOpenRegister) {
      onOpenRegister();
    } else {
      onOpenAuth();
    }
  };

  const handleLoginClick = () => {
    if (onOpenLogin) {
      onOpenLogin();
    } else {
      onOpenAuth();
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 py-2 sm:py-4 max-w-4xl mx-auto">
      {/* Active Invitation Context Banner if arriving via /join?ref= */}
      {referralCode && (
        <div className="flex items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs sm:text-sm shadow-lg shadow-amber-500/10 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500 text-black font-extrabold shrink-0">
              <Zap className="w-4 h-4 fill-black" />
            </div>
            <div>
              <p className="font-semibold text-white">
                ¡Tienes una invitación activa a Dynamo!
              </p>
              <p className="text-[11px] text-amber-300/90">
                Código reservado:{' '}
                <span className="font-mono font-bold text-white uppercase bg-black/40 px-2 py-0.5 rounded-md border border-amber-500/30">
                  {referralCode}
                </span>
                . Tu registro quedará atribuido de forma segura.
              </p>
            </div>
          </div>
          <button
            onClick={handleJoinClick}
            className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition shadow-sm shrink-0"
          >
            <span>Canjear</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Hero Header / Main Presentation */}
      <section className="relative overflow-hidden rounded-3xl border border-[#232B35] bg-gradient-to-b from-[#161D24] via-[#11161B] to-[#0D1013] p-6 sm:p-10 shadow-2xl text-stone-200">
        <div className="max-w-3xl space-y-4 sm:space-y-5">
          {/* Badge: Dynamo ⚡ — El microblog regio */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold tracking-wide">
            <Zap className="w-4 h-4 fill-amber-400 text-amber-400" />
            <span>Dynamo ⚡ — El microblog regio.</span>
          </div>

          {/* Main Message: Un lugar para decir lo que piensas hoy */}
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Un lugar para decir lo que piensas hoy.
          </h1>

          <p className="text-sm sm:text-base text-stone-300 leading-relaxed font-normal">
            Microcontenido libre del peso del pasado. Cada publicación vive <strong>24 horas naturales</strong> y desaparece, a menos que la comunidad decida inyectarle energía <strong>⚡</strong> para mantenerla encendida.
          </p>

          {/* CTAs */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              id="landing-hero-join-btn"
              onClick={handleJoinClick}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-xs sm:text-sm font-extrabold text-black hover:bg-amber-400 active:scale-95 transition shadow-lg shadow-amber-500/25 cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-black stroke-black" />
              <span>Únete a Dynamo ⚡</span>
            </button>

            <button
              id="landing-hero-explore-btn"
              onClick={onStartExploring}
              className="flex items-center gap-2 rounded-xl border border-stone-700 bg-stone-800/80 px-5 py-3 text-xs sm:text-sm font-semibold text-stone-200 hover:bg-stone-700 hover:text-white transition cursor-pointer"
            >
              <Compass className="w-4 h-4 text-amber-400" />
              <span>Explorar Dynamos</span>
            </button>

            <button
              onClick={handleLoginClick}
              className="px-3 py-2 text-xs text-stone-400 hover:text-stone-200 transition"
            >
              ¿Ya tienes cuenta? <span className="underline text-stone-300">Iniciar sesión</span>
            </button>
          </div>
        </div>
      </section>

      {/* Brief & Visual Features Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Dynamos efímeros */}
        <div className="p-4 sm:p-5 rounded-2xl border border-[#1E2630] bg-[#12161A] space-y-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">Dynamos efímeros</h3>
          <p className="text-xs text-stone-400 leading-relaxed">
            24 horas de vida natural. Sin archivos eternos de arrepentimiento. Lo que se dice hoy pertenece a hoy.
          </p>
        </div>

        {/* 2. Sin likes ni métricas de ego */}
        <div className="p-4 sm:p-5 rounded-2xl border border-[#1E2630] bg-[#12161A] space-y-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
            <HeartOff className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">Sin likes ni ego</h3>
          <p className="text-xs text-stone-400 leading-relaxed">
            Sin contadores de likes diseñados para crear ansiedad o dopamina barata. Escribe sin buscar validación vacía.
          </p>
        </div>

        {/* 3. Sin feed infinito */}
        <div className="p-4 sm:p-5 rounded-2xl border border-[#1E2630] bg-[#12161A] space-y-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
            <Scroll className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">Sin feed infinito</h3>
          <p className="text-xs text-stone-400 leading-relaxed">
            Sin scroll adictivo sin fin. Cuando lees las publicaciones del día, estás al día y puedes continuar tu vida.
          </p>
        </div>

        {/* 4. Sin hilos interminables */}
        <div className="p-4 sm:p-5 rounded-2xl border border-[#1E2630] bg-[#12161A] space-y-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400">
            <MessageCircleOff className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">Sin hilos interminables</h3>
          <p className="text-xs text-stone-400 leading-relaxed">
            Conversaciones concisas, acotadas y directas. Sin debates bizantinos de 400 niveles que no llevan a nada.
          </p>
        </div>

        {/* 5. ⚡ para mantener vivo un Dynamo */}
        <div className="p-4 sm:p-5 rounded-2xl border border-[#1E2630] bg-[#12161A] space-y-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
            <Zap className="w-5 h-5 fill-amber-400" />
          </div>
          <h3 className="text-sm font-bold text-white">⚡ Energía comunitaria</h3>
          <p className="text-xs text-stone-400 leading-relaxed">
            Si un Dynamo resuena contigo, regálale energía ⚡. Cada recarga le otorga +6 horas de vida (hasta un tope de 7 días).
          </p>
        </div>

        {/* 6. Descubrimiento de tendencias y por expirar */}
        <div className="p-4 sm:p-5 rounded-2xl border border-[#1E2630] bg-[#12161A] space-y-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400">
            <Flame className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">Tendencias & Urgencia</h3>
          <p className="text-xs text-stone-400 leading-relaxed">
            Descubre temas calientes y rescata Dynamos que están a pocos minutos de desaparecer para siempre.
          </p>
        </div>

        {/* 7. Privacidad y comunidad */}
        <div className="p-4 sm:p-5 rounded-2xl border border-[#1E2630] bg-[#12161A] space-y-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">Privacidad y comunidad</h3>
          <p className="text-xs text-stone-400 leading-relaxed">
            Tu email nunca es público. Sin venta de datos personales ni rastreo invasivo. Comunidad auténtica con reglas claras.
          </p>
        </div>

        {/* 8. Registro sencillo (16+) */}
        <div className="p-4 sm:p-5 rounded-2xl border border-[#1E2630] bg-[#12161A] space-y-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
            <Shield className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">Registro sencillo (16+)</h3>
          <p className="text-xs text-stone-400 leading-relaxed">
            Crear cuenta toma menos de un minuto. Certificación de edad mínima (16 años) y verificación de correo requerida.
          </p>
        </div>
      </section>

      {/* Origin Story Card */}
      <section className="p-5 sm:p-6 rounded-2xl border border-amber-500/20 bg-gradient-to-r from-[#171D24] via-[#14191F] to-[#12161A] text-stone-300 space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
          <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Hecho en Nuevo León</span>
        </div>
        <p className="text-xs sm:text-sm text-stone-200 leading-relaxed italic">
          “Dynamo nació en Nuevo León, creado por un solopreneur / indie hacker con la idea de construir un microblog diferente.”
        </p>
        <p className="text-[11px] text-stone-400">
          Una alternativa honesta, rápida y cercana para la conversación diaria de la comunidad regia y más allá.
        </p>
      </section>

      {/* Bottom Conversion Strip */}
      <div className="p-6 rounded-2xl border border-[#212832] bg-[#12161A] text-center space-y-3">
        <h3 className="text-base sm:text-lg font-extrabold text-white">
          ¿Listo para compartir lo que piensas hoy?
        </h3>
        <p className="text-xs text-stone-400 max-w-md mx-auto">
          Comienza en segundos. Sin algoritmos que te juzguen ni métricas de ego.
        </p>
        <div className="pt-1 flex justify-center gap-3">
          <button
            onClick={handleJoinClick}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-xs sm:text-sm font-extrabold text-black hover:bg-amber-400 active:scale-95 transition shadow-md shadow-amber-500/20 cursor-pointer"
          >
            <Zap className="w-4 h-4 fill-black stroke-black" />
            <span>Únete a Dynamo ⚡</span>
          </button>
          <button
            onClick={onStartExploring}
            className="px-4 py-2.5 rounded-xl border border-stone-700 bg-stone-800 text-stone-300 hover:text-white text-xs sm:text-sm font-semibold transition cursor-pointer"
          >
            Explorar Dynamos
          </button>
        </div>
      </div>
    </div>
  );
};
