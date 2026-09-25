import React, { useState, useEffect } from 'react';
import {
  X,
  Zap,
  Copy,
  Check,
  Share2,
  Users,
  Eye,
  UserCheck,
  Sparkles,
  ExternalLink,
  MessageCircle,
  Send,
  Loader2,
} from 'lucide-react';
import { referralsService } from '@/src/modules/referrals/referralsService';
import { ReferralStats } from '@/src/modules/referrals/referralsTypes';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  userUsername?: string;
}

export const InviteModal: React.FC<InviteModalProps> = ({
  isOpen,
  onClose,
  userUsername,
}) => {
  const [code, setCode] = useState<string | null>(null);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);

    Promise.all([
      referralsService.getMyReferralCode(),
      referralsService.getMyReferralStats(),
    ])
      .then(([codeInfo, statsData]) => {
        if (!isMounted) return;
        if (codeInfo) setCode(codeInfo.code);
        if (statsData) setStats(statsData);
      })
      .catch((err) => {
        console.warn('Error loading invite details:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://dynamo.app';
  const inviteUrl = code ? `${currentOrigin}/join?ref=${code}` : `${currentOrigin}/join`;

  const defaultShareCopy = `Estoy usando Dynamo ⚡, el microblog regio. Únete: ${inviteUrl}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {}
  };

  const handleCopyFullText = async () => {
    try {
      await navigator.clipboard.writeText(defaultShareCopy);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
    } catch {}
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Dynamo ⚡ — El microblog regio',
          text: defaultShareCopy,
          url: inviteUrl,
        });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }
    // Fallback to copy
    handleCopyLink();
  };

  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(defaultShareCopy)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent('Estoy usando Dynamo ⚡, el microblog regio.')}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(defaultShareCopy)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-lg my-auto rounded-3xl border border-[#262E38] bg-[#12161A] p-5 sm:p-7 shadow-2xl text-stone-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-stone-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-black shadow-lg shadow-amber-500/20">
              <Zap className="h-6 w-6 fill-black stroke-black" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                Invitar a Dynamo ⚡
              </h2>
              <p className="text-xs text-stone-400">
                Tu enlace de invitación único y personal para traer a tus amigos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800/80 transition cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-stone-400">
            <Loader2 className="w-7 h-7 text-amber-500 animate-spin" />
            <span className="text-xs">Cargando tus datos de invitación...</span>
          </div>
        ) : (
          <div className="space-y-6 pt-5">
            {/* Referral Link Box */}
            <div className="rounded-2xl border border-stone-800 bg-[#0A0D10] p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-stone-300">Tu enlace exclusivo:</span>
                {code && (
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    CÓDIGO: {code}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 bg-stone-900/90 border border-stone-800 rounded-xl px-3 py-2 text-xs font-mono text-stone-300 truncate select-all">
                  {inviteUrl}
                </div>
                <button
                  id="btn-copy-invite-link"
                  onClick={handleCopyLink}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 transition cursor-pointer active:scale-95 shrink-0 shadow-sm"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Share Buttons */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-stone-400">Compartir rápidamente en:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <button
                    onClick={handleNativeShare}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-stone-700 bg-stone-800/80 hover:bg-stone-700 text-xs font-semibold text-white transition cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Compartir</span>
                  </button>
                )}

                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-emerald-900/50 bg-emerald-950/40 hover:bg-emerald-900/50 text-xs font-semibold text-emerald-300 transition"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>WhatsApp</span>
                </a>

                <a
                  href={telegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-sky-900/50 bg-sky-950/40 hover:bg-sky-900/50 text-xs font-semibold text-sky-300 transition"
                >
                  <Send className="w-3.5 h-3.5 text-sky-400" />
                  <span>Telegram</span>
                </a>

                <a
                  href={twitterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-stone-800 bg-stone-900 hover:bg-stone-800 text-xs font-semibold text-stone-200 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
                  <span>X / Twitter</span>
                </a>
              </div>
            </div>

            {/* Copy full message */}
            <div className="rounded-2xl border border-stone-800/80 bg-stone-900/40 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs text-stone-400">
                <span>Mensaje sugerido listo para enviar:</span>
                <button
                  onClick={handleCopyFullText}
                  className="text-amber-400 hover:text-amber-300 text-xs font-medium flex items-center gap-1 cursor-pointer"
                >
                  {copiedText ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Texto copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copiar texto</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-stone-300 leading-relaxed font-sans bg-stone-950/60 p-2.5 rounded-xl border border-stone-800/60">
                "{defaultShareCopy}"
              </p>
            </div>

            {/* Live Funnel Stats (Zero Mock, 100% Real from DB) */}
            <div className="rounded-2xl border border-stone-800 bg-[#0E1216] p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Impacto de tus invitaciones
                </span>
                <span className="text-[10px] text-stone-400">Datos verificados en DB</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-stone-800/80 bg-stone-900/50 p-2.5">
                  <div className="flex justify-center text-stone-400 mb-1">
                    <Eye className="w-4 h-4" />
                  </div>
                  <div className="text-base sm:text-lg font-black text-white font-mono">
                    {stats?.clicks || 0}
                  </div>
                  <div className="text-[10px] text-stone-400 font-medium">Clics</div>
                </div>

                <div className="rounded-xl border border-stone-800/80 bg-stone-900/50 p-2.5">
                  <div className="flex justify-center text-amber-400 mb-1">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="text-base sm:text-lg font-black text-amber-400 font-mono">
                    {stats?.signups || 0}
                  </div>
                  <div className="text-[10px] text-stone-400 font-medium">Registrados</div>
                </div>

                <div className="rounded-xl border border-stone-800/80 bg-stone-900/50 p-2.5">
                  <div className="flex justify-center text-emerald-400 mb-1">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div className="text-base sm:text-lg font-black text-emerald-400 font-mono">
                    {stats?.active_users || 0}
                  </div>
                  <div className="text-[10px] text-stone-400 font-medium">Activos</div>
                </div>
              </div>
            </div>

            {/* Note on Age & Community */}
            <div className="flex items-center gap-2 text-[11px] text-stone-400 border-t border-stone-800 pt-3">
              <span className="px-1.5 py-0.5 rounded bg-stone-800 text-stone-300 font-semibold text-[10px]">
                16+
              </span>
              <span>
                Todo usuario invitado debe tener al menos 16 años y aceptar las Normas de la Comunidad.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
