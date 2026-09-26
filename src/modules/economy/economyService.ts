import { supabase, isSupabaseConfigured } from '@/src/lib/supabase';
import {
  AdminAdjustBalanceDTO,
  EconomyTransaction,
  GiftEnergyEconomyResult,
  PaginatedTransactionsResult,
  UserEconomyStatus,
} from './economyTypes';
import { DYNAMO_CONFIG } from '../dynamos/dynamoRules';
import { dynamosService } from '../dynamos/dynamosService';
import { adminService } from '../admin/adminService';

const LOCAL_STORAGE_TRANSACTIONS_KEY = 'dynamo_economy_transactions';
const LOCAL_STORAGE_BALANCES_KEY = 'dynamo_user_purchased_balances';

export const economyService = {
  getRules() {
    return {
      initialDurationHours: DYNAMO_CONFIG.INITIAL_DURATION_HOURS,
      giftBonusHours: DYNAMO_CONFIG.GIFT_BONUS_HOURS,
      maxLifespanHours: DYNAMO_CONFIG.MAX_LIFESPAN_HOURS,
      dailyGiftsAvailablePerUser: DYNAMO_CONFIG.DAILY_USER_GIFT_LIMIT,
    };
  },

  /**
   * Retrieves the current internal economy status for a user:
   * - free_limit: 10
   * - free_used_today: number of gifts sent in rolling 24h window
   * - free_available: free remaining today (0 to 10)
   * - purchased_balance: purchased Dynamos (never negative)
   * - total_available: free_available + purchased_balance
   */
  async getUserEconomy(userId: string): Promise<UserEconomyStatus> {
    if (!userId) {
      return {
        user_id: '',
        free_limit: 10,
        free_used_today: 0,
        free_available: 10,
        purchased_balance: 0,
        total_available: 10,
      };
    }

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('get_user_economy_status', {
          p_user_id: userId,
        });

        if (!error && data) {
          return {
            user_id: data.user_id,
            free_limit: data.free_limit ?? 10,
            free_used_today: data.free_used_today ?? 0,
            free_available: data.free_available ?? 0,
            purchased_balance: data.purchased_balance ?? 0,
            total_available: data.total_available ?? 0,
          };
        }
      } catch (err) {
        console.warn('Supabase get_user_economy_status failed, using local status:', err);
      }
    }

    // Local development emulation
    const DAILY_GIFTS_KEY = `dynamo_daily_gift_timestamps_${userId}`;
    const now = Date.now();
    const timestamps: number[] = JSON.parse(localStorage.getItem(DAILY_GIFTS_KEY) || '[]');
    const recentTimestamps = timestamps.filter((t) => now - t < 24 * 3600 * 1000);
    const freeUsedToday = recentTimestamps.length;
    const freeLimit = DYNAMO_CONFIG.DAILY_USER_GIFT_LIMIT; // 10
    const freeAvailable = Math.max(0, freeLimit - freeUsedToday);

    const balances: Record<string, number> = JSON.parse(
      localStorage.getItem(LOCAL_STORAGE_BALANCES_KEY) || '{}'
    );
    const purchasedBalance = Math.max(0, balances[userId] || 0);

    return {
      user_id: userId,
      free_limit: freeLimit,
      free_used_today: freeUsedToday,
      free_available: freeAvailable,
      purchased_balance: purchasedBalance,
      total_available: freeAvailable + purchasedBalance,
    };
  },

  /**
   * ⚡ Give energy to a Dynamo.
   * Atomically consumes 1 free Dynamo if available in 24h rolling window;
   * Otherwise consumes 1 purchased Dynamo if available;
   * Fails if both are 0.
   */
  async giveEnergyToDynamo(
    dynamoId: string,
    giverId: string
  ): Promise<GiftEnergyEconomyResult> {
    if (isSupabaseConfigured) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && !user.email_confirmed_at && !(user as any).confirmed_at) {
        throw new Error('Confirma tu correo para activar tu cuenta de Dynamo antes de regalar energía.');
      }

      const { data, error } = await supabase.rpc('gift_energy_to_dynamo', {
        p_dynamo_id: dynamoId,
      });

      if (error || !data || data.success === false) {
        throw new Error(error?.message || data?.error || 'No se pudo entregar energía al Dynamo.');
      }

      return {
        success: true,
        dynamo_id: dynamoId,
        new_expires_at: data.new_expires_at,
        newExpiresAt: data.new_expires_at,
        total_gifts: data.total_gifts ?? data.gifts_count ?? 1,
        totalGifts: data.total_gifts ?? data.gifts_count ?? 1,
        balance_type_used: data.balance_type_used || 'free',
        free_remaining_today: data.free_remaining_today ?? data.remaining_free_today ?? 0,
        purchased_balance: data.purchased_balance ?? 0,
        total_available: data.total_available ?? 0,
        reached_max_lifespan: Boolean(data.reached_max_lifespan),
        reachedMaxLifespan: Boolean(data.reached_max_lifespan),
      };
    }

    // Local Sandbox Emulation for end-user interaction
    const economyStatus = await this.getUserEconomy(giverId);
    let balanceTypeUsed: 'free' | 'purchased' = 'free';
    let newPurchasedBalance = economyStatus.purchased_balance;
    let newFreeRemaining = economyStatus.free_available;

    if (economyStatus.free_available > 0) {
      balanceTypeUsed = 'free';
      newFreeRemaining = economyStatus.free_available - 1;
    } else if (economyStatus.purchased_balance > 0) {
      balanceTypeUsed = 'purchased';
      newPurchasedBalance = economyStatus.purchased_balance - 1;
      newFreeRemaining = 0;

      // Update local storage balance
      const balances: Record<string, number> = JSON.parse(
        localStorage.getItem(LOCAL_STORAGE_BALANCES_KEY) || '{}'
      );
      balances[giverId] = newPurchasedBalance;
      localStorage.setItem(LOCAL_STORAGE_BALANCES_KEY, JSON.stringify(balances));
    } else {
      throw new Error(
        'Saldo insuficiente de Dynamos (agotaste tu cuota diaria gratuita de 10 y no tienes Dynamos adquiridos)'
      );
    }

    // Execute standard dynamo gift validation & duration extension
    const giftResult = await dynamosService.giftEnergy(dynamoId, giverId, balanceTypeUsed);

    // Record immutable ledger transaction
    const tx: EconomyTransaction = {
      id: 'tx_' + Math.random().toString(36).substring(2, 10),
      user_id: giverId,
      amount: -1,
      balance_type: balanceTypeUsed,
      transaction_type: 'gift_sent',
      reference_id: dynamoId,
      resulting_free_allowance: newFreeRemaining,
      resulting_purchased_balance: newPurchasedBalance,
      description: 'Regalo de 1 ⚡ a publicación Dynamo',
      created_at: new Date().toISOString(),
    };

    const storedTxs: EconomyTransaction[] = JSON.parse(
      localStorage.getItem(LOCAL_STORAGE_TRANSACTIONS_KEY) || '[]'
    );
    storedTxs.unshift(tx);
    localStorage.setItem(LOCAL_STORAGE_TRANSACTIONS_KEY, JSON.stringify(storedTxs));

    return {
      success: true,
      dynamo_id: dynamoId,
      new_expires_at: giftResult.newExpiresAt,
      newExpiresAt: giftResult.newExpiresAt,
      total_gifts: giftResult.totalGifts,
      totalGifts: giftResult.totalGifts,
      balance_type_used: balanceTypeUsed,
      free_remaining_today: newFreeRemaining,
      purchased_balance: newPurchasedBalance,
      total_available: newFreeRemaining + newPurchasedBalance,
      reached_max_lifespan: giftResult.reachedMaxLifespan,
      reachedMaxLifespan: giftResult.reachedMaxLifespan,
    };
  },

  /**
   * Retrieves paginated ledger transactions for a user.
   * Client read-only view.
   */
  async getTransactionHistory(
    userId: string,
    page = 1,
    pageSize = 15
  ): Promise<PaginatedTransactionsResult> {
    if (!userId) {
      return { items: [], total: 0, page: 1, pageSize, totalPages: 1 };
    }

    if (isSupabaseConfigured) {
      try {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        const { data, count, error } = await supabase
          .from('economy_transactions')
          .select('*', { count: 'exact' })
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .range(from, to);

        if (!error && data) {
          const total = count || 0;
          return {
            items: data as EconomyTransaction[],
            total,
            page,
            pageSize,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
          };
        }
      } catch (err) {
        console.warn('Error fetching economy transactions from Supabase:', err);
      }
    }

    // Local Sandbox Emulation
    const storedTxs: EconomyTransaction[] = JSON.parse(
      localStorage.getItem(LOCAL_STORAGE_TRANSACTIONS_KEY) || '[]'
    );
    const userTxs = storedTxs.filter((t) => t.user_id === userId);
    const total = userTxs.length;
    const startIndex = (page - 1) * pageSize;
    const items = userTxs.slice(startIndex, startIndex + pageSize);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  },

  /**
   * Administrative adjustment of a user's balance:
   * - Validates admin role on Supabase
   * - Strictly requires a motive
   * - Rejects negative resulting balances
   * - Records in immutable database ledger and in moderation audit actions via Supabase RPC admin_adjust_user_balance
   * - ZERO LocalStorage fallback for administrative operations
   */
  async adminAdjustBalance(
    dto: AdminAdjustBalanceDTO,
    adminId: string
  ): Promise<{ success: boolean; newPurchasedBalance: number }> {
    if (!adminId) {
      throw new Error('Usuario administrador autenticado requerido.');
    }

    if (!dto.reason || dto.reason.trim().length < 3) {
      throw new Error('El motivo del ajuste administrativo es obligatorio (mínimo 3 caracteres).');
    }

    if (!isSupabaseConfigured) {
      throw new Error('Operación rechazada: Supabase no está configurado en este entorno.');
    }

    const { data, error } = await supabase.rpc('admin_adjust_user_balance', {
      p_target_user_id: dto.targetUserId,
      p_amount: dto.amount,
      p_balance_type: dto.balanceType,
      p_reason: dto.reason.trim(),
    });

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
      newPurchasedBalance: data.new_purchased_balance,
    };
  },
};
