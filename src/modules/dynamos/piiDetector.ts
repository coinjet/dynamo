/**
 * PII & Sensitive Personal Data Detector
 * Detects phone numbers, emails, WhatsApp/Telegram handles/links,
 * street addresses, exact locations/coordinates, and ID numbers before publishing.
 */

export interface PiiDetectionResult {
  hasPii: boolean;
  categories: string[];
  warningMessage?: string;
  matches: string[];
}

export function detectPersonalData(text: string): PiiDetectionResult {
  const categories: string[] = [];
  const matches: string[] = [];
  const lower = text.toLowerCase();

  // 1. Email detection (standard & obfuscated)
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const emailMatches = text.match(emailRegex);
  if (emailMatches) {
    categories.push('Correo electrónico');
    matches.push(...emailMatches);
  } else if (
    /\b[A-Za-z0-9._%+-]+\s*(?:\[at\]|\(at\)|\(arroba\)|\[arroba\])\s*[A-Za-z0-9.-]+\s*(?:\[dot\]|\(dot\)|\(punto\)|\.)\s*[A-Za-z]{2,}\b/i.test(text)
  ) {
    categories.push('Correo electrónico');
    matches.push('correo ofuscado');
  }

  // 2. WhatsApp / Telegram links or handles
  const messagingRegex = /(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=|t\.me\/|telegram\.me\/)[a-zA-Z0-9_+]+/gi;
  const messagingMatches = text.match(messagingRegex);
  if (messagingMatches) {
    categories.push('Enlace de WhatsApp / Telegram');
    matches.push(...messagingMatches);
  } else if (
    /(?:mi\s+(?:whatsapp|wpp|wa|telegram|tg)|escr[ií]beme\s+(?:al|por)\s+(?:whatsapp|wpp|wa|telegram|tg))\s*[:=]?\s*([+\d\s\-_@]{5,})/i.test(text)
  ) {
    categories.push('Contacto directo (WhatsApp/Telegram)');
    matches.push('referencia a mensajería privada');
  }

  // 3. Phone numbers (local & international, 7 to 15 digits)
  // Match patterns like +54 9 11 1234 5678, (011) 4567-8901, +1-800-555-0199, 11-4567-8901
  const phoneRegex = /(?:(?:\+|00)\d{1,3}[\s.-]?)?(?:\(?\d{2,5}\)?[\s.-]?)?\d{3,5}[\s.-]?\d{3,5}(?:[\s.-]?\d{1,5})?/g;
  const potentialPhones = text.match(phoneRegex) || [];
  for (const match of potentialPhones) {
    const digitsOnly = match.replace(/\D/g, '');
    // Ignore short number sequences like years (2024), percentages, or simple counters
    if (digitsOnly.length >= 8 && digitsOnly.length <= 15) {
      // Exclude simple timestamps or common numbers
      if (!categories.includes('Número telefónico')) {
        categories.push('Número telefónico');
      }
      matches.push(match.trim());
    }
  }

  // Explicit phone prefixes: "tel:", "cel:", "celular:", "telefono:"
  if (
    /(?:tel[ée]fono|cel(?:ular)?|m[oó]vil|whatsapp|wpp)\s*[:=]?\s*[\d\s+\-().]{6,}/i.test(text) &&
    !categories.includes('Número telefónico')
  ) {
    categories.push('Número telefónico');
    matches.push('teléfono');
  }

  // 4. Physical address / Exact location
  // Match patterns like "Calle Falsa 123", "Av. Corrientes 1234", "Carrera 7 # 12", "C/ Mayor 15", "Piso 4 Depto B"
  const addressRegex = /\b(?:calle|avda\.?|av\.?|avenida|carrera|cra\.?|pasaje|boulevard|blvd\.?|diagonal|ruta)\s+[A-Za-zÁÉÍÓÚáéíóúñÑ0-9\s]{2,30}\s+(?:#|n[uú]m(?:ero)?\.?|n[ºo]\.?)?\s*\d{1,5}\b/i;
  const addressMatch = text.match(addressRegex);
  if (addressMatch) {
    categories.push('Dirección física');
    matches.push(addressMatch[0].trim());
  }

  // Piso / Depto / Código Postal
  if (/\b(?:c\.?p\.?|c[oó]digo\s+postal)\s*[:=]?\s*\d{4,6}\b/i.test(text)) {
    categories.push('Código postal / Ubicación');
    matches.push('código postal');
  }

  // GPS Coordinates (e.g. -34.6037, -58.3816)
  const gpsRegex = /[-+]?\d{1,2}\.\d{4,8}\s*,\s*[-+]?\d{1,3}\.\d{4,8}/g;
  const gpsMatch = text.match(gpsRegex);
  if (gpsMatch) {
    categories.push('Coordenadas GPS');
    matches.push(...gpsMatch);
  }

  // 5. Official ID numbers (DNI, RUT, SSN, CUIT, Pasaporte)
  if (/\b(?:dni|rut|cuit|cuil|c[eé]dula|ssn|pasaporte)\s*[:=]?\s*[\d.-]{6,15}\b/i.test(text)) {
    categories.push('Documento de identidad');
    matches.push('documento');
  }

  const hasPii = categories.length > 0;
  let warningMessage: string | undefined;

  if (hasPii) {
    const list = Array.from(new Set(categories)).join(', ');
    warningMessage = `Por tu privacidad y seguridad, hemos detectado posibles datos personales (${list}) en tu texto. Por favor revisa y edita tu publicación antes de enviarla.`;
  }

  return {
    hasPii,
    categories: Array.from(new Set(categories)),
    warningMessage,
    matches: Array.from(new Set(matches)),
  };
}
