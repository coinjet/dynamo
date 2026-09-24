import { supabase, isSupabaseConfigured } from '@/src/lib/supabase';

export const MEDIA_CONFIG = {
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB
  MAX_FILE_SIZE_MB: 5,
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  ALLOWED_EXTENSIONS: ['jpg', 'jpeg', 'png', 'webp'],
  STORAGE_BUCKET: 'dynamo-media',
};

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  detectedMime?: string;
  cleanExtension?: string;
}

export interface UploadDynamoMediaResult {
  publicUrl: string;
  storagePath: string;
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
  const sanitizeFailure = new Error('No fue posible procesar la imagen para eliminar metadatos privados de forma segura. Por favor, intenta con otra imagen o formato.');
  (sanitizeFailure as any).stage = '[2-SANITIZE]';
  throw sanitizeFailure;
}

export const mediaStorageService = {
  /**
   * [1-FILE] Validate image file against format, size, MIME type and header signature.
   */
  async validateImageFile(file: File): Promise<FileValidationResult> {
    if (!file) {
      return { valid: false, error: 'No se seleccionó ningún archivo.' };
    }

    // 1. File size limit
    if (file.size > MEDIA_CONFIG.MAX_FILE_SIZE_BYTES) {
      const err = `El archivo excede el tamaño máximo permitido de ${MEDIA_CONFIG.MAX_FILE_SIZE_MB} MB (${(
        file.size /
        (1024 * 1024)
      ).toFixed(1)} MB).`;
      console.error('[1-FILE]', {
        message: err,
        code: 'FILE_SIZE_LIMIT_EXCEEDED',
        details: { size: file.size, maxBytes: MEDIA_CONFIG.MAX_FILE_SIZE_BYTES },
        hint: 'Sube un archivo de menor tamaño.',
        statusCode: 400,
      });
      return { valid: false, error: err };
    }

    // 2. Extension check
    const parts = file.name.split('.');
    const ext = parts.length > 1 ? parts.pop()?.toLowerCase() : '';
    if (!ext || !MEDIA_CONFIG.ALLOWED_EXTENSIONS.includes(ext)) {
      const err = 'Formato de imagen no permitido. Solo se aceptan archivos JPG, JPEG, PNG o WEBP.';
      console.error('[1-FILE]', {
        message: err,
        code: 'INVALID_FILE_EXTENSION',
        details: { filename: file.name, extension: ext },
        hint: 'Utiliza una imagen con extensión .jpg, .jpeg, .png o .webp.',
        statusCode: 400,
      });
      return { valid: false, error: err };
    }

    // 3. MIME type check
    if (!MEDIA_CONFIG.ALLOWED_MIME_TYPES.includes(file.type)) {
      const err = 'El tipo MIME del archivo no es compatible. Se requieren imágenes JPG, PNG o WEBP.';
      console.error('[1-FILE]', {
        message: err,
        code: 'INVALID_MIME_TYPE',
        details: { type: file.type, allowed: MEDIA_CONFIG.ALLOWED_MIME_TYPES },
        hint: 'Asegúrate de que el archivo sea una imagen real.',
        statusCode: 400,
      });
      return { valid: false, error: err };
    }

    // 4. Magic bytes verification (detect disguised SVGs, scripts or binaries)
    const magicCheck = await checkMagicBytes(file);
    if (!magicCheck.valid) {
      const err = 'El archivo no contiene una firma de imagen válida o está corrupto.';
      console.error('[1-FILE]', {
        message: err,
        code: 'MAGIC_BYTES_MISMATCH',
        details: { filename: file.name, declaredType: file.type },
        hint: 'El contenido del archivo no corresponde a los bytes de cabecera esperados.',
        statusCode: 400,
      });
      return { valid: false, error: err };
    }

    return {
      valid: true,
      detectedMime: magicCheck.detectedMime,
      cleanExtension: ext === 'jpeg' ? 'jpg' : ext,
    };
  },

  /**
   * Upload an image to Supabase Storage:
   * [1-FILE] -> [2-SANITIZE] -> [3-STORAGE-UPLOAD] -> [4-PUBLIC-URL]
   * - Strict path: <AUTH_USER_ID>/<safeFilename>.<ext>
   * - Never exposes user original filenames or local paths
   * - Returns { publicUrl, storagePath } for tracking and orphan cleanup
   */
  async uploadDynamoImage(file: File, userId?: string): Promise<UploadDynamoMediaResult> {
    // Stage [1-FILE]
    const validation = await this.validateImageFile(file);
    if (!validation.valid) {
      const fileErr = new Error(validation.error || 'Archivo de imagen no válido.');
      (fileErr as any).stage = '[1-FILE]';
      throw fileErr;
    }

    const mime = validation.detectedMime || file.type;
    const cleanExt = validation.cleanExtension || 'jpg';

    // Stage [2-SANITIZE]: Strip EXIF / GPS metadata
    let sanitizedBlob: Blob;
    try {
      sanitizedBlob = await stripExifAndSanitize(file, mime);
    } catch (sanitizeError: unknown) {
      const errMsg = (sanitizeError as any)?.message || 'Fallo durante la eliminación de metadatos';
      console.error('[2-SANITIZE]', {
        message: errMsg,
        code: 'METADATA_STRIP_FAILED',
        details: sanitizeError,
        hint: 'Intenta convertir la imagen a formato PNG o JPG estándar antes de subirla.',
        statusCode: 422,
      });
      const customSanitizeErr = new Error('No se pudo procesar la imagen de forma segura. Intenta con otra imagen.');
      (customSanitizeErr as any).stage = '[2-SANITIZE]';
      throw customSanitizeErr;
    }

    // Path construction & Auth verification
    let effectiveUserId = (userId || '').trim().replace(/^\/+|\/+$/g, '');

    if (isSupabaseConfigured) {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user?.id) {
        console.error('[3-STORAGE-UPLOAD]', {
          message: authError?.message || 'Usuario no autenticado en Supabase Auth',
          code: authError?.status?.toString() || 'AUTH_SESSION_REQUIRED',
          details: authError,
          hint: 'Debes tener una sesión activa para subir imágenes.',
          statusCode: 401,
        });
        const unauthErr = new Error('Debes iniciar sesión con una cuenta activa para subir imágenes.');
        (unauthErr as any).stage = '[3-STORAGE-UPLOAD]';
        throw unauthErr;
      }
      effectiveUserId = authData.user.id.trim();
    }

    if (!effectiveUserId) {
      const unauthErr = new Error('Se requiere un usuario autenticado para subir imágenes.');
      (unauthErr as any).stage = '[3-STORAGE-UPLOAD]';
      throw unauthErr;
    }

    // Random collision-resistant filename using cryptographically secure entropy (never user-controlled)
    const randomEntropy = generateSecureEntropy(12);
    const safeFilename = `${Date.now()}_${randomEntropy}.${cleanExt}`;

    // STRICT DYNAMO STORAGE PATH: <AUTH_USER_ID>/<safeFilename>.<ext>
    // Must NOT contain 'dynamo-media/', 'avatars/', full URL, query strings, or spaces
    const storagePath = `${effectiveUserId}/${safeFilename}`;
    if (
      storagePath.includes('dynamo-media') ||
      storagePath.includes('avatars') ||
      storagePath.includes('?') ||
      storagePath.includes('&') ||
      /\s/.test(storagePath)
    ) {
      const pathErr = new Error(`Ruta de almacenamiento inválida: "${storagePath}"`);
      (pathErr as any).stage = '[3-STORAGE-UPLOAD]';
      console.error('[3-STORAGE-UPLOAD]', {
        message: pathErr.message,
        code: 'INVALID_STORAGE_PATH',
        details: { storagePath },
        hint: 'La ruta debe contener únicamente el ID del usuario y el nombre seguro del archivo.',
        statusCode: 400,
      });
      throw pathErr;
    }

    // Stage [3-STORAGE-UPLOAD] & Stage [4-PUBLIC-URL]
    if (isSupabaseConfigured) {
      // Pass a File object so multipart/form-data contains the proper filename and MIME type
      const fileToUpload = typeof File !== 'undefined'
        ? new File([sanitizedBlob], safeFilename, { type: mime })
        : sanitizedBlob;

      const { error: uploadError } = await supabase.storage
        .from(MEDIA_CONFIG.STORAGE_BUCKET)
        .upload(storagePath, fileToUpload, {
          contentType: mime,
          upsert: false,
        });

      if (uploadError) {
        const rawMsg = uploadError.message || 'Error desconocido de almacenamiento';
        const errCode = (uploadError as any).code || (uploadError as any).error || 'STORAGE_ERROR';
        const errDetails = (uploadError as any).details || (uploadError as any).data || null;
        const errHint = (uploadError as any).hint || null;
        const statusCode = (uploadError as any).statusCode || (uploadError as any).status || 500;

        // Log technical diagnostic details to console ONLY (without leaking tokens or secrets)
        console.error('[3-STORAGE-UPLOAD]', {
          message: rawMsg,
          code: errCode,
          details: errDetails,
          hint: errHint,
          statusCode: statusCode,
        });

        // Determine user-friendly message
        let userMessage = 'No se pudo almacenar la imagen. Intenta nuevamente.';
        if (
          rawMsg.toLowerCase().includes('policy') ||
          rawMsg.toLowerCase().includes('violates') ||
          rawMsg.toLowerCase().includes('not allowed')
        ) {
          userMessage = 'Las imágenes están temporalmente desactivadas en la plataforma.';
        }

        const uploadErr = new Error(userMessage);
        (uploadErr as any).stage = '[3-STORAGE-UPLOAD]';
        (uploadErr as any).technical = {
          message: rawMsg,
          code: errCode,
          details: errDetails,
          hint: errHint,
          statusCode: statusCode,
        };
        throw uploadErr;
      }

      // Stage [4-PUBLIC-URL]
      const { data: publicUrlData } = supabase.storage
        .from(MEDIA_CONFIG.STORAGE_BUCKET)
        .getPublicUrl(storagePath);

      if (!publicUrlData?.publicUrl) {
        console.error('[4-PUBLIC-URL]', {
          message: 'No se generó la URL pública del objeto almacenado',
          code: 'PUBLIC_URL_GENERATION_FAILED',
          details: { storagePath },
          hint: 'Verifica los permisos de lectura pública del bucket dynamo-media.',
          statusCode: 500,
        });
        const urlErr = new Error('No se pudo generar el enlace público de la imagen.');
        (urlErr as any).stage = '[4-PUBLIC-URL]';
        throw urlErr;
      }

      const publicUrl = publicUrlData.publicUrl;

      // Strict validation of the generated public URL
      if (!publicUrl.startsWith('http://') && !publicUrl.startsWith('https://')) {
        console.error('[4-PUBLIC-URL]', {
          message: 'URL pública no válida (protocolo inválido)',
          code: 'INVALID_URL_PROTOCOL',
          details: { publicUrl },
          hint: 'La URL pública debe comenzar con http:// o https://.',
          statusCode: 500,
        });
        const urlErr = new Error('La dirección de imagen generada no es válida.');
        (urlErr as any).stage = '[4-PUBLIC-URL]';
        throw urlErr;
      }

      if (publicUrl.startsWith('blob:') || publicUrl.startsWith('data:image')) {
        console.error('[4-PUBLIC-URL]', {
          message: 'URL pública generada es local o data URI',
          code: 'LOCAL_URI_DISALLOWED',
          details: { publicUrl: publicUrl.slice(0, 50) },
          hint: 'En producción se requiere una URL remota de Supabase Storage.',
          statusCode: 500,
        });
        const urlErr = new Error('Formato de dirección local no permitido en producción.');
        (urlErr as any).stage = '[4-PUBLIC-URL]';
        throw urlErr;
      }

      if (!mediaStorageService.isValidMediaUrl(publicUrl)) {
        console.error('[4-PUBLIC-URL]', {
          message: 'La URL no corresponde al bucket dynamo-media autorizado',
          code: 'BUCKET_MISMATCH',
          details: { publicUrl, expectedBucket: MEDIA_CONFIG.STORAGE_BUCKET },
          hint: 'Comprueba la configuración del bucket en Supabase.',
          statusCode: 500,
        });
        const urlErr = new Error('La URL de imagen no corresponde al bucket dynamo-media autorizado.');
        (urlErr as any).stage = '[4-PUBLIC-URL]';
        throw urlErr;
      }

      return { publicUrl, storagePath };
    }

    if (import.meta.env.PROD || isSupabaseConfigured) {
      console.error('[3-STORAGE-UPLOAD]', {
        message: 'Servicio de subida de imágenes no configurado en entorno de producción',
        code: 'STORAGE_UNAVAILABLE',
        details: null,
        hint: 'Verifica las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.',
        statusCode: 503,
      });
      const unavailErr = new Error('El servicio de subida de imágenes no está disponible.');
      (unavailErr as any).stage = '[3-STORAGE-UPLOAD]';
      throw unavailErr;
    }

    // Local development fallback: Convert sanitized blob to data URL for preview
    const localDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Error al procesar la imagen localmente'));
      reader.readAsDataURL(sanitizedBlob);
    });

    return {
      publicUrl: localDataUrl,
      storagePath: `${effectiveUserId}/${safeFilename}`,
    };
  },

  /**
   * Immediately removes an object from Supabase Storage by exact path.
   * Used for rollback / cleanup if Dynamo INSERT fails after upload.
   */
  async deleteMediaByPath(storagePath: string): Promise<boolean> {
    if (!storagePath || !isSupabaseConfigured) {
      return false;
    }

    try {
      const cleanPath = storagePath.trim().replace(/^\/+|\/+$/g, '');
      const { error } = await supabase.storage
        .from(MEDIA_CONFIG.STORAGE_BUCKET)
        .remove([cleanPath]);

      if (error) {
        console.warn('[STORAGE-CLEANUP] Error eliminando objeto huérfano de Storage:', error.message);
        return false;
      }
      return true;
    } catch (cleanupErr) {
      console.warn('[STORAGE-CLEANUP] Excepción eliminando objeto huérfano:', cleanupErr);
      return false;
    }
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
