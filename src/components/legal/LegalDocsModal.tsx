import React, { useState, useEffect } from 'react';
import {
  FileText,
  Shield,
  HeartHandshake,
  AlertCircle,
  X,
  Check,
  Info,
  HelpCircle,
  Users,
  ExternalLink,
  MessageCircle,
  Lock,
} from 'lucide-react';
import { systemConfigService } from '@/src/modules/systemConfig/systemConfigService';
import {
  LegalSectionId,
  LEGAL_SECTIONS_META,
  UNPUBLISHED_LEGAL_PLACEHOLDER,
} from '@/src/modules/systemConfig/systemConfigTypes';

export type LegalDocType = LegalSectionId;

interface LegalDocsModalProps {
  initialDoc?: LegalDocType;
  isOpen: boolean;
  onClose: () => void;
}

const TAB_ICONS: Record<LegalSectionId, any> = {
  about: Info,
  terms: FileText,
  privacy: Shield,
  community: HeartHandshake,
  safety: Lock,
  support: HelpCircle,
  community_info: Users,
};

export const LegalDocsModal: React.FC<LegalDocsModalProps> = ({
  initialDoc = 'terms',
  isOpen,
  onClose,
}) => {
  const [activeDoc, setActiveDoc] = useState<LegalDocType>(initialDoc);
  const [docs, setDocs] = useState<Record<string, { title: string; content: string }>>({});
  const [telegramLinks, setTelegramLinks] = useState<{ supportUrl: string; communityUrl: string }>({
    supportUrl: '',
    communityUrl: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveDoc(initialDoc);
      setIsLoading(true);
      Promise.all([systemConfigService.getLegalDocuments(), systemConfigService.getTelegramLinks()])
        .then(([loadedDocs, tg]) => {
          setDocs(loadedDocs);
          setTelegramLinks(tg);
        })
        .catch((err) => {
          console.warn('Error fetching legal documents for modal:', err);
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, initialDoc]);

  if (!isOpen) return null;

  const currentDocData = docs[activeDoc];
  const meta = LEGAL_SECTIONS_META[activeDoc] || LEGAL_SECTIONS_META.terms;
  const content = currentDocData?.content?.trim();
  const title = currentDocData?.title || meta.title;

  const sectionsList: LegalSectionId[] = [
    'about',
    'terms',
    'privacy',
    'community',
    'safety',
    'support',
    'community_info',
  ];

  return (
    <div
      id="legal-docs-modal"
      className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-2xl border border-stone-800 bg-[#12171E] text-stone-200 shadow-2xl flex flex-col max-h-[88vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800/80 bg-[#151B22]">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Información Legal, Normas y Soporte
              </h3>
              <p className="text-[11px] text-stone-400">
                Dynamo · Plataforma anónima y efímera · Privacidad por diseño
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation (7 sections) */}
        <div className="flex items-center border-b border-stone-800 px-4 pt-2 bg-[#0E1318] overflow-x-auto gap-1 scrollbar-none">
          {sectionsList.map((secId) => {
            const Icon = TAB_ICONS[secId];
            const isCurrent = activeDoc === secId;
            return (
              <button
                key={secId}
                onClick={() => setActiveDoc(secId)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
                  isCurrent
                    ? 'border-amber-400 text-amber-400 bg-amber-400/5'
                    : 'border-transparent text-stone-400 hover:text-stone-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{LEGAL_SECTIONS_META[secId].title}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs text-stone-300 leading-relaxed font-sans">
          <div className="flex items-center justify-between border-b border-stone-800/60 pb-3">
            <div>
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                {React.createElement(TAB_ICONS[activeDoc], {
                  className: 'w-4 h-4 text-amber-400',
                })}
                <span>{title}</span>
              </h4>
              <p className="text-[11px] text-stone-400 mt-0.5">{meta.subtitle}</p>
            </div>
          </div>

          {/* External Telegram Links if Support or Community tab and configured */}
          {(activeDoc === 'support' || activeDoc === 'community_info') &&
            (Boolean(telegramLinks.supportUrl) || Boolean(telegramLinks.communityUrl)) && (
              <div className="p-4 rounded-xl bg-[#161B21] border border-stone-800 space-y-3">
                <span className="text-[11px] font-semibold text-stone-300 uppercase tracking-wider block">
                  Canales Oficiales en Telegram:
                </span>
                <div className="flex flex-wrap gap-2.5">
                  {telegramLinks.supportUrl ? (
                    <a
                      href={telegramLinks.supportUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-xs font-medium transition"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Telegram de Soporte Oficial</span>
                      <ExternalLink className="w-3 h-3 text-amber-400/70" />
                    </a>
                  ) : null}

                  {telegramLinks.communityUrl ? (
                    <a
                      href={telegramLinks.communityUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 text-xs font-medium transition"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Telegram de Comunidad Oficial</span>
                      <ExternalLink className="w-3 h-3 text-sky-400/70" />
                    </a>
                  ) : null}
                </div>
              </div>
            )}

          {/* Render Text Content or Exact Placeholder */}
          {content ? (
            <div className="whitespace-pre-wrap leading-relaxed space-y-3 text-stone-200">
              {content}
            </div>
          ) : (
            <div className="py-12 px-6 rounded-xl bg-[#101418] border border-stone-800/80 text-center space-y-2">
              <AlertCircle className="w-7 h-7 text-amber-400/80 mx-auto" />
              <p className="text-sm font-semibold text-amber-300 font-mono tracking-wide">
                {UNPUBLISHED_LEGAL_PLACEHOLDER}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-stone-800 bg-[#151B22]">
          <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sin exposición de datos privados ni PII personal</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
