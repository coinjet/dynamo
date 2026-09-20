export interface Hashtag {
  id: string;
  name: string;
  count?: number;
}

export interface DynamoHashtag {
  dynamo_id: string;
  hashtag_id: string;
}
