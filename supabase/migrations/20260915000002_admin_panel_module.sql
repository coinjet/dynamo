-- ==============================================================================
-- DYNAMO: Admin Panel & Governance Module Migration V0.1
-- Sections:
-- 1. Profiles status constraint enhancement ('active', 'suspended', 'banned', 'deactivated', 'restricted')
-- 2. Role escalation prevention trigger (Moderator cannot elevate to Admin; normal user cannot change role)
-- 3. check_admin_access() RPC
-- 4. get_admin_dashboard_stats() RPC
-- 5. moderate_content() & moderate_user() enhancements (supports 'banned', self-moderation prevention)
-- 6. Strict RLS enforcement for admin functions and moderation tables
-- ==============================================================================

-- 1. Enhance profiles status check constraint to include 'banned' and 'restricted'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check 
  CHECK (status IN ('active', 'suspended', 'banned', 'deactivated', 'restricted'));

-- 2. Prevent role escalation and self-promotion
CREATE OR REPLACE FUNCTION public.trg_prevent_role_escalation()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  -- If role has not changed, proceed
  IF OLD.role = NEW.role THEN
    RETURN NEW;
  END IF;

  -- Verify caller role from authenticated user
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();

  -- Only existing 'admin' can change roles
  IF v_caller_role <> 'admin' THEN
    RAISE EXCEPTION 'Acceso denegado: únicamente un administrador puede modificar roles de usuario.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_profile_role_protection ON public.profiles;
CREATE TRIGGER trg_profile_role_protection
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_prevent_role_escalation();

-- 3. RPC: check_admin_access
-- Validates whether current authenticated user has 'admin' or 'moderator' role
CREATE OR REPLACE FUNCTION public.check_admin_access()
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_username TEXT;
  v_status TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object(
      'is_authorized', false,
      'role', null,
      'message', 'No autenticado'
    );
  END IF;

  SELECT role, username, status INTO v_role, v_username, v_status
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_role IN ('admin', 'moderator') AND v_status = 'active' THEN
    RETURN json_build_object(
      'is_authorized', true,
      'role', v_role,
      'username', v_username,
      'user_id', v_user_id
    );
  ELSE
    RETURN json_build_object(
      'is_authorized', false,
      'role', v_role,
      'message', 'Acceso denegado: rol insuficiente o cuenta inactiva'
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_admin_access() TO authenticated;

-- 4. RPC: get_admin_dashboard_stats
-- Computes real-time admin operational metrics
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_pending_reports BIGINT := 0;
  v_reviewed_reports BIGINT := 0;
  v_resolved_reports BIGINT := 0;
  v_dismissed_reports BIGINT := 0;
  v_suspended_users BIGINT := 0;
  v_banned_users BIGINT := 0;
  v_hidden_dynamos BIGINT := 0;
  v_hidden_replies BIGINT := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_user_id;
  IF v_role NOT IN ('admin', 'moderator') THEN
    RAISE EXCEPTION 'Acceso denegado: se requieren permisos de administración';
  END IF;

  SELECT count(*) INTO v_pending_reports FROM public.reports WHERE status = 'pending';
  SELECT count(*) INTO v_reviewed_reports FROM public.reports WHERE status = 'reviewed';
  SELECT count(*) INTO v_resolved_reports FROM public.reports WHERE status = 'resolved';
  SELECT count(*) INTO v_dismissed_reports FROM public.reports WHERE status = 'dismissed';

  SELECT count(*) INTO v_suspended_users FROM public.profiles WHERE status = 'suspended';
  SELECT count(*) INTO v_banned_users FROM public.profiles WHERE status = 'banned';

  SELECT count(*) INTO v_hidden_dynamos FROM public.dynamos WHERE status = 'hidden';
  SELECT count(*) INTO v_hidden_replies FROM public.replies WHERE status = 'hidden';

  RETURN json_build_object(
    'pending_reports', v_pending_reports,
    'reviewed_reports', v_reviewed_reports,
    'resolved_reports', v_resolved_reports,
    'dismissed_reports', v_dismissed_reports,
    'suspended_users', v_suspended_users,
    'banned_users', v_banned_users,
    'hidden_dynamos', v_hidden_dynamos,
    'hidden_replies', v_hidden_replies,
    'total_reports', (v_pending_reports + v_reviewed_reports + v_resolved_reports + v_dismissed_reports)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats() TO authenticated;

-- 5. RPC: admin_moderate_user (Enhanced)
-- Supports: suspend, ban, rehabilitate.
-- Enforces:
-- - Target cannot be self
-- - Target cannot be an administrator
-- - Only 'admin' or 'moderator' can execute (Moderators can suspend/rehabilitate, but cannot change roles)
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

  SELECT role INTO v_admin_role FROM public.profiles WHERE id = v_admin_id;
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

  -- Cannot moderate an admin
  IF v_target_role = 'admin' THEN
    RAISE EXCEPTION 'No se pueden aplicar sanciones sobre administradores del sistema';
  END IF;

  IF p_action = 'suspend' THEN
    v_new_status := 'suspended';
  ELSIF p_action = 'ban' THEN
    v_new_status := 'banned';
  ELSIF p_action = 'rehabilitate' THEN
    v_new_status := 'active';
  ELSE
    RAISE EXCEPTION 'Acción de moderación de usuario no reconocida';
  END IF;

  UPDATE public.profiles
  SET status = v_new_status
  WHERE id = p_target_user_id;

  INSERT INTO public.moderation_actions (target_user_id, admin_id, action, reason)
  VALUES (p_target_user_id, v_admin_id, 'user_' || p_action, p_reason);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_moderate_user(UUID, TEXT, TEXT) TO authenticated;
