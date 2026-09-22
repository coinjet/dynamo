import React, { useState, useEffect } from 'react';
import { Profile } from '@/src/modules/profiles/profilesTypes';
import { profilesService } from '@/src/modules/profiles/profilesService';
import { dynamosService } from '@/src/modules/dynamos/dynamosService';
import { relationshipsService } from '@/src/modules/relationships/relationshipsService';
import { Dynamo } from '@/src/modules/dynamos/dynamosTypes';
import { ProfileView } from './ProfileView';
import { DynamoCard } from '../dynamos/DynamoCard';
import { useAuth } from '@/src/modules/auth/AuthContext';
import { ArrowLeft, AlertCircle, ShieldAlert, Loader2, Sparkles } from 'lucide-react';

interface PublicProfileViewProps {
  username: string;
  onBack: () => void;
  onOpenAuth: () => void;
  onGiftEnergy: (dynamoId: string) => Promise<any>;
  onOpenReply: (dynamo: Dynamo) => void;
  onReport?: (dynamoId: string, authorId?: string) => void;
  onDelete?: (dynamoId: string) => void;
  onSelectHashtag?: (tag: string) => void;
  onGoToSettings?: () => void;
}

export const PublicProfileView: React.FC<PublicProfileViewProps> = ({
  username,
  onBack,
  onOpenAuth,
  onGiftEnergy,
  onOpenReply,
  onReport,
  onDelete,
  onSelectHashtag,
  onGoToSettings,
}) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userDynamos, setUserDynamos] = useState<Dynamo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setNotFound(false);
    setIsBlocked(false);
    setIsSuspended(false);

    const cleanUsername = username.replace(/^@/, '').trim();
    if (!cleanUsername) {
      setNotFound(true);
      setIsLoading(false);
      return;
    }

    profilesService
      .getProfileByUsername(cleanUsername)
      .then(async (data) => {
        if (!isMounted) return;
        if (!data) {
          setNotFound(true);
          return;
        }

        if (data.status === 'suspended') {
          setIsSuspended(true);
          return;
        }

        // Check if visitor has a block relationship with target
        if (user && user.id !== data.id) {
          try {
            const relState = await relationshipsService.getRelationshipState(user.id, data.id);
            if (relState.isBlocked || relState.isBlockedBy) {
              setIsBlocked(true);
              return;
            }
          } catch (e) {
            console.warn('Error checking relationship in public profile:', e);
          }
        }

        setProfile(data);

        // Fetch active, non-expired dynamos for this user
        try {
          const dyns = await dynamosService.getUserDynamos(data.id);
          const activeDyns = (dyns || []).filter((d) => {
            const isNotExpired = new Date(d.expires_at).getTime() > Date.now();
            return d.status === 'active' && isNotExpired;
          });
          if (isMounted) setUserDynamos(activeDyns);
        } catch (dynErr) {
          console.warn('Error fetching user dynamos for public profile:', dynErr);
        }
      })
      .catch((err) => {
        console.error('Error fetching public profile:', err);
        if (isMounted) setNotFound(true);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [username, user?.id]);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6">
      {/* Navigation Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          id="btn-public-profile-back"
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-stone-800 bg-[#12161A] text-stone-300 hover:text-white hover:border-stone-700 text-xs font-semibold transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-amber-400" />
          <span>Volver al feed</span>
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-24 text-stone-400 gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
          <p className="text-xs">Cargando perfil de @{username.replace(/^@/, '')}...</p>
        </div>
      )}

      {/* 404 User Not Found */}
      {!isLoading && notFound && (
        <div className="rounded-2xl border border-stone-800 bg-[#12161A] p-8 text-center max-w-xl mx-auto">
          <div className="w-12 h-12 rounded-full bg-stone-800/80 border border-stone-700 flex items-center justify-center mx-auto mb-4 text-stone-400">
            <AlertCircle className="w-6 h-6 text-amber-500" />
          </div>
          <h2 className="text-lg font-bold text-stone-100 mb-2">Usuario no encontrado</h2>
          <p className="text-xs text-stone-400 max-w-md mx-auto mb-6">
            La cuenta <span className="font-mono text-amber-400">@{username.replace(/^@/, '')}</span> no existe o su nombre de usuario ha cambiado.
          </p>
          <button
            onClick={onBack}
            className="px-5 py-2 rounded-xl bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 transition cursor-pointer"
          >
            Explorar Dynamo
          </button>
        </div>
      )}

      {/* Blocked state */}
      {!isLoading && isBlocked && (
        <div className="rounded-2xl border border-stone-800 bg-[#12161A] p-8 text-center max-w-xl mx-auto">
          <div className="w-12 h-12 rounded-full bg-stone-800/80 border border-stone-700 flex items-center justify-center mx-auto mb-4 text-stone-400">
            <ShieldAlert className="w-6 h-6 text-stone-400" />
          </div>
          <h2 className="text-lg font-bold text-stone-100 mb-2">Perfil no disponible</h2>
          <p className="text-xs text-stone-400 max-w-md mx-auto mb-6">
            Este perfil no se encuentra disponible debido a las configuraciones de privacidad y bloqueo mutuo.
          </p>
          <button
            onClick={onBack}
            className="px-5 py-2 rounded-xl border border-stone-800 text-stone-300 hover:text-white text-xs font-semibold transition cursor-pointer"
          >
            Volver al feed
          </button>
        </div>
      )}

      {/* Suspended state */}
      {!isLoading && isSuspended && (
        <div className="rounded-2xl border border-red-950/40 bg-[#161214] p-8 text-center max-w-xl mx-auto">
          <div className="w-12 h-12 rounded-full bg-red-950/40 border border-red-800/50 flex items-center justify-center mx-auto mb-4 text-red-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-red-200 mb-2">Cuenta suspendida</h2>
          <p className="text-xs text-stone-400 max-w-md mx-auto mb-6">
            Esta cuenta ha sido suspendida por incumplimiento de las Normas de la Comunidad de Dynamo.
          </p>
          <button
            onClick={onBack}
            className="px-5 py-2 rounded-xl border border-stone-800 text-stone-300 hover:text-white text-xs font-semibold transition cursor-pointer"
          >
            Volver al feed
          </button>
        </div>
      )}

      {/* Valid Profile View */}
      {!isLoading && profile && !isBlocked && !isSuspended && !notFound && (
        <div className="space-y-6">
          {/* Main Profile Info Section (reusing existing ProfileView component) */}
          <ProfileView
            customProfile={profile}
            onOpenAuth={onOpenAuth}
            onGoToSettings={onGoToSettings}
          />

          {/* Active Dynamos Section */}
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-4 px-1">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-stone-200 uppercase tracking-wider">
                Dynamos Activos ({userDynamos.length})
              </h3>
            </div>

            {userDynamos.length === 0 ? (
              <div className="rounded-2xl border border-stone-800/60 bg-[#12161A]/60 p-8 text-center text-xs text-stone-400">
                @{profile.username} no tiene Dynamos activos en este momento.
              </div>
            ) : (
              <div className="space-y-4">
                {userDynamos.map((d) => (
                  <DynamoCard
                    key={d.id}
                    dynamo={{
                      ...d,
                      author: profile,
                    }}
                    onGiftEnergy={async (id) => {
                      if (!user) {
                        onOpenAuth();
                        return;
                      }
                      return onGiftEnergy(id);
                    }}
                    onOpenReply={(dynamoTarget) => {
                      if (!user) {
                        onOpenAuth();
                        return;
                      }
                      onOpenReply(dynamoTarget);
                    }}
                    onReport={onReport}
                    onDelete={onDelete}
                    onSelectHashtag={onSelectHashtag}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
