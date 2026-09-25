-- ==============================================================================
-- DYNAMO V1 PRODUCTION: REFERRALS, GROWTH ENGINE & STRICT REGISTRATION HARDENING
-- Migration: 20260925000002_v1_production_referrals_and_growth.sql
-- Description:
--   1. Strict Server-side Age (16+) & Mandatory Legal Agreements in handle_new_user()
--   2. Complete Referral System: referral_codes, referral_attributions, referral_events
--   3. Server-authoritative referral attribution and downstream funnel tracking
--   4. RLS policies and public/authenticated RPCs for referral tracking and stats
-- ==============================================================================

-- 1. CREATE REFERRAL TABLES

CREATE TABLE IF NOT EXISTS public.referral_codes (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  active BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON public.referral_codes (upper(code));

CREATE TABLE IF NOT EXISTS public.referral_attributions (
  referred_user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  inviter_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  attributed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT chk_no_self_referral CHECK (referred_user_id <> inviter_user_id)
);
CREATE INDEX IF NOT EXISTS idx_referral_attributions_inviter ON public.referral_attributions (inviter_user_id);

CREATE TABLE IF NOT EXISTS public.referral_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code TEXT NOT NULL,
  inviter_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'click',
      'landing_view',
      'signup_started',
      'signup_completed',
      'email_confirmed',
      'first_dynamo',
      'first_interaction'
    )
  ),
  session_id TEXT,
  referred_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_referral_events_code_type ON public.referral_events (upper(referral_code), event_type);
