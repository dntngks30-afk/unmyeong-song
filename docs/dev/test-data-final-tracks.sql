-- DEV seed snippet: final_tracks_public_v must expose >= 1 row
-- Fill placeholders before running.

-- 1) profile display name (optional)
insert into public.profiles (id, display_name, role)
values ('00000000-0000-0000-0000-000000000101', '테스트 뮤지션', 'artist')
on conflict (id) do update
set display_name = excluded.display_name;

-- 2) song row (audio_path can be null for list-only test)
insert into public.songs (id, artist_id, title, status, audio_path)
values (
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000101',
  'Top10 테스트 곡',
  'submitted',
  null
)
on conflict (id) do update
set title = excluded.title;

-- 3) final track row with top10 status
insert into public.final_tracks (id, song_id, status, rank_order)
values (
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000201',
  'top10',
  1
)
on conflict (id) do update
set status = excluded.status,
    rank_order = excluded.rank_order;

-- 4) verify
select id, title, artist, rank
from public.final_tracks_public_v
order by rank asc, id asc
limit 5;
