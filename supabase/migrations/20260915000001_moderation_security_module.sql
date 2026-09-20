-- ==============================================================================
-- DYNAMO: Content Moderation and Security Migration V0.1
-- Sections:
-- 1. Reports schema enhancement (Dynamo and Reply targets, duplicate protection)
-- 2. Replies status enhancement (active, hidden, deleted)
-- 3. Secure moderation procedures (submit_content_report, moderate_content, moderate_user)
-- 4. Reinforced RLS policies for reports and moderation actions
-- ==============================================================================

-- 1. Add status to replies if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'replies' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.replies 
      ADD COLUMN status TEXT DEFAULT 'active' NOT NULL 
      CHECK (status IN ('active', 'hidden', 'deleted'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_replies_dynamo_status 
  ON public.replies(dynamo_id, status) 
  WHERE status = 'active';

-- 2. Enhance reports table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'reports' AND column_name = 'reply_id'
  ) THEN
    ALTER TABLE public.reports 
      ADD COLUMN reply_id UUID REFERENCES public.replies(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Update status constraint on reports to match V0.1 specification (pending, reviewed, resolved, dismissed)
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_status_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_status_check 
  CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed', 'actioned'));

-- Ensure unique report per user per dynamo to prevent duplicate spam
CREATE UNIQUE INDEX IF NOT EXISTS uq_reports_user_dynamo 
  ON public.reports(reporter_id, dynamo_id) 
  WHERE dynamo_id IS NOT NULL;

-- Ensure unique report per user per reply to prevent duplicate spam
CREATE UNIQUE INDEX IF NOT EXISTS uq_reports_user_reply 
  ON public.reports(reporter_id, reply_id) 
  WHERE reply_id IS NOT NULL;

-- 3. Enhance moderation_actions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'moderation_actions' AND column_name = 'target_reply_id'
  ) THEN
    ALTER TABLE public.moderation_actions 
      ADD COLUMN target_reply_id UUID REFERENCES public.replies(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ==============================================================================
-- SECURE SERVER FUNCTION: submit_content_report
-- Enforces:
-- 1. Must be authenticated.
-- 2. Cannot report own content.
-- 3. Cannot report same content multiple times.
-- 4. Validates existence of content in database.
-- 5. Rate limits reports (max 10 reports per hour per user).
-- 6. Enforces allowed categories and character limit.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.submit_content_report(
  p_dynamo_id UUID DEFAULT NULL,
  p_reply_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT 'other',
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_reporter_id UUID;
  v_author_id UUID;
  v_reports_last_hour INT;
  v_new_report_id UUID;
  v_clean_desc TEXT;
BEGIN
  v_reporter_id := auth.uid();
  IF v_reporter_id IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para reportar contenido';
  END IF;

  -- Validate targets
  IF p_dynamo_id IS NULL AND p_reply_id IS NULL THEN
    RAISE EXCEPTION 'Debes especificar una publicación o respuesta a reportar';
  END IF;

  IF p_dynamo_id IS NOT NULL AND p_reply_id IS NOT NULL THEN
    RAISE EXCEPTION 'No se puede reportar una publicación y una respuesta simultáneamente';
  END IF;

  -- Validate reason category
  IF p_reason NOT IN (
    'harassment', 'violence', 'doxxing', 'sexual', 
    'spam', 'fraud', 'impersonation', 'hate_speech', 'other'
  ) THEN
    RAISE EXCEPTION 'Categoría de reporte inválida';
  END IF;

  -- Rate limit check (anti-abuse)
  SELECT count(*) INTO v_reports_last_hour
  FROM public.reports
  WHERE reporter_id = v_reporter_id
    AND created_at > (timezone('utc'::text, now()) - interval '1 hour');

  IF v_reports_last_hour >= 10 THEN
    RAISE EXCEPTION 'Has alcanzado el límite temporal de reportes (máximo 10 por hora). Inténtalo más tarde.';
  END IF;

  -- Clean and truncate description
  v_clean_desc := NULL;
  IF p_description IS NOT NULL AND trim(p_description) <> '' THEN
    v_clean_desc := substring(trim(p_description) from 1 for 300);
  END IF;

  -- 1. Dynamo Target Validation
  IF p_dynamo_id IS NOT NULL THEN
    SELECT user_id INTO v_author_id FROM public.dynamos WHERE id = p_dynamo_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'La publicación que intentas reportar no existe';
    END IF;

    IF v_author_id = v_reporter_id THEN
      RAISE EXCEPTION 'No puedes reportar tu propio contenido';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.reports 
      WHERE reporter_id = v_reporter_id AND dynamo_id = p_dynamo_id
    ) THEN
      RAISE EXCEPTION 'Ya has reportado esta publicación previamente';
    END IF;

    INSERT INTO public.reports (reporter_id, dynamo_id, reason, description, status)
    VALUES (v_reporter_id, p_dynamo_id, p_reason, v_clean_desc, 'pending')
    RETURNING id INTO v_new_report_id;

  -- 2. Reply Target Validation
  ELSE
    SELECT user_id INTO v_author_id FROM public.replies WHERE id = p_reply_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'La respuesta que intentas reportar no existe';
    END IF;

    IF v_author_id = v_reporter_id THEN
      RAISE EXCEPTION 'No puedes reportar tu propia respuesta';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.reports 
      WHERE reporter_id = v_reporter_id AND reply_id = p_reply_id
    ) THEN
      RAISE EXCEPTION 'Ya has reportado esta respuesta previamente';
    END IF;

    INSERT INTO public.reports (reporter_id, reply_id, reason, description, status)
    VALUES (v_reporter_id, p_reply_id, p_reason, v_clean_desc, 'pending')
    RETURNING id INTO v_new_report_id;
  END IF;

  RETURN v_new_report_id;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.submit_content_report(UUID, UUID, TEXT, TEXT) TO authenticated;

-- ==============================================================================
-- SECURE SERVER FUNCTION: moderate_content
-- Allows authorized admin/moderator to:
-- - Update report status (pending / reviewed / resolved / dismissed)
-- - Hide / restore content (Dynamo or Reply)
-- - Record moderation audit log
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.moderate_content(
  p_report_id UUID,
  p_new_report_status TEXT,
  p_content_action TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_admin_id UUID;
  v_admin_role TEXT;
  v_report RECORD;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- Check admin/moderator role
  SELECT role INTO v_admin_role FROM public.profiles WHERE id = v_admin_id;
  IF v_admin_role NOT IN ('admin', 'moderator') THEN
    RAISE EXCEPTION 'Acceso denegado: se requieren permisos administrativos para moderar';
  END IF;

  -- Fetch report
  SELECT * INTO v_report FROM public.reports WHERE id = p_report_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reporte no encontrado';
  END IF;

  -- Update report status
  IF p_new_report_status IN ('pending', 'reviewed', 'resolved', 'dismissed', 'actioned') THEN
    UPDATE public.reports
    SET status = p_new_report_status
    WHERE id = p_report_id;
  END IF;

  -- Content action if requested
  IF p_content_action = 'hide_dynamo' AND v_report.dynamo_id IS NOT NULL THEN
    UPDATE public.dynamos SET status = 'hidden' WHERE id = v_report.dynamo_id;
    INSERT INTO public.moderation_actions (target_dynamo_id, admin_id, action, reason)
    VALUES (v_report.dynamo_id, v_admin_id, 'hide_dynamo', p_reason);

  ELSIF p_content_action = 'restore_dynamo' AND v_report.dynamo_id IS NOT NULL THEN
    UPDATE public.dynamos SET status = 'active' WHERE id = v_report.dynamo_id;
    INSERT INTO public.moderation_actions (target_dynamo_id, admin_id, action, reason)
    VALUES (v_report.dynamo_id, v_admin_id, 'restore_dynamo', p_reason);

  ELSIF p_content_action = 'hide_reply' AND v_report.reply_id IS NOT NULL THEN
    UPDATE public.replies SET status = 'hidden' WHERE id = v_report.reply_id;
    INSERT INTO public.moderation_actions (target_reply_id, admin_id, action, reason)
    VALUES (v_report.reply_id, v_admin_id, 'hide_reply', p_reason);

  ELSIF p_content_action = 'restore_reply' AND v_report.reply_id IS NOT NULL THEN
    UPDATE public.replies SET status = 'active' WHERE id = v_report.reply_id;
    INSERT INTO public.moderation_actions (target_reply_id, admin_id, action, reason)
    VALUES (v_report.reply_id, v_admin_id, 'restore_reply', p_reason);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.moderate_content(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ==============================================================================
-- SECURE SERVER FUNCTION: moderate_user
-- Allows admin to restrict, suspend, or restore a user profile.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.moderate_user(
  p_target_user_id UUID,
  p_new_status TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_admin_id UUID;
  v_admin_role TEXT;
  v_target_role TEXT;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT role INTO v_admin_role FROM public.profiles WHERE id = v_admin_id;
  IF v_admin_role <> 'admin' THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores pueden restringir o suspender usuarios';
  END IF;

  -- Cannot moderate self or other admins
  SELECT role INTO v_target_role FROM public.profiles WHERE id = p_target_user_id;
  IF v_target_role = 'admin' THEN
    RAISE EXCEPTION 'No se puede sancionar a un administrador del sistema';
  END IF;

  IF p_new_status NOT IN ('active', 'restricted', 'suspended') THEN
    RAISE EXCEPTION 'Estado de usuario inválido';
  END IF;

  UPDATE public.profiles
  SET status = p_new_status
  WHERE id = p_target_user_id;

  INSERT INTO public.moderation_actions (target_user_id, admin_id, action, reason)
  VALUES (p_target_user_id, v_admin_id, 'user_status_' || p_new_status, p_reason);
END;
$$;

GRANT EXECUTE ON FUNCTION public.moderate_user(UUID, TEXT, TEXT) TO authenticated;
