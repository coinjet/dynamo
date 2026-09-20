/**
 * Safe logger for Dynamo.
 * Suppresses console output in production to prevent leaking internal database
 * errors, tokens, SQL details, or stack traces.
 */
const isDev = import.meta.env.DEV;

export const logger = {
  warn: (..._args: unknown[]) => {
    if (isDev) {
      // In development only, if needed for local debugging
    }
  },
  error: (..._args: unknown[]) => {
    if (isDev) {
      // In development only, if needed for local debugging
    }
  },
};
