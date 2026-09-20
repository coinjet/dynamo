-- ==============================================================================
-- DYNAMO V0.1 - ECONOMY MODULE MIGRATION
-- Internal Secure Balance & Ledger Architecture
-- 1. Free daily quota: 10 Dynamos per rolling 24-hour window (no monetary value)
-- 2. Purchased Dynamos balance (prepared for future monetization, no negative balance)
-- 3. Immutable ledger: economy_transactions
-- 4. Atomic gifting with balance debit (free first, then purchased)
-- 5. Administrative adjustments with role verification and audit trail
-- ==============================================================================

-- 1. User Balances Table
CREATE TABLE IF NOT EXISTS public.user_balances (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  purchased_balance INT NOT NULL DEFAULT 0 CHECK (purchased_balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Immutable Economy Ledger (Transactions)
CREATE TABLE IF NOT EXISTS public.economy_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INT NOT NULL, -- positive for credit, negative for debit
  balance_type TEXT NOT NULL CHECK (balance_type IN ('free', 'purchased')),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('daily_grant', 'gift_sent', 'purchase', 'admin_adjustment')),
  reference_id TEXT,
  resulting_free_allowance INT,
  resulting_purchased_balance INT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_economy_tx_user_created ON public.economy_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_economy_tx_type ON public.economy_transactions (transaction_type);

-- 3. Row Level Security (RLS)
ALTER TABLE public.user_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economy_transactions ENABLE ROW LEVEL SECURITY;

-- Balances: Users can view only their own balance. Admins and moderators can view all.
CREATE POLICY "Users can view own balance or admins can view all"
  ON public.user_balances FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
  );

-- Transactions: Users can view only their own ledger history. Admins and moderators can view all.
CREATE POLICY "Users can view own ledger or admins can view all"
  ON public.economy_transactions FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
  );

-- STRICT SECURITY: Disallow direct client INSERT/UPDATE/DELETE on ledger and balances
-- All writes occur exclusively via SECURITY DEFINER server procedures below.

