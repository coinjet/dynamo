import React, { useState } from 'react';
import { Mail, CheckCircle2, AlertTriangle, Loader2, LogOut, RefreshCw } from 'lucide-react';

interface EmailConfirmationGateProps {
  email: string;
  onResend: () => Promise<void>;
  onCheckConfirmation: () => Promise<boolean>;
  onSignOut: () => Promise<void>;
}

export const EmailConfirmationGate: React.FC<EmailConfirmationGateProps> = ({
  email,
  onResend,
  onCheckConfirmation,
  onSignOut,
}) => {
  const [isResending, setIsResending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleResend = async () => {
    setIsResending(true);
    setFeedback(null);
    try {
      await onResend();
      setFeedback({
        type: 'success',
        message: 'Correo de confirmación reenviado exitosamente. Revisa tu bandeja de entrada o carpeta de spam.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'No se pudo reenviar el correo en este momento. Intenta de nuevo más tarde.',
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleCheck = async () => {
    setIsChecking(true);
    setFeedback(null);
    try {
      const isConfirmed = await onCheckConfirmation();
      if (!isConfirmed) {
        setFeedback({
          type: 'error',
          message: 'Tu correo aún no aparece como confirmado. Si ya hiciste clic en el enlace, espera unos segundos e intenta nuevamente.',
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        message: 'No se pudo verificar el estado en este momento. Intenta de nuevo.',
      });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div
      id="screen-email-confirmation-gate"
      className="min-h-[75vh] flex items-center justify-center px-4 py-8"
    >
      <div className="w-full max-w-md bg-[#13181E] border border-[#1F262E] rounded-2xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
        {/* Visual Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
          <Mail className="w-8 h-8 animate-pulse" />
        </div>

        {/* Heading & Notice */}
        <div className="space-y-2">
          <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            Confirma tu correo para activar tu cuenta de Dynamo.
          </h1>
          <p className="text-xs sm:text-sm text-stone-400 leading-relaxed">
            Hemos enviado un enlace de verificación a:
          </p>
          <div className="inline-block px-3 py-1 rounded-lg bg-[#0E1216] border border-stone-800 text-amber-300 font-mono text-xs font-semibold break-all">
            {email}
          </div>
          <p className="text-xs text-stone-400 leading-relaxed pt-2">
            Por seguridad de la comunidad y para habilitar tu acceso al Feed, creación de Dynamos, respuestas y transmisión de ⚡, debes confirmar tu correo antes de continuar.
          </p>
        </div>

        {/* Feedback Message */}
        {feedback && (
          <div
            className={`p-3 rounded-xl text-xs flex items-start gap-2.5 text-left ${
              feedback.type === 'success'
                ? 'bg-emerald-950/70 border border-emerald-800/80 text-emerald-200'
                : 'bg-red-950/70 border border-red-800/80 text-red-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <button
            id="btn-resend-confirmation-email"
            type="button"
            disabled={isResending || isChecking}
            onClick={handleResend}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs tracking-wide transition shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {isResending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Reenviando correo...</span>
              </>
            ) : (
              <>
                <Mail className="w-4 h-4" />
                <span>Reenviar correo de confirmación</span>
              </>
            )}
          </button>

          <button
            id="btn-check-confirmation-status"
            type="button"
            disabled={isChecking || isResending}
            onClick={handleCheck}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-stone-800/80 hover:bg-stone-700/80 border border-stone-700/60 text-stone-200 text-xs font-medium transition cursor-pointer disabled:opacity-50"
          >
            {isChecking ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Comprobando activación...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Ya he confirmado mi correo (Comprobar)</span>
              </>
            )}
          </button>
        </div>

        {/* Logout Option */}
        <div className="pt-2 border-t border-stone-800/80">
          <button
            id="btn-signout-unconfirmed-user"
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </div>
    </div>
  );
};
