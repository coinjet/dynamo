import { supabase, isSupabaseConfigured } from '@/src/lib/supabase';

export const MEDIA_CONFIG = {
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB
  MAX_FILE_SIZE_MB: 5,
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  ALLOWED_EXTENSIONS: ['jpg', 'jpeg', 'png', 'webp'],
  STORAGE_BUCKET: 'dynamo-media',
};

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  detectedMime?: string;
  cleanExtension?: string;
}

/**
 * Validates magic bytes of an image file to prevent disguised files (.svg, .html, scripts).
 */
async function checkMagicBytes(file: File): Promise<{ valid: boolean; detectedMime?: string }> {
  try {
    const buffer = await file.slice(0, 16).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // JPEG: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return { valid: true, detectedMime: 'image/jpeg' };
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    ) {
      return { valid: true, detectedMime: 'image/png' };
    }

    // WEBP: "RIFF" .... "WEBP"
    if (
      bytes[0] === 0x52 && // R
      bytes[1] === 0x49 && // I
      bytes[2] === 0x46 && // F
      bytes[3] === 0x46 && // F
      bytes[8] === 0x57 && // W
      bytes[9] === 0x45 && // E
      bytes[10] === 0x42 && // B
      bytes[11] === 0x50 // P
    ) {
      return { valid: true, detectedMime: 'image/webp' };
    }

    return { valid: false };
  } catch {
    return { valid: false };
  }
}

function generateSecureEntropy(length = 8): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, length);
  }
  return Math.random().toString(36).substring(2, 2 + length);
}

/**
 * Sanitizes image and strictly strips EXIF GPS/metadata by re-encoding through a clean canvas.
 * This guarantees user location, camera info and private metadata cannot be leaked in image headers.
 * Uses createImageBitmap if available, and falls back to HTMLImageElement + Object URL + Canvas.
 * If sanitization cannot be guaranteed, the upload is rejected to protect user privacy.
 */
async function stripExifAndSanitize(file: File, mimeType: string): Promise<Blob> {
  // Method 1: Offscreen / createImageBitmap
  if (typeof window !== 'undefined' && typeof window.createImageBitmap === 'function') {
    try {
      const bitmap = await window.createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0);
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, mimeType, 0.92);
        });
        if (blob) return blob;
      }
    } catch (bitmapErr) {
      console.warn('createImageBitmap sanitization failed, trying Image element fallback:', bitmapErr);
    }
  }

  // Method 2: HTMLImageElement + Object URL + Canvas fallback
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Contexto 2D no disponible'));
              return;
            }
            ctx.drawImage(img, 0, 0);
            canvas.toBlob(
              (b) => {
                if (b) resolve(b);
                else reject(new Error('Conversión de canvas a Blob fallida'));
              },
              mimeType,
              0.92
            );
          } catch (cErr) {
            reject(cErr);
          }
        };

        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('No se pudo decodificar la imagen'));
        };

        img.src = objectUrl;
      });

      return blob;
    } catch (imgErr) {
      console.warn('Image element sanitization fallback failed:', imgErr);
    }
  }

  // Strict privacy enforcement: never upload unsanitized original if metadata stripping cannot be completed
  throw new Error('No fue posible procesar la imagen para eliminar metadatos privados de forma segura. Por favor, intenta con otra imagen o formato.');
}

