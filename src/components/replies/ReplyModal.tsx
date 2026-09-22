import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  MessageSquare,
  Send,
  AlertTriangle,
  Flag,
  Shield,
  Loader2,
  Info,
  CornerDownRight,
  RotateCcw,
} from 'lucide-react';
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
  onSubmitReply: (dynamoId: string, content: string, parentReplyId?: string | null) => Promise<void>;
  onReportReply?: (replyId: string, targetAuthorId?: string) => void;
  focusedReplyId?: string | null;
  onClearFocusedReply?: () => void;
}

interface ReplyingTarget {
  replyId: string;
  authorUsername: string;
  rootParentId: string;
}

export const ReplyModal: React.FC<ReplyModalProps> = ({
  isOpen,
  dynamo,
  onClose,
  onSubmitReply,
  onReportReply,
  focusedReplyId,
  onClearFocusedReply,
}) => {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ReplyingTarget | null>(null);
  const [highlightedReplyId, setHighlightedReplyId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isOpen && dynamo) {
      setContent('');
      setError(null);
      setReplyingTo(null);
      setIsLoadingReplies(true);
      repliesService
        .getReplies(dynamo.id)
        .then((fetched) => setReplies(fetched))
        .catch(() => setReplies([]))
        .finally(() => setIsLoadingReplies(false));
    }
  }, [isOpen, dynamo?.id]);

  // Handle focusing specific reply from notification click
  useEffect(() => {
    if (focusedReplyId && replies.length > 0) {
      setHighlightedReplyId(focusedReplyId);
      const timer = setTimeout(() => {
        const el = document.getElementById(`reply-item-${focusedReplyId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);

      const clearTimer = setTimeout(() => {
        setHighlightedReplyId(null);
        if (onClearFocusedReply) onClearFocusedReply();
      }, 5000);

      return () => {
        clearTimeout(timer);
        clearTimeout(clearTimer);
      };
    }
  }, [focusedReplyId, replies, onClearFocusedReply]);

  // Max 2-level conversation grouping:
  // Roots (Level 1): parent_reply_id is null (or orphan)
  // Children (Level 2): parent_reply_id is present
  const { roots, childrenMap } = useMemo(() => {
    const rootList: Reply[] = [];
    const childMap: Record<string, Reply[]> = {};
    const replyIdSet = new Set(replies.map((r) => r.id));

    // 1. Collect roots
    replies.forEach((r) => {
      if (!r.parent_reply_id || !replyIdSet.has(r.parent_reply_id)) {
        rootList.push(r);
      }
    });

    // 2. Attach children to their root thread to enforce max 2 visual levels
    replies.forEach((r) => {
      if (r.parent_reply_id && replyIdSet.has(r.parent_reply_id)) {
        let rootAncestorId = r.parent_reply_id;
        const visited = new Set<string>();

        while (rootAncestorId && visited.size < 10) {
          visited.add(rootAncestorId);
          const parentObj = replies.find((p) => p.id === rootAncestorId);
          if (parentObj && parentObj.parent_reply_id && replyIdSet.has(parentObj.parent_reply_id)) {
            rootAncestorId = parentObj.parent_reply_id;
          } else {
            break;
          }
        }

        if (!childMap[rootAncestorId]) {
          childMap[rootAncestorId] = [];
        }
        childMap[rootAncestorId].push(r);
      }
    });

    return { roots: rootList, childrenMap: childMap };
  }, [replies]);

  if (!isOpen || !dynamo) return null;

  const isHiddenByModeration = dynamo.status === 'hidden';
  const isOwner = Boolean(user?.id && dynamo.user_id === user.id);
  const timeStatus = getDynamoTimeStatus(dynamo.created_at, dynamo.expires_at);
  const charsRemaining = 280 - content.length;
  const isOverLimit = charsRemaining < 0;

  const handleStartReplyTo = (reply: Reply, rootParentId: string) => {
    const authorUsername = reply.author?.username || 'usuario';
    setReplyingTo({
      replyId: reply.id,
      authorUsername,
      rootParentId,
    });
    setError(null);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleCancelReplyTo = () => {
    setReplyingTo(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);

    // Rule: Owner cannot reply directly to Dynamo, but CAN reply to participant comments
    if (isOwner && !replyingTo) {
      setError('No puedes responder directamente a tu propio Dynamo. Pulsa "Responder" en un comentario para participar.');
      return;
    }

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
      await onSubmitReply(dynamo.id, sanitized, replyingTo?.replyId || null);
      setContent('');
      setReplyingTo(null);
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
                Conversación · @{dynamo.author?.username || 'usuario'}
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
          {/* Original Dynamo Context Preview (Nivel 0) */}
          <div className="rounded-xl bg-[#0E1216] border border-[#21272E] p-3 text-xs text-stone-300">
            <div className="flex items-center justify-between mb-1.5 text-[11px] text-stone-400">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-stone-200">@{dynamo.author?.username}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 font-medium">
                  Autor
                </span>
              </div>
              <span className="text-[10px]">
                {new Date(dynamo.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <p className="line-clamp-4 text-stone-200 text-xs sm:text-sm leading-relaxed">{dynamo.content}</p>
          </div>

          {/* List of existing replies (Nivel 1 & Nivel 2) */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-stone-400 px-1">
              <span>Respuestas ({replies.length})</span>
              <span className="text-[10px] text-stone-400">Máx. 2 niveles</span>
            </div>

            {isLoadingReplies ? (
              <div className="py-6 text-center text-xs text-stone-400">Cargando respuestas...</div>
            ) : replies.length === 0 ? (
              <div className="py-6 text-center text-xs text-stone-400 bg-[#0E1216]/50 rounded-xl border border-stone-800/40 px-4">
                Aún no hay respuestas en este Dynamo. Sé el primero en iniciar la conversación.
              </div>
            ) : (
              <div className="space-y-3">
                {roots.map((rootReply) => {
                  const isOwnRootReply = Boolean(user && user.id === rootReply.user_id);
                  const isRootDynamoAuthor = Boolean(rootReply.user_id === dynamo.user_id);
                  const children = childrenMap[rootReply.id] || [];
                  const isRootHighlighted = highlightedReplyId === rootReply.id;

                  return (
                    <div key={rootReply.id} className="space-y-2">
                      {/* NIVEL 1: RESPUESTA DIRECTA AL DYNAMO */}
                      <div
                        id={`reply-item-${rootReply.id}`}
                        className={`rounded-xl bg-[#0E1216] border p-3 text-xs transition-all duration-300 ${
                          isRootHighlighted
                            ? 'border-amber-400 bg-amber-500/10 ring-2 ring-amber-400/40 shadow-lg'
                            : 'border-[#1E252D] hover:border-stone-700 text-stone-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1 text-[11px] text-stone-400">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-stone-200">
                              @{rootReply.author?.username || 'anónimo'}
                            </span>
                            {isRootDynamoAuthor && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-400 font-medium">
                                Autor
                              </span>
                            )}
                            {isOwnRootReply && <span className="text-stone-400">(tú)</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px]">
                              {new Date(rootReply.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>

                            {/* Report reply action */}
                            {!isOwnRootReply && onReportReply && (
                              <button
                                id={`btn-report-reply-${rootReply.id}`}
                                onClick={() => onReportReply(rootReply.id, rootReply.user_id)}
                                className="p-1 rounded text-stone-400 hover:text-red-400 hover:bg-red-950/30 transition"
                                title="Reportar esta respuesta"
                              >
                                <Flag className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        <p className="text-stone-200 break-words whitespace-pre-wrap leading-relaxed">
                          {rootReply.content}
                        </p>

                        {/* Responder a esta respuesta (Nivel 1 -> Nivel 2) */}
                        {!timeStatus.isExpired && !isHiddenByModeration && !isOwnRootReply && (
                          <div className="mt-2 pt-1.5 border-t border-stone-800/40 flex items-center justify-end">
                            <button
                              id={`btn-reply-to-${rootReply.id}`}
                              type="button"
                              onClick={() => handleStartReplyTo(rootReply, rootReply.id)}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 hover:text-amber-300 hover:underline transition"
                            >
                              <CornerDownRight className="w-3 h-3" />
                              <span>Responder</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* NIVEL 2: RESPUESTAS A ESTA RESPUESTA */}
                      {children.length > 0 && (
                        <div className="space-y-1.5 pl-4 sm:pl-6 border-l-2 border-amber-500/20 ml-2">
                          {children.map((childReply) => {
                            const isOwnChildReply = Boolean(user && user.id === childReply.user_id);
                            const isChildDynamoAuthor = Boolean(childReply.user_id === dynamo.user_id);
                            const isChildHighlighted = highlightedReplyId === childReply.id;

                            return (
                              <div
                                key={childReply.id}
                                id={`reply-item-${childReply.id}`}
                                className={`rounded-xl bg-[#0A0D10] border p-2.5 text-xs transition-all duration-300 ${
                                  isChildHighlighted
                                    ? 'border-amber-400 bg-amber-500/15 ring-2 ring-amber-400/40 shadow-lg'
                                    : 'border-stone-800/70 hover:border-stone-700 text-stone-300'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1 text-[11px] text-stone-400">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-stone-400 text-[10px]">↳</span>
                                    <span className="font-semibold text-stone-200">
                                      @{childReply.author?.username || 'anónimo'}
                                    </span>
                                    {isChildDynamoAuthor && (
                                      <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-400 font-medium">
                                        Autor
                                      </span>
                                    )}
                                    {isOwnChildReply && <span className="text-stone-400">(tú)</span>}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px]">
                                      {new Date(childReply.created_at).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>

                                    {!isOwnChildReply && onReportReply && (
                                      <button
                                        id={`btn-report-reply-${childReply.id}`}
                                        onClick={() => onReportReply(childReply.id, childReply.user_id)}
                                        className="p-1 rounded text-stone-400 hover:text-red-400 hover:bg-red-950/30 transition"
                                        title="Reportar esta respuesta"
                                      >
                                        <Flag className="w-2.5 h-2.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <p className="text-stone-200 break-words whitespace-pre-wrap leading-relaxed text-[12px]">
                                  {childReply.content}
                                </p>

                                {/* Responder a este participante (Se agrupa en el mismo nivel 2) */}
                                {!timeStatus.isExpired && !isHiddenByModeration && !isOwnChildReply && (
                                  <div className="mt-1.5 pt-1 border-t border-stone-800/30 flex items-center justify-end">
                                    <button
                                      id={`btn-reply-to-${childReply.id}`}
                                      type="button"
                                      onClick={() => handleStartReplyTo(childReply, rootReply.id)}
                                      className="inline-flex items-center gap-1 text-[10.5px] font-medium text-amber-400/90 hover:text-amber-300 hover:underline transition"
                                    >
                                      <CornerDownRight className="w-2.5 h-2.5" />
                                      <span>Responder</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Notices & Alerts */}
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
        ) : isOwner && !replyingTo ? (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-2.5 text-xs text-amber-300 flex items-center gap-2 my-2 shrink-0">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Eres el autor de este Dynamo. Pulsa &quot;Responder&quot; en cualquier comentario para conversar con los participantes.</span>
          </div>
        ) : error ? (
          <div className="rounded-xl bg-red-950/40 border border-red-500/40 p-2.5 text-xs text-red-300 flex items-center gap-2 my-2 shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {/* Reply submission form */}
        {!timeStatus.isExpired && !isHiddenByModeration && (!isOwner || replyingTo) && (
          <form onSubmit={handleSubmit} className="space-y-2 pt-3 border-t border-[#1F2730] shrink-0">
            {/* Replying Target Indicator */}
            {replyingTo && (
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
                <div className="flex items-center gap-1.5">
                  <CornerDownRight className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    Respondiendo a <strong className="font-semibold text-white">@{replyingTo.authorUsername}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  id="btn-cancel-reply-target"
                  onClick={handleCancelReplyTo}
                  className="inline-flex items-center gap-1 text-[11px] text-stone-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-stone-800 transition"
                  title="Cancelar respuesta a este participante"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Cancelar</span>
                </button>
              </div>
            )}

            <div className="relative">
              <textarea
                ref={inputRef}
                id="input-reply-content"
                rows={2}
                maxLength={300}
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={
                  replyingTo
                    ? `Escribe tu respuesta a @${replyingTo.authorUsername}...`
                    : 'Escribe tu respuesta al Dynamo (máx. 280 caracteres)...'
                }
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
                className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-black hover:bg-amber-400 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5 stroke-[2.5]" />
                )}
                <span>
                  {isSubmitting
                    ? 'Enviando...'
                    : replyingTo
                    ? `Responder a @${replyingTo.authorUsername}`
                    : 'Responder'}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
