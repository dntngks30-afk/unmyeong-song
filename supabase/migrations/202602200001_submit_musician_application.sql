-- PR-NEXT-05: 뮤지션 승인 신청 '제출' RPC - idempotent
-- sample_song_audio_path 존재 시에만 제출 가능, status=pending 유지

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

  select id, user_id, sample_song_audio_path, status
  into v_row
  from public.musician_applications
  where id = p_application_id and user_id = v_uid
  limit 1;

  if v_row.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_row.sample_song_audio_path is null or btrim(v_row.sample_song_audio_path) = '' then
    raise exception 'SAMPLE_REQUIRED' using errcode = 'P0003';
  end if;

  if v_row.status != 'pending' then
    return; -- idempotent: already submitted
  end if;

  -- already valid: sample exists, status pending. No further update needed.
  return;
end;
$$;

revoke all on function public.submit_musician_application(uuid) from public;
grant execute on function public.submit_musician_application(uuid) to authenticated;
