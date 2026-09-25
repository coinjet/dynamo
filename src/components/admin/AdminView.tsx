import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/modules/auth/AuthContext';
import { adminService } from '@/src/modules/admin/adminService';
import { AdminAccessVerification, AdminDashboardStats } from '@/src/modules/admin/adminTypes';
import { AdminDashboard } from './AdminDashboard';
import { AdminReportsInbox } from './AdminReportsInbox';
import { AdminUsersView } from './AdminUsersView';
import { AdminAuditView } from './AdminAuditView';
import { AdminCommunications } from './AdminCommunications';
import { AdminMultimediaView } from './AdminMultimediaView';
import { AdminAdvertisingView } from './AdminAdvertisingView';
import { AdminConfigView } from './AdminConfigView';
import { AdminEmergencyView } from './AdminEmergencyView';
import { AdminGrowthView } from './AdminGrowthView';
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  FileText,
  LayoutDashboard,
  Shield,
  ShieldAlert,
  Users,
  Lock,
  MessageSquare,
  Image,
  Layers,
  Sliders,
  AlertOctagon,
  Scale,
  TrendingUp,
} from 'lucide-react';
import { AdminLegalView } from './AdminLegalView';

interface AdminViewProps {
  onGoToHome: () => void;
}

export type AdminTab =
  | 'dashboard'
  | 'reports'
  | 'users'
  | 'growth'
  | 'communications'
  | 'multimedia'
  | 'advertising'
  | 'config'
  | 'legal'
  | 'audit'
  | 'emergency';

