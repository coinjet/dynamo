import { Hashtag } from './hashtagsTypes';
import { discoveryService } from '../discovery/discoveryService';

export const hashtagsService = {
  async getTrendingHashtags(): Promise<Hashtag[]> {
    const trending = await discoveryService.getTrendingHashtags(10);
    return trending.map((t) => ({
      id: 'tag_' + t.name,
      name: t.name,
      count: t.activeCount,
    }));
  },

  normalizeTag(raw: string): string {
    return discoveryService.normalizeTag(raw);
  }
};
