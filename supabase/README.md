# Dynamo — Supabase Database Setup

Esta carpeta contiene la definición completa de base de datos para **Dynamo**, optimizada para PostgreSQL en Supabase con Row Level Security (RLS) y funciones seguras en servidor.

## Tablas incluidas:
1. `profiles`: Datos de usuario, avatar, bio, estado.
2. `dynamos`: Publicaciones efímeras con `expires_at`, `status`, límite de 280 caracteres.
3. `hashtags`: Etiquetas únicas normalizadas.
4. `dynamo_hashtags`: Relación N:M entre dynamos y hashtags.
5. `dynamo_gifts`: Registro de energía ⚡ inyectada por otros usuarios.
6. `replies`: Respuestas dentro de dynamos activos.
7. `follows`: Relaciones de seguimiento entre perfiles.
8. `blocks`: Bloqueos de seguridad entre usuarios.
9. `mutes`: Silenciamiento de cuentas.
10. `notifications`: Notificaciones en tiempo real / push (regalos, respuestas, seguidos).
11. `reports`: Denuncias de contenido y spam.
12. `moderation_actions`: Auditoría de acciones administrativas de moderación.

## Cómo aplicar en Supabase:

### Opción A: Desde el panel web de Supabase
1. Ve a tu proyecto en [supabase.com](https://supabase.com).
2. Entra en el **SQL Editor**.
3. Pega el contenido de `supabase/migrations/20260914000000_init_dynamo_schema.sql`.
4. Haz clic en **Run**.

### Opción B: Con Supabase CLI
```bash
npx supabase db push
```

## Reglas de seguridad implementadas (RLS):
* Todas las tablas tienen `ROW LEVEL SECURITY` habilitado.
* Los usuarios solo pueden insertar dynamos, respuestas y regalos con su propio `auth.uid()`.
* La inyección de energía ⚡ se ejecuta mediante la función segura de servidor `public.gift_energy_to_dynamo()`, la cual valida que el dynamo no esté expirado, añade 6 horas y respeta el tope máximo de 168 horas (7 días).
