export interface DynamoGift {
  id: string;
  dynamo_id: string;
  giver_id: string;
  created_at: string;
}

export interface EnergyRules {
  initialDurationHours: number;
  giftBonusHours: number;
  maxLifespanHours: number;
  dailyGiftsAvailablePerUser: number;
}

export type EconomyTransactionType =
  | 'daily_grant'
  | 'gift_sent'
  | 'purchase'
  | 'admin_adjustment';

export type EconomyBalanceType = 'free' | 'purchased';

export interface EconomyTransaction {
  id: string;
  user_id: string;
  amount: number;
  balance_type: EconomyBalanceType;
  transaction_type: EconomyTransactionType;
  reference_id?: string | null;
  resulting_free_allowance?: number | null;
  resulting_purchased_balance?: number | null;
  description?: string | null;
  created_at: string;
}

export interface UserEconomyStatus {
  user_id: string;
  free_limit: number;
  free_used_today: number;
  free_available: number;
  purchased_balance: number;
  total_available: number;
}

export interface GiftEnergyEconomyResult {
  success: boolean;
  dynamo_id: string;
  new_expires_at: string;
  newExpiresAt: string;
  total_gifts: number;
  totalGifts: number;
  balance_type_used: EconomyBalanceType;
  free_remaining_today: number;
  purchased_balance: number;
  total_available: number;
  reached_max_lifespan: boolean;
  reachedMaxLifespan: boolean;
}

export interface AdminAdjustBalanceDTO {
  targetUserId: string;
  amount: number;
  balanceType: EconomyBalanceType;
  reason: string;
}

export interface PaginatedTransactionsResult {
  items: EconomyTransaction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
