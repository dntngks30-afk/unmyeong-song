-- Ticket 07.1 policy catalog (review/reference)
-- NOTE: Effective DDL lives in migration 202602160007_1_stories_rpc.sql.
-- SSOT: docs/contracts/schema.md, docs/contracts/api.md

-- stories policies reused from base guarantees (Ticket 01):
-- - stories_select_public_owner_admin
-- - stories_insert_owner
-- - stories_update_owner_or_admin
-- - stories_delete_owner_or_admin

-- RPC added:
-- - submit_story_rate_limited(p_title text, p_body text, p_client_request_id uuid)

-- guarantees
-- - authenticated only execute (anon cannot write)
-- - TEMP rate-limit threshold: per-user 3 writes per 1 minute
-- - minimal content-block pattern check (phone/email/account/address keywords)
-- - success inserts story with author_id = auth.uid()
