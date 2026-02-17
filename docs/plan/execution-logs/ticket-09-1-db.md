# Ticket 09.1 DB 실행 로그

## 요약
- 이슈: `/rest/v1/final_tracks_public_v` 호출 시 `404 PGRST205` (relation not found in schema cache)
- 원인: `public.final_tracks_public_v` 뷰 미존재(REST surface 계약은 존재했으나 DB object 부재)
- 조치: `public.final_tracks_public_v` 뷰 추가 + `grant select to anon, authenticated`
- 결과: REST `200 OK` 확인, Top10 조회 endpoint 정상화
- 참고 요청 식별자: `sb-request-id: 019c6a33-0f42-7820-a1e7-a7b32055acb0`

## 스키마 탐색 근거 (컬럼 확인)
확인 기준: `supabase/migrations/202602160001_init_schema.sql`
- `public.final_tracks`
  - `id`, `song_id`, `rank_order`, `status`, `created_at`
- `public.songs`
  - `id`, `title`, `artist_id`, `audio_path`, `cover_path`
- `public.profiles`
  - `id`, `display_name`, `role`

## 적용 파일
- `supabase/migrations/202602160009_1_final_tracks_public_view.sql`
  - view: `public.final_tracks_public_v`
  - 컬럼: `id`, `title`, `artist`, `rank`
  - 필터: `final_tracks.status = 'top10'`
  - 권한: `grant select on view to anon, authenticated`
- `docs/contracts/schema.md` (뷰 정의 보강)
- `docs/contracts/api.md` (Top10 조회 surface 문구 확정)

## 적용 커맨드
```bash
npx supabase db push --yes --include-all
npx supabase migration list
```

핵심 출력:
- `Applying migration 202602160009_1_final_tracks_public_view.sql...`
- `Finished supabase db push.`
- migration list 동기화: `202602160009 | 202602160009`

## REST 검증 (curl)
```bash
GET {SUPABASE_URL}/rest/v1/final_tracks_public_v?select=id,title,artist,rank&limit=1
```

실행 예:
```bash
curl.exe -i "https://kwzguusrbciklojvimsh.supabase.co/rest/v1/final_tracks_public_v?select=id,title,artist,rank&limit=1" \
  -H "apikey: <anon_key>" \
  -H "Authorization: Bearer <anon_key>"
```

관측:
- HTTP `200 OK`
- body 예시: `[{"id":"...","title":"ticket05-song","artist":"ticket05_artist","rank":1}]`
- 응답 헤더: `content-profile: public`, `sb-request-id` 존재

## PASS/FAIL
| 항목 | Expected | Observed | PASS/FAIL | Notes |
|---|---|---|---|---|
| `/rest/v1/final_tracks_public_v` 조회 | 200 + 배열 응답 | 200 + 1행 응답 확인 | PASS | PGRST205 재발 없음 |

## 롤백 힌트
- 후속 마이그레이션으로 `public.final_tracks_public_v` 삭제/이전 정의 복원 가능
- 단, FE 계약(`/rest/v1/final_tracks_public_v`)과 동시 조정 필요
