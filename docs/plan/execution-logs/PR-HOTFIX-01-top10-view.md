# PR-HOTFIX-01: Top10 404 해결

## 원인
- 앱은 `final_tracks_public_v` 뷰를 호출
- 404(PGRST205): remote DB에 해당 뷰가 없거나 schema cache 미반영

## 대응
1. **앱 fallback**: final_tracks_public_v → final_tracks_public → final_tracks_public_view → final_tracks 테이블 직접 쿼리 순으로 시도
2. **View 확정**: `supabase/migrations/202602170001_create_final_tracks_public_v.sql`, `202602180002_show_play_count_pipeline.sql`에서 `final_tracks_public_v` 생성

## Remote 적용 방법

### 방법 A: Supabase CLI (권장)
```bash
npx supabase db push --yes --include-all
```

### 방법 B: Dashboard SQL
Supabase Dashboard → SQL Editor에서 실행:

```sql
create or replace view public.final_tracks_public_v as
select
  ft.id as id,
  s.title as title,
  coalesce(nullif(btrim(p.display_name), ''), '익명 뮤지션') as artist,
  coalesce(ft.rank_order, row_number() over (order by ft.created_at asc, ft.id asc))::int as rank,
  coalesce(ft.play_count, 0) as play_count
from public.final_tracks ft
join public.songs s on s.id = ft.song_id
left join public.profiles p on p.id = s.artist_id
where ft.status = 'top10'::public.final_track_status;

grant select on public.final_tracks_public_v to anon, authenticated;
```

(`play_count` 컬럼이 없다면 `alter table public.final_tracks add column if not exists play_count int not null default 0;` 먼저 실행)

## 검증
- Show 탭: "NOT FOUND" 없음
- 리스트 표시(또는 "현재 공개된 곡이 없어요" 빈 상태)
