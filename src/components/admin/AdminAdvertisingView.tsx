import React, { useState, useEffect } from 'react';
import { systemConfigService } from '@/src/modules/systemConfig/systemConfigService';
import { AdSlotConfig } from '@/src/modules/systemConfig/systemConfigTypes';
import {
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Code,
  Shield,
  HelpCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

interface AdminAdvertisingViewProps {
  adminUserId: string;
}

export const AdminAdvertisingView: React.FC<AdminAdvertisingViewProps> = ({ adminUserId }) => {
  const [slots, setSlots] = useState<AdSlotConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingSlotId, setSavingSlotId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const loadSlots = async () => {
    setIsLoading(true);
    try {
      const data = await systemConfigService.getAdSlots();
      setSlots(data);
    } catch (err) {
      console.warn('Error loading ad slots:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSlots();
  }, []);

  const handleToggleSlot = async (slot: AdSlotConfig) => {
    setSavingSlotId(slot.id);
    setFeedback(null);
    const newEnabled = !slot.is_enabled;

    try {
      await systemConfigService.updateAdSlot(
        slot.id,
        { is_enabled: newEnabled },
        adminUserId
      );
      setSlots((prev) =>
        prev.map((s) => (s.id === slot.id ? { ...s, is_enabled: newEnabled } : s))
      );
      setFeedback({
        type: 'success',
        message: `Espacio publicitario "${slot.name}" ${
          newEnabled ? 'habilitado' : 'deshabilitado'
        }.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error al actualizar espacio publicitario.',
      });
    } finally {
      setSavingSlotId(null);
    }
  };

  const handleProviderChange = async (
    slotId: string,
    provider: 'none' | 'adsterra' | 'google_ads' | 'custom'
  ) => {
    setSavingSlotId(slotId);
    setFeedback(null);
    try {
      await systemConfigService.updateAdSlot(slotId, { provider }, adminUserId);
      setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, provider } : s)));
      setFeedback({
        type: 'success',
        message: 'Proveedor actualizado con éxito.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error al cambiar proveedor.',
      });
    } finally {
      setSavingSlotId(null);
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
          <Layers className="w-4 h-4 text-amber-400" />
          <span>Estructura de Espacios Publicitarios (Fase Preparatoria)</span>
        </h2>
        <p className="text-xs text-stone-400 mt-1">
          Preparación arquitectónica de slots de monetización. Por defecto los espacios permanecen
          desactivados para preservar la experiencia minimalista de Dynamo hasta su activación
          explícita.
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

      {/* Slots List */}
      <div className="space-y-3.5">
        {slots.map((slot) => {
          const isSaving = savingSlotId === slot.id;

          return (
            <div
              key={slot.id}
              className="bg-[#161B21] border border-stone-800 rounded-xl p-5 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{slot.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-800 text-stone-400">
                      ID: {slot.id}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Ubicación en layout:{' '}
                    <span className="text-amber-400 font-mono font-medium">{slot.placement}</span>
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleToggleSlot(slot)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-auto ${
                    slot.is_enabled
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                      : 'bg-stone-800 text-stone-400 hover:text-white'
                  }`}
                >
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : slot.is_enabled ? (
                    <ToggleRight className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <ToggleLeft className="w-4 h-4 text-stone-500" />
                  )}
                  <span>{slot.is_enabled ? 'Slot Habilitado' : 'Slot Desactivado'}</span>
                </button>
              </div>

              {/* Provider Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-stone-400 block mb-1 font-semibold">
                    Red o Proveedor Asociado:
                  </label>
                  <select
                    value={slot.provider}
                    disabled={isSaving}
                    onChange={(e) => handleProviderChange(slot.id, e.target.value as any)}
                    className="w-full bg-[#101418] border border-stone-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="none">Sin proveedor (Inactivo)</option>
                    <option value="adsterra">Adsterra</option>
                    <option value="google_ads">Google AdSense</option>
                    <option value="custom">Anunciante Directo / Patrocinio</option>
                  </select>
                </div>

                <div className="p-3 bg-[#101418] rounded-lg border border-stone-800/80 text-[11px] text-stone-400">
                  <span className="font-semibold text-stone-300 block mb-1">
                    Estado de Inserción:
                  </span>
                  {slot.is_enabled ? (
                    <span className="text-emerald-400">
                      Listo para renderizar banner o bloque cuando se configure el script.
                    </span>
                  ) : (
                    <span className="text-stone-500">
                      Espacio bloqueado a nivel UI. No se realizan peticiones de terceros.
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Notice */}
      <div className="p-4 rounded-xl bg-stone-900/60 border border-stone-800 text-xs text-stone-400 flex items-start gap-3">
        <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Los scripts publicitarios de terceros se activarán exclusivamente una vez configuradas las
          credenciales y cumpliendo los requisitos de consentimiento de privacidad de la plataforma.
        </p>
      </div>
    </div>
  );
};
