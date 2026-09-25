-- ==============================================================================
-- DYNAMO PRODUCTION HARDENING & UNIFICATION
-- Migration: 20260924000002_production_hardening_and_unification.sql
-- Description:
--   1. Unify multimedia server-side triggers (remove duplicate/orphan functions)
--   2. Safe JSONB allow_images check for storage and dynamo triggers
--   3. Add 'expiring' and 'badge' to public.notifications type constraint (fixing 400 Bad Request)
--   4. Bidirectional block & suspension enforcement in dynamos SELECT RLS
--   5. Realtime publication completeness for dynamos and notifications
--   6. Strict 2-level conversation & notification consolidation
-- ==============================================================================

-- 1. NOTIFICATIONS TYPE CHECK CONSTRAINT FIX
-- Solves: check_expiring_dynamos_for_user failing with 400 Bad Request
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type IN ('gift', 'reply', 'follow', 'system', 'expiring', 'badge'));

-- 2. EXPIRING NOTIFICATIONS FUNCTION HARDENING
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. UNIFY MULTIMEDIA VALIDATION & CLEAN UP ORPHAN FUNCTIONS
-- Drop old/duplicate triggers and functions
DROP TRIGGER IF EXISTS trg_validate_dynamo_media ON public.dynamos;
DROP TRIGGER IF EXISTS trg_enforce_dynamo_media ON public.dynamos;
DROP TRIGGER IF EXISTS trg_enforce_dynamo_media_switch ON public.dynamos;
DROP FUNCTION IF EXISTS public.trg_validate_dynamo_media_upload();
DROP FUNCTION IF EXISTS public.trg_enforce_dynamo_media_switch();

-- Single official trigger function for media enforcement
CREATE OR REPLACE FUNCTION public.trg_enforce_dynamo_media_switch()
RETURNS TRIGGER AS $$
DECLARE
  v_allow_images BOOLEAN;
BEGIN
  IF NEW.image_url IS NOT NULL AND trim(NEW.image_url) <> '' THEN
    SELECT COALESCE(
      value = 'true'::jsonb OR value = '"true"'::jsonb OR (value #>> '{}') = 'true',
      false
    ) INTO v_allow_images
    FROM public.system_settings
    WHERE key = 'allow_images';

    IF v_allow_images IS NOT TRUE THEN
      RAISE EXCEPTION 'La subida de imágenes está temporalmente deshabilitada en la plataforma.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_enforce_dynamo_media_switch
  BEFORE INSERT OR UPDATE OF image_url ON public.dynamos
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enforce_dynamo_media_switch();

-- 4. HARDEN STORAGE SECURITY POLICIES FOR dynamo-media
DROP POLICY IF EXISTS "Authenticated users can upload own dynamo media" ON storage.objects;
CREATE POLICY "Authenticated users can upload own dynamo media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'dynamo-media'
    AND (
      -- Case A: Post image in {user_id}/{filename} (subject to allow_images switch)
      (
        (auth.uid())::text = (storage.foldername(name))[1]
        AND (
          SELECT COALESCE(
            value = 'true'::jsonb OR value = '"true"'::jsonb OR (value #>> '{}') = 'true',
            false
          )
          FROM public.system_settings
          WHERE key = 'allow_images'
        ) = true
      )
      OR
      -- Case B: Personal profile avatar in avatars/{user_id}/{filename}
      (
        (storage.foldername(name))[1] = 'avatars'
        AND (auth.uid())::text = (storage.foldername(name))[2]
      )
    )
  );

DROP POLICY IF EXISTS "Public can view dynamo media" ON storage.objects;
CREATE POLICY "Public can view dynamo media"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'dynamo-media');

DROP POLICY IF EXISTS "Users can update own dynamo media" ON storage.objects;
CREATE POLICY "Users can update own dynamo media"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'dynamo-media'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR (
        (storage.foldername(name))[1] = 'avatars'
        AND (auth.uid())::text = (storage.foldername(name))[2]
      )
    )
  );

DROP POLICY IF EXISTS "Users and admins can delete own dynamo media" ON storage.objects;
CREATE POLICY "Users and admins can delete own dynamo media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'dynamo-media'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR (
        (storage.foldername(name))[1] = 'avatars'
        AND (auth.uid())::text = (storage.foldername(name))[2]
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );

-- 5. HARDEN DYNAMOS SELECT RLS (Enforce active, unexpired, non-suspended author, and bidirectional blocks)
DROP POLICY IF EXISTS "Active non-expired dynamos are viewable by everyone" ON public.dynamos;
CREATE POLICY "Active non-expired dynamos are viewable by everyone" 
  ON public.dynamos FOR SELECT 
  USING (
    (
      status = 'active'
      AND expires_at > timezone('utc'::text, now())
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = dynamos.user_id AND p.status = 'suspended'
      )
      AND (
        auth.uid() IS NULL OR NOT EXISTS (
          SELECT 1 FROM public.blocks b
          WHERE (b.blocker_id = auth.uid() AND b.blocked_id = dynamos.user_id)
             OR (b.blocker_id = dynamos.user_id AND b.blocked_id = auth.uid())
        )
      )
    )
    OR (auth.uid() = user_id)
  );

-- 6. ENSURE REALTIME REPLICA IDENTITY AND PUBLICATION
ALTER TABLE public.dynamos REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'dynamos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dynamos;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
