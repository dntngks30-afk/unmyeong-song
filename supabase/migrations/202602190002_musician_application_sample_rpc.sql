-- PR-NEXT-03 B: 뮤지션 승인 신청 시 샘플 경로 저장 RPC
-- 본인 pending 신청에만 sample_song_audio_path 설정 가능

create or replace function public.set_musician_application_sample_path(
  p_application_id uuid,
  p_sample_path text
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
  set sample_song_audio_path = btrim(p_sample_path),
      updated_at = now()
  where id = p_application_id
    and user_id = v_uid
    and status = 'pending'::public.application_status;
end;
$$;

revoke all on function public.set_musician_application_sample_path(uuid, text) from public;
grant execute on function public.set_musician_application_sample_path(uuid, text) to authenticated;
