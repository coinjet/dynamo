import React, { useState, useEffect } from 'react';
import { AdminAuditLogItem, PaginatedResult } from '@/src/modules/admin/adminTypes';
import { adminService } from '@/src/modules/admin/adminService';
import {
  AlertCircle,
  Clock,
  FileText,
  Shield,
  User,
  Zap,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface AdminAuditViewProps {
  adminUserId: string;
}

export const AdminAuditView: React.FC<AdminAuditViewProps> = ({ adminUserId }) => {
  const [logsData, setLogsData] = useState<PaginatedResult<AdminAuditLogItem>>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 15,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const loadLogs = async (page = currentPage) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const result = await adminService.getAuditLogs(page, 15, adminUserId);
      setLogsData(result);
      setCurrentPage(result.page);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al cargar el registro de auditoría.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs(1);
  }, []);

  const formatActionName = (action: string) => {
    switch (action) {
      case 'hide_dynamo':
        return 'Ocultó publicación Dynamo';
      case 'restore_dynamo':
        return 'Restauró publicación Dynamo';
      case 'hide_reply':
        return 'Ocultó respuesta';
      case 'restore_reply':
        return 'Restauró respuesta';
      case 'user_suspend':
      case 'user_status_suspended':
        return 'Suspendió usuario';
      case 'user_ban':
      case 'user_status_banned':
        return 'Bloqueó / Baneó usuario';
      case 'user_rehabilitate':
      case 'user_status_active':
        return 'Rehabilitó usuario';
      default:
        return action;
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#161B21] border border-stone-800 rounded-xl p-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-400" />
            Registro de Auditoría de Moderación (`moderation_actions`)
          </h3>
          <p className="text-xs text-stone-400 mt-0.5">
            Trazabilidad inmutable de todas las intervenciones administrativas aplicadas.
          </p>
        </div>
        <button
          onClick={() => loadLogs(currentPage)}
          className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium transition"
        >
          Actualizar
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {isLoading ? (
        <div className="py-12 flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-amber-500 border-r-transparent" />
        </div>
      ) : logsData.items.length === 0 ? (
        <div className="bg-[#161B21] border border-stone-800 rounded-xl p-10 text-center space-y-2">
          <FileText className="w-8 h-8 text-stone-600 mx-auto" />
          <h4 className="text-sm font-semibold text-white">Sin registros de auditoría</h4>
          <p className="text-xs text-stone-400 max-w-sm mx-auto">
            Aún no se han ejecutado intervenciones de moderación.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {logsData.items.map((log) => (
            <div
              key={log.id}
              className="bg-[#161B21] border border-stone-800/90 rounded-xl p-3.5 space-y-2 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-amber-400" />
                    @{log.admin_username || 'admin'}
                  </span>

                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700">
                    {formatActionName(log.action)}
                  </span>

                  <span className="flex items-center gap-1 text-[10px] font-mono text-stone-400">
                    {log.target_type === 'dynamo' ? (
                      <>
                        <Zap className="w-3 h-3 text-amber-400" />
                        Dynamo #{log.target_id.slice(0, 8)}
                      </>
                    ) : log.target_type === 'reply' ? (
                      <>
                        <MessageCircle className="w-3 h-3 text-sky-400" />
                        Respuesta #{log.target_id.slice(0, 8)}
                      </>
                    ) : (
                      <>
                        <User className="w-3 h-3 text-orange-400" />
                        Usuario #{log.target_id.slice(0, 8)}
                      </>
                    )}
                  </span>
                </div>

                <span className="text-[11px] font-mono text-stone-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(log.created_at).toLocaleString('es-ES', {
                    dateStyle: 'short',
                    timeStyle: 'medium',
                  })}
                </span>
              </div>

              {log.reason && (
                <div className="bg-[#0E1216] rounded-lg p-2 text-stone-300 border border-stone-800/80 italic">
                  Motivo: "{log.reason}"
                </div>
              )}
            </div>
          ))}

          {/* Strict Pagination */}
          <div className="flex items-center justify-between bg-[#161B21] border border-stone-800 rounded-xl px-4 py-3 text-xs text-stone-400">
            <div>
              Total: <span className="text-white font-mono">{logsData.total}</span> acciones
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => loadLogs(currentPage - 1)}
                disabled={currentPage <= 1 || isLoading}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-800 text-stone-200 hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Anterior
              </button>

              <span className="px-2 font-mono text-stone-300">
                {logsData.page} / {logsData.totalPages}
              </span>

              <button
                onClick={() => loadLogs(currentPage + 1)}
                disabled={currentPage >= logsData.totalPages || isLoading}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-800 text-stone-200 hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Siguiente
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
