-- ==============================================================================
-- DYNAMO: Best Dynamos & Badges Migration V0.1
-- Sections:
-- 1. Table: user_badges (Automated verifiable achievement badges)
-- 2. RLS Policies: Read-only for clients, system/service role only for modifications
-- 3. Procedure: get_best_dynamos_ranking (Historical ranking with tie-breakers)
-- 4. Procedure: evaluate_and_award_badges (Automated verifiable criteria)
-- 5. Trigger on dynamo_gifts to automate badge progression
-- ==============================================================================

-- 1. Table: user_badges
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_key TEXT NOT NULL,
  awarded_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  CONSTRAINT unique_user_badge UNIQUE (user_id, badge_key),
  CONSTRAINT valid_badge_key CHECK (badge_key IN (
    'first_gift_received',
    'gifts_10_received',
    'gifts_50_received',
    'gifts_100_received',
    'best_dynamos_entry',
    'top_10_historical',
    'top_1_historical'
  ))
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON public.user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_key ON public.user_badges(badge_key);

-- 2. RLS Policies for user_badges
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view user badges" ON public.user_badges;
CREATE POLICY "Public can view user badges"
  ON public.user_badges FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Deny direct user badge insertions" ON public.user_badges;
CREATE POLICY "Deny direct user badge insertions"
  ON public.user_badges FOR INSERT
  WITH CHECK (false);

DROP POLICY IF EXISTS "Deny direct user badge updates" ON public.user_badges;
CREATE POLICY "Deny direct user badge updates"
  ON public.user_badges FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS "Deny direct user badge deletions" ON public.user_badges;
CREATE POLICY "Deny direct user badge deletions"
  ON public.user_badges FOR DELETE
  USING (false);

-- 3. Procedure: get_best_dynamos_ranking
-- Retrieves historical ranking of Dynamos based strictly on valid energy gifts (⚡).
-- Ties are broken by last_gift_at DESC, then created_at ASC.
-- Excludes Dynamos hidden by moderation or deleted.
-- Preserves expired Dynamos in the historical ranking.
CREATE OR REPLACE FUNCTION public.get_best_dynamos_ranking(
  p_period TEXT DEFAULT 'all_time',
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  rank BIGINT,
  dynamo_id UUID,
  content TEXT,
  author_id UUID,
  author_username TEXT,
  author_avatar TEXT,
  author_role TEXT,
  energy_gifts_count BIGINT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  last_gift_at TIMESTAMPTZ,
  historical_status TEXT,
  total_count BIGINT
) AS $$
DECLARE
  v_total_records BIGINT;
BEGIN
  -- Count total eligible ranked dynamos (with at least 1 valid gift, not hidden, not deleted)
  SELECT COUNT(DISTINCT d.id) INTO v_total_records
  FROM public.dynamos d
  INNER JOIN public.dynamo_gifts g ON g.dynamo_id = d.id
  INNER JOIN public.profiles p ON p.id = d.user_id
  WHERE d.status NOT IN ('hidden', 'deleted')
    AND p.status NOT IN ('banned');

  RETURN QUERY
  WITH ranked_dynamos AS (
    SELECT
      d.id AS dyn_id,
      d.content AS dyn_content,
      p.id AS auth_id,
      p.username AS auth_username,
      p.avatar AS auth_avatar,
      p.role AS auth_role,
      COUNT(g.id) AS gifts_count,
      d.created_at AS dyn_created_at,
      d.expires_at AS dyn_expires_at,
      MAX(g.created_at) AS dyn_last_gift_at,
      CASE
        WHEN d.expires_at <= timezone('utc'::text, now()) OR d.status = 'expired' THEN 'expired'
        ELSE 'active'
      END AS dyn_historical_status,
      ROW_NUMBER() OVER (
        ORDER BY
          COUNT(g.id) DESC,
          MAX(g.created_at) DESC,
          d.created_at ASC
      ) AS rank_pos
    FROM public.dynamos d
    INNER JOIN public.dynamo_gifts g ON g.dynamo_id = d.id
    INNER JOIN public.profiles p ON p.id = d.user_id
    WHERE d.status NOT IN ('hidden', 'deleted')
      AND p.status NOT IN ('banned')
    GROUP BY d.id, d.content, p.id, p.username, p.avatar, p.role, d.created_at, d.expires_at, d.status
  )
  SELECT
    rd.rank_pos AS rank,
    rd.dyn_id AS dynamo_id,
    rd.dyn_content AS content,
    rd.auth_id AS author_id,
    rd.auth_username AS author_username,
    rd.auth_avatar AS author_avatar,
    rd.auth_role AS author_role,
    rd.gifts_count AS energy_gifts_count,
    rd.dyn_created_at AS created_at,
    rd.dyn_expires_at AS expires_at,
    rd.dyn_last_gift_at AS last_gift_at,
    rd.dyn_historical_status AS historical_status,
    v_total_records AS total_count
  FROM ranked_dynamos rd
  ORDER BY rd.rank_pos ASC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 4. Procedure: evaluate_and_award_badges
