-- ==============================================================================
-- DYNAMO V1: CONSOLIDATE REPLY NOTIFICATIONS & 2-LEVEL CONVERSATION THREADING
-- ==============================================================================

-- 1. ELIMINATE DUPLICATE REPLY NOTIFICATIONS
-- Drop historical redundant trigger and function from init schema (handle_new_reply)
DROP TRIGGER IF EXISTS on_reply_created ON public.replies;
DROP FUNCTION IF EXISTS public.handle_new_reply();

-- 2. ADD parent_reply_id TO SUPPORT MAX 2 VISUAL LEVELS OF CONVERSATION
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'replies' AND column_name = 'parent_reply_id'
  ) THEN
    ALTER TABLE public.replies
      ADD COLUMN parent_reply_id UUID REFERENCES public.replies(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_replies_parent_reply_id ON public.replies(parent_reply_id);
CREATE INDEX IF NOT EXISTS idx_replies_dynamo_parent ON public.replies(dynamo_id, parent_reply_id, created_at ASC);

-- 3. SERVER-SIDE VALIDATION FOR REPLIES & STRICT 2-LEVEL DEPTH ENFORCEMENT
CREATE OR REPLACE FUNCTION public.trg_validate_reply_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_status TEXT;
  v_user_role TEXT;
  v_allow_replies BOOLEAN;
  v_emergency BOOLEAN;
  v_dynamo RECORD;
  v_parent_reply RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para responder.';
  END IF;

  -- 1. Check author profile status
  SELECT status, role INTO v_user_status, v_user_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT FOUND OR v_user_status <> 'active' THEN
    RAISE EXCEPTION 'Tu cuenta se encuentra suspendida o inactiva. No puedes publicar respuestas.';
  END IF;

  -- 2. Check global emergency and reply switches
  IF v_user_role <> 'admin' THEN
    SELECT COALESCE((value)::boolean, true) INTO v_allow_replies
    FROM public.system_settings
    WHERE key = 'allow_new_replies';

    IF v_allow_replies IS FALSE THEN
      RAISE EXCEPTION 'La publicación de respuestas se encuentra temporalmente deshabilitada.';
    END IF;

    SELECT COALESCE((value)::boolean, false) INTO v_emergency
    FROM public.system_settings
    WHERE key = 'emergency_mode';

    IF v_emergency IS TRUE THEN
      RAISE EXCEPTION 'La plataforma se encuentra en modo de emergencia.';
    END IF;
  END IF;

  -- 3. Verify target dynamo exists, is active and not expired
  SELECT user_id, status, expires_at INTO v_dynamo
  FROM public.dynamos
  WHERE id = NEW.dynamo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El Dynamo al que intentas responder no existe.';
  END IF;

  IF v_dynamo.status <> 'active' OR v_dynamo.expires_at <= timezone('utc'::text, now()) THEN
    RAISE EXCEPTION 'No se puede responder a un Dynamo expirado o inactivo.';
  END IF;

  -- 4. Check bidirectional blocks with Dynamo owner
  IF v_dynamo.user_id <> auth.uid() THEN
    IF EXISTS (
      SELECT 1 FROM public.blocks
      WHERE (blocker_id = auth.uid() AND blocked_id = v_dynamo.user_id)
         OR (blocker_id = v_dynamo.user_id AND blocked_id = auth.uid())
    ) THEN
      RAISE EXCEPTION 'No puedes interactuar con esta publicación debido a bloqueos entre los usuarios.';
    END IF;
  END IF;

  -- 5. Validation depending on whether it is direct (level 1) or reply-to-reply (level 2)
  IF NEW.parent_reply_id IS NULL THEN
    -- Direct reply to Dynamo: Author cannot reply to their own Dynamo
    IF v_dynamo.user_id = auth.uid() THEN
      RAISE EXCEPTION 'No puedes responder directamente a tu propio Dynamo.';
    END IF;
  ELSE
    -- Reply to another reply: Validate parent reply
    SELECT id, dynamo_id, user_id, status, parent_reply_id INTO v_parent_reply
    FROM public.replies
    WHERE id = NEW.parent_reply_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El comentario al que intentas responder no existe.';
    END IF;

    IF v_parent_reply.dynamo_id <> NEW.dynamo_id THEN
      RAISE EXCEPTION 'La respuesta no pertenece al mismo Dynamo.';
    END IF;

    IF v_parent_reply.status <> 'active' THEN
      RAISE EXCEPTION 'No se puede responder a un comentario moderado o inactivo.';
    END IF;

    IF v_parent_reply.user_id = auth.uid() THEN
      RAISE EXCEPTION 'No puedes responder a tu propio comentario.';
    END IF;

    -- Check bidirectional block with parent reply author
    IF EXISTS (
      SELECT 1 FROM public.blocks
      WHERE (blocker_id = auth.uid() AND blocked_id = v_parent_reply.user_id)
         OR (blocker_id = v_parent_reply.user_id AND blocked_id = auth.uid())
    ) THEN
      RAISE EXCEPTION 'No puedes interactuar con este usuario debido a bloqueos.';
    END IF;

    -- ENFORCE MAX 2 VISUAL LEVELS:
    -- If parent reply already has a parent_reply_id (i.e. is at Level 2),
    -- fold NEW.parent_reply_id to the root Level 1 parent.
    -- This guarantees no reply ever sits deeper than Level 2.
    IF v_parent_reply.parent_reply_id IS NOT NULL THEN
      NEW.parent_reply_id := v_parent_reply.parent_reply_id;
    END IF;
  END IF;

  NEW.created_at := timezone('utc'::text, now());
  NEW.user_id := auth.uid();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reply_before_insert ON public.replies;
CREATE TRIGGER trg_reply_before_insert
  BEFORE INSERT ON public.replies
  FOR EACH ROW EXECUTE FUNCTION public.trg_validate_reply_creation();

-- 4. RLS POLICIES FOR REPLIES INSERTION
DROP POLICY IF EXISTS "Authenticated users can reply to active dynamos" ON public.replies;
CREATE POLICY "Authenticated users can reply to active dynamos" 
  ON public.replies FOR INSERT 
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND 
    EXISTS (
      SELECT 1 FROM public.dynamos 
      WHERE id = replies.dynamo_id 
        AND status = 'active' 
        AND expires_at > timezone('utc'::text, now())
        AND (
          -- If direct reply to dynamo (parent_reply_id IS NULL), author cannot self-reply
          -- If reply to another reply (parent_reply_id IS NOT NULL), author CAN converse with participants
          (replies.parent_reply_id IS NULL AND user_id <> auth.uid()) OR
          (replies.parent_reply_id IS NOT NULL)
        )
    )
  );