export const mediaStorageService = {
  /**
   * Validate image file against format, size, MIME type and header signature.
   */
  async validateImageFile(file: File): Promise<FileValidationResult> {
    if (!file) {
      return { valid: false, error: 'No se seleccionó ningún archivo.' };
    }

    // 1. File size limit
    if (file.size > MEDIA_CONFIG.MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        error: `El archivo excede el tamaño máximo permitido de ${MEDIA_CONFIG.MAX_FILE_SIZE_MB} MB (${(
          file.size /
          (1024 * 1024)
        ).toFixed(1)} MB).`,
      };
    }

    // 2. Extension check
    const parts = file.name.split('.');
    const ext = parts.length > 1 ? parts.pop()?.toLowerCase() : '';
    if (!ext || !MEDIA_CONFIG.ALLOWED_EXTENSIONS.includes(ext)) {
      return {
        valid: false,
        error: 'Formato de imagen no permitido. Solo se aceptan archivos JPG, JPEG, PNG o WEBP.',
      };
    }

    // 3. MIME type check
    if (!MEDIA_CONFIG.ALLOWED_MIME_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: 'El tipo MIME del archivo no es compatible. Se requieren imágenes JPG, PNG o WEBP.',
      };
    }

    // 4. Magic bytes verification (detect disguised SVGs, scripts or binaries)
    const magicCheck = await checkMagicBytes(file);
    if (!magicCheck.valid) {
      return {
        valid: false,
        error: 'El archivo no contiene una firma de imagen válida o está corrupto.',
      };
    }

    return {
      valid: true,
      detectedMime: magicCheck.detectedMime,
      cleanExtension: ext === 'jpeg' ? 'jpg' : ext,
    };
  },

  /**
   * Upload an image to Supabase Storage:
   * - Sanitizes metadata (EXIF/GPS)
   * - Generates server-safe collision-free path: <userId>/<timestamp>_<random>.<ext>
   * - Never exposes user original filenames or local paths
   */
  async uploadDynamoImage(file: File, userId: string): Promise<string> {
    if (!userId) {
      throw new Error('Se requiere un usuario autenticado para subir imágenes.');
    }

    const validation = await this.validateImageFile(file);
    if (!validation.valid) {
      throw new Error(validation.error || 'Archivo de imagen no válido.');
    }

    const mime = validation.detectedMime || file.type;
    const cleanExt = validation.cleanExtension || 'jpg';

    // Strip EXIF / GPS metadata
    const sanitizedBlob = await stripExifAndSanitize(file, mime);

    // Random collision-resistant filename using cryptographically secure entropy (never user-controlled)
    const randomEntropy = generateSecureEntropy(12);
    const safeFilename = `${Date.now()}_${randomEntropy}.${cleanExt}`;
    const storagePath = `${userId}/${safeFilename}`;

    if (isSupabaseConfigured) {
      const { error: uploadError } = await supabase.storage
        .from(MEDIA_CONFIG.STORAGE_BUCKET)
        .upload(storagePath, sanitizedBlob, {
          contentType: mime,
          upsert: false,
        });

      if (uploadError) {
        // If storage RLS policy rejects due to allow_images = false
        if (
          uploadError.message?.toLowerCase().includes('policy') ||
          uploadError.message?.toLowerCase().includes('violates') ||
          uploadError.message?.toLowerCase().includes('not allowed')
        ) {
          throw new Error('Las imágenes están temporalmente desactivadas en la plataforma.');
        }
        throw new Error(`Error al almacenar imagen: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage
        .from(MEDIA_CONFIG.STORAGE_BUCKET)
        .getPublicUrl(storagePath);

      return publicUrlData.publicUrl;
    }

    if (import.meta.env.PROD || isSupabaseConfigured) {
      throw new Error('El servicio de subida de imágenes no está disponible.');
    }

    // Local development fallback: Convert sanitized blob to data URL for preview
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Error al procesar la imagen localmente'));
      reader.readAsDataURL(sanitizedBlob);
    });
  },

  /**
   * Safely deletes an image from Supabase Storage when its Dynamo is deleted.
   * Checks ownership and prevents deletion of arbitrary files.
   */
  async deleteMedia(publicUrl: string, userId: string): Promise<boolean> {
    if (!publicUrl || !isSupabaseConfigured) {
      return false;
    }

    try {
      // Extract storage path from public URL
      // URL format: https://<project>.supabase.co/storage/v1/object/public/dynamo-media/<userId>/<filename>
      const bucketMarker = `/${MEDIA_CONFIG.STORAGE_BUCKET}/`;
      const markerIndex = publicUrl.indexOf(bucketMarker);
      if (markerIndex === -1) {
        return false;
      }

      const pathAfterBucket = decodeURIComponent(publicUrl.substring(markerIndex + bucketMarker.length));
      
      // Strict ownership check: Must be inside user's own directory
      if (!pathAfterBucket.startsWith(`${userId}/`)) {
        console.warn('Access denied: Cannot delete media belonging to another user folder.');
        return false;
      }

      const { error } = await supabase.storage
        .from(MEDIA_CONFIG.STORAGE_BUCKET)
        .remove([pathAfterBucket]);

      return !error;
    } catch (err) {
      console.warn('Error deleting media from Supabase storage:', err);
      return false;
    }
  },

  /**
   * Validates whether a provided URL belongs to the trusted storage bucket.
   */
  isValidMediaUrl(url: string): boolean {
    if (!url) return false;
    // In local sandbox testing only, allow data URLs; in production with Supabase, strictly require bucket URL
    if (!isSupabaseConfigured && url.startsWith('data:image/')) return true;
    if (url.includes(`/${MEDIA_CONFIG.STORAGE_BUCKET}/`)) return true;
    return false;
  },

  /**
   * Upload user avatar:
   * - Validates format, size, MIME type and magic bytes (JPG, PNG, WEBP, max 5MB)
   * - Strips EXIF/metadata via canvas re-encoding
   * - Saves in path avatars/<userId>/<timestamp>_<random>.<ext>
   * - If previousAvatarUrl belongs to user's storage avatars, deletes old object to prevent orphans
   */
  async uploadAvatarImage(file: File, userId: string, previousAvatarUrl?: string): Promise<string> {
    if (!userId) {
      throw new Error('Se requiere un usuario autenticado para subir un avatar.');
    }

    const validation = await this.validateImageFile(file);
    if (!validation.valid) {
      throw new Error(validation.error || 'Archivo de avatar no válido.');
    }

    const mime = validation.detectedMime || file.type;
    const cleanExt = validation.cleanExtension || 'jpg';

    // Strip EXIF / GPS metadata
    const sanitizedBlob = await stripExifAndSanitize(file, mime);

    // Random collision-resistant filename using cryptographically secure entropy
    const randomEntropy = generateSecureEntropy(12);
    const safeFilename = `${Date.now()}_${randomEntropy}.${cleanExt}`;
    const storagePath = `avatars/${userId}/${safeFilename}`;

    if (isSupabaseConfigured) {
      const { error: uploadError } = await supabase.storage
        .from(MEDIA_CONFIG.STORAGE_BUCKET)
        .upload(storagePath, sanitizedBlob, {
          contentType: mime,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Error al subir avatar: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage
        .from(MEDIA_CONFIG.STORAGE_BUCKET)
        .getPublicUrl(storagePath);

      // Clean up previous avatar if it was stored in user's avatar storage folder
      if (previousAvatarUrl) {
        await this.deleteAvatarImage(previousAvatarUrl, userId);
      }

      return publicUrlData.publicUrl;
    }

    if (import.meta.env.PROD || isSupabaseConfigured) {
      throw new Error('El servicio de subida de avatares no está disponible.');
    }

    // Local development fallback
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Error al procesar el avatar localmente'));
      reader.readAsDataURL(sanitizedBlob);
    });
  },

  /**
   * Safely deletes an avatar from Supabase Storage.
   * Checks ownership and prevents deletion of arbitrary files.
   */
  async deleteAvatarImage(avatarUrl: string, userId: string): Promise<boolean> {
    if (!avatarUrl || !isSupabaseConfigured) {
      return false;
    }

    try {
      const bucketMarker = `/${MEDIA_CONFIG.STORAGE_BUCKET}/`;
      const markerIndex = avatarUrl.indexOf(bucketMarker);
      if (markerIndex === -1) {
        return false;
      }

      const pathAfterBucket = decodeURIComponent(avatarUrl.substring(markerIndex + bucketMarker.length));
      
      // Strict ownership check: Must be inside avatars/<userId>/ folder
      if (!pathAfterBucket.startsWith(`avatars/${userId}/`)) {
        return false;
      }

      const { error } = await supabase.storage
        .from(MEDIA_CONFIG.STORAGE_BUCKET)
        .remove([pathAfterBucket]);

      return !error;
    } catch (err) {
      console.warn('Error deleting avatar from Supabase storage:', err);
      return false;
    }
  },

  /**
   * Validates whether an avatar URL is trusted (storage bucket, preset, or dicebear geometric)
   */
  isTrustedAvatarUrl(url: string): boolean {
    if (!url) return true;
    if (!isSupabaseConfigured && url.startsWith('data:image/')) return true;
    if (url.includes(`/${MEDIA_CONFIG.STORAGE_BUCKET}/avatars/`)) return true;
    if (url.startsWith('https://images.unsplash.com/')) return true;
    if (url.startsWith('https://api.dicebear.com/')) return true;
    return false;
  },
};
