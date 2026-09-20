import React, { useState, useEffect } from 'react';
import { systemConfigService } from '@/src/modules/systemConfig/systemConfigService';
import { SystemSettings } from '@/src/modules/systemConfig/systemConfigTypes';
import {
  Image,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Shield,
  Clock,
  User,
  History,
} from 'lucide-react';

interface AdminMultimediaViewProps {
  adminUserId: string;
}

interface SettingAuditState {
  currentValue: boolean | null;
  updatedAt: string | null;
  adminUsername: string | null;
  lastReason: string | null;
  history: Array<{
    id: string;
    createdAt: string;
    adminUsername: string;
    reason: string;
    newValue: any;
  }>;
}

export const AdminMultimediaView: React.FC<AdminMultimediaViewProps> = ({ adminUserId }) => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [auditDetails, setAuditDetails] = useState<SettingAuditState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const load = async () => {
    setIsLoading(true);
    try {
      const [settingsData, auditData] = await Promise.all([
        systemConfigService.getSettings(),
        systemConfigService.getSettingAuditDetails('allow_images'),
      ]);
      setSettings(settingsData);
      setAuditDetails(auditData);
    } catch (err) {
      console.warn('Error loading multimedia setting:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleToggleImages = async (newVal: boolean) => {
    setFeedback(null);
    if (!reason.trim() || reason.trim().length < 3) {
      setFeedback({
        type: 'error',
        message: 'Debes ingresar un motivo de auditoría válido para justificar este cambio (mínimo 3 caracteres).',
      });
      return;
    }

    setIsUpdating(true);
    try {
      await systemConfigService.updateSetting(
        'allow_images',
        newVal,
        adminUserId,
        `Multimedia / Imágenes: ${newVal ? 'Habilitada' : 'Deshabilitada'}. Motivo: ${reason.trim()}`
      );
      setSettings((prev) =>
        prev
          ? {
              ...prev,
              allow_images: newVal,
              allow_media_uploads: newVal,
            }
          : null
      );
      setReason('');
      setFeedback({
        type: 'success',
        message: newVal
          ? 'Subida de imágenes activada en el sistema y auditada en Supabase.'
          : 'Subida de imágenes desactivada globalmente por política de moderación/recursos.',
      });
      // Refresh audit logs
      const updatedAudit = await systemConfigService.getSettingAuditDetails('allow_images');
      setAuditDetails(updatedAudit);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error al actualizar configuración de multimedia en Supabase.',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  const isEnabled = Boolean(settings?.allow_images ?? settings?.allow_media_uploads ?? false);

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-[#161B21] border border-stone-800 rounded-xl p-5">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Image className="w-4 h-4 text-amber-400" />
          <span>Control Global de Multimedia e Imágenes</span>
        </h2>
        <p className="text-xs text-stone-400 mt-1 leading-relaxed">
          Dynamo opera con un principio de ligereza de datos y alta eficiencia. Este interruptor
          controla en el servidor la capacidad global de adjuntar imágenes a las publicaciones.
          Cuando está inactivo, publicar texto, interactuar con Dynamos y responder continúa
          operando con total normalidad.
        </p>
      </div>

      {/* Main Switch Card */}
      <div className="bg-[#161B21] border border-stone-800 rounded-xl p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#101418] border border-stone-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">Carga de Imágenes</span>
              <span
                className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border font-bold ${
                  isEnabled
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-red-500/10 text-red-400 border-red-500/30'
                }`}
              >
                {isEnabled ? 'ON (Habilitado)' : 'OFF (Desactivado)'}
              </span>
            </div>
            <p className="text-xs text-stone-400 leading-relaxed">
              {isEnabled
                ? 'Los usuarios tienen permitido subir imágenes respetando los límites de peso (5 MB) y formatos permitidos (JPG, PNG, WEBP).'
                : 'La plataforma bloquea cualquier subida de imágenes nuevas. Las imágenes ya publicadas se mantienen según la política.'}
            </p>
          </div>

          <button
            type="button"
            disabled={isUpdating}
            onClick={() => handleToggleImages(!isEnabled)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 self-start sm:self-auto shrink-0 ${
              isEnabled
                ? 'bg-red-500 hover:bg-red-400 text-white'
                : 'bg-emerald-500 hover:bg-emerald-400 text-black'
            } disabled:opacity-50`}
          >
            {isUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{isEnabled ? 'Desactivar Imágenes (OFF)' : 'Activar Imágenes (ON)'}</span>
          </button>
        </div>

        {/* Status and Last Change Meta Block */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-[#101418] p-3.5 rounded-xl border border-stone-800/80">
          <div>
            <span className="text-[11px] text-stone-500 block">Estado actual:</span>
            <span className={`font-mono font-bold ${isEnabled ? 'text-emerald-400' : 'text-red-400'}`}>
              {isEnabled ? 'ACTIVO (ON)' : 'INACTIVO (OFF)'}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-stone-500 block flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Última modificación:</span>
            </span>
            <span className="text-stone-300 font-mono">
              {auditDetails?.updatedAt
                ? new Date(auditDetails.updatedAt).toLocaleString()
                : 'No registrada'}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-stone-500 block flex items-center gap-1">
              <User className="w-3 h-3" />
              <span>Modificado por:</span>
            </span>
            <span className="text-amber-400 font-mono">
              {auditDetails?.adminUsername ? `@${auditDetails.adminUsername}` : 'Sistema / Inicial'}
            </span>
          </div>

          {auditDetails?.lastReason && (
            <div className="sm:col-span-3 pt-2 border-t border-stone-800 text-stone-400">
              <span className="text-[11px] text-stone-500 block font-semibold">
                Motivo del último cambio:
              </span>
              <p className="italic text-stone-300 mt-0.5">{auditDetails.lastReason}</p>
            </div>
          )}
        </div>

        {/* Audit Reason Input for Next Action */}
        <div className="space-y-1.5">
          <label className="text-xs text-stone-300 font-semibold block flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>Motivo para el próximo cambio (Obligatorio para auditoría):</span>
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej. Mitigación preventiva de costos de almacenamiento / Políticas de contenido"
            className="w-full bg-[#101418] border border-stone-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 placeholder:text-stone-600"
          />
          <p className="text-[11px] text-stone-500">
            Toda modificación de feature flags a nivel servidor requiere justificación previa registrada en el sistema de auditoría.
          </p>
        </div>

        {/* Feedback */}
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
      </div>

      {/* Audit History Log */}
      <div className="bg-[#161B21] border border-stone-800 rounded-xl p-5 space-y-3">
        <h3 className="text-xs font-bold text-stone-200 uppercase tracking-wider flex items-center gap-2">
          <History className="w-4 h-4 text-amber-400" />
          <span>Historial de Auditoría del Switch allow_images</span>
        </h3>

        {auditDetails?.history && auditDetails.history.length > 0 ? (
          <div className="divide-y divide-stone-800/60 border border-stone-800/80 rounded-xl overflow-hidden bg-[#101418]">
            {auditDetails.history.map((item) => (
              <div key={item.id} className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-amber-400 font-bold">@{item.adminUsername}</span>
                    <span className="text-stone-500">•</span>
                    <span className="text-stone-400">{new Date(item.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-stone-300">{item.reason}</p>
                </div>
                {item.newValue !== null && (
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full border shrink-0 font-bold self-start sm:self-auto ${
                      item.newValue
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-red-500/10 text-red-400 border-red-500/30'
                    }`}
                  >
                    {item.newValue ? 'ON' : 'OFF'}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-stone-500 italic p-3 bg-[#101418] rounded-xl border border-stone-800/60">
            No hay cambios históricos registrados aún en el registro de moderación.
          </p>
        )}
      </div>

      {/* Warning Box */}
      <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-300">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
        <div className="space-y-1">
          <span className="font-bold">Aviso sobre Moderación de Contenido Gráfico:</span>
          <p className="text-amber-200/80 leading-relaxed">
            Al activar imágenes, el volumen de reportes por material sensible o explícito puede
            aumentar. Asegúrate de contar con capacidad de revisión activa en la Bandeja de
            Reportes.
          </p>
        </div>
      </div>
    </div>
  );
};
