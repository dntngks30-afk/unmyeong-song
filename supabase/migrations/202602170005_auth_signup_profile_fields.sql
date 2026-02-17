-- PR08: auth/signup profile split fields and musician sample upload path support
-- SSOT: docs/contracts/schema.md, docs/contracts/ux-flows.md

alter table public.profiles
  add column if not exists preferred_genres text[] not null default '{}';

alter table public.musician_applications
  add column if not exists artist_name text null;

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

  if v_parts[1] <> 'artist' or v_parts[2] <> p_uid::text then
    return false;
  end if;

  -- 제출 곡 업로드 경로: artist/{uid}/song/{song_id}/audio|cover
  if coalesce(array_length(v_parts, 1), 0) = 5 and v_parts[3] = 'song' then
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
  end if;

  -- 뮤지션 가입 샘플 경로: artist/{uid}/application/{uuid}/sample.mp3
  if coalesce(array_length(v_parts, 1), 0) = 5 and v_parts[3] = 'application' then
    if p_bucket_id <> 'song-audio' then
      return false;
    end if;
    begin
      perform v_parts[4]::uuid;
    exception
      when invalid_text_representation then
        return false;
    end;
    v_filename := lower(v_parts[5]);
    return v_filename = 'sample.mp3';
  end if;

  return false;
end;
$$;
