import React, { useState, useEffect } from 'react';
import {
  AdminUserItem,
  AdminUsersFilterParams,
  PaginatedResult,
} from '@/src/modules/admin/adminTypes';
import { adminService } from '@/src/modules/admin/adminService';
import { economyService } from '@/src/modules/economy/economyService';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  Shield,
  ShieldAlert,
  User,
  UserCheck,
  UserX,
  Zap,
  Lock,
} from 'lucide-react';

interface AdminUsersViewProps {
  adminUserId: string;
  currentUserRole?: 'admin' | 'moderator' | 'user' | null;
  initialFilter?: string;
  onRefreshStats: () => void;
}

export const AdminUsersView: React.FC<AdminUsersViewProps> = ({
  adminUserId,
  currentUserRole = 'admin',
  initialFilter,
  onRefreshStats,
}) => {
  const isModerator = currentUserRole === 'moderator';
  const [usersData, setUsersData] = useState<PaginatedResult<AdminUserItem>>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'banned'>(
    (initialFilter as any) || 'all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    targetUser: AdminUserItem | null;
    action: 'suspend' | 'ban' | 'rehabilitate';
    reason: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    targetUser: null,
    action: 'suspend',
    reason: '',
    isSubmitting: false,
  });

  // Balance adjustment modal state
  const [adjustBalanceModal, setAdjustBalanceModal] = useState<{
    isOpen: boolean;
    targetUser: AdminUserItem | null;
    amount: number;
    balanceType: 'purchased' | 'free';
    reason: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    targetUser: null,
    amount: 10,
    balanceType: 'purchased',
    reason: '',
    isSubmitting: false,
  });

  const loadUsers = async (page = currentPage) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const params: AdminUsersFilterParams = {
        status: statusFilter,
        searchQuery,
        page,
        pageSize: 10,
      };

      const result = await adminService.getUsers(params, adminUserId);
      setUsersData(result);
      setCurrentPage(result.page);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al cargar el listado de usuarios.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    loadUsers(1);
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadUsers(1);
  };

  const openConfirmation = (
    user: AdminUserItem,
    action: 'suspend' | 'ban' | 'rehabilitate'
  ) => {
    setErrorMsg(null);

    // Strict client-side check aligning with server-side RPC rules
    if (action === 'ban' && isModerator) {
      setErrorMsg(
        'Acceso denegado: Los moderadores no tienen permisos para aplicar ban permanente. Acción exclusiva para administradores.'
      );
      return;
    }

    if (isModerator && (user.role === 'admin' || user.role === 'moderator')) {
      setErrorMsg(
        'Acceso denegado: Los moderadores no pueden sancionar administradores ni a otros moderadores.'
      );
      return;
    }

    let defaultReason = '';
    if (action === 'suspend') {
      defaultReason = 'Suspensión preventiva por acumulación de reportes';
    } else if (action === 'ban') {
      defaultReason = 'Expulsión definitiva por infracción grave de directrices';
    } else if (action === 'rehabilitate') {
      defaultReason = 'Rehabilitación tras cumplir periodo de sanción o revisión';
    }

    setConfirmModal({
      isOpen: true,
      targetUser: user,
      action,
      reason: defaultReason,
      isSubmitting: false,
    });
  };

  const handleExecuteSanction = async () => {
    if (!confirmModal.targetUser) return;
    setConfirmModal((prev) => ({ ...prev, isSubmitting: true }));
    setErrorMsg(null);
    setSuccessMsg(null);

    const target = confirmModal.targetUser;
    const action = confirmModal.action;
    const reasonText = confirmModal.reason.trim() || 'Acción aplicada por moderación';

    try {
      await adminService.moderateUser(
        {
          targetUserId: target.id,
          action,
          reason: reasonText,
        },
        adminUserId
      );

      setConfirmModal({
        isOpen: false,
        targetUser: null,
        action: 'suspend',
        reason: '',
        isSubmitting: false,
      });

      setSuccessMsg(
        `Usuario @${target.username} ${
          action === 'suspend'
            ? 'suspendido'
            : action === 'ban'
            ? 'baneado'
            : 'rehabilitado'
        } correctamente.`
      );

      await loadUsers(currentPage);
      onRefreshStats();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al aplicar sanción sobre el usuario.');
      setConfirmModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const openAdjustBalance = (user: AdminUserItem) => {
    setErrorMsg(null);
    if (isModerator) {
      setErrorMsg(
        'Acceso denegado: Los moderadores no tienen permisos para modificar saldos ni balances económicos.'
      );
      return;
    }

    setAdjustBalanceModal({
      isOpen: true,
      targetUser: user,
      amount: 10,
      balanceType: 'purchased',
      reason: 'Ajuste administrativo de saldo interno',
      isSubmitting: false,
    });
  };

  const handleExecuteBalanceAdjustment = async () => {
    if (!adjustBalanceModal.targetUser) return;
    if (!adjustBalanceModal.reason.trim() || adjustBalanceModal.reason.trim().length < 3) {
      setErrorMsg('El motivo del ajuste administrativo es obligatorio (mínimo 3 caracteres).');
      return;
    }

    setAdjustBalanceModal((prev) => ({ ...prev, isSubmitting: true }));
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await economyService.adminAdjustBalance(
        {
          targetUserId: adjustBalanceModal.targetUser.id,
          amount: Number(adjustBalanceModal.amount),
          balanceType: adjustBalanceModal.balanceType,
          reason: adjustBalanceModal.reason.trim(),
        },
        adminUserId
      );

      setSuccessMsg(
        `Saldo de @${adjustBalanceModal.targetUser.username} ajustado con éxito (${
          adjustBalanceModal.amount >= 0 ? '+' : ''
        }${adjustBalanceModal.amount} ⚡ ${
          adjustBalanceModal.balanceType === 'purchased' ? 'adquiridos' : 'cuota'
        }).`
      );

      setAdjustBalanceModal({
        isOpen: false,
        targetUser: null,
        amount: 10,
        balanceType: 'purchased',
        reason: '',
        isSubmitting: false,
      });

      await loadUsers(currentPage);
      onRefreshStats();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al aplicar el ajuste administrativo de saldo.');
    } finally {
      setAdjustBalanceModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  return (
    <div className="space-y-5">
      {/* Search & Filter Bar */}
      <div className="bg-[#161B21] border border-stone-800 rounded-xl p-4 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
            <input
              id="input-admin-search-users"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por @nombre_de_usuario..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#0E1216] border border-stone-700 rounded-lg text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 transition"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold rounded-lg transition"
          >
            Buscar
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-stone-400 mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Filtro de Estado:</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'active', label: 'Activos' },
              { id: 'suspended', label: 'Suspendidos' },
              { id: 'banned', label: 'Baneados' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  statusFilter === tab.id
                    ? 'bg-amber-500 text-black'
                    : 'bg-[#0E1216] text-stone-400 hover:text-white border border-stone-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {(statusFilter !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setSearchQuery('');
              }}
              className="text-[11px] text-amber-400 hover:underline ml-auto"
            >
              Limpiar filtro
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Users List */}
      {isLoading ? (
        <div className="py-12 flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-amber-500 border-r-transparent" />
        </div>
      ) : usersData.items.length === 0 ? (
        <div className="bg-[#161B21] border border-stone-800 rounded-xl p-10 text-center space-y-2">
          <User className="w-8 h-8 text-stone-600 mx-auto" />
          <h4 className="text-sm font-semibold text-white">No se encontraron usuarios</h4>
          <p className="text-xs text-stone-400 max-w-sm mx-auto">
            Intenta cambiar los términos de búsqueda o el filtro de estado.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {usersData.items.map((u) => {
            const isSelf = u.id === adminUserId;
            const isAdmin = u.role === 'admin';
            const isSuspended = u.status === 'suspended';
            const isBanned = u.status === 'banned';

            return (
              <div
                key={u.id}
                id={`admin-user-row-${u.id}`}
                className="bg-[#161B21] border border-stone-800 hover:border-stone-700 rounded-xl p-4 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                {/* User info */}
                <div className="flex items-center gap-3">
                  {u.avatar ? (
                    <img
                      src={u.avatar}
                      alt={u.username}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full object-cover border border-stone-700 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center text-sm font-bold text-amber-400 shrink-0">
                      {u.username[0]?.toUpperCase() || 'U'}
                    </div>
                  )}

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">@{u.username}</span>

                      {/* Role Badge */}
                      <span
                        className={`text-[10px] font-mono uppercase px-1.5 py-0.2 rounded ${
                          u.role === 'admin'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : u.role === 'moderator'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-stone-800 text-stone-400 border border-stone-700'
                        }`}
                      >
                        {u.role}
                      </span>

                      {/* Status Badge */}
                      <span
                        className={`text-[10px] font-mono uppercase px-1.5 py-0.2 rounded border ${
                          u.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : u.status === 'suspended'
                            ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                            : u.status === 'banned'
                            ? 'bg-red-500/10 text-red-400 border-red-500/30'
                            : 'bg-stone-800 text-stone-400 border-stone-700'
                        }`}
                      >
                        {u.status}
                      </span>
                    </div>

                    <div className="text-[11px] text-stone-500 font-mono">
                      Registrado: {new Date(u.created_at).toLocaleDateString('es-ES')}
                    </div>
                  </div>
                </div>

                {/* Moderation Actions for user */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  {isSelf ? (
                    <span className="text-xs text-stone-500 italic py-1">
                      Tu propia cuenta (protegida)
                    </span>
                  ) : isAdmin ? (
                    <span className="text-xs text-stone-500 italic py-1">
                      Administrador (inmune)
                    </span>
                  ) : isModerator && u.role === 'moderator' ? (
                    <span className="text-xs text-stone-500 italic py-1">
                      Moderador (inmune)
                    </span>
                  ) : isSuspended || isBanned ? (
                    <button
                      onClick={() => openConfirmation(u, 'rehabilitate')}
                      disabled={isBanned && isModerator}
                      title={
                        isBanned && isModerator
                          ? 'Solo administradores pueden rehabilitar cuentas con ban permanente'
                          : 'Rehabilitar cuenta'
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/70 border border-emerald-500/30 hover:bg-emerald-900 text-emerald-300 text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Rehabilitar cuenta
                    </button>
                  ) : (
                    <>
                      {!isModerator && (
                        <button
                          onClick={() => openAdjustBalance(u)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-950/60 border border-amber-500/30 hover:bg-amber-900/60 text-amber-300 text-xs font-medium transition"
                          title="Ajustar saldo interno de Dynamos ⚡ (Solo Admin)"
                        >
                          <Zap className="w-3.5 h-3.5 fill-amber-400" />
                          Ajustar ⚡
                        </button>
                      )}

                      <button
                        onClick={() => openConfirmation(u, 'suspend')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-950/60 border border-orange-500/30 hover:bg-orange-900/60 text-orange-300 text-xs font-medium transition"
                        title="Suspender temporalmente al usuario"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        Suspender
                      </button>

                      {isModerator ? (
                        <button
                          disabled
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900/60 border border-stone-800 text-stone-600 text-xs font-medium cursor-not-allowed opacity-50"
                          title="Restringido: Solo administradores tienen permisos para aplicar ban permanente"
                        >
                          <Lock className="w-3.5 h-3.5 text-stone-600" />
                          Ban (Solo Admin)
                        </button>
                      ) : (
                        <button
                          onClick={() => openConfirmation(u, 'ban')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/60 border border-red-500/30 hover:bg-red-900/60 text-red-300 text-xs font-medium transition"
                          title="Bloquear/Banear permanentemente"
                        >
                          <ShieldAlert className="w-3.5 h-3.5" />
                          Banear
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* Strict Pagination (NO infinite scroll) */}
          <div className="flex items-center justify-between bg-[#161B21] border border-stone-800 rounded-xl px-4 py-3 text-xs text-stone-400">
            <div>
              Total: <span className="text-white font-mono">{usersData.total}</span> usuarios
            </div>

            <div className="flex items-center gap-2">
              <button
                id="btn-admin-users-prev-page"
                onClick={() => loadUsers(currentPage - 1)}
                disabled={currentPage <= 1 || isLoading}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-800 text-stone-200 hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Anterior
              </button>

              <span className="px-2 font-mono text-stone-300">
                {usersData.page} / {usersData.totalPages}
              </span>

              <button
                id="btn-admin-users-next-page"
                onClick={() => loadUsers(currentPage + 1)}
                disabled={currentPage >= usersData.totalPages || isLoading}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-800 text-stone-200 hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Siguiente
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && confirmModal.targetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#161B21] border border-stone-700 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <AlertTriangle
                className={`w-4 h-4 ${
                  confirmModal.action === 'ban'
                    ? 'text-red-400'
                    : confirmModal.action === 'suspend'
                    ? 'text-orange-400'
                    : 'text-emerald-400'
                }`}
              />
              {confirmModal.action === 'suspend'
                ? `Suspender a @${confirmModal.targetUser.username}`
                : confirmModal.action === 'ban'
                ? `Banear a @${confirmModal.targetUser.username}`
                : `Rehabilitar a @${confirmModal.targetUser.username}`}
            </div>

            <p className="text-xs text-stone-300 leading-relaxed">
              {confirmModal.action === 'suspend' && (
                <>
                  La suspensión impedirá al usuario publicar Dynamos, enviar respuestas o regalar
                  energía hasta que sea rehabilitado.
                </>
              )}
              {confirmModal.action === 'ban' && (
                <>
                  El bloqueo / ban es una sanción de máxima severidad que inhabilita el acceso
                  completo del usuario a la plataforma.
                </>
              )}
              {confirmModal.action === 'rehabilitate' && (
                <>
                  Rehabilitar devolverá al usuario a su estado activo normal y podrá interactuar
                  nuevamente en la red.
                </>
              )}
            </p>

            <div>
              <label className="block text-[11px] font-semibold text-stone-400 mb-1">
                Motivo / Justificación de la sanción (requerido para auditoría):
              </label>
              <textarea
                id="input-user-sanction-reason"
                value={confirmModal.reason}
                onChange={(e) =>
                  setConfirmModal((prev) => ({ ...prev, reason: e.target.value }))
                }
                rows={3}
                maxLength={200}
                placeholder="Indica la razón de la sanción..."
                className="w-full p-2.5 text-xs bg-[#0E1216] border border-stone-700 rounded-lg text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 transition"
              />
              <span className="text-[10px] text-stone-500 text-right block mt-0.5">
                {confirmModal.reason.length}/200 caracteres
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() =>
                  setConfirmModal({
                    isOpen: false,
                    targetUser: null,
                    action: 'suspend',
                    reason: '',
                    isSubmitting: false,
                  })
                }
                disabled={confirmModal.isSubmitting}
                className="px-3.5 py-1.5 text-xs text-stone-400 hover:text-white transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirm-user-sanction"
                onClick={handleExecuteSanction}
                disabled={confirmModal.isSubmitting || !confirmModal.reason.trim()}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  confirmModal.action === 'ban'
                    ? 'bg-red-600 hover:bg-red-500 text-white'
                    : confirmModal.action === 'suspend'
                    ? 'bg-orange-500 hover:bg-orange-400 text-black'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-black'
                }`}
              >
                {confirmModal.isSubmitting
                  ? 'Aplicando...'
                  : confirmModal.action === 'ban'
                  ? 'Confirmar Ban'
                  : confirmModal.action === 'suspend'
                  ? 'Confirmar Suspensión'
                  : 'Confirmar Rehabilitación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Balance Modal */}
      {adjustBalanceModal.isOpen && adjustBalanceModal.targetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div
            id="modal-admin-adjust-balance"
            className="w-full max-w-md bg-[#161B21] border border-amber-500/30 rounded-2xl shadow-2xl p-5 space-y-4"
          >
            <div className="flex items-center gap-2 text-amber-400">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <Zap className="w-5 h-5 fill-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Ajuste Administrativo de Saldo ⚡
                </h3>
                <p className="text-[11px] text-stone-400 font-mono">
                  Usuario: @{adjustBalanceModal.targetUser.username}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-stone-400 mb-1">
                  Tipo de Saldo:
                </label>
                <select
                  id="select-admin-balance-type"
                  value={adjustBalanceModal.balanceType}
                  onChange={(e) =>
                    setAdjustBalanceModal((prev) => ({
                      ...prev,
                      balanceType: e.target.value as 'purchased' | 'free',
                    }))
                  }
                  className="w-full p-2 bg-[#0E1216] border border-stone-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="purchased">Dynamos Adquiridos (Saldo permanente)</option>
                  <option value="free">Dynamos Gratuitos (Ajuste de cuota diaria)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-400 mb-1">
                  Cantidad a Ajustar (positivo para sumar, negativo para restar):
                </label>
                <input
                  id="input-admin-adjust-amount"
                  type="number"
                  value={adjustBalanceModal.amount}
                  onChange={(e) =>
                    setAdjustBalanceModal((prev) => ({
                      ...prev,
                      amount: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="w-full p-2 bg-[#0E1216] border border-stone-700 rounded-lg text-white font-mono focus:outline-none focus:border-amber-500"
                  placeholder="Ej: 10 o -5"
                />
                <span className="text-[10px] text-stone-500 mt-0.5 block">
                  * El saldo adquirido nunca podrá quedar en valor negativo.
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-400 mb-1">
                  Motivo obligatorio del ajuste (auditoría obligatoria):
                </label>
                <textarea
                  id="input-admin-adjust-reason"
                  value={adjustBalanceModal.reason}
                  onChange={(e) =>
                    setAdjustBalanceModal((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  rows={2}
                  maxLength={200}
                  placeholder="Justificación del ajuste administrativo..."
                  className="w-full p-2 text-xs bg-[#0E1216] border border-stone-700 rounded-lg text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-800 text-xs">
              <button
                type="button"
                onClick={() =>
                  setAdjustBalanceModal({
                    isOpen: false,
                    targetUser: null,
                    amount: 10,
                    balanceType: 'purchased',
                    reason: '',
                    isSubmitting: false,
                  })
                }
                disabled={adjustBalanceModal.isSubmitting}
                className="px-3.5 py-1.5 text-stone-400 hover:text-white transition"
              >
                Cancelar
              </button>

              <button
                type="button"
                id="btn-confirm-adjust-balance"
                onClick={handleExecuteBalanceAdjustment}
                disabled={
                  adjustBalanceModal.isSubmitting ||
                  !adjustBalanceModal.reason.trim() ||
                  adjustBalanceModal.amount === 0
                }
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {adjustBalanceModal.isSubmitting ? 'Aplicando...' : 'Aplicar Ajuste ⚡'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
