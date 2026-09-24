import { supabase, isSupabaseConfigured } from '@/src/lib/supabase';
import { Dynamo, CreateDynamoDTO } from './dynamosTypes';
import {
  calculateInitialExpiration,
  extractHashtags,
  validateDynamoPayload,
  DYNAMO_CONFIG,
} from './dynamoRules';
import { Profile } from '../profiles/profilesTypes';
import { relationshipsService } from '../relationships/relationshipsService';
import { FeedFilterType } from '../relationships/relationshipsTypes';
import { notificationsService } from '../notifications/notificationsService';
import { bestDynamosService } from '../bestDynamos/bestDynamosService';
import { mediaStorageService } from '../storage/mediaStorageService';
import { systemConfigService } from '../systemConfig/systemConfigService';

const LOCAL_STORAGE_DYNAMOS_KEY = 'dynamo_feed_records';

const SEED_DYNAMOS: Dynamo[] = [
  {
    id: 'dyn_001',
    user_id: 'usr_mateo_99',
    content: 'La plaza central despertó con niebla fría y aroma a café tostado en leña. Nada vence iniciar la mañana escribiendo sin algoritmos que te persigan. #cronica #cafe #manana',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
    expires_at: new Date(Date.now() + 1000 * 60 * 60 * 21).toISOString(), // 21 hours left (Active)
    status: 'active',
    author: {
      id: 'usr_mateo_99',
      username: 'mateo_delvalle',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&h=256&q=80',
      bio: 'Arquitecto y peatón observador.',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
      status: 'active',
    },
    hashtags: ['cronica', 'cafe', 'manana'],
    energy_gifts_count: 5,
    replies_count: 3,
  },
  {
    id: 'dyn_002',
    user_id: 'usr_lucia_sound',
    content: '¿Se han fijado que cuando una idea tiene fecha de caducidad te esfuerzas más en decir la verdad? El microcontenido no debería durar para siempre. ⚡',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(), // 22 hours ago
    expires_at: new Date(Date.now() + 1000 * 60 * 85).toISOString(), // 85 minutes left (Casi desaparece: < 2 horas)
    status: 'active',
    author: {
      id: 'usr_lucia_sound',
      username: 'lucia_cordoba',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&h=256&q=80',
      bio: 'Diseño sonoro y microensayos en directo.',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
      status: 'active',
    },
    hashtags: ['ideas', 'reflexion'],
    energy_gifts_count: 2,
    replies_count: 1,
  },
  {
    id: 'dyn_003',
    user_id: 'usr_f891a2b3-4c5d-6e7f-8a9b-0c1d2e3f4a5b',
    content: 'Lanzando la primera señal en Dynamo. Construcción limpia, PWA nativa, base de datos modular y energía comunitaria. ¿Quién está listo para el cambio de paradigma? #dynamo #webdev',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString(),
    expires_at: new Date(Date.now() + 1000 * 60 * 60 * 23).toISOString(), // 23 hours left (Active)
    status: 'active',
    author: {
      id: 'usr_f891a2b3-4c5d-6e7f-8a9b-0c1d2e3f4a5b',
      username: 'sol_valenzuela',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80',
      bio: 'Cronista nocturna, amante de los tacos al pastor y el código limpio. ⚡',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
      status: 'active',
    },
    hashtags: ['dynamo', 'webdev'],
    energy_gifts_count: 8,
    replies_count: 4,
  }
];

function getStoredDynamos(): Dynamo[] {
  const stored = localStorage.getItem(LOCAL_STORAGE_DYNAMOS_KEY);
  if (!stored) {
    localStorage.setItem(LOCAL_STORAGE_DYNAMOS_KEY, JSON.stringify(SEED_DYNAMOS));
    return SEED_DYNAMOS;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return SEED_DYNAMOS;
  }
}

function saveStoredDynamos(dynamos: Dynamo[]) {
  localStorage.setItem(LOCAL_STORAGE_DYNAMOS_KEY, JSON.stringify(dynamos));
}

export interface GiftEnergyResult {
  newExpiresAt: string;
  totalGifts: number;
  reachedMaxLifespan: boolean;
  giftsRemainingToday?: number;
}

