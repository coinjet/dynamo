import React, { useState, useEffect } from 'react';
import { Profile } from '@/src/modules/profiles/profilesTypes';
import { useAuth } from '@/src/modules/auth/AuthContext';
import { relationshipsService } from '@/src/modules/relationships/relationshipsService';
import { UserRelationshipState } from '@/src/modules/relationships/relationshipsTypes';
import {
  UserCheck,
  UserPlus,
  Users,
  ShieldAlert,
  VolumeX,
  Volume2,
  Calendar,
  X,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { ProfileBadgesSection } from '../badges/ProfileBadgesSection';

interface UserProfileModalProps {
  targetProfile: Profile | null;
  isOpen: boolean;
  onClose: () => void;
  onRelationshipChanged?: () => void;
  onOpenAuth?: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  targetProfile,
  isOpen,
  onClose,
  onRelationshipChanged,
  onOpenAuth,
}) => {
  const { user } = useAuth();

  const [relState, setRelState] = useState<UserRelationshipState>({
    isFollowing: false,
    isFollower: false,
    isFriend: false,
    isBlocked: false,
    isBlockedBy: false,
    isMuted: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'block' | 'unblock' | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  const isSelf = Boolean(user && targetProfile && user.id === targetProfile.id);

  // Load relationships state when modal opens
  useEffect(() => {
    if (!isOpen || !targetProfile || !user || isSelf) {
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setFeedback(null);
    setConfirmAction(null);

    relationshipsService
      .getRelationshipState(user.id, targetProfile.id)
      .then((state) => {
        if (isMounted) {
          setRelState(state);
        }
      })
      .catch((err) => {
        console.error('Error loading relationship state:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, targetProfile, user, isSelf]);

  if (!isOpen || !targetProfile) return null;

  const registrationDate = targetProfile.created_at
    ? new Date(targetProfile.created_at).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Desconocida';

  // FOLLOW / UNFOLLOW HANDLER
  const handleToggleFollow = async () => {
    if (!user) {
      onOpenAuth?.();
      return;
    }
    if (isSelf) return;

    if (relState.isBlocked || relState.isBlockedBy) {
      setFeedback({
        type: 'error',
        message: 'No es posible seguir a este usuario debido a un bloqueo activo.',
      });
      return;
    }

    setActionLoading('follow');
    setFeedback(null);

    try {
      if (relState.isFollowing) {
        await relationshipsService.unfollow(user.id, targetProfile.id);
        setRelState((prev) => ({
          ...prev,
          isFollowing: false,
          isFriend: false,
        }));
      } else {
        await relationshipsService.follow(user.id, targetProfile.id);
        const willBeFriends = relState.isFollower;
        setRelState((prev) => ({
          ...prev,
          isFollowing: true,
          isFriend: willBeFriends,
        }));
      }
      onRelationshipChanged?.();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error al actualizar el seguimiento.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  // BLOCK HANDLER (Requires confirmation)
  const handleExecuteBlock = async () => {
    if (!user || isSelf) return;

    setActionLoading('block');
    setFeedback(null);

    try {
      if (relState.isBlocked) {
        await relationshipsService.unblockUser(user.id, targetProfile.id);
        setRelState((prev) => ({
          ...prev,
          isBlocked: false,
        }));
        setConfirmAction(null);
        setFeedback({
          type: 'success',
          message: `@${targetProfile.username} ha sido desbloqueado.`,
        });
      } else {
        await relationshipsService.blockUser(user.id, targetProfile.id);
        setRelState((prev) => ({
          ...prev,
          isBlocked: true,
          isFollowing: false,
          isFollower: false,
          isFriend: false,
        }));
        setConfirmAction(null);
        setFeedback({
          type: 'success',
          message: `@${targetProfile.username} ha sido bloqueado. Sus publicaciones no aparecerán en tu feed.`,
        });
      }
      onRelationshipChanged?.();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error al procesar el bloqueo.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  // MUTE / UNMUTE HANDLER (Immediate UI update, silent for muted user)
  const handleToggleMute = async () => {
    if (!user || isSelf) return;

    setActionLoading('mute');
    setFeedback(null);

    try {
      if (relState.isMuted) {
        await relationshipsService.unmuteUser(user.id, targetProfile.id);
        setRelState((prev) => ({
          ...prev,
          isMuted: false,
        }));
        setFeedback({
          type: 'success',
          message: `Dejaste de silenciar a @${targetProfile.username}.`,
        });
      } else {
        await relationshipsService.muteUser(user.id, targetProfile.id);
        setRelState((prev) => ({
          ...prev,
          isMuted: true,
        }));
        setFeedback({
          type: 'success',
          message: `@${targetProfile.username} ha sido silenciado. Sus Dynamos no aparecerán en tu feed.`,
        });
      }
      onRelationshipChanged?.();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error al cambiar estado de silencio.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        id={`profile-modal-${targetProfile.id}`}
        className="w-full max-w-md rounded-2xl border border-[#232B35] bg-[#12161A] p-6 shadow-2xl relative overflow-hidden"
      >
        {/* Top Close Button */}
        <button
          id="btn-close-user-profile-modal"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Profile Details Header */}
        <div className="flex items-start gap-4 mb-4">
          {targetProfile.avatar ? (
            <img
              src={targetProfile.avatar}
              alt={targetProfile.username}
              referrerPolicy="no-referrer"
              className="h-16 w-16 rounded-full object-cover border-2 border-amber-500/50 shadow-md shrink-0"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1C232B] text-2xl font-black text-amber-400 border border-stone-800 shrink-0">
              {targetProfile.username?.[0]?.toUpperCase() || 'U'}
            </div>
          )}

          <div className="min-w-0 flex-1 pt-1">
            <h2 className="text-xl font-bold text-white tracking-tight truncate">
              @{targetProfile.username}
            </h2>

            {/* Friend / Relationship status pill */}
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {relState.isFriend ? (
                <span
                  id="badge-relationship-friends"
                  className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                >
                  <Users className="w-3 h-3 text-emerald-400" />
                  <span>Amigos</span>
                </span>
              ) : relState.isFollowing ? (
                <span
                  id="badge-relationship-following"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30"
                >
                  <UserCheck className="w-3 h-3" />
                  <span>Siguiendo</span>
                </span>
              ) : null}

              {relState.isBlocked && (
                <span
                  id="badge-relationship-blocked"
                  className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40"
                >
                  <ShieldAlert className="w-3 h-3" />
                  <span>Bloqueado</span>
                </span>
              )}

              {relState.isMuted && (
                <span
                  id="badge-relationship-muted"
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700"
                >
                  <VolumeX className="w-3 h-3" />
                  <span>Silenciado</span>
                </span>
              )}
            </div>

            <p className="text-xs text-stone-400 flex items-center gap-1.5 mt-2 font-normal">
              <Calendar className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              <span>Miembro desde {registrationDate}</span>
            </p>
          </div>
        </div>

        {/* Bio */}
        <div className="mb-4 rounded-xl bg-[#0D1013] border border-[#1C2229] p-3.5">
          <h4 className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1.5">
            Biografía
          </h4>
          <p className="text-xs sm:text-sm text-stone-200 leading-relaxed break-words">
            {targetProfile.bio || (
              <span className="text-stone-500 italic">Sin biografía disponible.</span>
            )}
          </p>
        </div>

        {/* Badges Section */}
        <div className="mb-5">
          <ProfileBadgesSection
            userId={targetProfile.id}
            username={targetProfile.username}
          />
        </div>

        {/* Feedback message banner */}
        {feedback && (
          <div
            className={`mb-4 rounded-xl p-3 text-xs flex items-start gap-2 ${
              feedback.type === 'error'
                ? 'bg-red-950/40 text-red-300 border border-red-800/60'
                : 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/60'
            }`}
          >
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Block Confirmation Dialog */}
        {confirmAction && (
          <div className="mb-4 rounded-xl border border-red-500/40 bg-red-950/20 p-4">
            <div className="flex items-start gap-2.5 text-red-300 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-red-200">
                  {confirmAction === 'block'
                    ? `¿Confirmas que deseas bloquear a @${targetProfile.username}?`
                    : `¿Deseas desbloquear a @${targetProfile.username}?`}
                </p>
                <p className="text-red-300/80 leading-normal">
                  {confirmAction === 'block'
                    ? 'Al bloquearlo, no verás sus publicaciones en ningún feed ni él verá las tuyas. Se eliminarán los seguimientos mutuos.'
                    : 'Al desbloquearlo, podrán volver a ver sus publicaciones públicas según las reglas de visibilidad.'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-red-900/40">
              <button
                id="btn-cancel-confirm-block"
                onClick={() => setConfirmAction(null)}
                disabled={Boolean(actionLoading)}
                className="px-3 py-1.5 rounded-lg text-xs text-stone-300 hover:text-white hover:bg-stone-800/60 transition"
              >
                Cancelar
              </button>
              <button
                id="btn-execute-confirm-block"
                onClick={handleExecuteBlock}
                disabled={Boolean(actionLoading)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold text-white transition flex items-center gap-1.5 ${
                  confirmAction === 'block'
                    ? 'bg-red-600 hover:bg-red-500'
                    : 'bg-amber-600 hover:bg-amber-500'
                }`}
              >
                {actionLoading === 'block' && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>
                  {confirmAction === 'block' ? 'Confirmar Bloqueo' : 'Confirmar Desbloqueo'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Action Controls for Other Users */}
        {!isSelf && user && (
          <div className="space-y-3 pt-2 border-t border-[#1C2229]">
            {/* Row 1: Follow / Unfollow / Amigos button */}
            {!relState.isBlocked && (
              <button
                id="btn-toggle-follow"
                onClick={handleToggleFollow}
                disabled={Boolean(actionLoading) || isLoading}
                className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition shadow-sm active:scale-98 ${
                  relState.isFriend
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                    : relState.isFollowing
                    ? 'bg-[#182028] text-stone-200 border border-[#2D3748] hover:border-red-500/40 hover:text-red-400'
                    : 'bg-amber-500 text-black hover:bg-amber-400'
                }`}
              >
                {actionLoading === 'follow' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : relState.isFriend ? (
                  <>
                    <Users className="w-4 h-4 text-emerald-400" />
                    <span>Amigos (Dejar de seguir)</span>
                  </>
                ) : relState.isFollowing ? (
                  <>
                    <UserCheck className="w-4 h-4 text-amber-400" />
                    <span>Siguiendo (Dejar de seguir)</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Seguir</span>
                  </>
                )}
              </button>
            )}

            {/* Row 2: Secondary relations (Silenciar & Bloquear) */}
            <div className="grid grid-cols-2 gap-2">
              {/* Mute button */}
              <button
                id="btn-toggle-mute"
                onClick={handleToggleMute}
                disabled={Boolean(actionLoading) || isLoading}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-medium transition ${
                  relState.isMuted
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                    : 'border-stone-800 bg-[#141A20] text-stone-300 hover:border-stone-700 hover:text-white'
                }`}
              >
                {actionLoading === 'mute' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : relState.isMuted ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Dejar de silenciar</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-stone-400" />
                    <span>Silenciar</span>
                  </>
                )}
              </button>

              {/* Block button (opens confirmation) */}
              <button
                id="btn-toggle-block"
                onClick={() => setConfirmAction(relState.isBlocked ? 'unblock' : 'block')}
                disabled={Boolean(actionLoading) || isLoading}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-medium transition ${
                  relState.isBlocked
                    ? 'border-red-500/40 bg-red-950/20 text-red-300 hover:bg-red-950/30'
                    : 'border-stone-800 bg-[#141A20] text-stone-400 hover:border-red-900/50 hover:text-red-400'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>{relState.isBlocked ? 'Desbloquear' : 'Bloquear'}</span>
              </button>
            </div>
          </div>
        )}

        {/* If user is not authenticated */}
        {!user && (
          <div className="pt-3 border-t border-[#1C2229] text-center">
            <p className="text-xs text-stone-400 mb-2">
              Inicia sesión para seguir, silenciar o interactuar con este perfil.
            </p>
            <button
              id="btn-modal-login-prompt"
              onClick={() => {
                onClose();
                onOpenAuth?.();
              }}
              className="w-full py-2 rounded-xl bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 transition"
            >
              Iniciar Sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
