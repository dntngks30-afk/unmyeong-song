-- Ticket 02.1 hotfix: true idempotency + concurrency hardening + secure search_path
-- SSOT: docs/contracts/schema.md, docs/contracts/api.md

-- 1) Concurrency/race hardening constraints
do $$
begin
  -- Drop overly broad global uniqueness if present.
  if exists (
    select 1
    from pg_constraint
    where conname = 'uq_votes_client_request_id'
      and conrelid = 'public.votes'::regclass
  ) then
    alter table public.votes drop constraint uq_votes_client_request_id;
  end if;

  -- Ensure duplicate same-track vote is physically blocked.
  if not exists (
    select 1
    from pg_constraint
    where conname = 'uq_votes_voter_track'
      and conrelid = 'public.votes'::regclass
  ) then
    alter table public.votes
      add constraint uq_votes_voter_track unique (voter_id, final_track_id);
  end if;

  -- Ensure idempotency key is per-user, not globally unique.
  if not exists (
    select 1
    from pg_constraint
    where conname = 'uq_votes_voter_client_request'
      and conrelid = 'public.votes'::regclass
  ) then
    alter table public.votes
      add constraint uq_votes_voter_client_request unique (voter_id, client_request_id);
  end if;
end
$$;

-- 2) RPC: idempotent success response + race-safe insert
drop function if exists public.cast_votes_max3(uuid, uuid, text);

create or replace function public.cast_votes_max3(
  p_final_track_id uuid,
  p_client_request_id uuid default null,
  p_device_fingerprint text default null
)
returns table (
  accepted boolean,
  remaining_votes integer,
  vote_count integer,
  vote_id uuid,
  voted_track_id uuid,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid;
  v_existing_count integer;
  v_request_id uuid;
  v_existing_vote_id uuid;
  v_existing_track_id uuid;
  v_inserted_vote_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  if public.current_role(v_uid) is null then
    raise exception 'FORBIDDEN_ROLE' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.final_tracks ft
    where ft.id = p_final_track_id
      and ft.status = 'top10'::public.final_track_status
  ) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Per-user transaction lock: serialize "count + insert" for same voter.
  perform pg_advisory_xact_lock(hashtext(v_uid::text), hashtext('cast_votes_max3'));

  v_request_id := coalesce(p_client_request_id, gen_random_uuid());

  -- True idempotency: same (user, client_request_id) -> success with same semantic response.
  select v.id, v.final_track_id
  into v_existing_vote_id, v_existing_track_id
  from public.votes v
  where v.voter_id = v_uid
    and v.client_request_id = v_request_id
  limit 1;

  if found then
    select count(*)::integer
    into v_existing_count
    from public.votes v
    where v.voter_id = v_uid;

    return query
    select
      true as accepted,
      greatest(0, 3 - v_existing_count) as remaining_votes,
      v_existing_count as vote_count,
      v_existing_vote_id as vote_id,
      v_existing_track_id as voted_track_id,
      true as idempotent_replay;
    return;
  end if;

  -- Same track duplicate with different request id is still an error.
  if exists (
    select 1
    from public.votes v
    where v.voter_id = v_uid
      and v.final_track_id = p_final_track_id
  ) then
    raise exception 'DUPLICATE_VOTE' using errcode = 'P0001';
  end if;

  select count(*)::integer
  into v_existing_count
  from public.votes v
  where v.voter_id = v_uid;

  if v_existing_count >= 3 then
    raise exception 'VOTE_LIMIT_EXCEEDED' using errcode = 'P0001';
  end if;

  begin
    insert into public.votes (
      voter_id,
      final_track_id,
      client_request_id,
      device_fingerprint
    )
    values (
      v_uid,
      p_final_track_id,
      v_request_id,
      p_device_fingerprint
    )
    returning id into v_inserted_vote_id;
  exception
    when unique_violation then
      -- Race fallback 1: same request replay inserted by concurrent tx.
      select v.id, v.final_track_id
      into v_existing_vote_id, v_existing_track_id
      from public.votes v
      where v.voter_id = v_uid
        and v.client_request_id = v_request_id
      limit 1;

      if found then
        select count(*)::integer
        into v_existing_count
        from public.votes v
        where v.voter_id = v_uid;

        return query
        select
          true as accepted,
          greatest(0, 3 - v_existing_count) as remaining_votes,
          v_existing_count as vote_count,
          v_existing_vote_id as vote_id,
          v_existing_track_id as voted_track_id,
          true as idempotent_replay;
        return;
      end if;

      -- Race fallback 2: same track duplicate inserted concurrently.
      if exists (
        select 1
        from public.votes v
        where v.voter_id = v_uid
          and v.final_track_id = p_final_track_id
      ) then
        raise exception 'DUPLICATE_VOTE' using errcode = 'P0001';
      end if;

      raise;
  end;

  select count(*)::integer
  into v_existing_count
  from public.votes v
  where v.voter_id = v_uid;

  return query
  select
    true as accepted,
    greatest(0, 3 - v_existing_count) as remaining_votes,
    v_existing_count as vote_count,
    v_inserted_vote_id as vote_id,
    p_final_track_id as voted_track_id,
    false as idempotent_replay;
end;
$$;

revoke all on function public.cast_votes_max3(uuid, uuid, text) from public;
grant execute on function public.cast_votes_max3(uuid, uuid, text) to authenticated;
