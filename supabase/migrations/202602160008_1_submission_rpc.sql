-- Ticket 08.1: complete_song_submission RPC (ownership + storage path validation)
-- SSOT: docs/contracts/schema.md, docs/contracts/api.md
-- TEMP: making_note length bounds 1..2000 (until SSOT explicit bound is finalized)

drop function if exists public.complete_song_submission(uuid, text, text, text);

create or replace function public.complete_song_submission(
  p_song_id uuid,
  p_audio_path text,
  p_cover_path text default null,
  p_making_note text default null
)
returns table (
  song_id uuid,
  audio_path text,
  cover_path text,
  status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid;
  v_role public.user_role;
  v_song public.songs%rowtype;
  v_making_note text;
  v_expected_prefix text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  v_role := public.current_role(v_uid);
  if v_role is null then
    raise exception 'FORBIDDEN_ROLE' using errcode = 'P0001';
  end if;
  if v_role not in ('artist'::public.user_role, 'admin'::public.user_role) then
    raise exception 'FORBIDDEN_ROLE' using errcode = 'P0001';
  end if;

  select s.*
  into v_song
  from public.songs s
  where s.id = p_song_id
  limit 1;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Owner-only submit finalize (admin also requires ownership by contract).
  if v_song.artist_id <> v_uid then
    raise exception 'FORBIDDEN_ROLE' using errcode = 'P0001';
  end if;

  v_making_note := btrim(coalesce(p_making_note, ''));
  if v_making_note = '' or char_length(v_making_note) > 2000 then
    raise exception 'UNKNOWN' using errcode = 'P0001';
  end if;

  if p_audio_path is null or btrim(p_audio_path) = '' then
    raise exception 'STORAGE_PATH_INVALID' using errcode = 'P0001';
  end if;

  v_expected_prefix := format('artist/%s/song/%s/', v_uid::text, p_song_id::text);

  -- audio path validation: bucket mapping + exact owner/song prefix.
  if left(p_audio_path, char_length(v_expected_prefix)) <> v_expected_prefix then
    raise exception 'STORAGE_PATH_INVALID' using errcode = 'P0001';
  end if;
  if not public.validate_storage_path('song-audio', p_audio_path, v_uid) then
    raise exception 'STORAGE_PATH_INVALID' using errcode = 'P0001';
  end if;

  if p_cover_path is not null and btrim(p_cover_path) <> '' then
    if left(p_cover_path, char_length(v_expected_prefix)) <> v_expected_prefix then
      raise exception 'STORAGE_PATH_INVALID' using errcode = 'P0001';
    end if;
    if not public.validate_storage_path('song-cover', p_cover_path, v_uid) then
      raise exception 'STORAGE_PATH_INVALID' using errcode = 'P0001';
    end if;
  end if;

  update public.songs s
  set
    audio_path = p_audio_path,
    cover_path = case
      when p_cover_path is null or btrim(p_cover_path) = '' then null
      else p_cover_path
    end,
    making_note = v_making_note,
    status = 'submitted'::public.submission_status
  where s.id = p_song_id
  returning s.id, s.audio_path, s.cover_path, s.status::text
  into song_id, audio_path, cover_path, status;

  return next;
end;
$$;

revoke all on function public.complete_song_submission(uuid, text, text, text) from public;
grant execute on function public.complete_song_submission(uuid, text, text, text) to authenticated;