-- 5. SINGLE OFFICIAL GENERATOR FOR REPLY NOTIFICATIONS (trg_notify_on_reply)
CREATE OR REPLACE FUNCTION public.trg_notify_on_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dynamo_author_id UUID;
  v_parent_author_id UUID;
  v_is_blocked BOOLEAN;
BEGIN
  -- Direct reply to Dynamo (Level 1):
  IF NEW.parent_reply_id IS NULL THEN
    -- Get author of target dynamo
    SELECT user_id INTO v_dynamo_author_id
    FROM public.dynamos
    WHERE id = NEW.dynamo_id;

    -- Do not notify if replying to own dynamo or not found
    IF v_dynamo_author_id IS NULL OR v_dynamo_author_id = NEW.user_id THEN
      RETURN NEW;
    END IF;

    -- Check bidirectional block
    SELECT EXISTS (
      SELECT 1 FROM public.blocks
      WHERE (blocker_id = NEW.user_id AND blocked_id = v_dynamo_author_id)
         OR (blocker_id = v_dynamo_author_id AND blocked_id = NEW.user_id)
    ) INTO v_is_blocked;

    IF v_is_blocked THEN
      RETURN NEW;
    END IF;

    -- Insert exactly ONE notification for target Dynamo author
    INSERT INTO public.notifications (user_id, sender_id, type, reference_id, metadata)
    VALUES (
      v_dynamo_author_id,
      NEW.user_id,
      'reply',
      NEW.dynamo_id,
      jsonb_build_object(
        'dynamo_id', NEW.dynamo_id,
        'reply_id', NEW.id,
        'target_type', 'dynamo'
      )
    );

  ELSE
    -- Reply to a Reply (Level 2):
    -- Target is the author of the parent reply
    SELECT user_id INTO v_parent_author_id
    FROM public.replies
    WHERE id = NEW.parent_reply_id;

    -- Do not notify if replying to oneself or not found
    IF v_parent_author_id IS NULL OR v_parent_author_id = NEW.user_id THEN
      RETURN NEW;
    END IF;

    -- Check bidirectional block
    SELECT EXISTS (
      SELECT 1 FROM public.blocks
      WHERE (blocker_id = NEW.user_id AND blocked_id = v_parent_author_id)
         OR (blocker_id = v_parent_author_id AND blocked_id = NEW.user_id)
    ) INTO v_is_blocked;

    IF v_is_blocked THEN
      RETURN NEW;
    END IF;

    -- Insert exactly ONE notification for target parent reply author.
    -- (Does not send a duplicate notification to dynamo author if they are not the parent author)
    INSERT INTO public.notifications (user_id, sender_id, type, reference_id, metadata)
    VALUES (
      v_parent_author_id,
      NEW.user_id,
      'reply',
      NEW.dynamo_id,
      jsonb_build_object(
        'dynamo_id', NEW.dynamo_id,
        'reply_id', NEW.id,
        'parent_reply_id', NEW.parent_reply_id,
        'target_type', 'reply'
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_after_reply_insert ON public.replies;
CREATE TRIGGER trg_after_reply_insert
  AFTER INSERT ON public.replies
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_on_reply();
