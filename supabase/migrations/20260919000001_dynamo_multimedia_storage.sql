-- ==============================================================================
-- DYNAMO V1: MULTIMEDIA & STORAGE SECURITY POLICIES
-- ==============================================================================

-- 1. Add image_url column to dynamos table
ALTER TABLE public.dynamos 
ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;

-- 2. Server-side trigger to strictly enforce allow_images global switch upon insertion
CREATE OR REPLACE FUNCTION public.trg_validate_dynamo_media_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_allow_images BOOLEAN;
BEGIN
  IF NEW.image_url IS NOT NULL AND trim(NEW.image_url) <> '' THEN
    SELECT COALESCE((value)::boolean, false) INTO v_allow_images
    FROM public.system_settings
    WHERE key = 'allow_images';

    IF v_allow_images IS NOT TRUE THEN
      RAISE EXCEPTION 'Las imágenes están temporalmente desactivadas en la plataforma.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_dynamo_media ON public.dynamos;
CREATE TRIGGER trg_validate_dynamo_media
  BEFORE INSERT OR UPDATE ON public.dynamos
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_validate_dynamo_media_upload();

-- 3. Provision 'dynamo-media' storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dynamo-media',
  'dynamo-media',
  true,
  5242880, -- 5 MB strict limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']::text[];

-- 4. Enable Row Level Security on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 5. Storage Access Policies
-- A. Public read access for dynamo media
DROP POLICY IF EXISTS "Public can view dynamo media" ON storage.objects;
CREATE POLICY "Public can view dynamo media"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'dynamo-media');

-- B. Authenticated users can upload only into their own folder AND only if allow_images = true
DROP POLICY IF EXISTS "Authenticated users can upload own dynamo media" ON storage.objects;
CREATE POLICY "Authenticated users can upload own dynamo media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'dynamo-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND (
      SELECT COALESCE((value)::boolean, false)
      FROM public.system_settings
      WHERE key = 'allow_images'
    ) = true
  );

-- C. Users can update only their own files
DROP POLICY IF EXISTS "Users can update own dynamo media" ON storage.objects;
CREATE POLICY "Users can update own dynamo media"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'dynamo-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- D. Users can delete only their own files, or admins can delete any file in moderation
DROP POLICY IF EXISTS "Users and admins can delete own dynamo media" ON storage.objects;
CREATE POLICY "Users and admins can delete own dynamo media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'dynamo-media'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );
