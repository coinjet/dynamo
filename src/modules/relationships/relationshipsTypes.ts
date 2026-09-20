export interface Follow {
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface Block {
  blocker_id: string;
  blocked_id: string;
  created_at?: string;
}

export interface Mute {
  muter_id: string;
  muted_id: string;
  created_at?: string;
}

export type RelationshipStatus = 'none' | 'following' | 'friends' | 'blocked' | 'blocked_by';

export interface UserRelationshipState {
  isFollowing: boolean;
  isFollower: boolean;
  isFriend: boolean;
  isBlocked: boolean;
  isBlockedBy: boolean;
  isMuted: boolean;
}

export type FeedFilterType = 'todos' | 'siguiendo' | 'amigos';
