import { supabase, isSupabaseConfigured } from '@/src/lib/supabase';
import { UserRelationshipState, FeedFilterType } from './relationshipsTypes';
import { notificationsService } from '../notifications/notificationsService';
import { settingsService } from '../settings/settingsService';

const LOCAL_STORAGE_FOLLOWS_KEY = 'dynamo_follows';
const LOCAL_STORAGE_BLOCKS_KEY = 'dynamo_blocks';
const LOCAL_STORAGE_MUTES_KEY = 'dynamo_mutes';

/**
 * Dynamo Relationships Service (V0.1)
 *
 * Rules:
 * 1. Seguir / Dejar de seguir:
 *    - Follows are strictly 1:1 records (follower_id, following_id).
 *    - Never allow following oneself (follower_id <> following_id).
 *    - No duplicates allowed.
 *    - Cannot follow if there is an active block between the two users.
 * 2. Amigos (Mutual Friendship):
 *    - User A and User B are friends IF AND ONLY IF:
 *      A follows B AND B follows A.
 *    - Derived from follows table without creating redundant tables.
 * 3. Bloquear / Desbloquear:
 *    - Mutual invisibility: A blocks B => B not in A's feed, A not in B's feed.
 *    - Blocks forbid future follow interactions between both parties.
 *    - Block persists even if follows are later removed.
 * 4. Silenciar / Dejar de silenciar:
 *    - Muting B removes B's Dynamos from A's feed.
 *    - B is NEVER notified about being muted.
 *    - A can still view B's profile.
 * 5. Security & RLS:
 *    - Authenticated users can only insert/delete their own relationships.
 */
