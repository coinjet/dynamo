import React, { useState, useEffect } from 'react';
import { systemConfigService } from '@/src/modules/systemConfig/systemConfigService';
import { SystemSettings } from '@/src/modules/systemConfig/systemConfigTypes';
import {
  Sliders,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Shield,
  UserPlus,
  Send,
  MessageCircle,
  Zap,
  Bell,
  HeartHandshake,
  DollarSign,
  AlertOctagon,
  Wrench,
  Image as ImageIcon,
} from 'lucide-react';

interface AdminConfigViewProps {
  adminUserId: string;
}

interface SwitchItemDef {
  key: keyof SystemSettings;
  label: string;
  description: string;
  icon: React.ElementType;
  critical?: boolean;
}

const SWITCHES_CONFIG: SwitchItemDef[] = [
  {
    key: 'allow_new_registrations',
    label: 'allow_new_registrations',
    description: 'Permite o detiene la creación de nuevas cuentas de usuario.',
    icon: UserPlus,
  },
  {
    key: 'allow_new_posts',
    label: 'allow_new_posts',
    description: 'Controla la creación de publicaciones principales (Dynamos).',
    icon: Send,
  },
  {
    key: 'allow_new_replies',
    label: 'allow_new_replies',
    description: 'Controla la creación de respuestas y comentarios a publicaciones.',
    icon: MessageCircle,
  },
  {
    key: 'allow_images',
    label: 'allow_images',
    description: 'Controla la carga y adjunción de archivos de imagen multimedia.',
    icon: ImageIcon,
  },
  {
    key: 'allow_dynamos',
    label: 'allow_dynamos',
    description: 'Controla el envío de energía ⚡ y transferencias internas de Dynamo.',
    icon: Zap,
  },
  {
    key: 'allow_notifications',
    label: 'allow_notifications',
    description: 'Emisión de notificaciones comunitarias (seguridad y avisos críticos siempre activos).',
    icon: Bell,
  },
  {
    key: 'allow_sponsorships',
    label: 'allow_sponsorships',
    description: 'Control del módulo de patrocinios y colaboraciones creadoras.',
    icon: HeartHandshake,
  },
  {
    key: 'allow_advertising',
    label: 'allow_advertising',
    description: 'Habilita o pausa los bloques publicitarios de la plataforma.',
    icon: DollarSign,
  },
  {
    key: 'maintenance_mode',
    label: 'maintenance_mode',
    description: 'Modo de mantenimiento preventivo (no bloquea lectura ni sesión administrativa).',
    icon: Wrench,
    critical: true,
  },
  {
    key: 'emergency_mode',
    label: 'emergency_mode',
    description: 'Modo de emergencia y mitigación global ante incidentes críticos.',
    icon: AlertOctagon,
    critical: true,
  },
];

