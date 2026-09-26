# Dynamo V0.1 ⚡

Base técnica modular de **Dynamo**: PWA de microcontenido efímero impulsado por energía comunitaria.

## Arquitectura

* **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Vite
* **Persistencia & Backend BaaS**: Supabase (PostgreSQL 15+, RLS estricto, procedimientos almacenados y triggers)
* **PWA**: Service Worker (`/sw.js`), Web App Manifest, soporte offline
* **Despliegue**: Vercel (Edge CDN estático para SPA, sin servidores intermedios redundantes)

---

## 1. Instalar

Clona el repositorio e instala las dependencias:

```bash
git clone https://github.com/tu-usuario/dynamo-pwa.git
cd dynamo-pwa
npm install
```

---

## 2. Configurar Supabase

1. Crea un proyecto en [Supabase](https://supabase.com).
2. Copia la plantilla de variables de entorno:

```bash
cp .env.example .env
```

3. Obtén tus claves en Supabase (**Project Settings > API**) y define en `.env`:

```env
VITE_SUPABASE_URL="https://tu-proyecto.supabase.co"
VITE_SUPABASE_ANON_KEY="tu-anon-key-publica"
```

> **Seguridad**: No incluyas nunca `service_role_key` en `.env` ni en el cliente frontend. Toda la lógica privilegiada se ejecuta dentro de PostgreSQL con `SECURITY DEFINER` y RLS.

---

## 3. Ejecutar Localmente

Inicia el servidor de desarrollo de Vite:

```bash
npm run dev
```

La aplicación estará disponible localmente en el puerto configurado (ej. http://localhost:3000).

---

## 4. Ejecutar Migraciones en Supabase

El repositorio cuenta con **26 migraciones** ordenadas cronológicamente en la carpeta `supabase/migrations/` que deben aplicarse secuencialmente en tu proyecto de Supabase:

1. `20260914000000_init_dynamo_schema.sql` (Esquema base, tablas maestras, RLS y triggers de integridad)
2. `20260914000001_notifications_module.sql` (Módulo de notificaciones)
3. `20260915000000_discovery_module.sql` (Búsqueda e indexación de hashtags)
4. `20260915000001_moderation_security_module.sql` (Módulo de reportes y moderación)
5. `20260915000002_admin_panel_module.sql` (Procedimientos para panel de administración)
6. `20260915000003_dynamo_economy_module.sql` (Billeteras de energía, ledger y RPC transaccional)
7. `20260915000004_best_dynamos_and_badges.sql` (Best Dynamos e insignias)
8. `20260916000001_user_settings_and_privacy.sql` (Configuración de usuario y privacidad)
9. `20260916000002_qa_audit_security_fixes.sql` (Auditoría de seguridad y parches SEC-01 a SEC-04)
10. `20260918000001_admin_dashboard_v1.sql` (Dashboard Administrativo V1: comunicaciones, switches globales, publicidad y auditoría)
11. `20260918000002_admin_switches_v1_1.sql` (Dashboard V1.1: 10 switches independientes y auditoría obligatoria)
12. `20260918000003_dashboard_v1_2_security_comms_legal.sql` (Dashboard V1.2: soporte Telegram, legales y comunicados)
13. `20260919000001_dynamo_multimedia_storage.sql` (Políticas Storage y validación multimedia)
14. `20260919000002_prelaunch_security_hardening.sql` (Endurecimiento previo a lanzamiento)
15. `20260920000001_v1_launch_hardening.sql` (Validación de bio y registro)
16. `20260920000002_enable_realtime_notifications.sql` (Publicación Realtime para notificaciones)
17. `20260920000003_consolidate_reply_notifications_and_threading.sql` (Hilos de respuesta y notificaciones consolidadas)
18. `20260921000000_realtime_replica_identity_and_dynamos.sql` (Replica Identity Full y dynamos en Realtime)
19. `20260924000001_fix_allow_images_jsonb_cast.sql` (Casteo seguro JSONB para interruptor allow_images)
20. `20260924000002_production_hardening_and_unification.sql` (Unificación de triggers de dynamos, storage policies y RLS bidireccional)
21. `20260925000001_v1_production_final_gate_hardening.sql` (Requisito legal de edad 16+ en documentos base y reactive pulse)
22. `20260925000002_v1_production_referrals_and_growth.sql` (Sistema completo de invitaciones y referidos con atribución server-side, funnel de eventos y validación estricta de edad 16+ en DB)
23. `20260925000003_v1_admin_growth_and_security.sql` (Panel administrativo de Invitaciones/Crecimiento, RPCs de embudo global y listado de invitadores con RLS blindada)
24. `20260925000004_v1_security_hardening_admin_rpcs.sql` (Parche crítico de seguridad en RPCs administrativas: validación estricta contra auth.uid() y eliminación de suplantación de UUIDs)
25. `20260925000005_v1_fix_dynamo_gift_flow_and_triggers.sql` (Corrección integral del flujo ⚡: solución al error de columna giver_id en trg_referral_first_gift y consolidación atómica de gift_energy_to_dynamo con notificación al autor)
26. `20260925000006_v1_final_gift_economy_hardening.sql` (Blindaje definitivo de economía ⚡: conteo de cuota gratuita en ventana móvil de 24h sin contaminación por saldo adquirido, jerarquía de locks anti-deadlock y preferencias de notificación server-side)

> **Requisito Legal de Edad**: La edad mínima permitida para registrarse y participar en Dynamo es de **16 años cumplidos**. Este requisito está enforced estrictamente a nivel de cliente y servidor/DB (trigger `handle_new_user()`).

Puedes aplicarlas copiando su contenido en el **SQL Editor** de Supabase (o ejecutando `supabase/schema.sql`) o mediante el Supabase CLI (`supabase db push`).

---

## 5. Desplegar en Vercel

La aplicación está preconfigurada en `vercel.json` como una Single Page Application estática servida por Edge CDN:

1. Importa el repositorio en [Vercel](https://vercel.com).
2. En la sección **Environment Variables** del proyecto en Vercel, agrega únicamente:
   * `VITE_SUPABASE_URL`
   * `VITE_SUPABASE_ANON_KEY`
3. Comando de build: `npm run build`
4. Directorio de salida: `dist`
5. Haz clic en **Deploy**.
