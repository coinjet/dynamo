import React from 'react';
import { PWAInstallButton } from './PWAInstallButton';
import { useAuth } from '@/src/modules/auth/AuthContext';
import { Zap, Bell, LogIn, Shield, Settings } from 'lucide-react';
import { EconomyBadge } from '../economy/EconomyBadge';

interface HeaderProps {
  onOpenAuth: () => void;
  onOpenNotifications: () => void;
  unreadCount?: number;
  onGoToProfile: () => void;
  onGoToHome: () => void;
  onGoToAdmin?: () => void;
  onGoToSettings?: () => void;
  onOpenEconomy?: () => void;
  economyRefreshTrigger?: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAuth,
  onOpenNotifications,
  unreadCount = 0,
  onGoToProfile,
  onGoToHome,
  onGoToAdmin,
  onGoToSettings,
  onOpenEconomy,
  economyRefreshTrigger = 0,
}) => {
  const { session, profile, isEmailConfirmed, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#21272E] bg-[#0E1216]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <div
          id="header-brand"
          onClick={onGoToHome}
          className="flex items-center gap-2 cursor-pointer group select-none"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-black shadow-sm group-hover:scale-105 transition-transform">
            <Zap className="h-4 w-4 fill-black stroke-black" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
              DYNAMO
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                PWA
              </span>
            </span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2.5">
          <PWAInstallButton />

          {session ? (
            !isEmailConfirmed ? (
              <button
                id="btn-header-signout-unconfirmed"
                onClick={signOut}
                className="text-xs px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 font-medium transition cursor-pointer"
              >
                Cerrar sesión
              </button>
            ) : (
              <>
                {profile && (profile.role === 'admin' || profile.role === 'moderator') && onGoToAdmin && (
                <button
                  id="btn-header-admin"
                  onClick={onGoToAdmin}
                  className="relative p-2 rounded-full text-amber-400 hover:text-white hover:bg-stone-800/60 transition cursor-pointer"
                  title="Panel de Administración (/admin)"
                >
                  <Shield className="w-4 h-4" />
                </button>
              )}

              {onOpenEconomy && (
                <EconomyBadge
                  userId={session.user.id}
                  onClick={onOpenEconomy}
                  refreshTrigger={economyRefreshTrigger}
                />
              )}

              <button
                id="btn-notifications"
                onClick={onOpenNotifications}
                className="relative p-2 rounded-full text-stone-300 hover:text-white hover:bg-stone-800/60 transition cursor-pointer"
                title="Notificaciones"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span
                    id="header-unread-count-badge"
                    className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-black text-[10px] font-bold font-mono flex items-center justify-center shadow-xs"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {onGoToSettings && (
                <button
                  id="btn-header-settings"
                  onClick={onGoToSettings}
                  className="relative p-2 rounded-full text-stone-300 hover:text-white hover:bg-stone-800/60 transition cursor-pointer"
                  title="Configuración y Privacidad (/settings)"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}

              <button
                id="btn-avatar-profile"
                onClick={onGoToProfile}
                className="flex items-center gap-2 pl-1 group"
              >
                {profile?.avatar ? (
                  <img
                    src={profile.avatar}
                    alt={profile.username}
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-full object-cover border border-amber-500/40 group-hover:border-amber-400 transition"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center text-xs font-semibold text-amber-400">
                    {profile?.username?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
              </button>
            </>
            )
          ) : (
            <button
              id="btn-open-login"
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 rounded-full bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-amber-400 transition active:scale-95"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Entrar</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