CREATE INDEX IF NOT EXISTS idx_referral_events_inviter ON public.referral_events (inviter_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_events_session ON public.referral_events (session_id, event_type);
CREATE INDEX IF NOT EXISTS idx_referral_events_referred_user ON public.referral_events (referred_user_id);

-- Backfill referral codes for existing users
INSERT INTO public.referral_codes (user_id, code, active)
SELECT id, 'DYN' || upper(substring(md5(id::text || 'dynamo_salt') from 1 for 5)), true
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- 2. HARDEN HANDLE_NEW_USER WITH STRICT 16+ AGE AND LEGAL VERIFICATION
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allow_registrations BOOLEAN;
  v_is_age_confirmed BOOLEAN;
  v_min_age_certified NUMERIC;
  v_username TEXT;
  v_new_ref_code TEXT;
  v_input_ref_code TEXT;
  v_inviter_user_id UUID;
BEGIN
  -- 2.1 Verify if new registrations are permitted by admin switch
  SELECT COALESCE(
    value = 'true'::jsonb OR value = '"true"'::jsonb OR (value #>> '{}') = 'true',
    true
  ) INTO v_allow_registrations
  FROM public.system_settings
  WHERE key = 'allow_new_registrations';

  IF v_allow_registrations IS FALSE THEN
    RAISE EXCEPTION 'El registro de nuevas cuentas se encuentra temporalmente pausado por administración.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 2.2 Validate mandatory minimum age (16 years) from registration metadata
  IF NEW.raw_user_meta_data->>'is_age_confirmed' IS NULL THEN
    RAISE EXCEPTION 'Es obligatorio certificar tener al menos 16 años cumplidos para registrarse en Dynamo.'
      USING ERRCODE = 'P0001';
  END IF;

  v_is_age_confirmed := (NEW.raw_user_meta_data->>'is_age_confirmed')::boolean;
  IF v_is_age_confirmed IS NOT TRUE THEN
    RAISE EXCEPTION 'Debes certificar tener al menos 16 años cumplidos para registrarte en Dynamo.'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.raw_user_meta_data->>'min_age_certified' IS NULL THEN
    RAISE EXCEPTION 'La certificación de edad mínima de 16 años es obligatoria.'
      USING ERRCODE = 'P0001';
  END IF;

  v_min_age_certified := (NEW.raw_user_meta_data->>'min_age_certified')::numeric;
  IF v_min_age_certified < 16 THEN
    RAISE EXCEPTION 'La edad mínima requerida para utilizar Dynamo es de 16 años cumplidos.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 2.3 Validate mandatory acceptance of legal terms and policies
  IF NEW.raw_user_meta_data->>'accepted_terms' IS NULL OR (NEW.raw_user_meta_data->>'accepted_terms')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'Es obligatorio aceptar los Términos de Servicio para registrarte en Dynamo.'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.raw_user_meta_data->>'accepted_privacy' IS NULL OR (NEW.raw_user_meta_data->>'accepted_privacy')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'Es obligatorio aceptar la Política de Privacidad para registrarte en Dynamo.'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.raw_user_meta_data->>'accepted_community' IS NULL OR (NEW.raw_user_meta_data->>'accepted_community')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'Es obligatorio aceptar las Normas de la Comunidad para registrarte en Dynamo.'
      USING ERRCODE = 'P0001';
  END IF;

  -- 2.4 Create default profile safely and idempotently
  v_username := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'username'), ''), 'user_' || substring(NEW.id::text from 1 for 8));

  INSERT INTO public.profiles (id, username, avatar, bio, role, status)
  VALUES (
    NEW.id,
    v_username,
    COALESCE(NEW.raw_user_meta_data->>'avatar', ''),
    COALESCE(NEW.raw_user_meta_data->>'bio', ''),
    'user',
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    bio = COALESCE(NULLIF(EXCLUDED.bio, ''), public.profiles.bio);

  -- 2.5 Generate personal referral code for the new user
  v_new_ref_code := 'DYN' || upper(substring(md5(NEW.id::text || clock_timestamp()::text) from 1 for 5));
  INSERT INTO public.referral_codes (user_id, code, active)
  VALUES (NEW.id, v_new_ref_code, true)
  ON CONFLICT (user_id) DO NOTHING;

  -- 2.6 Server-side referral attribution
  v_input_ref_code := upper(trim(COALESCE(NEW.raw_user_meta_data->>'referral_code', '')));
  IF v_input_ref_code <> '' THEN
    SELECT user_id INTO v_inviter_user_id
    FROM public.referral_codes
    WHERE upper(code) = v_input_ref_code
      AND active = true
      AND user_id <> NEW.id;

    IF v_inviter_user_id IS NOT NULL THEN
      -- Attribution record (immutable)
      INSERT INTO public.referral_attributions (referred_user_id, inviter_user_id, referral_code)
      VALUES (NEW.id, v_inviter_user_id, v_input_ref_code)
      ON CONFLICT (referred_user_id) DO NOTHING;

      -- Funnel event: signup_completed
      INSERT INTO public.referral_events (referral_code, inviter_user_id, event_type, referred_user_id)
      VALUES (v_input_ref_code, v_inviter_user_id, 'signup_completed', NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure trigger is attached to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. DOWNSTREAM FUNNEL TRIGGERS (EMAIL_CONFIRMED, FIRST_DYNAMO, FIRST_INTERACTION)

-- 3.1 Funnel event: email_confirmed
CREATE OR REPLACE FUNCTION public.trg_referral_email_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attribution RECORD;
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND (OLD.email_confirmed_at IS NULL) THEN
    SELECT * INTO v_attribution
    FROM public.referral_attributions
    WHERE referred_user_id = NEW.id;

    IF FOUND THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.referral_events
        WHERE referred_user_id = NEW.id AND event_type = 'email_confirmed'
      ) THEN
        INSERT INTO public.referral_events (referral_code, inviter_user_id, event_type, referred_user_id)
        VALUES (v_attribution.referral_code, v_attribution.inviter_user_id, 'email_confirmed', NEW.id);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER trg_auth_user_email_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.trg_referral_email_confirmed();

-- 3.2 Funnel event: first_dynamo
CREATE OR REPLACE FUNCTION public.trg_referral_first_dynamo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attribution RECORD;
  v_dynamo_count INT;
BEGIN
  IF NEW.status = 'active' THEN
    SELECT * INTO v_attribution
    FROM public.referral_attributions
    WHERE referred_user_id = NEW.user_id;

    IF FOUND THEN
      SELECT count(*) INTO v_dynamo_count
      FROM public.dynamos
      WHERE user_id = NEW.user_id;

      IF v_dynamo_count = 1 THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.referral_events
          WHERE referred_user_id = NEW.user_id AND event_type = 'first_dynamo'
        ) THEN
          INSERT INTO public.referral_events (referral_code, inviter_user_id, event_type, referred_user_id)
          VALUES (v_attribution.referral_code, v_attribution.inviter_user_id, 'first_dynamo', NEW.user_id);
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_first_dynamo_event ON public.dynamos;
CREATE TRIGGER trg_referral_first_dynamo_event
  AFTER INSERT ON public.dynamos
  FOR EACH ROW EXECUTE FUNCTION public.trg_referral_first_dynamo();

