import React, { useState, useEffect } from 'react';
import { Shield, Zap, ExternalLink, HelpCircle, MessageCircle } from 'lucide-react';
import { LegalSectionId } from '@/src/modules/systemConfig/systemConfigTypes';
import { systemConfigService } from '@/src/modules/systemConfig/systemConfigService';

interface PublicFooterProps {
  onOpenLegalDoc: (doc: LegalSectionId) => void;
}

export const PublicFooter: React.FC<PublicFooterProps> = ({ onOpenLegalDoc }) => {
  const [telegramLinks, setTelegramLinks] = useState<{ supportUrl: string; communityUrl: string }>({
    supportUrl: '',
    communityUrl: '',
  });

  useEffect(() => {
    let isMounted = true;
    systemConfigService
      .getTelegramLinks()
      .then((links) => {
        if (isMounted) {
          setTelegramLinks(links);
        }
      })
      .catch(() => {
        // Silent failure - do not show broken state
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const hasTelegramLinks = Boolean(telegramLinks.supportUrl || telegramLinks.communityUrl);

  return (
    <footer className="w-full border-t border-[#1C2229] bg-[#0A0D10]/80 mt-12 py-8 px-4 sm:px-6 text-stone-400 text-xs">
      <div className="max-w-4xl mx-auto flex flex-col space-y-6">
        {/* Top row: Brand & Manifesto reminder */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
              <Zap className="h-3.5 w-3.5 fill-amber-400" />
            </div>
            <span className="font-bold text-stone-200 tracking-wider text-xs">DYNAMO</span>
            <span className="text-stone-500 text-[11px]">· Microcontenido efímero</span>
          </div>

          {/* Telegram Channels if configured */}
          {hasTelegramLinks && (
            <div className="flex flex-wrap items-center gap-2.5">
              {telegramLinks.supportUrl ? (
                <a
                  href={telegramLinks.supportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-[11px] font-medium transition min-h-[36px]"
                  title="Canal oficial de soporte en Telegram"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Telegram de Soporte</span>
                  <ExternalLink className="w-3 h-3 opacity-70" />
                </a>
              ) : null}

              {telegramLinks.communityUrl ? (
                <a
                  href={telegramLinks.communityUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 text-[11px] font-medium transition min-h-[36px]"
                  title="Canal oficial de la comunidad en Telegram"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Telegram de Comunidad</span>
                  <ExternalLink className="w-3 h-3 opacity-70" />
                </a>
              ) : null}
            </div>
          )}
        </div>

        {/* Middle row: 7 Public Information & Legal Navigation Links */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 pt-2 border-t border-[#181E25] text-stone-400">
          <button
            type="button"
            onClick={() => onOpenLegalDoc('about')}
            className="hover:text-amber-400 transition cursor-pointer text-left py-1"
          >
            Acerca de
          </button>
          <button
            type="button"
            onClick={() => onOpenLegalDoc('terms')}
            className="hover:text-amber-400 transition cursor-pointer text-left py-1"
          >
            Términos y condiciones
          </button>
          <button
            type="button"
            onClick={() => onOpenLegalDoc('privacy')}
            className="hover:text-amber-400 transition cursor-pointer text-left py-1"
          >
            Política de privacidad
          </button>
          <button
            type="button"
            onClick={() => onOpenLegalDoc('community')}
            className="hover:text-amber-400 transition cursor-pointer text-left py-1"
          >
            Normas de comunidad
          </button>
          <button
            type="button"
            onClick={() => onOpenLegalDoc('safety')}
            className="hover:text-amber-400 transition cursor-pointer text-left py-1"
          >
            Seguridad
          </button>
          <button
            type="button"
            onClick={() => onOpenLegalDoc('support')}
            className="hover:text-amber-400 transition cursor-pointer text-left py-1"
          >
            Soporte
          </button>
          <button
            type="button"
            onClick={() => onOpenLegalDoc('community_info')}
            className="hover:text-amber-400 transition cursor-pointer text-left py-1"
          >
            Comunidad
          </button>
        </div>

        {/* Bottom row: Privacy notice */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-stone-400 pt-2 border-t border-[#141A20]">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-emerald-500" />
            <span>Privacidad por diseño · Sin rastreadores comerciales · 16+</span>
          </div>
          <span>Dynamo</span>
        </div>
      </div>
    </footer>
  );
};
