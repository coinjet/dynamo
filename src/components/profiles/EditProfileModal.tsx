import React, { useState } from 'react';
import { X, User, Image as ImageIcon, AlertCircle, Check, Sparkles } from 'lucide-react';
import { useAuth } from '@/src/modules/auth/AuthContext';
import { profilesService } from '@/src/modules/profiles/profilesService';
import {
  validateUsername,
  sanitizeAndValidateBio,
  AUTH_LIMITS,
} from '@/src/modules/auth/authValidation';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&h=256&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&h=256&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&h=256&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=256&h=256&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=256&h=256&q=80',
];

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const { profile, updateProfileState } = useAuth();

  const [username, setUsername] = useState(profile?.username || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [avatar, setAvatar] = useState(profile?.avatar || '');

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen || !profile) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const cleanUsername = username.trim().toLowerCase();

      // 1. Validate username
      const usernameCheck = validateUsername(cleanUsername);
      if (!usernameCheck.isValid) {
        throw new Error(usernameCheck.error);
      }

      // Check uniqueness if changed
      if (cleanUsername !== profile.username.toLowerCase()) {
        const isAvailable = await profilesService.isUsernameAvailable(cleanUsername, profile.id);
        if (!isAvailable) {
          throw new Error('El nombre de usuario ya está en uso. Por favor elige otro.');
        }
      }

      // 2. Validate bio and prevent personal info leaks
      const bioCheck = sanitizeAndValidateBio(bio);
      if (!bioCheck.isValid) {
        throw new Error(bioCheck.error);
      }

      const updated = await profilesService.updateProfile(profile.id, {
        username: cleanUsername,
        bio: bioCheck.sanitized,
        avatar: avatar.trim(),
      });

      updateProfileState({
        username: updated.username,
        bio: updated.bio,
        avatar: updated.avatar,
      });

      onClose();
    } catch (err: any) {
      setError(err.message || 'No se pudo actualizar el perfil.');
    } finally {
      setIsSaving(false);
    }
  };

  const bioRemainingChars = AUTH_LIMITS.BIO_MAX_LENGTH - bio.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-md my-auto rounded-2xl border border-[#262E38] bg-[#12161A] p-5 sm:p-6 shadow-2xl text-stone-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#21272E] mb-4">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm sm:text-base font-bold text-white">Editar Perfil</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-red-950/40 border border-red-800/60 p-3 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          {/* Avatar Preview and Selector */}
          <div>
            <label className="block text-xs font-medium text-stone-300 mb-2">Avatar</label>
            <div className="flex items-center gap-3 mb-3">
              {avatar ? (
                <img
                  src={avatar}
                  alt="Avatar"
                  referrerPolicy="no-referrer"
                  className="h-14 w-14 rounded-full object-cover border-2 border-amber-500/60 shadow-sm"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1C232B] text-lg font-bold text-amber-400 border border-stone-800">
                  {username?.[0]?.toUpperCase() || 'U'}
                </div>
              )}

              <div className="flex-1 space-y-1">
                <input
                  id="profile-avatar-url"
                  type="url"
                  placeholder="URL de imagen segura (https://...)"
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  className="w-full rounded-xl bg-[#0E1216] border border-[#262E38] px-3 py-1.5 text-xs text-stone-100 placeholder-stone-400 focus:border-amber-500 focus:outline-hidden"
                />
                <p className="text-[10px] text-stone-400">Pega un enlace o elige un avatar predeterminado:</p>
              </div>
            </div>

            {/* Curated Avatars List */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {PRESET_AVATARS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setAvatar(preset)}
                  className={`h-9 w-9 rounded-full overflow-hidden shrink-0 border-2 transition ${
                    avatar === preset ? 'border-amber-400 scale-105' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img
                    src={preset}
                    alt={`Preset ${idx + 1}`}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAvatar(`https://api.dicebear.com/7.x/identicon/svg?seed=${username || 'dynamo'}`)}
                className="h-9 px-2.5 rounded-xl bg-[#182029] border border-[#26303D] text-[10px] text-stone-300 font-medium hover:text-amber-400 shrink-0 flex items-center gap-1"
                title="Generar avatar con tu nombre"
              >
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Geométrico</span>
              </button>
            </div>
          </div>

          {/* Username */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-stone-300">Nombre de usuario</label>
              <span className="text-[10px] text-stone-400">3-20 caracteres (a-z, 0-9, _)</span>
            </div>
            <div className="relative">
              <span className="text-stone-400 absolute left-3 top-2 text-xs font-bold">@</span>
              <input
                id="edit-username"
                type="text"
                required
                maxLength={AUTH_LIMITS.USERNAME_MAX_LENGTH}
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                className="w-full rounded-xl bg-[#0E1216] border border-[#262E38] pl-8 pr-3 py-2 text-xs text-stone-100 focus:border-amber-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Bio */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-stone-300">Biografía</label>
              <span
                className={`text-[10px] font-mono ${
                  bioRemainingChars < 0 ? 'text-red-400 font-bold' : 'text-stone-400'
                }`}
              >
                {bio.length}/{AUTH_LIMITS.BIO_MAX_LENGTH}
              </span>
            </div>
            <textarea
              id="edit-bio"
              rows={3}
              maxLength={AUTH_LIMITS.BIO_MAX_LENGTH}
              placeholder="Presentación breve en Dynamo. No agregues números de teléfono ni datos privados."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full rounded-xl bg-[#0E1216] border border-[#262E38] p-2.5 text-xs text-stone-100 placeholder-stone-400 focus:border-amber-500 focus:outline-hidden resize-none leading-relaxed"
            />
            <p className="text-[10px] text-stone-400 mt-1">
              Por privacidad, no se permiten teléfonos, enlaces de WhatsApp ni correos personales en la biografía.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1F2730]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-stone-400 hover:text-white transition"
            >
              Cancelar
            </button>
            <button
              id="save-profile-btn"
              type="submit"
              disabled={isSaving || bioRemainingChars < 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 active:scale-95 transition disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{isSaving ? 'Guardando...' : 'Guardar Cambios'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
