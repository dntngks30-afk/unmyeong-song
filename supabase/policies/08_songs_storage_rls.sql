-- Ticket 08.1 policy catalog (review/reference)
-- NOTE: Effective DDL lives in migration 202602160008_1_submission_rpc.sql.
-- SSOT: docs/contracts/schema.md, docs/contracts/api.md

-- RPC added:
-- - complete_song_submission(p_song_id uuid, p_audio_path text, p_cover_path text, p_making_note text)

-- songs policy dependency (existing):
-- - songs_update_owner_artist_or_admin

-- validation guarantees by RPC:
-- - authenticated only execute
-- - role must be artist/admin
-- - owner-only finalize (song.artist_id = auth.uid())
-- - audio path must match:
--   - bucket mapping: song-audio
--   - pattern: artist/{uid}/song/{song_id}/audio.{ext}
-- - cover path (if provided) must match:
--   - bucket mapping: song-cover
--   - pattern: artist/{uid}/song/{song_id}/cover.{ext}
-- - making_note required and bounded (TEMP 1..2000)
-- - successful finalize updates songs.audio_path/cover_path/making_note and sets status=submitted
