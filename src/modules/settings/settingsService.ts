import { supabase, isSupabaseConfigured } from '@/src/lib/supabase';
import {
  UserSettings,
  UpdateSettingsDTO,
  DEFAULT_USER_SETTINGS,
} from './settingsTypes';
import { validatePassword } from '@/src/modules/auth/authValidation';
import { NotificationType } from '@/src/modules/notifications/notificationsTypes';

const LOCAL_STORAGE_SETTINGS_KEY = 'dynamo_user_settings_store';

function getLocalSettingsStore(): Record<string, UserSettings> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {};
}

function saveLocalSettingsStore(store: Record<string, UserSettings>) {
  localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(store));
}

export const settingsService = {
  /**
   * Retrieves user privacy and notification settings.
   */
  async getUserSettings(userId: string): Promise<UserSettings> {
    if (!userId) {
      throw new Error('Identificador de usuario no proporcionado.');
    }

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (!error && data) {
          return {
            user_id: data.user_id,
            allow_followers: data.allow_followers || 'everyone',
            profile_visibility: data.profile_visibility || 'public',
            social_notifications: data.social_notifications ?? true,
            notify_dynamos_received: data.notify_dynamos_received ?? true,
            notify_replies: data.notify_replies ?? true,
            notify_new_followers: data.notify_new_followers ?? true,
            notify_expiring: data.notify_expiring ?? true,
            notify_badges: data.notify_badges ?? true,
            notify_system: true,
            created_at: data.created_at,
            updated_at: data.updated_at,
          };
        }

        // If not found, insert default settings for this user
        const initial: UserSettings = {
          user_id: userId,
          ...DEFAULT_USER_SETTINGS,
        };

        const { data: inserted, error: insertError } = await supabase
          .from('user_settings')
          .insert(initial)
          .select('*')
          .maybeSingle();

        if (!insertError && inserted) {
          return inserted as UserSettings;
        }
      } catch (err) {
        console.warn('Supabase get user_settings failed:', err);
      }
    }

    if (import.meta.env.PROD || isSupabaseConfigured) {
      return {
        user_id: userId,
        ...DEFAULT_USER_SETTINGS,
      };
    }

    // Local fallback (development only)
    const store = getLocalSettingsStore();
    if (!store[userId]) {
      store[userId] = {
        user_id: userId,
        ...DEFAULT_USER_SETTINGS,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      saveLocalSettingsStore(store);
    }
    return store[userId];
  },

  /**
   * Updates user settings with strict RLS enforcement.
   * System notices are permanently locked to true.
   */
  async updateUserSettings(userId: string, updates: UpdateSettingsDTO): Promise<UserSettings> {
    if (!userId) {
      throw new Error('Identificador de usuario no proporcionado.');
    }

    const payload: UpdateSettingsDTO = { ...updates };

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          ...payload,
          notify_system: true,
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .maybeSingle();

      if (error || !data) {
        throw new Error(error ? `Error al guardar configuración: ${error.message}` : 'Error al guardar configuración.');
      }
      return data as UserSettings;
    }

    if (import.meta.env.PROD || isSupabaseConfigured) {
      throw new Error('Estamos teniendo problemas de conexión al guardar la configuración. Inténtalo nuevamente.');
    }

    // Local fallback (development only)
    const store = getLocalSettingsStore();
    const current = store[userId] || {
      user_id: userId,
      ...DEFAULT_USER_SETTINGS,
      created_at: new Date().toISOString(),
    };

    const updated: UserSettings = {
      ...current,
      ...payload,
      notify_system: true,
      updated_at: new Date().toISOString(),
    };

    store[userId] = updated;
    saveLocalSettingsStore(store);
    return updated;
  },

  /**
   * Checks whether a given notification type is enabled by the recipient's preferences.
   */
  async isNotificationAllowed(
    userId: string,
    type: NotificationType,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    try {
      const settings = await this.getUserSettings(userId);

      // System notifications can never be disabled
      if (type === 'system' && !metadata?.badge_key) {
        return true;
      }

      // Check badge notifications
      if (metadata?.badge_key || type === 'system') {
        return Boolean(settings.notify_badges);
      }

      // Check master social notifications toggle
      if (!settings.social_notifications && (type === 'follow' || type === 'gift' || type === 'reply')) {
        return false;
      }

      switch (type) {
        case 'gift':
          return Boolean(settings.notify_dynamos_received);
        case 'reply':
          return Boolean(settings.notify_replies);
        case 'follow':
          return Boolean(settings.notify_new_followers);
        case 'expiring':
          return Boolean(settings.notify_expiring);
        default:
          return true;
      }
    } catch {
      return true; // fail-safe default: do not break notifications
    }
  },

  /**
   * Checks if target user allows incoming followers via secure RPC.
   * Does not expose private notification preferences or settings.
   */
  async canFollowUser(targetUserId: string): Promise<boolean> {
    if (!targetUserId) return false;

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('get_user_follow_permissions', {
          p_target_user_id: targetUserId,
        });

        if (error) {
          console.error('Error checking follow permissions RPC:', error);
          return false;
        }

        return Boolean(data?.can_follow);
      } catch (err) {
        console.error('Exception calling get_user_follow_permissions:', err);
        return false;
      }
    }

    try {
      const store = getLocalSettingsStore();
      const settings = store[targetUserId] || DEFAULT_USER_SETTINGS;
      return settings.allow_followers !== 'nobody';
    } catch {
      return true;
    }
  },

  /**
   * Safely updates the account password with optional current password re-verification.
   */
  async changePassword(params: {
    currentPassword?: string;
    newPassword: string;
    confirmPassword: string;
    userEmail?: string;
  }): Promise<void> {
    const { currentPassword, newPassword, confirmPassword, userEmail } = params;

    // 1. Validate new password strength
    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      throw new Error(validation.error || 'La nueva contraseña debe tener al menos 8 caracteres.');
    }

    // 2. Validate confirmation match
    if (newPassword !== confirmPassword) {
      throw new Error('Las contraseñas no coinciden. Por favor verifícalas.');
    }

    if (isSupabaseConfigured) {
      // If current password provided and email available, re-authenticate to confirm identity
      if (currentPassword && userEmail) {
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email: userEmail,
          password: currentPassword,
        });
        if (verifyError) {
          throw new Error('La contraseña actual es incorrecta.');
        }
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw new Error(updateError.message || 'No fue posible actualizar la contraseña.');
      }
    }
  },

  /**
   * Terminates all sessions across devices using Supabase global sign out.
   */
  async signOutAllSessions(): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch (err) {
        console.warn('Global signOut error:', err);
      }
    }
    localStorage.removeItem('dynamo_auth_session');
  },

  /**
   * Safe server-side account deletion via RPC.
   * Cleans relationships, marks dynamos expired, anonymizes profile, and logs audit record.
   */
  async deleteAccount(
    userId: string,
    confirmationPhrase: string
  ): Promise<{ success: boolean; message: string }> {
    const cleanPhrase = confirmationPhrase.trim().toUpperCase();
    if (cleanPhrase !== 'ELIMINAR' && cleanPhrase !== 'ELIMINAR MI CUENTA') {
      throw new Error('Debes escribir la palabra "ELIMINAR" para confirmar la acción.');
    }

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('delete_own_account', {
        p_confirmation: 'eliminar',
      });

      if (error) {
        throw new Error(error.message || 'No fue posible eliminar la cuenta.');
      }

      if (data && data.success === false) {
        throw new Error(data.error || 'Error al eliminar la cuenta.');
      }

      return {
        success: true,
        message: data?.message || 'Cuenta eliminada y desactivada exitosamente.',
      };
    }

    if (!isSupabaseConfigured) {
      throw new Error('Servicio de eliminación no disponible en este momento.');
    }

    throw new Error('No es posible procesar la solicitud en este momento.');
  },
};
