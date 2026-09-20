-- ==============================================================================
-- DYNAMO — MIGRATION: 20260916000002_qa_audit_security_fixes.sql
-- Resolution of QA Audit Findings: SEC-01, SEC-02, SEC-04
-- ==============================================================================

-- 1. SEC-01: Allow authenticated users to transition their own profile to 'deactivated'
-- and support internal server context 'dynamo.allow_account_deletion'
CREATE OR REPLACE FUNCTION public.trg_protect_profile_integrity()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent changing user ID
  IF NEW.id <> OLD.id THEN
    RAISE EXCEPTION 'No se permite modificar el ID del usuario.';
  END IF;

  -- Prevent changing creation timestamp
  IF NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'No se permite modificar la fecha de registro.';
  END IF;

  -- Prevent non-admins from changing role
  IF NEW.role <> OLD.role THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'No tienes permisos para modificar roles.';
    END IF;
  END IF;

  -- Prevent unauthorized status changes:
  -- Allowed ONLY IF:
  -- 1) Caller is an admin
  -- 2) It is executed within an authorized server routine (dynamo.allow_account_deletion = 'true')
  -- 3) The authenticated user is deactivating their own account (NEW.id = auth.uid() AND NEW.status = 'deactivated')
  IF NEW.status <> OLD.status THEN
    IF NOT (
      (auth.uid() = OLD.id AND NEW.status = 'deactivated') OR
      current_setting('dynamo.allow_account_deletion', true) = 'true' OR
      EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
      )
    ) THEN
      RAISE EXCEPTION 'No tienes permisos para modificar el estado de la cuenta.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. SEC-01: Update delete_own_account to set bypass context and generate safe <= 20 char username
CREATE OR REPLACE FUNCTION public.delete_own_account(p_confirmation TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_profile RECORD;
  v_clean_id TEXT;
  v_base_username TEXT;
  v_anon_username TEXT;
  v_counter INT := 0;
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

  -- Enable bypass settings locally for this transaction
  PERFORM set_config('dynamo.allow_account_deletion', 'true', true);
  PERFORM set_config('dynamo.allow_expiration_update', 'true', true);

  -- Generate unique anonymous username strictly satisfying:
  -- char_length(username) >= 3 AND char_length(username) <= 20
  -- regex ^[a-zA-Z0-9_]+$
  v_clean_id := replace(v_user_id::text, '-', '');
  v_base_username := 'del_' || substr(v_clean_id, 1, 10);
  v_anon_username := v_base_username;

  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = v_anon_username AND id <> v_user_id) LOOP
    v_counter := v_counter + 1;
    v_anon_username := 'del_' || substr(v_clean_id, 1, 8) || '_' || v_counter::text;
    IF v_counter > 50 THEN
      v_anon_username := 'del_' || substr(md5(random()::text), 1, 10);
    END IF;
  END LOOP;

  -- 1. Anonymize profile data
  UPDATE public.profiles
  SET 
    username = v_anon_username,
    bio = 'Cuenta eliminada por el usuario.',
    avatar = '',
    status = 'deactivated'
  WHERE id = v_user_id;

  -- 2. Clear relationships (follows)
  DELETE FROM public.follows WHERE follower_id = v_user_id OR following_id = v_user_id;

  -- 3. Clear blocks and mutes
  DELETE FROM public.blocks WHERE blocker_id = v_user_id OR blocked_id = v_user_id;
  DELETE FROM public.mutes WHERE muter_id = v_user_id OR muted_id = v_user_id;

  -- 4. Expire active dynamos safely
  UPDATE public.dynamos
  SET expires_at = now() - INTERVAL '1 second'
  WHERE user_id = v_user_id AND expires_at > now();

  -- 5. Remove notifications
  DELETE FROM public.notifications WHERE user_id = v_user_id OR sender_id = v_user_id;

  -- 6. Remove user settings
  DELETE FROM public.user_settings WHERE user_id = v_user_id;

  -- 7. Audit log in moderation_actions (audit trail preserved)
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