-- 3.3 Funnel event: first_interaction (reply or gift)
CREATE OR REPLACE FUNCTION public.trg_referral_first_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attribution RECORD;
BEGIN
  SELECT * INTO v_attribution
  FROM public.referral_attributions
  WHERE referred_user_id = NEW.user_id;

  IF FOUND THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.referral_events
      WHERE referred_user_id = NEW.user_id AND event_type = 'first_interaction'
    ) THEN
      INSERT INTO public.referral_events (referral_code, inviter_user_id, event_type, referred_user_id)
      VALUES (v_attribution.referral_code, v_attribution.inviter_user_id, 'first_interaction', NEW.user_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_first_reply_event ON public.replies;
CREATE TRIGGER trg_referral_first_reply_event
  AFTER INSERT ON public.replies
  FOR EACH ROW EXECUTE FUNCTION public.trg_referral_first_reply();

CREATE OR REPLACE FUNCTION public.trg_referral_first_gift()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attribution RECORD;
BEGIN
  SELECT * INTO v_attribution
  FROM public.referral_attributions
  WHERE referred_user_id = NEW.sender_user_id;

  IF FOUND THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.referral_events
      WHERE referred_user_id = NEW.sender_user_id AND event_type = 'first_interaction'
    ) THEN
      INSERT INTO public.referral_events (referral_code, inviter_user_id, event_type, referred_user_id)
      VALUES (v_attribution.referral_code, v_attribution.inviter_user_id, 'first_interaction', NEW.sender_user_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_first_gift_event ON public.dynamo_gifts;
CREATE TRIGGER trg_referral_first_gift_event
  AFTER INSERT ON public.dynamo_gifts
  FOR EACH ROW EXECUTE FUNCTION public.trg_referral_first_gift();

-- 4. RPCS FOR CLIENT CONSUMPTION

-- 4.1 Track public funnel events (click, landing_view, signup_started)
CREATE OR REPLACE FUNCTION public.track_referral_event(
  p_code TEXT,
  p_event_type TEXT,
  p_session_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_code TEXT;
  v_inviter_id UUID;
  v_recent_count INT;
BEGIN
  v_clean_code := upper(trim(COALESCE(p_code, '')));
  IF v_clean_code = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Código de invitación no especificado.');
  END IF;

  IF p_event_type NOT IN ('click', 'landing_view', 'signup_started') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tipo de evento no permitido.');
  END IF;

  SELECT user_id INTO v_inviter_id
  FROM public.referral_codes
  WHERE upper(code) = v_clean_code AND active = true;

  IF v_inviter_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Código de invitación no válido o inactivo.');
  END IF;

  -- Deduplicate session events within 1 hour to prevent flooding
  IF p_session_id IS NOT NULL AND trim(p_session_id) <> '' THEN
    SELECT count(*) INTO v_recent_count
    FROM public.referral_events
    WHERE upper(referral_code) = v_clean_code
      AND event_type = p_event_type
      AND session_id = trim(p_session_id)
      AND created_at > (timezone('utc'::text, now()) - interval '1 hour');

    IF v_recent_count > 0 THEN
      RETURN jsonb_build_object('success', true, 'deduplicated', true);
    END IF;
  END IF;

  INSERT INTO public.referral_events (referral_code, inviter_user_id, event_type, session_id)
  VALUES (v_clean_code, v_inviter_id, p_event_type, NULLIF(trim(p_session_id), ''));

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_referral_event(TEXT, TEXT, TEXT) TO anon, authenticated;

-- 4.2 Validate invitation code
CREATE OR REPLACE FUNCTION public.validate_referral_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean TEXT;
  v_inviter_username TEXT;
  v_inviter_id UUID;
  v_active BOOLEAN;
BEGIN
  v_clean := upper(trim(COALESCE(p_code, '')));
  IF v_clean = '' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Código vacío.');
  END IF;

  SELECT rc.user_id, rc.active, p.username
  INTO v_inviter_id, v_active, v_inviter_username
  FROM public.referral_codes rc
  JOIN public.profiles p ON p.id = rc.user_id
  WHERE upper(rc.code) = v_clean;

  IF v_inviter_id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Código de invitación no encontrado.');
  END IF;

  IF v_active IS NOT TRUE THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Este enlace de invitación ya no está activo.');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'code', v_clean,
    'inviter_username', v_inviter_username
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_referral_code(TEXT) TO anon, authenticated;

-- 4.3 Get or create personal referral code for the authenticated user
CREATE OR REPLACE FUNCTION public.get_or_create_my_referral_code()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_code TEXT;
  v_created_at TIMESTAMPTZ;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado.' USING ERRCODE = '42501';
  END IF;

  SELECT code, created_at INTO v_code, v_created_at
  FROM public.referral_codes
  WHERE user_id = v_user_id;

  IF v_code IS NULL THEN
    v_code := 'DYN' || upper(substring(md5(v_user_id::text || clock_timestamp()::text) from 1 for 5));
    INSERT INTO public.referral_codes (user_id, code, active)
    VALUES (v_user_id, v_code, true)
    ON CONFLICT (user_id) DO UPDATE SET active = true
    RETURNING code, created_at INTO v_code, v_created_at;
  END IF;

  RETURN jsonb_build_object(
    'code', v_code,
    'created_at', v_created_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_my_referral_code() TO authenticated;

-- 4.4 Get real, verified referral statistics for the authenticated user
CREATE OR REPLACE FUNCTION public.get_my_referral_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_code TEXT;
  v_clicks INT := 0;
  v_landing_views INT := 0;
  v_signups INT := 0;
  v_confirmed INT := 0;
  v_active_users INT := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado.' USING ERRCODE = '42501';
  END IF;

  SELECT code INTO v_code
  FROM public.referral_codes
  WHERE user_id = v_user_id;

  IF v_code IS NULL THEN
    RETURN jsonb_build_object(
      'code', null,
      'clicks', 0,
      'landing_views', 0,
      'signups', 0,
      'confirmed', 0,
      'active_users', 0
    );
  END IF;

  SELECT count(*) INTO v_clicks
  FROM public.referral_events
  WHERE inviter_user_id = v_user_id AND event_type = 'click';

  SELECT count(*) INTO v_landing_views
  FROM public.referral_events
  WHERE inviter_user_id = v_user_id AND event_type = 'landing_view';

  SELECT count(*) INTO v_signups
  FROM public.referral_attributions
  WHERE inviter_user_id = v_user_id;

  SELECT count(*) INTO v_confirmed
  FROM public.referral_events
  WHERE inviter_user_id = v_user_id AND event_type = 'email_confirmed';

  SELECT count(DISTINCT referred_user_id) INTO v_active_users
  FROM public.referral_events
  WHERE inviter_user_id = v_user_id AND event_type IN ('first_dynamo', 'first_interaction');

  RETURN jsonb_build_object(
    'code', v_code,
    'clicks', v_clicks,
    'landing_views', v_landing_views,
    'signups', v_signups,
    'confirmed', v_confirmed,
    'active_users', v_active_users
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_referral_stats() TO authenticated;

-- 5. ROW LEVEL SECURITY POLICIES

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_events ENABLE ROW LEVEL SECURITY;

-- referral_codes policies
DROP POLICY IF EXISTS "Public can view active referral codes" ON public.referral_codes;
CREATE POLICY "Public can view active referral codes"
  ON public.referral_codes FOR SELECT
  USING (active = true);

-- referral_attributions policies
DROP POLICY IF EXISTS "Users can view their own attributions" ON public.referral_attributions;
CREATE POLICY "Users can view their own attributions"
  ON public.referral_attributions FOR SELECT
  USING (auth.uid() = inviter_user_id OR auth.uid() = referred_user_id);

-- referral_events policies
DROP POLICY IF EXISTS "Inviters can view their referral events" ON public.referral_events;
CREATE POLICY "Inviters can view their referral events"
  ON public.referral_events FOR SELECT
  USING (auth.uid() = inviter_user_id);
