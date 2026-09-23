import { supabase, isSupabaseConfigured } from '@/src/lib/supabase';
import {
  BestDynamoItem,
  BestDynamosResponse,
  RankingPeriod,
  UserBadge,
  BadgeKey,
  BadgeDefinition,
} from './bestDynamosTypes';
import { Dynamo } from '../dynamos/dynamosTypes';
import { notificationsService } from '../notifications/notificationsService';

export const BADGE_DEFINITIONS: Record<BadgeKey, BadgeDefinition> = {
  first_gift_received: {
    key: 'first_gift_received',
    title: 'Primer ⚡ Recibido',
    description: 'Has recibido tu primer ⚡ de energía comunitaria en una publicación.',
    iconName: 'Zap',
    category: 'gifts',
    tier: 'bronze',
  },
  gifts_10_received: {
    key: 'gifts_10_received',
    title: '10 ⚡ Recibidos',
    description: 'Tus publicaciones han acumulado 10 ⚡ Dynamos legítimos.',
    iconName: 'Zap',
    category: 'gifts',
    tier: 'silver',
  },
  gifts_50_received: {
    key: 'gifts_50_received',
    title: '50 ⚡ Recibidos',
    description: 'Medio centenar de ⚡ impulsando tus ideas a través del tiempo.',
    iconName: 'Zap',
    category: 'gifts',
    tier: 'gold',
  },
  gifts_100_received: {
    key: 'gifts_100_received',
    title: '100 ⚡ Centurión',
    description: '100 ⚡ recibidos. Un hito de resonancia histórica en la red.',
    iconName: 'Award',
    category: 'gifts',
    tier: 'diamond',
  },
  best_dynamos_entry: {
    key: 'best_dynamos_entry',
    title: 'Entrada al Best Dynamos',
    description: 'Lograste posicionar un Dynamo en el salón histórico de publicaciones destacadas.',
    iconName: 'Trophy',
    category: 'ranking',
    tier: 'bronze',
  },
  top_10_historical: {
    key: 'top_10_historical',
    title: 'Top 10 Histórico',
    description: 'Alcanzaste el selecto Top 10 histórico de Dynamos con mayor energía.',
    iconName: 'Medal',
    category: 'ranking',
    tier: 'gold',
  },
  top_1_historical: {
    key: 'top_1_historical',
    title: '#1 Histórico Absoluto',
    description: 'Lograste la cúspide #1 en el ranking histórico absoluto de Dynamo.',
    iconName: 'Crown',
    category: 'ranking',
    tier: 'diamond',
  },
};

const LOCAL_STORAGE_BADGES_KEY = 'dynamo_user_badges';
const LOCAL_STORAGE_DYNAMOS_KEY = 'dynamo_feed_records';
const LOCAL_STORAGE_PROFILES_KEY = 'dynamo_profiles';

