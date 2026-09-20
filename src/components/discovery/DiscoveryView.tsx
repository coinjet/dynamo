import React, { useState, useEffect } from 'react';
import { Flame, Clock, Zap, Sparkles, RefreshCw, CheckCircle2, Users, UserCheck, Tag, ArrowLeft } from 'lucide-react';
import { Dynamo } from '@/src/modules/dynamos/dynamosTypes';
import { TrendingTopic, DiscoverySection } from '@/src/modules/discovery/discoveryTypes';
import { discoveryService } from '@/src/modules/discovery/discoveryService';
import { FeedFilterType } from '@/src/modules/relationships/relationshipsTypes';
import { DynamoCard } from '../dynamos/DynamoCard';
import { Profile } from '@/src/modules/profiles/profilesTypes';
import { GiftEnergyResult } from '@/src/modules/dynamos/dynamosService';

interface DiscoveryViewProps {
  currentUserId?: string;
  onGiftEnergy: (dynamoId: string) => Promise<GiftEnergyResult>;
  onOpenReply: (dynamo: Dynamo) => void;
  onReport: (dynamoId: string, authorId?: string) => void;
  onDelete: (dynamoId: string) => Promise<void>;
  onAuthorClick: (author: Profile) => void;
  onRequireAuth: () => void;
  initialSection?: DiscoverySection;
  initialHashtag?: string | null;
}

const PAGE_SIZE = 10;

