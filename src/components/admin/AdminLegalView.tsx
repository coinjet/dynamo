import React, { useState, useEffect } from 'react';
import { systemConfigService } from '@/src/modules/systemConfig/systemConfigService';
import {
  LegalSectionId,
  SystemLegalDocument,
  LEGAL_SECTIONS_META,
  UNPUBLISHED_LEGAL_PLACEHOLDER,
} from '@/src/modules/systemConfig/systemConfigTypes';
import {
  Scale,
  Send,
  FileText,
  Shield,
  HeartHandshake,
  Lock,
  HelpCircle,
  Users,
  Info,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  ExternalLink,
  MessageCircle,
  AlertTriangle,
} from 'lucide-react';

interface AdminLegalViewProps {
  adminUserId: string;
}

const SECTION_ICONS: Record<LegalSectionId, any> = {
  about: Info,
  terms: FileText,
  privacy: Shield,
  community: HeartHandshake,
  safety: Lock,
  support: HelpCircle,
  community_info: Users,
};

export const AdminLegalView: React.FC<AdminLegalViewProps> = ({ adminUserId }) => {
  const [selectedSection, setSelectedSection] = useState<LegalSectionId>('about');
  const [documents, setDocuments] = useState<Record<string, SystemLegalDocument>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Editor State
  const [currentTitle, setCurrentTitle] = useState('');
  const [currentContent, setCurrentContent] = useState('');
  const [auditReason, setAuditReason] = useState('');
  const [isSavingDoc, setIsSavingDoc] = useState(false);
  const [docFeedback, setDocFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Telegram Links State
  const [telegramSupport, setTelegramSupport] = useState('');
  const [telegramCommunity, setTelegramCommunity] = useState('');
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);
  const [telegramFeedback, setTelegramFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [docs, tgLinks] = await Promise.all([
        systemConfigService.getLegalDocuments(),
        systemConfigService.getTelegramLinks(),
      ]);
      setDocuments(docs as any);
      setTelegramSupport(tgLinks.supportUrl || '');
      setTelegramCommunity(tgLinks.communityUrl || '');

      // Set current editor state from loaded doc or default
      const currentDoc = docs[selectedSection];
      setCurrentTitle(currentDoc?.title || LEGAL_SECTIONS_META[selectedSection].title);
      setCurrentContent(currentDoc?.content || '');
    } catch (err: any) {
      console.warn('Error cargando contenidos legales:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectSection = (id: LegalSectionId) => {
    setSelectedSection(id);
    setDocFeedback(null);
    const doc = documents[id];
    setCurrentTitle(doc?.title || LEGAL_SECTIONS_META[id].title);
    setCurrentContent(doc?.content || '');
    setAuditReason('');
  };

  const handleSaveDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    setDocFeedback(null);

    if (!currentTitle.trim()) {
      setDocFeedback({ type: 'error', message: 'El título del documento es obligatorio.' });
      return;
    }

    setIsSavingDoc(true);
    try {
      await systemConfigService.updateLegalDocument(
        selectedSection,
        currentTitle.trim(),
        currentContent.trim(),
        auditReason.trim() || `Actualización de ${currentTitle.trim()}`,
        adminUserId
      );

      setDocuments((prev) => ({
        ...prev,
        [selectedSection]: {
          id: selectedSection,
          title: currentTitle.trim(),
          content: currentContent.trim(),
          updated_at: new Date().toISOString(),
        },
      }));

      setDocFeedback({
        type: 'success',
        message: `Sección "${currentTitle.trim()}" guardada exitosamente en Supabase.`,
      });
      setAuditReason('');
    } catch (err: any) {
      setDocFeedback({
        type: 'error',
        message: err.message || 'Error al guardar el documento legal.',
      });
    } finally {
      setIsSavingDoc(false);
    }
  };

  const handleSaveTelegramLinks = async (e: React.FormEvent) => {
    e.preventDefault();
    setTelegramFeedback(null);
    setIsSavingTelegram(true);
    try {
      await systemConfigService.updateTelegramLinks(
        {
          supportUrl: telegramSupport.trim(),
          communityUrl: telegramCommunity.trim(),
        },
        adminUserId
      );
      setTelegramFeedback({
        type: 'success',
        message: 'Enlaces independientes de Telegram actualizados y auditados en Supabase.',
      });
    } catch (err: any) {
      setTelegramFeedback({
        type: 'error',
        message: err.message || 'Error al guardar los canales de Telegram.',
      });
    } finally {
      setIsSavingTelegram(false);
    }
  };

  const sectionKeys: LegalSectionId[] = [
    'about',
    'terms',
    'privacy',
    'community',
    'safety',
    'support',
    'community_info',
  ];

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-[#161B21] border border-stone-800 rounded-xl p-5 shadow-lg">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Scale className="w-4 h-4 text-amber-400" />
          <span>Configuración de Legal, Soporte y Comunidad</span>
        </h2>
        <p className="text-xs text-stone-400 mt-1 leading-relaxed">
          Edita los 7 documentos oficiales y canales institucionales de Telegram. Los contenidos
          vacíos muestran por norma estricta{' '}
          <span className="text-amber-300 font-semibold font-mono">
            "{UNPUBLISHED_LEGAL_PLACEHOLDER}"
          </span>
          . La identidad del propietario y sus datos privados permanecen resguardados sin exponer
          teléfonos, correos personales ni domicilios.
        </p>
      </div>

      {/* Telegram Channels Section */}
      <div className="bg-[#161B21] border border-stone-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-sky-400" />
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
              Enlaces Externos de Telegram (Independientes)
            </h3>
          </div>
          <span className="text-[11px] font-mono text-stone-500">
            Pueden quedar vacíos hasta que se configuren
          </span>
        </div>

        <form onSubmit={handleSaveTelegramLinks} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Telegram Support */}
            <div className="p-3.5 bg-[#101418] rounded-xl border border-stone-800 space-y-1.5">
              <label className="text-xs font-semibold text-stone-300 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>Telegram de Soporte:</span>
              </label>
              <input
                type="text"
                value={telegramSupport}
                onChange={(e) => setTelegramSupport(e.target.value)}
                placeholder="Ej: https://t.me/soporte_dynamo (o canal de ayuda)"
                className="w-full bg-[#161B21] border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-amber-400 font-mono"
              />
              <p className="text-[10px] text-stone-500">
                Canal exclusivo de soporte técnico y reporte de incidentes.
              </p>
            </div>

            {/* Telegram Community */}
            <div className="p-3.5 bg-[#101418] rounded-xl border border-stone-800 space-y-1.5">
              <label className="text-xs font-semibold text-stone-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-sky-400" />
                <span>Telegram de Comunidad:</span>
              </label>
              <input
                type="text"
                value={telegramCommunity}
                onChange={(e) => setTelegramCommunity(e.target.value)}
                placeholder="Ej: https://t.me/comunidad_dynamo (o grupo de debate)"
                className="w-full bg-[#161B21] border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-amber-400 font-mono"
              />
              <p className="text-[10px] text-stone-500">
                Espacio social y canal abierto de novedades para usuarios.
              </p>
            </div>
          </div>

          {telegramFeedback && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                telegramFeedback.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-red-950/40 border-red-500/40 text-red-300'
              }`}
            >
              {telegramFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{telegramFeedback.message}</span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSavingTelegram}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition disabled:opacity-50"
            >
              {isSavingTelegram ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Guardar Enlaces de Telegram</span>
            </button>
          </div>
        </form>
      </div>

      {/* 7 Official Legal & Community Documents */}
      <div className="bg-[#161B21] border border-stone-800 rounded-xl p-5 space-y-4 shadow-lg">
        <div className="border-b border-stone-800 pb-3">
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
            Documentos y Políticas del Sistema (7 Secciones)
          </h3>
          <p className="text-[11px] text-stone-400 mt-0.5">
            Selecciona una sección para redactar o actualizar su contenido oficial.
          </p>
        </div>

        {/* Section Selector Pills */}
        <div className="flex flex-wrap gap-2">
          {sectionKeys.map((secId) => {
            const meta = LEGAL_SECTIONS_META[secId];
            const IconComp = SECTION_ICONS[secId];
            const isSelected = selectedSection === secId;
            const doc = documents[secId];
            const hasContent = Boolean(doc?.content && doc.content.trim().length > 0);

            return (
              <button
                key={secId}
                type="button"
                onClick={() => handleSelectSection(secId)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition ${
                  isSelected
                    ? 'bg-amber-500 text-black border-amber-400 font-bold shadow'
                    : 'bg-[#101418] text-stone-300 border-stone-800 hover:text-white hover:border-stone-700'
                }`}
              >
                <IconComp className="w-3.5 h-3.5 shrink-0" />
                <span>{meta.title}</span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full uppercase ${
                    hasContent
                      ? isSelected
                        ? 'bg-black/20 text-black'
                        : 'bg-emerald-500/20 text-emerald-400'
                      : isSelected
                      ? 'bg-black/20 text-black'
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}
                >
                  {hasContent ? 'Publicado' : 'Pendiente'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Editor & Preview Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
          {/* Left Column: Form Editor */}
          <form onSubmit={handleSaveDocument} className="space-y-4">
            <div className="p-3 bg-[#101418] rounded-xl border border-stone-800 space-y-1">
              <span className="text-[10px] text-amber-400 uppercase font-mono font-semibold">
                Sección activa: {selectedSection}
              </span>
              <p className="text-xs text-stone-400">
                {LEGAL_SECTIONS_META[selectedSection].subtitle}
              </p>
            </div>

            {/* Title */}
            <div>
              <label className="text-xs text-stone-300 font-semibold block mb-1">
                Título de la Sección:
              </label>
              <input
                type="text"
                value={currentTitle}
                onChange={(e) => setCurrentTitle(e.target.value)}
                placeholder="Título visible para el usuario..."
                maxLength={100}
                className="w-full bg-[#101418] border border-stone-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Content Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-stone-300 font-semibold">
                  Cuerpo del Contenido:
                </label>
                <span className="text-[10px] text-stone-500 font-mono">
                  {currentContent.length} caracteres
                </span>
              </div>
              <textarea
                value={currentContent}
                onChange={(e) => setCurrentContent(e.target.value)}
                placeholder="Redacta el contenido legal o de soporte. Si lo dejas vacío, el sistema mostrará automáticamente: 'Contenido pendiente de publicación'."
                rows={10}
                className="w-full bg-[#101418] border border-stone-700 rounded-lg p-3 text-xs text-stone-200 focus:outline-none focus:border-amber-400 font-sans leading-relaxed resize-y"
              />
              <p className="text-[10px] text-stone-500 mt-1">
                Soporta saltos de línea y formateo de texto plano. No incluyas datos personales ni
                PII.
              </p>
            </div>

            {/* Audit Reason */}
            <div>
              <label className="text-xs text-stone-400 block mb-1">
                Motivo del Cambio (Registro de Auditoría):
              </label>
              <input
                type="text"
                value={auditReason}
                onChange={(e) => setAuditReason(e.target.value)}
                placeholder="Ej: Actualización anual de cláusulas de privacidad o asistencia"
                className="w-full bg-[#101418] border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Privacy Guarantee Warning */}
            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/20 text-amber-300/90 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <strong>Garantía de Privacidad Institucional:</strong> No publiques números de
                teléfono, direcciones físicas ni correos de personas físicas. Dynamo preserva el
                anonimato por diseño.
              </div>
            </div>

            {docFeedback && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  docFeedback.type === 'success'
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-red-950/40 border-red-500/40 text-red-300'
                }`}
              >
                {docFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                )}
                <span>{docFeedback.message}</span>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isSavingDoc}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition disabled:opacity-50 shadow-md"
              >
                {isSavingDoc ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Guardar y Auditar en Supabase</span>
              </button>
            </div>
          </form>

          {/* Right Column: Live User Preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-300 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-amber-400" />
                <span>Vista Previa en Vivo para el Usuario:</span>
              </span>
              <span className="text-[10px] font-mono text-stone-500">
                {documents[selectedSection]?.updated_at
                  ? `Actualizado: ${new Date(
                      documents[selectedSection].updated_at
                    ).toLocaleDateString('es-ES')}`
                  : 'Sin publicar'}
              </span>
            </div>

            <div className="bg-[#101418] border border-stone-800 rounded-xl p-5 min-h-[360px] flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 pb-3 mb-3 border-b border-stone-800/80">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                    {React.createElement(SECTION_ICONS[selectedSection], { className: 'w-4 h-4' })}
                  </div>
                  <h4 className="text-sm font-bold text-white">
                    {currentTitle || LEGAL_SECTIONS_META[selectedSection].title}
                  </h4>
                </div>

                {/* Content preview or exact fallback */}
                {currentContent.trim() ? (
                  <div className="text-xs text-stone-300 whitespace-pre-wrap leading-relaxed space-y-2">
                    {currentContent}
                  </div>
                ) : (
                  <div className="p-8 my-6 text-center rounded-xl bg-[#161B21] border border-stone-800 space-y-2">
                    <AlertCircle className="w-6 h-6 text-amber-400/80 mx-auto" />
                    <p className="text-xs font-mono text-amber-300 font-semibold tracking-wide">
                      {UNPUBLISHED_LEGAL_PLACEHOLDER}
                    </p>
                    <p className="text-[11px] text-stone-500 max-w-xs mx-auto">
                      Esta sección no contiene texto redactado aún. Se muestra este mensaje de
                      resguardo a los visitantes.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-4 mt-4 border-t border-stone-800/80 flex items-center justify-between text-[10px] font-mono text-stone-500">
                <span>Dynamo · Plataforma Anónima</span>
                <span>ID: {selectedSection}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
