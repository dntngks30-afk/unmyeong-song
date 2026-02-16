# Ticket 08.1 DB 실행 로그

## 요약
- 목표: `complete_song_submission` RPC를 DB에 구현해 FE 제출 플로우와 서버 검증을 정합화.
- 결과:
  - 생성: `supabase/migrations/202602160008_1_submission_rpc.sql`
  - 생성: `supabase/policies/08_songs_storage_rls.sql`
  - 원격 반영: `npx supabase db push --yes --include-all` 성공
  - 동기화 확인: `npx supabase migration list`에서 `202602160008` Local/Remote 일치

## 적용 파일/변경 요약
1. `supabase/migrations/202602160008_1_submission_rpc.sql`
   - `complete_song_submission(p_song_id, p_audio_path, p_cover_path, p_making_note)` RPC 추가
   - 검증:
     - 인증 필수(`AUTH_REQUIRED`)
     - 역할 `artist/admin` 필수 + owner-only 제출 확정(`song.artist_id = auth.uid()`)
     - `audio_path`: `song-audio` 규칙 + `artist/{uid}/song/{song_id}/...` prefix 강제
     - `cover_path`: 값이 있을 때 `song-cover` 규칙 + 동일 prefix 강제
     - 경로 위반 시 `STORAGE_PATH_INVALID`
     - `making_note` 필수 + TEMP 길이 제한(1~2000)
   - 성공 시 `songs.audio_path/cover_path/making_note` 갱신 + `status='submitted'` 전이
   - 반환: `(song_id, audio_path, cover_path, status)`
2. `supabase/policies/08_songs_storage_rls.sql`
   - Ticket 08.1 정책 카탈로그/보장사항 정리

## 실행 커맨드 로그 (핵심)
```bash
# 1) 기본 push 시 include-all 요구
npx supabase db push --yes
# Found local migration files to be inserted before the last migration on remote database.
# Rerun the command with --include-all flag

# 2) include-all 재실행
npx supabase db push --yes --include-all
# Applying migration 202602160008_1_submission_rpc.sql...
# Finished supabase db push.

# 3) 동기화 확인
npx supabase migration list
# 202602160008 | 202602160008
```

## Observed Results (Supabase SQL Editor)
- 실행 일시: 2026-02-16
- 환경: remote (`unmyeong-song-dev`)
- 상태: SQL Editor 직접 실측은 현재 세션에서 수행하지 못함(대시보드 수동 접근 불가)
- 대체 증거:
  - 원격 마이그레이션 적용 성공
  - 마이그레이션 리스트 Local/Remote 동기화 확인

| # | Scenario | Expected | Observed | PASS/FAIL | Notes |
|---|---|---|---|---|---|
| A | 정상 제출 성공 | songs 컬럼 갱신 + status=submitted | 실측 미수행 | FAIL* | 아래 SQL로 재실측 필요 |
| B | 타인 song_id 제출 | `FORBIDDEN_ROLE` | 실측 미수행 | FAIL* | 아래 SQL로 재실측 필요 |
| C | 잘못된 audio_path | `STORAGE_PATH_INVALID` | 실측 미수행 | FAIL* | 아래 SQL로 재실측 필요 |

\* FAIL은 기능 실패가 아니라 "Observed 미수집" 상태를 의미한다.

### SQL Editor 재현용 시나리오 (A/B/C)
```sql
-- [준비] 본인 song 1개 확인
select id, artist_id, status
from public.songs
where artist_id = auth.uid()
order by created_at desc
limit 1;

-- A) 정상 제출 성공
select *
from public.complete_song_submission(
  '<MY_SONG_ID>'::uuid,
  format('artist/%s/song/%s/audio.mp3', auth.uid()::text, '<MY_SONG_ID>'),
  format('artist/%s/song/%s/cover.jpg', auth.uid()::text, '<MY_SONG_ID>'),
  'Ticket 08.1 정상 제출 메이킹노트'
);

-- A-검증: songs 갱신 확인
select id, artist_id, audio_path, cover_path, making_note, status
from public.songs
where id = '<MY_SONG_ID>'::uuid;

-- B) 타인 song_id 제출
select *
from public.complete_song_submission(
  '<OTHER_SONG_ID>'::uuid,
  format('artist/%s/song/%s/audio.mp3', auth.uid()::text, '<OTHER_SONG_ID>'),
  null,
  '타인 song 제출 시도'
);
-- 기대: FORBIDDEN_ROLE

-- C) 잘못된 audio_path
select *
from public.complete_song_submission(
  '<MY_SONG_ID>'::uuid,
  format('artist/%s/song/%s/wrong.mp3', auth.uid()::text, '<MY_SONG_ID>'),
  null,
  '경로 검증 실패 테스트'
);
-- 기대: STORAGE_PATH_INVALID
```

## 롤백 힌트
- 후속 마이그레이션으로 아래 역적용:
  1) `complete_song_submission` 함수 삭제 또는 이전 버전 복원
  2) 필요 시 policy catalog 정리(`08_songs_storage_rls.sql`)
