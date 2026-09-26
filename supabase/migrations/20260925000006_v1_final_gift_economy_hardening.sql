-- ==============================================================================
-- DYNAMO V1: DEFINITIVE HARDENING OF ENERGY GIFTS (⚡), ECONOMY AND TRIGGERS
-- Migration: 20260925000006_v1_final_gift_economy_hardening.sql
-- Description:
--   1. Real-time accounting: Free gifts strictly counted from economy_transactions
--      (balance_type = 'free' AND transaction_type = 'gift_sent' in rolling 24h).
--      Purchased gifts NEVER consume, reduce or pollute the free quota.
--   2. Strict Lock Hierarchy to prevent race conditions and deadlocks:
--      user_balances (giver) FOR UPDATE -> dynamos (target) FOR UPDATE.
--   3. Server-side notification preferences checked for author (no client trust).
--   4. Exception-safe triggers on dynamo_gifts (referrals and badges never abort gifts).
--   5. Synchronized get_user_economy_status & gift_energy_to_dynamo RPCs.
-- ==============================================================================

-- 1. PERFORMANCE INDEX FOR ROLLING 24-HOUR FREE GIFT CALCULATION
CREATE INDEX IF NOT EXISTS idx_economy_tx_user_free_rolling
  ON public.economy_transactions (user_id, transaction_type, balance_type, created_at DESC);

-- 2. HARDEN RLS ON dynamo_gifts
ALTER TABLE public.dynamo_gifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view dynamo gifts" ON public.dynamo_gifts;
DROP POLICY IF EXISTS "Anyone can view dynamo gifts" ON public.dynamo_gifts;

CREATE POLICY "Anyone can view dynamo gifts"
  ON public.dynamo_gifts
  FOR SELECT
  USING (true);

-- Disallow any direct INSERT/UPDATE/DELETE by client roles.
-- Writes are exclusively executed through SECURITY DEFINER procedures.

-- 3. SYNCHRONIZE get_user_economy_status
CREATE OR REPLACE FUNCTION public.get_user_economy_status(p_user_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_id UUID;
  c_free_limit CONSTANT INT := 10;
  v_used_free_today INT := 0;
  v_free_available INT := 0;
  v_purchased_balance INT := 0;
BEGIN
  v_target_id := COALESCE(p_user_id, auth.uid());
  IF v_target_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no especificado ni autenticado' USING ERRCODE = '42501';
  END IF;

  -- Only target user or admin/moderator can query economy status
  IF auth.uid() <> v_target_id AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator')
  ) THEN
    RAISE EXCEPTION 'Acceso no autorizado al saldo de este usuario' USING ERRCODE = '42501';
  END IF;

  -- Calculate free dynamos used strictly from immutable economy ledger in rolling 24h window
  -- (Purchased dynamos do NOT consume or reduce this free quota)
  SELECT count(*) INTO v_used_free_today
  FROM public.economy_transactions
  WHERE user_id = v_target_id
    AND transaction_type = 'gift_sent'
    AND balance_type = 'free'
    AND created_at > (timezone('utc'::text, now()) - interval '24 hours');

  v_free_available := GREATEST(0, c_free_limit - v_used_free_today);

  -- Get purchased balance (guaranteed never negative)
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
$$;

