import React from 'react';
import {
  X,
  Bell,
  Zap,
  MessageSquare,
  UserPlus,
  Clock,
  CheckCheck,
  Check,
  ExternalLink,
} from 'lucide-react';
import { Notification } from '@/src/modules/notifications/notificationsTypes';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onMarkAllRead: () => void;
  onMarkAsRead: (notificationId: string) => void;
  onNavigateContext: (notification: Notification) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
  onMarkAsRead,
  onNavigateContext,
}) => {
  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'gift':
        return <Zap className="w-4 h-4 fill-amber-400 text-amber-400" />;
      case 'reply':
        return <MessageSquare className="w-4 h-4 text-sky-400" />;
      case 'follow':
        return <UserPlus className="w-4 h-4 text-emerald-400" />;
      case 'expiring':
        return <Clock className="w-4 h-4 text-orange-400 animate-pulse" />;
      default:
        return <Bell className="w-4 h-4 text-amber-400" />;
    }
  };

  const getActionLabel = (type: string) => {
    switch (type) {
      case 'gift':
        return 'Ver Dynamo';
      case 'reply':
        return 'Ver respuesta';
      case 'follow':
        return 'Ver perfil';
      case 'expiring':
        return 'Inyectar energía';
      default:
        return 'Ver';
    }
  };

  return (
    <div
      id="modal-notifications"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-2xl border border-[#262E38] bg-[#12161A] p-4 sm:p-6 shadow-2xl text-stone-200 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-[#21272E] mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">Centro de Notificaciones</h3>
                {unreadCount > 0 && (
                  <span
                    id="badge-unread-count-modal"
                    className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500 text-black shadow-xs"
                  >
                    {unreadCount} nueva{unreadCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-400">Actividad reciente en tus publicaciones y perfil</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                id="btn-mark-all-read"
                onClick={onMarkAllRead}
                className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-stone-800/60 transition cursor-pointer"
                title="Marcar todas como leídas"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Marcar todas leídas</span>
                <span className="sm:hidden">Todas</span>
              </button>
            )}
            <button
              id="btn-close-notifications"
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Chronological List (Most recent first) */}
        <div className="space-y-2.5 overflow-y-auto pr-1 flex-1 scrollbar-thin">
          {notifications.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center gap-2">
              <div className="w-12 h-12 rounded-full bg-[#182028] border border-stone-800 flex items-center justify-center text-stone-400">
                <Bell className="w-6 h-6 opacity-40" />
              </div>
              <p className="text-sm font-semibold text-stone-300">Sin notificaciones</p>
              <p className="text-xs text-stone-400 max-w-xs leading-relaxed">
                Aquí recibirás avisos de energía ⚡, respuestas 💬, nuevos seguidores 👤 y alertas de expiración ⏳.
              </p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                id={`notification-item-${n.id}`}
                className={`relative p-3.5 rounded-xl border transition group ${
                  n.read
                    ? 'bg-[#14181D] border-stone-800/80 text-stone-400 opacity-90'
                    : 'bg-[#18212B] border-amber-500/40 text-stone-200 shadow-sm'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon badge */}
                  <div
                    className={`mt-0.5 p-2 rounded-xl shrink-0 ${
                      n.read ? 'bg-[#1C232B] text-stone-400' : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {getNotificationIcon(n.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs font-semibold truncate ${n.read ? 'text-stone-300' : 'text-white'}`}>
                        {n.title || 'Actividad en Dynamo'}
                      </p>

                      {/* Unread dot indicator */}
                      {!n.read && (
                        <span
                          id={`dot-unread-${n.id}`}
                          className="h-2 w-2 rounded-full bg-amber-400 ring-4 ring-amber-400/20 shrink-0"
                          title="No leída"
                        />
                      )}
                    </div>

                    <p className={`text-xs mt-1 leading-relaxed ${n.read ? 'text-stone-400' : 'text-stone-200'}`}>
                      {n.description || 'Nuevo evento registrado.'}
                    </p>

                    <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-stone-800/60 text-[11px]">
                      <span className="text-stone-400 font-mono">
                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>

                      <div className="flex items-center gap-2">
                        {/* Mark single as read button */}
                        {!n.read && (
                          <button
                            id={`btn-mark-read-${n.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onMarkAsRead(n.id);
                            }}
                            className="flex items-center gap-1 text-stone-400 hover:text-amber-400 transition cursor-pointer px-1.5 py-0.5 rounded hover:bg-stone-800/50"
                            title="Marcar como leída"
                          >
                            <Check className="w-3 h-3" />
                            <span>Marcar leída</span>
                          </button>
                        )}

                        {/* Navigation context action */}
                        <button
                          id={`btn-nav-context-${n.id}`}
                          onClick={() => {
                            if (!n.read) onMarkAsRead(n.id);
                            onNavigateContext(n);
                            onClose();
                          }}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                            n.read
                              ? 'bg-[#1C232B] text-stone-300 hover:text-white hover:bg-stone-800'
                              : 'bg-amber-500 text-black hover:bg-amber-400 shadow-xs'
                          }`}
                        >
                          <span>{getActionLabel(n.type)}</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
