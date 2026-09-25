import { supabase, isSupabaseConfigured } from '@/src/lib/supabase';
import { Profile, EditProfileDTO } from './profilesTypes';
import {
  validateUsername,
  sanitizeAndValidateBio,
} from '@/src/modules/auth/authValidation';
import { mediaStorageService } from '@/src/modules/storage/mediaStorageService';

export const profilesService = {
  async getProfile(userId: string): Promise<Profile | null> {
    if (!userId || !isSupabaseConfigured) return null;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar, bio, created_at, role, status')
        .eq('id', userId)
        .maybeSingle();

      if (error || !data) return null;
      return data as Profile;
    } catch {
      return null;
    }
  },

  async getProfileByUsername(username: string): Promise<Profile | null> {
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername || !isSupabaseConfigured) return null;

    try {
      // Privacy rule: Public profiles query MUST NOT request role, email, or internal admin data
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar, bio, created_at, status')
        .ilike('username', cleanUsername)
        .maybeSingle();

      if (error || !data) return null;
      return data as Profile;
    } catch {
      return null;
    }
  },

  async isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean> {
    const cleanUsername = username.trim().toLowerCase();
    
    // First validate syntax and reserved names
    const validation = validateUsername(cleanUsername);
    if (!validation.isValid) {
      return false;
    }

    if (!isSupabaseConfigured) return false;

    try {
      let query = supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .ilike('username', cleanUsername);

      if (excludeUserId) {
        query = query.neq('id', excludeUserId);
      }

      const { count, error } = await query;
      if (error) return false;
      return (count ?? 0) === 0;
    } catch {
      return false;
    }
  },

  async updateProfile(userId: string, updates: EditProfileDTO): Promise<Profile> {
    if (!isSupabaseConfigured) {
      throw new Error('Servicio de perfiles no disponible.');
    }

    const payload: Partial<Profile> = {};

    // 1. Validate username if provided
    if (updates.username !== undefined) {
      const cleanUsername = updates.username.trim().toLowerCase();
      const usernameCheck = validateUsername(cleanUsername);
      if (!usernameCheck.isValid) {
        throw new Error(usernameCheck.error || 'Nombre de usuario inválido.');
      }

      const isAvailable = await this.isUsernameAvailable(cleanUsername, userId);
      if (!isAvailable) {
        throw new Error('El nombre de usuario ya está en uso. Por favor elige otro.');
      }

      payload.username = cleanUsername;
    }

    // 2. Validate & sanitize bio if provided
    if (updates.bio !== undefined) {
      const bioCheck = sanitizeAndValidateBio(updates.bio);
      if (!bioCheck.isValid) {
        throw new Error(bioCheck.error || 'Biografía no válida.');
      }
      payload.bio = bioCheck.sanitized;
    }

    // 3. Avatar update
    if (updates.avatar !== undefined) {
      const cleanAvatar = updates.avatar.trim();
      if (cleanAvatar && !mediaStorageService.isTrustedAvatarUrl(cleanAvatar)) {
        throw new Error('Solo se permiten avatares subidos a Dynamo o avatares predeterminados.');
      }
      payload.avatar = cleanAvatar;
    }

    // Row Level Security and trigger ensure user only updates own id, and cannot alter role/id/created_at
    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', userId)
      .select('id, username, avatar, bio, created_at, role, status')
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data as Profile;
  },
};

