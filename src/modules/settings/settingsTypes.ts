export type SettingsTab =
  | 'account'
  | 'privacy'
  | 'notifications'
  | 'security'
  | 'community'
  | 'danger';

export interface UserSettings {
  user_id: string;
  // Privacy preferences
  allow_followers: 'everyone' | 'nobody';
  profile_visibility: 'public' | 'minimal';
  social_notifications: boolean;
  // Notification preferences
  notify_dynamos_received: boolean;
  notify_replies: boolean;
  notify_new_followers: boolean;
  notify_expiring: boolean;
  notify_badges: boolean;
  notify_system: boolean; // Always true, locked
  // Timestamps
  created_at?: string;
  updated_at?: string;
}

export type UpdateSettingsDTO = Partial<Omit<UserSettings, 'user_id' | 'created_at' | 'updated_at' | 'notify_system'>>;

export const DEFAULT_USER_SETTINGS: Omit<UserSettings, 'user_id'> = {
  allow_followers: 'everyone',
  profile_visibility: 'public',
  social_notifications: true,
  notify_dynamos_received: true,
  notify_replies: true,
  notify_new_followers: true,
  notify_expiring: true,
  notify_badges: true,
  notify_system: true,
};

/**
 * Safely masks an email address to protect privacy.
 * Example: 'emprendetriunfando@gmail.com' -> 'em••••••••••••@gmail.com'
 */
export function maskEmail(email?: string | null): string {
  if (!email || !email.includes('@')) return 'correo_no_disponible';
  const [name, domain] = email.split('@');
  if (name.length <= 2) {
    return `${name}*@${domain}`;
  }
  const prefix = name.slice(0, 2);
  const stars = '•'.repeat(Math.max(4, Math.min(name.length - 2, 8)));
  return `${prefix}${stars}@${domain}`;
}