-- ==============================================================================
-- RPC: get_user_economy_status
-- Returns real-time free quota and purchased balance
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_user_economy_status(p_user_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_target_id UUID;
  c_free_limit CONSTANT INT := 10;
  v_used_free_today INT := 0;
  v_free_available INT := 0;
  v_purchased_balance INT := 0;
BEGIN
  v_target_id := COALESCE(p_user_id, auth.uid());
  IF v_target_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no especificado ni autenticado';
  END IF;

  -- Only target user or admin/moderator can query economy status
  IF auth.uid() <> v_target_id AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator')
  ) THEN
    RAISE EXCEPTION 'Acceso no autorizado al saldo de este usuario';
  END IF;

  -- Calculate free dynamos used in last 24 hours
  SELECT count(*) INTO v_used_free_today
  FROM public.dynamo_gifts
  WHERE giver_id = v_target_id
    AND created_at > (timezone('utc'::text, now()) - interval '24 hours');

  v_free_available := GREATEST(0, c_free_limit - v_used_free_today);

  -- Get purchased balance
  SELECT COALESCE(purchased_balance, 0) INTO v_purchased_balance
  FROM public.user_balances
  WHERE user_id = v_target_id;

  RETURN jsonb_build_object(
    'user_id', v_target_id,
    'free_limit', c_free_limit,
    'free_used_today', v_used_free_today,
    'free_available', v_free_available,
    'purchased_balance', v_purchased_balance,
    'total_available', v_free_available + v_purchased_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- RPC: gift_energy_to_dynamo (ATOMIC WITH ECONOMY DEBIT)
-- Extended to consume free daily quota first, then purchased balance.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.gift_energy_to_dynamo(p_dynamo_id UUID)
RETURNS JSONB AS $$
DECLARE
  c_bonus_hours CONSTANT INT := 6;
  c_max_lifespan_hours CONSTANT INT := 168; -- 7 days hard ceiling
  c_daily_user_free_limit CONSTANT INT := 10;
  
  v_dynamo RECORD;
  v_current_user_id UUID;
  v_new_expires_at TIMESTAMPTZ;
  v_max_expires_at TIMESTAMPTZ;
  v_gifts_in_24h INT;
  v_total_gifts INT;
  v_purchased_balance INT := 0;
  v_balance_type_used TEXT;
  v_new_purchased_balance INT := 0;
  v_remaining_free INT := 0;
BEGIN
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  -- 1. Lock target dynamo row for atomic check & update
  SELECT * INTO v_dynamo FROM public.dynamos WHERE id = p_dynamo_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El Dynamo no existe';
  END IF;

  -- 2. Prevent self-gifting
  IF v_dynamo.user_id = v_current_user_id THEN
    RAISE EXCEPTION 'No puedes inyectar energía a tu propio Dynamo';
  END IF;

  -- 3. Check status & expiration
  IF v_dynamo.status <> 'active' OR v_dynamo.expires_at <= timezone('utc'::text, now()) THEN
    RAISE EXCEPTION 'No se puede inyectar energía a un Dynamo expirado o inactivo';
  END IF;

  -- 4. Check if blocked by target author
  IF EXISTS (
    SELECT 1 FROM public.blocks 
    WHERE blocker_id = v_dynamo.user_id AND blocked_id = v_current_user_id
  ) THEN
    RAISE EXCEPTION 'No puedes interactuar con este usuario debido a bloqueos existentes';
  END IF;

  -- 5. Prevent duplicate gift on the same dynamo by the same user
  IF EXISTS (
    SELECT 1 FROM public.dynamo_gifts 
    WHERE dynamo_id = p_dynamo_id AND giver_id = v_current_user_id
  ) THEN
    RAISE EXCEPTION 'Ya has entregado energía a este Dynamo';
  END IF;

  -- 6. Lock and check user's economy balances
  SELECT count(*) INTO v_gifts_in_24h
  FROM public.dynamo_gifts
  WHERE giver_id = v_current_user_id
    AND created_at > (timezone('utc'::text, now()) - interval '24 hours');

  -- Ensure user_balances row exists and lock it
  INSERT INTO public.user_balances (user_id, purchased_balance)
  VALUES (v_current_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT purchased_balance INTO v_purchased_balance
  FROM public.user_balances
  WHERE user_id = v_current_user_id
  FOR UPDATE;

  IF v_gifts_in_24h < c_daily_user_free_limit THEN
    -- Consumes 1 free daily Dynamo
    v_balance_type_used := 'free';
    v_new_purchased_balance := v_purchased_balance;
    v_remaining_free := c_daily_user_free_limit - v_gifts_in_24h - 1;
  ELSE
    -- Free limit exhausted, check purchased balance
    IF v_purchased_balance > 0 THEN
      v_balance_type_used := 'purchased';
      v_new_purchased_balance := v_purchased_balance - 1;
      v_remaining_free := 0;

      UPDATE public.user_balances
      SET purchased_balance = v_new_purchased_balance,
          updated_at = timezone('utc'::text, now())
      WHERE user_id = v_current_user_id;
    ELSE
      RAISE EXCEPTION 'Saldo insuficiente de Dynamos (agotaste tu cuota diaria gratuita de % y no tienes Dynamos adquiridos)', c_daily_user_free_limit;
    END IF;
  END IF;

  -- 7. Calculate new expiration timestamp (+6 hours, hard cap: created_at + 168 hours)
  v_new_expires_at := v_dynamo.expires_at + (c_bonus_hours || ' hours')::interval;
  v_max_expires_at := v_dynamo.created_at + (c_max_lifespan_hours || ' hours')::interval;

  IF v_new_expires_at > v_max_expires_at THEN
    v_new_expires_at := v_max_expires_at;
  END IF;

  -- 8. Authorize expiration update via transaction setting
  PERFORM set_config('dynamo.allow_expiration_update', 'true', true);

  -- 9. Update dynamo expiration
  UPDATE public.dynamos
  SET expires_at = v_new_expires_at
  WHERE id = p_dynamo_id;

  -- 10. Record gift
  INSERT INTO public.dynamo_gifts (dynamo_id, giver_id)
  VALUES (p_dynamo_id, v_current_user_id);

  -- 11. Record immutable ledger transaction
  INSERT INTO public.economy_transactions (
    user_id,
    amount,
    balance_type,
    transaction_type,
    reference_id,
    resulting_free_allowance,
    resulting_purchased_balance,
    description
  ) VALUES (
    v_current_user_id,
    -1,
    v_balance_type_used,
    'gift_sent',
    p_dynamo_id::text,
    v_remaining_free,
    v_new_purchased_balance,
    'Regalo de 1 ⚡ a publicación Dynamo'
  );

  -- 12. Get total gifts count on target dynamo
  SELECT count(*) INTO v_total_gifts
  FROM public.dynamo_gifts
  WHERE dynamo_id = p_dynamo_id;

  -- 13. Notify author
  INSERT INTO public.notifications (user_id, type, reference_id)
  VALUES (v_dynamo.user_id, 'gift', p_dynamo_id);

  RETURN jsonb_build_object(
    'success', true,
    'dynamo_id', p_dynamo_id,
    'new_expires_at', v_new_expires_at,
    'total_gifts', v_total_gifts,
    'balance_type_used', v_balance_type_used,
    'free_remaining_today', v_remaining_free,
    'purchased_balance', v_new_purchased_balance,
    'total_available', v_remaining_free + v_new_purchased_balance,
    'reached_max_lifespan', (v_new_expires_at >= v_max_expires_at)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- RPC: admin_adjust_user_balance
-- Administrative balance adjustment with mandatory reason and audit log
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_adjust_user_balance(
  p_target_user_id UUID,
  p_amount INT,
  p_balance_type TEXT,
  p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_caller_role TEXT;
  v_current_purchased INT := 0;
  v_new_purchased INT := 0;
  v_free_available INT := 0;
BEGIN
  -- 1. Verify caller has admin or moderator role
  SELECT role INTO v_caller_role
  FROM public.profiles
  WHERE id = auth.uid() AND status = 'active';

  IF v_caller_role NOT IN ('admin', 'moderator') THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores o moderadores pueden ajustar saldos';
  END IF;

  -- 2. Validate reason
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'El motivo del ajuste administrativo es obligatorio (mínimo 3 caracteres)';
  END IF;

  -- 3. Validate balance type
  IF p_balance_type NOT IN ('purchased', 'free') THEN
    RAISE EXCEPTION 'Tipo de saldo inválido. Debe ser "purchased" o "free"';
  END IF;

  -- 4. Target user check
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target_user_id) THEN
    RAISE EXCEPTION 'El usuario objetivo no existe';
  END IF;

  -- 5. Lock user_balances row
  INSERT INTO public.user_balances (user_id, purchased_balance)
  VALUES (p_target_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT purchased_balance INTO v_current_purchased
  FROM public.user_balances
  WHERE user_id = p_target_user_id
  FOR UPDATE;

  -- 6. Apply adjustment
  IF p_balance_type = 'purchased' THEN
    v_new_purchased := v_current_purchased + p_amount;
    IF v_new_purchased < 0 THEN
      RAISE EXCEPTION 'Operación rechazada: el ajuste resultaría en saldo negativo (% < 0)', v_new_purchased;
    END IF;

    UPDATE public.user_balances
    SET purchased_balance = v_new_purchased,
        updated_at = timezone('utc'::text, now())
    WHERE user_id = p_target_user_id;
  ELSE
    v_new_purchased := v_current_purchased;
  END IF;

  -- 7. Record in immutable ledger
  INSERT INTO public.economy_transactions (
    user_id,
    amount,
    balance_type,
    transaction_type,
    reference_id,
    resulting_free_allowance,
    resulting_purchased_balance,
    description
  ) VALUES (
    p_target_user_id,
    p_amount,
    p_balance_type,
    'admin_adjustment',
    auth.uid()::text,
    0,
    v_new_purchased,
    p_reason
  );

  -- 8. Record in moderation audit log
  INSERT INTO public.moderation_actions (
    admin_id,
    action,
    target_type,
    target_id,
    reason
  ) VALUES (
    auth.uid(),
    'admin_economy_adjustment',
    'user',
    p_target_user_id,
    'Ajuste saldo (' || (CASE WHEN p_amount >= 0 THEN '+' ELSE '' END) || p_amount || ' ' || p_balance_type || '): ' || p_reason
  );

  RETURN jsonb_build_object(
    'success', true,
    'target_user_id', p_target_user_id,
    'adjusted_amount', p_amount,
    'balance_type', p_balance_type,
    'new_purchased_balance', v_new_purchased
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
