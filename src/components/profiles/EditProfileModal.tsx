import React, { useState, useRef } from 'react';
import { X, User, AlertCircle, Check, Sparkles, Upload, Loader2, RotateCcw } from 'lucide-react';
import { useAuth } from '@/src/modules/auth/AuthContext';
import { profilesService } from '@/src/modules/profiles/profilesService';
import { mediaStorageService } from '@/src/modules/storage/mediaStorageService';
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

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const { profile, updateProfileState } = useAuth();

  const [username, setUsername] = useState(profile?.username || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [avatar, setAvatar] = useState(profile?.avatar || '');
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);
  const [tempUploadedAvatar, setTempUploadedAvatar] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !profile) return null;

  const isCustomAvatar = Boolean(
    avatar &&
    !PRESET_AVATARS.includes(avatar) &&
    !avatar.startsWith('https://api.dicebear.com/')
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Client-side format validation
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_MIME_TYPES.includes(file.type) || !ALLOWED_EXTENSIONS.includes(ext)) {
      setError('Formato no permitido. Solo se aceptan imágenes en formato JPG, JPEG, PNG o WEBP.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Client-side size validation (max 5 MB)
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      setError(`La imagen excede el límite máximo de 5 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Show immediate preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewAvatar(objectUrl);
    setIsUploading(true);

    try {
      // Upload using existing mediaStorageService.uploadAvatarImage
      const uploadedUrl = await mediaStorageService.uploadAvatarImage(
        file,
        profile.id,
        avatar
      );

      setAvatar(uploadedUrl);
      setTempUploadedAvatar(uploadedUrl);
    } catch (err: any) {
      setPreviewAvatar(null);
      setError(err.message || 'No se pudo subir la imagen. Intenta de nuevo.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSelectPreset = (presetUrl: string) => {
    if (isUploading) return;
    setError(null);
    setPreviewAvatar(null);
    setAvatar(presetUrl);
  };

  const handleClose = async () => {
    // If user uploaded a new avatar in this session but dismissed without saving, clean up orphaned storage file
    if (tempUploadedAvatar && tempUploadedAvatar !== profile.avatar) {
      await mediaStorageService.deleteAvatarImage(tempUploadedAvatar, profile.id);
    }
    onClose();
  };

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

      const finalAvatar = avatar.trim();

      // If user replaced their previous storage avatar with a preset/geometric, clean up old storage file
      if (profile.avatar && profile.avatar !== finalAvatar) {
        await mediaStorageService.deleteAvatarImage(profile.avatar, profile.id);
      }

      // If user uploaded a temp avatar in this session and then switched away from it before saving, clean up
      if (tempUploadedAvatar && tempUploadedAvatar !== finalAvatar) {
        await mediaStorageService.deleteAvatarImage(tempUploadedAvatar, profile.id);
      }

      const updated = await profilesService.updateProfile(profile.id, {
        username: cleanUsername,
        bio: bioCheck.sanitized,
        avatar: finalAvatar,
      });

      updateProfileState({
        username: updated.username,
        bio: updated.bio,
        avatar: updated.avatar,
      });

      setTempUploadedAvatar(null);
      onClose();
    } catch (err: any) {
      setError(err.message || 'No se pudo actualizar el perfil.');
    } finally {
      setIsSaving(false);
    }
  };

  const bioRemainingChars = AUTH_LIMITS.BIO_MAX_LENGTH - bio.length;
  const displayAvatar = previewAvatar || avatar;

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
            onClick={handleClose}
            disabled={isUploading || isSaving}
            className="p-1 rounded-lg text-stone-400 hover:text-white transition cursor-pointer disabled:opacity-50"
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
          {/* Avatar Preview, Native File Selector and Presets */}
          <div>
            <label className="block text-xs font-medium text-stone-300 mb-2">Avatar</label>
            <div className="flex items-center gap-3 mb-3">
              <div className="relative h-14 w-14 shrink-0">
                {displayAvatar ? (
                  <img
                    src={displayAvatar}
                    alt="Avatar"
                    referrerPolicy="no-referrer"
                    className="h-14 w-14 rounded-full object-cover border-2 border-amber-500/60 shadow-sm"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1C232B] text-lg font-bold text-amber-400 border border-stone-800">
                    {username?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                {isUploading && (
                  <div className="absolute inset-0 rounded-full bg-black/70 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-2">
                <input
                  ref={fileInputRef}
                  id="avatar-file-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isUploading || isSaving}
                />
                
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    id="btn-upload-avatar"
                    type="button"
                    disabled={isUploading || isSaving}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Subiendo...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>Subir imagen</span>
                      </>
                    )}
                  </button>

                  {isCustomAvatar && (
                    <button
                      id="btn-reset-avatar"
                      type="button"
                      disabled={isUploading || isSaving}
                      onClick={() => handleSelectPreset(PRESET_AVATARS[0])}
                      className="inline-flex items-center gap-1 text-[11px] text-stone-400 hover:text-stone-200 transition cursor-pointer"
                      title="Volver a un avatar predeterminado"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Volver a predeterminado</span>
                    </button>
                  )}
                </div>

                <p className="text-[10px] text-stone-400 leading-tight">
                  JPG, PNG o WEBP (máx. 5 MB). O elige uno de los avatares disponibles:
                </p>
              </div>
            </div>

            {/* Curated Avatars List */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {PRESET_AVATARS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={isUploading || isSaving}
                  onClick={() => handleSelectPreset(preset)}
                  className={`h-9 w-9 rounded-full overflow-hidden shrink-0 border-2 transition cursor-pointer disabled:opacity-50 ${
                    avatar === preset && !previewAvatar ? 'border-amber-400 scale-105' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                  title={`Avatar predeterminado ${idx + 1}`}
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
                disabled={isUploading || isSaving}
                onClick={() => handleSelectPreset(`https://api.dicebear.com/7.x/identicon/svg?seed=${username || 'dynamo'}`)}
                className={`h-9 px-2.5 rounded-xl bg-[#182029] border text-[10px] font-medium shrink-0 flex items-center gap-1 cursor-pointer transition disabled:opacity-50 ${
                  avatar.startsWith('https://api.dicebear.com/') && !previewAvatar
                    ? 'border-amber-400 text-amber-400'
                    : 'border-[#26303D] text-stone-300 hover:text-amber-400'
                }`}
                title="Generar avatar geométrico con tu nombre"
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
                disabled={isUploading || isSaving}
                className="w-full rounded-xl bg-[#0E1216] border border-[#262E38] pl-8 pr-3 py-2 text-xs text-stone-100 focus:border-amber-500 focus:outline-hidden disabled:opacity-50"
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
              disabled={isUploading || isSaving}
              className="w-full rounded-xl bg-[#0E1216] border border-[#262E38] p-2.5 text-xs text-stone-100 placeholder-stone-400 focus:border-amber-500 focus:outline-hidden resize-none leading-relaxed disabled:opacity-50"
            />
            <p className="text-[10px] text-stone-400 mt-1">
              Por privacidad, no se permiten teléfonos, enlaces de WhatsApp ni correos personales en la biografía.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1F2730]">
            <button
              type="button"
              onClick={handleClose}
              disabled={isUploading || isSaving}
              className="px-4 py-2 rounded-xl text-xs text-stone-400 hover:text-white transition cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              id="save-profile-btn"
              type="submit"
              disabled={isSaving || isUploading || bioRemainingChars < 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 active:scale-95 transition disabled:opacity-50 cursor-pointer"
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
