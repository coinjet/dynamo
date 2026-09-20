/**
 * Content Sanitizer & Safety Helpers
 * Prevents script injection, strips dangerous HTML, and limits spam repetition.
 */

export function sanitizeText(input: string): string {
  if (!input) return '';
  return input
    .replace(/[<>]/g, '') // Strip basic HTML tags
    .trim();
}

export function validateCharLimit(text: string, maxLimit = 280): boolean {
  return text.trim().length > 0 && text.length <= maxLimit;
}

export function detectSpamPattern(text: string): boolean {
  // Check for repeated identical characters (e.g. "aaaaaaa...")
  const repeatedChars = /(.)\1{10,}/;
  if (repeatedChars.test(text)) return true;

  // Check for excessive capitalization
  if (text.length > 20) {
    const letters = text.replace(/[^a-zA-Z]/g, '');
    if (letters.length > 0) {
      const upperCount = (text.match(/[A-Z]/g) || []).length;
      if (upperCount / letters.length > 0.85) return true;
    }
  }

  return false;
}
