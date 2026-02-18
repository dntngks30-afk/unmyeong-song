-- PR-LAUNCH-02: play_count + increment_track_play + create_draft_song
-- SSOT: docs/plan/execution-logs/show-mp3-pipeline.md
-- 최소 변경: final_tracks.play_count, RPC

-- 1) final_tracks.play_count
alter table public.final_tracks
  add column if not exists play_count int not null default 0;

-- 2) final_tracks_public_v에 play_count 추가
create or replace view public.final_tracks_public_v as
select
  ft.id as id,
  s.title as title,
  coalesce(nullif(btrim(p.display_name), ''), '익명 뮤지션') as artist,
  coalesce(ft.rank_order, row_number() over (order by ft.created_at asc, ft.id asc))::int as rank,
  coalesce(ft.play_count, 0) as play_count
from public.final_tracks ft
join public.songs s
  on s.id = ft.song_id
left join public.profiles p
  on p.id = s.artist_id
where ft.status = 'top10'::public.final_track_status;

grant select on public.final_tracks_public_v to anon, authenticated;

-- 3) increment_track_play RPC (재생 클릭 1회당 1회, 앱에서 5분 중복 방지)
create or replace function public.increment_track_play(p_final_track_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.final_tracks
  set play_count = coalesce(play_count, 0) + 1
  where id = p_final_track_id
    and status = 'top10'::public.final_track_status;
end;
$$;

revoke all on function public.increment_track_play(uuid) from public;
grant execute on function public.increment_track_play(uuid) to authenticated;

-- 4) create_draft_song: 업로드 전 곡 행 생성 (승인된 뮤지션만)
create or replace function public.create_draft_song(p_title text default '')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_song_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  if not (
    public.is_admin(v_uid)
    or exists (
      select 1 from public.profiles p
      where p.id = v_uid and p.is_musician_approved = true
    )
  ) then
    raise exception 'FORBIDDEN_ROLE' using errcode = 'P0001';
  end if;

  v_song_id := gen_random_uuid();

  insert into public.songs (id, artist_id, title, audio_path, making_note, status)
  values (
    v_song_id,
    v_uid,
    coalesce(nullif(btrim(p_title), ''), '제목 없음'),
    format('artist/%s/song/%s/audio.mp3', v_uid::text, v_song_id::text),
    '',
    'draft'::public.submission_status
  );

  return v_song_id;
end;
$$;

revoke all on function public.create_draft_song(text) from public;
grant execute on function public.create_draft_song(text) to authenticated;
