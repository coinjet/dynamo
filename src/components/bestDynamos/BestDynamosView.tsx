import React, { useState, useEffect } from 'react';
import {
  BestDynamoItem,
  BestDynamosResponse,
  RankingPeriod,
  UserBadge,
} from '@/src/modules/bestDynamos/bestDynamosTypes';
import { bestDynamosService } from '@/src/modules/bestDynamos/bestDynamosService';
import { Profile } from '@/src/modules/profiles/profilesTypes';
import { BadgesModal } from '../badges/BadgesModal';
import {
  Trophy,
  Crown,
  Medal,
  Award,
  Zap,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Clock,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

interface BestDynamosViewProps {
  onAuthorClick?: (author: Profile) => void;
  onRequireAuth?: () => void;
  currentUserId?: string;
}

export const BestDynamosView: React.FC<BestDynamosViewProps> = ({
  onAuthorClick,
  onRequireAuth,
  currentUserId,
}) => {
  const [period, setPeriod] = useState<RankingPeriod>('all_time');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  const [rankingData, setRankingData] = useState<BestDynamosResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Badges Modal
  const [isBadgesModalOpen, setIsBadgesModalOpen] = useState<boolean>(false);
  const [myBadges, setMyBadges] = useState<UserBadge[]>([]);

  const loadRanking = async (pageToLoad: number, activePeriod: RankingPeriod = period) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await bestDynamosService.getBestDynamos(
        activePeriod,
        pageToLoad,
        pageSize
      );
      setRankingData(response);
    } catch (err: any) {
      console.error('Error loading best dynamos:', err);
      setError(err.message || 'Error al cargar el ranking histórico');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRanking(currentPage, period);
  }, [currentPage, period]);

  // Load user badges if authenticated
  useEffect(() => {
    if (currentUserId) {
      bestDynamosService.getUserBadges(currentUserId).then(setMyBadges).catch(console.error);
    }
  }, [currentUserId]);

  const handleOpenMyBadges = async () => {
    if (!currentUserId) {
      onRequireAuth?.();
      return;
    }
    const badges = await bestDynamosService.getUserBadges(currentUserId);
    setMyBadges(badges);
    setIsBadgesModalOpen(true);
  };

  const renderRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-600 text-black font-black text-sm shadow-lg shadow-amber-500/30 border border-amber-300"
          title="Posición #1 Histórico"
        >
          <Crown className="w-5 h-5 fill-black stroke-black" />
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-200 to-slate-400 text-black font-black text-sm shadow-md shadow-slate-400/20 border border-slate-200"
          title="Posición #2 Histórico"
        >
          <Medal className="w-5 h-5 fill-black stroke-black" />
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-600 to-amber-800 text-white font-black text-sm shadow-md shadow-amber-700/20 border border-amber-500/40"
          title="Posición #3 Histórico"
        >
          <Award className="w-5 h-5" />
        </div>
      );
    }
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#182028] border border-[#2B3542] text-stone-300 font-mono font-bold text-xs">
        #{rank}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-[#21272E] bg-[#12161A] p-5 sm:p-7 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-black shadow-lg shadow-amber-500/20">
              <Trophy className="w-6 h-6 fill-black stroke-black" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Best Dynamos
                </h1>
                <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  Salón Histórico
                </span>
              </div>
              <p className="text-xs sm:text-sm text-stone-400 mt-1 max-w-xl leading-relaxed">
                Ranking histórico basado estrictamente en ⚡ Dynamos recibidos legítimamente. Las publicaciones destacadas conservan su registro permanente aunque hayan expirado.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              id="btn-view-all-badges"
              onClick={handleOpenMyBadges}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-xs font-bold transition cursor-pointer"
            >
              <Award className="w-4 h-4 text-amber-400" />
              <span>Ver Insignias 🏅</span>
            </button>

            <button
              id="btn-refresh-best-dynamos"
              onClick={() => loadRanking(currentPage, period)}
              disabled={isLoading}
              className="p-2 rounded-xl border border-stone-800 bg-[#161B21] text-stone-400 hover:text-white transition"
              title="Actualizar ranking"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Anti-vanity metrics indicator */}
        <div className="mt-4 pt-3 border-t border-[#1C2229] flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-400">
          <div className="flex items-center gap-1.5 text-stone-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sin algoritmos opacos, seguidores ni likes: solo ⚡ legítimos verificados en servidor.</span>
          </div>
        </div>
      </div>

      {/* Period Selector (Prepared for weekly, monthly, yearly growth) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#1C2229]">
        <div className="flex items-center gap-1.5 p-1 bg-[#12161A] rounded-xl border border-[#21272E] w-fit overflow-x-auto max-w-full">
          <button
            id="period-tab-all-time"
            onClick={() => {
              setPeriod('all_time');
              setCurrentPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
              period === 'all_time'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Histórico Acumulado</span>
          </button>

          {/* Architecture ready for future periods */}
          <button
            disabled
            title="Próximamente disponible en Dynamo V0.2"
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-stone-500 cursor-not-allowed flex items-center gap-1 opacity-60 whitespace-nowrap"
          >
            <span>Semanal</span>
            <span className="text-[9px] font-mono px-1 rounded bg-stone-800 text-stone-400">Pronto</span>
          </button>

          <button
            disabled
            title="Próximamente disponible en Dynamo V0.2"
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-stone-500 cursor-not-allowed flex items-center gap-1 opacity-60 whitespace-nowrap"
          >
            <span>Mensual</span>
            <span className="text-[9px] font-mono px-1 rounded bg-stone-800 text-stone-400">Pronto</span>
          </button>

          <button
            disabled
            title="Próximamente disponible en Dynamo V0.2"
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-stone-500 cursor-not-allowed flex items-center gap-1 opacity-60 whitespace-nowrap"
          >
            <span>Anual</span>
            <span className="text-[9px] font-mono px-1 rounded bg-stone-800 text-stone-400">Pronto</span>
          </button>
        </div>

        {rankingData && (
          <div className="text-xs text-stone-400">
            Total en el ranking: <span className="text-white font-mono font-bold">{rankingData.total}</span> publicaciones
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="py-16 text-center text-stone-400 space-y-3">
          <RefreshCw className="w-7 h-7 animate-spin mx-auto text-amber-400" />
          <p className="text-sm">Calculando ranking histórico...</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-800/40 bg-red-950/20 p-6 text-center text-red-300 space-y-2">
          <p className="font-bold">{error}</p>
          <button
            onClick={() => loadRanking(currentPage, period)}
            className="px-4 py-1.5 rounded-lg bg-stone-800 text-xs font-semibold text-white hover:bg-stone-700"
          >
            Reintentar
          </button>
        </div>
      ) : rankingData?.items.length === 0 ? (
        <div className="rounded-2xl border border-[#21272E] bg-[#12161A] p-12 text-center text-stone-400 space-y-3">
          <Trophy className="w-10 h-10 mx-auto text-amber-400/40" />
          <h3 className="text-white font-bold text-base">Salón en espera del primer pulso</h3>
          <p className="text-xs text-stone-400 max-w-sm mx-auto leading-relaxed">
            Ningún Dynamo ha acumulado ⚡ todavía. Entrega energía a las publicaciones del feed para que ingresen al ranking histórico.
          </p>
        </div>
      ) : (
        /* Ranking List */
        <div className="space-y-3.5">
          {rankingData?.items.map((item) => {
            const formattedDate = new Date(item.created_at).toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });

            return (
              <div
                key={item.id}
                id={`best-dynamo-item-${item.id}`}
                className={`rounded-2xl border p-4 sm:p-5 transition-all relative ${
                  item.rank === 1
                    ? 'border-amber-500/40 bg-gradient-to-br from-[#181A1C] to-[#12161A] shadow-lg shadow-amber-500/5'
                    : item.rank <= 3
                    ? 'border-[#2D3748] bg-[#12161A]'
                    : 'border-[#1C2229] bg-[#0E1216]'
                }`}
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  {/* Position Badge */}
                  {renderRankBadge(item.rank)}

                  {/* Body Content */}
                  <div className="min-w-0 flex-1 space-y-2.5">
                    {/* Author Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div
                        onClick={() =>
                          onAuthorClick?.({
                            id: item.author_id,
                            username: item.author_username,
                            avatar: item.author_avatar,
                            role: item.author_role || 'user',
                            created_at: item.created_at,
                          })
                        }
                        className="flex items-center gap-2 cursor-pointer group"
                      >
                        {item.author_avatar ? (
                          <img
                            src={item.author_avatar}
                            alt={item.author_username}
                            referrerPolicy="no-referrer"
                            className="h-6 w-6 rounded-full object-cover border border-amber-500/40"
                          />
                        ) : (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-800 text-[10px] font-bold text-amber-400">
                            {item.author_username?.[0]?.toUpperCase() || 'U'}
                          </div>
                        )}
                        <span className="text-xs font-bold text-stone-200 group-hover:text-amber-400 transition truncate">
                          @{item.author_username}
                        </span>

                        {item.author_role && item.author_role !== 'user' && (
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 font-bold border border-amber-500/30">
                            {item.author_role}
                          </span>
                        )}
                      </div>

                      {/* Historical Status Pill */}
                      <div className="flex items-center gap-2">
                        {item.historical_status === 'active' ? (
                          <span
                            id={`status-active-${item.id}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Activo</span>
                          </span>
                        ) : (
                          <span
                            id={`status-expired-${item.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-stone-800/60 text-stone-400 border border-stone-700 text-[10px] font-medium"
                          >
                            <Clock className="w-3 h-3 text-stone-400" />
                            <span>Expirado</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Content */}
                    <p className="text-xs sm:text-sm text-stone-200 leading-relaxed break-words whitespace-pre-line font-sans">
                      {item.content}
                    </p>

                    {/* Optional Attached Media */}
                    {item.image_url && (
                      <div className="rounded-xl overflow-hidden border border-[#222B35] bg-[#0D1115] max-h-72 flex items-center justify-center">
                        <img
                          src={item.image_url}
                          alt="Multimedia del Dynamo destacado"
                          loading="lazy"
                          className="w-full h-auto max-h-72 object-cover object-center"
                          onError={(e) => {
                            (e.currentTarget.parentElement as HTMLElement)?.classList.add('hidden');
                          }}
                        />
                      </div>
                    )}

                    {/* Stats & Timestamp Row */}
                    <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
                      {/* Energy Received */}
                      <div className="flex items-center gap-1.5 text-amber-400 font-mono font-bold bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                        <Zap className="w-3.5 h-3.5 fill-amber-400 stroke-amber-400" />
                        <span>{item.energy_gifts_count} ⚡ recibidos</span>
                      </div>

                      {/* Creation Date */}
                      <div className="flex items-center gap-1 text-[11px] text-stone-400">
                        <Calendar className="w-3.5 h-3.5 text-stone-400" />
                        <span>Publicado el {formattedDate}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Bar (NO INFINITE SCROLL) */}
      {rankingData && rankingData.totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 pt-4 pb-2 border-t border-[#1C2229]">
          <button
            id="btn-best-dynamos-prev-page"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1 || isLoading}
            className="flex items-center gap-1 px-3.5 py-2 rounded-xl border border-stone-800 bg-[#12161A] text-xs font-semibold text-stone-300 hover:text-white hover:bg-stone-850 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Anterior</span>
          </button>

          <span className="text-xs text-stone-400 font-mono">
            Página <strong className="text-white">{currentPage}</strong> de{' '}
            <strong className="text-white">{rankingData.totalPages}</strong>
          </span>

          <button
            id="btn-best-dynamos-next-page"
            onClick={() => setCurrentPage((p) => Math.min(rankingData.totalPages, p + 1))}
            disabled={currentPage >= rankingData.totalPages || isLoading}
            className="flex items-center gap-1 px-3.5 py-2 rounded-xl border border-stone-800 bg-[#12161A] text-xs font-semibold text-stone-300 hover:text-white hover:bg-stone-850 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <span>Siguiente</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* End of ranking indicator: “⚡ Estás al día.” */}
      {rankingData && rankingData.items.length > 0 && (
        <div className="py-6 text-center space-y-1">
          <p className="text-xs sm:text-sm font-bold text-stone-300 flex items-center justify-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span>⚡ Estás al día.</span>
          </p>
          <p className="text-[11px] text-stone-400">
            Has explorado el ranking histórico de los Dynamos más memorables.
          </p>
        </div>
      )}

      {/* Badges Modal */}
      <BadgesModal
        isOpen={isBadgesModalOpen}
        onClose={() => setIsBadgesModalOpen(false)}
        userBadges={myBadges}
      />
    </div>
  );
};
