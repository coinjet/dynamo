import React, { useState, useEffect } from 'react';
import { UserEconomyStatus } from '@/src/modules/economy/economyTypes';
import { economyService } from '@/src/modules/economy/economyService';
import { Zap } from 'lucide-react';

interface EconomyBadgeProps {
  userId?: string;
  onClick: () => void;
  refreshTrigger?: number;
}

export const EconomyBadge: React.FC<EconomyBadgeProps> = ({
  userId,
  onClick,
  refreshTrigger = 0,
}) => {
  const [status, setStatus] = useState<UserEconomyStatus | null>(null);

  const fetchBalance = async () => {
    if (!userId) return;
    try {
      const data = await economyService.getUserEconomy(userId);
      setStatus(data);
    } catch {
      // Graceful fallback
    }
  };

  useEffect(() => {
    fetchBalance();
  }, [userId, refreshTrigger]);

  if (!userId) return null;

  return (
    <button
      id="btn-header-economy-badge"
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-mono font-bold transition group cursor-pointer"
      title={`Saldo ⚡ disponible: ${status?.free_available ?? 10} gratis · ${status?.purchased_balance ?? 0} adquiridos`}
    >
      <Zap className="w-3.5 h-3.5 fill-amber-400 group-hover:scale-110 transition-transform" />
      <span>{status ? status.total_available : 10}</span>
    </button>
  );
};