export interface FeedResult {
  dynamos: Dynamo[];
  hasMore: boolean;
}

export const dynamosService = {
  /**
   * Feed "Todos", "Siguiendo" & "Amigos":
   * Returns active, non-expired dynamos ordered by created_at DESC.
   * Filters out:
   * - Blocked authors (bidirectional)
   * - Muted authors
   * - Expired dynamos
   * When feedType === 'siguiendo': Only authors followed by current user.
   * When feedType === 'amigos': Only authors with mutual friendship (A follows B && B follows A).
   * Supports limited page loading (no infinite scroll).
   */
  async getActiveFeed(
    currentUserId?: string,
    limit = 20,
    offset = 0,
    feedType: FeedFilterType = 'todos'
  ): Promise<Dynamo[]> {
    const now = new Date().toISOString();

    // If 'siguiendo' or 'amigos' is selected without authentication, return empty feed
    if ((feedType === 'siguiendo' || feedType === 'amigos') && !currentUserId) {
      return [];
    }

    if (isSupabaseConfigured) {
      try {
        // Excluded users (blocked bidirectionally + muted)
        const excludedUserIds = await relationshipsService.getExcludedUserIdsForFeed(currentUserId);

        let allowedAuthorIds: string[] | null = null;
        if (feedType === 'siguiendo' && currentUserId) {
          allowedAuthorIds = await relationshipsService.getFollowingIds(currentUserId);
          if (allowedAuthorIds.length === 0) return [];
        } else if (feedType === 'amigos' && currentUserId) {
          allowedAuthorIds = await relationshipsService.getFriendsIds(currentUserId);
          if (allowedAuthorIds.length === 0) return [];
        }

        let query = supabase
          .from('dynamos')
          .select(`
            id,
            user_id,
            content,
            image_url,
            created_at,
            expires_at,
            status,
            profiles:user_id (id, username, avatar, bio, status, created_at),
            dynamo_gifts(count),
            replies(count)
          `)
          .eq('status', 'active')
          .gt('expires_at', now)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (excludedUserIds.length > 0) {
          query = query.not('user_id', 'in', `(${excludedUserIds.join(',')})`);
        }

        if (allowedAuthorIds !== null) {
          query = query.in('user_id', allowedAuthorIds);
        }

        const { data, error } = await query;
        if (error) throw error;

        return (data || []).map((item: any) => {
          const giftCount = item.dynamo_gifts?.[0]?.count || 0;
          const replyCount = item.replies?.[0]?.count || 0;
          return {
            id: item.id,
            user_id: item.user_id,
            content: item.content,
            image_url: item.image_url || null,
            created_at: item.created_at,
            expires_at: item.expires_at,
            status: item.status,
            author: item.profiles,
            hashtags: extractHashtags(item.content).tags,
            energy_gifts_count: giftCount,
            replies_count: replyCount,
          };
        });
      } catch (err) {
        console.warn('Supabase query failed:', err);
        if (import.meta.env.PROD || isSupabaseConfigured) {
          throw new Error('Estamos teniendo problemas de conexión. Inténtalo nuevamente.');
        }
      }
    }

    // Local fallback ONLY allowed in development environment without Supabase
    if (import.meta.env.PROD || isSupabaseConfigured) {
      return [];
    }

    // Local fallback: filter out expired, non-active, and blocked/muted
    const list = getStoredDynamos();
    const excludedUserIds = await relationshipsService.getExcludedUserIdsForFeed(currentUserId);

    let allowedAuthorIds: string[] | null = null;
    if (feedType === 'siguiendo' && currentUserId) {
      allowedAuthorIds = await relationshipsService.getFollowingIds(currentUserId);
      if (allowedAuthorIds.length === 0) return [];
    } else if (feedType === 'amigos' && currentUserId) {
      allowedAuthorIds = await relationshipsService.getFriendsIds(currentUserId);
      if (allowedAuthorIds.length === 0) return [];
    }

    const activeList = list.filter((d) => {
      const isNotExpired = new Date(d.expires_at).getTime() > Date.now();
      const isExcluded = excludedUserIds.includes(d.user_id);
      const isAllowedByFilter =
        allowedAuthorIds === null || allowedAuthorIds.includes(d.user_id);

      return d.status === 'active' && isNotExpired && !isExcluded && isAllowedByFilter;
    });

    const sorted = activeList.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return sorted.slice(offset, offset + limit);
  },

  /**
   * Mark a Dynamo as expired on the server / local storage when its lifespan hits 0.
   */
  async markAsExpired(dynamoId: string): Promise<boolean> {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('dynamos')
          .update({ status: 'expired' })
          .eq('id', dynamoId)
          .lte('expires_at', new Date().toISOString());

        return !error;
      } catch (err) {
        console.warn('Error marking dynamo as expired on Supabase:', err);
        return false;
      }
    }

    const current = getStoredDynamos();
    const idx = current.findIndex((d) => d.id === dynamoId);
    if (idx !== -1) {
      current[idx].status = 'expired';
      saveStoredDynamos(current);
      return true;
    }
    return false;
  },

  /**
   * Publish a new Dynamo:
   * - Content max 280 characters
   * - Max 5 hashtags
   * - PII data check & sanitization
   * - Server determines created_at and enforces initial 24h duration (client CANNOT specify expires_at)
   * - Initial status: 'active'
   */
  async createDynamo(dto: CreateDynamoDTO, author: Profile): Promise<Dynamo> {
    const validation = validateDynamoPayload(dto.content);
    if (!validation.valid) {
      throw new Error(validation.error || 'Datos inválidos para publicar Dynamo');
    }

    // If an image is attached, validate global switch and media URL authenticity
    if (dto.image_url && dto.image_url.trim()) {
      try {
        const settings = await systemConfigService.getSettings();
        const imagesAllowed = settings.allow_images ?? settings.allow_media_uploads ?? false;
        if (!imagesAllowed) {
          throw new Error('Las imágenes están temporalmente desactivadas.');
        }
      } catch (err: any) {
        if (err.message === 'Las imágenes están temporalmente desactivadas.') {
          throw err;
        }
      }

      if (!mediaStorageService.isValidMediaUrl(dto.image_url.trim())) {
        throw new Error('La dirección de la imagen no es válida o no proviene del almacenamiento autorizado.');
      }
    }

    const sanitizedContent = validation.sanitized;
    const { tags } = extractHashtags(sanitizedContent);
    const validImageUrl = dto.image_url && dto.image_url.trim() ? dto.image_url.trim() : null;

    if (isSupabaseConfigured) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && !user.email_confirmed_at && !(user as any).confirmed_at) {
        throw new Error('Confirma tu correo para activar tu cuenta de Dynamo antes de publicar.');
      }

      // Expiration is calculated and strictly controlled server-side by PostgreSQL trigger trg_set_dynamo_creation_defaults()
      const { data, error } = await supabase
        .from('dynamos')
        .insert({
          user_id: author.id,
          content: sanitizedContent,
          image_url: validImageUrl,
          // expires_at is deliberately omitted so PostgreSQL trigger sets it to created_at + 24 hours
        })
        .select()
        .single();

      if (error) {
        console.error('[5-DYNAMO-INSERT]', {
          message: error.message,
          code: error.code || 'UNKNOWN',
          details: error.details || null,
          hint: error.hint || null,
          statusCode: (error as any).status || 500,
        });

        const insertErr = new Error('No se pudo publicar el Dynamo. Intenta nuevamente.');
        (insertErr as any).stage = '[5-DYNAMO-INSERT]';
        (insertErr as any).technical = {
          message: error.message,
          code: error.code || 'UNKNOWN',
          details: error.details || null,
          hint: error.hint || null,
          statusCode: (error as any).status || 500,
        };
        throw insertErr;
      }

      // Link hashtags safely
      for (const tag of tags) {
        let tagId: string | null = null;
        const { data: existingTag } = await supabase
          .from('hashtags')
          .select('id')
          .eq('name', tag)
          .maybeSingle();

        if (existingTag) {
          tagId = existingTag.id;
        } else {
          const { data: newTag } = await supabase
            .from('hashtags')
            .insert({ name: tag })
            .select('id')
            .single();
          if (newTag) tagId = newTag.id;
        }

        if (tagId && data.id) {
          await supabase.from('dynamo_hashtags').insert({
            dynamo_id: data.id,
            hashtag_id: tagId,
          });
        }
      }

      return {
        ...data,
        author,
        hashtags: tags,
        energy_gifts_count: 0,
        replies_count: 0,
      };
    }

    if (import.meta.env.PROD) {
      throw new Error('Estamos teniendo problemas de conexión. Inténtalo nuevamente.');
    }

    // Local fallback for development environment:
    // Initial 24 hours duration strictly assigned
    const initialExpiresAt = calculateInitialExpiration(DYNAMO_CONFIG.INITIAL_DURATION_HOURS);
    const newDynamo: Dynamo = {
      id: 'dyn_' + Math.random().toString(36).substring(2, 10),
      user_id: author.id,
      content: sanitizedContent,
      image_url: validImageUrl,
      created_at: new Date().toISOString(),
      expires_at: initialExpiresAt,
      status: 'active',
      author,
      hashtags: tags,
      energy_gifts_count: 0,
      replies_count: 0,
    };

    const current = getStoredDynamos();
    saveStoredDynamos([newDynamo, ...current]);
    return newDynamo;
  },

  /**
   * ⚡ Gift energy to a Dynamo:
   * Strictly uses server procedure gift_energy_to_dynamo().
   * Rules:
   * - +6 hours per valid ⚡
   * - Absolute maximum: 168 hours (7 days) from created_at
   * - Maximum 10 ⚡ per user in 24 hours
   * - Cannot gift to own dynamo
   * - Cannot duplicate gift to the same dynamo from the same account
   */
  async giftEnergy(
    dynamoId: string,
    giverId: string,
    balanceType: 'free' | 'purchased' = 'free'
  ): Promise<GiftEnergyResult> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('gift_energy_to_dynamo', {
        p_dynamo_id: dynamoId,
      });

      if (error) {
        throw new Error(error.message);
      }

      // Check if maximum lifespan was reached
      return {
        newExpiresAt: data.new_expires_at,
        totalGifts: data.total_gifts ?? 1,
        reachedMaxLifespan: Boolean(data.reached_max_lifespan),
        giftsRemainingToday: data.gifts_remaining_today,
      };
    }

    if (import.meta.env.PROD) {
      throw new Error('Estamos teniendo problemas de conexión. Inténtalo nuevamente.');
    }

    // Local development emulation matching PostgreSQL function logic
    const current = getStoredDynamos();
    const itemIndex = current.findIndex((d) => d.id === dynamoId);
    if (itemIndex === -1) {
      throw new Error('El Dynamo no existe');
    }

    const item = current[itemIndex];

    // Rule: Cannot gift to own dynamo
    if (item.user_id === giverId) {
      throw new Error('No puedes inyectar energía a tu propio Dynamo');
    }

    // Rule: Check status & expiration
    if (item.status !== 'active' || new Date(item.expires_at).getTime() <= Date.now()) {
      throw new Error('No se puede inyectar energía a un Dynamo expirado o inactivo');
    }

    // Rule: Cannot duplicate gift to same dynamo from same account
    const USER_GIFTS_RECORD_KEY = `dynamo_gifts_by_user_${giverId}`;
    const userGifts: string[] = JSON.parse(localStorage.getItem(USER_GIFTS_RECORD_KEY) || '[]');
    if (userGifts.includes(dynamoId)) {
      throw new Error('Ya has entregado energía a este Dynamo');
    }

    // Rule: Rolling 24-hour daily limit (max 10 per day) for free quota
    const DAILY_GIFTS_KEY = `dynamo_daily_gift_timestamps_${giverId}`;
    const now = Date.now();
    const timestamps: number[] = JSON.parse(localStorage.getItem(DAILY_GIFTS_KEY) || '[]');
    const recentTimestamps = timestamps.filter((t) => now - t < 24 * 3600 * 1000);

    if (balanceType === 'free' && recentTimestamps.length >= DYNAMO_CONFIG.DAILY_USER_GIFT_LIMIT) {
      throw new Error(`Has alcanzado el límite diario de energía (${DYNAMO_CONFIG.DAILY_USER_GIFT_LIMIT} al día)`);
    }

    // Lifespan calculation (+6 hours, capped at created_at + 168 hours)
    const currentExpiresTime = new Date(item.expires_at).getTime();
    const createdTime = new Date(item.created_at).getTime();
    const bonusMs = DYNAMO_CONFIG.GIFT_BONUS_HOURS * 3600 * 1000;
    const maxLifespanMs = DYNAMO_CONFIG.MAX_LIFESPAN_HOURS * 3600 * 1000;
    const ceilingTime = createdTime + maxLifespanMs;

    let newExpiresTime = currentExpiresTime + bonusMs;
    let reachedMaxLifespan = false;

    if (currentExpiresTime >= ceilingTime) {
      reachedMaxLifespan = true;
      newExpiresTime = ceilingTime;
    } else if (newExpiresTime >= ceilingTime) {
      newExpiresTime = ceilingTime;
      reachedMaxLifespan = true;
    }

    const newExpiresAt = new Date(newExpiresTime).toISOString();
    const totalGifts = (item.energy_gifts_count || 0) + 1;
    const nowIso = new Date().toISOString();

    current[itemIndex] = {
      ...item,
      expires_at: newExpiresAt,
      energy_gifts_count: totalGifts,
      last_gift_at: nowIso,
    };

    saveStoredDynamos(current);

    // Record gift
    userGifts.push(dynamoId);
    localStorage.setItem(USER_GIFTS_RECORD_KEY, JSON.stringify(userGifts));

    if (balanceType === 'free') {
      recentTimestamps.push(now);
      localStorage.setItem(DAILY_GIFTS_KEY, JSON.stringify(recentTimestamps));
    }

    // Emit secure notification to the author of the Dynamo
    const giverProfileRaw = localStorage.getItem('dynamo_profile_' + giverId);
    const giverProfile = giverProfileRaw ? JSON.parse(giverProfileRaw) : undefined;
    notificationsService.createNotification({
      recipientId: item.user_id,
      type: 'gift',
      sender: giverProfile,
      referenceId: dynamoId,
      metadata: { dynamo_id: dynamoId },
    }).catch(console.error);

    // Evaluate and award badges automatically to author and update ranking
    bestDynamosService.evaluateAndAwardBadges(item.user_id)
      .then(() => bestDynamosService.reevaluateTopRankingBadges())
      .catch(console.error);

    return {
      newExpiresAt,
      totalGifts,
      reachedMaxLifespan,
      giftsRemainingToday: DYNAMO_CONFIG.DAILY_USER_GIFT_LIMIT - recentTimestamps.length,
    };
  },

  async getUserDynamos(userId: string): Promise<Dynamo[]> {
    if (isSupabaseConfigured) {
      try {
        const nowIso = new Date().toISOString();
        const { data } = await supabase
          .from('dynamos')
          .select(`
            id,
            user_id,
            content,
            image_url,
            created_at,
            expires_at,
            status,
            hashtags,
            author:user_id (id, username, avatar, bio, status, created_at),
            dynamo_gifts(count),
            replies(count)
          `)
          .eq('user_id', userId)
          .eq('status', 'active')
          .gt('expires_at', nowIso)
          .order('created_at', { ascending: false });

        return (data || [])
          .filter((item: any) => item.author?.status !== 'suspended')
          .map((item: any) => ({
            id: item.id,
            user_id: item.user_id,
            content: item.content,
            image_url: item.image_url,
            created_at: item.created_at,
            expires_at: item.expires_at,
            status: item.status,
            author: item.author,
            hashtags: item.hashtags || extractHashtags(item.content).tags,
            energy_gifts_count: item.dynamo_gifts?.[0]?.count || 0,
            replies_count: item.replies?.[0]?.count || 0,
          }));
      } catch {
        return [];
      }
    }

    if (import.meta.env.PROD) {
      return [];
    }

    const current = getStoredDynamos();
    const now = Date.now();
    return current.filter((d) => d.user_id === userId && d.status === 'active' && new Date(d.expires_at).getTime() > now);
  },

  async getDynamoById(dynamoId: string): Promise<Dynamo | null> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('dynamos')
          .select(`
            id,
            user_id,
            content,
            image_url,
            created_at,
            expires_at,
            status,
            hashtags,
            author:user_id (id, username, avatar, bio, status, created_at),
            dynamo_gifts(count),
            replies(count)
          `)
          .eq('id', dynamoId)
          .maybeSingle();

        if (error || !data) return null;
        if (data.status === 'deleted') return null;
        if ((data as any).author && (data as any).author.status === 'suspended') return null;

        return {
          id: data.id,
          user_id: data.user_id,
          content: data.content,
          image_url: data.image_url,
          created_at: data.created_at,
          expires_at: data.expires_at,
          status: data.status,
          hashtags: data.hashtags || extractHashtags(data.content).tags,
          energy_gifts_count: (data as any).dynamo_gifts?.[0]?.count || 0,
          replies_count: (data as any).replies?.[0]?.count || 0,
          author: (data as any).author,
        };
      } catch (err) {
        console.warn('Error fetching single dynamo by ID:', err);
        return null;
      }
    }

    if (import.meta.env.PROD) {
      return null;
    }

    const current = getStoredDynamos();
    return current.find((d) => d.id === dynamoId) || null;
  },

  async deleteDynamo(dynamoId: string, userId: string): Promise<boolean> {
    if (isSupabaseConfigured) {
      // First fetch to check if the dynamo has an attached image
      const { data: existing } = await supabase
        .from('dynamos')
        .select('id, image_url')
        .eq('id', dynamoId)
        .eq('user_id', userId)
        .maybeSingle();

      const { error } = await supabase
        .from('dynamos')
        .delete()
        .eq('id', dynamoId)
        .eq('user_id', userId);

      if (!error && existing?.image_url) {
        // Safe storage cleanup: only deletes from the user's own storage directory
        await mediaStorageService.deleteMedia(existing.image_url, userId).catch((err) => {
          console.warn('Notice: Background storage cleanup on dynamo deletion:', err);
        });
      }

      return !error;
    }

    if (import.meta.env.PROD) {
      throw new Error('Estamos teniendo problemas de conexión. Inténtalo nuevamente.');
    }

    const current = getStoredDynamos();
    const filtered = current.filter((d) => !(d.id === dynamoId && d.user_id === userId));
    saveStoredDynamos(filtered);
    return true;
  },

  /**
   * Subscribes to real-time new Dynamos.
   * Calls onNewDynamo whenever an active, non-expired dynamo is published.
   * Returns an unsubscribe function.
   */
  subscribeToNewDynamos(onNewDynamo: (dynamo: Dynamo) => void): () => void {
    if (!isSupabaseConfigured) {
      return () => {};
    }

    try {
      const channelName = `realtime-new-dynamos-${Date.now()}`;
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'dynamos',
          },
          async (payload) => {
            const raw = payload.new as any;
            if (!raw || raw.status !== 'active') return;
            if (new Date(raw.expires_at).getTime() <= Date.now()) return;

            // Fetch the author profile to produce a complete Dynamo object
            let author: Profile | undefined;
            if (raw.user_id) {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('id, username, avatar, bio, status, created_at')
                .eq('id', raw.user_id)
                .maybeSingle();
              if (profileData) {
                if ((profileData as any).status === 'suspended') return;
                author = profileData as Profile;
              }
            }

            const dynamo: Dynamo = {
              id: raw.id,
              user_id: raw.user_id,
              content: raw.content,
              image_url: raw.image_url,
              created_at: raw.created_at,
              expires_at: raw.expires_at,
              status: raw.status,
              hashtags: extractHashtags(raw.content).tags,
              energy_gifts_count: 0,
              replies_count: 0,
              author,
            };

            onNewDynamo(dynamo);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (err) {
      console.warn('Error subscribing to new dynamos:', err);
      return () => {};
    }
  },
};
