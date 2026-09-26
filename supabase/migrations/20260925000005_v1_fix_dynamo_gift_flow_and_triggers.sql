-- ==============================================================================
-- DYNAMO V1: CRITICAL FIX AND ATOMIC CONSOLIDATION OF DYNAMO ENERGY GIFTS (⚡)
-- Migration: 20260925000005_v1_fix_dynamo_gift_flow_and_triggers.sql
-- Description:
--   1. Fix trigger trg_referral_first_gift(): use real column NEW.giver_id
--      instead of non-existent NEW.sender_user_id on public.dynamo_gifts.
--   2. Atomic & transactional public.gift_energy_to_dynamo(p_dynamo_id UUID):
--      - Validates caller authentication, active status, and global switches.
--      - Locks target dynamo (FOR UPDATE).
--      - Prevents self-gifting and duplicate gifts on same dynamo.
--      - Prevents gifting to expired or inactive dynamos.
--      - Enforces mutual block checks.
--      - Enforces 24-hour rolling limit (10 free gifts), falls back to purchased balance.
--      - Extends expires_at by +6h up to hard cap of 168h from creation.
--      - Inserts record into public.dynamo_gifts (dynamo_id, giver_id).
--      - Records immutable economy ledger transaction.
--      - Inserts exactly ONE notification to author with giver_id.
--      - Safe, unified return payload matching client expectations.
-- ==============================================================================

-- 1. FIX TRIGGER FUNCTION ON dynamo_gifts (REPLACE SENDER_USER_ID WITH GIVER_ID)
CREATE OR REPLACE FUNCTION public.trg_referral_first_gift()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attribution RECORD;
BEGIN
  -- FIX: The real column on public.dynamo_gifts is giver_id (NOT sender_user_id)
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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_first_gift_event ON public.dynamo_gifts;
CREATE TRIGGER trg_referral_first_gift_event
  AFTER INSERT ON public.dynamo_gifts
  FOR EACH ROW EXECUTE FUNCTION public.trg_referral_first_gift();