-- 3. SEC-02: Secure RPC to check public follow permissions without exposing private settings
CREATE OR REPLACE FUNCTION public.get_user_follow_permissions(p_target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_target_profile RECORD;
  v_settings RECORD;
  v_is_blocked BOOLEAN;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object(
      'can_follow', false,
      'error', 'No autenticado.',
      'allow_followers', 'nobody',
      'profile_visibility', 'private'
    );
  END IF;

  IF p_target_user_id IS NULL OR p_target_user_id = v_caller_id THEN
    RETURN jsonb_build_object(
      'can_follow', false,
      'error', 'No puedes seguirte a ti mismo.',
      'allow_followers', 'nobody',
      'profile_visibility', 'public'
    );
  END IF;

  -- Check if target profile exists and is active
  SELECT id, status INTO v_target_profile
  FROM public.profiles
  WHERE id = p_target_user_id;

  IF NOT FOUND OR v_target_profile.status <> 'active' THEN
    RETURN jsonb_build_object(
      'can_follow', false,
      'error', 'El usuario no existe o su cuenta no está activa.',
      'allow_followers', 'nobody',
      'profile_visibility', 'private'
    );
  END IF;

  -- Check bidirectional blocks between caller and target
  SELECT EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = v_caller_id AND blocked_id = p_target_user_id)
       OR (blocker_id = p_target_user_id AND blocked_id = v_caller_id)
  ) INTO v_is_blocked;

  IF v_is_blocked THEN
    RETURN jsonb_build_object(
      'can_follow', false,
      'error', 'Existe un bloqueo entre ambos usuarios.',
      'allow_followers', 'nobody',
      'profile_visibility', 'private'
    );
  END IF;

  -- Retrieve target user's follow settings
  SELECT allow_followers, profile_visibility INTO v_settings
  FROM public.user_settings
  WHERE user_id = p_target_user_id;

  IF NOT FOUND THEN
    -- Default settings allow everyone to follow
    RETURN jsonb_build_object(
      'can_follow', true,
      'allow_followers', 'everyone',
      'profile_visibility', 'public'
    );
  END IF;

  IF v_settings.allow_followers = 'nobody' THEN
    RETURN jsonb_build_object(
      'can_follow', false,
      'error', 'Este usuario tiene configurado no recibir nuevos seguidores.',
      'allow_followers', v_settings.allow_followers,
      'profile_visibility', v_settings.profile_visibility
    );
  END IF;

  RETURN jsonb_build_object(
    'can_follow', true,
    'allow_followers', v_settings.allow_followers,
    'profile_visibility', v_settings.profile_visibility
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_follow_permissions(UUID) TO authenticated;

-- 4. SEC-04: Enforce bidirectional block checks directly in PostgreSQL RLS policies
-- 4.1 Follows policy hardening
DROP POLICY IF EXISTS "Users can create their own follows" ON public.follows;
CREATE POLICY "Users can create their own follows" 
  ON public.follows FOR INSERT 
  WITH CHECK (
    auth.uid() = follower_id AND 
    follower_id <> following_id AND
    NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = following_id)
         OR (b.blocker_id = following_id AND b.blocked_id = auth.uid())
    )
  );

-- 4.2 Replies policy hardening
DROP POLICY IF EXISTS "Authenticated users can reply to active dynamos" ON public.replies;
CREATE POLICY "Authenticated users can reply to active dynamos" 
  ON public.replies FOR INSERT 
  WITH CHECK (
    auth.uid() = user_id AND 
    EXISTS (
      SELECT 1 FROM public.dynamos d
      WHERE d.id = replies.dynamo_id 
        AND d.status = 'active' 
        AND d.expires_at > timezone('utc'::text, now())
        AND NOT EXISTS (
          SELECT 1 FROM public.blocks b
          WHERE (b.blocker_id = auth.uid() AND b.blocked_id = d.user_id)
             OR (b.blocker_id = d.user_id AND b.blocked_id = auth.uid())
        )
    )
  );
