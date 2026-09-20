-- ==============================================================================
-- DYNAMO: PRE-LAUNCH COMPREHENSIVE SECURITY & INTEGRITY HARDENING
-- Migration: 20260919000002_prelaunch_security_hardening.sql
-- ==============================================================================

-- 1. HARDEN DYNAMOS INSERTION (Server-side trigger enforcement)
-- Enforces:
-- a) User must be authenticated and active (blocks suspended, banned, deactivated users)
-- b) Platform switches: allow_new_posts must not be false, emergency_mode & maintenance_mode must not be true (unless admin)
-- c) Strictly 24 hours initial duration enforced on server
CREATE OR REPLACE FUNCTION public.trg_set_dynamo_creation_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_status TEXT;
  v_user_role TEXT;
  v_allow_posts BOOLEAN;
  v_emergency BOOLEAN;
  v_maintenance BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para publicar un Dynamo.';
  END IF;

  -- 1. Verify author profile status and role
  SELECT status, role INTO v_user_status, v_user_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil de usuario no encontrado.';
  END IF;

  IF v_user_status <> 'active' THEN
    RAISE EXCEPTION 'Tu cuenta se encuentra suspendida o inactiva. No puedes realizar publicaciones.';
  END IF;

  -- 2. Verify global platform switches (bypass for system admin)
  IF v_user_role <> 'admin' THEN
    SELECT COALESCE((value)::boolean, true) INTO v_allow_posts
    FROM public.system_settings
    WHERE key = 'allow_new_posts';

    IF v_allow_posts IS FALSE THEN
      RAISE EXCEPTION 'La publicación de nuevos Dynamos se encuentra temporalmente pausada por administración.';
    END IF;

    SELECT COALESCE((value)::boolean, false) INTO v_emergency
    FROM public.system_settings
    WHERE key = 'emergency_mode';

    IF v_emergency IS TRUE THEN
      RAISE EXCEPTION 'La plataforma se encuentra en modo de mitigación de emergencia.';
    END IF;

    SELECT COALESCE((value)::boolean, false) INTO v_maintenance
    FROM public.system_settings
    WHERE key = 'maintenance_mode';

    IF v_maintenance IS TRUE THEN
      RAISE EXCEPTION 'La plataforma se encuentra en modo de mantenimiento.';
    END IF;
  END IF;

  NEW.created_at := timezone('utc'::text, now());
  NEW.expires_at := NEW.created_at + interval '24 hours';
  NEW.status := 'active';
  NEW.user_id := auth.uid();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dynamo_before_insert ON public.dynamos;
CREATE TRIGGER trg_dynamo_before_insert
  BEFORE INSERT ON public.dynamos
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_dynamo_creation_defaults();


