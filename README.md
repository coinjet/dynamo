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

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000).

> **Modo Sandbox Local**: Si ejecutas sin configurar Supabase en desarrollo (`DEV`), la aplicación activa automáticamente un sandbox local aislado para iteración de interfaz. En producción (`PROD`), este modo está estrictamente bloqueado.

---

## 4. Ejecutar Migraciones

Aplica el esquema y las funciones de seguridad en tu base de datos Supabase ejecutando en orden cronológico las migraciones contenidas en `supabase/migrations/`:

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

Puedes aplicarlas copiando su contenido en el **SQL Editor** de Supabase o mediante el Supabase CLI (`supabase db push`).

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
