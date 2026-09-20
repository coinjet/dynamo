-- ==============================================================================
-- DYNAMO: Initial Database Migration & Architecture V0.1
-- Stack: Supabase / PostgreSQL
-- Security Hardened: Strict RLS, Server-Controlled Expiration, Secure Energy Gifting
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- TABLE: profiles
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  avatar TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  role TEXT DEFAULT 'user' NOT NULL CHECK (role IN ('user', 'moderator', 'admin')),
  status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'suspended', 'deactivated')),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 20),
  CONSTRAINT bio_length CHECK (char_length(bio) <= 140),
  CONSTRAINT username_format CHECK (username ~* '^[a-zA-Z0-9_]+$')
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Server-side validation of reserved usernames
CREATE OR REPLACE FUNCTION public.trg_validate_profile_username()
RETURNS TRIGGER AS $$
BEGIN
  IF lower(NEW.username) IN (
    'admin', 'administrator', 'moderator', 'mod', 'dynamo', 'root', 'system',
    'support', 'help', 'official', 'api', 'bot', 'terms', 'privacy', 'auth',
    'login', 'signup', 'register', 'null', 'undefined', 'anonymous', 'staff',
    'security', 'feed', 'profile', 'explore', 'dev'
  ) THEN
    RAISE EXCEPTION 'El nombre de usuario elegido está reservado por el sistema.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profile_username_check ON public.profiles;
CREATE TRIGGER trg_profile_username_check
  BEFORE INSERT OR UPDATE OF username ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_validate_profile_username();

-- Server-side protection of profile integrity
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

  -- Prevent non-admins from changing role or status
  IF (NEW.role <> OLD.role OR NEW.status <> OLD.status) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'No tienes permisos para modificar roles o estado de cuenta.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profile_integrity_check ON public.profiles;
CREATE TRIGGER trg_profile_integrity_check
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_protect_profile_integrity();

-- ==============================================================================
-- TABLE: dynamos
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.dynamos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  expires_at TIMESTAMPTZ DEFAULT (timezone('utc'::text, now()) + interval '24 hours') NOT NULL,
  status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'expired', 'hidden', 'deleted')),
  CONSTRAINT content_length CHECK (char_length(content) >= 1 AND char_length(content) <= 280),
  CONSTRAINT valid_lifespan CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_dynamos_user_id ON public.dynamos(user_id);
CREATE INDEX IF NOT EXISTS idx_dynamos_feed ON public.dynamos(status, expires_at, created_at DESC);

-- ==============================================================================
-- TABLE: hashtags
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.hashtags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  CONSTRAINT hashtag_format CHECK (name ~* '^[a-zA-Z0-9_]+$')
);

CREATE INDEX IF NOT EXISTS idx_hashtags_name ON public.hashtags(name);

-- ==============================================================================
-- TABLE: dynamo_hashtags
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.dynamo_hashtags (
  dynamo_id UUID NOT NULL REFERENCES public.dynamos(id) ON DELETE CASCADE,
  hashtag_id UUID NOT NULL REFERENCES public.hashtags(id) ON DELETE CASCADE,
  PRIMARY KEY (dynamo_id, hashtag_id)
);

CREATE INDEX IF NOT EXISTS idx_dynamo_hashtags_hashtag ON public.dynamo_hashtags(hashtag_id);

-- ==============================================================================
-- TABLE: dynamo_gifts
-- Records energy gifts (⚡). Each user can only gift energy once per dynamo.
-- Energy injection is strictly performed by public.gift_energy_to_dynamo().
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.dynamo_gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dynamo_id UUID NOT NULL REFERENCES public.dynamos(id) ON DELETE CASCADE,
  giver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_dynamo_gift_per_user UNIQUE (dynamo_id, giver_id)
);

CREATE INDEX IF NOT EXISTS idx_dynamo_gifts_dynamo ON public.dynamo_gifts(dynamo_id);
CREATE INDEX IF NOT EXISTS idx_dynamo_gifts_giver ON public.dynamo_gifts(giver_id, created_at DESC);

-- ==============================================================================
-- TABLE: replies
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dynamo_id UUID NOT NULL REFERENCES public.dynamos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT reply_content_length CHECK (char_length(content) >= 1 AND char_length(content) <= 280)
);

CREATE INDEX IF NOT EXISTS idx_replies_dynamo_id ON public.replies(dynamo_id, created_at ASC);

-- ==============================================================================
-- TABLE: follows
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT no_self_follow CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);

-- ==============================================================================
-- TABLE: blocks
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.blocks (
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT no_self_block CHECK (blocker_id <> blocked_id)
);

