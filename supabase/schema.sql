-- Dynamo — Complete Database Schema for Supabase
-- Copy and paste this directly into Supabase Dashboard -> SQL Editor
-- This script creates all 11 required tables, RLS policies, and server-side energy extension logic.

\i migrations/20260914000000_init_dynamo_schema.sql
\i migrations/20260914000001_notifications_module.sql
\i migrations/20260915000000_discovery_module.sql
\i migrations/20260915000001_moderation_security_module.sql
\i migrations/20260915000002_admin_panel_module.sql
\i migrations/20260915000003_dynamo_economy_module.sql
\i migrations/20260915000004_best_dynamos_and_badges.sql
