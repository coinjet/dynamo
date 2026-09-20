import React, { useState, useEffect } from 'react';
import { UserBadge } from '@/src/modules/bestDynamos/bestDynamosTypes';
import { bestDynamosService } from '@/src/modules/bestDynamos/bestDynamosService';
import { BadgesModal } from './BadgesModal';
import { Award, Zap, Trophy, Medal, Crown } from 'lucide-react';

interface ProfileBadgesSectionProps {
  userId: string;
  username: string;
}

export const ProfileBadgesSection: React.FC<ProfileBadgesSectionProps> = ({
  userId,
  username,
}) => {
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    if (!userId) return;

    setIsLoading(true);
    bestDynamosService
      .getUserBadges(userId)
      .then((data) => {
        if (isMounted) setBadges(data);
      })
      .catch((err) => console.error('Error fetching badges for user:', err))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const renderBadgeMiniIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Zap':
        return <Zap className="w-3 h-3 text-amber-400" />;
      case 'Trophy':
        return <Trophy className="w-3 h-3 text-amber-400" />;
      case 'Medal':
        return <Medal className="w-3 h-3 text-amber-400" />;
      case 'Crown':
        return <Crown className="w-3 h-3 text-amber-400" />;
      case 'Award':
      default:
        return <Award className="w-3 h-3 text-amber-400" />;
    }
  };

  return (
    <div className="rounded-xl bg-[#0D1013] border border-[#1C2229] p-3.5 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Award className="w-3.5 h-3.5 text-amber-400" />
          <h4 className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
            Insignias Obtenidas ({badges.length})
          </h4>
        </div>

        <button
          id={`btn-open-badges-modal-${userId}`}
          onClick={() => setIsModalOpen(true)}
          className="text-[11px] text-amber-400 hover:underline font-semibold cursor-pointer"
        >
          Ver galería
        </button>
      </div>

      {isLoading ? (
        <div className="text-[11px] text-stone-400 py-1 font-mono animate-pulse">
          Cargando insignias...
        </div>
      ) : badges.length === 0 ? (
        <p className="text-xs text-stone-400 italic">
          Sin insignias aún. Se otorgan automáticamente por ⚡ recibidos y presencia en el ranking.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {badges.map((b) => (
            <button
              key={b.id}
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#161B21] border border-[#232B35] hover:border-amber-500/40 text-xs text-stone-200 transition"
              title={b.badge?.description || b.badge_key}
            >
              {renderBadgeMiniIcon(b.badge?.iconName)}
              <span className="font-semibold text-[11px]">{b.badge?.title || b.badge_key}</span>
            </button>
          ))}
        </div>
      )}

      {/* Badges Modal */}
      <BadgesModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        username={username}
        userBadges={badges}
      />
    </div>
  );
};
