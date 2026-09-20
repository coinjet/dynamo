import { Profile } from '../profiles/profilesTypes';

export type DynamoStatus = 'active' | 'expired' | 'hidden' | 'deleted';

export interface Dynamo {
  id: string;
  user_id: string;
  content: string;
  image_url?: string | null;
  created_at: string;
  expires_at: string;
  status: DynamoStatus;
  
  // Extended properties
  author?: Profile;
  hashtags?: string[];
  energy_gifts_count?: number;
  replies_count?: number;
  has_gifted_energy?: boolean;
  last_gift_at?: string;
}

export interface CreateDynamoDTO {
  content: string;
  image_url?: string | null;
}
