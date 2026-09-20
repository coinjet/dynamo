-- ==============================================================================
-- DYNAMO ADMIN V1.1: ENHANCED GLOBAL SWITCHES & REAL-TIME AUDITED CONFIGURATION
-- ==============================================================================

-- 1. Ensure all required global switches exist in system_settings
INSERT INTO public.system_settings (key, value, updated_at, updated_by)
VALUES
  ('allow_new_registrations', 'true'::jsonb, timezone('utc'::text, now()), NULL),
  ('allow_new_posts', 'true'::jsonb, timezone('utc'::text, now()), NULL),
  ('allow_new_replies', 'true'::jsonb, timezone('utc'::text, now()), NULL),
  ('allow_images', 'false'::jsonb, timezone('utc'::text, now()), NULL),
  ('allow_dynamos', 'true'::jsonb, timezone('utc'::text, now()), NULL),
  ('allow_notifications', 'true'::jsonb, timezone('utc'::text, now()), NULL),
  ('allow_sponsorships', 'false'::jsonb, timezone('utc'::text, now()), NULL),
  ('allow_advertising', 'false'::jsonb, timezone('utc'::text, now()), NULL),
  ('maintenance_mode', 'false'::jsonb, timezone('utc'::text, now()), NULL),
  ('emergency_mode', 'false'::jsonb, timezone('utc'::text, now()), NULL),
  ('maintenance_notice', 'null'::jsonb, timezone('utc'::text, now()), NULL)
ON CONFLICT (key) DO NOTHING;

-- 2. Enhanced admin_update_system_setting to strictly require a non-empty reason
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
  v_clean_reason TEXT;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado: se requiere sesión activa.';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_admin_id;
  IF v_role <> 'admin' THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores pueden modificar parámetros del sistema.';
  END IF;

  v_clean_reason := trim(COALESCE(p_reason, ''));
  IF length(v_clean_reason) < 3 THEN
    RAISE EXCEPTION 'Es obligatorio registrar un motivo de auditoría válido (mínimo 3 caracteres).';
  END IF;

  -- Upsert configuration
  INSERT INTO public.system_settings (key, value, updated_at, updated_by)
  VALUES (p_key, p_value, timezone('utc'::text, now()), v_admin_id)
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_at = timezone('utc'::text, now()),
        updated_by = EXCLUDED.updated_by;

  -- Mandatory immutable audit entry in moderation_actions
  INSERT INTO public.moderation_actions (
    admin_id,
    action,
    reason,
    created_at
  ) VALUES (
    v_admin_id,
    'config_change:' || p_key,
    v_clean_reason,
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
