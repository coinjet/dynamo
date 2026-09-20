/**
 * Client-side Rate Limiter
 * Guards against rapid fire submissions (spam protection)
 */

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const actionRecords: Map<string, RateLimitRecord> = new Map();

export function checkRateLimit(actionKey: string, maxAttempts = 5, windowMs = 60000): { allowed: boolean; waitSeconds?: number } {
  const now = Date.now();
  const record = actionRecords.get(actionKey);

  if (!record || now > record.resetTime) {
    actionRecords.set(actionKey, {
      count: 1,
      resetTime: now + windowMs,
    });
    return { allowed: true };
  }

  if (record.count >= maxAttempts) {
    const waitSeconds = Math.ceil((record.resetTime - now) / 1000);
    return { allowed: false, waitSeconds };
  }

  record.count += 1;
  return { allowed: true };
}
