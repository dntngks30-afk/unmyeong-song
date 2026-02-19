-- PR03: story votes + best stories
-- SSOT: docs/contracts/schema.md, docs/contracts/api.md

create table if not exists public.story_votes (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  client_request_id uuid not null,
  created_at timestamptz not null default now(),
  constraint uq_story_votes_voter_story unique (voter_id, story_id),
  constraint uq_story_votes_voter_client_request unique (voter_id, client_request_id)
);

create index if not exists idx_story_votes_story_created_at
  on public.story_votes (story_id, created_at desc);

create index if not exists idx_story_votes_voter_created_at
  on public.story_votes (voter_id, created_at desc);

alter table public.story_votes enable row level security;

drop policy if exists story_votes_insert_owner on public.story_votes;
create policy story_votes_insert_owner
on public.story_votes
for insert
to authenticated
with check (voter_id = auth.uid());

drop policy if exists story_votes_select_self_or_admin on public.story_votes;
create policy story_votes_select_self_or_admin
on public.story_votes
for select
to authenticated
using (voter_id = auth.uid() or public.is_admin(auth.uid()));

create or replace function public.get_story_vote_count(p_story_id uuid)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::int
  from public.story_votes sv
  where sv.story_id = p_story_id
$$;

create or replace view public.best_stories_v as
select
  s.id,
  s.title,
  s.body,
  s.created_at,
  s.author_id,
  public.get_story_vote_count(s.id) as vote_count
from public.stories s
where s.is_blocked = false
order by vote_count desc, s.created_at desc;

grant select on public.best_stories_v to anon, authenticated;

drop function if exists public.cast_story_vote_max1(uuid, uuid);
create or replace function public.cast_story_vote_max1(
  p_story_id uuid,
  p_client_request_id uuid
)
returns table (
  story_id uuid,
  vote_id uuid,
  story_vote_count int,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_existing_id uuid;
  v_existing_story_id uuid;
  v_inserted_id uuid;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if p_story_id is null or p_client_request_id is null then
    raise exception using errcode = 'P0001', message = 'INVALID_ARGUMENT';
  end if;

  if not exists (
    select 1
    from public.stories s
    where s.id = p_story_id
      and s.is_blocked = false
  ) then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;

  select sv.id, sv.story_id
    into v_existing_id, v_existing_story_id
  from public.story_votes sv
  where sv.voter_id = v_uid
    and sv.client_request_id = p_client_request_id
  limit 1;

  if v_existing_id is not null then
    return query
    select
      v_existing_story_id as story_id,
      v_existing_id as vote_id,
      public.get_story_vote_count(v_existing_story_id) as story_vote_count,
      true as idempotent_replay;
    return;
  end if;

  if exists (
    select 1
    from public.story_votes sv
    where sv.voter_id = v_uid
      and sv.story_id = p_story_id
  ) then
    raise exception using errcode = 'P0001', message = 'DUPLICATE_VOTE';
  end if;

  insert into public.story_votes (story_id, voter_id, client_request_id)
  values (p_story_id, v_uid, p_client_request_id)
  returning id into v_inserted_id;

  return query
  select
    p_story_id as story_id,
    v_inserted_id as vote_id,
    public.get_story_vote_count(p_story_id) as story_vote_count,
    false as idempotent_replay;
end;
$$;

revoke all on function public.cast_story_vote_max1(uuid, uuid) from public;
grant execute on function public.cast_story_vote_max1(uuid, uuid) to authenticated;
