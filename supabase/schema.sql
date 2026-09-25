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
\i migrations/20260916000001_user_settings_and_privacy.sql
\i migrations/20260916000002_qa_audit_security_fixes.sql
\i migrations/20260918000001_admin_dashboard_v1.sql
\i migrations/20260918000002_admin_switches_v1_1.sql
\i migrations/20260918000003_dashboard_v1_2_security_comms_legal.sql
\i migrations/20260919000001_dynamo_multimedia_storage.sql
\i migrations/20260919000002_prelaunch_security_hardening.sql
\i migrations/20260920000001_v1_launch_hardening.sql
\i migrations/20260920000002_enable_realtime_notifications.sql
\i migrations/20260920000003_consolidate_reply_notifications_and_threading.sql
\i migrations/20260921000000_realtime_replica_identity_and_dynamos.sql
\i migrations/20260924000001_fix_allow_images_jsonb_cast.sql
\i migrations/20260924000002_production_hardening_and_unification.sql
\i migrations/20260925000001_v1_production_final_gate_hardening.sql