REVOKE ALL ON FUNCTION public.get_user_economy_status(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_user_economy_status(UUID) TO authenticated;


-- 4. ATOMIC, SAFE & DEFINITIVE gift_energy_to_dynamo
CREATE OR REPLACE FUNCTION public.gift_energy_to_dynamo(p_dynamo_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id UUID;
  v_dynamo RECORD;
  v_new_expires_at TIMESTAMPTZ;
  v_max_expires_at TIMESTAMPTZ;
  v_total_gifts INT;
  c_bonus_hours CONSTANT INT := 6;
  c_max_lifespan_hours CONSTANT INT := 168; -- 7 days max absolute
  c_daily_user_free_limit CONSTANT INT := 10;
  v_free_gifts_in_24h INT := 0;
  v_purchased_balance INT := 0;
  v_balance_type_used TEXT;
  v_new_purchased_balance INT := 0;
  v_remaining_free INT := 0;
  v_allow_dynamos BOOLEAN;
  v_emergency BOOLEAN;
  v_maintenance BOOLEAN;
  v_user_status TEXT;
  v_author_wants_notification BOOLEAN := true;
BEGIN
  -- 4.1 Authentication verification
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado' USING ERRCODE = '42501';
  END IF;

  -- 4.2 Verify user status (must be active)
  SELECT status INTO v_user_status
  FROM public.profiles
  WHERE id = v_current_user_id;

  IF NOT FOUND OR v_user_status <> 'active' THEN
    RAISE EXCEPTION 'Tu cuenta se encuentra suspendida o inactiva. No puedes enviar energía.' USING ERRCODE = 'P0001';
  END IF;

  -- 4.3 Verify global administrative switches
  SELECT COALESCE(
    value = 'true'::jsonb OR value = '"true"'::jsonb OR (value #>> '{}') = 'true',
    true
  ) INTO v_allow_dynamos
  FROM public.system_settings
  WHERE key = 'allow_dynamos';

  IF v_allow_dynamos IS FALSE THEN
    RAISE EXCEPTION 'El envío de energía ⚡ se encuentra temporalmente deshabilitado por administración.' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(
    value = 'true'::jsonb OR value = '"true"'::jsonb OR (value #>> '{}') = 'true',
    false
  ) INTO v_emergency
  FROM public.system_settings
  WHERE key = 'emergency_mode';

  IF v_emergency IS TRUE THEN
    RAISE EXCEPTION 'La plataforma se encuentra en modo de emergencia.' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(
    value = 'true'::jsonb OR value = '"true"'::jsonb OR (value #>> '{}') = 'true',
    false
  ) INTO v_maintenance
  FROM public.system_settings
  WHERE key = 'maintenance_mode';

  IF v_maintenance IS TRUE THEN
    RAISE EXCEPTION 'La plataforma se encuentra en mantenimiento.' USING ERRCODE = 'P0001';
  END IF;

  -- 4.4 Lock Order 1: Lock giver's balance row first to serialize concurrent requests by the same user
  INSERT INTO public.user_balances (user_id, purchased_balance)
  VALUES (v_current_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT purchased_balance INTO v_purchased_balance
  FROM public.user_balances
  WHERE user_id = v_current_user_id
  FOR UPDATE;

  -- 4.5 Lock Order 2: Lock target dynamo row for atomic check & update
  SELECT * INTO v_dynamo
  FROM public.dynamos
  WHERE id = p_dynamo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El Dynamo no existe' USING ERRCODE = 'P0002';
  END IF;

  -- 4.6 Prevent self-gifting
  IF v_dynamo.user_id = v_current_user_id THEN
    RAISE EXCEPTION 'No puedes inyectar energía a tu propio Dynamo' USING ERRCODE = 'P0001';
  END IF;

  -- 4.7 Check status & natural expiration
  IF v_dynamo.status <> 'active' OR v_dynamo.expires_at <= timezone('utc'::text, now()) THEN
    RAISE EXCEPTION 'No se puede inyectar energía a un Dynamo expirado o inactivo' USING ERRCODE = 'P0001';
  END IF;

  -- 4.8 Check mutual blocks between giver and author
  IF EXISTS (
    SELECT 1 FROM public.blocks 
    WHERE (blocker_id = v_dynamo.user_id AND blocked_id = v_current_user_id)
       OR (blocker_id = v_current_user_id AND blocked_id = v_dynamo.user_id)
  ) THEN
    RAISE EXCEPTION 'No puedes interactuar con este usuario debido a bloqueos existentes' USING ERRCODE = 'P0001';
  END IF;

  -- 4.9 Prevent duplicate gift on the same dynamo by the same user
  IF EXISTS (
    SELECT 1 FROM public.dynamo_gifts 
    WHERE dynamo_id = p_dynamo_id AND giver_id = v_current_user_id
  ) THEN
    RAISE EXCEPTION 'Ya has entregado energía a este Dynamo' USING ERRCODE = 'P0001';
  END IF;

  -- 4.10 Calculate free gifts sent in rolling 24-hour window from economy_transactions
  SELECT count(*) INTO v_free_gifts_in_24h
  FROM public.economy_transactions
  WHERE user_id = v_current_user_id
    AND transaction_type = 'gift_sent'
    AND balance_type = 'free'
    AND created_at > (timezone('utc'::text, now()) - interval '24 hours');

  IF v_free_gifts_in_24h < c_daily_user_free_limit THEN
    -- Consumes 1 free daily allowance (purchased balance is untouched)
    v_balance_type_used := 'free';
    v_new_purchased_balance := v_purchased_balance;
    v_remaining_free := c_daily_user_free_limit - v_free_gifts_in_24h - 1;
  ELSE
    -- Free quota exhausted: consume purchased balance
    IF v_purchased_balance > 0 THEN
      v_balance_type_used := 'purchased';
      v_new_purchased_balance := v_purchased_balance - 1;
      v_remaining_free := 0;

      UPDATE public.user_balances
      SET purchased_balance = v_new_purchased_balance,
          updated_at = timezone('utc'::text, now())
      WHERE user_id = v_current_user_id;
    ELSE
      RAISE EXCEPTION 'Saldo insuficiente de Dynamos (agotaste tu cuota diaria gratuita de % y no tienes Dynamos adquiridos)', c_daily_user_free_limit
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- 4.11 Calculate new expiration timestamp (+6 hours, hard cap: created_at + 168 hours)
  v_new_expires_at := v_dynamo.expires_at + (c_bonus_hours || ' hours')::interval;
  v_max_expires_at := v_dynamo.created_at + (c_max_lifespan_hours || ' hours')::interval;

  IF v_new_expires_at > v_max_expires_at THEN
    v_new_expires_at := v_max_expires_at;
  END IF;

  -- 4.12 Authorize expiration update via transaction setting
  PERFORM set_config('dynamo.allow_expiration_update', 'true', true);

  -- 4.13 Update dynamo expiration in database
  UPDATE public.dynamos
  SET expires_at = v_new_expires_at
  WHERE id = p_dynamo_id;

  -- 4.14 Record energy gift in public.dynamo_gifts (giver_id is the real column)
  INSERT INTO public.dynamo_gifts (dynamo_id, giver_id)
  VALUES (p_dynamo_id, v_current_user_id);

  -- 4.15 Record immutable audit ledger entry in economy_transactions
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

  -- 4.16 Server-side check of author's notification preferences
  BEGIN
    SELECT 
      COALESCE(social_notifications, true) AND COALESCE(notify_dynamos_received, true)
    INTO v_author_wants_notification
    FROM public.user_settings
    WHERE user_id = v_dynamo.user_id;

    IF v_author_wants_notification IS NULL THEN
      v_author_wants_notification := true;
    END IF;

    -- Only insert notification if author wants it and giver is not the author
    IF v_author_wants_notification IS TRUE AND v_dynamo.user_id <> v_current_user_id THEN
      INSERT INTO public.notifications (user_id, sender_id, type, reference_id, metadata)
      VALUES (
        v_dynamo.user_id,
        v_current_user_id,
        'gift',
        p_dynamo_id,
        jsonb_build_object(
          'dynamo_id', p_dynamo_id,
          'giver_id', v_current_user_id
        )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- A notification insertion failure must never roll back a legitimate gift
    NULL;
  END;

  -- 4.17 Get total gifts count on target dynamo
  SELECT count(*) INTO v_total_gifts
  FROM public.dynamo_gifts
  WHERE dynamo_id = p_dynamo_id;

  RETURN jsonb_build_object(
    'success', true,
    'dynamo_id', p_dynamo_id,
    'new_expires_at', v_new_expires_at,
    'total_gifts', v_total_gifts,
    'gifts_count', v_total_gifts,
    'balance_type_used', v_balance_type_used,
    'free_remaining_today', v_remaining_free,
    'remaining_free_today', v_remaining_free,
    'gifts_remaining_today', v_remaining_free,
    'purchased_balance', v_new_purchased_balance,
    'total_available', v_remaining_free + v_new_purchased_balance,
    'reached_max_lifespan', (v_new_expires_at >= v_max_expires_at)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gift_energy_to_dynamo(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gift_energy_to_dynamo(UUID) TO authenticated;


-- 5. RESILIENT TRIGGERS ON dynamo_gifts

-- 5.1 Referral First Gift Event
CREATE OR REPLACE FUNCTION public.trg_referral_first_gift()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attribution RECORD;
BEGIN
  -- Safe: uses real column giver_id
  BEGIN
    SELECT * INTO v_attribution
    FROM public.referral_attributions
    WHERE referred_user_id = NEW.giver_id;

    IF FOUND THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.referral_events
        WHERE referred_user_id = NEW.giver_id AND event_type = 'first_interaction'
      ) THEN
        INSERT INTO public.referral_events (referral_code, inviter_user_id, event_type, referred_user_id)
        VALUES (v_attribution.referral_code, v_attribution.inviter_user_id, 'first_interaction', NEW.giver_id);
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_first_gift_event ON public.dynamo_gifts;
CREATE TRIGGER trg_referral_first_gift_event
  AFTER INSERT ON public.dynamo_gifts
  FOR EACH ROW EXECUTE FUNCTION public.trg_referral_first_gift();


-- 5.2 Badges Progression Event
CREATE OR REPLACE FUNCTION public.trg_on_gift_award_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author_id UUID;
BEGIN
  BEGIN
    SELECT user_id INTO v_author_id FROM public.dynamos WHERE id = NEW.dynamo_id;
    IF v_author_id IS NOT NULL THEN
      PERFORM public.evaluate_and_award_badges(v_author_id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_after_gift_award_badges ON public.dynamo_gifts;
CREATE TRIGGER trg_after_gift_award_badges
  AFTER INSERT ON public.dynamo_gifts
  FOR EACH ROW EXECUTE FUNCTION public.trg_on_gift_award_badges();
