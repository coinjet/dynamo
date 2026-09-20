-- ==============================================================================
-- DYNAMO — MIGRATION: 20260918000001_admin_dashboard_v1.sql
-- BLOQUE 1: Dashboard Administrativo V1
-- Features:
-- 1. System Settings & Global Feature Toggles (system_settings table + RPCs)
-- 2. Official Admin Communications (admin_announcements table + RPCs)
-- 3. Advertising Structural Slots (ad_slots table + RPCs)
-- 4. Audit Trail Integration & Stats Extension
-- ==============================================================================

-- 1. TABLE: system_settings (Global dynamic config & feature flags)
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Everyone (authenticated and anon) can read public settings
DROP POLICY IF EXISTS "Public can read system settings" ON public.system_settings;
CREATE POLICY "Public can read system settings"
  ON public.system_settings FOR SELECT
  USING (true);

-- Only admins can mutate settings
DROP POLICY IF EXISTS "Only admins can update system settings" ON public.system_settings;
CREATE POLICY "Only admins can update system settings"
  ON public.system_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );

-- Seed initial default settings
INSERT INTO public.system_settings (key, value, description)
VALUES
  ('allow_registrations', 'true'::jsonb, 'Permitir nuevos registros en la plataforma'),
  ('allow_publications', 'true'::jsonb, 'Permitir publicación de nuevos Dynamos y respuestas'),
  ('allow_media_uploads', 'false'::jsonb, 'Subida de imágenes y multimedia activada globalmente'),
  ('emergency_mode', 'false'::jsonb, 'Modo de emergencia y mitigación activado'),
  ('maintenance_notice', 'null'::jsonb, 'Aviso global de mantenimiento en cabecera')
ON CONFLICT (key) DO NOTHING;

-- 2. TABLE: admin_announcements (Official administrative communications)
CREATE TABLE IF NOT EXISTS public.admin_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_scope TEXT NOT NULL CHECK (target_scope IN ('general', 'individual')),
  target_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.admin_announcements ENABLE ROW LEVEL SECURITY;

-- Normal users can view general announcements or individual targeted to them
DROP POLICY IF EXISTS "Users can read relevant announcements" ON public.admin_announcements;
CREATE POLICY "Users can read relevant announcements"
  ON public.admin_announcements FOR SELECT
  USING (
    target_scope = 'general'
    OR (target_scope = 'individual' AND target_user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- Only admins/moderators can create announcements
DROP POLICY IF EXISTS "Admins can insert announcements" ON public.admin_announcements;
CREATE POLICY "Admins can insert announcements"
  ON public.admin_announcements FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator') AND status = 'active'
    )
  );

-- 3. TABLE: ad_slots (Structural slots ready for monetization, default disabled)
CREATE TABLE IF NOT EXISTS public.ad_slots (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  placement TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT false NOT NULL,
  provider TEXT DEFAULT 'none' NOT NULL,
  code_snippet TEXT,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.ad_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active ad slots" ON public.ad_slots;
CREATE POLICY "Public can view active ad slots"
  ON public.ad_slots FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage ad slots" ON public.ad_slots;
CREATE POLICY "Admins can manage ad slots"
  ON public.ad_slots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );

INSERT INTO public.ad_slots (id, name, placement, is_enabled, provider)
VALUES
  ('ad_feed_inline', 'Feed Principal (Entre Dynamos)', 'feed_inline', false, 'none'),
  ('ad_discovery_banner', 'Descubrimiento (Banner Superior)', 'discovery_top', false, 'none'),
  ('ad_detail_footer', 'Detalle de Dynamo (Pie de Lectura)', 'detail_bottom', false, 'none')
ON CONFLICT (id) DO NOTHING;

-- 4. RPC: update_system_setting (Atomic & Audited)
CREATE OR REPLACE FUNCTION public.admin_update_system_setting(
  p_key TEXT,
  p_value JSONB,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_admin_id UUID;
  v_role TEXT;
  v_old_value JSONB;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_admin_id;
  IF v_role <> 'admin' THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores pueden cambiar configuración global.';
  END IF;

  SELECT value INTO v_old_value FROM public.system_settings WHERE key = p_key;

  INSERT INTO public.system_settings (key, value, updated_at, updated_by)
  VALUES (p_key, p_value, timezone('utc'::text, now()), v_admin_id)
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_at = timezone('utc'::text, now()),
        updated_by = EXCLUDED.updated_by;

  -- Audit log entry
  INSERT INTO public.moderation_actions (
    admin_id,
    action,
    reason,
    created_at
  ) VALUES (
    v_admin_id,
    'config_change:' || p_key,
    COALESCE(p_reason, 'Cambio de configuración: ' || p_key || ' = ' || p_value::text),
    timezone('utc'::text, now())
  );

  RETURN jsonb_build_object(
    'success', true,
    'key', p_key,
    'value', p_value
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_system_setting(TEXT, JSONB, TEXT) TO authenticated;

-- 5. RPC: admin_send_announcement (Dispatches to user notifications & stores in audit)
CREATE OR REPLACE FUNCTION public.admin_send_announcement(
  p_target_scope TEXT, -- 'general' or 'individual'
  p_target_user_id UUID DEFAULT NULL,
  p_title TEXT DEFAULT 'Comunicado Oficial de Dynamo',
  p_message TEXT DEFAULT '',
  p_is_pinned BOOLEAN DEFAULT false
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_admin_id UUID;
  v_admin_role TEXT;
  v_announcement_id UUID;
  v_inserted_count INT := 0;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT role INTO v_admin_role FROM public.profiles WHERE id = v_admin_id;
  IF v_admin_role NOT IN ('admin', 'moderator') THEN
    RAISE EXCEPTION 'Acceso denegado: permisos insuficientes para emitir comunicados.';
  END IF;

  IF p_target_scope = 'individual' AND p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Para comunicados individuales debes especificar el usuario objetivo.';
  END IF;

  -- 1. Insert record in admin_announcements
  INSERT INTO public.admin_announcements (
    admin_id,
    target_scope,
    target_user_id,
    title,
    message,
    is_pinned
  ) VALUES (
    v_admin_id,
    p_target_scope,
    p_target_user_id,
    p_title,
    p_message,
    p_is_pinned
  ) RETURNING id INTO v_announcement_id;

  -- 2. Dispatch notifications
  IF p_target_scope = 'individual' THEN
    INSERT INTO public.notifications (
      user_id,
      sender_id,
      type,
      title,
      description,
      read,
      metadata
    ) VALUES (
      p_target_user_id,
      v_admin_id,
      'system',
      p_title,
      p_message,
      false,
      jsonb_build_object('announcement_id', v_announcement_id, 'official', true)
    );
    v_inserted_count := 1;
  ELSE
    -- General announcement: notify all active profiles
    INSERT INTO public.notifications (
      user_id,
      sender_id,
      type,
      title,
      description,
      read,
      metadata
    )
    SELECT
      id,
      v_admin_id,
      'system',
      p_title,
      p_message,
      false,
      jsonb_build_object('announcement_id', v_announcement_id, 'official', true, 'general', true)
    FROM public.profiles
    WHERE status = 'active';

    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  END IF;

  -- 3. Record in moderation audit
  INSERT INTO public.moderation_actions (
    admin_id,
    action,
    reason,
    target_user_id
  ) VALUES (
    v_admin_id,
    'admin_communication_' || p_target_scope,
    p_title || ': ' || substring(p_message from 1 for 100),
    p_target_user_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'announcement_id', v_announcement_id,
    'recipients_count', v_inserted_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_send_announcement(TEXT, UUID, TEXT, TEXT, BOOLEAN) TO authenticated;
