import React, { useState, useEffect } from 'react';
import { systemConfigService } from '@/src/modules/systemConfig/systemConfigService';
import {
  AdminAnnouncement,
  CommunicationType,
  CommunicationStatus,
} from '@/src/modules/systemConfig/systemConfigTypes';
import { adminService } from '@/src/modules/admin/adminService';
import { AdminUserItem } from '@/src/modules/admin/adminTypes';
import {
  Send,
  Users,
  User,
  Pin,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  MessageSquare,
  XCircle,
  Filter,
  Shield,
  Wrench,
  HeartHandshake,
  UserCheck,
} from 'lucide-react';

interface AdminCommunicationsProps {
  adminUserId: string;
}

const TYPE_CONFIG: Record<
  CommunicationType,
  { label: string; bg: string; text: string; border: string; icon: any }
> = {
  general: {
    label: 'General',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    icon: MessageSquare,
  },
  mantenimiento: {
    label: 'Mantenimiento',
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30',
    icon: Wrench,
  },
  seguridad: {
    label: 'Seguridad',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/30',
    icon: Shield,
  },
  comunidad: {
    label: 'Comunidad',
    bg: 'bg-sky-500/10',
    text: 'text-sky-400',
    border: 'border-sky-500/30',
    icon: HeartHandshake,
  },
  personal: {
    label: 'Personal',
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
    icon: UserCheck,
  },
};

const STATUS_CONFIG: Record<
  CommunicationStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  scheduled: {
    label: 'Programada (Pendiente)',
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
  },
  sent: {
    label: 'Enviada',
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
  },
  cancelled: {
    label: 'Cancelada',
    bg: 'bg-stone-800',
    text: 'text-stone-400',
    border: 'border-stone-700',
  },
  failed: {
    label: 'Fallida',
    bg: 'bg-red-500/15',
    text: 'text-red-400',
    border: 'border-red-500/30',
  },
};