export const DiscoveryView: React.FC<DiscoveryViewProps> = ({
  currentUserId,
  onGiftEnergy,
  onOpenReply,
  onReport,
  onDelete,
  onAuthorClick,
  onRequireAuth,
  initialSection = 'tendencias',
  initialHashtag = null,
}) => {
  const [section, setSection] = useState<DiscoverySection>(initialSection);
  const [filter, setFilter] = useState<FeedFilterType>('todos');
  
  // Trending hashtags state
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([]);
  const [selectedHashtag, setSelectedHashtag] = useState<string | null>(initialHashtag);
  
  // Dynamos feed state
  const [dynamos, setDynamos] = useState<Dynamo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  // Sync initial hashtag if provided from outside
  useEffect(() => {
    if (initialHashtag) {
      setSelectedHashtag(initialHashtag);
      setSection('tendencias');
    }
  }, [initialHashtag]);

  // Load trending topics
  const loadTrending = async () => {
    try {
      const trends = await discoveryService.getTrendingHashtags(10);
      setTrendingTopics(trends);
    } catch (err) {
      console.error('Error al cargar tendencias:', err);
    }
  };

  // Load dynamos based on current section, selected hashtag, and relationship filter
  const loadDynamos = async (offset = 0, append = false) => {
    if (offset === 0) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      let results: Dynamo[] = [];

      if (section === 'tendencias') {
        if (selectedHashtag) {
          results = await discoveryService.getDynamosByHashtag({
            hashtag: selectedHashtag,
            currentUserId,
            limit: PAGE_SIZE,
            offset,
            filter,
          });
        } else {
          // If no hashtag is selected, load the topics list
          await loadTrending();
          setIsLoading(false);
          setIsLoadingMore(false);
          return;
        }
      } else if (section === 'casi_desaparecen') {
        results = await discoveryService.getCasiDesaparecen({
          currentUserId,
          limit: PAGE_SIZE,
          offset,
          filter,
        });
      } else if (section === 'reviviendo') {
        results = await discoveryService.getReviviendo({
          currentUserId,
          limit: PAGE_SIZE,
          offset,
          filter,
        });
      }

      if (append) {
        setDynamos((prev) => [...prev, ...results]);
      } else {
        setDynamos(results);
      }

      // Feed is strictly finite
      setHasMore(results.length === PAGE_SIZE);
    } catch (err) {
      console.error('Error al cargar descubrimientos:', err);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  // Trigger reload on section, hashtag, or filter change
  useEffect(() => {
    loadDynamos(0, false);
    if (section === 'tendencias' && !selectedHashtag) {
      loadTrending();
    }
  }, [section, selectedHashtag, filter, currentUserId]);

  const handleDynamoExpired = (dynamoId: string) => {
    setDynamos((prev) => prev.filter((d) => d.id !== dynamoId));
  };

  const handleSelectHashtag = (tag: string) => {
    setSelectedHashtag(discoveryService.normalizeTag(tag));
    setSection('tendencias');
  };

  const handleClearHashtag = () => {
    setSelectedHashtag(null);
    loadTrending();
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Discovery Navigation Tabs */}
      <div className="flex items-center justify-between gap-2 border-b border-[#1F262E] pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
          {/* 1. Tendencias */}
          <button
            id="tab-discovery-tendencias"
            onClick={() => {
              setSection('tendencias');
              if (!selectedHashtag) loadTrending();
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              section === 'tendencias'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'bg-[#12161A] text-stone-400 hover:text-white border border-[#21272E]'
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>Tendencias</span>
          </button>

          {/* 2. Casi desaparecen */}
          <button
            id="tab-discovery-casi-desaparecen"
            onClick={() => {
              setSelectedHashtag(null);
              setSection('casi_desaparecen');
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              section === 'casi_desaparecen'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'bg-[#12161A] text-stone-400 hover:text-white border border-[#21272E]'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Casi desaparecen</span>
          </button>

          {/* 3. Reviviendo */}
          <button
            id="tab-discovery-reviviendo"
            onClick={() => {
              setSelectedHashtag(null);
              setSection('reviviendo');
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              section === 'reviviendo'
                ? 'bg-amber-500 text-black shadow-sm'
                : 'bg-[#12161A] text-stone-400 hover:text-white border border-[#21272E]'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Reviviendo</span>
          </button>
        </div>

        <button
          onClick={() => {
            if (section === 'tendencias' && !selectedHashtag) {
              loadTrending();
            } else {
              loadDynamos(0, false);
            }
          }}
          disabled={isLoading}
          className="p-2 rounded-xl text-stone-400 hover:text-white bg-[#12161A] border border-[#21272E] hover:border-stone-700 transition shrink-0"
          title="Actualizar sección"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Relationship Filters (Todos | Siguiendo | Amigos) for active feed sections */}
      {(section !== 'tendencias' || selectedHashtag) && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-1.5 p-1 bg-[#12161A] rounded-xl border border-[#21272E] w-fit">
            <button
              id="filter-discovery-todos"
              onClick={() => setFilter('todos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                filter === 'todos'
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Todos</span>
            </button>

            <button
              id="filter-discovery-siguiendo"
              onClick={() => {
                if (!currentUserId) {
                  onRequireAuth();
                  return;
                }
                setFilter('siguiendo');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                filter === 'siguiendo'
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Siguiendo</span>
            </button>

            <button
              id="filter-discovery-amigos"
              onClick={() => {
                if (!currentUserId) {
                  onRequireAuth();
                  return;
                }
                setFilter('amigos');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                filter === 'amigos'
                  ? 'bg-emerald-500 text-black shadow-sm font-extrabold'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Amigos</span>
            </button>
          </div>

          {/* If viewing a selected hashtag, show back chip */}
          {selectedHashtag && (
            <button
              onClick={handleClearHashtag}
              className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-medium px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a tendencias</span>
            </button>
          )}
        </div>
      )}

      {/* Section 1: TENDENCIAS 🔥 (Tags List) */}
      {section === 'tendencias' && !selectedHashtag && (
        <div className="space-y-4">
          <div className="rounded-xl bg-[#12161A] border border-[#21272E] p-4 text-xs text-stone-300 flex items-start gap-3">
            <Flame className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white mb-0.5">Hashtags con mayor actividad reciente</p>
              <p className="text-stone-400 text-[11px] leading-relaxed">
                Calculado exclusivamente a partir de Dynamos activos y no expirados. Sin algoritmos opacos, sin likes ni métricas de vanidad.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-stone-400 text-xs flex flex-col items-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
              <p>Analizando actividad en tiempo real...</p>
            </div>
          ) : trendingTopics.length === 0 ? (
            <div className="rounded-2xl border border-[#21272E] bg-[#12161A] p-8 text-center text-stone-400 space-y-2">
              <Tag className="w-7 h-7 mx-auto text-amber-400/50" />
              <p className="text-stone-200 font-semibold text-sm">No hay tendencias activas</p>
              <p className="text-xs text-stone-400 max-w-sm mx-auto">
                Las tendencias nacen de publicaciones vivas con hashtags. Publica un Dynamo con etiqueta para iniciar una.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {trendingTopics.map((topic, index) => (
                <button
                  key={topic.name}
                  onClick={() => handleSelectHashtag(topic.name)}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-[#12161A] border border-[#21272E] hover:border-amber-500/50 hover:bg-[#161C22] transition text-left group"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-[#182028] text-amber-400/80 font-mono text-xs font-bold flex items-center justify-center border border-[#222A34]">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-white group-hover:text-amber-400 transition font-mono">
                        #{topic.name}
                      </p>
                      <p className="text-[11px] text-stone-400">
                        {topic.activeCount} {topic.activeCount === 1 ? 'publicación activa' : 'publicaciones activas'}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-stone-500 group-hover:text-stone-300 transition">
                    Explorar →
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Static confirmation that feed terminates */}
          {!isLoading && trendingTopics.length > 0 && (
            <div className="py-4 text-center text-xs text-stone-500 flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-400/70" />
              <span>⚡ Estás al día con las tendencias activas.</span>
            </div>
          )}
        </div>
      )}

      {/* Section 2: CASI DESAPARECEN ⏳ Banner info */}
      {section === 'casi_desaparecen' && (
        <div className="rounded-xl bg-[#12161A] border border-[#21272E] p-4 text-xs text-stone-300 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-white mb-0.5">Casi desaparecen (&lt; 2 horas restantes)</p>
            <p className="text-stone-400 text-[11px] leading-relaxed">
              Publicaciones vivas que están a punto de extinguirse. Ordénalas por urgencia y regálales energía ⚡ si merecen perdurar.
            </p>
          </div>
        </div>
      )}

      {/* Section 3: REVIVIENDO ⚡ Banner info */}
      {section === 'reviviendo' && (
        <div className="rounded-xl bg-[#12161A] border border-[#21272E] p-4 text-xs text-stone-300 flex items-start gap-3">
          <Zap className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-white mb-0.5">Reviviendo</p>
            <p className="text-stone-400 text-[11px] leading-relaxed">
              Publicaciones que recibieron energía ⚡ recientemente de la comunidad. No es un ranking permanente; rota con la actividad en tiempo real.
            </p>
          </div>
        </div>
      )}

      {/* Dynamos Feed Stream (for Casi desaparecen, Reviviendo, or selected Hashtag) */}
      {(section !== 'tendencias' || selectedHashtag) && (
        <div>
          {isLoading ? (
            <div className="space-y-4 py-12 text-center text-stone-400 text-xs flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
              <p>Cargando publicaciones...</p>
            </div>
          ) : dynamos.length === 0 ? (
            <div className="rounded-2xl border border-[#21272E] bg-[#12161A] p-8 text-center text-stone-400 space-y-2">
              <Sparkles className="w-7 h-7 mx-auto text-amber-400/50" />
              <p className="text-stone-200 font-semibold text-sm">⚡ Estás al día.</p>
              <p className="text-xs text-stone-400 max-w-sm mx-auto">
                {section === 'casi_desaparecen'
                  ? 'No hay publicaciones en riesgo inminente de extinción en este momento.'
                  : section === 'reviviendo'
                  ? 'No hay publicaciones con energía reciente en este filtro.'
                  : `No hay publicaciones activas con #${selectedHashtag}.`}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {dynamos.map((dynamo) => (
                <DynamoCard
                  key={dynamo.id}
                  dynamo={dynamo}
                  onGiftEnergy={onGiftEnergy}
                  onOpenReply={onOpenReply}
                  onReport={onReport}
                  onDelete={onDelete}
                  onSelectHashtag={handleSelectHashtag}
                  onExpired={handleDynamoExpired}
                  onAuthorClick={onAuthorClick}
                />
              ))}

              {/* Pagination / End of Feed (Strictly finite, no infinite scroll) */}
              {hasMore ? (
                <div className="pt-2 text-center">
                  <button
                    onClick={() => loadDynamos(dynamos.length, true)}
                    disabled={isLoadingMore}
                    className="px-5 py-2.5 rounded-xl border border-stone-800 bg-[#12161A] text-xs font-medium text-stone-300 hover:text-white hover:border-stone-700 transition disabled:opacity-50"
                  >
                    {isLoadingMore ? 'Cargando siguientes...' : 'Cargar más publicaciones'}
                  </button>
                </div>
              ) : (
                <div className="py-6 text-center text-stone-400 flex flex-col items-center gap-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-300">
                    <CheckCircle2 className="w-4 h-4 text-amber-400" />
                    <span>⚡ Estás al día.</span>
                  </div>
                  <p className="text-[11px] text-stone-500">
                    Has llegado al final de esta sección.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
