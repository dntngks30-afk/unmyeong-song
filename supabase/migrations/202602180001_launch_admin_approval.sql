-- PR-LAUNCH-01: 승인제 운영 (stories/profiles/tracks)
-- SSOT: docs/plan/execution-logs/launch-admin-ops.md
-- 최소 변경: story_status, is_musician_approved, approved_at/by

-- 1) story_status enum + stories 컬럼
do $$
begin
  if not exists (select 1 from pg_type where typname = 'story_status') then
    create type public.story_status as enum ('pending', 'approved', 'rejected');
  end if;
end
$$;

alter table public.stories
  add column if not exists story_status public.story_status not null default 'pending',
  add column if not exists approved_at timestamptz null,
  add column if not exists approved_by uuid null references public.profiles(id) on delete set null;

update public.stories
set story_status = 'approved'::public.story_status,
    approved_at = coalesce(approved_at, created_at),
    approved_by = coalesce(approved_by, author_id)
where story_status = 'pending'
  and is_blocked = false;

create index if not exists idx_stories_story_status on public.stories (story_status);

-- 2) profiles.is_musician_approved (업로드/제출 버튼 활성화 조건)
alter table public.profiles
  add column if not exists is_musician_approved boolean not null default false,
  add column if not exists is_admin boolean not null default false;

update public.profiles
set is_admin = (role = 'admin'::public.user_role);

update public.profiles
set is_musician_approved = true
where role in ('artist'::public.user_role, 'admin'::public.user_role)
  and is_musician_approved = false;

create or replace function public.sync_profile_is_admin()
returns trigger
language plpgsql
as $$
begin
  new.is_admin := (new.role = 'admin'::public.user_role);
  return new;
end;
$$;

drop trigger if exists trg_profiles_sync_is_admin on public.profiles;
create trigger trg_profiles_sync_is_admin
before insert or update of role on public.profiles
for each row execute function public.sync_profile_is_admin();

-- 3) final_tracks approved_at, approved_by (감사용, 선택)
alter table public.final_tracks
  add column if not exists approved_at timestamptz null,
  add column if not exists approved_by uuid null references public.profiles(id) on delete set null;

-- 4) is_admin 함수를 profiles.is_admin 우선 사용하도록 (호환)
create or replace function public.is_admin(p_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = p_uid limit 1),
    (select p.role = 'admin'::public.user_role from public.profiles p where p.id = p_uid limit 1),
    false
  )
$$;

-- 5) Stories RLS: 공개 리스트는 approved만, owner/admin은 전체
drop policy if exists stories_select_authenticated on public.stories;
drop policy if exists stories_select_public_owner_admin on public.stories;

create policy stories_select_public_approved_or_owner_admin
on public.stories
for select
using (
  (story_status = 'approved'::public.story_status and is_blocked = false)
  or (coalesce(user_id, author_id) = auth.uid())
  or public.is_admin(auth.uid())
);

-- Admin만 story_status/approved_at/approved_by 변경 가능 (update 정책은 owner OR admin)
-- owner: title, body, content 등만. admin: story_status, approved_at, approved_by 변경.
-- RLS는 row-level이므로, 동일 정책. app/trigger에서 admin만 status 변경하도록.
-- 기존 stories_update_owner_user_id가 owner만 update 가능. Admin은?
drop policy if exists stories_update_owner_user_id on public.stories;

create policy stories_update_owner_or_admin
on public.stories
for update
using (
  coalesce(user_id, author_id) = auth.uid() or public.is_admin(auth.uid())
)
with check (
  coalesce(user_id, author_id) = auth.uid() or public.is_admin(auth.uid())
);

-- 6) Songs insert: is_musician_approved OR is_admin 필수
drop policy if exists songs_insert_owner_artist_or_admin on public.songs;

create policy songs_insert_approved_musician_or_admin
on public.songs
for insert
with check (
  artist_id = auth.uid()
  and (
    public.is_admin(auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_musician_approved = true
    )
  )
);