-- 2. RE-ESTABLISH AND HARDEN BADGES TRIGGER ON dynamo_gifts
-- Verify trigger trg_on_gift_award_badges is cleanly attached and using valid columns
CREATE OR REPLACE FUNCTION public.trg_on_gift_award_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author_id UUID;
BEGIN
  SELECT user_id INTO v_author_id FROM public.dynamos WHERE id = NEW.dynamo_id;
  IF v_author_id IS NOT NULL THEN
    PERFORM public.evaluate_and_award_badges(v_author_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_after_gift_award_badges ON public.dynamo_gifts;
CREATE TRIGGER trg_after_gift_award_badges
  AFTER INSERT ON public.dynamo_gifts
  FOR EACH ROW EXECUTE FUNCTION public.trg_on_gift_award_badges();


-- 3. CONSOLIDATE ATOMIC RPC gift_energy_to_dynamo
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
  v_gifts_in_24h INT;
  v_purchased_balance INT := 0;
  v_balance_type_used TEXT;
  v_new_purchased_balance INT := 0;
  v_remaining_free INT := 0;
  v_allow_dynamos BOOLEAN;
  v_emergency BOOLEAN;
  v_maintenance BOOLEAN;
  v_user_status TEXT;
BEGIN
  -- 3.1 Authentication verification
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado' USING ERRCODE = '42501';
  END IF;

  -- 3.2 Verify user status (must be active)
  SELECT status INTO v_user_status
  FROM public.profiles
  WHERE id = v_current_user_id;

  IF NOT FOUND OR v_user_status <> 'active' THEN
    RAISE EXCEPTION 'Tu cuenta se encuentra suspendida o inactiva. No puedes enviar energía.' USING ERRCODE = 'P0001';
  END IF;

  -- 3.3 Verify global administrative switches
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

  -- 3.4 Lock target dynamo row for atomic check & update
  SELECT * INTO v_dynamo
  FROM public.dynamos
  WHERE id = p_dynamo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El Dynamo no existe' USING ERRCODE = 'P0002';
  END IF;

  -- 3.5 Prevent self-gifting
  IF v_dynamo.user_id = v_current_user_id THEN
    RAISE EXCEPTION 'No puedes inyectar energía a tu propio Dynamo' USING ERRCODE = 'P0001';
  END IF;

  -- 3.6 Check status & natural expiration
  IF v_dynamo.status <> 'active' OR v_dynamo.expires_at <= timezone('utc'::text, now()) THEN
    RAISE EXCEPTION 'No se puede inyectar energía a un Dynamo expirado o inactivo' USING ERRCODE = 'P0001';
  END IF;

  -- 3.7 Check mutual blocks between giver and author
  IF EXISTS (
    SELECT 1 FROM public.blocks 
    WHERE (blocker_id = v_dynamo.user_id AND blocked_id = v_current_user_id)
       OR (blocker_id = v_current_user_id AND blocked_id = v_dynamo.user_id)
  ) THEN
    RAISE EXCEPTION 'No puedes interactuar con este usuario debido a bloqueos existentes' USING ERRCODE = 'P0001';
  END IF;

  -- 3.8 Prevent duplicate gift on the same dynamo by the same user
  IF EXISTS (
    SELECT 1 FROM public.dynamo_gifts 
    WHERE dynamo_id = p_dynamo_id AND giver_id = v_current_user_id
  ) THEN
    RAISE EXCEPTION 'Ya has entregado energía a este Dynamo' USING ERRCODE = 'P0001';
  END IF;

  -- 3.9 Check rolling 24-hour window limit for free gifts (max 10 free daily)
  SELECT count(*) INTO v_gifts_in_24h
  FROM public.dynamo_gifts
  WHERE giver_id = v_current_user_id
    AND created_at > (timezone('utc'::text, now()) - interval '24 hours');

  -- Lock and ensure user balance row exists
  INSERT INTO public.user_balances (user_id, purchased_balance)
  VALUES (v_current_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT purchased_balance INTO v_purchased_balance
  FROM public.user_balances
  WHERE user_id = v_current_user_id
  FOR UPDATE;

  IF v_gifts_in_24h < c_daily_user_free_limit THEN
    -- Consumes 1 free daily allowance
    v_balance_type_used := 'free';
    v_new_purchased_balance := v_purchased_balance;
    v_remaining_free := c_daily_user_free_limit - v_gifts_in_24h - 1;
  ELSE
    -- Free quota exhausted: check purchased balance
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

  -- 3.10 Calculate new expiration timestamp (+6 hours, hard cap: created_at + 168 hours)
  v_new_expires_at := v_dynamo.expires_at + (c_bonus_hours || ' hours')::interval;
  v_max_expires_at := v_dynamo.created_at + (c_max_lifespan_hours || ' hours')::interval;

  IF v_new_expires_at > v_max_expires_at THEN
    v_new_expires_at := v_max_expires_at;
  END IF;

  -- 3.11 Authorize expiration update via transaction setting
  PERFORM set_config('dynamo.allow_expiration_update', 'true', true);

  -- 3.12 Update dynamo expiration in database
  UPDATE public.dynamos
  SET expires_at = v_new_expires_at
  WHERE id = p_dynamo_id;

  -- 3.13 Record energy gift in public.dynamo_gifts (giver_id is the real column)
  INSERT INTO public.dynamo_gifts (dynamo_id, giver_id)
  VALUES (p_dynamo_id, v_current_user_id);

  -- 3.14 Record immutable audit ledger entry in economy_transactions
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

  -- 3.15 Insert EXACTLY ONE notification to the author of the Dynamo
  INSERT INTO public.notifications (user_id, sender_id, type, reference_id, metadata)
  VALUES (
    v_dynamo.user_id,
    v_current_user_id,
    'gift',
    p_dynamo_id,
    jsonb_build_object('dynamo_id', p_dynamo_id, 'giver_id', v_current_user_id)
  );

  -- 3.16 Get total gifts count on target dynamo
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
    'remaining_free_today', v_remaining_free,
    'gifts_remaining_today', v_remaining_free,
    'purchased_balance', v_new_purchased_balance,
    'reached_max_lifespan', (v_new_expires_at >= v_max_expires_at)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gift_energy_to_dynamo(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gift_energy_to_dynamo(UUID) TO authenticated;
