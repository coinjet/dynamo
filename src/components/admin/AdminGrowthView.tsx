import React, { useState, useEffect } from 'react';
import { adminService } from '@/src/modules/admin/adminService';
import {
  AdminGrowthFunnel,
  AdminGrowthInviterItem,
  PaginatedResult,
} from '@/src/modules/admin/adminTypes';
import {
  TrendingUp,
  Users,
  MousePointer,
  Eye,
  UserPlus,
  MailCheck,
  Zap,
  MessageSquare,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Share2,
  Award,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface AdminGrowthViewProps {
  adminUserId: string;
}

export const AdminGrowthView: React.FC<AdminGrowthViewProps> = ({ adminUserId }) => {
  const [funnel, setFunnel] = useState<AdminGrowthFunnel | null>(null);
  const [invitersData, setInvitersData] = useState<PaginatedResult<AdminGrowthInviterItem>>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 15,
    totalPages: 1,
  });

  const [isLoadingFunnel, setIsLoadingFunnel] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const loadFunnel = async () => {
    setIsLoadingFunnel(true);
    try {
      const data = await adminService.getGrowthFunnel(adminUserId);
      setFunnel(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al cargar métricas del embudo.');
    } finally {
      setIsLoadingFunnel(false);
    }
  };

  const loadInviters = async (page = currentPage, query = searchQuery) => {
    setIsLoadingUsers(true);
    try {
      const data = await adminService.getGrowthUsers(adminUserId, {
        page,
        pageSize: 15,
        searchQuery: query,
      });
      setInvitersData(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al cargar lista de invitadores.');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadFunnel();
    loadInviters(1, '');
  }, [adminUserId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadInviters(1, searchQuery);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > invitersData.totalPages) return;
    setCurrentPage(newPage);
    loadInviters(newPage, searchQuery);
  };

  const handleRefresh = () => {
    loadFunnel();
    loadInviters(currentPage, searchQuery);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-[#212832] bg-[#12161A]">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-400" />
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Invitaciones & Crecimiento
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Server-authoritative
            </span>
          </div>
          <p className="text-xs text-stone-400 mt-1">
            Monitoreo en tiempo real del embudo de referidos, atribución criptográfica en DB y usuarios activos. Cero métricas ficticias.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isLoadingFunnel || isLoadingUsers}
          className="self-start sm:self-center flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-700 bg-stone-800/80 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFunnel || isLoadingUsers ? 'animate-spin text-amber-400' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs">
          {errorMsg}
        </div>
      )}

      {/* Global Summary Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-stone-800/80 bg-[#12161A] space-y-1">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-[11px] font-medium">Invitadores Únicos</span>
            <Users className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-xl sm:text-2xl font-mono font-bold text-white">
            {isLoadingFunnel ? '...' : (funnel?.total_inviters ?? 0)}
          </p>
          <p className="text-[10px] text-stone-400">Usuarios con código activo</p>
        </div>

        <div className="p-4 rounded-xl border border-stone-800/80 bg-[#12161A] space-y-1">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-[11px] font-medium">Total Atribuidos</span>
            <UserPlus className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl sm:text-2xl font-mono font-bold text-white">
            {isLoadingFunnel ? '...' : (funnel?.total_referred_users ?? 0)}
          </p>
          <p className="text-[10px] text-stone-400">Cuentas creadas vía invitación</p>
        </div>

        <div className="p-4 rounded-xl border border-stone-800/80 bg-[#12161A] space-y-1">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-[11px] font-medium">Emails Confirmados</span>
            <MailCheck className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-xl sm:text-2xl font-mono font-bold text-white">
            {isLoadingFunnel ? '...' : (funnel?.total_confirmed_referred ?? 0)}
          </p>
          <p className="text-[10px] text-stone-400">
            {funnel ? `${funnel.signup_to_confirmed_rate}% de registros` : '...'}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-stone-800/80 bg-[#12161A] space-y-1">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-[11px] font-medium">Activados (1er Dynamo)</span>
            <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
          </div>
          <p className="text-xl sm:text-2xl font-mono font-bold text-white">
            {isLoadingFunnel ? '...' : (funnel?.total_first_dynamo ?? 0)}
          </p>
          <p className="text-[10px] text-stone-400">
            {funnel ? `${funnel.confirmed_to_active_rate}% de confirmados` : '...'}
          </p>
        </div>
      </div>

      {/* Full Funnel Pipeline Visualizer */}
      <div className="p-5 rounded-2xl border border-[#212832] bg-[#12161A] space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Share2 className="w-4 h-4 text-amber-400" />
              Embudo Global de Conversión (End-to-End)
            </h3>
            <p className="text-[11px] text-stone-400">
              Traza del ciclo de vida: Clics → Visita → Registro iniciado → Registro completado → Email verificado → 1er Dynamo → 1ra Interacción.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-7 gap-2 pt-2">
          {/* Stage 1: Clicks */}
          <div className="p-3 rounded-xl bg-[#171D24] border border-stone-800 text-center space-y-1">
            <div className="flex items-center justify-center gap-1 text-[10px] uppercase font-mono text-stone-400">
              <MousePointer className="w-3 h-3 text-stone-400" />
              <span>Clicks</span>
            </div>
            <p className="text-lg font-mono font-extrabold text-white">
              {funnel?.clicks ?? 0}
            </p>
            <span className="text-[9px] text-stone-400">100% entrada</span>
          </div>

          {/* Stage 2: Landing Views */}
          <div className="p-3 rounded-xl bg-[#171D24] border border-stone-800 text-center space-y-1">
            <div className="flex items-center justify-center gap-1 text-[10px] uppercase font-mono text-stone-400">
              <Eye className="w-3 h-3 text-stone-400" />
              <span>Landing</span>
            </div>
            <p className="text-lg font-mono font-extrabold text-white">
              {funnel?.landing_views ?? 0}
            </p>
            <span className="text-[9px] text-stone-400">
              {funnel && funnel.clicks > 0
                ? `${Math.round(((funnel.landing_views || 0) / funnel.clicks) * 100)}% de clics`
                : '—'}
            </span>
          </div>

          {/* Stage 3: Signup Started */}
          <div className="p-3 rounded-xl bg-[#171D24] border border-stone-800 text-center space-y-1">
            <div className="flex items-center justify-center gap-1 text-[10px] uppercase font-mono text-stone-400">
              <UserPlus className="w-3 h-3 text-amber-400" />
              <span>Inicia</span>
            </div>
            <p className="text-lg font-mono font-extrabold text-amber-400">
              {funnel?.signup_started ?? 0}
            </p>
            <span className="text-[9px] text-stone-400">Clic en CTA</span>
          </div>

          {/* Stage 4: Signup Completed */}
          <div className="p-3 rounded-xl bg-[#171D24] border border-stone-800 text-center space-y-1">
            <div className="flex items-center justify-center gap-1 text-[10px] uppercase font-mono text-stone-400">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>Registro</span>
            </div>
            <p className="text-lg font-mono font-extrabold text-emerald-400">
              {funnel?.signup_completed ?? 0}
            </p>
            <span className="text-[9px] text-emerald-400/90 font-mono">
              {funnel?.click_to_signup_rate}% conv.
            </span>
          </div>

          {/* Stage 5: Email Confirmed */}
          <div className="p-3 rounded-xl bg-[#171D24] border border-stone-800 text-center space-y-1">
            <div className="flex items-center justify-center gap-1 text-[10px] uppercase font-mono text-stone-400">
              <MailCheck className="w-3 h-3 text-sky-400" />
              <span>Email OK</span>
            </div>
            <p className="text-lg font-mono font-extrabold text-sky-400">
              {funnel?.email_confirmed ?? 0}
            </p>
            <span className="text-[9px] text-sky-400/90 font-mono">
              {funnel?.signup_to_confirmed_rate}% verif.
            </span>
          </div>

          {/* Stage 6: First Dynamo */}
          <div className="p-3 rounded-xl bg-[#171D24] border border-stone-800 text-center space-y-1">
            <div className="flex items-center justify-center gap-1 text-[10px] uppercase font-mono text-stone-400">
              <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span>1er Dynamo</span>
            </div>
            <p className="text-lg font-mono font-extrabold text-amber-300">
              {funnel?.first_dynamo ?? 0}
            </p>
            <span className="text-[9px] text-amber-400/90 font-mono">
              {funnel?.confirmed_to_active_rate}% activo
            </span>
          </div>

          {/* Stage 7: First Interaction */}
          <div className="p-3 rounded-xl bg-[#171D24] border border-stone-800 text-center space-y-1">
            <div className="flex items-center justify-center gap-1 text-[10px] uppercase font-mono text-stone-400">
              <MessageSquare className="w-3 h-3 text-purple-400" />
              <span>1ra Interac.</span>
            </div>
            <p className="text-lg font-mono font-extrabold text-purple-400">
              {funnel?.first_interaction ?? 0}
            </p>
            <span className="text-[9px] text-purple-400/90 font-mono">
              Reply / Regalo
            </span>
          </div>
        </div>
      </div>

      {/* Inviters Detailed Table */}
      <div className="p-5 rounded-2xl border border-[#212832] bg-[#12161A] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              Detalle por Usuario Invitador
            </h3>
            <p className="text-[11px] text-stone-400">
              Desglose individual auditado de rendimiento de invitaciones. Por protección de privacidad, no se exponen correos ni teléfonos de invitados.
            </p>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar @usuario o código..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-stone-800 bg-[#161B21] text-xs text-white placeholder-stone-400 focus:outline-none focus:border-amber-500/60"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition shrink-0"
            >
              Buscar
            </button>
          </form>
        </div>

        {/* Table Content */}
        {isLoadingUsers ? (
          <div className="py-12 text-center text-xs text-stone-400 space-y-2">
            <RefreshCw className="w-5 h-5 text-amber-400 animate-spin mx-auto" />
            <p>Cargando invitadores...</p>
          </div>
        ) : invitersData.items.length === 0 ? (
          <div className="py-10 text-center text-xs text-stone-400 border border-dashed border-stone-800 rounded-xl">
            No se encontraron usuarios invitadores con los criterios especificados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-800 text-stone-400 font-semibold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Invitador</th>
                  <th className="py-2.5 px-3">Código</th>
                  <th className="py-2.5 px-3 text-center">Clicks</th>
                  <th className="py-2.5 px-3 text-center">Registros</th>
                  <th className="py-2.5 px-3 text-center">Confirmados</th>
                  <th className="py-2.5 px-3 text-center">1er Dynamo</th>
                  <th className="py-2.5 px-3 text-center">1ra Interac.</th>
                  <th className="py-2.5 px-3 text-right">Creado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60">
                {invitersData.items.map((inviter) => (
                  <tr key={inviter.inviter_id} className="hover:bg-stone-900/40 transition">
                    <td className="py-2.5 px-3 font-medium text-white flex items-center gap-2">
                      <span className="font-mono text-amber-400">@{inviter.inviter_username}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono text-xs px-2 py-0.5 rounded-lg bg-stone-800/80 border border-stone-700 text-stone-200">
                        {inviter.referral_code}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-stone-300">
                      {inviter.clicks}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-400">
                      {inviter.signups}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-semibold text-sky-400">
                      {inviter.confirmations}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-semibold text-amber-300">
                      {inviter.first_dynamos}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-purple-400">
                      {inviter.first_interactions}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[11px] text-stone-400">
                      {inviter.code_created_at
                        ? new Date(inviter.code_created_at).toLocaleDateString()
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {invitersData.totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-stone-800 text-xs text-stone-400">
            <span>
              Total: <strong className="text-white">{invitersData.total}</strong> invitadores (Página {invitersData.page} de {invitersData.totalPages})
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1 || isLoadingUsers}
                className="p-1.5 rounded-lg border border-stone-800 bg-stone-900 hover:bg-stone-800 text-stone-300 disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= invitersData.totalPages || isLoadingUsers}
                className="p-1.5 rounded-lg border border-stone-800 bg-stone-900 hover:bg-stone-800 text-stone-300 disabled:opacity-40 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
