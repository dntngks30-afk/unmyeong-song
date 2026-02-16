# Ticket 07.1 DB 실행 로그

## 요약
- 목표: `submit_story_rate_limited` RPC를 실제 DB에 구현해 FE 호출 경로와 SSOT를 정합화.
- 결과:
  - 생성: `supabase/migrations/202602160007_1_stories_rpc.sql`
  - 생성: `supabase/policies/07_stories_rls.sql`
  - 원격 반영: `npx supabase db push --yes --include-all` 성공
  - 동기화 확인: `npx supabase migration list`에서 `202602160007` Local/Remote 일치

## 적용 파일/변경 요약
1. `supabase/migrations/202602160007_1_stories_rpc.sql`
   - `stories.client_request_id` 컬럼 추가
   - `uq_stories_author_client_request` 유니크 인덱스 추가(부분 인덱스, `client_request_id is not null`)
   - `submit_story_rate_limited(p_title text, p_body text, p_client_request_id uuid)` RPC 추가
   - 인증 필수(`AUTH_REQUIRED`) + 권한 컨텍스트 확인(`FORBIDDEN_ROLE`)
   - TEMP 레이트리밋(사용자당 1분 3회) 초과 시 `RATE_LIMITED`
   - PII/금칙 패턴 탐지 시 `CONTENT_BLOCKED`
   - 성공 시 `stories` insert 후 `story_id`, `status='accepted'` 반환
   - 동일 `client_request_id` 재호출은 idempotent success 응답
2. `supabase/policies/07_stories_rls.sql`
   - 기존 stories RLS 정책 재확인 카탈로그
   - anon write 불가 및 RPC execute 권한(Authenticated only) 보장사항 문서화

## TEMP 정책 명시
- 현재 SSOT에 레이트리밋 수치가 고정되어 있지 않아 임시로 `1분 3회`를 적용했다.
- 본 수치는 TEMP이며, SSOT 수치 확정 시 후속 마이그레이션으로 조정한다.

## 실행 커맨드 로그 (핵심)
```bash
# 1) 기본 push 시 include-all 요구
npx supabase db push --yes
# Found local migration files to be inserted before the last migration on remote database.
# Rerun the command with --include-all flag

# 2) include-all 재실행
npx supabase db push --yes --include-all
# Applying migration 202602160007_1_stories_rpc.sql...
# Finished supabase db push.

# 3) 동기화 확인
npx supabase migration list
# 202602160007 | 202602160007
```

## Observed Results (Supabase SQL Editor)
- 실행 일시: 2026-02-16
- 환경: remote (`unmyeong-song-dev`)
- 상태: SQL Editor 직접 실측은 현재 세션에서 수행하지 못함(대시보드 수동 접근 불가)
- 대체 증거:
  - 원격 마이그레이션 적용 성공 로그 확인
  - 마이그레이션 리스트 Local/Remote 동기화 확인

| # | Scenario | Expected | Observed | PASS/FAIL | Notes |
|---|---|---|---|---|---|
| A | 정상 작성 성공 | `story_id` 반환, stories 1행 증가 | 실측 미수행 | FAIL* | 아래 수동 SQL 재실행 필요 |
| B | 연속 호출 RATE_LIMITED | 임계치 초과 시 `RATE_LIMITED` | 실측 미수행 | FAIL* | 아래 수동 SQL 재실행 필요 |
| C | PII 포함 CONTENT_BLOCKED | PII 패턴 포함 시 `CONTENT_BLOCKED` | 실측 미수행 | FAIL* | 아래 수동 SQL 재실행 필요 |

\* FAIL은 기능 실패가 아니라 "Observed 미수집" 상태를 의미한다.

### SQL Editor 재실측용 쿼리 (A/B/C)
```sql
-- [공통] 테스트 전 현재 유저 기준 최근 사연 수 확인
select count(*) as current_story_count
from public.stories
where author_id = auth.uid();

-- A) 정상 작성 성공
select *
from public.submit_story_rate_limited(
  'Ticket07 정상 작성',
  '정상 사연 본문',
  gen_random_uuid()
);

-- A-검증: 최근 작성 행 확인
select id, author_id, title, created_at
from public.stories
where author_id = auth.uid()
order by created_at desc
limit 3;

-- B) 연속 호출 RATE_LIMITED (1분 내 4회 호출)
select * from public.submit_story_rate_limited('RL-1', '본문', gen_random_uuid());
select * from public.submit_story_rate_limited('RL-2', '본문', gen_random_uuid());
select * from public.submit_story_rate_limited('RL-3', '본문', gen_random_uuid());
select * from public.submit_story_rate_limited('RL-4', '본문', gen_random_uuid());
-- 기대: 4번째 호출에서 RATE_LIMITED

-- C) PII 포함 CONTENT_BLOCKED
select *
from public.submit_story_rate_limited(
  '개인정보 포함',
  '연락처는 010-1234-5678 입니다.',
  gen_random_uuid()
);
-- 기대: CONTENT_BLOCKED
```

## 롤백 힌트
- 후속 마이그레이션으로 아래 역적용:
  1) `submit_story_rate_limited` 함수 삭제 또는 이전 버전 복원
  2) `uq_stories_author_client_request`, `idx_stories_author_created_at` 인덱스 제거
  3) 필요 시 `stories.client_request_id` 컬럼 제거
