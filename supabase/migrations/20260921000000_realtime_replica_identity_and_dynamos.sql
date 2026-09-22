-- ==============================================================================
-- DYNAMO V0.1: REALTIME REPLICA IDENTITY AND PUBLICATION FOR NOTIFICATIONS & DYNAMOS
-- ==============================================================================

-- 1. Ensure REPLICA IDENTITY FULL on public.notifications
-- When RLS is active, PostgreSQL logical decoding and Supabase Realtime require
-- REPLICA IDENTITY FULL so WAL records contain all columns for RLS evaluation
-- and filtered postgres_changes subscriptions.
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- 2. Ensure REPLICA IDENTITY FULL on public.dynamos
ALTER TABLE public.dynamos REPLICA IDENTITY FULL;

-- 3. Ensure publication supabase_realtime includes public.notifications and public.dynamos
DO $$
BEGIN
  -- Notifications
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;

  -- Dynamos (for Realtime Feed updates)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'dynamos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dynamos;
  END IF;
END $$;
