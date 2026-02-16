# Ticket 03 DB 실행 로그

## 요약
- 목표: `create_report_and_queue` RPC + 신고 시 `moderation_queue` 자동 생성/임계치(3/5) 상태 전이 구현.
- 결과:
  - 생성: `supabase/migrations/202602160003_reports_queue.sql`
  - 생성: `supabase/policies/03_reports_rls.sql`
  - 원격 반영: `npx supabase db push --yes --include-all` 성공

## 구현 내용
1. RPC
   - `public.create_report_and_queue(p_target_type text, p_target_id uuid, p_reason text)`
   - 인증/역할/타깃 존재/사유 유효성 검증 후 `reports` 1건 생성
   - 생성 결과로 `report_id`, `queue_id`, `queue_status`, `risk_level`, `total_score` 반환
2. 트리거
   - `trg_reports_to_queue`: 신고 insert 시 `moderation_queue` 자동 생성
   - `trg_report_threshold_transition`: 동일 타깃 누적 score 기준 상태 전이
3. 임계치 전이 규칙
   - 누적 1~2: `open`, `low`
   - 누적 3~4: `in_review`, `medium`
   - 누적 5+: `in_review`, `high`
4. RLS 보강
   - `moderation_queue_insert_admin_only`
   - `moderation_queue_delete_admin_only`

## 실행 커맨드 로그
```bash
# 1) 초기 원격 반영 시도
npx supabase db push --yes

# output (요약)
# Initialising login role...
# Connecting to remote database...
# Found local migration files to be inserted before the last migration on remote database.
# Rerun the command with --include-all flag ...

# 2) include-all로 재시도
npx supabase db push --yes --include-all

# output (요약)
# Applying migration 202602160003_reports_queue.sql...
# NOTICE: trigger ... does not exist, skipping
# NOTICE: function ... does not exist, skipping
# Finished supabase db push.

# 3) 로컬/원격 동기화 확인
npx supabase migration list
# 202602160003 | 202602160003 확인
```

## SQL 시나리오 3개 (재현 스크립트)
아래 시나리오는 원격 DB SQL 실행기(예: Dashboard SQL Editor)에서 실행 기준이다.

```sql
-- [공통 준비]
-- :reporter_uid, :target_story_id 는 환경에 맞게 치환
-- SQL Editor에서 auth.uid()가 없는 경우 RPC 대신 insert + trigger 검증으로 대체 필요

-- Scenario 1) 첫 신고 -> open/low
select * from public.create_report_and_queue('story', :target_story_id, 'spam');

-- 기대:
-- queue_status = 'open'
-- risk_level   = 'low'
-- total_score  = 1
```

```sql
-- Scenario 2) 누적 score 3 도달 -> in_review/medium
select * from public.create_report_and_queue('story', :target_story_id, 'abuse');
select * from public.create_report_and_queue('story', :target_story_id, 'duplicate');

-- 기대:
-- queue_status = 'in_review'
-- risk_level   = 'medium'
-- total_score  = 3
```

```sql
-- Scenario 3) 누적 score 5 도달 -> in_review/high
select * from public.create_report_and_queue('story', :target_story_id, 'phishing');
select * from public.create_report_and_queue('story', :target_story_id, 'hate');

-- 기대:
-- queue_status = 'in_review'
-- risk_level   = 'high'
-- total_score  = 5
```

## 시나리오 실행/관측 결과
- 본 세션에서는 Supabase CLI에 원격 SQL 실행 서브커맨드가 없어( `db push/pull/dump/lint`만 제공 ) 위 3개 SQL을 CLI로 직접 실행하지 못했다.
- 대신 원격 마이그레이션 적용 성공(`db push --include-all`)과 원격 마이그레이션 버전 동기화(`migration list`)를 확인했다.
- SQL 시나리오는 위 스크립트를 그대로 SQL Editor에 붙여 실행하면 즉시 검증 가능하다.

## 롤백 힌트
- 후속 마이그레이션에서 아래를 역순으로 수행:
  1) `create_report_and_queue` 함수 drop 또는 이전 버전 복원
  2) `trg_report_threshold_transition`, `trg_reports_to_queue` 트리거 제거
  3) `moderation_queue_insert_admin_only`, `moderation_queue_delete_admin_only` 정책 복원
