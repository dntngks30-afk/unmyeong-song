-- Ticket 03 policy catalog (review/reference)
-- NOTE: Effective DDL lives in migration 202602160003_reports_queue.sql.
-- SSOT: docs/contracts/schema.md

-- reports/mq related objects introduced or hardened by Ticket 03
-- - function: create_report_and_queue(text, uuid, text)
-- - trigger: trg_reports_to_queue (after insert on reports)
-- - trigger: trg_report_threshold_transition (after insert on reports)

-- reports policies (unchanged base guarantees)
-- - reports_select_self_or_admin
-- - reports_insert_owner
-- - reports_update_admin_only

-- moderation_queue policies
-- - moderation_queue_select_admin_only
-- - moderation_queue_update_admin_only
-- - moderation_queue_insert_admin_only
-- - moderation_queue_delete_admin_only

-- guarantees
-- - authenticated user can report via RPC create_report_and_queue
-- - every report insert auto-creates moderation_queue row (source_report_id unique)
-- - cumulative score thresholds enforce queue transition:
--   - 1~2: open/low
--   - 3~4: in_review/medium
--   - 5+:  in_review/high
