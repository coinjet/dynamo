import { supabase, isSupabaseConfigured } from '@/src/lib/supabase';
import { Notification, NotificationType } from './notificationsTypes';
import { relationshipsService } from '../relationships/relationshipsService';
import { settingsService } from '../settings/settingsService';
import { Profile } from '../profiles/profilesTypes';

const LOCAL_STORAGE_NOTIFS_KEY = 'dynamo_notifications';
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function getStoredNotifications(): Notification[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_NOTIFS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredNotifications(notifs: Notification[]): void {
  localStorage.setItem(LOCAL_STORAGE_NOTIFS_KEY, JSON.stringify(notifs));
}

export const notificationsService = {
  /**
   * Get chronological notifications for authenticated user, most recent first.
   * Filters out any notifications originating from blocked users.
   */
  async getNotifications(userId: string): Promise<Notification[]> {
    if (!userId) return [];

    // Trigger check for dynamos about to expire (< 2 hours remaining)
    await this.checkAndGenerateExpiringNotifications(userId);

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select(`
            *,
            sender:sender_id (
              id,
              username,
              avatar,
              bio,
              status,
              created_at
            )
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Check blocked users to ensure bidirectional privacy
        const excludedUserIds = await relationshipsService.getExcludedUserIdsForFeed(userId);

        const list = (data || [])
          .filter((n: any) => !n.sender_id || !excludedUserIds.includes(n.sender_id))
          .map((n: any) => {
            let title = n.title;
            let description = n.description;
            const senderUsername = n.sender?.username ? `@${n.sender.username}` : 'Alguien';

            if (!title) {
              switch (n.type) {
                case 'gift':
                  title = '¡Energía Recibida! ⚡';
                  description = `${senderUsername} inyectó +6 horas de vida a tu Dynamo.`;
                  break;
                case 'reply':
                  title = 'Nueva respuesta 💬';
                  description = `${senderUsername} respondió a tu Dynamo.`;
                  break;
                case 'follow':
                  title = 'Nuevo seguidor 👤';
                  description = `${senderUsername} ha comenzado a seguirte.`;
                  break;
                case 'expiring':
                  title = 'Dynamo por expirar ⏳';
                  description = 'A uno de tus Dynamos le quedan menos de 2 horas de vida.';
                  break;
                default:
                  title = 'Notificación';
                  description = 'Nueva actividad en Dynamo.';
              }
            }

            return {
              id: n.id,
              user_id: n.user_id,
              type: n.type as NotificationType,
              reference_id: n.reference_id,
              sender_id: n.sender_id,
              sender: n.sender,
              read: Boolean(n.read),
              created_at: n.created_at,
              metadata: n.metadata || {},
              title,
              description,
            };
          });

        return list;
      } catch (err) {
        console.warn('Supabase notifications query failed, using local fallback:', err);
      }
    }

    // Local Storage fallback with privacy rules
    const blockedList = await relationshipsService.getExcludedUserIdsForFeed(userId);
    const all = getStoredNotifications();
    const userNotifs = all
      .filter((n) => n.user_id === userId && (!n.sender_id || !blockedList.includes(n.sender_id)))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return userNotifs;
  },

  /**
   * Get unread count for fast badge indicator
   */
  async getUnreadCount(userId: string): Promise<number> {
    if (!userId) return 0;
    const notifs = await this.getNotifications(userId);
    return notifs.filter((n) => !n.read).length;
  },

  /**
   * Mark individual notification as read.
   */
  async markAsRead(notificationId: string, userId?: string): Promise<boolean> {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notificationId);
        return !error;
      } catch {
        // Continue to local fallback
      }
    }

    const all = getStoredNotifications();
    const idx = all.findIndex((n) => n.id === notificationId);
    if (idx !== -1) {
      all[idx].read = true;
      saveStoredNotifications(all);
    }
    return true;
  },

  /**
   * Mark all notifications as read for current user.
   */
  async markAllAsRead(userId: string): Promise<boolean> {
    if (!userId) return false;

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', userId)
          .eq('read', false);
        return !error;
      } catch {
        // Continue to local fallback
      }
    }

    const all = getStoredNotifications();
    all.forEach((n) => {
      if (n.user_id === userId) {
        n.read = true;
      }
    });
    saveStoredNotifications(all);
    return true;
  },

  /**
   * Generates a notification safely when an event occurs.
   * Enforces:
   * - Privacy: No notifications between blocked users.
   * - No self-notifications (e.g. self-reply, self-gift).
   * - Duplicate prevention for identical event (same type + reference_id + sender_id unread).
   */
  async createNotification(payload: {
    recipientId: string;
    type: NotificationType;
    sender?: Profile;
    referenceId?: string;
    metadata?: Record<string, any>;
    customTitle?: string;
    customDescription?: string;
  }): Promise<Notification | null> {
    const { recipientId, type, sender, referenceId, metadata, customTitle, customDescription } = payload;

    // Self notifications prohibited
    if (sender && sender.id === recipientId) {
      return null;
    }

    // Privacy rule: If either blocked the other, DO NOT create notification
    if (sender) {
      const isBlocked = await relationshipsService.isBlockedBidirectional(sender.id, recipientId);
      if (isBlocked) {
        return null;
      }
    }

    // User settings preference check (Módulo 8)
    const isAllowed = await settingsService.isNotificationAllowed(recipientId, type, metadata);
    if (!isAllowed) {
      return null;
    }

    const senderUsername = sender?.username ? `@${sender.username}` : 'Alguien';
    let title = customTitle;
    let description = customDescription;

    if (!title) {
      switch (type) {
        case 'gift':
          title = '¡Energía Recibida! ⚡';
          description = `${senderUsername} inyectó +6 horas de vida a tu Dynamo.`;
          break;
        case 'reply':
          title = 'Nueva respuesta 💬';
          description = `${senderUsername} respondió a tu Dynamo.`;
          break;
        case 'follow':
          title = 'Nuevo seguidor 👤';
          description = `${senderUsername} ha comenzado a seguirte.`;
          break;
        case 'expiring':
          title = 'Dynamo por expirar ⏳';
          description = 'A uno de tus Dynamos le quedan menos de 2 horas de vida.';
          break;
        default:
          title = 'Notificación';
          description = 'Nueva actividad en Dynamo.';
      }
    }

    const newNotification: Notification = {
      id: 'notif_' + Math.random().toString(36).substring(2, 9),
      user_id: recipientId,
      type,
      reference_id: referenceId,
      sender_id: sender?.id,
      sender,
      read: false,
      created_at: new Date().toISOString(),
      metadata: metadata || {},
      title,
      description,
    };

    // Duplicate check in local storage: Don't flood with multiple unread of the same action
    const all = getStoredNotifications();
    const isDuplicate = all.some(
      (n) =>
        n.user_id === recipientId &&
        n.type === type &&
        n.reference_id === referenceId &&
        n.sender_id === sender?.id &&
        !n.read
    );

    if (!isDuplicate) {
      all.unshift(newNotification);
      saveStoredNotifications(all);
    }

    return newNotification;
  },

  /**
   * Remove follow notification if user unfollows before it was read.
   */
  async removeFollowNotification(followerId: string, followingId: string): Promise<void> {
    const all = getStoredNotifications();
    const filtered = all.filter(
      (n) => !(n.user_id === followingId && n.sender_id === followerId && n.type === 'follow' && !n.read)
    );
    saveStoredNotifications(filtered);
  },

  /**
   * Rule 6: Proximo a expirar (< 2 horas de vida restante)
   * - Solo para dynamos propios.
   * - Genera aviso cuando queden menos de 2 horas y más de 0 horas.
   * - No generar repetidamente el mismo aviso para el mismo Dynamo.
   * - Si el Dynamo ya expiró, no generar aviso.
   */
  async checkAndGenerateExpiringNotifications(userId: string): Promise<number> {
    if (!userId) return 0;

    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase.rpc('check_expiring_dynamos_for_user');
        if (typeof data === 'number') return data;
      } catch {
        // Fallback to local evaluation
      }
    }

    // Local evaluation
    try {
      const rawDynamos = localStorage.getItem('dynamo_feed_records');
      if (!rawDynamos) return 0;
      const dynamos: any[] = JSON.parse(rawDynamos);

      const now = Date.now();
      const ownActiveDynamos = dynamos.filter((d) => {
        if (d.user_id !== userId || d.status !== 'active') return false;
        const expTime = new Date(d.expires_at).getTime();
        const timeLeft = expTime - now;
        // Less than 2 hours and not yet expired
        return timeLeft > 0 && timeLeft <= TWO_HOURS_MS;
      });

      const allNotifs = getStoredNotifications();
      let createdCount = 0;

      for (const d of ownActiveDynamos) {
        // Check if already notified for this dynamo
        const alreadyNotified = allNotifs.some(
          (n) => n.user_id === userId && n.type === 'expiring' && n.reference_id === d.id
        );

        if (!alreadyNotified) {
          const hoursLeft = Math.max(1, Math.ceil((new Date(d.expires_at).getTime() - now) / (60 * 60 * 1000)));
          const notif: Notification = {
            id: 'notif_exp_' + d.id,
            user_id: userId,
            type: 'expiring',
            reference_id: d.id,
            read: false,
            created_at: new Date().toISOString(),
            metadata: { dynamo_id: d.id, expires_at: d.expires_at },
            title: 'Dynamo por expirar ⏳',
            description: `A tu publicación "${d.content.slice(0, 30)}..." le quedan menos de ${hoursLeft} hora(s) de vida.`,
          };
          allNotifs.unshift(notif);
          createdCount++;
        }
      }

      if (createdCount > 0) {
        saveStoredNotifications(allNotifs);
      }
      return createdCount;
    } catch {
      return 0;
    }
  },
};
