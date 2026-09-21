-- ==============================================================================
-- DYNAMO V1: POST-AUDIT LAUNCH HARDENING
-- 1. Bio limit expansion to 350 characters
-- 2. Storage security policies for user avatar uploads in avatars/{user_id}/
-- 3. Replies constraint & RLS: block self-replies on server-side
-- 4. Auth trigger idempotency: ON CONFLICT (id) DO NOTHING for profiles
-- ==============================================================================

-- 1. EXPAND BIO CONSTRAINT TO 350 CHARACTERS
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS bio_length;
ALTER TABLE public.profiles ADD CONSTRAINT bio_length CHECK (char_length(bio) <= 350);


-- 2. SECURE STORAGE POLICIES FOR USER AVATARS IN dynamo-media
-- Segregated under: avatars/{user_id}/{filename}

-- INSERT policy: Authenticated users can upload their own post media OR their own avatars
DROP POLICY IF EXISTS "Authenticated users can upload own dynamo media" ON storage.objects;
CREATE POLICY "Authenticated users can upload own dynamo media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'dynamo-media'
    AND (
      -- Case A: Post image in {user_id}/{filename} (subject to allow_images switch)
      (
        auth.uid()::text = (storage.foldername(name))[1]
        AND (
          SELECT COALESCE((value)::boolean, false)
          FROM public.system_settings
          WHERE key = 'allow_images'
        ) = true
      )
      OR
      -- Case B: Personal profile avatar in avatars/{user_id}/{filename}
      (
        (storage.foldername(name))[1] = 'avatars'
        AND auth.uid()::text = (storage.foldername(name))[2]
      )
    )
  );

-- UPDATE policy: Users can update their own post media or avatars
DROP POLICY IF EXISTS "Users can update own dynamo media" ON storage.objects;
CREATE POLICY "Users can update own dynamo media"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'dynamo-media'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR (
        (storage.foldername(name))[1] = 'avatars'
        AND auth.uid()::text = (storage.foldername(name))[2]
      )
    )
  );

-- DELETE policy: Users can delete their own media/avatars; admins can moderate any
DROP POLICY IF EXISTS "Users and admins can delete own dynamo media" ON storage.objects;
CREATE POLICY "Users and admins can delete own dynamo media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'dynamo-media'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR (
        (storage.foldername(name))[1] = 'avatars'
        AND auth.uid()::text = (storage.foldername(name))[2]
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );


-- 3. SERVER-SIDE PREVENTION OF SELF-REPLIES
DROP POLICY IF EXISTS "Authenticated users can reply to active dynamos" ON public.replies;
CREATE POLICY "Authenticated users can reply to active dynamos" 
  ON public.replies FOR INSERT 
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND 
    EXISTS (
      SELECT 1 FROM public.dynamos 
      WHERE id = replies.dynamo_id 
        AND status = 'active' 
        AND expires_at > timezone('utc'::text, now())
        AND user_id <> auth.uid() -- STRICT SERVER-SIDE BLOCK: NO SELF-REPLIES
    )
  );


-- 4. HARDEN HANDLE_NEW_USER TRIGGER (Idempotency and duplicate prevention)
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
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
