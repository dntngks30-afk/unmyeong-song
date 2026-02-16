-- Ticket 02: votes RPC and RLS hardening
-- Source of truth: docs/contracts/schema.md, docs/contracts/api.md

create or replace function public.cast_votes_max3(
  p_final_track_id uuid,
  p_client_request_id uuid default null,
  p_device_fingerprint text default null
)
returns table (
  accepted boolean,
  remaining_votes integer,
  vote_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_existing_count integer;
  v_already_voted boolean;
  v_request_id uuid;
begin
  v_uid := auth.uid();

  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  if public.current_role(v_uid) is null then
    raise exception 'FORBIDDEN_ROLE' using errcode = 'P0001';
  end if;

  -- only top10 tracks are voteable
  if not exists (
    select 1
    from public.final_tracks ft
    where ft.id = p_final_track_id
      and ft.status = 'top10'::public.final_track_status
  ) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  select exists(
    select 1
    from public.votes v
    where v.voter_id = v_uid
      and v.final_track_id = p_final_track_id
  ) into v_already_voted;

  if v_already_voted then
    raise exception 'DUPLICATE_VOTE' using errcode = 'P0001';
  end if;

  select count(*)
  into v_existing_count
  from public.votes v
  where v.voter_id = v_uid;

  if v_existing_count >= 3 then
    raise exception 'VOTE_LIMIT_EXCEEDED' using errcode = 'P0001';
  end if;

  v_request_id := coalesce(p_client_request_id, gen_random_uuid());

  if exists (
    select 1
    from public.votes v
    where v.client_request_id = v_request_id
  ) then
    raise exception 'DUPLICATE_VOTE' using errcode = 'P0001';
  end if;

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
  );

  return query
  select
    true as accepted,
    3 - count(*)::integer as remaining_votes,
    count(*)::integer as vote_count
  from public.votes v
  where v.voter_id = v_uid;
end;
$$;

revoke all on function public.cast_votes_max3(uuid, uuid, text) from public;
grant execute on function public.cast_votes_max3(uuid, uuid, text) to authenticated;

-- votes RLS hardening: insert only on top10 target and self
drop policy if exists votes_insert_owner on public.votes;
drop policy if exists votes_insert_owner_top10_only on public.votes;
create policy votes_insert_owner_top10_only
on public.votes
for insert
with check (
  voter_id = auth.uid()
  and public.current_role(auth.uid()) in ('viewer'::public.user_role, 'artist'::public.user_role, 'admin'::public.user_role)
  and exists (
    select 1
    from public.final_tracks ft
    where ft.id = votes.final_track_id
      and ft.status = 'top10'::public.final_track_status
  )
);
