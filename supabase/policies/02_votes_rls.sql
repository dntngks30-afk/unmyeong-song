-- Ticket 02 policy catalog (review/reference)
-- NOTE: Effective DDL lives in migration 202602160002_votes_rpc.sql.
-- SSOT: docs/contracts/schema.md

-- votes policies after Ticket 02
-- - votes_select_self_or_admin
-- - votes_insert_owner_top10_only

-- guarantees
-- - insert bound to auth.uid() owner
-- - insert allowed only for top10 final_tracks target
-- - duplicate vote and 3-vote limit are enforced by RPC cast_votes_max3
