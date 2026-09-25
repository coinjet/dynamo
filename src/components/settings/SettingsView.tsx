import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/modules/auth/AuthContext';
import {
  UserSettings,
  UpdateSettingsDTO,
  DEFAULT_USER_SETTINGS,
  maskEmail,
  SettingsTab,
} from '@/src/modules/settings/settingsTypes';
import { settingsService } from '@/src/modules/settings/settingsService';
import { profilesService } from '@/src/modules/profiles/profilesService';
import { EditProfileDTO } from '@/src/modules/profiles/profilesTypes';
import { LegalDocsModal, LegalDocType } from '@/src/components/legal/LegalDocsModal';
import {
  User,
  Shield,
  Bell,
  KeyRound,
  FileText,
  AlertTriangle,
  LogOut,
  Trash2,
  CheckCircle2,
  Save,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  Zap,
  MessageSquare,
  UserPlus,
  Clock,
  Award,
  Info,
  Check,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
} from 'lucide-react';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&h=256&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&h=256&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&h=256&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=256&h=256&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=256&h=256&q=80',
];

interface SettingsViewProps {
  onGoToHome?: () => void;
  onGoToProfile?: () => void;
  onOpenInvite?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onGoToHome,
  onGoToProfile,
  onOpenInvite,
}) => {
  const { user, profile, signOut, updateProfileState, refreshProfile } = useAuth();

  // Tab State
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');

  // Settings State
  const [settings, setSettings] = useState<UserSettings>({
    user_id: user?.id || '',
    ...DEFAULT_USER_SETTINGS,
  });
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSavedFeedback, setSettingsSavedFeedback] = useState(false);

  // Profile Edit State (Tab Cuenta)
  const [editUsername, setEditUsername] = useState(profile?.username || '');
  const [editBio, setEditBio] = useState(profile?.bio || '');
  const [editAvatar, setEditAvatar] = useState(profile?.avatar || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Security (Change Password) State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Global SignOut State
  const [isSigningOutAll, setIsSigningOutAll] = useState(false);

  // Danger Zone: Delete Account State
  const [deleteConfirmationStep, setDeleteConfirmationStep] = useState<1 | 2>(1);
  const [deleteInputText, setDeleteInputText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Legal Modal State
  const [viewingLegalDoc, setViewingLegalDoc] = useState<LegalDocType | null>(null);

  // Load user settings on mount
  useEffect(() => {
    let isMounted = true;
    async function load() {
      if (!user?.id) return;
      setIsLoadingSettings(true);
      try {
        const data = await settingsService.getUserSettings(user.id);
        if (isMounted) {
          setSettings(data);
        }
      } catch (err) {
        console.warn('Could not load user settings:', err);
      } finally {
        if (isMounted) setIsLoadingSettings(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  // Sync profile editing fields when profile changes
  useEffect(() => {
    if (profile) {
      setEditUsername(profile.username);
      setEditBio(profile.bio || '');
      setEditAvatar(profile.avatar || '');
    }
  }, [profile]);

  // Handler: Save Profile Edits (Username, Bio, Avatar)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setIsSavingProfile(true);
    setProfileFeedback(null);

    try {
      const updates: EditProfileDTO = {
        username: editUsername.trim().toLowerCase(),
        bio: editBio,
        avatar: editAvatar.trim(),
      };

      const updated = await profilesService.updateProfile(user.id, updates);
      updateProfileState(updated);

      setProfileFeedback({
        type: 'success',
        message: '¡Perfil actualizado correctamente!',
      });
      setTimeout(() => setProfileFeedback(null), 4000);
    } catch (err: any) {
      setProfileFeedback({
        type: 'error',
        message: err.message || 'Error al actualizar el perfil.',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Handler: Update and Save Settings (Privacy / Notifications)
  const handleSaveSettings = async (updates: UpdateSettingsDTO) => {
    if (!user?.id) return;
    setIsSavingSettings(true);
    setSettingsSavedFeedback(false);

    try {
      const updated = await settingsService.updateUserSettings(user.id, updates);
      setSettings(updated);
      setSettingsSavedFeedback(true);
      setTimeout(() => setSettingsSavedFeedback(false), 3000);
    } catch (err: any) {
      console.error('Error saving settings:', err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Handler: Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setIsChangingPassword(true);
    setPasswordFeedback(null);

    try {
      await settingsService.changePassword({
        currentPassword: currentPassword.trim() || undefined,
        newPassword: newPassword.trim(),
        confirmPassword: confirmPassword.trim(),
        userEmail: user.email,
      });

      setPasswordFeedback({
        type: 'success',
        message: 'Contraseña actualizada con éxito.',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordFeedback(null), 5000);
    } catch (err: any) {
      setPasswordFeedback({
        type: 'error',
        message: err.message || 'Error al actualizar la contraseña.',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Handler: Sign out from all devices
  const handleSignOutAll = async () => {
    setIsSigningOutAll(true);
    try {
      await settingsService.signOutAllSessions();
      await signOut();
      onGoToHome?.();
    } catch (err) {
      console.warn('Error signing out of all devices:', err);
    } finally {
      setIsSigningOutAll(false);
    }
  };

  // Handler: Permanent Account Deletion
  const handleDeleteAccount = async () => {
    if (!user?.id) return;

    setIsDeletingAccount(true);
    setDeleteError(null);

    try {
      await settingsService.deleteAccount(user.id, deleteInputText);
      await signOut();
      onGoToHome?.();
    } catch (err: any) {
      setDeleteError(err.message || 'Error al procesar la eliminación de la cuenta.');
      setIsDeletingAccount(false);
    }
  };

  const registrationDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Reciente';

  const maskedEmail = maskEmail(user?.email);

  return (
    <div id="settings-view-container" className="w-full max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Title & Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[#202730]">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Lock className="w-6 h-6 text-amber-400" />
            <span>Configuración y Privacidad</span>
          </h1>
          <p className="text-xs text-stone-400 mt-1">
            Gestiona tu cuenta anónima, preferencias de privacidad, alertas y seguridad.
          </p>
        </div>

        {onGoToProfile && (
          <button
            onClick={onGoToProfile}
            className="self-start sm:self-auto text-xs text-amber-400 hover:text-amber-300 transition flex items-center gap-1 font-semibold"
          >
            <span>Ver mi perfil</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Tabs Navigation (Responsive Bar) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-stone-800/80 scrollbar-none">
        <button
          id="tab-settings-account"
          onClick={() => setActiveTab('account')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
            activeTab === 'account'
              ? 'bg-amber-500 text-black shadow-sm'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Cuenta</span>
        </button>

        <button
          id="tab-settings-privacy"
          onClick={() => setActiveTab('privacy')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
            activeTab === 'privacy'
              ? 'bg-amber-500 text-black shadow-sm'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Privacidad</span>
        </button>

        <button
          id="tab-settings-notifications"
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
            activeTab === 'notifications'
              ? 'bg-amber-500 text-black shadow-sm'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Notificaciones</span>
        </button>

        <button
          id="tab-settings-security"
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
            activeTab === 'security'
              ? 'bg-amber-500 text-black shadow-sm'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>Seguridad</span>
        </button>

        <button
          id="tab-settings-community"
          onClick={() => setActiveTab('community')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
            activeTab === 'community'
              ? 'bg-amber-500 text-black shadow-sm'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Políticas</span>
        </button>

        <button
          id="tab-settings-danger"
          onClick={() => setActiveTab('danger')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
            activeTab === 'danger'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-red-400/80 hover:text-red-300 hover:bg-red-950/20'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Zona Peligrosa</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SECCIÓN A: CUENTA */}
      {/* ========================================================================= */}
      {activeTab === 'account' && (
        <div id="section-account" className="space-y-6 animate-fade-in">
          {/* Tarjeta de Información de Cuenta */}
          <div className="rounded-2xl border border-stone-800 bg-[#141A20] p-5 sm:p-6 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-amber-400" />
              <span>Detalles de Cuenta</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-[#0D1217] border border-stone-800/80">
                <span className="text-stone-400 block text-[11px] mb-1">Nombre de Usuario</span>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  @{profile?.username || 'usuario'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0D1217] border border-stone-800/80">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-stone-400 block text-[11px]">Correo Electrónico (Privado)</span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                    <Lock className="w-3 h-3" /> Cifrado
                  </span>
                </div>
                <span className="font-mono text-stone-200 font-medium text-sm">{maskedEmail}</span>
                <p className="text-[10px] text-stone-400 mt-1">
                  Nunca se muestra públicamente en ningún perfil o publicación.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0D1217] border border-stone-800/80">
                <span className="text-stone-400 block text-[11px] mb-1">Fecha de Registro</span>
                <span className="text-stone-200 font-medium">{registrationDate}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0D1217] border border-stone-800/80">
                <span className="text-stone-400 block text-[11px] mb-1">Estado de Cuenta</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3" />
                  {profile?.status === 'active' ? 'Activo y Verificado' : profile?.status || 'Activo'}
                </span>
              </div>
            </div>
          </div>

          {/* Formulario de Edición de Perfil (Username, Bio, Avatar) */}
          <form
            onSubmit={handleSaveProfile}
            className="rounded-2xl border border-stone-800 bg-[#141A20] p-5 sm:p-6 space-y-5"
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div>
                <h3 className="text-sm font-bold text-white">Editar Perfil Público Anónimo</h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  Cambia tu nombre de usuario, biografía o imagen de avatar anónimo.
                </p>
              </div>
            </div>

            {profileFeedback && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  profileFeedback.type === 'success'
                    ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/60'
                    : 'bg-red-950/40 text-red-300 border border-red-800/60'
                }`}
              >
                {profileFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                )}
                <span>{profileFeedback.message}</span>
              </div>
            )}

            {/* Username Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-300">
                Nombre de Usuario (@username)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-stone-400 text-sm font-mono">@</span>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  maxLength={20}
                  className="w-full rounded-xl border border-stone-800 bg-[#0D1217] py-2 pl-8 pr-4 text-xs font-mono text-white focus:border-amber-400 focus:outline-none transition"
                  placeholder="nuevo_usuario"
                  required
                />
              </div>
              <p className="text-[11px] text-stone-400">
                Entre 3 y 20 caracteres. Solo letras minúsculas, números y guiones bajos (_).
              </p>
            </div>

            {/* Bio Input with PII Warning */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-stone-300">Biografía</label>
                <span className="text-[11px] text-stone-400 font-mono">{editBio.length}/160</span>
              </div>
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                maxLength={160}
                rows={3}
                className="w-full rounded-xl border border-stone-800 bg-[#0D1217] p-3 text-xs text-white focus:border-amber-400 focus:outline-none transition resize-none"
                placeholder="Escribe algo sobre ti sin revelar datos personales..."
              />
              <p className="text-[11px] text-stone-400 flex items-center gap-1">
                <Info className="w-3 h-3 text-amber-400 shrink-0" />
                <span>
                  Protección PII activa: no incluyas teléfonos, WhatsApp, correos ni direcciones.
                </span>
              </p>
            </div>

            {/* Avatar Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-stone-300">Avatar</label>
              <div className="flex items-center gap-3">
                {editAvatar ? (
                  <img
                    src={editAvatar}
                    alt="Preview"
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-full object-cover border-2 border-amber-400/80 shadow-sm shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center text-amber-400 font-bold text-sm shrink-0">
                    {editUsername?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                <input
                  type="url"
                  value={editAvatar}
                  onChange={(e) => setEditAvatar(e.target.value)}
                  placeholder="URL de imagen o selecciona abajo..."
                  className="flex-1 rounded-xl border border-stone-800 bg-[#0D1217] py-2 px-3 text-xs text-white focus:border-amber-400 focus:outline-none transition"
                />
              </div>

              {/* Preset Avatars */}
              <div className="pt-2">
                <span className="text-[11px] text-stone-400 block mb-2">Avatares predeterminados:</span>
                <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                  {PRESET_AVATARS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setEditAvatar(preset)}
                      className={`relative rounded-full p-0.5 border-2 transition ${
                        editAvatar === preset ? 'border-amber-400 scale-105' : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={preset}
                        alt={`Avatar ${idx + 1}`}
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-800">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition shadow-sm active:scale-95 disabled:opacity-50"
              >
                {isSavingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Guardar Cambios</span>
              </button>
            </div>
          </form>

          {/* Invitaciones a Dynamo ⚡ */}
          {onOpenInvite && (
            <div className="rounded-2xl border border-stone-800 bg-[#141A20] p-5 sm:p-6 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 shrink-0">
                    <Zap className="w-5 h-5 fill-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Programa de Invitaciones ⚡</h3>
                    <p className="text-xs text-stone-400">
                      Comparte tu enlace personal, trae amigos y consulta estadísticas reales de registro.
                    </p>
                  </div>
                </div>
                <button
                  id="btn-settings-open-invite"
                  onClick={onOpenInvite}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 transition cursor-pointer shrink-0 shadow-sm"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Gestionar Invitaciones</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECCIÓN B: PRIVACIDAD */}
      {/* ========================================================================= */}
      {activeTab === 'privacy' && (
        <div id="section-privacy" className="space-y-6 animate-fade-in">
          {/* Reglas y Principios de Privacidad */}
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 sm:p-5 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <h3 className="font-bold text-amber-300">Identidad 100% Anónima</h3>
              <p className="text-stone-300 leading-relaxed">
                En Dynamo tu identidad real está disociada de tu cuenta. No existen perfiles basados
                en nombres reales ni chats privados invasivos. Todo el contenido es público y efímero.
              </p>
            </div>
          </div>

          {/* Opciones de Privacidad */}
          <div className="rounded-2xl border border-stone-800 bg-[#141A20] p-5 sm:p-6 space-y-5">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" />
              <span>Preferencias de Privacidad</span>
            </h2>

            {/* Quién puede seguirme */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#0D1217] border border-stone-800/80">
              <div>
                <span className="text-xs font-bold text-white block">Quién puede seguirme</span>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  Controla si otros miembros de Dynamo pueden agregarte a su lista de seguidos.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveSettings({ allow_followers: 'everyone' })}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                    settings.allow_followers === 'everyone'
                      ? 'bg-amber-500 text-black font-bold'
                      : 'border border-stone-800 text-stone-400 hover:text-white'
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveSettings({ allow_followers: 'nobody' })}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                    settings.allow_followers === 'nobody'
                      ? 'bg-amber-500 text-black font-bold'
                      : 'border border-stone-800 text-stone-400 hover:text-white'
                  }`}
                >
                  Nadie
                </button>
              </div>
            </div>

            {/* Visibilidad del Perfil */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#0D1217] border border-stone-800/80">
              <div>
                <span className="text-xs font-bold text-white block">Modo de Visibilidad</span>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  &apos;Público&apos; muestra tus insignias y bio; &apos;Mínimo&apos; simplifica la vista a lo estrictamente básico.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveSettings({ profile_visibility: 'public' })}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                    settings.profile_visibility === 'public'
                      ? 'bg-amber-500 text-black font-bold'
                      : 'border border-stone-800 text-stone-400 hover:text-white'
                  }`}
                >
                  Público Estándar
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveSettings({ profile_visibility: 'minimal' })}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                    settings.profile_visibility === 'minimal'
                      ? 'bg-amber-500 text-black font-bold'
                      : 'border border-stone-800 text-stone-400 hover:text-white'
                  }`}
                >
                  Mínimo
                </button>
              </div>
            </div>

            {/* Notificaciones Sociales */}
            <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-[#0D1217] border border-stone-800/80">
              <div>
                <span className="text-xs font-bold text-white block">Alertas de Interacción Social</span>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  Activa o desactiva avisos de nuevos seguidores y respuestas comunitarias.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleSaveSettings({ social_notifications: !settings.social_notifications })}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.social_notifications ? 'bg-amber-500' : 'bg-stone-800'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out ${
                    settings.social_notifications ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Banner de Prohibición PII */}
            <div className="p-4 rounded-xl border border-stone-800 bg-[#0A0E13] space-y-2 text-xs">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-[11px]">
                <ShieldAlert className="w-4 h-4" />
                <span>Reglas estrictas de privacidad y PII</span>
              </div>
              <p className="text-stone-400 text-[11px] leading-relaxed">
                Está estrictamente prohibido compartir números telefónicos, enlaces directos a WhatsApp o
                Telegram, correos, domicilios, ubicaciones en vivo o datos financieros. El sistema utiliza un
                detector automatizado que bloquea estas publicaciones antes de ser procesadas.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECCIÓN C: NOTIFICACIONES */}
      {/* ========================================================================= */}
      {activeTab === 'notifications' && (
        <div id="section-notifications" className="space-y-6 animate-fade-in">
          <div className="rounded-2xl border border-stone-800 bg-[#141A20] p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-400" />
                  <span>Preferencias de Notificaciones</span>
                </h2>
                <p className="text-xs text-stone-400 mt-0.5">
                  Elige qué eventos generan alertas en tu buzón de Dynamo.
                </p>
              </div>

              {settingsSavedFeedback && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs font-semibold animate-fade-in">
                  <Check className="w-3.5 h-3.5" />
                  <span>Guardado</span>
                </span>
              )}
            </div>

            <div className="space-y-3">
              {/* 1. Dynamos recibidos (⚡) */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0D1217] border border-stone-800/80">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Energía Recibida (⚡)</span>
                    <span className="text-[11px] text-stone-400">
                      Cuando alguien inyecta +6h de vida a una de tus publicaciones.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleSaveSettings({
                      notify_dynamos_received: !settings.notify_dynamos_received,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.notify_dynamos_received ? 'bg-amber-500' : 'bg-stone-800'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out ${
                      settings.notify_dynamos_received ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* 2. Respuestas */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0D1217] border border-stone-800/80">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Respuestas y Comentarios</span>
                    <span className="text-[11px] text-stone-400">
                      Cuando otro usuario responde a uno de tus Dynamos.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleSaveSettings({
                      notify_replies: !settings.notify_replies,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.notify_replies ? 'bg-amber-500' : 'bg-stone-800'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out ${
                      settings.notify_replies ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* 3. Nuevos Seguidores */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0D1217] border border-stone-800/80">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Nuevos Seguidores</span>
                    <span className="text-[11px] text-stone-400">
                      Cuando alguien comienza a seguir tu perfil anónimo.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleSaveSettings({
                      notify_new_followers: !settings.notify_new_followers,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.notify_new_followers ? 'bg-amber-500' : 'bg-stone-800'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out ${
                      settings.notify_new_followers ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* 4. Dynamos Próximos a Expirar */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0D1217] border border-stone-800/80">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Dynamos por Expirar</span>
                    <span className="text-[11px] text-stone-400">
                      Avisos cuando a una publicación le quedan menos de 2 horas de vida.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleSaveSettings({
                      notify_expiring: !settings.notify_expiring,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.notify_expiring ? 'bg-amber-500' : 'bg-stone-800'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out ${
                      settings.notify_expiring ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* 5. Insignias Desbloqueadas */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0D1217] border border-stone-800/80">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Insignias y Logros</span>
                    <span className="text-[11px] text-stone-400">
                      Celebración al desbloquear nuevas medallas verificadas de Dynamo.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleSaveSettings({
                      notify_badges: !settings.notify_badges,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.notify_badges ? 'bg-amber-500' : 'bg-stone-800'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out ${
                      settings.notify_badges ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* 6. Avisos del Sistema (Locked) */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0D1217]/60 border border-stone-800/40 opacity-90">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-stone-800 text-amber-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">Avisos Críticos del Sistema</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                        Obligatorio
                      </span>
                    </div>
                    <span className="text-[11px] text-stone-400">
                      Comunicaciones de seguridad, cambios de términos y alertas de moderación.
                    </span>
                  </div>
                </div>
                <div className="relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent bg-amber-500/40 cursor-not-allowed">
                  <span className="inline-block h-5 w-5 transform translate-x-5 rounded-full bg-black/60 shadow" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECCIÓN D: SEGURIDAD */}
      {/* ========================================================================= */}
      {activeTab === 'security' && (
        <div id="section-security" className="space-y-6 animate-fade-in">
          {/* Cambiar Contraseña */}
          <form
            onSubmit={handleChangePassword}
            className="rounded-2xl border border-stone-800 bg-[#141A20] p-5 sm:p-6 space-y-4"
          >
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-400" />
              <span>Cambio de Contraseña</span>
            </h2>

            {passwordFeedback && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  passwordFeedback.type === 'success'
                    ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/60'
                    : 'bg-red-950/40 text-red-300 border border-red-800/60'
                }`}
              >
                {passwordFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                )}
                <span>{passwordFeedback.message}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-300">Contraseña Actual</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Escribe tu contraseña actual..."
                    className="w-full rounded-xl border border-stone-800 bg-[#0D1217] py-2 pl-3 pr-10 text-xs text-white focus:border-amber-400 focus:outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-stone-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-300">Nueva Contraseña</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres..."
                  minLength={8}
                  required
                  className="w-full rounded-xl border border-stone-800 bg-[#0D1217] py-2 px-3 text-xs text-white focus:border-amber-400 focus:outline-none transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-300">Confirmar Nueva Contraseña</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Vuelve a escribir la nueva contraseña..."
                  minLength={8}
                  required
                  className="w-full rounded-xl border border-stone-800 bg-[#0D1217] py-2 px-3 text-xs text-white focus:border-amber-400 focus:outline-none transition"
                />
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="submit"
                disabled={isChangingPassword}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition shadow-sm active:scale-95 disabled:opacity-50"
              >
                {isChangingPassword && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Actualizar Contraseña</span>
              </button>
            </div>
          </form>

          {/* Estado de Sesiones */}
          <div className="rounded-2xl border border-stone-800 bg-[#141A20] p-5 sm:p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-amber-400" />
              <span>Gestión de Sesiones Activas</span>
            </h3>

            <div className="p-4 rounded-xl bg-[#0D1217] border border-stone-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">Dispositivo Actual</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold border border-emerald-500/30">
                    En Línea
                  </span>
                </div>
                <p className="text-stone-400 text-[11px]">
                  Conexión cifrada de extremo a extremo mediante tokens TLS JWT.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSignOutAll}
                disabled={isSigningOutAll}
                className="px-3.5 py-2 rounded-xl border border-stone-800 text-stone-300 hover:text-white hover:bg-stone-800 transition text-xs font-semibold flex items-center gap-2 self-start sm:self-auto"
              >
                {isSigningOutAll ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <LogOut className="w-3.5 h-3.5 text-red-400" />
                )}
                <span>Cerrar sesión en todos los dispositivos</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECCIÓN E: COMUNIDAD Y POLÍTICAS */}
      {/* ========================================================================= */}
      {activeTab === 'community' && (
        <div id="section-community" className="space-y-6 animate-fade-in">
          <div className="rounded-2xl border border-stone-800 bg-[#141A20] p-5 sm:p-6 space-y-5">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <span>Normas, Términos y Transparencia</span>
              </h2>
              <p className="text-xs text-stone-400 mt-1">
                Conoce las bases legales, los principios de convivencia y las medidas de seguridad de Dynamo.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <button
                onClick={() => setViewingLegalDoc('terms')}
                className="p-4 rounded-xl bg-[#0D1217] border border-stone-800 hover:border-amber-500/40 text-left transition group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white group-hover:text-amber-400 transition">
                    Términos de Servicio
                  </span>
                  <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-white" />
                </div>
                <p className="text-[11px] text-stone-400 leading-normal">
                  Reglas de uso, naturaleza efímera de los Dynamos y responsabilidades del usuario.
                </p>
              </button>

              <button
                onClick={() => setViewingLegalDoc('privacy')}
                className="p-4 rounded-xl bg-[#0D1217] border border-stone-800 hover:border-amber-500/40 text-left transition group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white group-hover:text-amber-400 transition">
                    Política de Privacidad
                  </span>
                  <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-white" />
                </div>
                <p className="text-[11px] text-stone-400 leading-normal">
                  Cero venta de datos personales, identidad anónima garantizada y políticas RLS.
                </p>
              </button>

              <button
                onClick={() => setViewingLegalDoc('community')}
                className="p-4 rounded-xl bg-[#0D1217] border border-stone-800 hover:border-amber-500/40 text-left transition group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white group-hover:text-amber-400 transition">
                    Normas de la Comunidad
                  </span>
                  <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-white" />
                </div>
                <p className="text-[11px] text-stone-400 leading-normal">
                  Respeto mutuo, prohibición de doxxing, acoso y spam artificial.
                </p>
              </button>

              <button
                onClick={() => setViewingLegalDoc('safety')}
                className="p-4 rounded-xl bg-[#0D1217] border border-stone-800 hover:border-amber-500/40 text-left transition group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white group-hover:text-amber-400 transition">
                    Contenido Seguro & PII
                  </span>
                  <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-white" />
                </div>
                <p className="text-[11px] text-stone-400 leading-normal">
                  Detalles del detector de información sensible y edad mínima requerida (16+).
                </p>
              </button>
            </div>

            <div className="pt-3 border-t border-stone-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-400">
              <span>Versión de políticas: 1.4 (2026)</span>
              <span>Requisito de edad: 16 años cumplidos</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECCIÓN F: ZONA PELIGROSA */}
      {/* ========================================================================= */}
      {activeTab === 'danger' && (
        <div id="section-danger" className="space-y-6 animate-fade-in">
          <div className="rounded-2xl border border-red-500/40 bg-red-950/15 p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <h2 className="text-sm font-bold uppercase tracking-wider">Zona de Riesgo</h2>
            </div>
            <p className="text-xs text-red-200/80 leading-relaxed">
              Las acciones ejecutadas en esta sección son sensibles o irreversibles. Ten precaución
              antes de proceder.
            </p>

            {/* Acción A: Cerrar Sesión */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#0F141A] border border-stone-800 text-xs">
              <div>
                <span className="font-bold text-white block">Cerrar Sesión</span>
                <p className="text-stone-400 text-[11px] mt-0.5">
                  Finaliza la sesión actual de forma segura en este navegador.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  signOut();
                  onGoToHome?.();
                }}
                className="px-4 py-2 rounded-xl border border-stone-700 hover:border-red-500/50 text-stone-300 hover:text-red-400 font-semibold transition self-start sm:self-auto flex items-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Cerrar Sesión</span>
              </button>
            </div>

            {/* Acción B: Eliminar Cuenta */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-red-950/30 border border-red-800/40 text-xs">
              <div className="space-y-1">
                <span className="font-bold text-red-300 block">Eliminar Cuenta Permanentemente</span>
                <p className="text-red-300/70 text-[11px] leading-relaxed max-w-xl">
                  Se anonimizará tu perfil, se expirarán tus Dynamos activos y se removerán todos tus
                  seguimientos. El historial de transacciones se conservará anonimizado para integridad contable.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(true);
                  setDeleteConfirmationStep(1);
                  setDeleteInputText('');
                  setDeleteError(null);
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition shadow-sm self-start sm:self-auto shrink-0 flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar Cuenta</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE DOBLE CONFIRMACIÓN: ELIMINAR CUENTA */}
      {/* ========================================================================= */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-red-500/50 bg-[#14181F] p-6 text-stone-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-red-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-white">
                {deleteConfirmationStep === 1
                  ? 'Confirmación 1/2: ¿Eliminar cuenta de Dynamo?'
                  : 'Confirmación 2/2: Verificación obligatoria'}
              </h3>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs">
                {deleteError}
              </div>
            )}

            {deleteConfirmationStep === 1 ? (
              <div className="space-y-3 text-xs text-stone-300 leading-relaxed">
                <p>
                  Estás a punto de solicitar la <strong>desactivación y eliminación total</strong> de tu
                  cuenta en Dynamo.
                </p>
                <ul className="list-disc list-inside space-y-1 text-stone-400 text-[11px] pl-1">
                  <li>Tu nombre de usuario quedará disociado y anonimizado.</li>
                  <li>Tus Dynamos activos expirarán y dejarán de ser visibles.</li>
                  <li>Tus listas de seguidores y amigos se limpiarán.</li>
                  <li>Perderás el acceso permanentemente; esta acción no se puede deshacer.</li>
                </ul>
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-800">
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(false)}
                    className="px-4 py-2 rounded-xl text-stone-400 hover:text-white transition text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmationStep(2)}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition"
                  >
                    Continuar a la verificación final
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-stone-300">
                <p>
                  Para confirmar irrevocablemente la eliminación, escribe la palabra{' '}
                  <strong className="text-red-400 font-mono">ELIMINAR</strong> a continuación:
                </p>
                <input
                  type="text"
                  value={deleteInputText}
                  onChange={(e) => setDeleteInputText(e.target.value)}
                  placeholder="Escribe ELIMINAR"
                  className="w-full rounded-xl border border-red-500/40 bg-[#0D1217] p-2.5 text-xs text-white font-mono focus:border-red-400 focus:outline-none"
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-800">
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(false)}
                    disabled={isDeletingAccount}
                    className="px-4 py-2 rounded-xl text-stone-400 hover:text-white transition text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={isDeletingAccount || deleteInputText.trim().toUpperCase() !== 'ELIMINAR'}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition disabled:opacity-40"
                  >
                    {isDeletingAccount && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirmar y Destruir Cuenta</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Reutilizable de Documentos Legales */}
      {viewingLegalDoc && (
        <LegalDocsModal
          initialDoc={viewingLegalDoc}
          isOpen={Boolean(viewingLegalDoc)}
          onClose={() => setViewingLegalDoc(null)}
        />
      )}
    </div>
  );
};
