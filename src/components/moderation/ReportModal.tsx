import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';
import { moderationService } from '@/src/modules/moderation/moderationService';
import { ReportReason, REPORT_REASON_LABELS } from '@/src/modules/moderation/moderationTypes';
import { useAuth } from '@/src/modules/auth/AuthContext';

interface ReportModalProps {
  isOpen: boolean;
  dynamoId?: string | null;
  replyId?: string | null;
  targetAuthorId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  dynamoId,
  replyId,
  targetAuthorId,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [reason, setReason] = useState<ReportReason>('spam');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setReason('spam');
      setDescription('');
      setSubmitted(false);
      setErrorMessage(null);

      // Check self-reporting
      if (user && targetAuthorId && user.id === targetAuthorId) {
        setErrorMessage('No puedes reportar tu propio contenido.');
      }
    }
  }, [isOpen, dynamoId, replyId, targetAuthorId, user]);

  if (!isOpen || (!dynamoId && !replyId)) return null;

  const isSelf = Boolean(user && targetAuthorId && user.id === targetAuthorId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setErrorMessage('Debes iniciar sesión para reportar contenido.');
      return;
    }

    if (isSelf) {
      setErrorMessage('No puedes reportar tu propio contenido.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await moderationService.submitReport(
        {
          dynamoId: dynamoId || undefined,
          replyId: replyId || undefined,
          reason,
          description: description.trim() || undefined,
        },
        user.id
      );

      setSubmitted(true);
      onSuccess?.();

      setTimeout(() => {
        setSubmitted(false);
        onClose();
      }, 1600);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al enviar reporte.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isReply = Boolean(replyId);
  const charsRemaining = 300 - description.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div
        id="modal-report-content"
        className="w-full max-w-sm rounded-2xl border border-[#262E38] bg-[#12161A] p-5 shadow-2xl text-stone-200 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#21272E] mb-4">
          <div className="flex items-center gap-2 text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            <h3 className="text-sm font-semibold text-white">
              {isReply ? 'Reportar Respuesta' : 'Reportar Publicación'}
            </h3>
          </div>
          <button
            id="btn-close-report-modal"
            onClick={onClose}
            className="p-1 rounded-md text-stone-400 hover:text-white hover:bg-stone-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="text-center py-6 text-emerald-400">
            <CheckCircle className="w-9 h-9 mx-auto mb-2 text-emerald-400" />
            <p className="text-xs font-semibold">Reporte enviado a moderación.</p>
            <p className="text-[11px] text-stone-400 mt-1">
              Gracias por ayudar a mantener la comunidad segura y libre de abuso.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {errorMessage && (
              <div className="rounded-xl bg-red-950/40 border border-red-500/40 p-2.5 text-xs text-red-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="select-report-reason"
                className="block text-xs font-medium text-stone-300 mb-1"
              >
                Motivo del reporte
              </label>
              <select
                id="select-report-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value as ReportReason)}
                disabled={isSelf || isSubmitting}
                className="w-full rounded-xl bg-[#0E1216] border border-stone-800 p-2.5 text-xs text-stone-200 focus:outline-hidden focus:border-amber-500"
              >
                <option value="harassment">{REPORT_REASON_LABELS.harassment}</option>
                <option value="violence">{REPORT_REASON_LABELS.violence}</option>
                <option value="doxxing">{REPORT_REASON_LABELS.doxxing}</option>
                <option value="sexual">{REPORT_REASON_LABELS.sexual}</option>
                <option value="spam">{REPORT_REASON_LABELS.spam}</option>
                <option value="fraud">{REPORT_REASON_LABELS.fraud}</option>
                <option value="impersonation">{REPORT_REASON_LABELS.impersonation}</option>
                <option value="hate_speech">{REPORT_REASON_LABELS.hate_speech}</option>
                <option value="other">{REPORT_REASON_LABELS.other}</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="input-report-description"
                  className="block text-xs font-medium text-stone-300"
                >
                  Comentario adicional (opcional)
                </label>
                <span
                  className={`text-[10px] font-mono ${
                    charsRemaining < 20 ? 'text-amber-400' : 'text-stone-400'
                  }`}
                >
                  {charsRemaining}
                </span>
              </div>
              <textarea
                id="input-report-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={300}
                disabled={isSelf || isSubmitting}
                placeholder="Añade contexto breve si es necesario (máx. 300 caracteres)..."
                className="w-full rounded-xl bg-[#0E1216] border border-stone-800 p-2.5 text-xs text-stone-200 focus:outline-hidden focus:border-amber-500 resize-none placeholder:text-stone-400"
              />
            </div>

            {/* Privacy indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0E1216] border border-[#1A2028] text-[11px] text-stone-400">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
              <span>Tu reporte es anónimo frente al autor reportado.</span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1C232B]">
              <button
                type="button"
                id="btn-cancel-report"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs text-stone-400 hover:text-white transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                id="btn-submit-report"
                disabled={isSubmitting || isSelf}
                className="rounded-xl bg-red-600/90 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Enviando...' : 'Enviar Reporte'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
