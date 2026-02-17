-- PR-BE-02-STORIES
-- Release-safe hardening for stories schema + RLS (additive only)

alter table public.stories
  add column if not exists user_id uuid;

alter table public.stories
  add column if not exists content text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'stories_user_id_fkey'
      and conrelid = 'public.stories'::regclass
  ) then
    alter table public.stories
      add constraint stories_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end
$$;

update public.stories
set user_id = coalesce(user_id, author_id),
    content = coalesce(content, body)
where user_id is null
   or content is null;

create index if not exists idx_stories_user_created_at_desc
  on public.stories (user_id, created_at desc);

create or replace function public.sync_stories_legacy_columns()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is null and new.author_id is not null then
    new.user_id := new.author_id;
  end if;
  if new.author_id is null and new.user_id is not null then
    new.author_id := new.user_id;
  end if;

  if new.content is null and new.body is not null then
    new.content := new.body;
  end if;
  if new.body is null and new.content is not null then
    new.body := new.content;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_stories_sync_legacy_columns on public.stories;
create trigger trg_stories_sync_legacy_columns
before insert or update on public.stories
for each row execute function public.sync_stories_legacy_columns();

alter table public.stories enable row level security;

drop policy if exists stories_select_public_owner_admin on public.stories;
drop policy if exists stories_insert_owner on public.stories;
drop policy if exists stories_update_owner_or_admin on public.stories;
drop policy if exists stories_delete_owner_or_admin on public.stories;

drop policy if exists stories_select_authenticated on public.stories;
create policy stories_select_authenticated
on public.stories
for select
using (auth.role() = 'authenticated');

drop policy if exists stories_insert_owner_user_id on public.stories;
create policy stories_insert_owner_user_id
on public.stories
for insert
with check (auth.uid() = user_id);

drop policy if exists stories_update_owner_user_id on public.stories;
create policy stories_update_owner_user_id
on public.stories
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists stories_delete_owner_user_id on public.stories;
create policy stories_delete_owner_user_id
on public.stories
for delete
using (auth.uid() = user_id);
