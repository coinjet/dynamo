import React, { useState, useEffect } from 'react';
import {
  AdminReportItem,
  AdminReportsFilterParams,
  PaginatedResult,
} from '@/src/modules/admin/adminTypes';
import { adminService } from '@/src/modules/admin/adminService';
import {
  ReportReason,
  ReportStatus,
  REPORT_REASON_LABELS,
} from '@/src/modules/moderation/moderationTypes';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  Filter,
  Lock,
  Search,
  Slash,
  Unlock,
  User,
  Zap,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Shield,
} from 'lucide-react';

interface AdminReportsInboxProps {
  adminUserId: string;
  initialStatusFilter?: string;
  onRefreshStats: () => void;
}

export const AdminReportsInbox: React.FC<AdminReportsInboxProps> = ({
  adminUserId,
  initialStatusFilter,
  onRefreshStats,
}) => {
  const [reportsData, setReportsData] = useState<PaginatedResult<AdminReportItem>>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | ReportStatus>(
    (initialStatusFilter as any) || 'all'
  );
  const [categoryFilter, setCategoryFilter] = useState<'all' | ReportReason>('all');
  const [contentTypeFilter, setContentTypeFilter] = useState<'all' | 'dynamo' | 'reply'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Action Modal State
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    report: AdminReportItem | null;
    actionType: 'hide' | 'restore' | 'resolve' | 'dismiss' | 'review';
    reason: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    report: null,
    actionType: 'resolve',
    reason: '',
    isSubmitting: false,
  });

  const loadReports = async (page = currentPage) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const params: AdminReportsFilterParams = {
        status: statusFilter,
        category: categoryFilter,
        contentType: contentTypeFilter,
        searchQuery,
        page,
        pageSize: 10,
      };

      const result = await adminService.getReports(params, adminUserId);
      setReportsData(result);
      setCurrentPage(result.page);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al cargar la bandeja de reportes.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    loadReports(1);
  }, [statusFilter, categoryFilter, contentTypeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadReports(1);
  };

  const openActionModal = (
    report: AdminReportItem,
    actionType: 'hide' | 'restore' | 'resolve' | 'dismiss' | 'review'
  ) => {
    let defaultReason = '';
    if (actionType === 'hide') {
      defaultReason = `Ocultado por infracción de: ${REPORT_REASON_LABELS[report.reason]}`;
    } else if (actionType === 'restore') {
      defaultReason = 'Contenido restaurado tras revisión';
    } else if (actionType === 'resolve') {
      defaultReason = 'Reporte resuelto conforme a directrices';
    } else if (actionType === 'dismiss') {
      defaultReason = 'Reporte descartado por no constituir infracción';
    } else if (actionType === 'review') {
      defaultReason = 'Marcado en proceso de revisión';
    }

    setActionModal({
      isOpen: true,
      report,
      actionType,
      reason: defaultReason,
      isSubmitting: false,
    });
  };

  const handleExecuteAction = async () => {
    if (!actionModal.report) return;
    setActionModal((prev) => ({ ...prev, isSubmitting: true }));
    setErrorMsg(null);

    const r = actionModal.report;
    const act = actionModal.actionType;
    const reasonText = actionModal.reason.trim() || 'Acción administrativa aplicada';

    try {
      if (act === 'hide') {
        const contentAction = r.content_type === 'dynamo' ? 'hide_dynamo' : 'hide_reply';
        await adminService.moderateContent(
          {
            reportId: r.id,
            newReportStatus: 'actioned',
            contentAction,
            contentId: r.content_id,
            reason: reasonText,
          },
          adminUserId
        );
      } else if (act === 'restore') {
        const contentAction = r.content_type === 'dynamo' ? 'restore_dynamo' : 'restore_reply';
        await adminService.moderateContent(
          {
            reportId: r.id,
            contentAction,
            contentId: r.content_id,
            reason: reasonText,
          },
          adminUserId
        );
      } else if (act === 'resolve') {
        await adminService.moderateContent(
          {
            reportId: r.id,
            newReportStatus: 'resolved',
            reason: reasonText,
          },
          adminUserId
        );
      } else if (act === 'dismiss') {
        await adminService.moderateContent(
          {
            reportId: r.id,
            newReportStatus: 'dismissed',
            reason: reasonText,
          },
          adminUserId
        );
      } else if (act === 'review') {
        await adminService.moderateContent(
          {
            reportId: r.id,
            newReportStatus: 'reviewed',
            reason: reasonText,
          },
          adminUserId
        );
      }

      setActionModal({
        isOpen: false,
        report: null,
        actionType: 'resolve',
        reason: '',
        isSubmitting: false,
      });

      // Refresh list & metrics
      await loadReports(currentPage);
      onRefreshStats();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al ejecutar la acción de moderación.');
      setActionModal((prev) => ({ ...prev, isSubmitting: false }));
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
              id="input-admin-search-reports"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar texto de publicación, autor @usuario o motivo..."
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
            <span>Filtros:</span>
          </div>

          {/* Status filter */}
          <select
            id="select-filter-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-[#0E1216] border border-stone-700 rounded-lg px-2.5 py-1.5 text-stone-200 text-xs focus:border-amber-500 focus:outline-none"
          >
            <option value="all">Estado: Todos</option>
            <option value="pending">⏳ Pendientes</option>
            <option value="reviewed">👁️ Revisados</option>
            <option value="resolved">✅ Resueltos</option>
            <option value="dismissed">❌ Descartados</option>
          </select>

          {/* Category filter */}
          <select
            id="select-filter-category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            className="bg-[#0E1216] border border-stone-700 rounded-lg px-2.5 py-1.5 text-stone-200 text-xs focus:border-amber-500 focus:outline-none"
          >
            <option value="all">Categoría: Todas</option>
            {Object.entries(REPORT_REASON_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          {/* Content type filter */}
          <select
            id="select-filter-content-type"
            value={contentTypeFilter}
            onChange={(e) => setContentTypeFilter(e.target.value as any)}
            className="bg-[#0E1216] border border-stone-700 rounded-lg px-2.5 py-1.5 text-stone-200 text-xs focus:border-amber-500 focus:outline-none"
          >
            <option value="all">Tipo: Todos</option>
            <option value="dynamo">⚡ Solo Dynamos</option>
            <option value="reply">💬 Solo Respuestas</option>
          </select>

          {(statusFilter !== 'all' || categoryFilter !== 'all' || contentTypeFilter !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setCategoryFilter('all');
                setContentTypeFilter('all');
                setSearchQuery('');
              }}
              className="text-[11px] text-amber-400 hover:underline ml-auto"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-lg bg-red-950/40 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Reports List */}
      {isLoading ? (
        <div className="py-12 flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-amber-500 border-r-transparent" />
        </div>
      ) : reportsData.items.length === 0 ? (
        <div className="bg-[#161B21] border border-stone-800 rounded-xl p-10 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-stone-600 mx-auto" />
          <h4 className="text-sm font-semibold text-white">Bandeja despejada</h4>
          <p className="text-xs text-stone-400 max-w-sm mx-auto">
            No se encontraron reportes con los criterios y filtros seleccionados.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {reportsData.items.map((r) => {
            const isHidden = r.content_status === 'hidden';
            return (
              <div
                key={r.id}
                id={`admin-report-${r.id}`}
                className="bg-[#161B21] border border-stone-800 hover:border-stone-700 rounded-xl p-4 transition space-y-3"
              >
                {/* Header row: Metadata badges */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-800/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    {/* Content Type badge */}
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold font-mono px-2 py-0.5 rounded-full ${
                        r.content_type === 'dynamo'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                      }`}
                    >
                      {r.content_type === 'dynamo' ? (
                        <>
                          <Zap className="w-3 h-3" />
                          DYNAMO
                        </>
                      ) : (
                        <>
                          <MessageCircle className="w-3 h-3" />
                          RESPUESTA
                        </>
                      )}
                    </span>

                    {/* Reason badge */}
                    <span className="text-[11px] font-medium text-stone-300 bg-stone-800/80 px-2 py-0.5 rounded">
                      {REPORT_REASON_LABELS[r.reason] || r.reason}
                    </span>

                    {/* Status badge */}
                    <span
                      className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border ${
                        r.status === 'pending'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : r.status === 'reviewed'
                          ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                          : r.status === 'resolved' || r.status === 'actioned'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-stone-800 text-stone-400 border-stone-700'
                      }`}
                    >
                      {r.status === 'pending'
                        ? 'Pendiente'
                        : r.status === 'reviewed'
                        ? 'Revisado'
                        : r.status === 'resolved' || r.status === 'actioned'
                        ? 'Resuelto'
                        : 'Descartado'}
                    </span>
                  </div>

                  <span className="text-[11px] text-stone-500 font-mono">
                    {new Date(r.created_at).toLocaleString('es-ES', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>

                {/* Content preview */}
                <div className="bg-[#0E1216] border border-stone-800/90 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-stone-400">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-stone-500" />
                      Autor del contenido:
                      <span className="text-white font-medium">@{r.author_username}</span>
                    </span>

                    {isHidden && (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                        <Lock className="w-3 h-3" />
                        Oculto por moderación
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-stone-200 leading-relaxed font-sans whitespace-pre-line break-words border-l-2 border-stone-700 pl-2.5">
                    {r.content_text}
                  </p>
                </div>

                {/* Report Reason & optional comments from reporter */}
                {r.description && (
                  <div className="text-xs text-stone-400 bg-stone-900/60 rounded-lg p-2.5 border border-stone-800/60">
                    <span className="font-semibold text-stone-300 block mb-0.5">
                      Comentario del reportante (Anónimo):
                    </span>
                    <span className="italic text-stone-300">"{r.description}"</span>
                  </div>
                )}

                {/* Moderation Actions bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-stone-800/60">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Content Hide / Restore */}
                    {isHidden ? (
                      <button
                        onClick={() => openActionModal(r, 'restore')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium transition"
                      >
                        <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                        Restaurar contenido
                      </button>
                    ) : (
                      <button
                        onClick={() => openActionModal(r, 'hide')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-purple-950/60 border border-purple-500/30 hover:bg-purple-900/60 text-purple-200 text-xs font-medium transition"
                      >
                        <Lock className="w-3.5 h-3.5 text-purple-400" />
                        Ocultar {r.content_type === 'dynamo' ? 'Dynamo' : 'Respuesta'}
                      </button>
                    )}

                    {/* Status updates */}
                    {r.status === 'pending' && (
                      <button
                        onClick={() => openActionModal(r, 'review')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-sky-400 text-xs font-medium transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Marcar Revisado
                      </button>
                    )}

                    {r.status !== 'resolved' && r.status !== 'actioned' && (
                      <button
                        onClick={() => openActionModal(r, 'resolve')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-950/60 border border-emerald-500/30 hover:bg-emerald-900/60 text-emerald-300 text-xs font-medium transition"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Resolver
                      </button>
                    )}

                    {r.status !== 'dismissed' && (
                      <button
                        onClick={() => openActionModal(r, 'dismiss')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 text-xs font-medium transition"
                      >
                        <Slash className="w-3.5 h-3.5" />
                        Descartar
                      </button>
                    )}
                  </div>

                  <span className="text-[10px] font-mono text-stone-500">
                    ID: {r.id.slice(0, 8)}...
                  </span>
                </div>
              </div>
            );
          })}

          {/* Strict Pagination (NO infinite scroll) */}
          <div className="flex items-center justify-between bg-[#161B21] border border-stone-800 rounded-xl px-4 py-3 text-xs text-stone-400">
            <div>
              Total: <span className="text-white font-mono">{reportsData.total}</span> reportes
            </div>

            <div className="flex items-center gap-2">
              <button
                id="btn-admin-prev-page"
                onClick={() => loadReports(currentPage - 1)}
                disabled={currentPage <= 1 || isLoading}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-800 text-stone-200 hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Anterior
              </button>

              <span className="px-2 font-mono text-stone-300">
                {reportsData.page} / {reportsData.totalPages}
              </span>

              <button
                id="btn-admin-next-page"
                onClick={() => loadReports(currentPage + 1)}
                disabled={currentPage >= reportsData.totalPages || isLoading}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-800 text-stone-200 hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Siguiente
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation & Reason Modal */}
      {actionModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#161B21] border border-stone-700 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <Shield className="w-4 h-4 text-amber-400" />
              {actionModal.actionType === 'hide'
                ? 'Ocultar contenido por moderación'
                : actionModal.actionType === 'restore'
                ? 'Restaurar contenido'
                : actionModal.actionType === 'resolve'
                ? 'Resolver reporte'
                : actionModal.actionType === 'dismiss'
                ? 'Descartar reporte'
                : 'Marcar como revisado'}
            </div>

            <p className="text-xs text-stone-300">
              Esta acción quedará registrada en el historial de auditoría de moderación. Por favor
              confirma el motivo de la decisión.
            </p>

            <div>
              <label className="block text-[11px] font-semibold text-stone-400 mb-1">
                Motivo / Justificación obligatoria:
              </label>
              <textarea
                id="input-moderation-reason"
                value={actionModal.reason}
                onChange={(e) =>
                  setActionModal((prev) => ({ ...prev, reason: e.target.value }))
                }
                rows={3}
                maxLength={200}
                placeholder="Indica el motivo de la moderación..."
                className="w-full p-2.5 text-xs bg-[#0E1216] border border-stone-700 rounded-lg text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 transition"
              />
              <span className="text-[10px] text-stone-500 text-right block mt-0.5">
                {actionModal.reason.length}/200 caracteres
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() =>
                  setActionModal({
                    isOpen: false,
                    report: null,
                    actionType: 'resolve',
                    reason: '',
                    isSubmitting: false,
                  })
                }
                disabled={actionModal.isSubmitting}
                className="px-3.5 py-1.5 text-xs text-stone-400 hover:text-white transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-confirm-moderation-action"
                onClick={handleExecuteAction}
                disabled={actionModal.isSubmitting || !actionModal.reason.trim()}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionModal.isSubmitting ? 'Guardando...' : 'Confirmar Acción'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
