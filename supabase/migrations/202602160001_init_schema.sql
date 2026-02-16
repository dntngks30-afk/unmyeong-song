-- Ticket 01: Base schema, enums, constraints, indexes, and RLS skeleton
-- Source of truth: docs/contracts/schema.md

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('viewer', 'artist', 'admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'submission_status') then
    create type public.submission_status as enum ('draft', 'submitted', 'approved', 'rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'report_status') then
    create type public.report_status as enum ('open', 'in_review', 'resolved', 'dismissed');
  end if;
  if not exists (select 1 from pg_type where typname = 'final_track_status') then
    create type public.final_track_status as enum ('candidate', 'top10', 'removed');
  end if;
  if not exists (select 1 from pg_type where typname = 'entitlement_status') then
    create type public.entitlement_status as enum ('inactive', 'active', 'grace', 'revoked');
  end if;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'viewer',
  display_name text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  is_blocked boolean not null default false,
  block_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  audio_path text not null,
  cover_path text null,
  making_note text not null,
  status public.submission_status not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.final_tracks (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null unique references public.songs(id) on delete cascade,
  rank_order int null,
  status public.final_track_status not null default 'candidate',
  published_at timestamptz null,
  created_at timestamptz not null default now()
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  voter_id uuid not null references public.profiles(id) on delete cascade,
  final_track_id uuid not null references public.final_tracks(id) on delete cascade,
  device_fingerprint text null,
  client_request_id uuid not null,
  created_at timestamptz not null default now(),
  constraint uq_votes_voter_track unique (voter_id, final_track_id),
  constraint uq_votes_client_request_id unique (client_request_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('story', 'song')),
  target_id uuid not null,
  reason text not null,
  status public.report_status not null default 'open',
  score int not null default 1 check (score > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.moderation_queue (
  id uuid primary key default gen_random_uuid(),
  source_report_id uuid not null unique references public.reports(id) on delete cascade,
  target_type text not null check (target_type in ('story', 'song')),
  target_id uuid not null,
  queue_status public.report_status not null default 'open',
  risk_level text not null default 'low' check (risk_level in ('low', 'medium', 'high')),
  threshold_reached_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  status public.entitlement_status not null default 'inactive',
  source text not null check (source in ('app_store', 'play_store', 'manual')),
  expires_at timestamptz null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_stories_created_at on public.stories (created_at desc);
create index if not exists idx_stories_author_id on public.stories (author_id);
create index if not exists idx_stories_is_blocked_created_at on public.stories (is_blocked, created_at desc);
create index if not exists idx_songs_artist_id_created_at on public.songs (artist_id, created_at desc);
create index if not exists idx_songs_status_created_at on public.songs (status, created_at desc);
create index if not exists idx_final_tracks_status_rank on public.final_tracks (status, rank_order);
create index if not exists idx_votes_voter_created_at on public.votes (voter_id, created_at desc);
create index if not exists idx_votes_final_track on public.votes (final_track_id);
create index if not exists idx_reports_target on public.reports (target_type, target_id);
create index if not exists idx_reports_status_created_at on public.reports (status, created_at desc);
create index if not exists idx_mq_queue_status_created_at on public.moderation_queue (queue_status, created_at desc);
create index if not exists idx_mq_risk_level on public.moderation_queue (risk_level);

create or replace function public.current_role(p_uid uuid default auth.uid())
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = p_uid
  limit 1
$$;

create or replace function public.is_admin(p_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role(p_uid) = 'admin'::public.user_role, false)
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_stories_set_updated_at on public.stories;
create trigger trg_stories_set_updated_at
before update on public.stories
for each row execute function public.set_updated_at();

drop trigger if exists trg_songs_set_updated_at on public.songs;
create trigger trg_songs_set_updated_at
before update on public.songs
for each row execute function public.set_updated_at();

drop trigger if exists trg_moderation_queue_set_updated_at on public.moderation_queue;
create trigger trg_moderation_queue_set_updated_at
before update on public.moderation_queue
for each row execute function public.set_updated_at();

drop trigger if exists trg_entitlements_set_updated_at on public.entitlements;
create trigger trg_entitlements_set_updated_at
before update on public.entitlements
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.stories enable row level security;
alter table public.songs enable row level security;
alter table public.final_tracks enable row level security;
alter table public.votes enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_queue enable row level security;
alter table public.entitlements enable row level security;

drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin
on public.profiles
for select
using (auth.uid() = id or public.is_admin(auth.uid()));

drop policy if exists profiles_insert_self_or_admin on public.profiles;
create policy profiles_insert_self_or_admin
on public.profiles
for insert
with check (auth.uid() = id or public.is_admin(auth.uid()));

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin
on public.profiles
for update
using (auth.uid() = id or public.is_admin(auth.uid()))
with check (auth.uid() = id or public.is_admin(auth.uid()));

drop policy if exists stories_select_public_owner_admin on public.stories;
create policy stories_select_public_owner_admin
on public.stories
for select
using (is_blocked = false or author_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists stories_insert_owner on public.stories;
create policy stories_insert_owner
on public.stories
for insert
with check (author_id = auth.uid());

drop policy if exists stories_update_owner_or_admin on public.stories;
create policy stories_update_owner_or_admin
on public.stories
for update
using (author_id = auth.uid() or public.is_admin(auth.uid()))
with check (author_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists stories_delete_owner_or_admin on public.stories;
create policy stories_delete_owner_or_admin
on public.stories
for delete
using (author_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists songs_select_public_owner_admin on public.songs;
create policy songs_select_public_owner_admin
on public.songs
for select
using (status = 'approved'::public.submission_status or artist_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists songs_insert_owner_artist_or_admin on public.songs;
create policy songs_insert_owner_artist_or_admin
on public.songs
for insert
with check (
  artist_id = auth.uid()
  and public.current_role(auth.uid()) in ('artist'::public.user_role, 'admin'::public.user_role)
);

drop policy if exists songs_update_owner_artist_or_admin on public.songs;
create policy songs_update_owner_artist_or_admin
on public.songs
for update
using (
  (artist_id = auth.uid() and public.current_role(auth.uid()) in ('artist'::public.user_role, 'admin'::public.user_role))
  or public.is_admin(auth.uid())
)
with check (
  (artist_id = auth.uid() and public.current_role(auth.uid()) in ('artist'::public.user_role, 'admin'::public.user_role))
  or public.is_admin(auth.uid())
);

drop policy if exists final_tracks_select_public_or_admin on public.final_tracks;
create policy final_tracks_select_public_or_admin
on public.final_tracks
for select
using (status = 'top10'::public.final_track_status or public.is_admin(auth.uid()));

drop policy if exists final_tracks_all_admin on public.final_tracks;
create policy final_tracks_all_admin
on public.final_tracks
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists votes_select_self_or_admin on public.votes;
create policy votes_select_self_or_admin
on public.votes
for select
using (voter_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists votes_insert_owner on public.votes;
create policy votes_insert_owner
on public.votes
for insert
with check (
  voter_id = auth.uid()
  and public.current_role(auth.uid()) in ('viewer'::public.user_role, 'artist'::public.user_role, 'admin'::public.user_role)
);

drop policy if exists reports_select_self_or_admin on public.reports;
create policy reports_select_self_or_admin
on public.reports
for select
using (reporter_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists reports_insert_owner on public.reports;
create policy reports_insert_owner
on public.reports
for insert
with check (
  reporter_id = auth.uid()
  and public.current_role(auth.uid()) in ('viewer'::public.user_role, 'artist'::public.user_role, 'admin'::public.user_role)
);

drop policy if exists reports_update_admin_only on public.reports;
create policy reports_update_admin_only
on public.reports
for update
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists moderation_queue_select_admin_only on public.moderation_queue;
create policy moderation_queue_select_admin_only
on public.moderation_queue
for select
using (public.is_admin(auth.uid()));

drop policy if exists moderation_queue_update_admin_only on public.moderation_queue;
create policy moderation_queue_update_admin_only
on public.moderation_queue
for update
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists entitlements_select_self_or_admin on public.entitlements;
create policy entitlements_select_self_or_admin
on public.entitlements
for select
using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists entitlements_insert_admin_only on public.entitlements;
create policy entitlements_insert_admin_only
on public.entitlements
for insert
with check (public.is_admin(auth.uid()));

drop policy if exists entitlements_update_admin_only on public.entitlements;
create policy entitlements_update_admin_only
on public.entitlements
for update
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));
