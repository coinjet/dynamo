export type ReferralEventType =
  | 'click'
  | 'landing_view'
  | 'signup_started'
  | 'signup_completed'
  | 'email_confirmed'
  | 'first_dynamo'
  | 'first_interaction';

export interface ReferralCodeInfo {
  code: string;
  created_at: string;
}

export interface ReferralStats {
  code: string | null;
  clicks: number;
  landing_views: number;
  signups: number;
  confirmed: number;
  active_users: number;
}

export interface ValidateReferralResult {
  valid: boolean;
  code?: string;
  inviter_username?: string;
  error?: string;
}
