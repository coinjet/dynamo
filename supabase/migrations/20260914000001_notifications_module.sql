-- ==============================================================================
-- DYNAMO V0.1: NOTIFICATIONS SYSTEM (TRIGGERS, FUNCTIONS & EXPIRING NOTICES)
-- ==============================================================================

-- 1. Extend notifications table with sender_id and metadata for context navigation
ALTER TABLE public.notifications 
  ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Ensure RLS is active on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to enforce complete security rules
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can mark their own notifications as read" ON public.notifications;
DROP POLICY IF EXISTS "No client insert on notifications" ON public.notifications;

-- Only target user can SELECT their own notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Only target user can UPDATE their own notifications (and ONLY the 'read' column)
CREATE POLICY "Users can mark their own notifications as read"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Direct client INSERT or DELETE is strictly prohibited; server triggers only
-- (No INSERT or DELETE policy means clients get access denied by default in RLS)

-- 3. Trigger Function: Notification on Follow
CREATE OR REPLACE FUNCTION public.trg_notify_on_follow()
RETURNS TRIGGER AS $$
DECLARE
  v_is_blocked BOOLEAN;
BEGIN
  -- Check if there is an active block between either party
  SELECT EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = NEW.follower_id AND blocked_id = NEW.following_id)
       OR (blocker_id = NEW.following_id AND blocked_id = NEW.follower_id)
  ) INTO v_is_blocked;

  IF v_is_blocked THEN
    RETURN NEW;
  END IF;

  -- Prevent duplicate unread follow notification
  IF NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id = NEW.following_id
      AND type = 'follow'
      AND sender_id = NEW.follower_id
      AND read = false
  ) THEN
    INSERT INTO public.notifications (user_id, sender_id, type, reference_id, metadata)
    VALUES (
      NEW.following_id,
      NEW.follower_id,
      'follow',
      NEW.follower_id,
      jsonb_build_object('follower_id', NEW.follower_id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_after_follow_insert ON public.follows;
CREATE TRIGGER trg_after_follow_insert
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_on_follow();

-- Cleanup follow notification if user unfollows before it was read
CREATE OR REPLACE FUNCTION public.trg_cleanup_on_unfollow()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE user_id = OLD.following_id
    AND type = 'follow'
    AND sender_id = OLD.follower_id
    AND read = false;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_after_follow_delete ON public.follows;
CREATE TRIGGER trg_after_follow_delete
  AFTER DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.trg_cleanup_on_unfollow();

-- 4. Trigger Function: Notification on Reply
CREATE OR REPLACE FUNCTION public.trg_notify_on_reply()
RETURNS TRIGGER AS $$
DECLARE
  v_dynamo_author_id UUID;
  v_is_blocked BOOLEAN;
BEGIN
  -- Get author of target dynamo
  SELECT user_id INTO v_dynamo_author_id
  FROM public.dynamos
  WHERE id = NEW.dynamo_id;

  -- Do not notify if replying to own dynamo
  IF v_dynamo_author_id IS NULL OR v_dynamo_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Check if blocked in either direction
  SELECT EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = NEW.user_id AND blocked_id = v_dynamo_author_id)
       OR (blocker_id = v_dynamo_author_id AND blocked_id = NEW.user_id)
  ) INTO v_is_blocked;

  IF v_is_blocked THEN
    RETURN NEW;
  END IF;

  -- Insert reply notification
  INSERT INTO public.notifications (user_id, sender_id, type, reference_id, metadata)
  VALUES (
    v_dynamo_author_id,
    NEW.user_id,
    'reply',
    NEW.dynamo_id,
    jsonb_build_object('dynamo_id', NEW.dynamo_id, 'reply_id', NEW.id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_after_reply_insert ON public.replies;
CREATE TRIGGER trg_after_reply_insert
  AFTER INSERT ON public.replies
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_on_reply();

-- 5. Function to check and generate "About to expire" notification for own dynamos
-- Rules:
-- - Remaining lifespan < 2 hours (and > 0)
-- - Status = 'active'
-- - Only 1 expiring notification per dynamo (prevent duplicates)
CREATE OR REPLACE FUNCTION public.check_expiring_dynamos_for_user()
RETURNS INT AS $$
DECLARE
  v_user_id UUID;
  v_count INT := 0;
  r RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT id, expires_at
    FROM public.dynamos
    WHERE user_id = v_user_id
      AND status = 'active'
      AND expires_at > timezone('utc'::text, now())
      AND expires_at <= timezone('utc'::text, now()) + interval '2 hours'
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications
        WHERE user_id = v_user_id
          AND type = 'expiring'
          AND reference_id = dynamos.id
      )
  LOOP
    INSERT INTO public.notifications (user_id, type, reference_id, metadata)
    VALUES (
      v_user_id,
      'expiring',
      r.id,
      jsonb_build_object('dynamo_id', r.id, 'expires_at', r.expires_at)
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
