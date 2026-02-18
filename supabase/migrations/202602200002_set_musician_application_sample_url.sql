-- PR: musician signup sample_song_url support
-- 본인 pending 신청에만 sample_song_url 설정 가능

create or replace function public.set_musician_application_sample_url(
  p_application_id uuid,
  p_sample_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  update public.musician_applications
  set sample_song_url = btrim(nullif(p_sample_url, '')),
      updated_at = now()
  where id = p_application_id
    and user_id = v_uid
    and status = 'pending'::public.application_status;
end;
$$;

revoke all on function public.set_musician_application_sample_url(uuid, text) from public;
grant execute on function public.set_musician_application_sample_url(uuid, text) to authenticated;

-- Extend submit to accept sample_song_url OR sample_song_audio_path
create or replace function public.submit_musician_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_row record;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  select id, user_id, sample_song_audio_path, sample_song_url, status
  into v_row
  from public.musician_applications
  where id = p_application_id and user_id = v_uid
  limit 1;

  if v_row.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if (v_row.sample_song_audio_path is null or btrim(v_row.sample_song_audio_path) = '')
     and (v_row.sample_song_url is null or btrim(v_row.sample_song_url) = '') then
    raise exception 'SAMPLE_REQUIRED' using errcode = 'P0003';
  end if;

  if v_row.status != 'pending' then
    return;
  end if;

  return;
end;
$$;