export const AdminCommunications: React.FC<AdminCommunicationsProps> = ({ adminUserId }) => {
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);

  // Form State
  const [dispatchMode, setDispatchMode] = useState<'now' | 'schedule'>('now');
  const [communicationType, setCommunicationType] = useState<CommunicationType>('general');
  const [targetScope, setTargetScope] = useState<'general' | 'individual'>('general');
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isPinned, setIsPinned] = useState(false);

  // User picker for individual scope
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedUsername, setSelectedUsername] = useState<string>('');
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AdminUserItem[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  // Submission & Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // History Filter
  const [statusFilter, setStatusFilter] = useState<'all' | CommunicationStatus>('all');

  // Cancel Modal State
  const [cancellingItem, setCancellingItem] = useState<AdminAnnouncement | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const loadAnnouncements = async () => {
    setIsLoadingList(true);
    try {
      const data = await systemConfigService.getAnnouncements();
      setAnnouncements(data);
    } catch (err: any) {
      console.warn('Error loading announcements:', err);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const handleSearchUsers = async (query: string) => {
    setSearchUserQuery(query);
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearchingUsers(true);
    try {
      const res = await adminService.getUsers(
        { searchQuery: query.trim(), page: 1, pageSize: 5 },
        adminUserId
      );
      setSearchResults(res.items);
    } catch (err) {
      console.warn('Error searching users for message:', err);
    } finally {
      setIsSearchingUsers(false);
    }
  };

  const handleSelectUser = (u: AdminUserItem) => {
    setSelectedUserId(u.id);
    setSelectedUsername(u.username);
    setSearchResults([]);
    setSearchUserQuery('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!title.trim()) {
      setFeedback({ type: 'error', message: 'El título del comunicado es obligatorio.' });
      return;
    }
    if (!message.trim()) {
      setFeedback({ type: 'error', message: 'El cuerpo del mensaje es obligatorio.' });
      return;
    }
    if (targetScope === 'individual' && !selectedUserId) {
      setFeedback({
        type: 'error',
        message: 'Debes buscar y seleccionar un usuario objetivo para mensaje individual.',
      });
      return;
    }

    let isoScheduled: string | null = null;
    if (dispatchMode === 'schedule') {
      if (!scheduledDateTime) {
        setFeedback({
          type: 'error',
          message: 'Debes especificar una fecha y hora futura para programar el comunicado.',
        });
        return;
      }
      const targetTime = new Date(scheduledDateTime).getTime();
      if (isNaN(targetTime) || targetTime <= Date.now()) {
        setFeedback({
          type: 'error',
          message: 'La fecha y hora de programación debe ser estrictamente en el futuro.',
        });
        return;
      }
      isoScheduled = new Date(scheduledDateTime).toISOString();
    }

    setIsSubmitting(true);
    try {
      const result = await systemConfigService.sendAnnouncement(
        {
          target_scope: targetScope,
          target_user_id: targetScope === 'individual' ? selectedUserId : null,
          title: title.trim(),
          message: message.trim(),
          is_pinned: isPinned,
          communication_type: communicationType,
          scheduled_for: isoScheduled,
        },
        adminUserId
      );

      if (result.status === 'scheduled') {
        setFeedback({
          type: 'success',
          message: `Comunicado guardado como programado (scheduled) para el ${new Date(
            isoScheduled!
          ).toLocaleString('es-ES')}. Queda en espera de procesamiento por worker.`,
        });
      } else {
        setFeedback({
          type: 'success',
          message:
            targetScope === 'general'
              ? 'Comunicado general emitido exitosamente a toda la comunidad.'
              : `Mensaje directo oficial despachado a @${selectedUsername}.`,
        });
      }

      // Reset form
      setTitle('');
      setMessage('');
      setIsPinned(false);
      setSelectedUserId('');
      setSelectedUsername('');
      setScheduledDateTime('');
      setDispatchMode('now');
      loadAnnouncements();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error al procesar el comunicado administrativo.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelAnnouncement = async () => {
    if (!cancellingItem) return;
    setIsCancelling(true);
    try {
      await systemConfigService.cancelScheduledAnnouncement(
        cancellingItem.id,
        cancelReason.trim() || 'Cancelado desde panel de control',
        adminUserId
      );
      setFeedback({
        type: 'success',
        message: `Comunicado programado "${cancellingItem.title}" cancelado correctamente.`,
      });
      setCancellingItem(null);
      setCancelReason('');
      loadAnnouncements();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error al cancelar el comunicado.',
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const filteredAnnouncements = announcements.filter((a) => {
    if (statusFilter === 'all') return true;
    return a.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-[#161B21] border border-stone-800 rounded-xl p-5">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-amber-400" />
          <span>Comunicaciones Oficiales y Programadas</span>
        </h2>
        <p className="text-xs text-stone-400 mt-1">
          Envía comunicados inmediatos o programa emisiones de servicio. Los comunicados
          programados se registran de forma auditable en Supabase como <code>scheduled</code> hasta
          su procesamiento real.
        </p>
      </div>

      {/* Form Card */}
      <form
        onSubmit={handleSubmit}
        className="bg-[#161B21] border border-stone-800 rounded-xl p-5 space-y-4 shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <h3 className="text-xs font-semibold text-stone-200 uppercase tracking-wider">
            Nuevo Comunicado del Sistema
          </h3>
          <span className="text-[11px] text-stone-500 font-mono">
            Auditoría en <code>moderation_actions</code>
          </span>
        </div>

        {/* Dispatch Mode Toggle: Enviar ahora vs Programar */}
        <div className="space-y-1.5">
          <label className="text-xs text-stone-400 font-semibold block">Modo de Envío:</label>
          <div className="grid grid-cols-2 gap-2 max-w-md">
            <button
              type="button"
              onClick={() => setDispatchMode('now')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium border transition ${
                dispatchMode === 'now'
                  ? 'bg-amber-500 text-black border-amber-400 font-bold'
                  : 'bg-[#101418] text-stone-400 border-stone-800 hover:text-white'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Enviar Ahora</span>
            </button>

            <button
              type="button"
              onClick={() => setDispatchMode('schedule')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium border transition ${
                dispatchMode === 'schedule'
                  ? 'bg-amber-500 text-black border-amber-400 font-bold'
                  : 'bg-[#101418] text-stone-400 border-stone-800 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Programar Fecha y Hora</span>
            </button>
          </div>
        </div>

        {/* Date / Time Picker if Scheduled */}
        {dispatchMode === 'schedule' && (
          <div className="p-3.5 bg-[#101418] rounded-xl border border-amber-500/30 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-amber-400 font-semibold">
              <Clock className="w-4 h-4" />
              <span>Fecha y Hora Programada (UTC / Local):</span>
            </div>
            <input
              type="datetime-local"
              value={scheduledDateTime}
              onChange={(e) => setScheduledDateTime(e.target.value)}
              className="bg-[#161B21] border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
            />
            <p className="text-[11px] text-stone-400 leading-relaxed">
              El comunicado quedará almacenado en Supabase en estado{' '}
              <span className="font-mono text-amber-400">scheduled</span>. Dynamo no marcará este
              registro como enviado hasta que sea despachado efectivamente.
            </p>
          </div>
        )}

        {/* Communication Type Selector */}
        <div className="space-y-1.5">
          <label className="text-xs text-stone-400 font-semibold block">Tipo de Comunicado:</label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                'general',
                'mantenimiento',
                'seguridad',
                'comunidad',
                'personal',
              ] as CommunicationType[]
            ).map((t) => {
              const cfg = TYPE_CONFIG[t];
              const IconComp = cfg.icon;
              const isSelected = communicationType === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCommunicationType(t)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                    isSelected
                      ? `${cfg.bg} ${cfg.text} ${cfg.border} ring-1 ring-amber-400/50`
                      : 'bg-[#101418] text-stone-400 border-stone-800 hover:text-white'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span>{cfg.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scope Toggle: General vs Individual */}
        <div className="space-y-1.5">
          <label className="text-xs text-stone-400 font-semibold block">Destinatario:</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setTargetScope('general');
                setSelectedUserId('');
                setSelectedUsername('');
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition border ${
                targetScope === 'general'
                  ? 'bg-amber-500 text-black border-amber-400'
                  : 'bg-[#101418] text-stone-300 border-stone-800 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Toda la Comunidad (General)</span>
            </button>

            <button
              type="button"
              onClick={() => setTargetScope('individual')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition border ${
                targetScope === 'individual'
                  ? 'bg-amber-500 text-black border-amber-400'
                  : 'bg-[#101418] text-stone-300 border-stone-800 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Usuario Individual</span>
            </button>
          </div>
        </div>

        {/* Target User Selector (If individual) */}
        {targetScope === 'individual' && (
          <div className="p-3.5 bg-[#101418] rounded-xl border border-stone-800 space-y-2 text-xs">
            <label className="text-stone-300 font-semibold block">Seleccionar Usuario:</label>
            {selectedUserId ? (
              <div className="flex items-center justify-between p-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">
                <span className="font-mono font-bold">@{selectedUsername}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUserId('');
                    setSelectedUsername('');
                  }}
                  className="text-[11px] text-stone-400 hover:text-white underline"
                >
                  Cambiar usuario
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar por @nombre_usuario..."
                    value={searchUserQuery}
                    onChange={(e) => handleSearchUsers(e.target.value)}
                    className="w-full bg-[#161B21] border border-stone-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                  {isSearchingUsers && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400 absolute right-3 top-2.5" />
                  )}
                </div>

                {searchResults.length > 0 && (
                  <div className="divide-y divide-stone-800/80 bg-[#161B21] rounded-lg border border-stone-800 overflow-hidden">
                    {searchResults.map((u) => (
                      <div
                        key={u.id}
                        onClick={() => handleSelectUser(u)}
                        className="p-2 hover:bg-stone-800/60 cursor-pointer flex items-center justify-between transition"
                      >
                        <span className="font-mono text-stone-200">@{u.username}</span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-stone-800 text-stone-400">
                          {u.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Title */}
        <div>
          <label className="text-xs text-stone-400 block mb-1">Título del comunicado:</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej. Actualización obligatoria de seguridad o mantenimiento programado"
            maxLength={120}
            className="w-full bg-[#101418] border border-stone-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
          />
        </div>

        {/* Message */}
        <div>
          <label className="text-xs text-stone-400 block mb-1">Cuerpo del mensaje:</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Redacta las indicaciones oficiales, normas o detalles de servicio..."
            rows={4}
            maxLength={1000}
            className="w-full bg-[#101418] border border-stone-800 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-amber-400 resize-none"
          />
          <div className="text-right text-[10px] text-stone-500 font-mono">
            {message.length} / 1000
          </div>
        </div>

        {/* Options */}
        {targetScope === 'general' && (
          <label className="flex items-center gap-2 cursor-pointer text-xs text-stone-300">
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="rounded border-stone-700 bg-stone-800 text-amber-500 focus:ring-0"
            />
            <Pin className="w-3.5 h-3.5 text-amber-400" />
            <span>Fijar en cabecera comunitaria (visibilidad prioritaria)</span>
          </label>
        )}

        {/* Feedback Messages */}
        {feedback && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : 'bg-red-950/40 border-red-500/40 text-red-300'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition disabled:opacity-50 active:scale-95 shadow-md"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : dispatchMode === 'schedule' ? (
              <Calendar className="w-3.5 h-3.5" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>
              {dispatchMode === 'schedule'
                ? 'Guardar Programación en Supabase'
                : 'Publicar y Enviar Ahora'}
            </span>
          </button>
        </div>
      </form>

      {/* Announcements History */}
      <div className="bg-[#161B21] border border-stone-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-3">
          <div>
            <h3 className="text-xs font-semibold text-stone-200 uppercase tracking-wider flex items-center gap-2">
              <span>Historial y Programaciones</span>
              <span className="text-[11px] font-mono text-stone-400 lowercase">
                ({filteredAnnouncements.length} de {announcements.length})
              </span>
            </h3>
            <p className="text-[11px] text-stone-500">
              Registro completo de comunicados enviados, programados y cancelados.
            </p>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 bg-[#101418] p-1 rounded-lg border border-stone-800 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                statusFilter === 'all'
                  ? 'bg-amber-500 text-black font-semibold'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setStatusFilter('scheduled')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                statusFilter === 'scheduled'
                  ? 'bg-amber-500 text-black font-semibold'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Programados
            </button>
            <button
              onClick={() => setStatusFilter('sent')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                statusFilter === 'sent'
                  ? 'bg-amber-500 text-black font-semibold'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Enviados
            </button>
            <button
              onClick={() => setStatusFilter('cancelled')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                statusFilter === 'cancelled'
                  ? 'bg-amber-500 text-black font-semibold'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Cancelados
            </button>
          </div>
        </div>

        {isLoadingList ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
          </div>
        ) : filteredAnnouncements.length === 0 ? (
          <p className="text-xs text-stone-500 text-center py-8">
            No se encontraron comunicados con el filtro seleccionado.
          </p>
        ) : (
          <div className="divide-y divide-stone-800/80">
            {filteredAnnouncements.map((a) => {
              const typeCfg = TYPE_CONFIG[a.communication_type || 'general'] || TYPE_CONFIG.general;
              const statusCfg = STATUS_CONFIG[a.status || 'sent'] || STATUS_CONFIG.sent;
              const TypeIcon = typeCfg.icon;

              return (
                <div key={a.id} className="py-4 first:pt-0 last:pb-0 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-white text-xs">{a.title}</span>

                      {/* Type Badge */}
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] uppercase font-mono px-2 py-0.5 rounded border ${typeCfg.bg} ${typeCfg.text} ${typeCfg.border}`}
                      >
                        <TypeIcon className="w-3 h-3" />
                        {typeCfg.label}
                      </span>

                      {/* Status Badge */}
                      <span
                        className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                      >
                        {statusCfg.label}
                      </span>

                      {/* Target Scope Badge */}
                      <span
                        className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border ${
                          a.target_scope === 'general'
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                            : 'bg-sky-500/10 text-sky-300 border-sky-500/20'
                        }`}
                      >
                        {a.target_scope === 'general'
                          ? 'Comunidad'
                          : `@${a.target_username || 'usuario'}`}
                      </span>

                      {a.is_pinned && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-400 font-mono">
                          <Pin className="w-3 h-3" /> Fijado
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] font-mono text-stone-500 shrink-0">
                      {a.status === 'scheduled' && a.scheduled_for && (
                        <span className="text-amber-400/90 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Prog: {new Date(a.scheduled_for).toLocaleString('es-ES')}
                        </span>
                      )}
                      {a.status === 'sent' && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(a.sent_at || a.created_at).toLocaleString('es-ES')}
                        </span>
                      )}
                      {a.status === 'cancelled' && a.cancelled_at && (
                        <span className="text-stone-400 flex items-center gap-1">
                          <XCircle className="w-3 h-3 text-red-400" />
                          Cancelado: {new Date(a.cancelled_at).toLocaleDateString('es-ES')}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-stone-300 leading-relaxed whitespace-pre-wrap bg-[#101418] p-3 rounded-lg border border-stone-800/60">
                    {a.message}
                  </p>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-mono text-stone-500 pt-0.5">
                    <span>Emitido por: @{a.admin_username || 'admin'}</span>

                    {/* Action: Cancel scheduled communication */}
                    {a.status === 'scheduled' && (
                      <button
                        onClick={() => {
                          setCancellingItem(a);
                          setCancelReason('');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-red-950/40 border border-red-500/30 hover:bg-red-900/60 text-red-300 text-xs font-medium transition self-start sm:self-auto"
                      >
                        <XCircle className="w-3.5 h-3.5 text-red-400" />
                        <span>Cancelar Programación</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Confirmation for Cancelling Scheduled Announcement */}
      {cancellingItem && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#161B21] border border-red-500/30 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Cancelar Comunicado Programado</h4>
                <p className="text-xs text-stone-400">
                  Esta acción anulará la entrega programada de forma permanente.
                </p>
              </div>
            </div>

            <div className="p-3 bg-[#101418] rounded-xl border border-stone-800 text-xs space-y-1">
              <div className="text-stone-300 font-semibold">{cancellingItem.title}</div>
              <div className="text-amber-400 font-mono text-[11px]">
                Programado para:{' '}
                {cancellingItem.scheduled_for
                  ? new Date(cancellingItem.scheduled_for).toLocaleString('es-ES')
                  : 'N/A'}
              </div>
            </div>

            <div>
              <label className="text-xs text-stone-300 block mb-1">
                Motivo de la cancelación (Auditoría):
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Indica el motivo administrativo para cancelar este comunicado..."
                rows={2}
                className="w-full bg-[#101418] border border-stone-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-red-400"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancellingItem(null)}
                disabled={isCancelling}
                className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={handleCancelAnnouncement}
                disabled={isCancelling}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {isCancelling ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" />
                )}
                <span>Confirmar Cancelación</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
