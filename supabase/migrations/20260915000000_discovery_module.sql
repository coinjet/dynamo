-- ==============================================================================
-- DYNAMO: Discovery Module Migration V0.1
-- Sections:
-- 1. Tendencias (Trending Hashtags from active, non-expired dynamos)
-- 2. Casi desaparecen (Active dynamos with remaining life < 2 hours)
-- 3. Reviviendo (Active dynamos recently receiving energy gifts ⚡)
-- ==============================================================================

-- Optimize indexes for Discovery queries
CREATE INDEX IF NOT EXISTS idx_dynamos_active_expires 
  ON public.dynamos(status, expires_at ASC) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_dynamo_gifts_recent_activity 
  ON public.dynamo_gifts(dynamo_id, created_at DESC);

-- Function: get_trending_hashtags
-- Returns top hashtags based strictly on active, unexpired Dynamos.
-- Prevents duplicate casing by normalizing to lower case.
-- Does NOT expose personal data or vanity metrics.
CREATE OR REPLACE FUNCTION public.get_trending_hashtags(p_limit INT DEFAULT 10)
RETURNS TABLE (
  name TEXT,
  active_count BIGINT,
  last_activity_at TIMESTAMPTZ
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    lower(h.name) AS name,
    COUNT(DISTINCT d.id) AS active_count,
    MAX(d.created_at) AS last_activity_at
  FROM public.hashtags h
  JOIN public.dynamo_hashtags dh ON dh.hashtag_id = h.id
  JOIN public.dynamos d ON d.id = dh.dynamo_id
  WHERE d.status = 'active'
    AND d.expires_at > timezone('utc'::text, now())
  GROUP BY lower(h.name)
  ORDER BY active_count DESC, last_activity_at DESC
  LIMIT p_limit;
END;
$$;

-- Grant execution to authenticated and anon users for read access
GRANT EXECUTE ON FUNCTION public.get_trending_hashtags(INT) TO anon, authenticated;