export const AdminConfigView: React.FC<AdminConfigViewProps> = ({ adminUserId }) => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingKey, setIsUpdatingKey] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [maintenanceNoticeText, setMaintenanceNoticeText] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await systemConfigService.getSettings();
      setSettings(data);
      setMaintenanceNoticeText(data.maintenance_notice || '');
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error al cargar la configuración desde Supabase.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleToggle = async (key: keyof SystemSettings, currentVal: boolean) => {
    setFeedback(null);
    if (!reason.trim() || reason.trim().length < 3) {
      setFeedback({
        type: 'error',
        message: 'Debes registrar obligatoriamente un motivo para auditar este cambio (mínimo 3 caracteres).',
      });
      return;
    }

    const newVal = !currentVal;
    setIsUpdatingKey(key);
    try {
      await systemConfigService.updateSetting(
        key,
        newVal,
        adminUserId,
        `Ajuste de switch [${key}] a ${newVal}. Motivo: ${reason.trim()}`
      );
      setSettings((prev) => (prev ? { ...prev, [key]: newVal } : null));
      setReason('');
      setFeedback({
        type: 'success',
        message: `Interruptor global "${key}" actualizado exitosamente a ${newVal ? 'HABILITADO' : 'PAUSADO'} y auditado en Supabase.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error al actualizar configuración en Supabase.',
      });
    } finally {
      setIsUpdatingKey(null);
    }
  };

  const handleSaveNotice = async () => {
    setFeedback(null);
    if (!reason.trim() || reason.trim().length < 3) {
      setFeedback({
        type: 'error',
        message: 'Debes ingresar un motivo para justificar la actualización del aviso de mantenimiento.',
      });
      return;
    }

    const noticeVal = maintenanceNoticeText.trim() ? maintenanceNoticeText.trim() : null;
    setIsUpdatingKey('maintenance_notice');
    try {
      await systemConfigService.updateSetting(
        'maintenance_notice',
        noticeVal,
        adminUserId,
        `Aviso de mantenimiento: ${noticeVal || 'Desactivado'}. Motivo: ${reason.trim()}`
      );
      setSettings((prev) => (prev ? { ...prev, maintenance_notice: noticeVal } : null));
      setReason('');
      setFeedback({
        type: 'success',
        message: noticeVal
          ? 'Aviso de mantenimiento publicado en cabecera global y auditado en Supabase.'
          : 'Aviso de mantenimiento retirado.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error al actualizar aviso de mantenimiento.',
      });
    } finally {
      setIsUpdatingKey(null);
    }
  };

  if (isLoading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-[#161B21] border border-stone-800 rounded-xl p-5">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Sliders className="w-4 h-4 text-amber-400" />
          <span>Interruptores Globales del Sistema (Bloque 1.1)</span>
        </h2>
        <p className="text-xs text-stone-400 mt-1">
          Habilita o pausa funciones neurálgicas del sistema. Todos los cambios se aplican
          en tiempo real mediante Supabase RPC y quedan registrados de forma inmutable en la auditoría.
        </p>
      </div>

      {/* Audit Reason Input */}
      <div className="bg-[#161B21] border border-stone-800 rounded-xl p-4 space-y-1.5">
        <label className="text-xs text-stone-300 font-semibold flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-amber-400" />
          <span>Motivo de la Modificación (Obligatorio en Supabase para cualquier cambio):</span>
        </label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ej. Pausa preventiva por mantenimiento / Ajuste de políticas operativas"
          className="w-full bg-[#101418] border border-stone-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
        />
        <p className="text-[11px] text-stone-500">
          Ningún switch puede modificarse sin una justificación registrada para trazabilidad administrativa.
        </p>
      </div>

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

      {/* Switches Grid (10 switches) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SWITCHES_CONFIG.map((sw) => {
          const Icon = sw.icon;
          const isEnabled = Boolean(settings?.[sw.key]);
          const isUpdating = isUpdatingKey === sw.key;

          return (
            <div
              key={sw.key}
              className={`bg-[#161B21] border rounded-xl p-4 flex flex-col justify-between gap-3 ${
                sw.critical && isEnabled
                  ? 'border-amber-500/50 bg-amber-950/10'
                  : 'border-stone-800'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${sw.critical ? 'text-amber-400' : 'text-stone-300'}`} />
                    <span className="font-mono text-xs font-bold text-white">{sw.label}</span>
                  </div>
                  <span
                    className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border font-bold ${
                      isEnabled
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-red-500/10 text-red-400 border-red-500/30'
                    }`}
                  >
                    {isEnabled ? 'ON' : 'OFF'}
                  </span>
                </div>
                <p className="text-xs text-stone-400 leading-relaxed">{sw.description}</p>
              </div>

              <button
                type="button"
                disabled={isUpdating}
                onClick={() => handleToggle(sw.key, isEnabled)}
                className={`w-full py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  isEnabled
                    ? 'bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-black'
                } disabled:opacity-50`}
              >
                {isUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isEnabled ? `Desactivar (${sw.label} OFF)` : `Activar (${sw.label} ON)`}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Banner / Maintenance Notice Config */}
      <div className="bg-[#161B21] border border-stone-800 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-semibold text-stone-300 uppercase tracking-wider flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-amber-400" />
          <span>Aviso Global de Cabecera (Banner de Servicio / maintenance_notice)</span>
        </h3>
        <p className="text-xs text-stone-400">
          Define un texto para mostrar en la barra destacada global en el encabezado de Dynamo.
          Déjalo en blanco para desactivarlo.
        </p>

        <textarea
          rows={2}
          value={maintenanceNoticeText}
          onChange={(e) => setMaintenanceNoticeText(e.target.value)}
          placeholder="Ej. Mantenimiento programado para el domingo a las 03:00 UTC."
          maxLength={200}
          className="w-full bg-[#101418] border border-stone-800 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-amber-400 resize-none"
        />

        <div className="flex justify-between items-center text-xs">
          <span className="text-[11px] font-mono text-stone-500">
            {maintenanceNoticeText.length} / 200 caracteres
          </span>
          <button
            type="button"
            disabled={isUpdatingKey === 'maintenance_notice'}
            onClick={handleSaveNotice}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition flex items-center gap-2 disabled:opacity-50 active:scale-95"
          >
            {isUpdatingKey === 'maintenance_notice' && (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            )}
            <span>Guardar y Publicar Banner</span>
          </button>
        </div>
      </div>
    </div>
  );
};
