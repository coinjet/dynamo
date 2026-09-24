import { supabase, isSupabaseConfigured } from '@/src/lib/supabase';
import { Dynamo } from '../dynamos/dynamosTypes';
import { extractHashtags } from '../dynamos/dynamoRules';
import { relationshipsService } from '../relationships/relationshipsService';
import { DiscoveryFeedParams, TrendingTopic } from './discoveryTypes';

const LOCAL_STORAGE_DYNAMOS_KEY = 'dynamo_feed_records';
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function getStoredDynamos(): Dynamo[] {
  const raw = localStorage.getItem(LOCAL_STORAGE_DYNAMOS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export const discoveryService = {
  /**
   * Normalizes hashtag strings: strips leading #, trims, and converts to lowercase.
   */
  normalizeTag(raw: string): string {
    return raw.replace(/^#/, '').toLowerCase().trim();
  },

  /**
   * 1. TENDENCIAS 🔥
   * Returns hashtags with the highest recent activity based on active, non-expired Dynamos.
   * Rules:
   * - Only unexpired, active publications.
   * - No likes or vanity metrics.
   * - No personal data.
   * - Normalized to lowercase.
   * - Ordered by active posts count DESC, then last activity DESC.
   */
  async getTrendingHashtags(limit = 10): Promise<TrendingTopic[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('get_trending_hashtags', {
          p_limit: limit,
        });

        if (!error && Array.isArray(data) && data.length > 0) {
          return data.map((row: any) => ({
            name: this.normalizeTag(row.name),
            activeCount: Number(row.active_count || 1),
            lastActivityAt: row.last_activity_at,
          }));
        }
      } catch (err) {
        console.warn('Fallback to querying trending hashtags via client:', err);
      }
    }

    if (import.meta.env.PROD || isSupabaseConfigured) {
      return [];
    }

    // Local / Fallback calculation:
    // Strictly evaluate ACTIVE and NON-EXPIRED dynamos
    const now = Date.now();
    const dynamos = getStoredDynamos();
    const activeDynamos = dynamos.filter(
      (d) => d.status === 'active' && new Date(d.expires_at).getTime() > now
    );

    const tagMap = new Map<string, { count: number; lastActivity: number }>();

    for (const d of activeDynamos) {
      const tags = d.hashtags?.length
        ? d.hashtags
        : extractHashtags(d.content).tags;

      const createdTime = new Date(d.created_at).getTime();

      // Deduplicate tags within the same dynamo
      const uniqueTags = new Set(tags.map((t) => this.normalizeTag(t)).filter(Boolean));

      uniqueTags.forEach((normTag) => {
        const current = tagMap.get(normTag);
        if (current) {
          current.count += 1;
          if (createdTime > current.lastActivity) {
            current.lastActivity = createdTime;
          }
        } else {
          tagMap.set(normTag, { count: 1, lastActivity: createdTime });
        }
      });
    }

    // Sort by active count DESC, then by last activity DESC
    const sorted = Array.from(tagMap.entries())
      .map(([name, stat]) => ({
        name,
        activeCount: stat.count,
        lastActivityAt: new Date(stat.lastActivity).toISOString(),
      }))
      .sort((a, b) => {
        if (b.activeCount !== a.activeCount) {
          return b.activeCount - a.activeCount;
        }
        return (
          new Date(b.lastActivityAt || 0).getTime() -
          new Date(a.lastActivityAt || 0).getTime()
        );
      });

    return sorted.slice(0, limit);
  },

  /**
   * Helper: Resolves allowed authors based on feed relationship filter (todos | siguiendo | amigos)
   * and excluded authors (blocked bidirectionally + muted).
   */
  async resolveAuthorFilters(currentUserId?: string, filter = 'todos') {
    const excludedUserIds = await relationshipsService.getExcludedUserIdsForFeed(currentUserId);

    let allowedAuthorIds: string[] | null = null;
    if (filter === 'siguiendo') {
      if (!currentUserId) return { excludedUserIds, allowedAuthorIds: [] };
      allowedAuthorIds = await relationshipsService.getFollowingIds(currentUserId);
    } else if (filter === 'amigos') {
      if (!currentUserId) return { excludedUserIds, allowedAuthorIds: [] };
      allowedAuthorIds = await relationshipsService.getFriendsIds(currentUserId);
    }

    return { excludedUserIds, allowedAuthorIds };
  },

  /**
   * 1b. DYNAMOS POR HASHTAG (Al tocar un hashtag)
   * Shows active dynamos tagged with the given hashtag.
   * Maintains batch pagination and terminates.
   */
  async getDynamosByHashtag(params: DiscoveryFeedParams & { hashtag: string }): Promise<Dynamo[]> {
    const {
      hashtag,
      currentUserId,
      limit = 10,
      offset = 0,
      filter = 'todos',
    } = params;

    const normalizedTarget = this.normalizeTag(hashtag);
    const nowIso = new Date().toISOString();
    const { excludedUserIds, allowedAuthorIds } = await this.resolveAuthorFilters(currentUserId, filter);

    if (allowedAuthorIds !== null && allowedAuthorIds.length === 0) {
      return [];
    }

    if (isSupabaseConfigured) {
      try {
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
          .gt('expires_at', nowIso)
          .ilike('content', `%#${normalizedTarget}%`)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (excludedUserIds.length > 0) {
          query = query.not('user_id', 'in', `(${excludedUserIds.join(',')})`);
        }

        if (allowedAuthorIds !== null) {
          query = query.in('user_id', allowedAuthorIds);
        }

        const { data, error } = await query;
        if (!error && data) {
          return data.map((item: any) => ({
            id: item.id,
            user_id: item.user_id,
            content: item.content,
            image_url: item.image_url || null,
            created_at: item.created_at,
            expires_at: item.expires_at,
            status: item.status,
            author: item.profiles,
            hashtags: extractHashtags(item.content).tags,
            energy_gifts_count: item.dynamo_gifts?.[0]?.count || 0,
            replies_count: item.replies?.[0]?.count || 0,
          }));
        }
      } catch (err) {
        console.warn('Supabase hashtag query failed:', err);
      }
    }

    if (import.meta.env.PROD || isSupabaseConfigured) {
      return [];
    }

    // Local Storage Fallback
    const now = Date.now();
    const all = getStoredDynamos();
    const filtered = all.filter((d) => {
      const isNotExpired = new Date(d.expires_at).getTime() > now;
      if (d.status !== 'active' || !isNotExpired) return false;
      if (excludedUserIds.includes(d.user_id)) return false;
      if (allowedAuthorIds !== null && !allowedAuthorIds.includes(d.user_id)) return false;

      const tags = (d.hashtags?.length ? d.hashtags : extractHashtags(d.content).tags)
        .map((t) => this.normalizeTag(t));

      return tags.includes(normalizedTarget);
    });

    const sorted = filtered.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return sorted.slice(offset, offset + limit);
  },

  /**
   * 2. CASI DESAPARECEN ⏳
   * Shows active Dynamos with remaining time < 2 hours.
   * Order:
   * 1. Least remaining time first (expires_at ASC).
   * 2. Secondary: recent activity (created_at DESC).
   * Excludes:
   * - Expired.
   * - Blocked (bidirectional).
   * - Silenciados (muted).
   */
  async getCasiDesaparecen(params: DiscoveryFeedParams): Promise<Dynamo[]> {
    const {
      currentUserId,
      limit = 10,
      offset = 0,
      filter = 'todos',
    } = params;

    const now = new Date();
    const nowIso = now.toISOString();
    const twoHoursLaterIso = new Date(now.getTime() + TWO_HOURS_MS).toISOString();

    const { excludedUserIds, allowedAuthorIds } = await this.resolveAuthorFilters(currentUserId, filter);
    if (allowedAuthorIds !== null && allowedAuthorIds.length === 0) {
      return [];
    }

    if (isSupabaseConfigured) {
      try {
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
          .gt('expires_at', nowIso)
          .lte('expires_at', twoHoursLaterIso)
          .order('expires_at', { ascending: true })
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (excludedUserIds.length > 0) {
          query = query.not('user_id', 'in', `(${excludedUserIds.join(',')})`);
        }

        if (allowedAuthorIds !== null) {
          query = query.in('user_id', allowedAuthorIds);
        }

        const { data, error } = await query;
        if (!error && data) {
          return data.map((item: any) => ({
            id: item.id,
            user_id: item.user_id,
            content: item.content,
            image_url: item.image_url || null,
            created_at: item.created_at,
            expires_at: item.expires_at,
            status: item.status,
            author: item.profiles,
            hashtags: extractHashtags(item.content).tags,
            energy_gifts_count: item.dynamo_gifts?.[0]?.count || 0,
            replies_count: item.replies?.[0]?.count || 0,
          }));
        }
      } catch (err) {
        console.warn('Supabase Casi Desaparecen query failed:', err);
      }
    }

    if (import.meta.env.PROD || isSupabaseConfigured) {
      return [];
    }

    // Local Storage Fallback
    const nowMs = Date.now();
    const all = getStoredDynamos();
    const filtered = all.filter((d) => {
      const expiresMs = new Date(d.expires_at).getTime();
      const remainingMs = expiresMs - nowMs;

      // Active and remaining life is between 0 and 2 hours (<= 7200000ms)
      const isCasiDesaparece = d.status === 'active' && remainingMs > 0 && remainingMs <= TWO_HOURS_MS;
      if (!isCasiDesaparece) return false;
      if (excludedUserIds.includes(d.user_id)) return false;
      if (allowedAuthorIds !== null && !allowedAuthorIds.includes(d.user_id)) return false;

      return true;
    });

    // Sort: 1. expires_at ASC (least remaining time first), 2. created_at DESC
    const sorted = filtered.sort((a, b) => {
      const expDiff = new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime();
      if (expDiff !== 0) return expDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return sorted.slice(offset, offset + limit);
  },

  /**
   * 3. REVIVIENDO ⚡
   * Shows active Dynamos that recently received energy ⚡.
   * Ordered by recent energy activity (most recent gift first).
   * Not a permanent ranking.
   */
  async getReviviendo(params: DiscoveryFeedParams): Promise<Dynamo[]> {
    const {
      currentUserId,
      limit = 10,
      offset = 0,
      filter = 'todos',
    } = params;

    const nowIso = new Date().toISOString();
    const { excludedUserIds, allowedAuthorIds } = await this.resolveAuthorFilters(currentUserId, filter);
    if (allowedAuthorIds !== null && allowedAuthorIds.length === 0) {
      return [];
    }

    if (isSupabaseConfigured) {
      try {
        // Query active dynamos that have at least 1 gift, joined with latest gift
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
            dynamo_gifts(id, created_at),
            replies(count)
          `)
          .eq('status', 'active')
          .gt('expires_at', nowIso)
          .order('created_at', { ascending: false });

        if (excludedUserIds.length > 0) {
          query = query.not('user_id', 'in', `(${excludedUserIds.join(',')})`);
        }

        if (allowedAuthorIds !== null) {
          query = query.in('user_id', allowedAuthorIds);
        }

        const { data, error } = await query;
        if (!error && data) {
          // Filter to those with gifts and sort by latest gift timestamp DESC
          const withGifts = data
            .filter((item: any) => Array.isArray(item.dynamo_gifts) && item.dynamo_gifts.length > 0)
            .map((item: any) => {
              const latestGiftTime = item.dynamo_gifts.reduce((latest: number, g: any) => {
                const t = new Date(g.created_at).getTime();
                return t > latest ? t : latest;
              }, 0);

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
                energy_gifts_count: item.dynamo_gifts.length,
                replies_count: item.replies?.[0]?.count || 0,
                last_gift_at: latestGiftTime ? new Date(latestGiftTime).toISOString() : undefined,
              };
            })
            .sort((a, b) => {
              const timeA = a.last_gift_at ? new Date(a.last_gift_at).getTime() : 0;
              const timeB = b.last_gift_at ? new Date(b.last_gift_at).getTime() : 0;
              return timeB - timeA;
            });

          return withGifts.slice(offset, offset + limit);
        }
      } catch (err) {
        console.warn('Supabase Reviviendo query failed:', err);
      }
    }

    if (import.meta.env.PROD || isSupabaseConfigured) {
      return [];
    }

    // Local Storage Fallback
    const nowMs = Date.now();
    const all = getStoredDynamos();
    const filtered = all.filter((d) => {
      const isNotExpired = new Date(d.expires_at).getTime() > nowMs;
      if (d.status !== 'active' || !isNotExpired) return false;
      if (excludedUserIds.includes(d.user_id)) return false;
      if (allowedAuthorIds !== null && !allowedAuthorIds.includes(d.user_id)) return false;

      // Must have received energy gifts
      return (d.energy_gifts_count || 0) > 0;
    });

    // Order by last_gift_at DESC, fallback to created_at
    const sorted = filtered.sort((a, b) => {
      const giftA = a.last_gift_at
        ? new Date(a.last_gift_at).getTime()
        : localStorage.getItem(`dynamo_last_gift_${a.id}`)
        ? Number(localStorage.getItem(`dynamo_last_gift_${a.id}`))
        : new Date(a.created_at).getTime();

      const giftB = b.last_gift_at
        ? new Date(b.last_gift_at).getTime()
        : localStorage.getItem(`dynamo_last_gift_${b.id}`)
        ? Number(localStorage.getItem(`dynamo_last_gift_${b.id}`))
        : new Date(b.created_at).getTime();

      return giftB - giftA;
    });

    return sorted.slice(offset, offset + limit);
  },
};