-- 7) Musician application 승인 시 profiles.is_musician_approved, role 설정을 위한 RPC
create or replace function public.approve_musician_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_user_id uuid;
begin
  v_uid := auth.uid();
  if not public.is_admin(v_uid) then
    raise exception 'FORBIDDEN_ROLE' using errcode = 'P0001';
  end if;

  update public.musician_applications
  set status = 'approved'::public.application_status,
      updated_at = now()
  where id = p_application_id
    and status = 'pending'::public.application_status
  returning user_id into v_user_id;

  if v_user_id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  update public.profiles
  set is_musician_approved = true,
      role = case when role = 'viewer'::public.user_role then 'artist'::public.user_role else role end,
      updated_at = now()
  where id = v_user_id;
end;
$$;

create or replace function public.reject_musician_application(p_application_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'FORBIDDEN_ROLE' using errcode = 'P0001';
  end if;

  update public.musician_applications
  set status = 'rejected'::public.application_status,
      review_note = p_note,
      updated_at = now()
  where id = p_application_id
    and status = 'pending'::public.application_status;
end;
$$;

revoke all on function public.approve_musician_application(uuid) from public;
grant execute on function public.approve_musician_application(uuid) to authenticated;
revoke all on function public.reject_musician_application(uuid, text) from public;
grant execute on function public.reject_musician_application(uuid, text) to authenticated;

-- 8) Story approve/reject RPC
create or replace function public.approve_story(p_story_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'FORBIDDEN_ROLE' using errcode = 'P0001';
  end if;

  update public.stories
  set story_status = 'approved'::public.story_status,
      approved_at = now(),
      approved_by = auth.uid(),
      updated_at = now()
  where id = p_story_id
    and story_status = 'pending'::public.story_status;
end;
$$;

create or replace function public.reject_story(p_story_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'FORBIDDEN_ROLE' using errcode = 'P0001';
  end if;

  update public.stories
  set story_status = 'rejected'::public.story_status,
      approved_at = now(),
      approved_by = auth.uid(),
      updated_at = now()
  where id = p_story_id
    and story_status = 'pending'::public.story_status;
end;
$$;

revoke all on function public.approve_story(uuid) from public;
grant execute on function public.approve_story(uuid) to authenticated;
revoke all on function public.reject_story(uuid) from public;
grant execute on function public.reject_story(uuid) to authenticated;

-- 9) Final track approve(reject) RPC - status를 top10(removed)로
create or replace function public.approve_final_track(p_final_track_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'FORBIDDEN_ROLE' using errcode = 'P0001';
  end if;

  update public.final_tracks
  set status = 'top10'::public.final_track_status,
      approved_at = now(),
      approved_by = auth.uid()
  where id = p_final_track_id
    and status = 'candidate'::public.final_track_status;
end;
$$;

create or replace function public.reject_final_track(p_final_track_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'FORBIDDEN_ROLE' using errcode = 'P0001';
  end if;

  update public.final_tracks
  set status = 'removed'::public.final_track_status,
      approved_at = now(),
      approved_by = auth.uid()
  where id = p_final_track_id
    and status = 'candidate'::public.final_track_status;
end;
$$;

revoke all on function public.approve_final_track(uuid) from public;
grant execute on function public.approve_final_track(uuid) to authenticated;
revoke all on function public.reject_final_track(uuid) from public;
grant execute on function public.reject_final_track(uuid) to authenticated;

-- 10) Undo musician approval (admin only)
create or replace function public.undo_musician_approval(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'FORBIDDEN_ROLE' using errcode = 'P0001';
  end if;

  update public.profiles
  set is_musician_approved = false,
      role = case when role = 'admin'::public.user_role then role else 'viewer'::public.user_role end,
      updated_at = now()
  where id = p_user_id
    and is_musician_approved = true;
end;
$$;

revoke all on function public.undo_musician_approval(uuid) from public;
grant execute on function public.undo_musician_approval(uuid) to authenticated;
