/**
 * Core Dynamo Rules & Lifespan Logic V0.1
 * Enforces:
 * - Max 280 characters
 * - Max 5 hashtags
 * - Initial 24 hours duration (server controlled)
 * - Bonus 6 hours per energy gift (⚡)
 * - Max hard lifetime limit (168 hours = 7 days)
 * - Visual states: 'active', 'almost_gone' (< 2h), 'expired' (<= 0)
 */

import { detectPersonalData, PiiDetectionResult } from './piiDetector';

export const DYNAMO_CONFIG = {
  MAX_CHARACTERS: 280,
  MAX_HASHTAGS: 5,
  INITIAL_DURATION_HOURS: 24,
  GIFT_BONUS_HOURS: 6,
  MAX_LIFESPAN_HOURS: 168, // 7 days hard ceiling
  DAILY_USER_GIFT_LIMIT: 10,
  ALMOST_GONE_THRESHOLD_MINUTES: 120, // 2 hours
};

export type DynamoVisualState = 'active' | 'almost_gone' | 'expired';

export interface DynamoTimeStatus {
  isExpired: boolean;
  visualState: DynamoVisualState;
  totalMinutesLeft: number;
  totalHoursLeft: number;
  formattedTimeRemaining: string;
  percentageRemaining: number; // 0 to 100
  canReceiveEnergy: boolean;
}

/**
 * Calculates initial expiration timestamp (24 hours)
 */
export function calculateInitialExpiration(durationHours = DYNAMO_CONFIG.INITIAL_DURATION_HOURS): string {
  const expires = new Date(Date.now() + durationHours * 3600 * 1000);
  return expires.toISOString();
}

/**
 * Calculates time remaining and visual status:
 * - 'expired': <= 0
 * - 'almost_gone': < 2 hours (120 minutes)
 * - 'active': >= 2 hours
 */
export function getDynamoTimeStatus(createdAt: string, expiresAt: string): DynamoTimeStatus {
  const now = Date.now();
  const created = new Date(createdAt).getTime();
  const expires = new Date(expiresAt).getTime();

  const diffMs = expires - now;

  if (diffMs <= 0) {
    return {
      isExpired: true,
      visualState: 'expired',
      totalMinutesLeft: 0,
      totalHoursLeft: 0,
      formattedTimeRemaining: 'Expirado',
      percentageRemaining: 0,
      canReceiveEnergy: false,
    };
  }

  const totalMinutesLeft = Math.floor(diffMs / (1000 * 60));
  const totalLifespanMs = Math.max(expires - created, 1);
  const percentageRemaining = Math.min(100, Math.max(0, Math.round((diffMs / totalLifespanMs) * 100)));

  const hoursLeft = Math.floor(totalMinutesLeft / 60);
  const minutesLeft = totalMinutesLeft % 60;

  let formattedTimeRemaining = '';
  if (hoursLeft > 24) {
    const days = Math.floor(hoursLeft / 24);
    const remHours = hoursLeft % 24;
    formattedTimeRemaining = `⏳ ${days}d ${remHours}h`;
  } else if (hoursLeft > 0) {
    formattedTimeRemaining = `⏳ ${hoursLeft}h ${minutesLeft.toString().padStart(2, '0')}m`;
  } else if (minutesLeft > 0) {
    formattedTimeRemaining = `⏳ ${minutesLeft}m`;
  } else {
    formattedTimeRemaining = `⏳ < 1m`;
  }

  const visualState: DynamoVisualState =
    totalMinutesLeft <= DYNAMO_CONFIG.ALMOST_GONE_THRESHOLD_MINUTES ? 'almost_gone' : 'active';

  const totalHoursLeft = Number((diffMs / (1000 * 3600)).toFixed(1));

  return {
    isExpired: false,
    visualState,
    totalMinutesLeft,
    totalHoursLeft,
    formattedTimeRemaining,
    percentageRemaining,
    canReceiveEnergy: true,
  };
}

/**
 * Extracts and sanitizes hashtags, capping at MAX_HASHTAGS (5)
 */
export function extractHashtags(text: string): { tags: string[]; error?: string } {
  const matches = text.match(/#([a-zA-Z0-9_]+)/g) || [];
  const normalized = Array.from(
    new Set(matches.map((tag) => tag.substring(1).toLowerCase()))
  );

  if (normalized.length > DYNAMO_CONFIG.MAX_HASHTAGS) {
    return {
      tags: normalized.slice(0, DYNAMO_CONFIG.MAX_HASHTAGS),
      error: `Máximo permitido: ${DYNAMO_CONFIG.MAX_HASHTAGS} hashtags. Se tomaron los primeros 5.`,
    };
  }

  return { tags: normalized };
}

/**
 * Validates a Dynamo payload before sending:
 * - Content length (1 to 280)
 * - Max 5 hashtags
 * - PII / Sensitive personal data detection
 */
export function validateDynamoPayload(content: string): {
  valid: boolean;
  error?: string;
  piiResult: PiiDetectionResult;
  sanitized: string;
} {
  const trimmed = content.trim();
  const piiResult = detectPersonalData(trimmed);

  if (!trimmed) {
    return {
      valid: false,
      error: 'El contenido no puede estar vacío.',
      piiResult,
      sanitized: '',
    };
  }

  if (trimmed.length > DYNAMO_CONFIG.MAX_CHARACTERS) {
    return {
      valid: false,
      error: `El contenido supera los ${DYNAMO_CONFIG.MAX_CHARACTERS} caracteres (${trimmed.length}/${DYNAMO_CONFIG.MAX_CHARACTERS}).`,
      piiResult,
      sanitized: trimmed,
    };
  }

  const { tags } = extractHashtags(trimmed);
  if (tags.length > DYNAMO_CONFIG.MAX_HASHTAGS) {
    return {
      valid: false,
      error: `Máximo 5 hashtags permitidos por Dynamo.`,
      piiResult,
      sanitized: trimmed,
    };
  }

  // Strip harmful script tags and control characters
  const sanitized = trimmed
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

  return {
    valid: !piiResult.hasPii,
    error: piiResult.hasPii ? piiResult.warningMessage : undefined,
    piiResult,
    sanitized,
  };
}