-- ==============================================================================
-- TABLE: mutes
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.mutes (
  muter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  muted_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (muter_id, muted_id),
  CONSTRAINT no_self_mute CHECK (muter_id <> muted_id)
);

-- ==============================================================================
-- TABLE: notifications
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('gift', 'reply', 'follow', 'system')),
  reference_id UUID,
  read BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);

-- ==============================================================================
-- TABLE: reports
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dynamo_id UUID REFERENCES public.dynamos(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);

-- ==============================================================================
-- TABLE: moderation_actions
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_dynamo_id UUID REFERENCES public.dynamos(id) ON DELETE SET NULL,
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- SERVER-SIDE TRIGGERS: INTEGRITY & EXPIRATION PROTECTION
-- ==============================================================================

-- 1. Enforce Server-Controlled Creation Defaults on Dynamos
-- The client cannot supply arbitrary expires_at, created_at, or status.
CREATE OR REPLACE FUNCTION public.trg_set_dynamo_creation_defaults()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_at := timezone('utc'::text, now());
  -- Strictly 24 hours initial duration enforced on the server
  NEW.expires_at := NEW.created_at + interval '24 hours';
  NEW.status := 'active';
  NEW.user_id := auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_dynamo_before_insert ON public.dynamos;
CREATE TRIGGER trg_dynamo_before_insert
  BEFORE INSERT ON public.dynamos
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_dynamo_creation_defaults();

-- 2. Prevent Client Tampering on Dynamo Updates
-- Clients cannot manipulate expires_at, created_at, user_id, or content.
-- Only the server procedure gift_energy_to_dynamo can update expires_at.
CREATE OR REPLACE FUNCTION public.trg_protect_dynamo_integrity()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if caller is authorized internal procedure
  IF current_setting('dynamo.allow_expiration_update', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- For regular client updates:
  IF NEW.expires_at <> OLD.expires_at THEN
    RAISE EXCEPTION 'No se permite modificar la fecha de expiración directamente.';
  END IF;

  IF NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'No se permite modificar la fecha de creación.';
  END IF;

  IF NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'No se permite transferir la autoría de un Dynamo.';
  END IF;

  IF NEW.content <> OLD.content THEN
    RAISE EXCEPTION 'El contenido de un Dynamo no es editable una vez publicado.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dynamo_before_update ON public.dynamos;
CREATE TRIGGER trg_dynamo_before_update
  BEFORE UPDATE ON public.dynamos
  FOR EACH ROW EXECUTE FUNCTION public.trg_protect_dynamo_integrity();

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynamos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynamo_hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynamo_gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone" 
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can only update their own profile and CANNOT escalate their own role
CREATE POLICY "Users can update only their own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND 
    role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );

-- 2. Dynamos Policies
CREATE POLICY "Active non-expired dynamos are viewable by everyone" 
  ON public.dynamos FOR SELECT 
  USING (
    (status = 'active' AND expires_at > timezone('utc'::text, now()))
    OR (auth.uid() = user_id)
  );

CREATE POLICY "Authenticated users can create their own dynamos" 
  ON public.dynamos FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Regular users can only soft-delete their own dynamos
CREATE POLICY "Users can only soft-delete their own dynamos" 
  ON public.dynamos FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND status = 'deleted');

CREATE POLICY "Users can delete their own dynamos" 
  ON public.dynamos FOR DELETE 
  USING (auth.uid() = user_id);

-- 3. Hashtags Policies
CREATE POLICY "Hashtags are viewable by everyone" 
  ON public.hashtags FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create hashtags" 
  ON public.hashtags FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Dynamo hashtags are viewable by everyone" 
  ON public.dynamo_hashtags FOR SELECT USING (true);

CREATE POLICY "Users can link hashtags to their own dynamos" 
  ON public.dynamo_hashtags FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dynamos 
      WHERE id = dynamo_hashtags.dynamo_id AND user_id = auth.uid()
    )
  );

-- 4. Dynamo Gifts Policies
-- Gifts are viewable by everyone
CREATE POLICY "Gifts are viewable by everyone" 
  ON public.dynamo_gifts FOR SELECT USING (true);

-- IMPORTANT SECURITY RULE:
-- NO DIRECT INSERT POLICY for public.dynamo_gifts.
-- Users CANNOT insert gifts directly from the client.
-- All gifts must be created strictly through the SECURITY DEFINER function public.gift_energy_to_dynamo().

-- 5. Replies Policies
CREATE POLICY "Replies are viewable by everyone" 
  ON public.replies FOR SELECT USING (true);