export const relationshipsService = {
  /**
   * Follow a user.
   * Enforces:
   * - Cannot follow self
   * - Cannot follow if either party has blocked the other
   * - No duplicates
   */
  async follow(followerId: string, followingId: string): Promise<boolean> {
    if (!followerId || !followingId) {
      throw new Error('Identificadores de usuario requeridos.');
    }
    if (followerId === followingId) {
      throw new Error('No puedes seguirte a ti mismo.');
    }

    // Check if blocked in either direction
    const isBlocked = await this.isBlockedBidirectional(followerId, followingId);
    if (isBlocked) {
      throw new Error('No es posible seguir a un usuario bloqueado.');
    }

    // Privacy setting: verify if target user allows followers (Módulo 8)
    const allowsFollowers = await settingsService.canFollowUser(followingId);
    if (!allowsFollowers) {
      throw new Error('Este usuario tiene configurado no recibir nuevos seguidores.');
    }

    if (isSupabaseConfigured) {
      const { error } = await supabase.from('follows').insert({
        follower_id: followerId,
        following_id: followingId,
      });

      if (error) {
        if (error.code === '23505') {
          // Unique violation / duplicate follow
          return true;
        }
        if (error.code === '42501' || error.message?.includes('row-level security')) {
          throw new Error('No es posible seguir a este usuario debido a bloqueos o restricciones de privacidad.');
        }
        throw new Error(error.message);
      }
      return true;
    }

    // Local Storage Fallback
    const follows: string[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_FOLLOWS_KEY) || '[]');
    const key = `${followerId}:${followingId}`;
    if (!follows.includes(key)) {
      follows.push(key);
      localStorage.setItem(LOCAL_STORAGE_FOLLOWS_KEY, JSON.stringify(follows));

      // Emit follow notification to followingId
      const followerProfileRaw = localStorage.getItem('dynamo_profile_' + followerId);
      const followerProfile = followerProfileRaw ? JSON.parse(followerProfileRaw) : undefined;
      notificationsService.createNotification({
        recipientId: followingId,
        type: 'follow',
        sender: followerProfile,
        referenceId: followerId,
        metadata: { follower_id: followerId },
      }).catch(console.error);
    }
    return true;
  },

  /**
   * Unfollow a user.
   */
  async unfollow(followerId: string, followingId: string): Promise<boolean> {
    if (!followerId || !followingId) return false;

    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', followerId)
        .eq('following_id', followingId);
      return !error;
    }

    let follows: string[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_FOLLOWS_KEY) || '[]');
    const key = `${followerId}:${followingId}`;
    follows = follows.filter((f) => f !== key);
    localStorage.setItem(LOCAL_STORAGE_FOLLOWS_KEY, JSON.stringify(follows));

    // Cleanup unread follow notification if any
    notificationsService.removeFollowNotification(followerId, followingId).catch(console.error);

    return true;
  },

  /**
   * Check if user A follows user B.
   */
  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    if (!followerId || !followingId) return false;

    if (isSupabaseConfigured) {
      const { data } = await supabase
        .from('follows')
        .select('created_at')
        .eq('follower_id', followerId)
        .eq('following_id', followingId)
        .maybeSingle();
      return Boolean(data);
    }

    const follows: string[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_FOLLOWS_KEY) || '[]');
    return follows.includes(`${followerId}:${followingId}`);
  },

  /**
   * Determine mutual friendship safely:
   * A follows B + B follows A
   * Computed directly from the follows table.
   */
  async areFriends(userAId: string, userBId: string): Promise<boolean> {
    if (!userAId || !userBId || userAId === userBId) return false;

    if (isSupabaseConfigured) {
      // Query both directional follows in parallel
      const [{ data: followAB }, { data: followBA }] = await Promise.all([
        supabase
          .from('follows')
          .select('created_at')
          .eq('follower_id', userAId)
          .eq('following_id', userBId)
          .maybeSingle(),
        supabase
          .from('follows')
          .select('created_at')
          .eq('follower_id', userBId)
          .eq('following_id', userAId)
          .maybeSingle(),
      ]);

      return Boolean(followAB && followBA);
    }

    const follows: string[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_FOLLOWS_KEY) || '[]');
    const hasAB = follows.includes(`${userAId}:${userBId}`);
    const hasBA = follows.includes(`${userBId}:${userAId}`);
    return hasAB && hasBA;
  },

  /**
   * Block a user.
   * When A blocks B:
   * - Record inserted in blocks table
   * - B is prevented from appearing in A's feed and vice versa
   * - Future follows are blocked
   * - Existing follows in either direction are removed to maintain consistency
   */
  async blockUser(blockerId: string, blockedId: string): Promise<boolean> {
    if (!blockerId || !blockedId) throw new Error('Identificadores requeridos');
    if (blockerId === blockedId) throw new Error('No puedes bloquearte a ti mismo');

    if (isSupabaseConfigured) {
      // Insert block record
      const { error } = await supabase.from('blocks').insert({
        blocker_id: blockerId,
        blocked_id: blockedId,
      });

      if (error && error.code !== '23505') {
        throw new Error(error.message);
      }

      // Automatically clean up follows between both parties upon block
      await Promise.all([
        supabase
          .from('follows')
          .delete()
          .eq('follower_id', blockerId)
          .eq('following_id', blockedId),
        supabase
          .from('follows')
          .delete()
          .eq('follower_id', blockedId)
          .eq('following_id', blockerId),
      ]);

      return true;
    }

    // Local Storage Fallback
    const blocks: string[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_BLOCKS_KEY) || '[]');
    const blockKey = `${blockerId}:${blockedId}`;
    if (!blocks.includes(blockKey)) {
      blocks.push(blockKey);
      localStorage.setItem(LOCAL_STORAGE_BLOCKS_KEY, JSON.stringify(blocks));
    }

    // Remove local follows
    let follows: string[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_FOLLOWS_KEY) || '[]');
    follows = follows.filter(
      (f) => f !== `${blockerId}:${blockedId}` && f !== `${blockedId}:${blockerId}`
    );
    localStorage.setItem(LOCAL_STORAGE_FOLLOWS_KEY, JSON.stringify(follows));

    return true;
  },

  /**
   * Unblock a user.
   */
  async unblockUser(blockerId: string, blockedId: string): Promise<boolean> {
    if (!blockerId || !blockedId) return false;

    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('blocks')
        .delete()
        .eq('blocker_id', blockerId)
        .eq('blocked_id', blockedId);
      return !error;
    }

    let blocks: string[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_BLOCKS_KEY) || '[]');
    const blockKey = `${blockerId}:${blockedId}`;
    blocks = blocks.filter((b) => b !== blockKey);
    localStorage.setItem(LOCAL_STORAGE_BLOCKS_KEY, JSON.stringify(blocks));
    return true;
  },

  /**
   * Check if A has blocked B.
   */
  async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    if (!blockerId || !blockedId) return false;

    if (isSupabaseConfigured) {
      const { data } = await supabase
        .from('blocks')
        .select('created_at')
        .eq('blocker_id', blockerId)
        .eq('blocked_id', blockedId)
        .maybeSingle();
      return Boolean(data);
    }

    const blocks: string[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_BLOCKS_KEY) || '[]');
    return blocks.includes(`${blockerId}:${blockedId}`);
  },

  /**
   * Check if there is a block in either direction between user A and user B.
   */
  async isBlockedBidirectional(userAId: string, userBId: string): Promise<boolean> {
    if (!userAId || !userBId) return false;

    if (isSupabaseConfigured) {
      const { data } = await supabase
        .from('blocks')
        .select('blocker_id, blocked_id')
        .or(
          `and(blocker_id.eq.${userAId},blocked_id.eq.${userBId}),and(blocker_id.eq.${userBId},blocked_id.eq.${userAId})`
        )
        .maybeSingle();
      return Boolean(data);
    }

    const blocks: string[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_BLOCKS_KEY) || '[]');
    return (
      blocks.includes(`${userAId}:${userBId}`) ||
      blocks.includes(`${userBId}:${userAId}`)
    );
  },

  /**
   * Mute a user.
   * When A mutes B:
   * - B's Dynamos will not show in A's feed
   * - B receives NO notification
   * - A can still view B's profile
   */
  async muteUser(muterId: string, mutedId: string): Promise<boolean> {
    if (!muterId || !mutedId) throw new Error('Identificadores requeridos');
    if (muterId === mutedId) throw new Error('No puedes silenciarte a ti mismo');

    if (isSupabaseConfigured) {
      const { error } = await supabase.from('mutes').insert({
        muter_id: muterId,
        muted_id: mutedId,
      });
      if (error && error.code !== '23505') {
        throw new Error(error.message);
      }
      return true;
    }

    const mutes: string[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_MUTES_KEY) || '[]');
    const key = `${muterId}:${mutedId}`;
    if (!mutes.includes(key)) {
      mutes.push(key);
      localStorage.setItem(LOCAL_STORAGE_MUTES_KEY, JSON.stringify(mutes));
    }
    return true;
  },

  /**
   * Unmute a user.
   */
  async unmuteUser(muterId: string, mutedId: string): Promise<boolean> {
    if (!muterId || !mutedId) return false;

    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('mutes')
        .delete()
        .eq('muter_id', muterId)
        .eq('muted_id', mutedId);
      return !error;
    }

    let mutes: string[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_MUTES_KEY) || '[]');
    const key = `${muterId}:${mutedId}`;
    mutes = mutes.filter((m) => m !== key);
    localStorage.setItem(LOCAL_STORAGE_MUTES_KEY, JSON.stringify(mutes));
    return true;
  },

  /**
   * Check if A has muted B.
   */
  async isMuted(muterId: string, mutedId: string): Promise<boolean> {
    if (!muterId || !mutedId) return false;

    if (isSupabaseConfigured) {
      const { data } = await supabase
        .from('mutes')
        .select('created_at')
        .eq('muter_id', muterId)
        .eq('muted_id', mutedId)
        .maybeSingle();
      return Boolean(data);
    }

    const mutes: string[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_MUTES_KEY) || '[]');
    return mutes.includes(`${muterId}:${mutedId}`);
  },

  /**
   * Get the complete relationship state between current user and target user:
   * - isFollowing
   * - isFollower
   * - isFriend (mutual)
   * - isBlocked (by current user)
   * - isBlockedBy (target blocked current)
   * - isMuted (by current user)
   */
  async getRelationshipState(currentUserId: string, targetUserId: string): Promise<UserRelationshipState> {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
      return {
        isFollowing: false,
        isFollower: false,
        isFriend: false,
        isBlocked: false,
        isBlockedBy: false,
        isMuted: false,
      };
    }

    if (isSupabaseConfigured) {
      const [
        { data: followMeToTarget },
        { data: followTargetToMe },
        { data: blockMeToTarget },
        { data: blockTargetToMe },
        { data: muteMeToTarget },
      ] = await Promise.all([
        supabase
          .from('follows')
          .select('created_at')
          .eq('follower_id', currentUserId)
          .eq('following_id', targetUserId)
          .maybeSingle(),
        supabase
          .from('follows')
          .select('created_at')
          .eq('follower_id', targetUserId)
          .eq('following_id', currentUserId)
          .maybeSingle(),
        supabase
          .from('blocks')
          .select('created_at')
          .eq('blocker_id', currentUserId)
          .eq('blocked_id', targetUserId)
          .maybeSingle(),
        supabase
          .from('blocks')
          .select('created_at')
          .eq('blocker_id', targetUserId)
          .eq('blocked_id', currentUserId)
          .maybeSingle(),
        supabase
          .from('mutes')
          .select('created_at')
          .eq('muter_id', currentUserId)
          .eq('muted_id', targetUserId)
          .maybeSingle(),
      ]);

      const isFollowing = Boolean(followMeToTarget);
      const isFollower = Boolean(followTargetToMe);

      return {
        isFollowing,
        isFollower,
        isFriend: isFollowing && isFollower,
        isBlocked: Boolean(blockMeToTarget),
        isBlockedBy: Boolean(blockTargetToMe),
        isMuted: Boolean(muteMeToTarget),
      };
    }

    // Local Storage implementation
    const follows: string[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_FOLLOWS_KEY) || '[]');
    const blocks: string[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_BLOCKS_KEY) || '[]');
    const mutes: string[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_MUTES_KEY) || '[]');

    const isFollowing = follows.includes(`${currentUserId}:${targetUserId}`);
    const isFollower = follows.includes(`${targetUserId}:${currentUserId}`);
    const isBlocked = blocks.includes(`${currentUserId}:${targetUserId}`);
    const isBlockedBy = blocks.includes(`${targetUserId}:${currentUserId}`);
    const isMuted = mutes.includes(`${currentUserId}:${targetUserId}`);

    return {
      isFollowing,
      isFollower,
      isFriend: isFollowing && isFollower,
      isBlocked,
      isBlockedBy,
      isMuted,
    };
  },

  /**
   * Get IDs of all users that currentUserId is following.
   */
  async getFollowingIds(currentUserId: string): Promise<string[]> {
    if (!currentUserId) return [];

    if (isSupabaseConfigured) {
      const { data } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUserId);

      return (data || []).map((row: any) => row.following_id);
    }

    const follows: string[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_FOLLOWS_KEY) || '[]');
    const prefix = `${currentUserId}:`;
    return follows
      .filter((f) => f.startsWith(prefix))
      .map((f) => f.replace(prefix, ''));
  },

  /**
   * Get IDs of all friends (mutual follows) for currentUserId:
   * A follows B AND B follows A.
   */
  async getFriendsIds(currentUserId: string): Promise<string[]> {
    if (!currentUserId) return [];

    if (isSupabaseConfigured) {
      // Find following IDs
      const { data: followingRows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUserId);

      const followingIds = (followingRows || []).map((r: any) => r.following_id);
      if (followingIds.length === 0) return [];

      // Find which of those also follow currentUserId
      const { data: mutualRows } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', currentUserId)
        .in('follower_id', followingIds);

      return (mutualRows || []).map((r: any) => r.follower_id);
    }

    const follows: string[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_FOLLOWS_KEY) || '[]');
    const followingPrefix = `${currentUserId}:`;
    const following = follows
      .filter((f) => f.startsWith(followingPrefix))
      .map((f) => f.replace(followingPrefix, ''));

    const friends: string[] = [];
    for (const targetId of following) {
      if (follows.includes(`${targetId}:${currentUserId}`)) {
        friends.push(targetId);
      }
    }
    return friends;
  },

  /**
   * Get list of excluded user IDs for feed (blocked in either direction + muted by user).
   */
  async getExcludedUserIdsForFeed(currentUserId?: string): Promise<string[]> {
    if (!currentUserId) return [];

    if (isSupabaseConfigured) {
      const [blocksRes, mutesRes] = await Promise.all([
        supabase
          .from('blocks')
          .select('blocker_id, blocked_id')
          .or(`blocker_id.eq.${currentUserId},blocked_id.eq.${currentUserId}`),
        supabase
          .from('mutes')
          .select('muted_id')
          .eq('muter_id', currentUserId),
      ]);

      const ids = new Set<string>();
      blocksRes.data?.forEach((b: any) => {
        if (b.blocker_id === currentUserId) ids.add(b.blocked_id);
        if (b.blocked_id === currentUserId) ids.add(b.blocker_id);
      });
      mutesRes.data?.forEach((m: any) => {
        ids.add(m.muted_id);
      });
      return Array.from(ids);
    }

    const blocks: string[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_BLOCKS_KEY) || '[]');
    const mutes: string[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_MUTES_KEY) || '[]');

    const ids = new Set<string>();
    blocks.forEach((entry) => {
      const [blocker, blocked] = entry.split(':');
      if (blocker === currentUserId) ids.add(blocked);
      if (blocked === currentUserId) ids.add(blocker);
    });
    mutes.forEach((entry) => {
      const [muter, muted] = entry.split(':');
      if (muter === currentUserId) ids.add(muted);
    });
    return Array.from(ids);
  },
};
