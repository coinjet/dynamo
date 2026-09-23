import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/modules/auth/AuthContext';
import { EditProfileModal } from './EditProfileModal';
import { Profile } from '@/src/modules/profiles/profilesTypes';
import { relationshipsService } from '@/src/modules/relationships/relationshipsService';
import { UserRelationshipState } from '@/src/modules/relationships/relationshipsTypes';
import { ProfileBadgesSection } from '../badges/ProfileBadgesSection';
import {
  LogOut,
  Calendar,
  ShieldCheck,
  Edit3,
  Lock,
  UserPlus,
  UserCheck,
  Users,
  ShieldAlert,
  Volume2,
  VolumeX,
  AlertTriangle,
  Loader2,
  Settings,
  Share2,
} from 'lucide-react';

interface ProfileViewProps {
  customProfile?: Profile;
  onOpenAuth?: () => void;
  onRelationshipChanged?: () => void;
  onGoToSettings?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  customProfile,
  onOpenAuth,
  onRelationshipChanged,
  onGoToSettings,
}) => {
  const { profile: myProfile, signOut, user } = useAuth();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // If viewing own profile vs another profile
  const displayedProfile = customProfile || myProfile;
  const isOwnProfile = Boolean(
    myProfile && displayedProfile && myProfile.id === displayedProfile.id
  );

  // Relationship state if viewing another user
  const [relState, setRelState] = useState<UserRelationshipState>({
    isFollowing: false,
    isFollower: false,
    isFriend: false,
    isBlocked: false,
    isBlockedBy: false,
    isMuted: false,
  });

  const [isLoadingRel, setIsLoadingRel] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmBlock, setConfirmBlock] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  const [copiedProfile, setCopiedProfile] = useState(false);

  const handleShareProfile = async () => {
    if (!displayedProfile?.username) return;
    const profileUrl = `${window.location.origin}/@${displayedProfile.username}`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Perfil de @${displayedProfile.username} en Dynamo`,
          text: displayedProfile.bio || `Perfil de @${displayedProfile.username} en Dynamo`,
          url: profileUrl,
        });
        setFeedback({ type: 'success', message: '✓ Enlace de perfil compartido' });
        setTimeout(() => setFeedback(null), 2500);
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(profileUrl);
        setCopiedProfile(true);
        setFeedback({ type: 'success', message: '✓ Enlace copiado al portapapeles' });
        setTimeout(() => {
          setCopiedProfile(false);
          setFeedback(null);
        }, 2000);
      }
    } catch (clipboardErr) {
      console.warn('Clipboard writeText failed:', clipboardErr);
    }
  };

  // Load relation state when viewing another user's profile
  useEffect(() => {
    if (isOwnProfile || !user || !displayedProfile) return;

    let isMounted = true;
    setIsLoadingRel(true);
    setFeedback(null);
    setConfirmBlock(false);

    relationshipsService
      .getRelationshipState(user.id, displayedProfile.id)
      .then((state) => {
        if (isMounted) setRelState(state);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (isMounted) setIsLoadingRel(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOwnProfile, user?.id, displayedProfile?.id]);

  if (!displayedProfile) return null;

  const registrationDate = new Date(displayedProfile.created_at).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Action: Follow / Unfollow
  const handleToggleFollow = async () => {
    if (!user) {
      onOpenAuth?.();
      return;
    }
    if (isOwnProfile) return;

    if (relState.isBlocked || relState.isBlockedBy) {
      setFeedback({
        type: 'error',
        message: 'No es posible seguir a un usuario bloqueado.',
      });
      return;
    }

    setActionLoading('follow');
    setFeedback(null);

    try {
      if (relState.isFollowing) {
        await relationshipsService.unfollow(user.id, displayedProfile.id);
        setRelState((prev) => ({
          ...prev,
          isFollowing: false,
          isFriend: false,
        }));
      } else {
        await relationshipsService.follow(user.id, displayedProfile.id);
        const isNowFriend = relState.isFollower;
        setRelState((prev) => ({
          ...prev,
          isFollowing: true,
          isFriend: isNowFriend,
        }));
      }
      onRelationshipChanged?.();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error al actualizar seguimiento.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Action: Block / Unblock
  const handleExecuteBlock = async () => {
    if (!user || isOwnProfile) return;

    setActionLoading('block');
    setFeedback(null);

    try {
      if (relState.isBlocked) {
        await relationshipsService.unblockUser(user.id, displayedProfile.id);
        setRelState((prev) => ({
          ...prev,
          isBlocked: false,
        }));
        setConfirmBlock(false);
        setFeedback({
          type: 'success',
          message: `@${displayedProfile.username} ha sido desbloqueado.`,
        });
      } else {
        await relationshipsService.blockUser(user.id, displayedProfile.id);
        setRelState((prev) => ({
          ...prev,
          isBlocked: true,
          isFollowing: false,
          isFollower: false,
          isFriend: false,
        }));
        setConfirmBlock(false);
        setFeedback({
          type: 'success',
          message: `@${displayedProfile.username} ha sido bloqueado. Sus Dynamos no aparecerán en tu feed.`,
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

  // Action: Mute / Unmute
  const handleToggleMute = async () => {
    if (!user || isOwnProfile) return;

    setActionLoading('mute');
    setFeedback(null);

    try {
      if (relState.isMuted) {
        await relationshipsService.unmuteUser(user.id, displayedProfile.id);
        setRelState((prev) => ({
          ...prev,
          isMuted: false,
        }));
        setFeedback({
          type: 'success',
          message: `Dejaste de silenciar a @${displayedProfile.username}.`,
        });
      } else {
        await relationshipsService.muteUser(user.id, displayedProfile.id);
        setRelState((prev) => ({
          ...prev,
          isMuted: true,
        }));
        setFeedback({
          type: 'success',
          message: `@${displayedProfile.username} ha sido silenciado. No verás sus publicaciones en tu feed.`,
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
    <div className="space-y-6">
      {/* Profile Card */}
      <div className="rounded-2xl border border-[#21272E] bg-[#12161A] p-5 sm:p-7 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 pb-6 border-b border-[#1C2229]">
          <div className="flex items-center gap-4">
            {displayedProfile.avatar ? (
              <img
                src={displayedProfile.avatar}
                alt={displayedProfile.username}
                referrerPolicy="no-referrer"
                className="h-16 w-16 sm:h-20 sm:w-20 rounded-full object-cover border-2 border-amber-500/60 shadow-md"
              />
            ) : (
              <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-[#1C232B] text-2xl font-extrabold text-amber-400 border border-stone-800">
                {displayedProfile.username?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  @{displayedProfile.username}
                </h1>

                {/* Relationship status pills */}
                {!isOwnProfile && (
                  <>
                    {relState.isFriend ? (
                      <span
                        id="profile-view-badge-friends"
                        className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold"
                      >
                        <Users className="w-3 h-3 text-emerald-400" />
                        <span>Amigos</span>
                      </span>
                    ) : relState.isFollowing ? (
                      <span
                        id="profile-view-badge-following"
                        className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold"
                      >
                        <UserCheck className="w-3 h-3" />
                        <span>Siguiendo</span>
                      </span>
                    ) : null}

                    {relState.isBlocked && (
                      <span
                        id="profile-view-badge-blocked"
                        className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 font-medium"
                      >
                        <ShieldAlert className="w-3 h-3" />
                        <span>Bloqueado</span>
                      </span>
                    )}

                    {relState.isMuted && (
                      <span
                        id="profile-view-badge-muted"
                        className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700 font-medium"
                      >
                        <VolumeX className="w-3 h-3" />
                        <span>Silenciado</span>
                      </span>
                    )}
                  </>
                )}

                {isOwnProfile && (
                  <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-medium">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Tu cuenta</span>
                  </span>
                )}
              </div>

              <p className="text-xs text-stone-400 flex items-center gap-1.5 mt-1.5 font-normal">
                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                <span>Miembro desde {registrationDate}</span>
              </p>
            </div>
          </div>

          {/* Action buttons (Own profile: Edit / Logout; Other profile: Seguir / Bloquear / Silenciar) */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {isOwnProfile ? (
              <>
                <button
                  id="btn-open-edit-profile"
                  onClick={() => setIsEditModalOpen(true)}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 active:scale-95 transition shadow-sm"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Editar Perfil</span>
                </button>

                <button
                  id="btn-profile-share-own"
                  onClick={handleShareProfile}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-stone-800 bg-[#161D24] text-stone-300 hover:text-white hover:border-stone-700 text-xs font-semibold transition cursor-pointer"
                  title="Compartir perfil"
                >
                  <Share2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>{copiedProfile ? 'Copiado' : 'Compartir'}</span>
                </button>

                {onGoToSettings && (
                  <button
                    id="btn-profile-settings"
                    onClick={onGoToSettings}
                    className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-stone-800 bg-[#161D24] text-stone-300 hover:text-white hover:border-stone-700 text-xs font-semibold transition"
                    title="Configuración y Privacidad"
                  >
                    <Settings className="w-3.5 h-3.5 text-amber-400" />
                    <span>Configuración</span>
                  </button>
                )}

                <button
                  id="btn-profile-logout"
                  onClick={() => signOut()}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-stone-800 text-stone-400 hover:text-red-400 hover:border-red-500/30 transition text-xs font-medium"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Cerrar Sesión</span>
                </button>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                {/* Seguir / Siguiendo / Amigos button */}
                {!relState.isBlocked && (
                  <button
                    id="btn-profile-view-follow"
                    onClick={handleToggleFollow}
                    disabled={Boolean(actionLoading) || isLoadingRel}
                    className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm active:scale-95 ${
                      relState.isFriend
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                        : relState.isFollowing
                        ? 'bg-[#182028] text-stone-200 border border-[#2D3748] hover:border-red-500/40 hover:text-red-400'
                        : 'bg-amber-500 text-black hover:bg-amber-400'
                    }`}
                  >
                    {actionLoading === 'follow' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : relState.isFriend ? (
                      <>
                        <Users className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Amigos (Dejar de seguir)</span>
                      </>
                    ) : relState.isFollowing ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                        <span>Siguiendo (Dejar de seguir)</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Seguir</span>
                      </>
                    )}
                  </button>
                )}

                {/* Silenciar / Dejar de silenciar */}
                <button
                  id="btn-profile-view-mute"
                  onClick={handleToggleMute}
                  disabled={Boolean(actionLoading) || isLoadingRel}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition ${
                    relState.isMuted
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                      : 'border-stone-800 bg-[#141A20] text-stone-300 hover:border-stone-700 hover:text-white'
                  }`}
                  title={relState.isMuted ? 'Dejar de silenciar' : 'Silenciar'}
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

                {/* Compartir Perfil */}
                <button
                  id="btn-profile-share-other"
                  onClick={handleShareProfile}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-stone-800 bg-[#141A20] text-stone-300 hover:text-white hover:border-stone-700 text-xs font-semibold transition cursor-pointer"
                  title="Compartir perfil (@...)"
                >
                  <Share2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>{copiedProfile ? 'Copiado' : 'Compartir'}</span>
                </button>

                {/* Bloquear / Desbloquear */}
                <button
                  id="btn-profile-view-block"
                  onClick={() => setConfirmBlock(true)}
                  disabled={Boolean(actionLoading) || isLoadingRel}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition ${
                    relState.isBlocked
                      ? 'border-red-500/40 bg-red-950/20 text-red-300 hover:bg-red-950/30'
                      : 'border-stone-800 bg-[#141A20] text-stone-400 hover:border-red-900/50 hover:text-red-400'
                  }`}
                  title={relState.isBlocked ? 'Desbloquear' : 'Bloquear'}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>{relState.isBlocked ? 'Desbloquear' : 'Bloquear'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Feedback Message */}
        {feedback && (
          <div
            className={`mt-4 rounded-xl p-3 text-xs flex items-start gap-2 ${
              feedback.type === 'error'
                ? 'bg-red-950/40 text-red-300 border border-red-800/60'
                : 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/60'
            }`}
          >
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Confirmation modal for blocking */}
        {confirmBlock && (
          <div className="mt-4 rounded-xl border border-red-500/40 bg-red-950/20 p-4">
            <div className="flex items-start gap-2.5 text-red-300 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-red-200">
                  {relState.isBlocked
                    ? `¿Deseas desbloquear a @${displayedProfile.username}?`
                    : `¿Confirmas que deseas bloquear a @${displayedProfile.username}?`}
                </p>
                <p className="text-red-300/80 leading-normal">
                  {relState.isBlocked
                    ? 'Al desbloquearlo, podrán volver a ver sus publicaciones públicas según las reglas de visibilidad.'
                    : 'Al bloquearlo, no verás sus publicaciones en ningún feed ni él verá las tuyas. Se eliminarán los seguimientos mutuos.'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-red-900/40">
              <button
                onClick={() => setConfirmBlock(false)}
                disabled={Boolean(actionLoading)}
                className="px-3 py-1.5 rounded-lg text-xs text-stone-300 hover:text-white hover:bg-stone-800/60 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleExecuteBlock}
                disabled={Boolean(actionLoading)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold text-white transition flex items-center gap-1.5 ${
                  relState.isBlocked ? 'bg-amber-600 hover:bg-amber-500' : 'bg-red-600 hover:bg-red-500'
                }`}
              >
                {actionLoading === 'block' && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>{relState.isBlocked ? 'Confirmar Desbloqueo' : 'Confirmar Bloqueo'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Bio Section */}
        <div className="pt-5 pb-2">
          <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
            Biografía
          </h4>
          <p className="text-sm text-stone-200 leading-relaxed max-w-2xl break-words">
            {displayedProfile.bio || (
              <span className="text-stone-400 italic">
                Sin biografía todavía.{' '}
                {isOwnProfile && 'Haz clic en "Editar Perfil" para agregar una presentación breve.'}
              </span>
            )}
          </p>
        </div>

        {/* Badges & Achievements Section */}
        <div className="pt-2 pb-2">
          <ProfileBadgesSection
            userId={displayedProfile.id}
            username={displayedProfile.username}
          />
        </div>

        {/* Privacy Note Badge */}
        {isOwnProfile && (
          <div className="mt-4 pt-4 border-t border-[#1C2229] flex items-center gap-2 text-[11px] text-stone-400">
            <Lock className="w-3.5 h-3.5 text-amber-500/70 shrink-0" />
            <span>
              Tu correo electrónico y datos privados se encuentran protegidos y nunca se exhiben en el perfil público.
            </span>
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {isOwnProfile && (
        <EditProfileModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
        />
      )}
    </div>
  );
};
