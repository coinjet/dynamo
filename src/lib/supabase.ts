import { createClient } from '@supabase/supabase-js';

const env = typeof import.meta !== 'undefined' && import.meta.env
  ? import.meta.env
  : (process.env as any) || {};

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

// Check if valid URL & Key are provided (not placeholders)
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project') &&
  !supabaseAnonKey.includes('your-anon-key')
);

// Environment flags
export const isProduction = Boolean(env.PROD);
export const isMissingProductionConfig = !isSupabaseConfigured && isProduction;

// Inert fallback only to prevent top-level import crashes when environment variables are being initialized
const fallbackUrl = 'https://dynamo-unconfigured.supabase.co';
const fallbackKey = 'unconfigured-public-anon-key';

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient(fallbackUrl, fallbackKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
