-- ==============================================================================
-- DYNAMO V1: ENABLE REALTIME FOR NOTIFICATIONS
-- Adds public.notifications to supabase_realtime publication idempotently
-- ==============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
