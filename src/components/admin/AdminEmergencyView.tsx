import React, { useState, useEffect } from 'react';
import { systemConfigService } from '@/src/modules/systemConfig/systemConfigService';
import { SystemSettings } from '@/src/modules/systemConfig/systemConfigTypes';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Shield,
  Lock,
  Unlock,
} from 'lucide-react';

interface AdminEmergencyViewProps {
  adminUserId: string;
}

export const AdminEmergencyView: React.FC<AdminEmergencyViewProps> = ({ adminUserId }) => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmationPhrase, setConfirmationPhrase] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await systemConfigService.getSettings();
      setSettings(data);
    } catch (err) {
      console.warn('Error loading emergency state:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const isEmergencyActive = settings?.emergency_mode ?? false;

  const handleToggleEmergency = async () => {
    setFeedback(null);
    const targetState = !isEmergencyActive;

    if (!reason.trim()) {
      setFeedback({
        type: 'error',
        message: 'Debes especificar obligatoriamente un motivo detallado para este cambio de alta severidad.',
      });
      return;
    }

    if (targetState && confirmationPhrase.trim() !== 'ACTIVAR EMERGENCIA') {
      setFeedback({
        type: 'error',
        message: 'Escribe exactamente "ACTIVAR EMERGENCIA" para confirmar la activación del modo de protección.',
      });
      return;
    }

    setIsUpdating(true);
    try {
      await systemConfigService.updateSetting(
        'emergency_mode',
        targetState,
        adminUserId,
        `MODO DE EMERGENCIA ${targetState ? 'ACTIVADO' : 'DESACTIVADO'}. Motivo: ${reason}`
      );
      setSettings((prev) => (prev ? { ...prev, emergency_mode: targetState } : null));
      setReason('');
      setConfirmationPhrase('');
      setFeedback({
        type: 'success',
        message: targetState
          ? 'Modo de emergencia activado globalmente. Las operaciones sensibles se encuentran restringidas.'
          : 'Modo de emergencia desactivado. Operación normal restablecida.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error al cambiar el estado de emergencia.',
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

  return (
    <div className="space-y-6">
      {/* Warning Header */}
      <div className="bg-red-950/20 border border-red-500/40 rounded-xl p-5 space-y-2 text-red-200">
        <h2 className="text-sm font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
          <AlertOctagon className="w-5 h-5 text-red-400" />
          <span>Modo de Emergencia y Mitigación Global</span>
        </h2>
        <p className="text-xs leading-relaxed text-red-200/90">
          Este interruptor es el protocolo de salvaguarda máxima de Dynamo. Al activarse, bloquea
          inyecciones anómalas de energía, detiene la creación de cuentas, suspende transacciones
          y restringe temporalmente la publicación para mitigar ataques DDoS, bots coordinados o
          vulnerabilidades críticas reportadas.
        </p>
      </div>

      {/* Main Action Box */}
      <div
        className={`border rounded-xl p-6 space-y-5 transition ${
          isEmergencyActive
            ? 'bg-red-950/30 border-red-500/60 shadow-lg shadow-red-950/40'
            : 'bg-[#161B21] border-stone-800'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">Estado del Protocolo:</span>
              <span
                className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border uppercase ${
                  isEmergencyActive
                    ? 'bg-red-500 text-black border-red-400 animate-pulse'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                }`}
              >
                {isEmergencyActive ? 'EMERGENCIA ACTIVA' : 'SISTEMA SEGURO (NORMAL)'}
              </span>
            </div>
            <p className="text-xs text-stone-400">
              {isEmergencyActive
                ? 'El sistema está operando bajo modo restrictivo de solo lectura y mitigación activa.'
                : 'Todas las capas de Dynamo operan con sus parámetros nominales de concurrencia.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isEmergencyActive ? (
              <Lock className="w-6 h-6 text-red-400" />
            ) : (
              <Unlock className="w-6 h-6 text-emerald-400" />
            )}
          </div>
        </div>

        {/* Reason Input */}
        <div className="space-y-1.5 pt-2 border-t border-stone-800/80">
          <label className="text-xs text-stone-300 font-semibold block flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>Motivo del Cambio de Estado (Obligatorio en Auditoría):</span>
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej. Detección de tráfico inusual / Mitigación de spam coordinado"
            className="w-full bg-[#101418] border border-stone-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-red-400"
          />
        </div>

        {/* Confirmation phrase (Only when activating) */}
        {!isEmergencyActive && (
          <div className="space-y-1.5">
            <label className="text-xs text-stone-300 font-semibold block">
              Escribe <span className="font-mono text-red-400 font-bold">ACTIVAR EMERGENCIA</span>{' '}
              para confirmar:
            </label>
            <input
              type="text"
              value={confirmationPhrase}
              onChange={(e) => setConfirmationPhrase(e.target.value)}
              placeholder="ACTIVAR EMERGENCIA"
              className="w-full bg-[#101418] border border-stone-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-red-400 font-mono"
            />
          </div>
        )}

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

        {/* Action Button */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            disabled={isUpdating}
            onClick={handleToggleEmergency}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              isEmergencyActive
                ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
                : 'bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-900/40'
            } disabled:opacity-50`}
          >
            {isUpdating && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>
              {isEmergencyActive
                ? 'Desactivar Modo Emergencia (Restablecer Normalidad)'
                : 'ACTIVAR PROTOCOLO DE EMERGENCIA'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
