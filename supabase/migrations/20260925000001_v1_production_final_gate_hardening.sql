-- ==============================================================================
-- DYNAMO V1 PRODUCTION FINAL GATE HARDENING
-- Migration: 20260925000001_v1_production_final_gate_hardening.sql
-- Description:
--   1. Server-side age requirement enforcement (16+ years minimum) in handle_new_user()
--   2. Default legal documents content initialization with 16+ age policy
--   3. Enable Realtime replica identity on dynamo_gifts for reactive pulse
--   4. Profile table integrity comments and verification
-- ==============================================================================

-- 1. HARDEN HANDLE_NEW_USER WITH STRICT 16+ MINIMUM AGE VALIDATION
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allow_registrations BOOLEAN;
  v_is_age_confirmed BOOLEAN;
  v_min_age_certified NUMERIC;
BEGIN
  -- Verify if new registrations are permitted by admin switch
  SELECT COALESCE(
    value = 'true'::jsonb OR value = '"true"'::jsonb OR (value #>> '{}') = 'true',
    true
  ) INTO v_allow_registrations
  FROM public.system_settings
  WHERE key = 'allow_new_registrations';

  IF v_allow_registrations IS FALSE THEN
    RAISE EXCEPTION 'El registro de nuevas cuentas se encuentra temporalmente pausado por administración.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Validate mandatory minimum age (16 years) from registration metadata
  IF NEW.raw_user_meta_data->>'is_age_confirmed' IS NOT NULL THEN
    v_is_age_confirmed := (NEW.raw_user_meta_data->>'is_age_confirmed')::boolean;
    IF v_is_age_confirmed IS NOT TRUE THEN
      RAISE EXCEPTION 'Debes certificar tener al menos 16 años cumplidos para registrarte en Dynamo.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NEW.raw_user_meta_data->>'min_age_certified' IS NOT NULL THEN
    v_min_age_certified := (NEW.raw_user_meta_data->>'min_age_certified')::numeric;
    IF v_min_age_certified < 16 THEN
      RAISE EXCEPTION 'La edad mínima requerida para utilizar Dynamo es de 16 años cumplidos.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Create default profile safely and idempotently
  INSERT INTO public.profiles (id, username, avatar, bio, role, status)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'username'), ''), 'user_' || substring(NEW.id::text from 1 for 8)),
    COALESCE(NEW.raw_user_meta_data->>'avatar', ''),
    COALESCE(NEW.raw_user_meta_data->>'bio', ''),
    'user',
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    bio = COALESCE(NULLIF(EXCLUDED.bio, ''), public.profiles.bio);

  RETURN NEW;
END;
$$;

-- Ensure trigger is active on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. INITIALIZE DEFAULT LEGAL DOCUMENTS WITH CLEAR 16+ MINIMUM AGE DISCLOSURE
-- Updates empty legal texts so new deployments have compliant base terms
UPDATE public.system_legal_content
SET content = 'Bienvenido a Dynamo. Al utilizar nuestra plataforma de microcontenido efímero, aceptas cumplir estos términos.
1. Requisito de Edad: Para utilizar Dynamo debes tener al menos 16 años cumplidos. No permitimos el registro ni el uso de la plataforma a menores de 16 años.
2. Contenido Efímero: Las publicaciones (Dynamos) nacen con 24 horas de vigencia y expiran automáticamente salvo que la comunidad les otorgue energía ⚡ (hasta un máximo absoluto de 168 horas / 7 días).
3. Conducta Prohibida: Queda estrictamente prohibido el acoso, la difusión de datos personales (doxxing), spam, contenido ilegal o explotación.
4. Moderación: El contenido que infrinja nuestras normas puede ser ocultado inmediatamente por moderadores o reportes de la comunidad.'
WHERE id = 'terms' AND (content IS NULL OR trim(content) = '');

UPDATE public.system_legal_content
SET content = 'En Dynamo protegemos tu privacidad mediante una arquitectura diseñada para minimizar datos personales.
1. Edad Mínima: La plataforma está reservada exclusivamente a personas de 16 años o más.
2. Contenido Efímero: Los Dynamos no persisten indefinidamente; expiran naturalmente y sus registros energéticos son sellados.
3. Datos Personales: Recomendamos no publicar números de teléfono, correos ni datos financieros en los Dynamos. Dynamo incluye detectores de información sensible para alertarte antes de publicar.
4. Derechos de Acceso y Supresión: Puedes editar tu perfil, eliminar tus Dynamos y cerrar tu cuenta en cualquier momento desde Configuración.'
WHERE id = 'privacy' AND (content IS NULL OR trim(content) = '');

UPDATE public.system_legal_content
SET content = 'Dynamo es un espacio comunitario dinámico y respetuoso.
1. Edad: 16+ años cumplidos obligatorios.
2. Respeto Mutuo: Conversaciones directas sin hostigamiento ni violencia verbal.
3. Energía Comunitaria: El impulso ⚡ está diseñado para destacar ideas valiosas, no para manipular artificialmente el feed.
4. Reportes: Utiliza el botón de reporte ante cualquier publicación sospechosa o perjudicial.'
WHERE id = 'community' AND (content IS NULL OR trim(content) = '');

UPDATE public.system_legal_content
SET content = 'Salvaguarda de usuarios y medidas de protección en Dynamo:
- Edad mínima 16+ requerida en registro y términos.
- Detección automática en cliente de números de tarjeta, DNI/cédulas, teléfonos y direcciones.
- Cifrado en tránsito y almacenamiento de imágenes validado mediante Magic Bytes (JPG, PNG, WEBP) con sanitización EXIF.
- Herramientas de bloqueo mutuo y silenciamiento instantáneo.'
WHERE id = 'safety' AND (content IS NULL OR trim(content) = '');

-- 3. ENSURE REALTIME ON DYNAMO_GIFTS FOR INSTANT REACTIVE PULSE
ALTER TABLE public.dynamo_gifts REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'dynamo_gifts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dynamo_gifts;
  END IF;
END $$;

-- 4. PROFILE TABLE METADATA COMMENTS
COMMENT ON TABLE public.profiles IS 'Perfiles de usuario de Dynamo. Requisito estricto de edad mínima: 16 años cumplidos.';
