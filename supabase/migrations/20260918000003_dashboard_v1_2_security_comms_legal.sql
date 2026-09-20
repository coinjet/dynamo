-- ==============================================================================
-- DYNAMO — MIGRATION: 20260918000003_dashboard_v1_2_security_comms_legal.sql
-- BLOQUE 1.2: CIERRE FINAL DASHBOARD V1
--
-- 1. SEGURIDAD:
--    - Moderator NO puede aplicar ban permanente (solo 'admin').
--    - Moderator NO puede modificar roles ni balances ni sancionar a administradores.
--    - Actualización estricta server-side en `admin_moderate_user`, `moderate_user`
--      y `admin_adjust_user_balance`.
--
-- 2. COMUNICACIONES PROGRAMADAS:
--    - Campos: title, message, target_scope, target_user_id, communication_type,
--      status ('scheduled', 'sent', 'cancelled', 'failed'), scheduled_for, sent_at,
--      cancelled_at, cancelled_by.
--    - RPCs: `admin_send_announcement` (soporta enviar ahora o programar) y
--      `admin_cancel_scheduled_announcement`.
--    - Auditoría inmutable de creación, programación, envío y cancelación.
--
-- 3. LEGAL, SOPORTE Y COMUNIDAD:
--    - Tabla `system_legal_content` para las 7 secciones configurables:
--      'about', 'terms', 'privacy', 'community', 'safety', 'support', 'community_info'.
--    - Ajustes para enlaces independientes de Telegram (soporte y comunidad).
--    - RPC `admin_update_legal_content` con auditoría.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SEGURIDAD Y PERMISOS SERVER-SIDE
-- ------------------------------------------------------------------------------

-- Enhanced `admin_moderate_user` RPC with strict server-side moderator restrictions
CREATE OR REPLACE FUNCTION public.admin_moderate_user(
  p_target_user_id UUID,
  p_action TEXT, -- 'suspend', 'ban', 'rehabilitate'
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
  v_new_status TEXT;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT role INTO v_admin_role
  FROM public.profiles
  WHERE id = v_admin_id AND status = 'active';

  IF v_admin_role NOT IN ('admin', 'moderator') THEN
    RAISE EXCEPTION 'Acceso denegado: permisos insuficientes para moderar usuarios';
  END IF;

  -- Cannot moderate self
  IF p_target_user_id = v_admin_id THEN
    RAISE EXCEPTION 'No puedes aplicar sanciones sobre tu propia cuenta de usuario';
  END IF;

  SELECT role INTO v_target_role FROM public.profiles WHERE id = p_target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario objetivo no encontrado';
  END IF;

  -- Sancionar administradores: STRICTLY FORBIDDEN
  IF v_target_role = 'admin' THEN
    RAISE EXCEPTION 'No se pueden aplicar sanciones sobre administradores del sistema';
  END IF;

  -- Moderator restrictions:
  -- 1) Cannot moderate fellow moderators
  IF v_admin_role = 'moderator' AND v_target_role = 'moderator' THEN
    RAISE EXCEPTION 'Acceso denegado: los moderadores no pueden sancionar a otros miembros del equipo';
  END IF;

  -- 2) Moderator CANNOT ban permanently
  IF v_admin_role = 'moderator' AND p_action = 'ban' THEN
    RAISE EXCEPTION 'Acceso denegado: los moderadores no tienen permisos para aplicar ban permanente. Esta acción está reservada exclusivamente a administradores';
  END IF;

  IF p_action = 'suspend' THEN
    v_new_status := 'suspended';
  ELSIF p_action = 'ban' THEN
    IF v_admin_role <> 'admin' THEN
      RAISE EXCEPTION 'Acceso denegado: solo administradores pueden aplicar ban permanente';
    END IF;
    v_new_status := 'banned';
  ELSIF p_action = 'rehabilitate' THEN
    v_new_status := 'active';
  ELSE
    RAISE EXCEPTION 'Acción de moderación de usuario no reconocida (debe ser suspend, ban o rehabilitate)';
  END IF;

  UPDATE public.profiles
  SET status = v_new_status
  WHERE id = p_target_user_id;

  INSERT INTO public.moderation_actions (target_user_id, admin_id, action, reason)
  VALUES (p_target_user_id, v_admin_id, 'user_' || p_action, COALESCE(p_reason, 'Acción: ' || p_action));
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_moderate_user(UUID, TEXT, TEXT) TO authenticated;

