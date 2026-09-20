import React from 'react';
import { UserBadge } from '@/src/modules/bestDynamos/bestDynamosTypes';
import { BADGE_DEFINITIONS } from '@/src/modules/bestDynamos/bestDynamosService';
import { BadgeCard } from './BadgeCard';
import { X, Award, ShieldCheck } from 'lucide-react';

interface BadgesModalProps {
  isOpen: boolean;
  onClose: () => void;
  username?: string;
  userBadges: UserBadge[];
}

export const BadgesModal: React.FC<BadgesModalProps> = ({
  isOpen,
  onClose,
  username,
  userBadges,
}) => {
  if (!isOpen) return null;

  const earnedKeys = new Map<string, UserBadge>(
    userBadges.map((b) => [b.badge_key, b])
  );

  const allDefinitions = Object.values(BADGE_DEFINITIONS);
  const unlockedCount = userBadges.length;
  const totalCount = allDefinitions.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        id="modal-badges-view"
        className="w-full max-w-xl max-h-[85vh] flex flex-col rounded-2xl border border-[#232B35] bg-[#12161A] shadow-2xl overflow-hidden relative"
      >
        {/* Header */}
        <div className="p-5 border-b border-[#1C2229] flex items-center justify-between bg-[#0E1216]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Insignias y Logros
                {username && <span className="text-stone-400 font-normal">(@{username})</span>}
              </h2>
              <p className="text-xs text-stone-400">
                {unlockedCount} de {totalCount} insignias obtenidas legítimamente
              </p>
            </div>
          </div>

          <button
            id="btn-close-badges-modal"
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informative Anti-Cheat Banner */}
        <div className="px-5 py-2.5 bg-amber-950/15 border-b border-amber-900/20 flex items-center gap-2 text-[11px] text-amber-300">
          <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Otorgadas automáticamente por el servidor según participación real y ⚡ válidos.
          </span>
        </div>

        {/* Badges Grid */}
        <div className="p-5 overflow-y-auto space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {allDefinitions.map((def) => {
              const earned = earnedKeys.get(def.key);
              return (
                <BadgeCard
                  key={def.key}
                  badgeDef={def}
                  earnedBadge={earned}
                />
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#1C2229] bg-[#0E1216] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs font-semibold text-white transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
