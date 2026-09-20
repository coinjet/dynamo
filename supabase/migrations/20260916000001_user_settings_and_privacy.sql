-- ==============================================================================
-- DYNAMO: User Settings, Privacy & Account Safety Module Migration (Módulo 8)
-- Tables:
-- 1. public.user_settings: Preferences for privacy and notifications per user
-- 2. RLS: Strict security policies ensuring users can only read/update their own settings
-- 3. Trigger: Auto updated_at and lock system notifications to true
-- 4. RPC: delete_own_account() - Secure server-side account deletion and anonymization
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Privacy preferences
  allow_followers TEXT NOT NULL DEFAULT 'everyone' CHECK (allow_followers IN ('everyone', 'nobody')),
  profile_visibility TEXT NOT NULL DEFAULT 'public' CHECK (profile_visibility IN ('public', 'minimal')),
  social_notifications BOOLEAN NOT NULL DEFAULT true,
  -- Notification preferences
  notify_dynamos_received BOOLEAN NOT NULL DEFAULT true,
  notify_replies BOOLEAN NOT NULL DEFAULT true,
  notify_new_followers BOOLEAN NOT NULL DEFAULT true,
  notify_expiring BOOLEAN NOT NULL DEFAULT true,
  notify_badges BOOLEAN NOT NULL DEFAULT true,
  notify_system BOOLEAN NOT NULL DEFAULT true, -- always true, cannot be disabled
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- 1. SELECT: Users can only read their own settings
DROP POLICY IF EXISTS "Users can read own settings" ON public.user_settings;
CREATE POLICY "Users can read own settings"
  ON public.user_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. INSERT: Users can only insert their own settings
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
CREATE POLICY "Users can insert own settings"
  ON public.user_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. UPDATE: Users can only update their own settings
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Users can update own settings"
  ON public.user_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. DELETE: Users can only delete their own settings (or via cascade)
DROP POLICY IF EXISTS "Users can delete own settings" ON public.user_settings;
CREATE POLICY "Users can delete own settings"
  ON public.user_settings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Trigger: auto-update updated_at and lock notify_system
CREATE OR REPLACE FUNCTION public.handle_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  -- Critical system notices cannot be turned off
  NEW.notify_system = true;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER tr_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_settings_updated_at();

-- Auto-provision user_settings row when a profile is created
CREATE OR REPLACE FUNCTION public.handle_new_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_on_profile_created_settings ON public.profiles;
CREATE TRIGGER tr_on_profile_created_settings
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_settings();

-- ==============================================================================
-- SECURE SERVER FUNCTION: delete_own_account
-- Deletes or deactivates the caller's account, cleans up sessions & relationships,
-- and anonymizes public activity while preserving financial ledger and audit logs.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.delete_own_account(p_confirmation TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_profile RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado.');
  END IF;

  IF p_confirmation IS NULL OR lower(trim(p_confirmation)) NOT IN ('eliminar mi cuenta', 'eliminar') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Confirmación de eliminación inválida. Debes escribir "ELIMINAR".');
  END IF;

  -- Verify profile exists
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Perfil no encontrado.');
  END IF;

  -- 1. Anonymize profile data to prevent ghost data or impersonation
  UPDATE public.profiles
  SET 
    username = 'usuario_eliminado_' || substr(v_user_id::text, 1, 8),
    bio = 'Cuenta eliminada por el usuario.',
    avatar = '',
    status = 'deactivated'
  WHERE id = v_user_id;

  -- 2. Clear relationships (follows)
  DELETE FROM public.follows WHERE follower_id = v_user_id OR following_id = v_user_id;

  -- 3. Clear blocks and mutes
  DELETE FROM public.blocks WHERE blocker_id = v_user_id OR blocked_id = v_user_id;
  DELETE FROM public.mutes WHERE muter_id = v_user_id OR muted_id = v_user_id;

  -- 4. Expire active dynamos
  UPDATE public.dynamos
  SET expires_at = now() - INTERVAL '1 second'
  WHERE user_id = v_user_id AND expires_at > now();

  -- 5. Remove notifications
  DELETE FROM public.notifications WHERE user_id = v_user_id OR sender_id = v_user_id;

  -- 6. Remove user settings
  DELETE FROM public.user_settings WHERE user_id = v_user_id;

  -- 7. Audit log in moderation_actions (actor_id = v_user_id, target = v_user_id)
  INSERT INTO public.moderation_actions (
    target_user_id,
    admin_id,
    action,
    reason
  ) VALUES (
    v_user_id,
    v_user_id,
    'user_self_deleted',
    'Cuenta desactivada y eliminada por solicitud expresa del usuario.'
  );

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Tu cuenta ha sido eliminada y desactivada correctamente.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_own_account(TEXT) TO authenticated;
