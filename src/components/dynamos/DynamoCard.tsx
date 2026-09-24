import React, { useState, useEffect } from 'react';
import { Dynamo } from '@/src/modules/dynamos/dynamosTypes';
import { getDynamoTimeStatus, DynamoTimeStatus } from '@/src/modules/dynamos/dynamoRules';
import { Zap, MessageSquare, Clock, MoreHorizontal, AlertCircle, Trash2, Check, Flame, Share2, Maximize2 } from 'lucide-react';
import { useAuth } from '@/src/modules/auth/AuthContext';
import { dynamosService } from '@/src/modules/dynamos/dynamosService';
import { formatUserFriendlyError } from '@/src/utils/errorHandler';
import { ImageLightboxModal } from '@/src/components/common/ImageLightboxModal';

interface DynamoCardProps {
  dynamo: Dynamo;
  onGiftEnergy: (dynamoId: string) => Promise<any>;
  onOpenReply: (dynamo: Dynamo) => void;
  onReport?: (dynamoId: string, authorId?: string) => void;
  onDelete?: (dynamoId: string) => void;
  onSelectHashtag?: (tag: string) => void;
  onExpired?: (dynamoId: string) => void;
  onAuthorClick?: (author: any) => void;
}

export const DynamoCard: React.FC<DynamoCardProps> = ({
  dynamo,
  onGiftEnergy,
  onOpenReply,
  onReport,
  onDelete,
  onSelectHashtag,
  onExpired,
  onAuthorClick,
}) => {
  const { user, profile } = useAuth();
  const isOwner = Boolean(user && (user.id === dynamo.user_id || profile?.id === dynamo.user_id));

  // Local state for real-time reactivity without re-fetching entire feed
  const [expiresAt, setExpiresAt] = useState<string>(dynamo.expires_at);
  const [energyCount, setEnergyCount] = useState<number>(dynamo.energy_gifts_count || 0);
  const [timeStatus, setTimeStatus] = useState<DynamoTimeStatus>(() =>
    getDynamoTimeStatus(dynamo.created_at, dynamo.expires_at)
  );

  const [isGifting, setIsGifting] = useState(false);
  const [giftFeedback, setGiftFeedback] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const isHidden = dynamo.status === 'hidden';

  // Synchronize when prop changes
  useEffect(() => {
    setExpiresAt(dynamo.expires_at);
    setEnergyCount(dynamo.energy_gifts_count || 0);
  }, [dynamo.expires_at, dynamo.energy_gifts_count]);

  // Live countdown timer without page reload
  useEffect(() => {
    const updateTime = () => {
      // Avoid burning cycles if document is in background
      if (typeof document !== 'undefined' && document.hidden) return;

      const currentStatus = getDynamoTimeStatus(dynamo.created_at, expiresAt);
      setTimeStatus(currentStatus);

      // When reaching zero, retire from feed and securely mark as expired
      if (currentStatus.isExpired) {
        dynamosService.markAsExpired(dynamo.id).catch(() => {});
        onExpired?.(dynamo.id);
      }
    };

    updateTime();

    // Check interval: every 10s if under 2 hours, otherwise every 30s
    const intervalMs = timeStatus.totalMinutesLeft < 120 ? 10000 : 30000;
    const interval = setInterval(updateTime, intervalMs);

    return () => clearInterval(interval);
  }, [dynamo.created_at, expiresAt, dynamo.id, timeStatus.totalMinutesLeft, onExpired]);

  const handleGiveEnergy = async () => {
    if (isGifting || timeStatus.isExpired || isHidden) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setGiftFeedback({
        type: 'error',
        message: 'Sin conexión. Inténtalo nuevamente cuando tengas internet.',
      });
      setTimeout(() => setGiftFeedback(null), 3500);
      return;
    }

    if (isHidden) {
      setGiftFeedback({ type: 'error', message: 'Este Dynamo está ocultado por moderación y no puede recibir energía ⚡' });
      setTimeout(() => setGiftFeedback(null), 3000);
      return;
    }

    if (!user) {
      setGiftFeedback({ type: 'error', message: 'Inicia sesión para inyectar energía ⚡' });
      setTimeout(() => setGiftFeedback(null), 3000);
      return;
    }

    if (isOwner) {
      setGiftFeedback({ type: 'error', message: 'No puedes inyectar energía a tu propio Dynamo' });
      setTimeout(() => setGiftFeedback(null), 3000);
      return;
    }

    setIsGifting(true);
    setGiftFeedback(null);

    try {
      const result = await onGiftEnergy(dynamo.id);
      if (result) {
        if (result.newExpiresAt) {
          setExpiresAt(result.newExpiresAt);
        }
        if (typeof result.totalGifts === 'number') {
          setEnergyCount(result.totalGifts);
        }

        if (result.reachedMaxLifespan) {
          setGiftFeedback({
            type: 'info',
            message: '⚡ Vida máxima alcanzada: este Dynamo llegó al límite absoluto de 7 días.',
          });
        } else {
          setGiftFeedback({
            type: 'success',
            message: '⚡ +6 horas de vida inyectadas con éxito.',
          });
        }
      } else {
        setGiftFeedback({
          type: 'success',
          message: '⚡ +6 horas de vida inyectadas.',
        });
      }
      setTimeout(() => setGiftFeedback(null), 3500);
    } catch (err: unknown) {
      setGiftFeedback({
        type: 'error',
        message: formatUserFriendlyError(err),
      });
      setTimeout(() => setGiftFeedback(null), 3500);
    } finally {
      setIsGifting(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText?.(dynamo.content);
    setCopiedLink(true);
    setTimeout(() => {
      setCopiedLink(false);
      setShowMenu(false);
    }, 1500);
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/d/${dynamo.id}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Dynamo de @${dynamo.author?.username || 'usuario'}`,
          text: dynamo.content.length > 120 ? `${dynamo.content.slice(0, 117)}...` : dynamo.content,
          url: shareUrl,
        });
        setGiftFeedback({ type: 'info', message: '✓ Enlace compartido' });
        setTimeout(() => setGiftFeedback(null), 2500);
        setShowMenu(false);
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setCopiedLink(true);
        setGiftFeedback({ type: 'info', message: '✓ Enlace copiado al portapapeles' });
        setTimeout(() => {
          setCopiedLink(false);
          setGiftFeedback(null);
          setShowMenu(false);
        }, 2000);
      }
    } catch {
      setGiftFeedback({ type: 'error', message: 'No se pudo copiar el enlace' });
      setTimeout(() => setGiftFeedback(null), 2500);
    }
  };

  // Visual card styles based on state
  const isAlmostGone = timeStatus.visualState === 'almost_gone';
  const isExpired = timeStatus.isExpired;

  return (
    <article
      id={`dynamo-${dynamo.id}`}
      className={`group relative rounded-2xl p-4 sm:p-5 transition-all duration-300 ${
        isExpired
          ? 'border border-stone-800/60 bg-stone-900/40 opacity-40'
          : isAlmostGone
          ? 'border border-amber-500/40 bg-[#16120E] shadow-lg shadow-amber-950/20 ring-1 ring-amber-500/20'
          : 'border border-[#21272E] bg-[#12161A] hover:border-[#2C353F]'
      }`}
    >
      {/* Top Header: Author & Real-Time Remaining Badge */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <button
          type="button"
          onClick={() => dynamo.author && onAuthorClick?.(dynamo.author)}
          className="flex items-center gap-2.5 min-w-0 text-left group/author hover:opacity-90 transition cursor-pointer"
        >
          {dynamo.author?.avatar ? (
            <img
              src={dynamo.author.avatar}
              alt={dynamo.author.username}
              referrerPolicy="no-referrer"
              className="h-9 w-9 rounded-full object-cover border border-stone-800 shrink-0 group-hover/author:border-amber-500/50 transition"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1A2129] text-xs font-bold text-amber-400 border border-stone-800 shrink-0 group-hover/author:border-amber-500/50 transition">
              {dynamo.author?.username?.[0]?.toUpperCase() || 'D'}
            </div>
          )}
          <div className="min-w-0">
            <span className="block truncate text-xs sm:text-sm font-semibold text-stone-100 group-hover/author:text-amber-400 transition">
              @{dynamo.author?.username || 'anónimo'}
            </span>
            <span className="block text-[10px] text-stone-400">
              {new Date(dynamo.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </button>

        {/* Lifespan Status Pill */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-mono font-medium border transition-colors ${
              isExpired
                ? 'bg-stone-800/80 border-stone-700 text-stone-400'
                : isAlmostGone
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold animate-pulse'
                : 'bg-[#151D25] border-[#25303D] text-amber-400/90'
            }`}
            title={`Expira el: ${new Date(expiresAt).toLocaleString()}`}
          >
            {isAlmostGone ? (
              <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            ) : (
              <Clock className="w-3 h-3 text-amber-400 shrink-0" />
            )}
            <span>
              {isAlmostGone
                ? `Casi desaparece (${timeStatus.formattedTimeRemaining.replace('⏳ ', '')})`
                : timeStatus.formattedTimeRemaining}
            </span>
          </div>

          {/* Context Menu Trigger • */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800/60 transition"
              title="Opciones"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-7 z-20 w-44 rounded-xl border border-[#27313C] bg-[#12171D] p-1.5 shadow-xl text-xs text-stone-300">
                <button
                  id={`menu-btn-share-${dynamo.id}`}
                  onClick={handleShare}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-stone-800/70 text-stone-200 transition"
                >
                  <Share2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Compartir Dynamo</span>
                </button>

                <button
                  onClick={handleCopy}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-stone-800/70 text-stone-200 transition"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clock className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copiado' : 'Copiar texto'}</span>
                </button>

                {onReport && !isOwner && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onReport(dynamo.id, dynamo.user_id);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-stone-800/70 text-stone-300 transition"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-stone-400" />
                    <span>Reportar</span>
                  </button>
                )}

                {isOwner && onDelete && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDelete(dynamo.id);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-red-950/40 text-red-400 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    <span>Eliminar mi Dynamo</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lifespan Visual Meter */}
      {!isExpired && (
        <div className="w-full bg-[#181F26] h-1 rounded-full overflow-hidden mb-3.5">
          <div
            className={`h-full transition-all duration-700 ${
              isAlmostGone
                ? 'bg-gradient-to-r from-red-500 to-amber-500'
                : 'bg-gradient-to-r from-amber-500 to-emerald-400'
            }`}
            style={{ width: `${Math.max(timeStatus.percentageRemaining, 3)}%` }}
          />
        </div>
      )}

      {/* Content - Text First, Clean Microcontent */}
      <p className="text-[14px] sm:text-[15px] leading-relaxed text-stone-100 font-normal break-words whitespace-pre-wrap mb-3.5">
        {dynamo.content}
      </p>

      {/* Optional Attached Media (Images) */}
      {dynamo.image_url && (
        <>
          <div
            onClick={() => setIsImageModalOpen(true)}
            className="group relative mb-3.5 rounded-xl overflow-hidden border border-[#222B35] bg-[#0D1115] max-h-96 flex items-center justify-center cursor-zoom-in select-none"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsImageModalOpen(true);
              }
            }}
            title="Haz clic para ver la imagen completa"
          >
            <img
              src={dynamo.image_url}
              alt="Multimedia adjunta al Dynamo"
              loading="lazy"
              decoding="async"
              className="w-full h-auto max-h-96 object-cover object-center transition-all duration-300 group-hover:scale-[1.015] group-hover:brightness-105"
              onError={(e) => {
                // Gracefully hide element if image fails to load
                (e.currentTarget.parentElement as HTMLElement)?.classList.add('hidden');
              }}
            />
            {/* Visual affordance badge on hover */}
            <div className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-md bg-black/75 backdrop-blur-md border border-white/10 text-[11px] text-stone-200 flex items-center gap-1.5 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-md">
              <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Ver completa</span>
            </div>
          </div>

          <ImageLightboxModal
            isOpen={isImageModalOpen}
            imageUrl={dynamo.image_url}
            altText={`Imagen de ${dynamo.author_username || 'Dynamo'}`}
            onClose={() => setIsImageModalOpen(false)}
          />
        </>
      )}

      {/* Hashtags Strip */}
      {dynamo.hashtags && dynamo.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3.5">
          {dynamo.hashtags.map((tag) => (
            <button
              key={tag}
              onClick={() => onSelectHashtag?.(tag)}
              className="text-[11px] px-2 py-0.5 rounded-md bg-[#161D24] text-amber-400/90 hover:bg-amber-500/20 hover:text-amber-300 border border-[#232D38] transition font-mono"
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Feedback Banner on ⚡ Gift or Error */}
      {giftFeedback && (
        <div
          className={`mb-3 px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-all ${
            giftFeedback.type === 'success'
              ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
              : giftFeedback.type === 'info'
              ? 'bg-sky-500/20 border border-sky-500/40 text-sky-300'
              : 'bg-red-500/20 border border-red-500/40 text-red-300'
          }`}
        >
          <span>{giftFeedback.message}</span>
        </div>
      )}

      {/* Bottom Actions: ⚡ Dar Dynamo + Responder (NO LIKES) */}
      <div className="flex items-center justify-between pt-2.5 border-t border-[#1C2229] text-stone-400 text-xs">
        <div className="flex items-center gap-2.5">
          {/* ⚡ Dar Dynamo Button */}
          <button
            id={`btn-energy-${dynamo.id}`}
            onClick={handleGiveEnergy}
            disabled={isGifting || isExpired}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium transition active:scale-95 ${
              isExpired
                ? 'opacity-40 cursor-not-allowed bg-stone-800 text-stone-400'
                : isOwner
                ? 'bg-stone-800/60 text-stone-400 hover:text-stone-300 border border-stone-800 cursor-default'
                : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/25 border border-amber-500/30'
            }`}
            title={
              isOwner
                ? 'Tu publicación no puede recibir auto-energía'
                : 'Inyectar +6h de vida a este Dynamo (⚡)'
            }
          >
            <Zap className={`w-3.5 h-3.5 fill-amber-400 ${isGifting ? 'animate-bounce' : ''}`} />
            <span className="font-bold font-mono">{energyCount}</span>
            <span className="hidden sm:inline">⚡</span>
          </button>

          {/* Responder / Ver Conversación Button */}
          <button
            id={`btn-reply-${dynamo.id}`}
            onClick={() => onOpenReply(dynamo)}
            disabled={isExpired || isHidden}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition ${
              isExpired || isHidden
                ? 'opacity-40 cursor-not-allowed text-stone-400 border-stone-800'
                : 'border-stone-800 hover:border-stone-700 hover:bg-stone-800/60 text-stone-300 hover:text-white'
            }`}
            title={
              isHidden
                ? 'Oculto por moderación'
                : isExpired
                ? 'Dynamo expirado'
                : isOwner
                ? 'Ver conversación y participar'
                : 'Ver conversación y responder'
            }
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Responder</span>
            {(dynamo.replies_count || 0) > 0 && (
              <span className="ml-1 text-[11px] font-mono text-stone-400">
                ({dynamo.replies_count})
              </span>
            )}
          </button>

          {/* Compartir Button */}
          <button
            id={`btn-share-${dynamo.id}`}
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-stone-800 hover:border-stone-700 hover:bg-stone-800/60 text-stone-300 hover:text-white transition cursor-pointer"
            title="Compartir Dynamo (/d/...)"
          >
            <Share2 className="w-3.5 h-3.5 text-stone-400" />
            <span className="hidden sm:inline">{copiedLink ? 'Copiado' : 'Compartir'}</span>
          </button>
        </div>

        {/* Subtle Ephemeral Badge */}
        <span className="text-[11px] text-stone-400 hidden sm:inline">
          {isExpired ? 'Sellado' : '+6h por ⚡'}
        </span>
      </div>
    </article>
  );
};