-- Enhanced `moderate_user` RPC with strict server-side moderator restrictions
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

  SELECT role INTO v_admin_role
  FROM public.profiles
  WHERE id = v_admin_id AND status = 'active';

  IF v_admin_role NOT IN ('admin', 'moderator') THEN
    RAISE EXCEPTION 'Acceso denegado: permisos insuficientes para moderar usuarios';
  END IF;

  -- Cannot moderate self
  IF p_target_user_id = v_admin_id THEN
    RAISE EXCEPTION 'No puedes aplicar sanciones sobre tu propia cuenta de usuario';
  END IF;

  SELECT role INTO v_target_role FROM public.profiles WHERE id = p_target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario objetivo no encontrado';
  END IF;

  -- Cannot moderate admin
  IF v_target_role = 'admin' THEN
    RAISE EXCEPTION 'No se puede sancionar a un administrador del sistema';
  END IF;

  -- Moderator cannot moderate fellow moderators
  IF v_admin_role = 'moderator' AND v_target_role = 'moderator' THEN
    RAISE EXCEPTION 'Acceso denegado: los moderadores no pueden sancionar a otros moderadores';
  END IF;

  -- Moderator CANNOT apply permanent ban
  IF v_admin_role = 'moderator' AND p_new_status = 'banned' THEN
    RAISE EXCEPTION 'Acceso denegado: los moderadores no tienen permisos para aplicar ban permanente. Esta acción está reservada exclusivamente a administradores';
  END IF;

  IF p_new_status NOT IN ('active', 'restricted', 'suspended', 'banned') THEN
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

-- Strict server-side restriction: Moderator CANNOT adjust user balances (Admin ONLY)
CREATE OR REPLACE FUNCTION public.admin_adjust_user_balance(
  p_target_user_id UUID,
  p_amount INT,
  p_balance_type TEXT,
  p_reason TEXT
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_current_purchased INT := 0;
  v_new_purchased INT := 0;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT role INTO v_caller_role
  FROM public.profiles
  WHERE id = v_caller_id AND status = 'active';

  -- Rule: ONLY admins can modify balances. Moderators are strictly forbidden.
  IF v_caller_role <> 'admin' THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores pueden ajustar saldos de usuarios (moderadores no autorizados)';
  END IF;

  -- Validate reason
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'El motivo del ajuste administrativo es obligatorio (mínimo 3 caracteres)';
  END IF;

  -- Validate balance type
  IF p_balance_type NOT IN ('purchased', 'free') THEN
    RAISE EXCEPTION 'Tipo de saldo inválido. Debe ser "purchased" o "free"';
  END IF;

  -- Target user check
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target_user_id) THEN
    RAISE EXCEPTION 'El usuario objetivo no existe';
  END IF;

  -- Lock user_balances row
  INSERT INTO public.user_balances (user_id, purchased_balance)
  VALUES (p_target_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT purchased_balance INTO v_current_purchased
  FROM public.user_balances
  WHERE user_id = p_target_user_id
  FOR UPDATE;

  IF p_balance_type = 'purchased' THEN
    v_new_purchased := v_current_purchased + p_amount;
    IF v_new_purchased < 0 THEN
      RAISE EXCEPTION 'Operación rechazada: el ajuste resultaría en saldo negativo (% < 0)', v_new_purchased;
    END IF;

    UPDATE public.user_balances
    SET purchased_balance = v_new_purchased,
        updated_at = timezone('utc'::text, now())
    WHERE user_id = p_target_user_id;
  ELSE
    v_new_purchased := v_current_purchased;
  END IF;

  -- Record in immutable ledger
  INSERT INTO public.economy_transactions (
    user_id,
    amount,
    balance_type,
    transaction_type,
    reference_id,
    resulting_free_allowance,
    resulting_purchased_balance,
    description
  ) VALUES (
    p_target_user_id,
    p_amount,
    p_balance_type,
    'admin_adjustment',
    v_caller_id::text,
    0,
    v_new_purchased,
    'Ajuste por admin: ' || p_reason
  );

  -- Record in moderation audit
  INSERT INTO public.moderation_actions (
    target_user_id,
    admin_id,
    action,
    reason
  ) VALUES (
    p_target_user_id,
    v_caller_id,
    'balance_adjustment_' || p_balance_type,
    'Cantidad: ' || p_amount || ' ⚡. Motivo: ' || p_reason
  );

  RETURN jsonb_build_object(
    'success', true,
    'target_user_id', p_target_user_id,
    'adjusted_amount', p_amount,
    'balance_type', p_balance_type,
    'new_purchased_balance', v_new_purchased
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_adjust_user_balance(UUID, INT, TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. COMUNICACIONES PROGRAMADAS
-- ------------------------------------------------------------------------------

-- Add fields to `admin_announcements`
ALTER TABLE public.admin_announcements
  ADD COLUMN IF NOT EXISTS communication_type TEXT NOT NULL DEFAULT 'general'
    CHECK (communication_type IN ('general', 'mantenimiento', 'seguridad', 'comunidad', 'personal')),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('scheduled', 'sent', 'cancelled', 'failed')),
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.profiles(id);

-- Ensure Admins & Moderators can update announcements (e.g. cancellation)
DROP POLICY IF EXISTS "Admins and moderators can update announcements" ON public.admin_announcements;
CREATE POLICY "Admins and moderators can update announcements"
  ON public.admin_announcements FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator') AND status = 'active'
    )
  );

