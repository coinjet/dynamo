-- Migration: 20260924000001_fix_allow_images_jsonb_cast.sql
-- Description: Fixes PostgreSQL error 22023 / 22P02 on storage.objects upload
-- Root Cause: system_settings.value is JSONB. Casting (value)::boolean fails with
--             ERROR: 22P02: invalid input syntax for type boolean: ""true""
--             when the value is stored as a JSON string with quotes ('"true"'::jsonb).
-- Solution: Normalize value to true::jsonb and rewrite policy to safely compare without fragile casting.

-- 1. Normalize allow_images in system_settings to native JSONB boolean
UPDATE public.system_settings
SET value = 'true'::jsonb,
    updated_at = timezone('utc'::text, now())
WHERE key = 'allow_images';

-- 2. Ensure all other global boolean switches are clean native JSONB booleans
UPDATE public.system_settings
SET value = 'true'::jsonb
WHERE key IN ('allow_registrations', 'allow_publications', 'allow_new_posts')
  AND (value = '"true"'::jsonb OR value #>> '{}' = 'true');

UPDATE public.system_settings
SET value = 'false'::jsonb
WHERE key IN ('emergency_mode', 'maintenance_mode')
  AND (value = '"false"'::jsonb OR value #>> '{}' = 'false');

-- 3. Rewrite storage.objects INSERT policy with safe JSONB comparison
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

-- 4. Rewrite trigger trg_enforce_dynamo_media_switch with safe JSONB comparison
CREATE OR REPLACE FUNCTION public.trg_enforce_dynamo_media_switch()
RETURNS TRIGGER AS $$
DECLARE
  v_allow_images BOOLEAN;
BEGIN
  IF NEW.image_url IS NOT NULL AND NEW.image_url <> '' THEN
    SELECT COALESCE(
      value = 'true'::jsonb OR value = '"true"'::jsonb OR (value #>> '{}') = 'true',
      false
    ) INTO v_allow_images
    FROM public.system_settings
    WHERE key = 'allow_images';
    
    IF v_allow_images IS NOT TRUE THEN
      RAISE EXCEPTION 'Subida de imágenes deshabilitada globalmente por administración.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
