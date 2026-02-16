-- Ticket 03: reports RPC + moderation queue auto transition
-- SSOT: docs/contracts/schema.md

-- 1) Trigger: create moderation_queue row for every new report
create or replace function public.trg_create_moderation_queue_from_report()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.moderation_queue (
    source_report_id,
    target_type,
    target_id,
    queue_status,
    risk_level
  )
  values (
    new.id,
    new.target_type,
    new.target_id,
    'open'::public.report_status,
    'low'
  )
  on conflict (source_report_id) do nothing;

  return new;
end;
$$;

-- 2) Trigger: threshold transition by cumulative report score (3/5)
create or replace function public.trg_apply_report_threshold_transition()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total_score integer;
  v_queue_status public.report_status;
  v_risk_level text;
begin
  select coalesce(sum(r.score), 0)::integer
  into v_total_score
  from public.reports r
  where r.target_type = new.target_type
    and r.target_id = new.target_id;

  v_queue_status := case
    when v_total_score >= 3 then 'in_review'::public.report_status
    else 'open'::public.report_status
  end;

  v_risk_level := case
    when v_total_score >= 5 then 'high'
    when v_total_score >= 3 then 'medium'
    else 'low'
  end;

  update public.moderation_queue mq
  set queue_status = v_queue_status,
      risk_level = v_risk_level,
      threshold_reached_at = case
        when v_total_score >= 3 and mq.threshold_reached_at is null then now()
        when v_total_score < 3 then null
        else mq.threshold_reached_at
      end,
      updated_at = now()
  where mq.target_type = new.target_type
    and mq.target_id = new.target_id;

  return new;
end;
$$;

drop trigger if exists trg_reports_to_queue on public.reports;
create trigger trg_reports_to_queue
after insert on public.reports
for each row
execute function public.trg_create_moderation_queue_from_report();

drop trigger if exists trg_report_threshold_transition on public.reports;
create trigger trg_report_threshold_transition
after insert on public.reports
for each row
execute function public.trg_apply_report_threshold_transition();

-- 3) RPC: create_report_and_queue
drop function if exists public.create_report_and_queue(text, uuid, text);

create or replace function public.create_report_and_queue(
  p_target_type text,
  p_target_id uuid,
  p_reason text
)
returns table (
  report_id uuid,
  queue_id uuid,
  queue_status public.report_status,
  risk_level text,
  total_score integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid;
  v_target_type text;
  v_reason text;
  v_report_id uuid;
  v_queue_id uuid;
  v_queue_status public.report_status;
  v_risk_level text;
  v_total_score integer;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  if public.current_role(v_uid) is null then
    raise exception 'FORBIDDEN_ROLE' using errcode = 'P0001';
  end if;

  v_target_type := lower(trim(coalesce(p_target_type, '')));
  if v_target_type not in ('story', 'song') then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if p_target_id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_target_type = 'story' then
    if not exists (select 1 from public.stories s where s.id = p_target_id) then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
  else
    if not exists (select 1 from public.songs s where s.id = p_target_id) then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
  end if;

  v_reason := trim(coalesce(p_reason, ''));
  if v_reason = '' then
    raise exception 'CONTENT_BLOCKED' using errcode = 'P0001';
  end if;

  insert into public.reports (
    reporter_id,
    target_type,
    target_id,
    reason,
    status,
    score
  )
  values (
    v_uid,
    v_target_type,
    p_target_id,
    v_reason,
    'open'::public.report_status,
    1
  )
  returning id into v_report_id;

  select
    mq.id,
    mq.queue_status,
    mq.risk_level
  into
    v_queue_id,
    v_queue_status,
    v_risk_level
  from public.moderation_queue mq
  where mq.source_report_id = v_report_id
  limit 1;

  select coalesce(sum(r.score), 0)::integer
  into v_total_score
  from public.reports r
  where r.target_type = v_target_type
    and r.target_id = p_target_id;

  return query
  select
    v_report_id as report_id,
    v_queue_id as queue_id,
    coalesce(v_queue_status, 'open'::public.report_status) as queue_status,
    coalesce(v_risk_level, 'low') as risk_level,
    v_total_score as total_score;
end;
$$;

revoke all on function public.create_report_and_queue(text, uuid, text) from public;
grant execute on function public.create_report_and_queue(text, uuid, text) to authenticated;

-- 4) RLS hardening for moderation_queue: block direct insert/delete from client
drop policy if exists moderation_queue_insert_admin_only on public.moderation_queue;
create policy moderation_queue_insert_admin_only
on public.moderation_queue
for insert
with check (public.is_admin(auth.uid()));

drop policy if exists moderation_queue_delete_admin_only on public.moderation_queue;
create policy moderation_queue_delete_admin_only
on public.moderation_queue
for delete
using (public.is_admin(auth.uid()));
