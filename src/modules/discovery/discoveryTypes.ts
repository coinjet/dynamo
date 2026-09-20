import { FeedFilterType } from '../relationships/relationshipsTypes';

export type DiscoverySection = 'tendencias' | 'casi_desaparecen' | 'reviviendo';

export interface TrendingTopic {
  name: string;
  activeCount: number;
  lastActivityAt?: string;
}

export interface DiscoveryFeedParams {
  currentUserId?: string;
  limit?: number;
  offset?: number;
  filter?: FeedFilterType;
  hashtag?: string;
}
