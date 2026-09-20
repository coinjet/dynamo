import React from 'react';
import { AdminDashboardStats } from '@/src/modules/admin/adminTypes';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  ShieldAlert,
  Slash,
  UserX,
  FileText,
  Lock,
  Users,
  Zap,
  MessageSquare,
  Image,
  Layers,
  Sliders,
  AlertOctagon,
} from 'lucide-react';

interface AdminDashboardProps {
  stats: AdminDashboardStats | null;
  isLoading: boolean;
  onNavigateTab: (
    tab:
      | 'reports'
      | 'users'
      | 'audit'
      | 'communications'
      | 'multimedia'
      | 'advertising'
      | 'config'
      | 'emergency',
    filter?: string
  ) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  stats,
  isLoading,
  onNavigateTab,
}) => {
  if (isLoading) {
    return (
      <div className="py-12 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-amber-500 border-r-transparent" />
      </div>
    );
  }

  const s = stats || {
    pending_reports: 0,
    reviewed_reports: 0,
    resolved_reports: 0,
    dismissed_reports: 0,
    suspended_users: 0,
    banned_users: 0,
    hidden_dynamos: 0,
    hidden_replies: 0,
    hidden_content: 0,
    total_reports: 0,
    total_users: 0,
    active_dynamos: 0,
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Total Users */}
        <div
          id="stat-total-users"
          onClick={() => onNavigateTab('users')}
          className="bg-[#161B21] border border-stone-800 rounded-xl p-4 cursor-pointer hover:border-amber-500/40 hover:bg-[#1a2128] transition group shadow-sm"
        >
          <div className="flex items-center justify-between text-xs text-stone-400 font-medium mb-2">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-amber-400" />
              Total Usuarios
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-white group-hover:text-amber-400 transition">
            {s.total_users ?? 0}
          </div>
          <p className="text-[11px] text-stone-500 mt-1">Cuentas registradas</p>
        </div>

        {/* Active Dynamos */}
        <div
          id="stat-active-dynamos"
          onClick={() => onNavigateTab('reports')}
          className="bg-[#161B21] border border-stone-800 rounded-xl p-4 cursor-pointer hover:border-amber-500/40 hover:bg-[#1a2128] transition group shadow-sm"
        >
          <div className="flex items-center justify-between text-xs text-stone-400 font-medium mb-2">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Dynamos Activos
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-white group-hover:text-amber-400 transition">
            {s.active_dynamos ?? 0}
          </div>
          <p className="text-[11px] text-stone-500 mt-1">Publicaciones en vida</p>
        </div>

        {/* Pending Reports */}
        <div
          id="stat-pending-reports"
          onClick={() => onNavigateTab('reports', 'pending')}
          className="bg-[#161B21] border border-amber-500/30 rounded-xl p-4 cursor-pointer hover:border-amber-400 hover:bg-[#1a2128] transition group shadow-sm"
        >
          <div className="flex items-center justify-between text-xs text-amber-400 font-medium mb-2">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Pendientes
            </span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 font-bold">
              Urgente
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-white group-hover:text-amber-400 transition">
            {s.pending_reports}
          </div>
          <p className="text-[11px] text-stone-400 mt-1">Reportes esperando revisión</p>
        </div>

        {/* Reviewed Reports */}
        <div
          id="stat-reviewed-reports"
          onClick={() => onNavigateTab('reports', 'reviewed')}
          className="bg-[#161B21] border border-sky-500/30 rounded-xl p-4 cursor-pointer hover:border-sky-400 hover:bg-[#1a2128] transition group shadow-sm"
        >
          <div className="flex items-center justify-between text-xs text-sky-400 font-medium mb-2">
            <span className="flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              Revisados
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-white group-hover:text-sky-400 transition">
            {s.reviewed_reports}
          </div>
          <p className="text-[11px] text-stone-400 mt-1">En proceso de moderación</p>
        </div>

        {/* Resolved Reports */}
        <div
          id="stat-resolved-reports"
          onClick={() => onNavigateTab('reports', 'resolved')}
          className="bg-[#161B21] border border-emerald-500/30 rounded-xl p-4 cursor-pointer hover:border-emerald-400 hover:bg-[#1a2128] transition group shadow-sm"
        >
          <div className="flex items-center justify-between text-xs text-emerald-400 font-medium mb-2">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Resueltos
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-white group-hover:text-emerald-400 transition">
            {s.resolved_reports}
          </div>
          <p className="text-[11px] text-stone-400 mt-1">Acción tomada y cerrados</p>
        </div>

        {/* Dismissed Reports */}
        <div
          id="stat-dismissed-reports"
          onClick={() => onNavigateTab('reports', 'dismissed')}
          className="bg-[#161B21] border border-stone-800 rounded-xl p-4 cursor-pointer hover:border-stone-700 hover:bg-[#1a2128] transition group shadow-sm"
        >
          <div className="flex items-center justify-between text-xs text-stone-400 font-medium mb-2">
            <span className="flex items-center gap-1.5">
              <Slash className="w-3.5 h-3.5" />
              Descartados
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-stone-200 group-hover:text-white transition">
            {s.dismissed_reports}
          </div>
          <p className="text-[11px] text-stone-500 mt-1">Sin infracción o falsos</p>
        </div>

        {/* Suspended Users */}
        <div
          id="stat-suspended-users"
          onClick={() => onNavigateTab('users', 'suspended')}
          className="bg-[#161B21] border border-orange-500/30 rounded-xl p-4 cursor-pointer hover:border-orange-400 hover:bg-[#1a2128] transition group shadow-sm"
        >
          <div className="flex items-center justify-between text-xs text-orange-400 font-medium mb-2">
            <span className="flex items-center gap-1.5">
              <UserX className="w-3.5 h-3.5" />
              Suspendidos
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-white group-hover:text-orange-400 transition">
            {s.suspended_users}
          </div>
          <p className="text-[11px] text-stone-400 mt-1">Cuentas con sanción temporal</p>
        </div>

        {/* Banned Users */}
        <div
          id="stat-banned-users"
          onClick={() => onNavigateTab('users', 'banned')}
          className="bg-[#161B21] border border-red-500/30 rounded-xl p-4 cursor-pointer hover:border-red-400 hover:bg-[#1a2128] transition group shadow-sm"
        >
          <div className="flex items-center justify-between text-xs text-red-400 font-medium mb-2">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              Bloqueados / Baneados
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-white group-hover:text-red-400 transition">
            {s.banned_users}
          </div>
          <p className="text-[11px] text-stone-400 mt-1">Expulsión permanente</p>
        </div>

        {/* Hidden Content */}
        <div
          id="stat-hidden-content"
          onClick={() => onNavigateTab('reports', 'all')}
          className="bg-[#161B21] border border-purple-500/30 rounded-xl p-4 cursor-pointer hover:border-purple-400 hover:bg-[#1a2128] transition group shadow-sm"
        >
          <div className="flex items-center justify-between text-xs text-purple-400 font-medium mb-2">
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Contenido Ocultado
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-white group-hover:text-purple-400 transition">
            {s.hidden_content}
          </div>
          <p className="text-[11px] text-stone-400 mt-1">
            {s.hidden_dynamos} Dynamos · {s.hidden_replies} Respuestas
          </p>
        </div>

        {/* Total Reports */}
        <div
          id="stat-total-reports"
          onClick={() => onNavigateTab('reports', 'all')}
          className="bg-[#161B21] border border-stone-800 rounded-xl p-4 cursor-pointer hover:border-stone-700 hover:bg-[#1a2128] transition group shadow-sm"
        >
          <div className="flex items-center justify-between text-xs text-stone-400 font-medium mb-2">
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Total Reportes
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-stone-200 group-hover:text-white transition">
            {s.total_reports}
          </div>
          <p className="text-[11px] text-stone-500 mt-1">Historial global acumulado</p>
        </div>
      </div>

      {/* Quick Access Matrix */}
      <div className="bg-[#161B21] border border-stone-800 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span>Acceso Rápido a Módulos Administrativos</span>
        </h3>
        <p className="text-xs text-stone-400 leading-relaxed">
          Navega directamente a las secciones de gestión del Dashboard V1. Todas las operaciones
          sensibles exigen justificación y quedan registradas de manera inmutable en el registro de
          auditoría.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          <button
            onClick={() => onNavigateTab('reports', 'pending')}
            className="p-3 rounded-lg bg-[#101418] hover:bg-[#1b222a] border border-stone-800 text-left transition space-y-1"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
              <Clock className="w-3.5 h-3.5" />
              <span>Reportes</span>
            </div>
            <p className="text-[11px] text-stone-400">{s.pending_reports} por atender</p>
          </button>

          <button
            onClick={() => onNavigateTab('users')}
            className="p-3 rounded-lg bg-[#101418] hover:bg-[#1b222a] border border-stone-800 text-left transition space-y-1"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Users className="w-3.5 h-3.5 text-sky-400" />
              <span>Usuarios</span>
            </div>
            <p className="text-[11px] text-stone-400">Sanciones y Dynamos</p>
          </button>

          <button
            onClick={() => onNavigateTab('communications')}
            className="p-3 rounded-lg bg-[#101418] hover:bg-[#1b222a] border border-stone-800 text-left transition space-y-1"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
              <span>Comunicaciones</span>
            </div>
            <p className="text-[11px] text-stone-400">Avisos generales y directos</p>
          </button>

          <button
            onClick={() => onNavigateTab('multimedia')}
            className="p-3 rounded-lg bg-[#101418] hover:bg-[#1b222a] border border-stone-800 text-left transition space-y-1"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Image className="w-3.5 h-3.5 text-emerald-400" />
              <span>Multimedia</span>
            </div>
            <p className="text-[11px] text-stone-400">Control de imágenes</p>
          </button>

          <button
            onClick={() => onNavigateTab('advertising')}
            className="p-3 rounded-lg bg-[#101418] hover:bg-[#1b222a] border border-stone-800 text-left transition space-y-1"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>Publicidad</span>
            </div>
            <p className="text-[11px] text-stone-400">Estructura de espacios</p>
          </button>

          <button
            onClick={() => onNavigateTab('config')}
            className="p-3 rounded-lg bg-[#101418] hover:bg-[#1b222a] border border-stone-800 text-left transition space-y-1"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>Configuración</span>
            </div>
            <p className="text-[11px] text-stone-400">Switches globales</p>
          </button>

          <button
            onClick={() => onNavigateTab('audit')}
            className="p-3 rounded-lg bg-[#101418] hover:bg-[#1b222a] border border-stone-800 text-left transition space-y-1"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <FileText className="w-3.5 h-3.5 text-stone-300" />
              <span>Auditoría</span>
            </div>
            <p className="text-[11px] text-stone-400">Trazabilidad completa</p>
          </button>

          <button
            onClick={() => onNavigateTab('emergency')}
            className="p-3 rounded-lg bg-red-950/20 hover:bg-red-950/30 border border-red-500/30 text-left transition space-y-1"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-red-400">
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>Emergencia</span>
            </div>
            <p className="text-[11px] text-red-300/80">Mitigación global</p>
          </button>
        </div>
      </div>
    </div>
  );
};
