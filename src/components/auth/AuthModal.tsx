import React, { useState, useEffect } from 'react';
import { X, Zap, Lock, Mail, User, AlertCircle, CheckCircle2, Shield, FileText, HeartHandshake, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/src/modules/auth/AuthContext';
import {
  validateEmail,
  validatePassword,
  validateUsername,
  AUTH_LIMITS,
} from '@/src/modules/auth/authValidation';
import { systemConfigService } from '@/src/modules/systemConfig/systemConfigService';
import { LegalDocsModal, LegalDocType } from '@/src/components/legal/LegalDocsModal';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register' | 'forgot_password' | 'reset_password';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
}) => {
  const { signIn, signUp, sendPasswordReset, updatePassword, isRecoveryMode } = useAuth();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot_password' | 'reset_password'>(
    isRecoveryMode ? 'reset_password' : initialMode
  );

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Legal & Age checks
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedCommunity, setAcceptedCommunity] = useState(false);
  const [isAgeConfirmed, setIsAgeConfirmed] = useState(false);

  // Status & Feedback
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Legal Modal / Viewer tab
  const [viewingLegalDoc, setViewingLegalDoc] = useState<LegalDocType | null>(null);

  useEffect(() => {
    if (isRecoveryMode) {
      setMode('reset_password');
    } else if (isOpen) {
      setMode(initialMode);
    }
    setError(null);
    setSuccessMessage(null);
  }, [isOpen, initialMode, isRecoveryMode]);

  if (!isOpen) return null;

  const handleResetForm = () => {
    setPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccessMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        const emailValidation = validateEmail(email);
        if (!emailValidation.isValid) {
          throw new Error(emailValidation.error);
        }
        if (!password) {
          throw new Error('Ingresa tu contraseña.');
        }

        await signIn({ email, password });
        onClose();
      } else if (mode === 'register') {
        // Validation checks
        const emailValidation = validateEmail(email);
        if (!emailValidation.isValid) throw new Error(emailValidation.error);

        // Check system settings for registrations
        try {
          const settings = await systemConfigService.getSettings();
          if (settings.emergency_mode) {
            throw new Error('El sistema se encuentra en modo de emergencia. Nuevos registros no permitidos temporalmente.');
          }
          if (settings.allow_new_registrations === false || settings.allow_registrations === false) {
            throw new Error('Los registros de nuevas cuentas se encuentran pausados temporalmente por administración.');
          }
        } catch (confErr: any) {
          if (confErr.message.includes('modo de emergencia') || confErr.message.includes('pausados')) {
            throw confErr;
          }
        }

        const usernameValidation = validateUsername(username);
        if (!usernameValidation.isValid) throw new Error(usernameValidation.error);

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) throw new Error(passwordValidation.error);

        if (password !== confirmPassword) {
          throw new Error('Las contraseñas no coinciden.');
        }

        if (!acceptedTerms || !acceptedPrivacy || !acceptedCommunity) {
          throw new Error('Debes aceptar los Términos, la Política de Privacidad y las Normas de la Comunidad.');
        }

        if (!isAgeConfirmed) {
          throw new Error(`Debes certificar que tienes al menos ${AUTH_LIMITS.MIN_AGE} años.`);
        }

        await signUp({
          email,
          password,
          confirmPassword,
          username,
          acceptedTerms,
          acceptedPrivacy,
          acceptedCommunityGuidelines: acceptedCommunity,
          isAgeConfirmed,
        });
        onClose();
      } else if (mode === 'forgot_password') {
        const emailValidation = validateEmail(email);
        if (!emailValidation.isValid) throw new Error(emailValidation.error);

        const res = await sendPasswordReset({ email });
        setSuccessMessage(res.message);
      } else if (mode === 'reset_password') {
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) throw new Error(passwordValidation.error);

        if (password !== confirmPassword) {
          throw new Error('Las contraseñas no coinciden.');
        }

        await updatePassword({ newPassword: password, confirmPassword });
        setSuccessMessage('Tu contraseña ha sido actualizada con éxito. Ya puedes ingresar.');
        setTimeout(() => {
          setMode('login');
          handleResetForm();
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error. Por favor intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-md my-auto rounded-2xl border border-[#262E38] bg-[#12161A] p-5 sm:p-6 shadow-2xl text-stone-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#21272E] mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 text-black font-bold">
              <Zap className="h-4 w-4 fill-black" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                {mode === 'login' && 'Iniciar Sesión'}
                {mode === 'register' && 'Crear Cuenta en Dynamo'}
                {mode === 'forgot_password' && 'Recuperar Contraseña'}
                {mode === 'reset_password' && 'Restablecer Contraseña'}
              </h3>
              <p className="text-[11px] text-stone-400">
                {mode === 'login' && 'Accede a tus pensamientos y pulso de energía.'}
                {mode === 'register' && 'Únete al microcontenido efímero comunitario.'}
                {mode === 'forgot_password' && 'Te enviaremos un enlace seguro.'}
                {mode === 'reset_password' && 'Define tu nueva clave de acceso.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800/60 transition"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher (only for login/register modes) */}
        {(mode === 'login' || mode === 'register') && (
          <div className="flex rounded-xl bg-[#161D24] p-1 mb-4 border border-[#232D38]">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                handleResetForm();
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                mode === 'login' ? 'bg-amber-500 text-black shadow-xs' : 'text-stone-400 hover:text-white'
              }`}
            >
              Ingresar
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                handleResetForm();
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                mode === 'register' ? 'bg-amber-500 text-black shadow-xs' : 'text-stone-400 hover:text-white'
              }`}
            >
              Registro (16+)
            </button>
          </div>
        )}

        {/* Alerts */}
        {error && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-red-950/40 border border-red-800/60 p-3 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 p-3 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{successMessage}</span>
          </div>
        )}

        {/* Main Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* USERNAME FIELD (Register only) */}
          {mode === 'register' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-stone-300">Nombre de usuario</label>
                <span className="text-[10px] text-stone-400">3-20 caracteres, letras, números y _</span>
              </div>
              <div className="relative">
                <span className="text-stone-400 absolute left-3 top-2 text-xs font-bold">@</span>
                <input
                  id="auth-username"
                  type="text"
                  required
                  autoComplete="username"
                  maxLength={AUTH_LIMITS.USERNAME_MAX_LENGTH}
                  placeholder="ej. valeria_m"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  className="w-full rounded-xl bg-[#0E1216] border border-[#262E38] pl-8 pr-3 py-2 text-xs text-stone-100 placeholder-stone-400 focus:border-amber-500 focus:outline-hidden"
                />
              </div>
            </div>
          )}

          {/* EMAIL FIELD (Login, Register, Forgot Password) */}
          {mode !== 'reset_password' && (
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl bg-[#0E1216] border border-[#262E38] pl-9 pr-3 py-2 text-xs text-stone-100 placeholder-stone-400 focus:border-amber-500 focus:outline-hidden"
                />
              </div>
              {mode === 'register' && (
                <p className="text-[10px] text-stone-400 mt-1">
                  Tu correo es privado y nunca se mostrará en tu perfil público.
                </p>
              )}
            </div>
          )}

          {/* PASSWORD FIELD (Login, Register, Reset Password) */}
          {mode !== 'forgot_password' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-stone-300">
                  {mode === 'reset_password' ? 'Nueva Contraseña' : 'Contraseña'}
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot_password');
                      handleResetForm();
                    }}
                    className="text-[11px] text-amber-400 hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  placeholder="Mínimo 8 caracteres (letras y números)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl bg-[#0E1216] border border-[#262E38] pl-9 pr-10 py-2 text-xs text-stone-100 placeholder-stone-400 focus:border-amber-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-300"
                  title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* CONFIRM PASSWORD FIELD (Register & Reset Password) */}
          {(mode === 'register' || mode === 'reset_password') && (
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">
                Confirmar Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  id="auth-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  placeholder="Repite la contraseña exactamente"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl bg-[#0E1216] border border-[#262E38] pl-9 pr-10 py-2 text-xs text-stone-100 placeholder-stone-400 focus:border-amber-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-300"
                  title={showConfirmPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* MANDATORY LEGAL & AGE CHECKBOXES (Register only) */}
          {mode === 'register' && (
            <div className="space-y-2 pt-2 border-t border-[#1F2730] text-xs">
              {/* Age confirmation */}
              <label className="flex items-start gap-2.5 cursor-pointer text-stone-300 hover:text-white select-none">
                <input
                  type="checkbox"
                  checked={isAgeConfirmed}
                  onChange={(e) => setIsAgeConfirmed(e.target.checked)}
                  className="mt-0.5 rounded border-[#262E38] text-amber-500 focus:ring-amber-500 bg-[#0E1216]"
                />
                <span className="text-[11px] leading-tight">
                  Tengo <strong>al menos {AUTH_LIMITS.MIN_AGE} años</strong> de edad cumplidos.
                </span>
              </label>

              {/* Terms and Privacy */}
              <label className="flex items-start gap-2.5 cursor-pointer text-stone-300 hover:text-white select-none">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 rounded border-[#262E38] text-amber-500 focus:ring-amber-500 bg-[#0E1216]"
                />
                <span className="text-[11px] leading-tight">
                  Acepto los{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setViewingLegalDoc('terms');
                    }}
                    className="text-amber-400 underline hover:text-amber-300"
                  >
                    Términos de Servicio
                  </button>
                  .
                </span>
              </label>

              {/* Privacy Policy */}
              <label className="flex items-start gap-2.5 cursor-pointer text-stone-300 hover:text-white select-none">
                <input
                  type="checkbox"
                  checked={acceptedPrivacy}
                  onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                  className="mt-0.5 rounded border-[#262E38] text-amber-500 focus:ring-amber-500 bg-[#0E1216]"
                />
                <span className="text-[11px] leading-tight">
                  Acepto la{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setViewingLegalDoc('privacy');
                    }}
                    className="text-amber-400 underline hover:text-amber-300"
                  >
                    Política de Privacidad
                  </button>{' '}
                  (sin rastreo comercial).
                </span>
              </label>

              {/* Community Guidelines */}
              <label className="flex items-start gap-2.5 cursor-pointer text-stone-300 hover:text-white select-none">
                <input
                  type="checkbox"
                  checked={acceptedCommunity}
                  onChange={(e) => setAcceptedCommunity(e.target.checked)}
                  className="mt-0.5 rounded border-[#262E38] text-amber-500 focus:ring-amber-500 bg-[#0E1216]"
                />
                <span className="text-[11px] leading-tight">
                  Acepto las{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setViewingLegalDoc('community');
                    }}
                    className="text-amber-400 underline hover:text-amber-300"
                  >
                    Normas de la Comunidad
                  </button>
                  .
                </span>
              </label>
            </div>
          )}

          {/* Submit Button */}
          <button
            id="auth-submit-btn"
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-amber-500 py-2.5 text-xs font-bold text-black hover:bg-amber-400 active:scale-98 transition shadow-md shadow-amber-500/20 disabled:opacity-50 mt-2"
          >
            {isSubmitting ? (
              'Procesando...'
            ) : mode === 'login' ? (
              'Iniciar Sesión'
            ) : mode === 'register' ? (
              'Completar Registro'
            ) : mode === 'forgot_password' ? (
              'Enviar Enlace de Recuperación'
            ) : (
              'Guardar Nueva Contraseña'
            )}
          </button>
        </form>

        {/* Footer Navigation */}
        <div className="mt-4 pt-3 border-t border-[#1F2730] text-center text-xs text-stone-400">
          {mode === 'forgot_password' && (
            <button
              type="button"
              onClick={() => {
                setMode('login');
                handleResetForm();
              }}
              className="text-stone-300 hover:text-amber-400 transition"
            >
              ← Volver al inicio de sesión
            </button>
          )}

          {mode === 'login' && (
            <p>
              ¿No tienes cuenta en Dynamo?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  handleResetForm();
                }}
                className="font-semibold text-amber-400 hover:underline ml-1"
              >
                Regístrate aquí
              </button>
            </p>
          )}

          {mode === 'register' && (
            <p>
              ¿Ya tienes cuenta?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  handleResetForm();
                }}
                className="font-semibold text-amber-400 hover:underline ml-1"
              >
                Ingresa aquí
              </button>
            </p>
          )}
        </div>
      </div>

      {/* Configurable Legal Document Modal */}
      {viewingLegalDoc && (
        <LegalDocsModal
          isOpen={Boolean(viewingLegalDoc)}
          onClose={() => setViewingLegalDoc(null)}
          initialDoc={viewingLegalDoc}
        />
      )}
    </div>
  );
};
