-- ==============================================================================
-- DYNAMO V1 PRODUCTION: ADMIN GROWTH ENGINE & REFERRAL CODES SECURITY
-- Migration: 20260925000003_v1_admin_growth_and_security.sql
-- Description:
--   1. Harden referral_codes RLS: Prevent public SELECT that exposes user_id.
--      Only the code owner or admins/moderators can SELECT from referral_codes.
--      Public resolution continues safely via validate_referral_code() RPC.
--   2. Admin Growth Funnel RPC: admin_get_growth_funnel()
--   3. Admin Growth Inviters List RPC: admin_get_growth_users() with pagination & search
--   4. RLS policies for admin oversight of referral tables
-- ==============================================================================

-- 1. HARDEN RLS ON referral_codes
DROP POLICY IF EXISTS "Public can view active referral codes" ON public.referral_codes;
DROP POLICY IF EXISTS "Users can view their own referral code" ON public.referral_codes;
DROP POLICY IF EXISTS "Admins can view all referral codes" ON public.referral_codes;

CREATE POLICY "Users can view their own referral code"
  ON public.referral_codes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all referral codes"
  ON public.referral_codes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- Admins can view all referral attributions
DROP POLICY IF EXISTS "Admins can view all attributions" ON public.referral_attributions;
CREATE POLICY "Admins can view all attributions"
  ON public.referral_attributions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- Admins can view all referral events
DROP POLICY IF EXISTS "Admins can view all referral events" ON public.referral_events;
CREATE POLICY "Admins can view all referral events"
  ON public.referral_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- 2. ADMIN RPC: GLOBAL GROWTH FUNNEL & METRICS
