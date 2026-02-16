-- Ticket 04: storage buckets/path/access rules
-- SSOT: docs/contracts/schema.md, docs/contracts/api.md

-- 1) Buckets (private by default)
insert into storage.buckets (id, name, public)
values
  ('song-audio', 'song-audio', false),
  ('song-cover', 'song-cover', false)
on conflict (id) do update
set
  name = excluded.name,
  public = false;

-- 2) Helper: validate storage object path and ownership
create or replace function public.validate_storage_path(
  p_bucket_id text,
  p_object_name text,
  p_uid uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_parts text[];
  v_song_id uuid;
  v_filename text;
begin
  if p_uid is null then
    return false;
  end if;

  if p_bucket_id not in ('song-audio', 'song-cover') then
    return false;
  end if;

  if p_object_name is null or length(trim(p_object_name)) = 0 then
    return false;
  end if;

  v_parts := string_to_array(p_object_name, '/');
  if coalesce(array_length(v_parts, 1), 0) <> 5 then
    return false;
  end if;

  if v_parts[1] <> 'artist' then
    return false;
  end if;

  if v_parts[2] <> p_uid::text then
    return false;
  end if;

  if v_parts[3] <> 'song' then
    return false;
  end if;

  begin
    v_song_id := v_parts[4]::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;

  if not exists (
    select 1
    from public.songs s
    where s.id = v_song_id
      and s.artist_id = p_uid
  ) then
    return false;
  end if;

  v_filename := lower(v_parts[5]);

  if p_bucket_id = 'song-audio' then
    return v_filename ~ '^audio\.(mp3|m4a|wav)$';
  end if;

  if p_bucket_id = 'song-cover' then
    return v_filename ~ '^cover\.(jpg|jpeg|png|webp)$';
  end if;

  return false;
end;
$$;

-- 3) Storage object access policies
-- NOTE: storage.objects is Supabase-managed; do not run ALTER TABLE ... ENABLE RLS
-- because ownership is not granted in hosted environments (SQLSTATE 42501).

drop policy if exists storage_objects_select_owner_or_admin on storage.objects;
create policy storage_objects_select_owner_or_admin
on storage.objects
for select
using (
  bucket_id in ('song-audio', 'song-cover')
  and (
    owner = auth.uid()
    or public.is_admin(auth.uid())
    or auth.role() = 'service_role'
  )
);

drop policy if exists storage_objects_insert_owner_valid_path on storage.objects;
create policy storage_objects_insert_owner_valid_path
on storage.objects
for insert
with check (
  bucket_id in ('song-audio', 'song-cover')
  and owner = auth.uid()
  and public.validate_storage_path(bucket_id, name, auth.uid())
);

drop policy if exists storage_objects_update_owner_valid_path on storage.objects;
create policy storage_objects_update_owner_valid_path
on storage.objects
for update
using (
  bucket_id in ('song-audio', 'song-cover')
  and (
    owner = auth.uid()
    or public.is_admin(auth.uid())
    or auth.role() = 'service_role'
  )
)
with check (
  bucket_id in ('song-audio', 'song-cover')
  and (
    (
      owner = auth.uid()
      and public.validate_storage_path(bucket_id, name, auth.uid())
    )
    or public.is_admin(auth.uid())
    or auth.role() = 'service_role'
  )
);

drop policy if exists storage_objects_delete_owner_or_admin on storage.objects;
create policy storage_objects_delete_owner_or_admin
on storage.objects
for delete
using (
  bucket_id in ('song-audio', 'song-cover')
  and (
    owner = auth.uid()
    or public.is_admin(auth.uid())
    or auth.role() = 'service_role'
  )
);
