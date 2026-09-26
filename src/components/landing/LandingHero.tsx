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
  MapPin,
  Lock,
  Globe,
  Sparkles,
  Trophy,
  Check,
  X,
  Users,
  MessageSquare,
  Image as ImageIcon,
  Hash,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  Briefcase,
  Plane,
  Camera,
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

  // Hero Card Demo State
  const [demoEnergyCount, setDemoEnergyCount] = useState(14);
  const [demoHasGivenEnergy, setDemoHasGivenEnergy] = useState(false);

  // Interactive 280-character counter state
  const [demoText, setDemoText] = useState(
    'Hoy descubrí un lugar increíble para desconectarme. #Monterrey #Viajes'
  );

  // Vision translation demo state
  const [showDemoTranslation, setShowDemoTranslation] = useState(false);

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

  const handleDemoGiftEnergy = () => {
    if (demoHasGivenEnergy) {
      setDemoEnergyCount((prev) => prev - 1);
      setDemoHasGivenEnergy(false);
    } else {
      setDemoEnergyCount((prev) => prev + 1);
      setDemoHasGivenEnergy(true);
    }
  };

  // Character calculations for the 280-char interactive demo
  const currentLength = demoText.length;
  const maxChars = 280;
  const detectedHashtags = (demoText.match(/#[a-zA-Z0-9_áéíóúÁÉÍÓÚñÑ]+/g) || []);
  const hashtagCharsCount = detectedHashtags.reduce((acc, tag) => acc + tag.length, 0);

  return (
    <div className="space-y-16 sm:space-y-24 py-4 sm:py-8 max-w-4xl mx-auto overflow-hidden text-stone-100">
      {/* =========================================================================
          0. BANNER DE INVITACIÓN ACTIVA (/join?ref=CODE)
      ========================================================================= */}
      {referralCode && (
        <section
          aria-label="Invitación activa a Dynamo"
          className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent p-4 sm:p-5 shadow-xl shadow-amber-500/10"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-black font-black shrink-0 shadow-md">
                <Zap className="w-5 h-5 fill-black stroke-black" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider font-mono text-amber-300 font-bold">
                  Acceso por Invitación Oficial
                </p>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Alguien te invitó a Dynamo ⚡
                </h3>
                <p className="text-xs text-stone-300 mt-0.5">
                  Código reservado:{' '}
                  <span className="font-mono font-bold text-white bg-black/60 px-2 py-0.5 rounded border border-amber-500/40">
                    {referralCode}
                  </span>
                  {' '}· Tu cuenta quedará vinculada con atribución segura al registrarte.
                </p>
              </div>
            </div>

            <button
              onClick={handleJoinClick}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-black text-xs sm:text-sm transition shadow-lg shadow-amber-500/25 shrink-0 cursor-pointer"
            >
              <span>Crear mi cuenta</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}

      {/* =========================================================================
          1. HERO — QUÉ ES DYNAMO
      ========================================================================= */}
      <section className="relative overflow-hidden rounded-3xl border border-[#26313C] bg-gradient-to-b from-[#161D24] via-[#101418] to-[#0A0D10] p-6 sm:p-12 shadow-2xl">
        {/* Subtle warm amber ambient glow */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-amber-600/5 rounded-full blur-3xl pointer-events-none" />

        {/* Minimalist mountain skyline watermark (Cerro de la Silla silhouette) */}
        <div className="absolute right-0 bottom-0 pointer-events-none opacity-15 overflow-hidden">
          <svg width="340" height="120" viewBox="0 0 340 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 120L65 72L120 95L190 28L235 62L270 48L340 120H0Z" fill="url(#hero-mtn-gradient)" />
            <defs>
              <linearGradient id="hero-mtn-gradient" x1="170" y1="28" x2="170" y2="120" gradientUnits="userSpaceOnUse">
                <stop stopColor="#F59E0B" />
                <stop offset="1" stopColor="#0B0E11" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className="relative max-w-2xl space-y-6">
          {/* Posicionamiento Oficial Exacto */}
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-400">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500/20 text-amber-400">
              <Zap className="w-3.5 h-3.5 fill-amber-400" />
            </span>
            <span className="font-bold tracking-wide">Dynamo ⚡</span>
            <span className="text-stone-500" aria-hidden="true">·</span>
            <span className="text-stone-300">El microblog regio que nació en Monterrey y mira al mundo.</span>
          </div>

          {/* Titular Principal */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.08]">
            Di lo que piensas.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200">
              Hoy.
            </span>
          </h1>

          {/* Explicación Inmediata de qué es Dynamo */}
          <p className="text-base sm:text-xl text-stone-200 font-medium leading-relaxed">
            Dynamo es un microblog de comunidad donde puedes compartir lo que piensas, sientes, descubres o quieres conversar, en publicaciones de hasta 280 caracteres.
          </p>

          {/* Explicación Comercial de Uso */}
          <p className="text-xs sm:text-sm text-stone-300 leading-relaxed font-normal">
            Puedes escribir sobre tu día, una idea, una pregunta, humor, experiencias, negocios, lugares que descubriste, recomendaciones, cultura, proyectos, viajes y prácticamente cualquier tema que pueda generar una conversación.
          </p>

          {/* Libertad Temática */}
          <div className="inline-flex items-center gap-2 py-1 px-3 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Dynamo no te encierra en una temática.</span>
          </div>

          {/* CTAs del Hero */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              id="landing-hero-join-btn"
              onClick={handleJoinClick}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-xs sm:text-sm font-black text-black hover:bg-amber-400 active:scale-95 transition shadow-lg shadow-amber-500/25 cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-black stroke-black" />
              <span>Únete a Dynamo ⚡</span>
            </button>

            <button
              id="landing-hero-explore-btn"
              onClick={onStartExploring}
              className="flex items-center gap-2 rounded-xl border border-stone-700 bg-stone-800/90 px-5 py-3 text-xs sm:text-sm font-semibold text-stone-200 hover:bg-stone-700 hover:text-white transition cursor-pointer"
            >
              <Compass className="w-4 h-4 text-amber-400" />
              <span>Explorar Dynamos</span>
            </button>

            <button
              onClick={handleLoginClick}
              className="px-3 py-2 text-xs text-stone-400 hover:text-white transition cursor-pointer"
            >
              Ya tengo cuenta <span className="underline text-stone-300">→ Iniciar sesión</span>
            </button>
          </div>
        </div>

        {/* Visual Interactivo del Hero: Tarjeta Viva de un Dynamo */}
        <div className="mt-10 pt-6 border-t border-stone-800/80">
          <div className="flex items-center justify-between mb-3 text-[11px] font-mono text-stone-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5 text-amber-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Así se ve y se siente un Dynamo en vivo</span>
            </span>
            <span className="hidden sm:inline text-stone-400">Prueba interactiva</span>
          </div>

          <div className="rounded-2xl border border-[#2E3946] bg-[#141A21] p-4 sm:p-5 shadow-lg space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 text-black flex items-center justify-center font-bold text-xs">
                  M
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white">Mariana Garza</span>
                    <span className="text-[11px] text-stone-400 font-mono">@marianag</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-stone-400">
                    <MapPin className="w-3 h-3 text-amber-400" />
                    <span>Monterrey, N.L.</span>
                    <span aria-hidden="true">·</span>
                    <span>hace 2 horas</span>
                  </div>
                </div>
              </div>

              {/* Indicador de vida restante */}
              <div className="flex items-center gap-1 text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                <Clock className="w-3 h-3" />
                <span>22h 14m restantes</span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-stone-100 leading-relaxed font-normal">
              Subiendo a Chipinque temprano en la mañana. La vista despejada de la ciudad recarga a cualquiera. ¿Cuál es ese rincón donde van ustedes a pensar? ⛰️
            </p>

            <div className="flex items-center gap-2 text-[11px] font-mono text-amber-400">
              <span>#Monterrey</span>
              <span>#Lugares</span>
              <span>#Mañanas</span>
            </div>

            {/* Barra de Interacción */}
            <div className="pt-2 flex items-center justify-between border-t border-stone-800 text-xs">
              <button
                type="button"
                onClick={handleDemoGiftEnergy}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  demoHasGivenEnergy
                    ? 'bg-amber-500 text-black shadow-md shadow-amber-500/30'
                    : 'bg-stone-800 hover:bg-stone-700 text-amber-400'
                }`}
                title="Toca para darle ⚡"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>{demoEnergyCount} ⚡</span>
                <span className="text-[10px] font-normal opacity-90">
                  {demoHasGivenEnergy ? '(+6h inyectadas)' : '(Toca para darle ⚡)'}
                </span>
              </button>

              <div className="flex items-center gap-3 text-stone-400 text-[11px]">
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3 text-stone-400" />
                  <span>3 respuestas</span>
                </span>
                <span className="text-emerald-400 text-[11px] font-mono">
                  ✓ Vida activa garantizada
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          2. QUÉ PUEDES PUBLICAR (Libertad Temática sin categorías rígidas)
      ========================================================================= */}
      <section className="space-y-6">
        <div className="space-y-1">
          <p className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-semibold">
            Inspiración Cotidiana
          </p>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            ¿De qué puedes hablar en Dynamo?
          </h2>
          <p className="text-sm sm:text-base text-stone-300 font-medium">
            De lo que quieras conversar.
          </p>
          <p className="text-xs text-stone-400 leading-relaxed max-w-2xl">
            No tienes que encajar en una etiqueta ni pedir permiso. Dynamo es un espacio libre y abierto donde cada publicación inicia una conversación genuina.
          </p>
        </div>

        {/* 8 Ejemplos de uso comercial reales (No categorías formales) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl border border-stone-800 bg-[#12161A] space-y-1.5 hover:border-amber-500/30 transition">
            <div className="flex items-center gap-2">
              <span className="text-lg">💭</span>
              <h3 className="text-xs font-bold text-white">Una idea en tu cabeza</h3>
            </div>
            <p className="text-xs text-stone-400 leading-relaxed font-normal">
              Pensamientos espontáneos, hipótesis y reflexiones que merecen una plática sin prisas.
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-stone-800 bg-[#12161A] space-y-1.5 hover:border-amber-500/30 transition">
            <div className="flex items-center gap-2">
              <span className="text-lg">❤️</span>
              <h3 className="text-xs font-bold text-white">Cómo te fue hoy</h3>
            </div>
            <p className="text-xs text-stone-400 leading-relaxed font-normal">
              Lo bueno, lo retador, lo divertido o el desahogo honesto de tu jornada cotidiana.
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-stone-800 bg-[#12161A] space-y-1.5 hover:border-amber-500/30 transition">
            <div className="flex items-center gap-2">
              <span className="text-lg">😂</span>
              <h3 className="text-xs font-bold text-white">Algo que te hizo reír</h3>
            </div>
            <p className="text-xs text-stone-400 leading-relaxed font-normal">
              Ocurrencias, situaciones chistosas, humor cotidiano y anécdotas ligeras sin poses.
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-stone-800 bg-[#12161A] space-y-1.5 hover:border-amber-500/30 transition">
            <div className="flex items-center gap-2">
              <span className="text-lg">💼</span>
              <h3 className="text-xs font-bold text-white">Tu negocio o proyecto</h3>
            </div>
            <p className="text-xs text-stone-400 leading-relaxed font-normal">
              Emprendimientos, aprendizajes profesionales, convocatorias y proyectos reales.
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-stone-800 bg-[#12161A] space-y-1.5 hover:border-amber-500/30 transition">
            <div className="flex items-center gap-2">
              <span className="text-lg">📍</span>
              <h3 className="text-xs font-bold text-white">Un lugar que descubriste</h3>
            </div>
            <p className="text-xs text-stone-400 leading-relaxed font-normal">
              Cafés, taquerías de barrio, rutas de senderismo y rincones auténticos de la ciudad.
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-stone-800 bg-[#12161A] space-y-1.5 hover:border-amber-500/30 transition">
            <div className="flex items-center gap-2">
              <span className="text-lg">🌎</span>
              <h3 className="text-xs font-bold text-white">Tu comunidad</h3>
            </div>
            <p className="text-xs text-stone-400 leading-relaxed font-normal">
              Cultura, qué está pasando en tu colonia o municipio y temas que nos tocan a todos.
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-stone-800 bg-[#12161A] space-y-1.5 hover:border-amber-500/30 transition">
            <div className="flex items-center gap-2">
              <span className="text-lg">✈️</span>
              <h3 className="text-xs font-bold text-white">Un viaje o recomendación</h3>
            </div>
            <p className="text-xs text-stone-400 leading-relaxed font-normal">
              Tips de carretera, escapadas de fin de semana y descubrimientos en el camino.
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-stone-800 bg-[#12161A] space-y-1.5 hover:border-amber-500/30 transition">
            <div className="flex items-center gap-2">
              <span className="text-lg">❓</span>
              <h3 className="text-xs font-bold text-white">Una pregunta al mundo</h3>
            </div>
            <p className="text-xs text-stone-400 leading-relaxed font-normal">
              Dudas genuinas, dilemas y curiosidades para escuchar cómo piensan los demás.
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. TEXTO + IMAGEN
      ========================================================================= */}
      <section className="p-6 sm:p-8 rounded-3xl border border-[#232B35] bg-gradient-to-r from-[#14191F] via-[#12161A] to-[#101418] space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-md space-y-3">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400">
              <Camera className="w-4 h-4 text-amber-400" />
              <span>Texto e Imagen</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Comparte tus ideas con texto e imagen.
            </h2>
            <p className="text-sm sm:text-base text-stone-200 font-medium">
              Publica hasta 280 caracteres y, si quieres, acompáñalos con una imagen.
            </p>
            <p className="text-xs text-stone-400 leading-relaxed font-normal">
              Cada Dynamo puede integrar perfectamente tu texto en hasta 280 caracteres, tus hashtags y una fotografía que le dé contexto visual a tu historia.
            </p>

            <div className="pt-2 flex flex-col gap-2 text-xs text-stone-300">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Texto conciso de hasta 280 caracteres</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-amber-400 shrink-0" />
                <span>De 1 a 5 hashtags incluidos</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Una imagen opcional para ilustrar tu momento</span>
              </div>
            </div>
          </div>

          {/* Mockup visual de un Dynamo con Imagen */}
          <div className="md:w-80 w-full rounded-2xl border border-stone-800 bg-[#0E1216] p-4 space-y-3 shadow-xl shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-stone-600 to-amber-500 text-black flex items-center justify-center font-bold text-xs">
                  C
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Carlos Cantú</p>
                  <p className="text-[10px] text-stone-400 font-mono">@carlosc · hace 1h</p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                23h restantes
              </span>
            </div>

            <p className="text-xs text-stone-200 leading-relaxed">
              El cielo regio bañado de naranja antes de que caiga la noche. Ni el mejor filtro supera este atardecer desde el mirador. 🌅
            </p>

            <p className="text-[11px] font-mono text-amber-400">
              #Monterrey #Atardecer #Mirador
            </p>

            {/* Ilustración SVG propia del atardecer con montañas (cero imágenes externas) */}
            <div className="relative rounded-xl overflow-hidden h-36 bg-gradient-to-b from-amber-600/40 via-orange-900/40 to-stone-950 border border-stone-800 flex items-end justify-center">
              <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded text-[10px] text-stone-300 font-mono">
                <ImageIcon className="w-3 h-3 text-amber-400" />
                <span>Foto adjunta</span>
              </div>

              {/* Sol y silueta estilizada */}
              <div className="absolute top-6 left-12 w-10 h-10 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-200 blur-[1px] opacity-90 shadow-lg shadow-amber-500/50" />
              <svg className="w-full h-24" viewBox="0 0 320 96" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 96L45 54L85 70L150 20L195 48L240 32L320 96H0Z" fill="#0E1216" />
                <path d="M70 96L120 40L160 60L210 26L265 65L320 96H70Z" fill="#14191F" fillOpacity="0.8" />
              </svg>
            </div>

            <div className="pt-1 flex items-center justify-between text-[11px] text-stone-400">
              <span className="flex items-center gap-1 font-bold text-amber-400">
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>24 ⚡</span>
              </span>
              <span>4 respuestas</span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. REGLA FUNDAMENTAL DE 280 CARACTERES + HASHTAGS
      ========================================================================= */}
      <section className="p-6 sm:p-8 rounded-3xl border border-[#232B35] bg-[#12161A] space-y-6">
        <div className="max-w-2xl space-y-2">
          <p className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-semibold">
            Regla de Formato
          </p>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Hasta 280 caracteres por Dynamo, incluyendo los hashtags.
          </h2>
          <p className="text-sm text-stone-200 font-medium">
            Puedes usar de 1 a 5 hashtags por publicación.
          </p>
          <p className="text-xs text-stone-400 leading-relaxed font-normal">
            Los hashtags ayudan a descubrir conversaciones relacionadas y forman parte del límite de 280 caracteres. No están fuera ni se calculan por separado.
          </p>
        </div>

        {/* Demostrador interactivo y visual del límite de 280 caracteres */}
        <div className="p-5 rounded-2xl bg-[#0E1216] border border-stone-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-amber-400" />
              <span>Ejemplo en tiempo real:</span>
            </span>

            {/* Contador 72 / 280 */}
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm sm:text-base font-bold text-white">
                <span className={currentLength > maxChars ? 'text-rose-400' : 'text-amber-400'}>
                  {currentLength}
                </span>{' '}
                <span className="text-stone-500 font-normal">/ {maxChars}</span>
              </span>
              <span className="text-[11px] text-stone-400 font-mono">
                ({detectedHashtags.length} de 5 hashtags)
              </span>
            </div>
          </div>

          {/* Campo interactivo */}
          <div className="space-y-2">
            <input
              type="text"
              value={demoText}
              onChange={(e) => setDemoText(e.target.value.slice(0, 280))}
              className="w-full bg-[#141A21] border border-[#2E3946] focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white outline-none font-mono transition"
              placeholder="Escribe algo para ver cómo se calculan los caracteres y hashtags..."
            />

            {/* Barra de progreso visual */}
            <div className="w-full bg-stone-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-amber-500 h-full transition-all duration-200"
                style={{ width: `${Math.min(100, (currentLength / maxChars) * 100)}%` }}
              />
            </div>
          </div>

          {/* Desglose educativo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-[11px] text-stone-300 border-t border-stone-800/80">
            <div className="p-2.5 rounded-xl bg-[#141A21] border border-stone-800">
              <span className="text-stone-400 block text-[10px] uppercase font-mono">Texto</span>
              <span className="font-bold text-white">{currentLength - hashtagCharsCount} caracteres</span>
            </div>

            <div className="p-2.5 rounded-xl bg-[#141A21] border border-stone-800">
              <span className="text-stone-400 block text-[10px] uppercase font-mono">Hashtags incluidos</span>
              <span className="font-bold text-amber-400">{hashtagCharsCount} caracteres ({detectedHashtags.length} tags)</span>
            </div>

            <div className="p-2.5 rounded-xl bg-[#141A21] border border-stone-800">
              <span className="text-stone-400 block text-[10px] uppercase font-mono">Espacio restante</span>
              <span className="font-bold text-emerald-400">{maxChars - currentLength} caracteres libres</span>
            </div>
          </div>

          <p className="text-[11px] text-amber-300 font-medium">
            ✓ Los hashtags forman parte del límite de 280 caracteres. Nada queda oculto.
          </p>
        </div>
      </section>

      {/* =========================================================================
          5. HASHTAGS Y DESCUBRIMIENTO: ESCRIBE. ETIQUETA. DESCUBRE.
      ========================================================================= */}
      <section className="space-y-6">
        <div className="space-y-2">
          <p className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-semibold">
            Dinámica de Conversación
          </p>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Escribe. Etiqueta. Descubre.
          </h2>
          <p className="text-sm sm:text-base text-stone-200 font-medium">
            Los hashtags ayudan a descubrir conversaciones relacionadas.
          </p>
          <p className="text-xs text-stone-400 leading-relaxed max-w-2xl font-normal">
            Puedes usar de 1 a 5 hashtags por publicación dentro de los 280 caracteres. No son categorías formales ni cerradas: son etiquetas vivas creadas por la comunidad.
          </p>
        </div>

        {/* Ejemplos Visuales de Hashtags */}
        <div className="flex flex-wrap items-center gap-2">
          {['#Monterrey', '#Viajes', '#Cocina', '#Negocios', '#Humor', '#Tecnología'].map((tag) => (
            <span
              key={tag}
              className="px-3 py-1.5 rounded-xl bg-[#141A21] border border-stone-800 text-xs font-mono text-amber-300 hover:border-amber-500/50 hover:bg-stone-800 transition cursor-default"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Explicación del loop de producto */}
        <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-[#141A21] to-[#0E1216] border border-stone-800 space-y-4">
          <p className="text-xs font-bold text-stone-200">
            Toca un hashtag y descubre las publicaciones activas que están hablando de ese tema.
          </p>
          <p className="text-xs text-stone-400 leading-relaxed font-normal">
            Las tendencias muestran los temas que están generando más conversación en la comunidad. Así se conecta el ciclo completo de Dynamo:
          </p>

          {/* Loop Diagram */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4 p-3 rounded-xl bg-[#090C0E] border border-stone-800/80 text-xs font-mono">
            <div className="flex items-center gap-2 text-stone-200 font-bold">
              <span className="text-amber-400 font-black">1.</span>
              <span>Publicar</span>
            </div>
            <span className="text-amber-400">→</span>
            <div className="flex items-center gap-2 text-stone-200 font-bold">
              <span className="text-amber-400 font-black">2.</span>
              <span>Hashtag</span>
            </div>
            <span className="text-amber-400">→</span>
            <div className="flex items-center gap-2 text-stone-200 font-bold">
              <span className="text-amber-400 font-black">3.</span>
              <span>Descubrir</span>
            </div>
            <span className="text-amber-400">→</span>
            <div className="flex items-center gap-2 text-amber-300 font-bold">
              <span className="text-amber-400 font-black">4.</span>
              <span>Conversar</span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          6. DESCUBRE LO QUE ESTÁ PASANDO
      ========================================================================= */}
      <section className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Descubre lo que está pasando
          </h2>
          <p className="text-xs sm:text-sm text-stone-300 leading-relaxed max-w-2xl font-normal">
            Explora tendencias, hashtags activos, Dynamos que están por desaparecer, publicaciones que están recibiendo nueva energía y los Dynamos que dejaron huella en la comunidad.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* 1. Tendencias */}
          <div className="p-4 rounded-2xl border border-stone-800 bg-[#12161A] space-y-2 hover:border-amber-500/30 transition">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-400" />
              <h3 className="text-xs sm:text-sm font-bold text-white">🔥 Tendencias</h3>
            </div>
            <p className="text-xs text-stone-300 font-normal">
              Descubre los temas que están generando conversación y pulso activo en la comunidad.
            </p>
          </div>

          {/* 2. Hashtags */}
          <div className="p-4 rounded-2xl border border-stone-800 bg-[#12161A] space-y-2 hover:border-amber-500/30 transition">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs sm:text-sm font-bold text-white">#️⃣ Hashtags</h3>
            </div>
            <p className="text-xs text-stone-300 font-normal">
              Explora publicaciones relacionadas con cualquier tema o interés específico en tiempo real.
            </p>
          </div>

          {/* 3. Casi desaparecen */}
          <div className="p-4 rounded-2xl border border-stone-800 bg-[#12161A] space-y-2 hover:border-amber-500/30 transition">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs sm:text-sm font-bold text-white">⏳ Casi desaparecen</h3>
            </div>
            <p className="text-xs text-stone-300 font-normal">
              Encuentra Dynamos que están cerca de terminar su vida y ayúdalos con energía antes de que expiren.
            </p>
          </div>

          {/* 4. Reviviendo */}
          <div className="p-4 rounded-2xl border border-stone-800 bg-[#12161A] space-y-2 hover:border-amber-500/30 transition">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
              <h3 className="text-xs sm:text-sm font-bold text-white">⚡ Reviviendo</h3>
            </div>
            <p className="text-xs text-stone-300 font-normal">
              Descubre Dynamos que acaban de recibir energía de la comunidad y extendieron su ciclo de vida.
            </p>
          </div>

          {/* 5. Best Dynamos */}
          <div className="p-4 rounded-2xl border border-stone-800 bg-[#12161A] space-y-2 sm:col-span-2 lg:col-span-2 hover:border-amber-500/30 transition">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <h3 className="text-xs sm:text-sm font-bold text-white">🏆 Best Dynamos</h3>
            </div>
            <p className="text-xs text-stone-300 font-normal">
              Descubre publicaciones memorables que acumularon más energía de la comunidad y dejaron huella en la historia viva de Dynamo.
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          7. ⚡ CÓMO FUNCIONA + MICROBLOG EFÍMERO
      ========================================================================= */}
      <section className="p-6 sm:p-8 rounded-3xl border border-amber-500/30 bg-gradient-to-b from-[#171D24] to-[#12161A] space-y-6">
        <div className="max-w-2xl space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
            <Zap className="w-4 h-4 fill-amber-400" />
            <span>El Mecanismo de Pulso Comunitario</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Si algo te interesa, dale energía. ⚡
          </h2>
          <p className="text-sm sm:text-base text-stone-200 font-medium">
            Cada Dynamo comienza con 24 horas de vida. Cada ⚡ añade 6 horas. Hasta un máximo de 7 días.
          </p>
          <p className="text-xs text-stone-300 leading-relaxed font-normal">
            Si algo te gusta, te hace reír o quieres ayudar a que siga visible, dale ⚡. No es un like de vanidad: es tiempo real de vida que la comunidad le obsequia a una conversación.
          </p>
        </div>

        {/* Explicación del Microblog Efímero como ventaja */}
        <div className="p-4 rounded-2xl bg-[#0E1216] border border-amber-500/20 space-y-2">
          <h3 className="text-xs font-bold text-amber-300">
            Lo que publicas hoy no tiene que perseguirte para siempre.
          </h3>
          <p className="text-xs text-stone-300 leading-relaxed font-normal">
            Los Dynamos están pensados para el presente. Escribe, conversa y deja que la conversación siga su camino natural. Si la comunidad la mantiene viva con ⚡, perdura hasta 7 días; si cumple su ciclo, se desvanece con dignidad.
          </p>
        </div>

        {/* 10 ⚡ gratuitas para compartir */}
        <div className="p-4 rounded-2xl bg-[#0E1216] border border-stone-800 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
            <Zap className="w-3.5 h-3.5 fill-amber-400" />
            <span>10 ⚡ gratuitas para compartir</span>
          </div>
          <p className="text-xs text-stone-300 leading-relaxed font-normal">
            Cada usuario dispone de 10 ⚡ gratuitas en un periodo móvil de 24 horas.
          </p>
          <p className="text-xs text-stone-300 leading-relaxed font-normal">
            Las energías gratuitas no se acumulan: se recuperan conforme cada energía utilizada cumple 24 horas, hasta volver a disponer de 10.
          </p>
          <p className="text-xs text-stone-400 pt-1 leading-relaxed font-normal">
            También puedes contar con ⚡ adicionales para compartir cuando quieras.
          </p>
        </div>

        {/* Diagrama de Ciclo de Vida */}
        <div className="p-4 rounded-2xl bg-[#090C0E] border border-stone-800 text-center space-y-3">
          <p className="text-[11px] font-mono text-stone-400 uppercase">Ciclo Natural de una Publicación</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 text-xs font-mono font-bold">
            <div className="px-3 py-1.5 rounded-xl bg-stone-800 text-stone-200 border border-stone-700">
              24h de Vida Inicial
            </div>
            <span className="text-amber-400 text-sm">→</span>
            <div className="px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30">
              ⚡ (+6 horas)
            </div>
            <span className="text-amber-400 text-sm">→</span>
            <div className="px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30">
              ⚡ (+6 horas)
            </div>
            <span className="text-amber-400 text-sm">→</span>
            <div className="px-3 py-1.5 rounded-xl bg-amber-500 text-black font-extrabold shadow-md">
              Tope Máximo: 7 Días
            </div>
          </div>
          <p className="text-xs text-amber-300 font-semibold pt-1">
            La comunidad decide colectivamente qué merece seguir vivo.
          </p>
        </div>
      </section>

      {/* =========================================================================
          8. MENOS RUIDO. MÁS CONVERSACIÓN.
      ========================================================================= */}
      <section className="p-6 sm:p-8 rounded-3xl border border-[#232B35] bg-[#12161A] space-y-6">
        <div className="max-w-2xl space-y-2">
          <p className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-semibold">
            Salud Digital
          </p>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Menos ruido. Más conversación.
          </h2>
          <p className="text-sm text-stone-300 font-medium">
            Más espacio para decir algo que valga la pena leer.
          </p>
          <p className="text-xs text-stone-400 leading-relaxed font-normal">
            Un entorno limpio donde la palabra recupera su valor, donde estás al día cuando terminas de leer y puedes continuar con tu vida real sin ansiedad.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-[#171D24] border border-stone-800 space-y-1">
            <span className="font-bold text-white block">Sin likes</span>
            <span className="text-[11px] text-stone-400">Sin contadores de vanidad ni persecución de ego.</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#171D24] border border-stone-800 space-y-1">
            <span className="font-bold text-white block">Sin métricas de ego</span>
            <span className="text-[11px] text-stone-400">Tu valor está en lo que aportas hoy, no en números inflados.</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#171D24] border border-stone-800 space-y-1">
            <span className="font-bold text-white block">Sin feed infinito</span>
            <span className="text-[11px] text-stone-400">Cuando lees las publicaciones activas, estás al día.</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#171D24] border border-stone-800 space-y-1">
            <span className="font-bold text-white block">Sin hilos interminables</span>
            <span className="text-[11px] text-stone-400">Respuestas concisas, ordenadas y directas.</span>
          </div>
        </div>
      </section>

      {/* =========================================================================
          9. LIBERTAD + NORMAS DE CONVIVENCIA
      ========================================================================= */}
      <section className="space-y-6">
        <div className="space-y-2">
          <p className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-semibold">
            Principios de Comunidad
          </p>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Habla como tú quieras. Lee como quieras.
          </h2>
          <p className="text-xs sm:text-sm text-stone-300 leading-relaxed font-normal">
            Dynamo está hecho para que puedas expresar tus ideas, opiniones, emociones, experiencias y preguntas con libertad.
          </p>
        </div>

        {/* Eje de Convivencia Responsable */}
        <div className="p-5 rounded-2xl bg-[#141A21] border border-amber-500/25 space-y-2">
          <h3 className="text-sm font-bold text-amber-300">
            La libertad de expresarte no significa libertad para dañar a los demás.
          </h3>
          <p className="text-xs text-stone-300 leading-relaxed font-normal">
            Puedes pensar diferente, opinar diferente y conversar diferente. Pero la comunidad se construye con educación, respeto y responsabilidad.
          </p>
        </div>

        {/* Límites claros */}
        <div className="p-5 rounded-2xl bg-rose-950/20 border border-rose-500/30 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-rose-400">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Fuera de Dynamo</span>
          </div>
          <p className="text-xs text-stone-300 leading-relaxed font-normal">
            Quedan fuera el acoso, amenazas, violencia, odio, pornografía, contenido sexual explícito, exposición de información personal, doxxing, fraude, spam abusivo y cualquier contenido destinado deliberadamente a perjudicar a otras personas.
          </p>
        </div>

        {/* Mensaje de cierre de convivencia */}
        <div className="p-4 rounded-xl bg-[#0E1216] border border-stone-800 text-center">
          <p className="text-xs sm:text-sm font-bold text-stone-200">
            Puedes pensar diferente. Puedes opinar diferente. Puedes conversar diferente.{' '}
            <span className="text-amber-400">El respeto es el punto de encuentro.</span>
          </p>
        </div>
      </section>

      {/* =========================================================================
          10. PRIVACIDAD Y SEGURIDAD
      ========================================================================= */}
      <section className="p-6 sm:p-8 rounded-3xl border border-[#232B35] bg-[#12161A] space-y-6">
        <div className="max-w-2xl space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Protección y Confianza</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Una comunidad abierta también necesita límites claros para proteger a sus personas.
          </h2>
          <p className="text-xs sm:text-sm text-stone-300 leading-relaxed font-normal">
            La privacidad no es una función adicional: está integrada en la arquitectura misma del producto.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-[#171D24] border border-stone-800 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-white">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Correo no público</span>
            </div>
            <p className="text-[11px] text-stone-400">
              Nadie en la comunidad puede ver tu email ni tus credenciales personales.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#171D24] border border-stone-800 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-white">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Protección de datos</span>
            </div>
            <p className="text-[11px] text-stone-400">
              Reglas activas contra intercambio de datos bancarios o números sensibles.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#171D24] border border-stone-800 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-white">
              <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
              <span>Reporte y moderación</span>
            </div>
            <p className="text-[11px] text-stone-400">
              Herramientas de reporte en 1 clic y moderación para proteger a los usuarios.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#171D24] border border-stone-800 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-white">
              <HeartOff className="w-3.5 h-3.5 text-rose-400" />
              <span>Cero venta de datos</span>
            </div>
            <p className="text-[11px] text-stone-400">
              Sin venta de perfiles ni subastas de comportamiento a anunciantes.
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          11. VISIÓN: NACIÓ AQUÍ. PUEDE LLEGAR MUCHO MÁS LEJOS.
      ========================================================================= */}
      <section className="p-6 sm:p-8 rounded-3xl border border-amber-500/25 bg-gradient-to-b from-[#171D24] via-[#13181E] to-[#101418] space-y-6">
        <div className="max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400">
            <MapPin className="w-4 h-4 text-amber-400" />
            <span>Nació en Monterrey, Nuevo León, México 🇲🇽</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Nació aquí. Puede llegar mucho más lejos.
          </h2>
          <p className="text-xs sm:text-sm text-stone-200 leading-relaxed font-normal">
            Dynamo nació en Monterrey, Nuevo León, México.
          </p>
          <p className="text-xs sm:text-sm text-stone-300 leading-relaxed font-normal">
            Empezamos con una idea sencilla: crear un lugar para compartir lo que pensamos, descubrir nuevas conversaciones y conectar personas.
          </p>
          <p className="text-xs sm:text-sm text-stone-300 leading-relaxed font-normal">
            Puede comenzar entre amigos, crecer en una comunidad, llegar a nuevas ciudades y estados, cruzar fronteras y conectar personas de diferentes países.
          </p>
          <p className="text-xs sm:text-sm text-stone-300 leading-relaxed font-normal">
            Nuestra visión es construir, con el tiempo, una gran comunidad de microblogging para el mundo hispanohablante y abrir la conversación mucho más allá.
          </p>
        </div>

        {/* Escalera de Crecimiento Progresivo */}
        <div className="p-4 rounded-2xl bg-[#0E1216] border border-stone-800 space-y-2.5">
          <p className="text-[10px] font-mono text-stone-400 uppercase tracking-wider">
            Visión de Crecimiento Progresivo
          </p>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-stone-300">
            <span className="px-2 py-0.5 rounded bg-stone-800 text-stone-300">Amigos</span>
            <span className="text-amber-400">→</span>
            <span className="px-2 py-0.5 rounded bg-stone-800 text-stone-300">Comunidad</span>
            <span className="text-amber-400">→</span>
            <span className="px-2 py-0.5 rounded bg-stone-800 text-stone-300">Colonia</span>
            <span className="text-amber-400">→</span>
            <span className="px-2 py-0.5 rounded bg-stone-800 text-stone-300">Municipio</span>
            <span className="text-amber-400">→</span>
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">Ciudad</span>
            <span className="text-amber-400">→</span>
            <span className="px-2 py-0.5 rounded bg-stone-800 text-stone-300">Estado</span>
            <span className="text-amber-400">→</span>
            <span className="px-2 py-0.5 rounded bg-stone-800 text-stone-300">País</span>
            <span className="text-amber-400">→</span>
            <span className="px-2 py-0.5 rounded bg-stone-800 text-stone-300">Comunidades de habla hispana</span>
            <span className="text-amber-400">→</span>
            <span className="px-2 py-0.5 rounded bg-amber-500 text-black font-black shadow-md">Mundo</span>
          </div>

          <p className="text-xs text-amber-300 font-bold pt-1 italic">
            “Una conversación puede comenzar en una ciudad y llegar mucho más lejos.”
          </p>
        </div>
      </section>

      {/* =========================================================================
          TRADUCCIÓN — PREPARADO PARA CRECER INTERNACIONALMENTE
      ========================================================================= */}
      <section className="p-6 sm:p-8 rounded-3xl border border-[#232B35] bg-[#12161A] space-y-4">
        <div className="max-w-xl space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
            <Globe className="w-4 h-4 text-sky-400" />
            <span>Visión Internacional</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Habla como tú quieras. Lee como quieras.
          </h2>
          <p className="text-xs sm:text-sm text-stone-300 leading-relaxed font-normal">
            Dynamo está pensado para comunidades que hablan diferentes idiomas. El original permanece intacto y cada usuario podrá leer contenido según su idioma.
          </p>
          <p className="text-[11px] text-stone-400 font-normal">
            (Visión de producto preparada para la expansión internacional de la comunidad)
          </p>
        </div>

        {/* Translation UX Mockup Preview */}
        <div className="p-4 rounded-2xl bg-[#0E1216] border border-stone-800 space-y-3 max-w-lg">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">@james_voyager</span>
              <span className="text-[10px] text-stone-400 font-mono">EN</span>
            </div>
            <span className="text-[10px] text-stone-400 font-mono">Publicación original</span>
          </div>

          <p className="text-xs sm:text-sm text-stone-200 italic leading-relaxed">
            “Every great conversation starts as a quiet, honest thought in a local neighborhood.”
          </p>

          {/* Interactive translation demonstration */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowDemoTranslation(!showDemoTranslation)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-sky-300 text-xs font-medium transition cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{showDemoTranslation ? 'Ocultar traducción' : 'Mostrar traducción'}</span>
            </button>

            {showDemoTranslation && (
              <div className="mt-2.5 p-2.5 rounded-xl bg-sky-950/20 border border-sky-500/30 text-xs text-sky-200">
                <p className="text-[10px] uppercase font-mono text-sky-400 mb-0.5 font-bold">
                  Traducción de ejemplo
                </p>
                <p className="italic">
                  “Cada gran conversación comienza como un pensamiento honesto y tranquilo en un barrio local.”
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* =========================================================================
          12. CTA FINAL
      ========================================================================= */}
      <section className="p-8 sm:p-12 rounded-3xl border border-amber-500/30 bg-gradient-to-b from-[#181F27] to-[#101418] text-center space-y-5 shadow-2xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-black mx-auto shadow-lg shadow-amber-500/25">
          <Zap className="w-6 h-6 fill-black stroke-black" />
        </div>

        <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
          ¿Qué tienes que decir hoy?
        </h2>

        <p className="text-xs sm:text-base text-stone-300 max-w-lg mx-auto leading-relaxed font-medium">
          Escribe. Comparte. Descubre. Dale energía a lo que merece seguir vivo.
        </p>

        <div className="pt-2 flex flex-wrap justify-center gap-3">
          <button
            id="landing-cta-final-join"
            onClick={handleJoinClick}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-xs sm:text-sm font-black text-black hover:bg-amber-400 active:scale-95 transition shadow-lg shadow-amber-500/25 cursor-pointer"
          >
            <Zap className="w-4 h-4 fill-black stroke-black" />
            <span>Únete a Dynamo ⚡</span>
          </button>

          <button
            id="landing-cta-final-explore"
            onClick={onStartExploring}
            className="px-5 py-3 rounded-xl border border-stone-700 bg-stone-800 text-stone-200 hover:text-white hover:bg-stone-700 text-xs sm:text-sm font-semibold transition cursor-pointer"
          >
            Explorar Dynamos
          </button>
        </div>

        <p className="text-[11px] text-stone-400 pt-1">
          Registro gratuito · Mayores de 16 años · Sin venta de datos personales
        </p>
      </section>
    </div>
  );
};
