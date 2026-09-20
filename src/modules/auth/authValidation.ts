/**
 * Dynamo V0.1 - Auth & Profile Validation Rules
 * Strict validation and sanitization for accounts and profiles.
 */

export const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'moderator',
  'mod',
  'dynamo',
  'root',
  'system',
  'support',
  'help',
  'official',
  'api',
  'bot',
  'terms',
  'privacy',
  'auth',
  'login',
  'signup',
  'register',
  'null',
  'undefined',
  'anonymous',
  'staff',
  'security',
  'feed',
  'profile',
  'explore',
  'dev',
]);

export const AUTH_LIMITS = {
  MIN_AGE: 16,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 20,
  PASSWORD_MIN_LENGTH: 8,
  BIO_MAX_LENGTH: 140,
};

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates a username according to Dynamo V0.1 requirements:
 * - 3 to 20 characters
 * - Only letters, numbers and underscores (^[a-zA-Z0-9_]+$)
 * - No spaces
 * - Not in reserved system usernames
 */
export function validateUsername(username: string): ValidationResult {
  const trimmed = username.trim();

  if (!trimmed) {
    return { isValid: false, error: 'El nombre de usuario es obligatorio.' };
  }

  if (username.includes(' ')) {
    return { isValid: false, error: 'El nombre de usuario no puede contener espacios.' };
  }

  if (trimmed.length < AUTH_LIMITS.USERNAME_MIN_LENGTH || trimmed.length > AUTH_LIMITS.USERNAME_MAX_LENGTH) {
    return {
      isValid: false,
      error: `El nombre de usuario debe tener entre ${AUTH_LIMITS.USERNAME_MIN_LENGTH} y ${AUTH_LIMITS.USERNAME_MAX_LENGTH} caracteres.`,
    };
  }

  const usernameRegex = /^[a-zA-Z0-9_]+$/;
  if (!usernameRegex.test(trimmed)) {
    return {
      isValid: false,
      error: 'Solo se permiten letras (A-Z), números (0-9) y guion bajo (_).',
    };
  }

  if (RESERVED_USERNAMES.has(trimmed.toLowerCase())) {
    return {
      isValid: false,
      error: 'Este nombre de usuario está reservado por el sistema. Elige otro.',
    };
  }

  return { isValid: true };
}

/**
 * Validates email format.
 */
export function validateEmail(email: string): ValidationResult {
  const trimmed = email.trim();
  if (!trimmed) {
    return { isValid: false, error: 'El correo electrónico es obligatorio.' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { isValid: false, error: 'Ingresa un correo electrónico válido.' };
  }

  return { isValid: true };
}

/**
 * Validates password strength:
 * - Minimum 8 characters
 * - At least one letter
 * - At least one number
 */
export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return { isValid: false, error: 'La contraseña es obligatoria.' };
  }

  if (password.length < AUTH_LIMITS.PASSWORD_MIN_LENGTH) {
    return {
      isValid: false,
      error: `La contraseña debe tener al menos ${AUTH_LIMITS.PASSWORD_MIN_LENGTH} caracteres.`,
    };
  }

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (!hasLetter || !hasNumber) {
    return {
      isValid: false,
      error: 'La contraseña debe incluir al menos una letra y un número.',
    };
  }

  return { isValid: true };
}

/**
 * Sanitizes and validates bio according to Privacy & Security specifications:
 * - Max 140 characters
 * - Strips dangerous HTML / scripts
 * - Forbids phone numbers, WhatsApp links, personal emails, physical addresses
 */
export function sanitizeAndValidateBio(bio: string): {
  sanitized: string;
  isValid: boolean;
  error?: string;
} {
  if (!bio) {
    return { sanitized: '', isValid: true };
  }

  // Strip HTML / script tags
  let cleaned = bio.replace(/[<>]/g, '').trim();

  // Enforce max 140 chars
  if (cleaned.length > AUTH_LIMITS.BIO_MAX_LENGTH) {
    return {
      sanitized: cleaned.slice(0, AUTH_LIMITS.BIO_MAX_LENGTH),
      isValid: false,
      error: `La biografía no puede exceder los ${AUTH_LIMITS.BIO_MAX_LENGTH} caracteres.`,
    };
  }

  // Detect phone numbers (e.g. 7 or more digits with optional dashes, spaces, parentheses, or +)
  const phonePattern = /(?:\+?\d{1,4}[-.\s]?)?(?:\(?\d{2,5}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}/;
  const digitsOnly = cleaned.replace(/\D/g, '');
  if (digitsOnly.length >= 8 && phonePattern.test(cleaned)) {
    return {
      sanitized: cleaned,
      isValid: false,
      error: 'Por privacidad, no se permiten números de teléfono o WhatsApp en el perfil.',
    };
  }

  // Detect WhatsApp links
  const whatsappPattern = /(?:wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|whatsapp:)/i;
  if (whatsappPattern.test(cleaned)) {
    return {
      sanitized: cleaned,
      isValid: false,
      error: 'Por privacidad, no se permiten enlaces directos de WhatsApp en la biografía.',
    };
  }

  // Detect email addresses in bio
  const emailInBioPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  if (emailInBioPattern.test(cleaned)) {
    return {
      sanitized: cleaned,
      isValid: false,
      error: 'Por privacidad, el correo electrónico no debe publicarse en la biografía.',
    };
  }

  return { sanitized: cleaned, isValid: true };
}