CREATE OR REPLACE FUNCTION public.admin_get_growth_funnel(p_admin_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_clicks BIGINT := 0;
  v_landing_views BIGINT := 0;
  v_signup_started BIGINT := 0;
  v_signup_completed BIGINT := 0;
  v_email_confirmed BIGINT := 0;
  v_first_dynamo BIGINT := 0;
  v_first_interaction BIGINT := 0;
  v_total_inviters BIGINT := 0;
  v_total_referred BIGINT := 0;
  v_total_confirmed_referred BIGINT := 0;
  v_total_first_dynamo BIGINT := 0;
  v_total_first_interaction BIGINT := 0;
BEGIN
  -- Verify caller has admin or moderator permissions
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = p_admin_user_id AND status = 'active';

  IF v_role NOT IN ('admin', 'moderator') THEN
    RAISE EXCEPTION 'Acceso denegado: permisos insuficientes para métricas de crecimiento.'
      USING ERRCODE = '42501';
  END IF;

  -- 2.1 Funnel Event Counts
  SELECT count(*) INTO v_clicks
  FROM public.referral_events WHERE event_type = 'click';

  SELECT count(*) INTO v_landing_views
  FROM public.referral_events WHERE event_type = 'landing_view';

  SELECT count(*) INTO v_signup_started
  FROM public.referral_events WHERE event_type = 'signup_started';

  SELECT count(*) INTO v_signup_completed
  FROM public.referral_events WHERE event_type = 'signup_completed';

  SELECT count(*) INTO v_email_confirmed
  FROM public.referral_events WHERE event_type = 'email_confirmed';

  SELECT count(*) INTO v_first_dynamo
  FROM public.referral_events WHERE event_type = 'first_dynamo';

  SELECT count(*) INTO v_first_interaction
  FROM public.referral_events WHERE event_type = 'first_interaction';

  -- 2.2 Global Metrics
  SELECT count(DISTINCT inviter_user_id) INTO v_total_inviters
  FROM public.referral_codes;

  SELECT count(*) INTO v_total_referred
  FROM public.referral_attributions;

  SELECT count(DISTINCT referred_user_id) INTO v_total_confirmed_referred
  FROM public.referral_events
  WHERE event_type = 'email_confirmed' AND referred_user_id IS NOT NULL;

  SELECT count(DISTINCT referred_user_id) INTO v_total_first_dynamo
  FROM public.referral_events
  WHERE event_type = 'first_dynamo' AND referred_user_id IS NOT NULL;

  SELECT count(DISTINCT referred_user_id) INTO v_total_first_interaction
  FROM public.referral_events
  WHERE event_type = 'first_interaction' AND referred_user_id IS NOT NULL;

  RETURN jsonb_build_object(
    'clicks', v_clicks,
    'landing_views', v_landing_views,
    'signup_started', v_signup_started,
    'signup_completed', v_signup_completed,
    'email_confirmed', v_email_confirmed,
    'first_dynamo', v_first_dynamo,
    'first_interaction', v_first_interaction,
    'total_inviters', v_total_inviters,
    'total_referred_users', v_total_referred,
    'total_confirmed_referred', v_total_confirmed_referred,
    'total_first_dynamo', v_total_first_dynamo,
    'total_first_interaction', v_total_first_interaction,
    'click_to_signup_rate', CASE WHEN v_clicks > 0 THEN round((v_signup_completed::numeric / v_clicks::numeric) * 100, 2) ELSE 0 END,
    'signup_to_confirmed_rate', CASE WHEN v_signup_completed > 0 THEN round((v_email_confirmed::numeric / v_signup_completed::numeric) * 100, 2) ELSE 0 END,
    'confirmed_to_active_rate', CASE WHEN v_email_confirmed > 0 THEN round((v_total_first_dynamo::numeric / v_email_confirmed::numeric) * 100, 2) ELSE 0 END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_growth_funnel(UUID) TO authenticated;

-- 3. ADMIN RPC: INVITERS DETAILED LIST WITH SERVER-SIDE AGGREGATES & PAGINATION
CREATE OR REPLACE FUNCTION public.admin_get_growth_users(
  p_admin_user_id UUID,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 15,
  p_search TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_offset INT;
  v_clean_search TEXT;
  v_total_records BIGINT;
  v_items JSONB;
BEGIN
  -- Verify caller role
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = p_admin_user_id AND status = 'active';

  IF v_role NOT IN ('admin', 'moderator') THEN
    RAISE EXCEPTION 'Acceso denegado: permisos insuficientes para consultar invitadores.'
      USING ERRCODE = '42501';
  END IF;

  v_offset := GREATEST(0, (COALESCE(p_page, 1) - 1) * COALESCE(p_page_size, 15));
  v_clean_search := lower(trim(COALESCE(p_search, '')));

  -- Calculate total records matching search filter
  SELECT count(*) INTO v_total_records
  FROM public.referral_codes rc
  JOIN public.profiles p ON p.id = rc.user_id
  WHERE (
    v_clean_search = ''
    OR lower(p.username) LIKE '%' || v_clean_search || '%'
    OR lower(rc.code) LIKE '%' || v_clean_search || '%'
  );

  -- Retrieve aggregated rows safely (strictly without emails or phone numbers)
  SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb) INTO v_items
  FROM (
    SELECT jsonb_build_object(
      'inviter_id', rc.user_id,
      'inviter_username', p.username,
      'inviter_avatar', COALESCE(p.avatar, ''),
      'referral_code', rc.code,
      'code_created_at', rc.created_at,
      'active', rc.active,
      'clicks', COALESCE(e_stats.clicks, 0),
      'signups', COALESCE(attr_stats.signups, 0),
      'confirmations', COALESCE(e_stats.confirmations, 0),
      'first_dynamos', COALESCE(e_stats.first_dynamos, 0),
      'first_interactions', COALESCE(e_stats.first_interactions, 0)
    ) AS row_data
    FROM public.referral_codes rc
    JOIN public.profiles p ON p.id = rc.user_id
    LEFT JOIN LATERAL (
      SELECT
        count(*) FILTER (WHERE event_type = 'click') AS clicks,
        count(*) FILTER (WHERE event_type = 'email_confirmed') AS confirmations,
        count(*) FILTER (WHERE event_type = 'first_dynamo') AS first_dynamos,
        count(*) FILTER (WHERE event_type = 'first_interaction') AS first_interactions
      FROM public.referral_events re
      WHERE re.inviter_user_id = rc.user_id
    ) e_stats ON true
    LEFT JOIN LATERAL (
      SELECT count(*) AS signups
      FROM public.referral_attributions ra
      WHERE ra.inviter_user_id = rc.user_id
    ) attr_stats ON true
    WHERE (
      v_clean_search = ''
      OR lower(p.username) LIKE '%' || v_clean_search || '%'
      OR lower(rc.code) LIKE '%' || v_clean_search || '%'
    )
    ORDER BY attr_stats.signups DESC, e_stats.clicks DESC, rc.created_at DESC
    LIMIT p_page_size
    OFFSET v_offset
  ) sub;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', v_total_records,
    'page', p_page,
    'pageSize', p_page_size,
    'totalPages', CEIL(v_total_records::numeric / GREATEST(1, p_page_size)::numeric)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_growth_users(UUID, INT, INT, TEXT) TO authenticated;
