import { Profile } from '../profiles/profilesTypes';

export interface Reply {
  id: string;
  dynamo_id: string;
  user_id: string;
  content: string;
  status?: 'active' | 'hidden' | 'deleted';
  created_at: string;
  author?: Profile;
}

export interface CreateReplyDTO {
  dynamoId: string;
  content: string;
}
