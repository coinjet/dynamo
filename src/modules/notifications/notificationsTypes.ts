import { Profile } from '../profiles/profilesTypes';

export type NotificationType = 'gift' | 'reply' | 'follow' | 'expiring' | 'system';

export interface NotificationMetadata {
  dynamo_id?: string;
  reply_id?: string;
  follower_id?: string;
  expires_at?: string;
  [key: string]: any;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  reference_id?: string;
  sender_id?: string;
  sender?: Profile;
  read: boolean;
  created_at: string;
  metadata?: NotificationMetadata;
  title?: string;
  description?: string;
}
