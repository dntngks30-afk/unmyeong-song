-- PR-BE-02-STORIES: stories RLS catalog
-- Effective DDL is applied by:
--   supabase/migrations/202602170006_stories_schema_rls_hardening.sql

-- stories RLS
-- - select: authenticated users
-- - insert: auth.uid() = stories.user_id
-- - update/delete: owner only (auth.uid() = stories.user_id)
