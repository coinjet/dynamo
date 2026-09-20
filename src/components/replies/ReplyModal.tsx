import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Send, AlertTriangle, Flag, Shield, Loader2 } from 'lucide-react';
import { Dynamo } from '@/src/modules/dynamos/dynamosTypes';
import { Reply } from '@/src/modules/replies/repliesTypes';
import { getDynamoTimeStatus } from '@/src/modules/dynamos/dynamoRules';
import { repliesService } from '@/src/modules/replies/repliesService';
import { useAuth } from '@/src/modules/auth/AuthContext';
import { formatUserFriendlyError } from '@/src/utils/errorHandler';

interface ReplyModalProps {
  isOpen: boolean;
  dynamo: Dynamo | null;
  onClose: () => void;
  onSubmitReply: (dynamoId: string, content: string) => Promise<void>;
  onReportReply?: (replyId: string, targetAuthorId?: string) => void;
}

export const ReplyModal: React.FC<ReplyModalProps> = ({
  isOpen,
  dynamo,
  onClose,
  onSubmitReply,
  onReportReply,
}) => {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);

  useEffect(() => {
    if (isOpen && dynamo) {
      setContent('');
      setError(null);
      setIsLoadingReplies(true);
      repliesService
        .getReplies(dynamo.id)
        .then((fetched) => setReplies(fetched))
        .catch(() => setReplies([]))
        .finally(() => setIsLoadingReplies(false));
    }
  }, [isOpen, dynamo?.id]);

  if (!isOpen || !dynamo) return null;

  const isHiddenByModeration = dynamo.status === 'hidden';
  const timeStatus = getDynamoTimeStatus(dynamo.created_at, dynamo.expires_at);
  const charsRemaining = 280 - content.length;
  const isOverLimit = charsRemaining < 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError('Sin conexión. Inténtalo nuevamente cuando tengas internet.');
      return;
    }

    if (isHiddenByModeration) {
      setError('Este Dynamo ha sido ocultado por moderación y no acepta respuestas.');
      return;
    }

    if (timeStatus.isExpired) {
      setError('Este Dynamo ha expirado y ya no acepta respuestas.');
      return;
    }

    const trimmed = content.trim();
    if (!trimmed) {
      setError('Escribe una respuesta antes de enviar.');
      return;
    }

    if (trimmed.length > 280) {
      setError('La respuesta no puede superar los 280 caracteres.');
      return;
    }

    const sanitized = trimmed.replace(/[<>]/g, '');

    setIsSubmitting(true);
    try {
      await onSubmitReply(dynamo.id, sanitized);
      setContent('');
      // Reload replies list
      const updated = await repliesService.getReplies(dynamo.id);
      setReplies(updated);
    } catch (err: unknown) {
      setError(formatUserFriendlyError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-xs">
      <div
        id="modal-reply-container"
        className="w-full max-w-lg rounded-2xl border border-[#262E38] bg-[#12161A] p-4 sm:p-6 shadow-2xl text-stone-200 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#21272E] mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-800 text-amber-400">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                Respuestas a @{dynamo.author?.username || 'usuario'}
              </h3>
              <span className="text-[11px] text-stone-400 font-mono">
                {isHiddenByModeration ? 'Ocultado por moderación' : timeStatus.formattedTimeRemaining}
              </span>
            </div>
          </div>
          <button
            id="btn-close-reply-modal"
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable conversation section */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
          {/* Original Dynamo Context Preview */}
          <div className="rounded-xl bg-[#0E1216] border border-[#21272E] p-3 text-xs text-stone-300">
            <div className="flex items-center justify-between mb-1 text-[11px] text-stone-400">
              <span className="font-semibold text-stone-200">@{dynamo.author?.username}</span>
              <span>
                {new Date(dynamo.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <p className="line-clamp-3 text-stone-300 italic">{dynamo.content}</p>
          </div>

          {/* List of existing replies */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-stone-400 px-1">
              <span>Respuestas de la comunidad ({replies.length})</span>
            </div>

            {isLoadingReplies ? (
              <div className="py-4 text-center text-xs text-stone-400">Cargando respuestas...</div>
            ) : replies.length === 0 ? (
              <div className="py-4 text-center text-xs text-stone-400 bg-[#0E1216]/50 rounded-xl border border-stone-800/40">
                Aún no hay respuestas activas.
              </div>
            ) : (
              <div className="space-y-2">
                {replies.map((reply) => {
                  const isOwnReply = Boolean(user && user.id === reply.user_id);
                  return (
                    <div
                      key={reply.id}
                      className="rounded-xl bg-[#0E1216] border border-[#1E252D] p-3 text-xs text-stone-300 relative group"
                    >
                      <div className="flex items-center justify-between mb-1 text-[11px] text-stone-400">
                        <span className="font-medium text-stone-300">
                          @{reply.author?.username || 'anónimo'}
                          {isOwnReply && <span className="ml-1 text-amber-400/80">(tú)</span>}
                        </span>
                        <div className="flex items-center gap-2">
                          <span>
                            {new Date(reply.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>

                          {/* Report reply action */}
                          {!isOwnReply && onReportReply && (
                            <button
                              id={`btn-report-reply-${reply.id}`}
                              onClick={() => onReportReply(reply.id, reply.user_id)}
                              className="p-1 rounded text-stone-400 hover:text-red-400 hover:bg-red-950/30 transition"
                              title="Reportar esta respuesta"
                            >
                              <Flag className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-stone-200 break-words whitespace-pre-wrap">{reply.content}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Expiration, moderation or general error notice */}
        {isHiddenByModeration ? (
          <div className="rounded-xl bg-red-950/40 border border-red-500/40 p-2.5 text-xs text-red-300 flex items-center gap-2 my-2 shrink-0">
            <Shield className="w-4 h-4 text-red-400 shrink-0" />
            <span>Contenido ocultado por moderación. No se admiten respuestas.</span>
          </div>
        ) : timeStatus.isExpired ? (
          <div className="rounded-xl bg-red-950/40 border border-red-500/40 p-2.5 text-xs text-red-300 flex items-center gap-2 my-2 shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>Este Dynamo ya expiró y queda sellado sin admitir respuestas.</span>
          </div>
        ) : error ? (
          <div className="rounded-xl bg-red-950/40 border border-red-500/40 p-2.5 text-xs text-red-300 flex items-center gap-2 my-2 shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {/* Reply submission form */}
        {!timeStatus.isExpired && !isHiddenByModeration && (
          <form onSubmit={handleSubmit} className="space-y-2 pt-3 border-t border-[#1F2730] shrink-0">
            <div className="relative">
              <textarea
                id="input-reply-content"
                rows={2}
                maxLength={300}
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Escribe tu respuesta concisa (máx. 280 caracteres)..."
                className="w-full rounded-xl bg-[#0E1216] border border-[#232D38] p-2.5 text-xs sm:text-sm text-stone-100 placeholder-stone-400 focus:border-amber-500 focus:outline-hidden resize-none leading-relaxed"
              />
              <div
                className={`absolute bottom-2 right-2 text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  isOverLimit
                    ? 'bg-red-500/20 text-red-400 font-bold'
                    : charsRemaining < 20
                    ? 'bg-amber-500/20 text-amber-300 font-semibold'
                    : 'bg-stone-800/80 text-stone-400'
                }`}
              >
                {charsRemaining}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                id="btn-cancel-reply"
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-medium text-stone-400 hover:text-white transition"
              >
                Cerrar
              </button>
              <button
                type="submit"
                id="btn-submit-reply"
                disabled={isSubmitting || isOverLimit || !content.trim()}
                className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-black hover:bg-amber-400 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5 stroke-[2.5]" />
                )}
                <span>{isSubmitting ? 'Enviando...' : 'Responder'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
