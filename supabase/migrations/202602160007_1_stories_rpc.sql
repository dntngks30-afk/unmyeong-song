-- Ticket 07.1: submit_story_rate_limited RPC (rate-limit + content-block)
-- SSOT: docs/contracts/schema.md, docs/contracts/api.md
-- TEMP policy: per-user 3 writes per 1 minute (until SSOT threshold is finalized)

alter table public.stories
  add column if not exists client_request_id uuid null;

create unique index if not exists uq_stories_author_client_request
  on public.stories (author_id, client_request_id)
  where client_request_id is not null;

create index if not exists idx_stories_author_created_at
  on public.stories (author_id, created_at desc);

drop function if exists public.submit_story_rate_limited(text, text, uuid);

create or replace function public.submit_story_rate_limited(
  p_title text,
  p_body text,
  p_client_request_id uuid default null
)
returns table (
  story_id uuid,
  status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid;
  v_title text;
  v_body text;
  v_recent_count integer;
  v_story_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  if public.current_role(v_uid) is null then
    raise exception 'FORBIDDEN_ROLE' using errcode = 'P0001';
  end if;

  v_title := btrim(coalesce(p_title, ''));
  v_body := btrim(coalesce(p_body, ''));

  if v_title = '' or v_body = '' then
    raise exception 'UNKNOWN' using errcode = 'P0001';
  end if;

  -- Minimal PII/content-block checks (TEMP baseline).
  -- Detects phone/email/account/address-like sensitive text.
  if
    (v_title || ' ' || v_body) ~* '([0-9]{2,3}[- ]?[0-9]{3,4}[- ]?[0-9]{4})'
    or (v_title || ' ' || v_body) ~* '[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}'
    or (v_title || ' ' || v_body) ~* '(계좌|은행|주소|주민등록|카드번호|연락처)'
  then
    raise exception 'CONTENT_BLOCKED' using errcode = 'P0001';
  end if;

  -- Serialize per-user submit flow to avoid rate-limit races.
  perform pg_advisory_xact_lock(hashtext(v_uid::text), hashtext('submit_story_rate_limited'));

  -- Idempotent replay by client_request_id (if provided).
  if p_client_request_id is not null then
    select s.id
    into v_story_id
    from public.stories s
    where s.author_id = v_uid
      and s.client_request_id = p_client_request_id
    limit 1;

    if found then
      return query
      select v_story_id, 'accepted'::text;
      return;
    end if;
  end if;

  -- TEMP threshold: max 3 writes per minute per user.
  select count(*)::integer
  into v_recent_count
  from public.stories s
  where s.author_id = v_uid
    and s.created_at >= (now() - interval '1 minute');

  if v_recent_count >= 3 then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;

  begin
    insert into public.stories (
      author_id,
      title,
      body,
      client_request_id
    )
    values (
      v_uid,
      v_title,
      v_body,
      p_client_request_id
    )
    returning id into v_story_id;
  exception
    when unique_violation then
      if p_client_request_id is not null then
        select s.id
        into v_story_id
        from public.stories s
        where s.author_id = v_uid
          and s.client_request_id = p_client_request_id
        limit 1;

        if found then
          return query
          select v_story_id, 'accepted'::text;
          return;
        end if;
      end if;
      raise;
  end;

  return query
  select v_story_id, 'accepted'::text;
end;
$$;

revoke all on function public.submit_story_rate_limited(text, text, uuid) from public;
grant execute on function public.submit_story_rate_limited(text, text, uuid) to authenticated;
