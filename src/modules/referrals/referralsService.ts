import { supabase, isSupabaseConfigured } from '@/src/lib/supabase';
import {
  ReferralCodeInfo,
  ReferralStats,
  ValidateReferralResult,
  ReferralEventType,
} from './referralsTypes';

const SESSION_STORAGE_REF_KEY = 'dynamo_referral_ref';
const SESSION_STORAGE_SESSION_ID = 'dynamo_visitor_session_id';

export const referralsService = {
  /**
   * Returns stored referral code from current session if user entered via /join?ref=
   */
  getStoredReferralCode(): string | null {
    try {
      return sessionStorage.getItem(SESSION_STORAGE_REF_KEY);
    } catch {
      return null;
    }
  },

  /**
   * Persists referral code in sessionStorage
   */
  setStoredReferralCode(code: string): void {
    try {
      const clean = code.trim().toUpperCase();
      if (clean) {
        sessionStorage.setItem(SESSION_STORAGE_REF_KEY, clean);
      }
    } catch {}
  },

  /**
   * Clears stored referral code after successful registration
   */
  clearStoredReferralCode(): void {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_REF_KEY);
    } catch {}
  },

  /**
   * Generates or retrieves a lightweight session ID for deduplication of funnel events
   */
  getSessionId(): string {
    try {
      let sid = sessionStorage.getItem(SESSION_STORAGE_SESSION_ID);
      if (!sid) {
        sid = 'sess_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
        sessionStorage.setItem(SESSION_STORAGE_SESSION_ID, sid);
      }
      return sid;
    } catch {
      return 'sess_fallback_' + Date.now().toString(36);
    }
  },

  /**
   * Validates an invitation / referral code with the database
   */
  async validateCode(code: string): Promise<ValidateReferralResult> {
    const clean = code.trim().toUpperCase();
    if (!clean) {
      return { valid: false, error: 'Código de invitación no válido.' };
    }

    if (!isSupabaseConfigured) {
      return { valid: false, error: 'Servicio de validación no disponible.' };
    }

    try {
      const { data, error } = await supabase.rpc('validate_referral_code', {
        p_code: clean,
      });

      if (error || !data) {
        return { valid: false, error: 'No fue posible validar el código de invitación.' };
      }

      return data as ValidateReferralResult;
    } catch (err: any) {
      return { valid: false, error: err.message || 'Error al validar invitación.' };
    }
  },

  /**
   * Logs a funnel event (click, landing_view, signup_started)
   */
  async trackEvent(code: string, eventType: ReferralEventType): Promise<void> {
    const clean = code.trim().toUpperCase();
    if (!clean || !isSupabaseConfigured) return;

    try {
      const sessionId = this.getSessionId();
      await supabase.rpc('track_referral_event', {
        p_code: clean,
        p_event_type: eventType,
        p_session_id: sessionId,
      });
    } catch (err) {
      // Non-blocking telemetry
      if (import.meta.env.DEV) {
        console.warn('[referralsService.trackEvent] Failed:', err);
      }
    }
  },

  /**
   * Fetches or generates the active user's referral code
   */
  async getMyReferralCode(): Promise<ReferralCodeInfo | null> {
    if (!isSupabaseConfigured) return null;

    try {
      const { data, error } = await supabase.rpc('get_or_create_my_referral_code');
      if (error || !data) return null;

      return {
        code: data.code,
        created_at: data.created_at,
      };
    } catch (err) {
      console.warn('[referralsService.getMyReferralCode] Error:', err);
      return null;
    }
  },

  /**
   * Fetches real referral funnel statistics for the current user
   */
  async getMyReferralStats(): Promise<ReferralStats> {
    const emptyStats: ReferralStats = {
      code: null,
      clicks: 0,
      landing_views: 0,
      signups: 0,
      confirmed: 0,
      active_users: 0,
    };

    if (!isSupabaseConfigured) return emptyStats;

    try {
      const { data, error } = await supabase.rpc('get_my_referral_stats');
      if (error || !data) return emptyStats;

      return {
        code: data.code || null,
        clicks: Number(data.clicks) || 0,
        landing_views: Number(data.landing_views) || 0,
        signups: Number(data.signups) || 0,
        confirmed: Number(data.confirmed) || 0,
        active_users: Number(data.active_users) || 0,
      };
    } catch (err) {
      console.warn('[referralsService.getMyReferralStats] Error:', err);
      return emptyStats;
    }
  },
};
