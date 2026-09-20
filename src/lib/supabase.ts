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
export const isDemoMode = !isSupabaseConfigured && Boolean(env.DEV || !isProduction);
export const isMissingProductionConfig = !isSupabaseConfigured && isProduction;

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://mock-dynamo.supabase.co', 'mock-anon-key', {
      auth: { persistSession: true, autoRefreshToken: false },
    });