-- RPC: admin_send_announcement (Supports 'Enviar ahora' and 'Programar')
CREATE OR REPLACE FUNCTION public.admin_send_announcement(
  p_target_scope TEXT, -- 'general' or 'individual'
  p_target_user_id UUID DEFAULT NULL,
  p_title TEXT DEFAULT 'Comunicado Oficial de Dynamo',
  p_message TEXT DEFAULT '',
  p_is_pinned BOOLEAN DEFAULT false,
  p_communication_type TEXT DEFAULT 'general',
  p_scheduled_for TIMESTAMPTZ DEFAULT NULL
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
  v_is_future BOOLEAN := false;
  v_status TEXT := 'sent';
  v_sent_at TIMESTAMPTZ := NULL;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT role INTO v_admin_role FROM public.profiles WHERE id = v_admin_id AND status = 'active';
  IF v_admin_role NOT IN ('admin', 'moderator') THEN
    RAISE EXCEPTION 'Acceso denegado: permisos insuficientes para emitir comunicados';
  END IF;

  IF p_target_scope = 'individual' AND p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Para comunicados individuales debes especificar el usuario objetivo';
  END IF;

  IF p_communication_type NOT IN ('general', 'mantenimiento', 'seguridad', 'comunidad', 'personal') THEN
    RAISE EXCEPTION 'Tipo de comunicación inválido';
  END IF;

  -- Determine if scheduled or immediate
  IF p_scheduled_for IS NOT NULL AND p_scheduled_for > timezone('utc'::text, now()) THEN
    v_is_future := true;
    v_status := 'scheduled';
    v_sent_at := NULL;
  ELSE
    v_is_future := false;
    v_status := 'sent';
    v_sent_at := timezone('utc'::text, now());
  END IF;

  -- 1. Insert record in admin_announcements
  INSERT INTO public.admin_announcements (
    admin_id,
    target_scope,
    target_user_id,
    title,
    message,
    is_pinned,
    communication_type,
    status,
    scheduled_for,
    sent_at
  ) VALUES (
    v_admin_id,
    p_target_scope,
    p_target_user_id,
    p_title,
    p_message,
    p_is_pinned,
    p_communication_type,
    v_status,
    p_scheduled_for,
    v_sent_at
  ) RETURNING id INTO v_announcement_id;

  -- 2. Dispatch notifications ONLY if sending NOW
  IF NOT v_is_future THEN
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
        jsonb_build_object(
          'announcement_id', v_announcement_id,
          'official', true,
          'communication_type', p_communication_type
        )
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
        jsonb_build_object(
          'announcement_id', v_announcement_id,
          'official', true,
          'general', true,
          'communication_type', p_communication_type
        )
      FROM public.profiles
      WHERE status = 'active';

      GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
    END IF;

    -- Audit: Immediate dispatch
    INSERT INTO public.moderation_actions (
      admin_id,
      action,
      reason,
      target_user_id
    ) VALUES (
      v_admin_id,
      'communication_sent',
      '[' || p_communication_type || '] ' || p_title || ' (Destinatarios: ' || v_inserted_count || ')',
      p_target_user_id
    );
  ELSE
    -- Audit: Scheduled creation
    INSERT INTO public.moderation_actions (
      admin_id,
      action,
      reason,
      target_user_id
    ) VALUES (
      v_admin_id,
      'communication_scheduled',
      '[' || p_communication_type || '] ' || p_title || ' (Programada para: ' || p_scheduled_for::text || ')',
      p_target_user_id
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'announcement_id', v_announcement_id,
    'status', v_status,
    'scheduled_for', p_scheduled_for,
    'recipients_count', v_inserted_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_send_announcement(TEXT, UUID, TEXT, TEXT, BOOLEAN, TEXT, TIMESTAMPTZ) TO authenticated;

-- RPC: admin_cancel_scheduled_announcement
CREATE OR REPLACE FUNCTION public.admin_cancel_scheduled_announcement(
  p_announcement_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_admin_id UUID;
  v_admin_role TEXT;
  v_current_status TEXT;
  v_title TEXT;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT role INTO v_admin_role FROM public.profiles WHERE id = v_admin_id AND status = 'active';
  IF v_admin_role NOT IN ('admin', 'moderator') THEN
    RAISE EXCEPTION 'Acceso denegado: permisos insuficientes para cancelar comunicados';
  END IF;

  SELECT status, title INTO v_current_status, v_title
  FROM public.admin_announcements
  WHERE id = p_announcement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comunicado no encontrado';
  END IF;

  IF v_current_status <> 'scheduled' THEN
    RAISE EXCEPTION 'Solo se pueden cancelar comunicados en estado programado (scheduled). Estado actual: %', v_current_status;
  END IF;

  UPDATE public.admin_announcements
  SET status = 'cancelled',
      cancelled_at = timezone('utc'::text, now()),
      cancelled_by = v_admin_id
  WHERE id = p_announcement_id;

  -- Audit log entry
  INSERT INTO public.moderation_actions (
    admin_id,
    action,
    reason
  ) VALUES (
    v_admin_id,
    'communication_cancelled',
    COALESCE(p_reason, 'Cancelación de comunicado programado: "' || v_title || '" (ID: ' || p_announcement_id::text || ')')
  );

  RETURN jsonb_build_object(
    'success', true,
    'announcement_id', p_announcement_id,
    'status', 'cancelled'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_cancel_scheduled_announcement(UUID, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. LEGAL / SOPORTE / COMUNIDAD
-- ------------------------------------------------------------------------------

-- TABLE: system_legal_content
-- Configurable content for the 7 standard platform sections
CREATE TABLE IF NOT EXISTS public.system_legal_content (
  id TEXT PRIMARY KEY, -- 'about', 'terms', 'privacy', 'community', 'safety', 'support', 'community_info'
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.system_legal_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read legal content" ON public.system_legal_content;
CREATE POLICY "Public can read legal content"
  ON public.system_legal_content FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage legal content" ON public.system_legal_content;
CREATE POLICY "Admins can manage legal content"
  ON public.system_legal_content FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );

-- Seed rows for the 7 sections with initial empty content so UI displays exactly:
-- "Contenido pendiente de publicación" when empty.
INSERT INTO public.system_legal_content (id, title, content)
VALUES
  ('about', 'Acerca de Dynamo', ''),
  ('terms', 'Términos y Condiciones', ''),
  ('privacy', 'Política de Privacidad', ''),
  ('community', 'Normas de la Comunidad', ''),
  ('safety', 'Seguridad y Protección de Datos', ''),
  ('support', 'Soporte y Asistencia', ''),
  ('community_info', 'Comunidad Oficial', '')
ON CONFLICT (id) DO NOTHING;

-- Seed default Telegram settings in system_settings if not present
INSERT INTO public.system_settings (key, value, description)
VALUES
  ('telegram_support_url', '""'::jsonb, 'Canal/Enlace independiente de Soporte en Telegram (ej: https://t.me/soporte)'),
  ('telegram_community_url', '""'::jsonb, 'Canal/Enlace independiente de Comunidad en Telegram (ej: https://t.me/comunidad)')
ON CONFLICT (key) DO NOTHING;

-- RPC: admin_update_legal_content (Audited mutation for legal documents)
CREATE OR REPLACE FUNCTION public.admin_update_legal_content(
  p_id TEXT,
  p_title TEXT,
  p_content TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_admin_id UUID;
  v_admin_role TEXT;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT role INTO v_admin_role FROM public.profiles WHERE id = v_admin_id AND status = 'active';
  IF v_admin_role <> 'admin' THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores pueden editar contenidos legales y de soporte';
  END IF;

  IF p_id NOT IN ('about', 'terms', 'privacy', 'community', 'safety', 'support', 'community_info') THEN
    RAISE EXCEPTION 'Sección legal no válida: %', p_id;
  END IF;

  INSERT INTO public.system_legal_content (id, title, content, updated_at, updated_by)
  VALUES (p_id, p_title, p_content, timezone('utc'::text, now()), v_admin_id)
  ON CONFLICT (id) DO UPDATE
    SET title = EXCLUDED.title,
        content = EXCLUDED.content,
        updated_at = timezone('utc'::text, now()),
        updated_by = EXCLUDED.updated_by;

  -- Audit log entry
  INSERT INTO public.moderation_actions (
    admin_id,
    action,
    reason
  ) VALUES (
    v_admin_id,
    'legal_content_update:' || p_id,
    COALESCE(p_reason, 'Actualización de sección: ' || p_title)
  );

  RETURN jsonb_build_object(
    'success', true,
    'id', p_id,
    'title', p_title
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_legal_content(TEXT, TEXT, TEXT, TEXT) TO authenticated;
