/**
 * Centralized, safe error formatting utility for Dynamo.
 * Strips internal table names, SQL codes, RPC details, tokens, and stack traces,
 * converting raw errors into friendly, safe, understandable Spanish messages.
 */

export function formatUserFriendlyError(error: unknown): string {
  if (!error) {
    return 'Ocurrió un error inesperado. Por favor, intenta de nuevo.';
  }

  // Check offline status first
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'Sin conexión. Inténtalo nuevamente cuando tengas internet.';
  }

  const rawMessage =
    typeof error === 'string'
      ? error
      : (error as any)?.message || (error as any)?.error_description || String(error);

  // Stage tags or technical database error codes must never leak to user UI:
  // Console preserves technical diagnostics, while UI receives clean, friendly Spanish.
  if (rawMessage.startsWith('[1-FILE]')) {
    return 'Archivo de imagen no válido. Debe ser JPG, PNG o WEBP de hasta 5 MB.';
  }
  if (rawMessage.startsWith('[2-SANITIZE]')) {
    return 'No se pudo procesar la imagen seleccionada. Intenta con otra imagen.';
  }
  if (rawMessage.startsWith('[3-STORAGE-UPLOAD]') || rawMessage.startsWith('[Storage upload]')) {
    if (rawMessage.toLowerCase().includes('desactivadas') || rawMessage.toLowerCase().includes('policy')) {
      return 'Las imágenes están temporalmente desactivadas en la plataforma.';
    }
    return 'No se pudo almacenar la imagen. Intenta nuevamente.';
  }
  if (rawMessage.startsWith('[4-PUBLIC-URL]') || rawMessage.startsWith('[public URL]')) {
    return 'No se pudo generar el enlace público de la imagen. Intenta nuevamente.';
  }
  if (rawMessage.startsWith('[5-DYNAMO-INSERT]') || rawMessage.startsWith('[INSERT dynamos]')) {
    return 'No se pudo publicar el Dynamo. Intenta nuevamente.';
  }

  // Database error codes / 22023
  if (
    rawMessage.includes('22023') ||
    rawMessage.toLowerCase().includes('database error')
  ) {
    return 'No se pudo almacenar la imagen. Intenta nuevamente.';
  }

  const lower = rawMessage.toLowerCase();

  // Network / Fetch errors
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes('connection refused') ||
    lower.includes('sin conexión')
  ) {
    return 'Sin conexión. Inténtalo nuevamente cuando tengas internet.';
  }

  // Session / JWT expiration
  if (
    lower.includes('jwt expired') ||
    lower.includes('token expired') ||
    lower.includes('invalid refresh token') ||
    lower.includes('session expired') ||
    lower.includes('not logged in') ||
    lower.includes('auth session missing')
  ) {
    return 'Tu sesión ha expirado o no es válida. Por favor, vuelve a iniciar sesión.';
  }

  // Duplicate / Conflict
  if (
    lower.includes('duplicate key') ||
    lower.includes('unique constraint') ||
    lower.includes('ya existe') ||
    lower.includes('already exists') ||
    lower.includes('already following')
  ) {
    return 'Esta acción ya fue realizada previamente.';
  }

  // Permissions / RLS / Unauthorized
  if (
    lower.includes('permission denied') ||
    lower.includes('violates row-level security') ||
    lower.includes('rls') ||
    lower.includes('unauthorized') ||
    lower.includes('insufficient permissions')
  ) {
    return 'No tienes permisos suficientes para realizar esta acción.';
  }

  // Rate Limiting / 429
  if (lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('429')) {
    return 'Has realizado demasiadas solicitudes en poco tiempo. Espera un momento antes de reintentar.';
  }

  // Epired Dynamo / Lifespan
  if (lower.includes('expirado') || lower.includes('expired')) {
    return 'Esta publicación ya ha expirado y no admite más interacciones.';
  }

  // Energy / Balance insufficient
  if (lower.includes('balance insuficiente') || lower.includes('energía insuficiente') || lower.includes('not enough energy')) {
    return 'No cuentas con suficiente energía ⚡ disponible para completar esta acción.';
  }

  // Self-action blocked
  if (lower.includes('propio dynamo') || lower.includes('own dynamo') || lower.includes('ti mismo')) {
    return 'No puedes realizar esta acción sobre tu propio contenido o perfil.';
  }

  // Hidden / Moderated content
  if (lower.includes('ocultado por moderación') || lower.includes('moderated') || lower.includes('bloqueado')) {
    return 'Esta acción no está permitida debido al estado de moderación o bloqueo de la cuenta.';
  }

  // Clean raw SQL / schema leakage if any remains
  if (
    lower.includes('sql') ||
    lower.includes('syntax error') ||
    lower.includes('pg_') ||
    lower.includes('column') ||
    lower.includes('table') ||
    lower.includes('relation') ||
    lower.includes('schema') ||
    lower.includes('rpc') ||
    lower.includes('record "') ||
    lower.includes('has no field') ||
    lower.includes('sender_user_id')
  ) {
    return 'No se pudo procesar la solicitud de energía en el servidor. Por favor, intenta de nuevo más tarde.';
  }

  // If already clean and short without technical jargon, return it
  if (rawMessage.length < 120 && !rawMessage.includes('{') && !rawMessage.includes('}')) {
    return rawMessage;
  }

  return 'Ocurrió un inconveniente temporal. Inténtalo de nuevo.';
}
