import { Profile } from '../profiles/profilesTypes';

export type RankingPeriod = 'all_time' | 'weekly' | 'monthly' | 'yearly';

export type BadgeKey =
  | 'first_gift_received'
  | 'gifts_10_received'
  | 'gifts_50_received'
  | 'gifts_100_received'
  | 'best_dynamos_entry'
  | 'top_10_historical'
  | 'top_1_historical';

export type BadgeCategory = 'gifts' | 'ranking';

export interface BadgeDefinition {
  key: BadgeKey;
  title: string;
  description: string;
  iconName: 'Zap' | 'Trophy' | 'Medal' | 'Award' | 'Crown';
  category: BadgeCategory;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond';
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_key: BadgeKey;
  awarded_at: string;
  metadata?: {
    gifts_count?: number;
    highest_rank?: number;
    dynamo_id?: string;
    [key: string]: any;
  };
  badge?: BadgeDefinition;
}

export interface BestDynamoItem {
  id: string;
  rank: number;
  content: string;
  image_url?: string | null;
  author_id: string;
  author_username: string;
  author_avatar?: string;
  author_role?: 'admin' | 'moderator' | 'user';
  energy_gifts_count: number;
  created_at: string;
  expires_at: string;
  last_gift_at?: string;
  historical_status: 'active' | 'expired';
}

export interface BestDynamosResponse {
  items: BestDynamoItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  period: RankingPeriod;
}
