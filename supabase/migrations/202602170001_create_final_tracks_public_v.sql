-- Hotfix: ensure final_tracks_public_v exists for PostgREST Top10 surface
-- SSOT: docs/contracts/api.md, docs/contracts/schema.md

create or replace view public.final_tracks_public_v as
select
  ft.id as id,
  s.title as title,
  coalesce(nullif(btrim(p.display_name), ''), '익명 뮤지션') as artist,
  coalesce(ft.rank_order, row_number() over (order by ft.created_at asc, ft.id asc))::int as rank
from public.final_tracks ft
join public.songs s
  on s.id = ft.song_id
left join public.profiles p
  on p.id = s.artist_id
where ft.status = 'top10'::public.final_track_status;

grant select on public.final_tracks_public_v to anon, authenticated;
