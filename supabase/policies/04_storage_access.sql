-- Ticket 04 policy catalog (review/reference)
-- NOTE: Effective DDL lives in migration 202602160004_storage_rules.sql.
-- SSOT: docs/contracts/schema.md, docs/contracts/api.md

-- buckets
-- - song-audio (private)
-- - song-cover (private by default)

-- helper
-- - function: public.validate_storage_path(bucket_id, object_name, uid)

-- storage.objects policies
-- - storage_objects_select_owner_or_admin
-- - storage_objects_insert_owner_valid_path
-- - storage_objects_update_owner_valid_path
-- - storage_objects_delete_owner_or_admin

-- guarantees
-- - only artist/{user_id}/song/{song_id}/audio.{ext} allowed for song-audio
-- - only artist/{user_id}/song/{song_id}/cover.{ext} allowed for song-cover
-- - only owner (or admin/service role) can mutate object rows
-- - public URL direct exposure is blocked by private buckets + RLS
-- - signed URL TTL enforcement boundary: Edge Function (upload 300s / playback 60s)
