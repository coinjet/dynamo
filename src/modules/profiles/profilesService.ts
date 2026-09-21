import { supabase, isSupabaseConfigured } from '@/src/lib/supabase';
import { Profile, EditProfileDTO } from './profilesTypes';
import {
  validateUsername,
  sanitizeAndValidateBio,
} from '@/src/modules/auth/authValidation';
import { mediaStorageService } from '@/src/modules/storage/mediaStorageService';

const LOCAL_STORAGE_PROFILES_KEY = 'dynamo_mock_profiles_store';

function getLocalProfiles(): Record<string, Profile> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {
    'usr_f891a2b3-4c5d-6e7f-8a9b-0c1d2e3f4a5b': {
      id: 'usr_f891a2b3-4c5d-6e7f-8a9b-0c1d2e3f4a5b',
      username: 'sol_valenzuela',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80',
      bio: 'Cronista nocturna. ⚡',
      created_at: '2026-08-15T12:00:00Z',
      role: 'user',
      status: 'active',
    },
  };
}

function saveLocalProfiles(profiles: Record<string, Profile>) {
  localStorage.setItem(LOCAL_STORAGE_PROFILES_KEY, JSON.stringify(profiles));
}

export const profilesService = {
  async getProfile(userId: string): Promise<Profile | null> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar, bio, created_at, role, status')
        .eq('id', userId)
        .maybeSingle();

      if (error || !data) return null;
      return data as Profile;
    }

    const profiles = getLocalProfiles();
    return profiles[userId] || null;
  },

  async getProfileByUsername(username: string): Promise<Profile | null> {
    const cleanUsername = username.trim().toLowerCase();
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar, bio, created_at, role, status')
        .ilike('username', cleanUsername)
        .maybeSingle();

      if (error || !data) return null;
      return data as Profile;
    }

    const profiles = getLocalProfiles();
    const found = Object.values(profiles).find(
      (p) => p.username.toLowerCase() === cleanUsername
    );
    return found || null;
  },

  async isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean> {
    const cleanUsername = username.trim().toLowerCase();
    
    // First validate syntax and reserved names
    const validation = validateUsername(cleanUsername);
    if (!validation.isValid) {
      return false;
    }

    if (isSupabaseConfigured) {
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
    }

    // Local fallback check
    const profiles = getLocalProfiles();
    const existing = Object.values(profiles).find(
      (p) => p.username.toLowerCase() === cleanUsername && p.id !== excludeUserId
    );
    return !existing;
  },

  async updateProfile(userId: string, updates: EditProfileDTO): Promise<Profile> {
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

    if (isSupabaseConfigured) {
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
    }

    // Local fallback
    const profiles = getLocalProfiles();
    const current = profiles[userId] || {
      id: userId,
      username: 'usuario',
      avatar: '',
      bio: '',
      created_at: new Date().toISOString(),
      role: 'user',
      status: 'active',
    };

    const updated: Profile = {
      ...current,
      ...payload,
    };

    profiles[userId] = updated;
    saveLocalProfiles(profiles);

    return updated;
  },
};