-- Users can only reply to an active, non-expired dynamo
CREATE POLICY "Authenticated users can reply to active dynamos" 
  ON public.replies FOR INSERT 
  WITH CHECK (
    auth.uid() = user_id AND 
    EXISTS (
      SELECT 1 FROM public.dynamos 
      WHERE id = replies.dynamo_id AND status = 'active' AND expires_at > timezone('utc'::text, now())
    )
  );

CREATE POLICY "Users can delete their own replies" 
  ON public.replies FOR DELETE 
  USING (auth.uid() = user_id);

-- 6. Follows / Blocks / Mutes Policies
CREATE POLICY "Follows are viewable by everyone" 
  ON public.follows FOR SELECT USING (true);

CREATE POLICY "Users can create their own follows" 
  ON public.follows FOR INSERT 
  WITH CHECK (auth.uid() = follower_id AND follower_id <> following_id);

CREATE POLICY "Users can delete their own follows" 
  ON public.follows FOR DELETE 
  USING (auth.uid() = follower_id);

CREATE POLICY "Users can view their own blocks" 
  ON public.blocks FOR SELECT 
  USING (auth.uid() = blocker_id);

CREATE POLICY "Users can manage their own blocks" 
  ON public.blocks FOR INSERT 
  WITH CHECK (auth.uid() = blocker_id AND blocker_id <> blocked_id);

CREATE POLICY "Users can delete their own blocks" 
  ON public.blocks FOR DELETE 
  USING (auth.uid() = blocker_id);

CREATE POLICY "Users can view their own mutes" 
  ON public.mutes FOR SELECT 
  USING (auth.uid() = muter_id);

CREATE POLICY "Users can manage their own mutes" 
  ON public.mutes FOR INSERT 
  WITH CHECK (auth.uid() = muter_id AND muter_id <> muted_id);

CREATE POLICY "Users can delete their own mutes" 
  ON public.mutes FOR DELETE 
  USING (auth.uid() = muter_id);

-- 7. Notifications Policies
CREATE POLICY "Users can view their own notifications" 
  ON public.notifications FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can mark their own notifications as read" 
  ON public.notifications FOR UPDATE 
  USING (auth.uid() = user_id);

-- Direct client INSERT is disabled. Handled by server triggers and functions.

-- 8. Reports Policies
CREATE POLICY "Authenticated users can submit reports" 
  ON public.reports FOR INSERT 
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own reports or admins can view all" 
  ON public.reports FOR SELECT 
  USING (
    auth.uid() = reporter_id OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
  );

CREATE POLICY "Admins can update report status" 
  ON public.reports FOR UPDATE 
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
  );

-- 9. Moderation Actions Policies (Restricted to Admins / Moderators)
CREATE POLICY "Admins and moderators can view moderation logs" 
  ON public.moderation_actions FOR SELECT 
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
  );

CREATE POLICY "Admins and moderators can record moderation actions" 
  ON public.moderation_actions FOR INSERT 
  WITH CHECK (
    auth.uid() = admin_id AND 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
  );

-- ==============================================================================
-- SECURE SERVER PROCEDURES & TRIGGERS
-- ==============================================================================

-- Trigger to auto-create profile on Supabase auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar, bio, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substring(NEW.id::text from 1 for 8)),
    COALESCE(NEW.raw_user_meta_data->>'avatar', ''),
    COALESCE(NEW.raw_user_meta_data->>'bio', ''),
    'user'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'auth' AND tablename = 'users') THEN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- Trigger: auto-generate notification on reply
CREATE OR REPLACE FUNCTION public.handle_new_reply()
RETURNS TRIGGER AS $$
DECLARE
  v_dynamo_owner UUID;