-- Automatically evaluates and awards verifiable badges for a user.
-- Badges:
--  - first_gift_received: >= 1 valid ⚡ received
--  - gifts_10_received: >= 10 valid ⚡ received
--  - gifts_50_received: >= 50 valid ⚡ received
--  - gifts_100_received: >= 100 valid ⚡ received
--  - best_dynamos_entry: Has had any Dynamo in the Best Dynamos ranking
--  - top_10_historical: Has had a Dynamo in the Top 10 historical ranking
--  - top_1_historical: Has reached position #1 in the historical ranking
CREATE OR REPLACE FUNCTION public.evaluate_and_award_badges(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_total_gifts_received INT;
  v_highest_rank INT;
  v_has_ranking_entry BOOLEAN := false;
  v_awarded_badges JSONB := '[]'::jsonb;
BEGIN
  -- 1. Calculate total legitimate gifts received on non-hidden, non-deleted dynamos
  SELECT COALESCE(COUNT(g.id), 0) INTO v_total_gifts_received
  FROM public.dynamos d
  INNER JOIN public.dynamo_gifts g ON g.dynamo_id = d.id
  WHERE d.user_id = p_user_id
    AND d.status NOT IN ('hidden', 'deleted');

  -- Check gifts received milestones
  IF v_total_gifts_received >= 1 THEN
    INSERT INTO public.user_badges (user_id, badge_key, metadata)
    VALUES (p_user_id, 'first_gift_received', jsonb_build_object('gifts_count', v_total_gifts_received))
    ON CONFLICT (user_id, badge_key) DO NOTHING;
  END IF;

  IF v_total_gifts_received >= 10 THEN
    INSERT INTO public.user_badges (user_id, badge_key, metadata)
    VALUES (p_user_id, 'gifts_10_received', jsonb_build_object('gifts_count', v_total_gifts_received))
    ON CONFLICT (user_id, badge_key) DO NOTHING;
  END IF;

  IF v_total_gifts_received >= 50 THEN
    INSERT INTO public.user_badges (user_id, badge_key, metadata)
    VALUES (p_user_id, 'gifts_50_received', jsonb_build_object('gifts_count', v_total_gifts_received))
    ON CONFLICT (user_id, badge_key) DO NOTHING;
  END IF;

  IF v_total_gifts_received >= 100 THEN
    INSERT INTO public.user_badges (user_id, badge_key, metadata)
    VALUES (p_user_id, 'gifts_100_received', jsonb_build_object('gifts_count', v_total_gifts_received))
    ON CONFLICT (user_id, badge_key) DO NOTHING;
  END IF;

  -- 2. Determine highest historical rank achieved by user's dynamos
  WITH all_ranks AS (
    SELECT
      d.user_id,
      ROW_NUMBER() OVER (
        ORDER BY
          COUNT(g.id) DESC,
          MAX(g.created_at) DESC,
          d.created_at ASC
      ) AS rank_pos
    FROM public.dynamos d
    INNER JOIN public.dynamo_gifts g ON g.dynamo_id = d.id
    WHERE d.status NOT IN ('hidden', 'deleted')
    GROUP BY d.id, d.user_id, d.created_at
  )
  SELECT MIN(rank_pos) INTO v_highest_rank
  FROM all_ranks
  WHERE user_id = p_user_id;

  IF v_highest_rank IS NOT NULL THEN
    -- Entry into Best Dynamos
    INSERT INTO public.user_badges (user_id, badge_key, metadata)
    VALUES (p_user_id, 'best_dynamos_entry', jsonb_build_object('highest_rank', v_highest_rank))
    ON CONFLICT (user_id, badge_key) DO NOTHING;

    -- Top 10 historical
    IF v_highest_rank <= 10 THEN
      INSERT INTO public.user_badges (user_id, badge_key, metadata)
      VALUES (p_user_id, 'top_10_historical', jsonb_build_object('highest_rank', v_highest_rank))
      ON CONFLICT (user_id, badge_key) DO NOTHING;
    END IF;

    -- #1 historical
    IF v_highest_rank = 1 THEN
      INSERT INTO public.user_badges (user_id, badge_key, metadata)
      VALUES (p_user_id, 'top_1_historical', jsonb_build_object('highest_rank', 1))
      ON CONFLICT (user_id, badge_key) DO NOTHING;
    END IF;
  END IF;

  -- Return current badges
  SELECT jsonb_agg(to_jsonb(b.*)) INTO v_awarded_badges
  FROM public.user_badges b
  WHERE b.user_id = p_user_id;

  RETURN COALESCE(v_awarded_badges, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger on dynamo_gifts
-- Automatically evaluates badges when a gift is made
CREATE OR REPLACE FUNCTION public.trg_on_gift_award_badges()
RETURNS TRIGGER AS $$
DECLARE
  v_author_id UUID;
BEGIN
  SELECT user_id INTO v_author_id FROM public.dynamos WHERE id = NEW.dynamo_id;
  IF v_author_id IS NOT NULL THEN
    PERFORM public.evaluate_and_award_badges(v_author_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_after_gift_award_badges ON public.dynamo_gifts;
CREATE TRIGGER trg_after_gift_award_badges
  AFTER INSERT ON public.dynamo_gifts
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_on_gift_award_badges();
