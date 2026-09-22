import { Profile } from '../profiles/profilesTypes';

export interface Reply {
  id: string;
  dynamo_id: string;
  user_id: string;
  content: string;
  parent_reply_id?: string | null;
  status?: 'active' | 'hidden' | 'deleted';
  created_at: string;
  author?: Profile;
  children?: Reply[];
}

export interface CreateReplyDTO {
  dynamoId: string;
  content: string;
  parentReplyId?: string | null;
}