export const bestDynamosService = {
  /**
   * 🏆 Get Best Dynamos historical ranking with pagination.
   * Based strictly on valid ⚡ gifts received.
   * Tied on ⚡? Breaks tie by last_gift_at DESC, then created_at ASC.
   * Excludes content hidden by moderation or deleted.
   * Preserves expired Dynamos in the ranking.
   */
  async getBestDynamos(
    period: RankingPeriod = 'all_time',
    page: number = 1,
    pageSize: number = 20
  ): Promise<BestDynamosResponse> {
    const safePage = Math.max(1, page);
    const safePageSize = Math.max(1, Math.min(50, pageSize));
    const offset = (safePage - 1) * safePageSize;

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('get_best_dynamos_ranking', {
          p_period: period,
          p_limit: safePageSize,
          p_offset: offset,
        });

        if (error) throw error;

        const totalRecords = data && data.length > 0 ? Number(data[0].total_count) : 0;
        const items: BestDynamoItem[] = (data || []).map((row: any) => ({
          id: row.dynamo_id,
          rank: Number(row.rank),
          content: row.content,
          author_id: row.author_id,
          author_username: row.author_username,
          author_avatar: row.author_avatar,
          author_role: row.author_role,
          energy_gifts_count: Number(row.energy_gifts_count),
          created_at: row.created_at,
          expires_at: row.expires_at,
          last_gift_at: row.last_gift_at,
          historical_status: row.historical_status as 'active' | 'expired',
        }));

        return {
          items,
          total: totalRecords,
          page: safePage,
          pageSize: safePageSize,
          totalPages: Math.ceil(totalRecords / safePageSize) || 1,
          period,
        };
      } catch (err) {
        console.warn('Supabase get_best_dynamos_ranking failed:', err);
      }
    }

    if (import.meta.env.PROD || isSupabaseConfigured) {
      return {
        items: [],
        total: 0,
        page: safePage,
        pageSize: safePageSize,
        totalPages: 1,
        period,
      };
    }

    // Local development emulation
    return this.getLocalBestDynamos(period, safePage, safePageSize);
  },

  /**
   * Local sandbox calculation for Best Dynamos ranking
   */
  getLocalBestDynamos(
    period: RankingPeriod = 'all_time',
    page: number = 1,
    pageSize: number = 20
  ): BestDynamosResponse {
    const rawDynamos = localStorage.getItem(LOCAL_STORAGE_DYNAMOS_KEY);
    const dynamos: Dynamo[] = rawDynamos ? JSON.parse(rawDynamos) : [];

    const rawProfiles = localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY);
    const profiles: any[] = rawProfiles ? JSON.parse(rawProfiles) : [];

    const now = Date.now();

    // 1. Filter out hidden or deleted content
    const eligibleDynamos = dynamos.filter((d) => {
      // Must not be hidden by moderation or deleted
      if (d.status === 'hidden' || d.status === 'deleted') return false;

      // Author must not be banned
      const author = profiles.find((p) => p.id === d.user_id) || d.author;
      if (author && author.status === 'banned') return false;

      // Must have at least 1 valid gift to qualify for historical Best Dynamos ranking
      const giftsCount = d.energy_gifts_count || 0;
      return giftsCount > 0;
    });

    // 2. Sort primarily by energy_gifts_count DESC
    // Tie-breaker 1: last_gift_at DESC
    // Tie-breaker 2: created_at ASC
    eligibleDynamos.sort((a, b) => {
      const giftsA = a.energy_gifts_count || 0;
      const giftsB = b.energy_gifts_count || 0;
      if (giftsB !== giftsA) {
        return giftsB - giftsA;
      }

      const lastGiftA = a.last_gift_at ? new Date(a.last_gift_at).getTime() : 0;
      const lastGiftB = b.last_gift_at ? new Date(b.last_gift_at).getTime() : 0;
      if (lastGiftB !== lastGiftA) {
        return lastGiftB - lastGiftA;
      }

      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    const total = eligibleDynamos.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const startIndex = (page - 1) * pageSize;
    const sliced = eligibleDynamos.slice(startIndex, startIndex + pageSize);

    const items: BestDynamoItem[] = sliced.map((d, index) => {
      const rank = startIndex + index + 1;
      const author = profiles.find((p) => p.id === d.user_id) || d.author;
      const isExpired = new Date(d.expires_at).getTime() <= now || d.status === 'expired';

      return {
        id: d.id,
        rank,
        content: d.content,
        author_id: d.user_id,
        author_username: author?.username || 'desconocido',
        author_avatar: author?.avatar,
        author_role: author?.role || 'user',
        energy_gifts_count: d.energy_gifts_count || 0,
        created_at: d.created_at,
        expires_at: d.expires_at,
        last_gift_at: d.last_gift_at,
        historical_status: isExpired ? 'expired' : 'active',
      };
    });

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
      period,
    };
  },

  /**
   * 🏅 Get user badges (with metadata and full definition).
   */
  async getUserBadges(userId: string): Promise<UserBadge[]> {
    if (!userId) return [];

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('user_badges')
          .select('id, user_id, badge_key, awarded_at, metadata')
          .eq('user_id', userId)
          .order('awarded_at', { ascending: false });

        if (!error && data) {
          return data.map((b: any) => ({
            id: b.id,
            user_id: b.user_id,
            badge_key: b.badge_key as BadgeKey,
            awarded_at: b.awarded_at,
            metadata: b.metadata,
            badge: BADGE_DEFINITIONS[b.badge_key as BadgeKey],
          }));
        }
      } catch (err) {
        console.warn('Supabase getUserBadges error:', err);
      }
    }

    if (import.meta.env.PROD || isSupabaseConfigured) {
      return [];
    }

    // Local storage fallback
    const allBadges: UserBadge[] = JSON.parse(
      localStorage.getItem(LOCAL_STORAGE_BADGES_KEY) || '[]'
    );
    const userBadges = allBadges.filter((b) => b.user_id === userId);

    return userBadges
      .map((b) => ({
        ...b,
        badge: BADGE_DEFINITIONS[b.badge_key],
      }))
      .sort((a, b) => new Date(b.awarded_at).getTime() - new Date(a.awarded_at).getTime());
  },

  /**
   * ⚙️ Evaluate and award badges automatically for a given user.
   * Triggered whenever legitimate energy is gifted or rankings update.
   * Idempotent: will never duplicate existing badges.
   */
  async evaluateAndAwardBadges(userId: string): Promise<UserBadge[]> {
    if (!userId) return [];

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('evaluate_and_award_badges', {
          p_user_id: userId,
        });
        if (!error && data) {
          return (data as any[]).map((b) => ({
            id: b.id,
            user_id: b.user_id,
            badge_key: b.badge_key as BadgeKey,
            awarded_at: b.awarded_at,
            metadata: b.metadata,
            badge: BADGE_DEFINITIONS[b.badge_key as BadgeKey],
          }));
        }
      } catch (err) {
        console.warn('Supabase evaluate_and_award_badges error:', err);
      }
    }

    if (import.meta.env.PROD || isSupabaseConfigured) {
      return [];
    }

    // Local evaluation
    return this.localEvaluateAndAwardBadges(userId);
  },

  /**
   * Local verification logic for all 7 badges:
   * - first_gift_received
   * - gifts_10_received
   * - gifts_50_received
   * - gifts_100_received
   * - best_dynamos_entry
   * - top_10_historical
   * - top_1_historical
   */
  localEvaluateAndAwardBadges(userId: string): UserBadge[] {
    const rawDynamos = localStorage.getItem(LOCAL_STORAGE_DYNAMOS_KEY);
    const dynamos: Dynamo[] = rawDynamos ? JSON.parse(rawDynamos) : [];

    const rawBadges = localStorage.getItem(LOCAL_STORAGE_BADGES_KEY);
    const allBadges: UserBadge[] = rawBadges ? JSON.parse(rawBadges) : [];

    const existingKeys = new Set(
      allBadges.filter((b) => b.user_id === userId).map((b) => b.badge_key)
    );

    // 1. Calculate total gifts received on user's own non-hidden, non-deleted dynamos
    const userDynamos = dynamos.filter(
      (d) => d.user_id === userId && d.status !== 'hidden' && d.status !== 'deleted'
    );
    const totalGiftsReceived = userDynamos.reduce(
      (acc, d) => acc + (d.energy_gifts_count || 0),
      0
    );

    const newBadgesToAward: { key: BadgeKey; metadata?: any }[] = [];

    // Milestone Badges: 1, 10, 50, 100
    if (totalGiftsReceived >= 1 && !existingKeys.has('first_gift_received')) {
      newBadgesToAward.push({
        key: 'first_gift_received',
        metadata: { gifts_count: totalGiftsReceived },
      });
    }

    if (totalGiftsReceived >= 10 && !existingKeys.has('gifts_10_received')) {
      newBadgesToAward.push({
        key: 'gifts_10_received',
        metadata: { gifts_count: totalGiftsReceived },
      });
    }

    if (totalGiftsReceived >= 50 && !existingKeys.has('gifts_50_received')) {
      newBadgesToAward.push({
        key: 'gifts_50_received',
        metadata: { gifts_count: totalGiftsReceived },
      });
    }

    if (totalGiftsReceived >= 100 && !existingKeys.has('gifts_100_received')) {
      newBadgesToAward.push({
        key: 'gifts_100_received',
        metadata: { gifts_count: totalGiftsReceived },
      });
    }

    // Ranking Badges: best_dynamos_entry, top_10_historical, top_1_historical
    // Evaluate historical rank of user's best dynamo
    const ranking = this.getLocalBestDynamos('all_time', 1, 1000);
    const userRankedItems = ranking.items.filter((item) => item.author_id === userId);

    if (userRankedItems.length > 0) {
      const bestRank = Math.min(...userRankedItems.map((i) => i.rank));

      if (!existingKeys.has('best_dynamos_entry')) {
        newBadgesToAward.push({
          key: 'best_dynamos_entry',
          metadata: { highest_rank: bestRank },
        });
      }

      if (bestRank <= 10 && !existingKeys.has('top_10_historical')) {
        newBadgesToAward.push({
          key: 'top_10_historical',
          metadata: { highest_rank: bestRank },
        });
      }

      if (bestRank === 1 && !existingKeys.has('top_1_historical')) {
        newBadgesToAward.push({
          key: 'top_1_historical',
          metadata: { highest_rank: 1 },
        });
      }
    }

    // Persist newly awarded badges
    const nowIso = new Date().toISOString();
    for (const toAward of newBadgesToAward) {
      const newBadge: UserBadge = {
        id: 'bdg_' + Math.random().toString(36).substring(2, 10),
        user_id: userId,
        badge_key: toAward.key,
        awarded_at: nowIso,
        metadata: toAward.metadata,
      };
      allBadges.push(newBadge);

      // Create system notification for the user
      const def = BADGE_DEFINITIONS[toAward.key];
      notificationsService.createNotification({
        recipientId: userId,
        type: 'system',
        customTitle: `🏅 ¡Nueva insignia desbloqueada: ${def.title}!`,
        customDescription: def.description,
        metadata: { badge_key: toAward.key },
      });
    }

    if (newBadgesToAward.length > 0) {
      localStorage.setItem(LOCAL_STORAGE_BADGES_KEY, JSON.stringify(allBadges));
    }

    return allBadges
      .filter((b) => b.user_id === userId)
      .map((b) => ({
        ...b,
        badge: BADGE_DEFINITIONS[b.badge_key],
      }))
      .sort((a, b) => new Date(b.awarded_at).getTime() - new Date(a.awarded_at).getTime());
  },

  /**
   * Evaluates all authors in the current top 10 to ensure ranking badges (e.g. top_1_historical)
   * update dynamically whenever energy shifts rankings.
   */
  async reevaluateTopRankingBadges(): Promise<void> {
    const ranking = this.getLocalBestDynamos('all_time', 1, 10);
    const uniqueAuthorIds = Array.from(new Set(ranking.items.map((i) => i.author_id)));
    for (const authorId of uniqueAuthorIds) {
      await this.evaluateAndAwardBadges(authorId);
    }
  },
};
