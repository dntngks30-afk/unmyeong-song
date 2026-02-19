-- PR02: signup branching support (viewer vs musician application)
-- SSOT: docs/contracts/schema.md, docs/contracts/api.md

do $$
begin
  if not exists (select 1 from pg_type where typname = 'application_status') then
    create type public.application_status as enum ('pending', 'approved', 'rejected');
  end if;
end
$$;

alter table public.profiles
  add column if not exists nickname text null,
  add column if not exists age int null,
  add column if not exists gender text null,
  add column if not exists favorite_genre text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_age_range_ck'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_age_range_ck check (age is null or (age >= 1 and age <= 120));
  end if;
end
$$;

create table if not exists public.musician_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  bio text not null,
  portfolio_url text null,
  sample_song_url text null,
  sample_song_audio_path text null,
  status public.application_status not null default 'pending',
  review_note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_musician_applications_user_status
  on public.musician_applications (user_id, status);

create index if not exists idx_musician_applications_created_at
  on public.musician_applications (created_at desc);

create trigger trg_musician_applications_set_updated_at
before update on public.musician_applications
for each row
execute function public.set_updated_at();

alter table public.musician_applications enable row level security;

drop policy if exists musician_applications_insert_self on public.musician_applications;
create policy musician_applications_insert_self
on public.musician_applications
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists musician_applications_select_self_or_admin on public.musician_applications;
create policy musician_applications_select_self_or_admin
on public.musician_applications
for select
to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists musician_applications_update_admin_only on public.musician_applications;
create policy musician_applications_update_admin_only
on public.musician_applications
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));