export const AdminView: React.FC<AdminViewProps> = ({ onGoToHome }) => {
  const { user, profile, updateProfileState } = useAuth();
  const [access, setAccess] = useState<AdminAccessVerification | null>(null);
  const [isVerifying, setIsVerifying] = useState(true);

  // Active Admin Sub-tab
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [reportsInitialFilter, setReportsInitialFilter] = useState<string | undefined>(undefined);
  const [usersInitialFilter, setUsersInitialFilter] = useState<string | undefined>(undefined);

  // Stats State
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  const checkAccess = async () => {
    setIsVerifying(true);
    try {
      const verification = await adminService.verifyAccess(user?.id);
      setAccess(verification);
      if (verification.isAuthorized && user?.id) {
        loadStats(user.id);
      }
    } catch {
      setAccess({
        isAuthorized: false,
        role: null,
        message: 'Error al verificar permisos en el servidor.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const loadStats = async (adminId: string) => {
    setIsLoadingStats(true);
    try {
      const s = await adminService.getDashboardStats(adminId);
      setStats(s);
    } catch (err) {
      console.warn('Error loading stats:', err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    checkAccess();
  }, [user?.id]);

  const handleNavigateFromDashboard = (
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
  ) => {
    if (tab === 'reports') {
      setReportsInitialFilter(filter);
    } else if (tab === 'users') {
      setUsersInitialFilter(filter);
    }
    setActiveTab(tab);
  };

  // 1. Loading Verification State
  if (isVerifying) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="inline-flex p-3 rounded-full bg-stone-900 border border-stone-800 animate-pulse">
          <Shield className="w-8 h-8 text-amber-400" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-white">Verificando Credenciales de Acceso</h2>
          <p className="text-xs text-stone-400">
            Comprobando nivel de autorización en el servidor...
          </p>
        </div>
      </div>
    );
  }

  // 2. Unauthorized / Access Denied
  if (!access || !access.isAuthorized) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16">
        <div className="bg-[#161B21] border border-red-500/30 rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-xl">
          <div className="inline-flex p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
            <ShieldAlert className="w-10 h-10" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-white tracking-tight">
              Acceso Restringido · 403 Prohibido
            </h2>
            <p className="text-xs text-stone-400 leading-relaxed">
              {access?.message ||
                'Esta sección es exclusiva para el equipo de administración y moderación de Dynamo.'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#101418] border border-stone-800 text-left text-xs space-y-1">
            <div className="flex justify-between text-stone-400">
              <span>Usuario actual:</span>
              <span className="font-mono text-stone-200">
                {profile ? `@${profile.username}` : 'No autenticado'}
              </span>
            </div>
            <div className="flex justify-between text-stone-400">
              <span>Rol actual:</span>
              <span className="font-mono text-amber-400 uppercase">
                {profile?.role || 'user'}
              </span>
            </div>
            <div className="flex justify-between text-stone-400">
              <span>Nivel requerido:</span>
              <span className="font-mono text-stone-300">admin / moderator</span>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2.5 justify-center">
            <button
              onClick={onGoToHome}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition"
            >
              Volver al Feed Principal
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Authorized Admin Panel View
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Header & Role Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onGoToHome}
            className="p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition"
            title="Volver a Dynamo"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-400" />
                Panel de Administración
              </h1>
              <span
                className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border ${
                  access.role === 'admin'
                    ? 'bg-red-500/10 text-red-400 border-red-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}
              >
                {access.role}
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              Dashboard Administrativo V1 · Gestión, métricas, switches y auditoría inmutable.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center text-xs">
          <span className="text-stone-400">Sesión activa:</span>
          <span className="font-semibold text-white font-mono">@{access.username}</span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-stone-800 scrollbar-none text-xs">
        <button
          id="btn-admin-tab-dashboard"
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition shrink-0 ${
            activeTab === 'dashboard'
              ? 'bg-amber-500 text-black font-semibold'
              : 'text-stone-400 hover:text-white hover:bg-stone-800/60'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Dashboard</span>
        </button>

        <button
          id="btn-admin-tab-reports"
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition shrink-0 ${
            activeTab === 'reports'
              ? 'bg-amber-500 text-black font-semibold'
              : 'text-stone-400 hover:text-white hover:bg-stone-800/60'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Reportes</span>
          {stats && stats.pending_reports > 0 && (
            <span
              className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                activeTab === 'reports' ? 'bg-black text-amber-400' : 'bg-amber-500/20 text-amber-400'
              }`}
            >
              {stats.pending_reports}
            </span>
          )}
        </button>

        <button
          id="btn-admin-tab-users"
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition shrink-0 ${
            activeTab === 'users'
              ? 'bg-amber-500 text-black font-semibold'
              : 'text-stone-400 hover:text-white hover:bg-stone-800/60'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Usuarios</span>
          {stats && stats.suspended_users + stats.banned_users > 0 && (
            <span
              className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                activeTab === 'users' ? 'bg-black text-amber-400' : 'bg-orange-500/20 text-orange-400'
              }`}
            >
              {stats.suspended_users + stats.banned_users}
            </span>
          )}
        </button>

        <button
          id="btn-admin-tab-growth"
          onClick={() => setActiveTab('growth')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition shrink-0 ${
            activeTab === 'growth'
              ? 'bg-amber-500 text-black font-semibold'
              : 'text-stone-400 hover:text-white hover:bg-stone-800/60'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Invitaciones / Crecimiento</span>
        </button>

        <button
          id="btn-admin-tab-communications"
          onClick={() => setActiveTab('communications')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition shrink-0 ${
            activeTab === 'communications'
              ? 'bg-amber-500 text-black font-semibold'
              : 'text-stone-400 hover:text-white hover:bg-stone-800/60'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Comunicaciones</span>
        </button>

        <button
          id="btn-admin-tab-multimedia"
          onClick={() => setActiveTab('multimedia')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition shrink-0 ${
            activeTab === 'multimedia'
              ? 'bg-amber-500 text-black font-semibold'
              : 'text-stone-400 hover:text-white hover:bg-stone-800/60'
          }`}
        >
          <Image className="w-4 h-4" />
          <span>Multimedia</span>
        </button>

        <button
          id="btn-admin-tab-advertising"
          onClick={() => setActiveTab('advertising')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition shrink-0 ${
            activeTab === 'advertising'
              ? 'bg-amber-500 text-black font-semibold'
              : 'text-stone-400 hover:text-white hover:bg-stone-800/60'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Publicidad</span>
        </button>

        <button
          id="btn-admin-tab-config"
          onClick={() => setActiveTab('config')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition shrink-0 ${
            activeTab === 'config'
              ? 'bg-amber-500 text-black font-semibold'
              : 'text-stone-400 hover:text-white hover:bg-stone-800/60'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Configuración</span>
        </button>

        <button
          id="btn-admin-tab-legal"
          onClick={() => setActiveTab('legal')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition shrink-0 ${
            activeTab === 'legal'
              ? 'bg-amber-500 text-black font-semibold'
              : 'text-stone-400 hover:text-white hover:bg-stone-800/60'
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>Legal & Soporte</span>
        </button>

        <button
          id="btn-admin-tab-audit"
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition shrink-0 ${
            activeTab === 'audit'
              ? 'bg-amber-500 text-black font-semibold'
              : 'text-stone-400 hover:text-white hover:bg-stone-800/60'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Auditoría</span>
        </button>

        <button
          id="btn-admin-tab-emergency"
          onClick={() => setActiveTab('emergency')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition shrink-0 ${
            activeTab === 'emergency'
              ? 'bg-red-600 text-white font-bold'
              : 'text-red-400 hover:text-red-300 hover:bg-red-950/40'
          }`}
        >
          <AlertOctagon className="w-4 h-4" />
          <span>Emergencia</span>
        </button>
      </div>

      {/* Tab Content Panels */}
      <div>
        {activeTab === 'dashboard' && (
          <AdminDashboard
            stats={stats}
            isLoading={isLoadingStats}
            onNavigateTab={handleNavigateFromDashboard}
          />
        )}

        {activeTab === 'reports' && user?.id && (
          <AdminReportsInbox
            adminUserId={user.id}
            initialStatusFilter={reportsInitialFilter}
            onRefreshStats={() => loadStats(user.id)}
          />
        )}

        {activeTab === 'users' && user?.id && (
          <AdminUsersView
            adminUserId={user.id}
            currentUserRole={access.role}
            initialFilter={usersInitialFilter}
            onRefreshStats={() => loadStats(user.id)}
          />
        )}

        {activeTab === 'growth' && user?.id && (
          <AdminGrowthView adminUserId={user.id} />
        )}

        {activeTab === 'communications' && user?.id && (
          <AdminCommunications adminUserId={user.id} />
        )}

        {activeTab === 'multimedia' && user?.id && (
          <AdminMultimediaView adminUserId={user.id} />
        )}

        {activeTab === 'advertising' && user?.id && (
          <AdminAdvertisingView adminUserId={user.id} />
        )}

        {activeTab === 'config' && user?.id && (
          <AdminConfigView adminUserId={user.id} />
        )}

        {activeTab === 'legal' && user?.id && (
          <AdminLegalView adminUserId={user.id} />
        )}

        {activeTab === 'audit' && user?.id && <AdminAuditView adminUserId={user.id} />}

        {activeTab === 'emergency' && user?.id && (
          <AdminEmergencyView adminUserId={user.id} />
        )}
      </div>
    </div>
  );
};