BEGIN
  SELECT user_id INTO v_dynamo_owner FROM public.dynamos WHERE id = NEW.dynamo_id;
  IF FOUND AND v_dynamo_owner <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, type, reference_id)
    VALUES (v_dynamo_owner, 'reply', NEW.dynamo_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_reply_created ON public.replies;
CREATE TRIGGER on_reply_created
  AFTER INSERT ON public.replies
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_reply();

-- ==============================================================================
-- PROCEDURE: gift_energy_to_dynamo
-- Centralized Server-Side Procedure for Energy Gifts (⚡)
-- Enforces:
-- 1. Authentication check
-- 2. Target Dynamo active & not expired
-- 3. Cannot gift to own dynamo (prevents self-farming)
-- 4. No duplicate gifts on the same dynamo by the same user
-- 5. Configurable daily limit per user (10/day)
-- 6. Adds +6 hours up to hard ceiling of 168 hours (7 days) from created_at
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.gift_energy_to_dynamo(p_dynamo_id UUID)
RETURNS JSONB AS $$
DECLARE
  c_bonus_hours CONSTANT INT := 6;
  c_max_lifespan_hours CONSTANT INT := 168; -- 7 days hard ceiling
  c_daily_user_gift_limit CONSTANT INT := 10; -- Configurable daily quota per user
  
  v_dynamo RECORD;
  v_current_user_id UUID;
  v_new_expires_at TIMESTAMPTZ;
  v_max_expires_at TIMESTAMPTZ;
  v_gifts_today INT;
  v_total_gifts INT;
BEGIN
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  -- Lock target dynamo row for atomic update
  SELECT * INTO v_dynamo FROM public.dynamos WHERE id = p_dynamo_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El Dynamo no existe';
  END IF;

  -- Prevent self-gifting / gaming
  IF v_dynamo.user_id = v_current_user_id THEN
    RAISE EXCEPTION 'No puedes inyectar energía a tu propio Dynamo';
  END IF;

  -- Check status & expiration
  IF v_dynamo.status <> 'active' OR v_dynamo.expires_at <= timezone('utc'::text, now()) THEN
    RAISE EXCEPTION 'No se puede inyectar energía a un Dynamo expirado o inactivo';
  END IF;

  -- Prevent duplicate gift on the same dynamo by the same user
  IF EXISTS (
    SELECT 1 FROM public.dynamo_gifts 
    WHERE dynamo_id = p_dynamo_id AND giver_id = v_current_user_id
  ) THEN
    RAISE EXCEPTION 'Ya has entregado energía a este Dynamo';
  END IF;

  -- Enforce configurable daily gift quota (rolling 24-hour window)
  SELECT count(*) INTO v_gifts_today
  FROM public.dynamo_gifts
  WHERE giver_id = v_current_user_id
    AND created_at > (timezone('utc'::text, now()) - interval '24 hours');

  IF v_gifts_today >= c_daily_user_gift_limit THEN
    RAISE EXCEPTION 'Has alcanzado el límite diario de energía entregada (% al día)', c_daily_user_gift_limit;
  END IF;

  -- Calculate new expiration timestamp:
  -- Adds 6 hours to current expires_at, capped at created_at + 168 hours
  v_new_expires_at := v_dynamo.expires_at + (c_bonus_hours || ' hours')::interval;
  v_max_expires_at := v_dynamo.created_at + (c_max_lifespan_hours || ' hours')::interval;

  IF v_new_expires_at > v_max_expires_at THEN
    v_new_expires_at := v_max_expires_at;
  END IF;

  -- Authorize expiration update via transaction setting
  PERFORM set_config('dynamo.allow_expiration_update', 'true', true);

  -- Update dynamo expiration
  UPDATE public.dynamos
  SET expires_at = v_new_expires_at
  WHERE id = p_dynamo_id;

  -- Insert gift record (bypassing RLS safely as SECURITY DEFINER)
  INSERT INTO public.dynamo_gifts (dynamo_id, giver_id)
  VALUES (p_dynamo_id, v_current_user_id);

  -- Get total gifts count on this dynamo
  SELECT count(*) INTO v_total_gifts
  FROM public.dynamo_gifts
  WHERE dynamo_id = p_dynamo_id;

  -- Notify the author
  INSERT INTO public.notifications (user_id, type, reference_id)
  VALUES (v_dynamo.user_id, 'gift', p_dynamo_id);

  RETURN jsonb_build_object(
    'success', true,
    'dynamo_id', p_dynamo_id,
    'new_expires_at', v_new_expires_at,
    'total_gifts', v_total_gifts,
    'gifts_remaining_today', c_daily_user_gift_limit - v_gifts_today - 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- VIEW: active_feed
-- Aggregated view for active non-expired feed
-- ==============================================================================
CREATE OR REPLACE VIEW public.active_feed AS
SELECT 
  d.*,
  p.username,
  p.avatar as user_avatar,
  (SELECT count(*) FROM public.dynamo_gifts g WHERE g.dynamo_id = d.id) AS energy_gifts_count,
  (SELECT count(*) FROM public.replies r WHERE r.dynamo_id = d.id) AS replies_count
FROM public.dynamos d
JOIN public.profiles p ON d.user_id = p.id
WHERE d.status = 'active' AND d.expires_at > timezone('utc'::text, now())
ORDER BY d.created_at DESC;
