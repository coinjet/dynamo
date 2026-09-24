import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Zap,
  Hash,
  AlertTriangle,
  Send,
  ShieldAlert,
  Edit3,
  Loader2,
  Image as ImageIcon,
  ImageOff,
  Trash2,
} from 'lucide-react';
import { extractHashtags, DYNAMO_CONFIG } from '@/src/modules/dynamos/dynamoRules';
import { detectPersonalData, PiiDetectionResult } from '@/src/modules/dynamos/piiDetector';
import { formatUserFriendlyError } from '@/src/utils/errorHandler';
import { systemConfigService } from '@/src/modules/systemConfig/systemConfigService';
import { mediaStorageService, MEDIA_CONFIG } from '@/src/modules/storage/mediaStorageService';
import { useAuth } from '@/src/modules/auth/AuthContext';

interface CreateDynamoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (content: string, imageUrl?: string | null) => Promise<void>;
}

export const CreateDynamoModal: React.FC<CreateDynamoModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [piiWarning, setPiiWarning] = useState<PiiDetectionResult | null>(null);

  // Multimedia state
  const [allowImages, setAllowImages] = useState<boolean>(true);
  const [isCheckingSettings, setIsCheckingSettings] = useState<boolean>(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState<boolean>(false);

  // Check allow_images setting on modal open
  useEffect(() => {
    if (!isOpen) {
      // Clean up object URL when modal closes
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      setSelectedFile(null);
      setPreviewUrl(null);
      setImageError(null);
      setIsUploadingMedia(false);
      return;
    }

    let isMounted = true;
    const checkMediaSetting = async () => {
      setIsCheckingSettings(true);
      try {
        const settings = await systemConfigService.getSettings();
        if (isMounted) {
          const enabled = Boolean(settings.allow_images ?? settings.allow_media_uploads ?? false);
          setAllowImages(enabled);
        }
      } catch {
        if (isMounted) setAllowImages(true);
      } finally {
        if (isMounted) setIsCheckingSettings(false);
      }
    };

    checkMediaSetting();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const charCount = content.length;
  const charsRemaining = DYNAMO_CONFIG.MAX_CHARACTERS - charCount;
  const isOverLimit = charsRemaining < 0;
  const { tags, error: tagsError } = extractHashtags(content);

  // Handle file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Check global allow_images switch
    if (!allowImages) {
      setImageError('Las imágenes están temporalmente desactivadas.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 2. Validate format, size, mime and magic bytes
    const validation = await mediaStorageService.validateImageFile(file);
    if (!validation.valid) {
      setImageError(validation.error || 'Archivo de imagen no válido.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Revoke previous blob if any
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    const newPreview = URL.createObjectURL(file);
    setPreviewUrl(newPreview);
  };

  // Remove selected image before publishing
  const handleRemoveImage = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setImageError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMessage(null);
    setImageError(null);
    setPiiWarning(null);

    // Strict offline check
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setErrorMessage('Sin conexión. Inténtalo nuevamente cuando tengas internet.');
      return;
    }

    // Check system-wide publication status
    try {
      const settings = await systemConfigService.getSettings();
      if (settings.emergency_mode) {
        setErrorMessage('La plataforma se encuentra temporalmente en modo de emergencia. Las publicaciones están restringidas.');
        return;
      }
      if (settings.maintenance_mode) {
        setErrorMessage('La plataforma se encuentra en modo de mantenimiento. No es posible crear publicaciones en este momento.');
        return;
      }
      if (settings.allow_new_posts === false || settings.allow_publications === false) {
        setErrorMessage('La publicación de nuevos Dynamos se encuentra temporalmente pausada por administración.');
        return;
      }
    } catch {
      // If offline/error proceed
    }

    const trimmed = content.trim();
    if (!trimmed) {
      setErrorMessage('Por favor escribe un mensaje antes de publicar.');
      return;
    }

    if (trimmed.length > DYNAMO_CONFIG.MAX_CHARACTERS) {
      setErrorMessage(`El límite es de ${DYNAMO_CONFIG.MAX_CHARACTERS} caracteres (${trimmed.length}/${DYNAMO_CONFIG.MAX_CHARACTERS}).`);
      return;
    }

    if (tags.length > DYNAMO_CONFIG.MAX_HASHTAGS) {
      setErrorMessage(`Máximo ${DYNAMO_CONFIG.MAX_HASHTAGS} hashtags permitidos.`);
      return;
    }

    // Detect Personal Information (Phone, email, WhatsApp/Telegram, exact address, GPS, IDs)
    const piiResult = detectPersonalData(trimmed);
    if (piiResult.hasPii) {
      setPiiWarning(piiResult);
      return;
    }

    // Strip basic HTML/script tags before submission
    const sanitized = trimmed.replace(/[<>]/g, '');

    setIsSubmitting(true);
    let uploadedMedia: { publicUrl: string; storagePath: string } | null = null;

    try {
      // If an image is selected, upload it first securely
      if (selectedFile) {
        if (!allowImages) {
          throw new Error('Las imágenes están temporalmente desactivadas.');
        }

        if (!user?.id) {
          throw new Error('Debes iniciar sesión para subir imágenes a Dynamo.');
        }

        setIsUploadingMedia(true);
        uploadedMedia = await mediaStorageService.uploadDynamoImage(selectedFile, user.id);
        setIsUploadingMedia(false);
      }

      await onSubmit(sanitized, uploadedMedia?.publicUrl || null);
      
      // Cleanup after successful submit
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      setContent('');
      setSelectedFile(null);
      setPreviewUrl(null);
      setPiiWarning(null);
      onClose();
    } catch (err: unknown) {
      setIsUploadingMedia(false);

      // If Dynamo INSERT fails after upload, immediately remove orphaned storage object to keep Storage clean
      if (uploadedMedia?.storagePath) {
        console.warn('[STORAGE-CLEANUP] Eliminando objeto huérfano de Storage:', uploadedMedia.storagePath);
        mediaStorageService.deleteMediaByPath(uploadedMedia.storagePath).catch((cleanupErr) => {
          console.warn('[STORAGE-CLEANUP] No se pudo limpiar archivo huérfano:', cleanupErr);
        });
      }

      setErrorMessage(formatUserFriendlyError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-lg my-auto rounded-2xl border border-[#262E38] bg-[#12161A] p-5 sm:p-6 shadow-2xl text-stone-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#21272E] mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 text-black font-bold">
              <Zap className="h-4 w-4 fill-black" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">Nuevo Dynamo</h3>
              <p className="text-[11px] text-stone-400">Microcontenido efímero con 24 horas de pulso</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global allow_images notice if disabled */}
        {!allowImages && !isCheckingSettings && (
          <div className="mb-3.5 rounded-xl bg-stone-900/80 border border-stone-800 p-2.5 text-xs text-stone-400 flex items-center gap-2">
            <ImageOff className="w-4 h-4 text-amber-500/80 shrink-0" />
            <span>Las imágenes están temporalmente desactivadas. Puedes publicar texto con normalidad.</span>
          </div>
        )}

        {/* PII Detection Warning Alert */}
        {piiWarning && (
          <div className="mb-4 rounded-xl bg-amber-950/40 border border-amber-500/50 p-3.5 text-xs text-amber-200">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1.5 flex-1">
                <p className="font-bold text-amber-300">
                  Posible dato personal detectado: {piiWarning.categories.join(', ')}
                </p>
                <p className="text-stone-300 text-[11px] leading-relaxed">
                  Para proteger tu privacidad, no se permite compartir números de teléfono, WhatsApp, Telegram, correos personales ni ubicaciones exactas en publicaciones públicas.
                </p>
                <div className="pt-1">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400">
                    <Edit3 className="w-3 h-3" />
                    Edita tu texto para remover los datos señalados y vuelve a enviar.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Generic Form & Image Errors */}
        {(errorMessage || tagsError || imageError) && !piiWarning && (
          <div className="mb-4 flex items-start gap-2 text-xs text-red-300 bg-red-950/40 border border-red-800/60 p-3 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{errorMessage || imageError || tagsError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="relative">
            <textarea
              id="input-dynamo-content"
              rows={4}
              maxLength={DYNAMO_CONFIG.MAX_CHARACTERS + 20}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (errorMessage) setErrorMessage(null);
                if (piiWarning) setPiiWarning(null);
              }}
              placeholder="¿Qué pensamiento, observación o crónica deseas liberar en este instante? (Máx. 280 caracteres, hasta 5 #hashtags)"
              className="w-full rounded-xl bg-[#0E1216] border border-[#232D38] p-3.5 text-xs sm:text-sm text-stone-100 placeholder-stone-400 focus:border-amber-500 focus:outline-hidden resize-none leading-relaxed"
              autoFocus
            />

            {/* Character Counter */}
            <div
              className={`absolute bottom-3 right-3 text-[11px] font-mono px-2 py-0.5 rounded-md ${
                isOverLimit
                  ? 'bg-red-500/20 text-red-400 font-bold border border-red-500/40'
                  : charsRemaining < 25
                  ? 'bg-amber-500/20 text-amber-300 font-semibold'
                  : 'bg-stone-800/90 text-stone-400'
              }`}
            >
              {charsRemaining}
            </div>
          </div>

          {/* Image Preview Box (If image selected) */}
          {previewUrl && (
            <div className="relative rounded-xl overflow-hidden border border-[#26313D] bg-[#0E1216] p-2">
              <div className="relative max-h-48 overflow-hidden rounded-lg bg-black flex items-center justify-center">
                <img
                  src={previewUrl}
                  alt="Vista previa de imagen"
                  className="w-full h-auto max-h-48 object-cover object-center"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  disabled={isSubmitting}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/75 hover:bg-red-900/80 text-white transition shadow-lg"
                  title="Eliminar imagen"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-400 px-1 font-mono">
                <span>
                  {selectedFile ? `${selectedFile.type.replace('image/', '').toUpperCase()} • ${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB` : 'Imagen adjunta'}
                </span>
                <span className="text-emerald-400 font-sans">✓ Lista para publicar</span>
              </div>
            </div>
          )}

          {/* Hashtags detection indicator & Media Attachment Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-[#0E1216] border border-[#21272E] px-3 py-2 rounded-xl">
            {/* Hashtags */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Hash className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              <span className="font-medium text-[11px]">
                Hashtags ({tags.length}/{DYNAMO_CONFIG.MAX_HASHTAGS}):
              </span>
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 rounded bg-[#182028] text-amber-400 font-mono text-[10px] border border-[#28323E]"
                >
                  #{tag}
                </span>
              ))}
              {tags.length === 0 && (
                <span className="italic text-stone-400 text-[11px]">Ninguno</span>
              )}
            </div>

            {/* Multimedia Upload Button */}
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
                disabled={!allowImages || isSubmitting || Boolean(previewUrl)}
              />

              <button
                type="button"
                onClick={() => {
                  if (!allowImages) {
                    setImageError('Las imágenes están temporalmente desactivadas.');
                    return;
                  }
                  fileInputRef.current?.click();
                }}
                disabled={isSubmitting || Boolean(previewUrl)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition min-h-[36px] ${
                  !allowImages
                    ? 'bg-stone-800/40 text-stone-500 border border-stone-800 cursor-not-allowed'
                    : previewUrl
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : 'bg-[#182028] text-stone-300 hover:text-white hover:bg-stone-800 border border-[#28323E]'
                }`}
                title={
                  !allowImages
                    ? 'Las imágenes están temporalmente desactivadas.'
                    : previewUrl
                    ? 'Imagen adjuntada'
                    : 'Adjuntar imagen opcional (JPG, PNG, WEBP máx. 5 MB)'
                }
              >
                {allowImages ? (
                  <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <ImageOff className="w-3.5 h-3.5 text-stone-500" />
                )}
                <span>{previewUrl ? 'Imagen adjunta' : 'Foto'}</span>
              </button>
            </div>
          </div>

          {/* Server-Controlled 24h Note */}
          <p className="text-[11px] text-stone-400 flex items-center gap-1 px-1">
            <Zap className="w-3 h-3 text-amber-400 shrink-0" />
            <span>
              Tu publicación comenzará con <strong>24 horas exactas</strong> asignadas por el servidor.
            </span>
          </p>

          {/* Footer Submit */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#1F2730]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-stone-400 hover:text-white transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              id="btn-submit-dynamo"
              type="submit"
              disabled={isSubmitting || isOverLimit || !content.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-black hover:bg-amber-400 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-amber-500/20 min-h-[44px]"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5 stroke-[2.5]" />
              )}
              <span>
                {isSubmitting
                  ? isUploadingMedia
                    ? 'Subiendo imagen...'
                    : 'Publicando...'
                  : 'Publicar Dynamo ⚡'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