-- 2. HARDEN REPLIES (Server-side trigger enforcement)
-- Enforces:
-- a) User must be active
-- b) allow_new_replies must not be false
-- c) Target dynamo must be active and not expired
-- d) Bidirectional block check
CREATE OR REPLACE FUNCTION public.trg_validate_reply_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_status TEXT;
  v_user_role TEXT;
  v_allow_replies BOOLEAN;
  v_emergency BOOLEAN;
  v_dynamo RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para responder.';
  END IF;

  -- 1. Check author status
  SELECT status, role INTO v_user_status, v_user_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT FOUND OR v_user_status <> 'active' THEN
    RAISE EXCEPTION 'Tu cuenta se encuentra suspendida o inactiva. No puedes publicar respuestas.';
  END IF;

  -- 2. Check global switches
  IF v_user_role <> 'admin' THEN
    SELECT COALESCE((value)::boolean, true) INTO v_allow_replies
    FROM public.system_settings
    WHERE key = 'allow_new_replies';

    IF v_allow_replies IS FALSE THEN
      RAISE EXCEPTION 'La publicación de respuestas se encuentra temporalmente deshabilitada.';
    END IF;

    SELECT COALESCE((value)::boolean, false) INTO v_emergency
    FROM public.system_settings
    WHERE key = 'emergency_mode';

    IF v_emergency IS TRUE THEN
      RAISE EXCEPTION 'La plataforma se encuentra en modo de emergencia.';
    END IF;
  END IF;

  -- 3. Verify target dynamo
  SELECT user_id, status, expires_at INTO v_dynamo
  FROM public.dynamos
  WHERE id = NEW.dynamo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El Dynamo al que intentas responder no existe.';
  END IF;

  IF v_dynamo.status <> 'active' OR v_dynamo.expires_at <= timezone('utc'::text, now()) THEN
    RAISE EXCEPTION 'No se puede responder a un Dynamo expirado o inactivo.';
  END IF;

  -- 4. Check bidirectional blocks
  IF EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = auth.uid() AND blocked_id = v_dynamo.user_id)
       OR (blocker_id = v_dynamo.user_id AND blocked_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'No puedes interactuar con esta publicación debido a bloqueos entre los usuarios.';
  END IF;

  NEW.created_at := timezone('utc'::text, now());
  NEW.user_id := auth.uid();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reply_before_insert ON public.replies;
CREATE TRIGGER trg_reply_before_insert
  BEFORE INSERT ON public.replies
  FOR EACH ROW EXECUTE FUNCTION public.trg_validate_reply_creation();


-- 3. HARDEN GIFT ENERGY RPC (gift_energy_to_dynamo)
-- Enforces:
-- a) User must be active
-- b) allow_dynamos switch must not be false
-- c) emergency_mode & maintenance_mode must not be active
CREATE OR REPLACE FUNCTION public.gift_energy_to_dynamo(p_dynamo_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_bonus_hours CONSTANT INT := 6;
  c_max_lifespan_hours CONSTANT INT := 168; -- 7 days hard ceiling
  c_daily_user_free_limit CONSTANT INT := 10;
  
  v_dynamo RECORD;
  v_current_user_id UUID;
  v_user_status TEXT;
  v_allow_dynamos BOOLEAN;
  v_emergency BOOLEAN;
  v_maintenance BOOLEAN;
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

  -- Verify user status
  SELECT status INTO v_user_status
  FROM public.profiles
  WHERE id = v_current_user_id;

  IF NOT FOUND OR v_user_status <> 'active' THEN
    RAISE EXCEPTION 'Tu cuenta se encuentra suspendida o inactiva. No puedes enviar energía.';
  END IF;

  -- Verify global switch allow_dynamos
  SELECT COALESCE((value)::boolean, true) INTO v_allow_dynamos
  FROM public.system_settings
  WHERE key = 'allow_dynamos';

  IF v_allow_dynamos IS FALSE THEN
    RAISE EXCEPTION 'El envío de energía ⚡ se encuentra temporalmente deshabilitado por administración.';
  END IF;

  SELECT COALESCE((value)::boolean, false) INTO v_emergency
  FROM public.system_settings
  WHERE key = 'emergency_mode';

  IF v_emergency IS TRUE THEN
    RAISE EXCEPTION 'La plataforma se encuentra en modo de emergencia.';
  END IF;

  SELECT COALESCE((value)::boolean, false) INTO v_maintenance
  FROM public.system_settings
  WHERE key = 'maintenance_mode';

  IF v_maintenance IS TRUE THEN
    RAISE EXCEPTION 'La plataforma se encuentra en mantenimiento.';
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
    WHERE (blocker_id = v_dynamo.user_id AND blocked_id = v_current_user_id)
       OR (blocker_id = v_current_user_id AND blocked_id = v_dynamo.user_id)
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

  RETURN jsonb_build_object(
    'success', true,
    'dynamo_id', p_dynamo_id,
    'new_expires_at', v_new_expires_at,
    'gifts_count', v_total_gifts,
    'balance_type_used', v_balance_type_used,
    'remaining_free_today', v_remaining_free,
    'purchased_balance', v_new_purchased_balance
  );
END;
$$;


-- 4. HARDEN REPORTS TABLE RLS (Ensure all reports go through submit_content_report)
-- Drop direct client INSERT policy so malicious clients cannot bypass rate-limits,
-- self-report checks, or reason validations.
DROP POLICY IF EXISTS "Authenticated users can submit reports" ON public.reports;


-- 5. HARDEN NEW USER REGISTRATION TRIGGER (allow_new_registrations enforcement)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allow_registrations BOOLEAN;
BEGIN
  -- Verify if new registrations are permitted
  SELECT COALESCE((value)::boolean, true) INTO v_allow_registrations
  FROM public.system_settings
  WHERE key = 'allow_new_registrations';

  IF v_allow_registrations IS FALSE THEN
    RAISE EXCEPTION 'El registro de nuevas cuentas se encuentra temporalmente pausado por administración.';
  END IF;

  INSERT INTO public.profiles (id, username, avatar, bio, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substring(NEW.id::text from 1 for 8)),
    COALESCE(NEW.raw_user_meta_data->>'avatar', ''),
    COALESCE(NEW.raw_user_meta_data->>'bio', ''),
    'user',
    'active'
  );
  RETURN NEW;
END;
$$;


-- 6. HARDEN ADMIN ANNOUNCEMENTS RLS
-- Scheduled communications must NEVER leak prematurely before scheduled_for has arrived.
-- Cancelled communications must never be visible to normal users.
-- Normal users can ONLY see 'sent' announcements whose scheduled_for is NULL or in the past.
DROP POLICY IF EXISTS "Users can read relevant announcements" ON public.admin_announcements;
CREATE POLICY "Users can read relevant announcements"
  ON public.admin_announcements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
    OR (
      status = 'sent'
      AND (scheduled_for IS NULL OR scheduled_for <= timezone('utc'::text, now()))
      AND (
        target_scope = 'general'
        OR (target_scope = 'individual' AND target_user_id = auth.uid())
      )
    )
  );

