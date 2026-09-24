import React, { useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';

interface ImageLightboxModalProps {
  isOpen: boolean;
  imageUrl: string | null;
  altText?: string;
  onClose: () => void;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  isOpen,
  imageUrl,
  altText = 'Imagen completa',
  onClose,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !imageUrl) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={altText}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200 cursor-zoom-out"
    >
      {/* Top action bar */}
      <div
        className="absolute top-3 right-3 sm:top-5 sm:right-5 z-20 flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <a
          href={imageUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Abrir imagen original en nueva pestaña"
          className="p-2 sm:p-2.5 rounded-full bg-stone-900/80 hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-700/60 shadow-lg transition backdrop-blur-sm flex items-center justify-center"
        >
          <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5" />
        </a>
        <button
          onClick={onClose}
          title="Cerrar vista (Esc)"
          className="p-2 sm:p-2.5 rounded-full bg-stone-900/80 hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-700/60 shadow-lg transition backdrop-blur-sm flex items-center justify-center cursor-pointer"
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>

      {/* Main Image Container */}
      <div
        className="relative max-w-[95vw] max-h-[90vh] flex items-center justify-center select-none cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl}
          alt={altText}
          className="max-w-[95vw] max-h-[90vh] w-auto h-auto object-contain rounded-lg shadow-2xl transition-all"
        />
      </div>
    </div>
  );
};
