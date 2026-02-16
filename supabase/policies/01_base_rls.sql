-- Ticket 01 policy catalog (review/reference)
-- NOTE: Base RLS has been applied in migration 202602160001_init_schema.sql.
-- Keep this file synchronized with migration policy names and intent.
-- SSOT: docs/contracts/schema.md

-- Naming convention:
--   <table>_<action>_<scope>
-- Principle:
--   default deny + minimum allowlist + owner-bound writes

-- profiles
-- - profiles_select_self_or_admin
-- - profiles_insert_self_or_admin
-- - profiles_update_self_or_admin

-- stories
-- - stories_select_public_owner_admin
-- - stories_insert_owner
-- - stories_update_owner_or_admin
-- - stories_delete_owner_or_admin

-- songs
-- - songs_select_public_owner_admin
-- - songs_insert_owner_artist_or_admin
-- - songs_update_owner_artist_or_admin

-- final_tracks
-- - final_tracks_select_public_or_admin
-- - final_tracks_all_admin

-- votes
-- - votes_select_self_or_admin
-- - votes_insert_owner

-- reports
-- - reports_select_self_or_admin
-- - reports_insert_owner
-- - reports_update_admin_only

-- moderation_queue
-- - moderation_queue_select_admin_only
-- - moderation_queue_update_admin_only

-- entitlements
-- - entitlements_select_self_or_admin
-- - entitlements_insert_admin_only
-- - entitlements_update_admin_only
