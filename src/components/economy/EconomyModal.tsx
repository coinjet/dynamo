import React, { useState, useEffect } from 'react';
import {
  EconomyTransaction,
  UserEconomyStatus,
  PaginatedTransactionsResult,
} from '@/src/modules/economy/economyTypes';
import { economyService } from '@/src/modules/economy/economyService';
import {
  Zap,
  Clock,
  History,
  Info,
  X,
  ChevronLeft,
  ChevronRight,
  Shield,
  Gift,
  PlusCircle,
  MinusCircle,
  Sparkles,
} from 'lucide-react';

interface EconomyModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
}

export const EconomyModal: React.FC<EconomyModalProps> = ({
  isOpen,
  onClose,
  userId,
}) => {
  const [activeTab, setActiveTab] = useState<'balance' | 'history'>('balance');
  const [status, setStatus] = useState<UserEconomyStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  // History state
  const [historyData, setHistoryData] = useState<PaginatedTransactionsResult>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 8,
    totalPages: 1,
  });
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);

  const loadStatus = async () => {
    if (!userId) return;
    setIsLoadingStatus(true);
    try {
      const data = await economyService.getUserEconomy(userId);
      setStatus(data);
    } catch (err) {
      console.warn('Error loading economy status:', err);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const loadHistory = async (page = 1) => {
    if (!userId) return;
    setIsLoadingHistory(true);
    try {
      const res = await economyService.getTransactionHistory(userId, page, 8);
      setHistoryData(res);
      setHistoryPage(res.page);
    } catch (err) {
      console.warn('Error loading transaction history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (isOpen && userId) {
      loadStatus();
      loadHistory(1);
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div
        id="economy-modal"
        className="w-full max-w-lg bg-[#12161A] border border-stone-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-800/80 flex items-center justify-between bg-[#161B21]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Zap className="w-4 h-4 fill-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                Economía Interna Dynamo
              </h2>
              <p className="text-[11px] text-stone-400">
                Saldo ⚡, cuota diaria gratuita e historial de movimientos
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center border-b border-stone-800 bg-[#0E1216] px-5 text-xs font-semibold">
          <button
            id="btn-economy-tab-balance"
            onClick={() => setActiveTab('balance')}
            className={`py-3 px-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'balance'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Mi Saldo</span>
          </button>
          <button
            id="btn-economy-tab-history"
            onClick={() => {
              setActiveTab('history');
              loadHistory(historyPage);
            }}
            className={`py-3 px-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Historial de Movimientos</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'balance' ? (
            <div className="space-y-4">
              {/* Total Balance Card */}
              <div className="bg-[#161B21] border border-stone-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-stone-400">
                    Total Disponible Para Regalar
                  </span>
                  <div className="text-3xl font-black font-mono text-white flex items-center gap-1.5 mt-0.5">
                    <span>{status ? status.total_available : '...'}</span>
                    <span className="text-amber-400 text-2xl">⚡</span>
                  </div>
                </div>

                <div className="text-right text-xs space-y-1">
                  <div className="text-stone-300 font-mono">
                    <span className="text-amber-400 font-bold">{status?.free_available ?? 0}</span> gratis
                  </div>
                  <div className="text-stone-400 font-mono">
                    <span className="text-sky-400 font-bold">{status?.purchased_balance ?? 0}</span> adquiridos
                  </div>
                </div>
              </div>

              {/* Free Dynamos Section */}
              <div className="bg-[#161B21] border border-amber-500/20 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Gift className="w-3.5 h-3.5" />
                    Dynamos Gratuitos (Ventana Móvil 24h)
                  </span>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {status?.free_available ?? 0} / {status?.free_limit ?? 10} disponibles
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-stone-900 rounded-full h-2 overflow-hidden border border-stone-800">
                  <div
                    className="bg-amber-500 h-full transition-all duration-300 rounded-full"
                    style={{
                      width: `${Math.min(100, ((status?.free_available ?? 0) / (status?.free_limit ?? 10)) * 100)}%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-stone-400 pt-1">
                  <div className="flex items-center gap-1.5 text-amber-400/90">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>Ventana móvil de 24 horas</span>
                  </div>
                  <span>{status?.free_used_today ?? 0} usados en las últimas 24h</span>
                </div>

                <p className="text-[11px] text-stone-400 leading-relaxed">
                  Dispones de una cuota de <strong>10 Dynamos gratuitos</strong> en una ventana móvil continua de 24 horas. Cada regalo inyecta 1 ⚡ y extiende +6 horas la vida de una publicación (hasta un máximo de 168 horas). Cada ⚡ gratuito utilizado se regenera automáticamente 24 horas después de haberlo enviado.
                </p>

                <div className="text-[10px] text-stone-500 bg-[#0E1216] p-2 rounded-lg border border-stone-800">
                  ⚠️ <em>Los Dynamos gratuitos son una cuota de uso sin valor monetario ni acumulación ilimitada.</em>
                </div>
              </div>

              {/* Purchased Dynamos Section */}
              <div className="bg-[#161B21] border border-sky-500/20 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Dynamos Adquiridos
                  </span>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    {status?.purchased_balance ?? 0} ⚡
                  </span>
                </div>

                <p className="text-[11px] text-stone-400 leading-relaxed">
                  Saldo adquirido permanente. Se consume automáticamente únicamente cuando agotas tu
                  cuota gratuita de 10 Dynamos en tu ventana móvil de 24 horas.
                </p>

                {/* Future monetization placeholder without real gateway */}
                <div className="bg-[#0E1216] border border-stone-800 rounded-lg p-3 text-[11px] text-stone-400 space-y-1">
                  <div className="text-stone-300 font-semibold flex items-center gap-1">
                    <Info className="w-3 h-3 text-sky-400" />
                    Próximamente: Paquetes de Dynamos
                  </div>
                  <p className="text-[10px] text-stone-500">
                    La arquitectura interna de saldo está activa y protegida. En versiones futuras
                    se habilitarán paquetes promocionales para creadores y mecenas.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* History Tab */
            <div className="space-y-3">
              {isLoadingHistory ? (
                <div className="py-12 flex justify-center items-center">
                  <div className="animate-spin rounded-full h-7 w-7 border-t-2 border-amber-500 border-r-transparent" />
                </div>
              ) : historyData.items.length === 0 ? (
                <div className="text-center py-10 space-y-2 text-stone-400">
                  <History className="w-7 h-7 text-stone-600 mx-auto" />
                  <p className="text-xs font-medium">No registras movimientos todavía.</p>
                  <p className="text-[11px] text-stone-500">
                    Al regalar energía ⚡ a un Dynamo, tus movimientos quedarán registrados aquí.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {historyData.items.map((tx) => {
                    const isDebit = tx.amount < 0;
                    return (
                      <div
                        key={tx.id}
                        className="bg-[#161B21] border border-stone-800/90 rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              isDebit
                                ? 'bg-amber-500/10 text-amber-400'
                                : 'bg-emerald-500/10 text-emerald-400'
                            }`}
                          >
                            {isDebit ? (
                              <MinusCircle className="w-3.5 h-3.5" />
                            ) : (
                              <PlusCircle className="w-3.5 h-3.5" />
                            )}
                          </div>

                          <div className="space-y-0.5">
                            <div className="font-semibold text-white">
                              {tx.transaction_type === 'gift_sent'
                                ? 'Regalo de Energía ⚡'
                                : tx.transaction_type === 'admin_adjustment'
                                ? 'Ajuste Administrativo'
                                : tx.transaction_type === 'purchase'
                                ? 'Adquisición'
                                : 'Concesión Diaria'}
                            </div>
                            <div className="text-[10px] text-stone-400">
                              {tx.description || 'Movimiento de economía'}
                            </div>
                            <div className="text-[9px] font-mono text-stone-500">
                              {new Date(tx.created_at).toLocaleString('es-ES', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="text-right space-y-0.5 shrink-0 font-mono">
                          <div
                            className={`font-bold text-xs ${
                              isDebit ? 'text-amber-400' : 'text-emerald-400'
                            }`}
                          >
                            {tx.amount > 0 ? `+${tx.amount}` : tx.amount} ⚡
                          </div>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded ${
                              tx.balance_type === 'free'
                                ? 'bg-amber-500/10 text-amber-400'
                                : 'bg-sky-500/10 text-sky-400'
                            }`}
                          >
                            {tx.balance_type === 'free' ? 'Cuota Gratis' : 'Adquirido'}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Strict Pagination without infinite scroll */}
                  <div className="flex items-center justify-between pt-2 text-xs text-stone-400">
                    <span className="text-[11px]">
                      Total: <span className="text-white font-mono">{historyData.total}</span> movimientos
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => loadHistory(historyPage - 1)}
                        disabled={historyPage <= 1 || isLoadingHistory}
                        className="p-1.5 rounded-lg bg-stone-800 text-stone-200 hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>

                      <span className="font-mono text-[11px] px-1">
                        {historyData.page} / {historyData.totalPages}
                      </span>

                      <button
                        onClick={() => loadHistory(historyPage + 1)}
                        disabled={historyPage >= historyData.totalPages || isLoadingHistory}
                        className="p-1.5 rounded-lg bg-stone-800 text-stone-200 hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-stone-800 bg-[#161B21] flex justify-between items-center text-xs">
          <span className="text-[10px] text-stone-500 font-mono">
            Economía V0.1 · Sin cargos monetarios reales
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
