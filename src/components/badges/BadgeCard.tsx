import React from 'react';
import { UserBadge, BadgeDefinition } from '@/src/modules/bestDynamos/bestDynamosTypes';
import { Zap, Trophy, Medal, Award, Crown, Lock } from 'lucide-react';

interface BadgeCardProps {
  badgeDef: BadgeDefinition;
  earnedBadge?: UserBadge;
  onClick?: () => void;
}

export const BadgeCard: React.FC<BadgeCardProps> = ({
  badgeDef,
  earnedBadge,
  onClick,
}) => {
  const isUnlocked = Boolean(earnedBadge);

  const renderIcon = () => {
    const className = `w-5 h-5 ${
      isUnlocked ? 'text-amber-400' : 'text-stone-600'
    }`;
    switch (badgeDef.iconName) {
      case 'Zap':
        return <Zap className={className} />;
      case 'Trophy':
        return <Trophy className={className} />;
      case 'Medal':
        return <Medal className={className} />;
      case 'Crown':
        return <Crown className={className} />;
      case 'Award':
      default:
        return <Award className={className} />;
    }
  };

  const getTierColors = () => {
    if (!isUnlocked) {
      return 'border-[#1C2229] bg-[#0E1216] opacity-60';
    }
    switch (badgeDef.tier) {
      case 'diamond':
        return 'border-cyan-500/40 bg-gradient-to-br from-cyan-950/30 to-[#12161A] text-cyan-200 shadow-cyan-950/20';
      case 'gold':
        return 'border-amber-500/40 bg-gradient-to-br from-amber-950/30 to-[#12161A] text-amber-200 shadow-amber-950/20';
      case 'silver':
        return 'border-slate-400/30 bg-gradient-to-br from-slate-900/30 to-[#12161A] text-slate-200 shadow-slate-950/20';
      case 'bronze':
      default:
        return 'border-amber-700/30 bg-gradient-to-br from-amber-950/20 to-[#12161A] text-amber-300 shadow-amber-950/10';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`relative rounded-xl border p-3.5 transition-all flex flex-col justify-between ${getTierColors()} ${
        onClick ? 'cursor-pointer hover:scale-[1.02]' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
            isUnlocked
              ? 'border-amber-500/30 bg-amber-500/10'
              : 'border-stone-800 bg-stone-900/40'
          }`}
        >
          {renderIcon()}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4
              className={`text-xs font-bold leading-snug truncate ${
                isUnlocked ? 'text-white' : 'text-stone-400'
              }`}
            >
              {badgeDef.title}
            </h4>
            {isUnlocked ? (
              <span className="text-[10px] uppercase font-mono font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {badgeDef.tier}
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-stone-400 font-mono">
                <Lock className="w-2.5 h-2.5" /> Bloqueada
              </span>
            )}
          </div>

          <p className="text-[11px] text-stone-400 mt-1 leading-relaxed">
            {badgeDef.description}
          </p>
        </div>
      </div>

      {isUnlocked && earnedBadge && (
        <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-stone-400">
          <span>Desbloqueada</span>
          <span className="font-mono text-stone-400">
            {new Date(earnedBadge.awarded_at).toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        </div>
      )}
    </div>
  );
};
