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

## Observed Results (Supabase SQL Editor)
- 현 세션에서는 Supabase Dashboard SQL Editor를 자동 제어할 수 없어 실측(Observed) 실행을 완료하지 못했다.
- 사용 가능한 실행 경로가 CLI 중심(`db push`, `migration list`)으로 제한되어, 원격 SQL 시나리오 3개를 직접 실행/캡처할 수 없었다.
- 따라서 아래는 실측 대체 증거와 재실측 절차를 기록한다.

### 대체 증거 A) `npx supabase db push` 성공 로그
핵심 라인:
- `Applying migration 202602160003_reports_queue.sql...`
- `Finished supabase db push.`

### 대체 증거 B) `npx supabase migration list` 동기화 확인
핵심 라인:
- `202602160003 | 202602160003`
- 해석: 로컬/원격 모두 Ticket 03 마이그레이션 버전이 일치한다.

### 대체 증거 C) 정의(함수/트리거/정책) 조회 SQL + 기대 출력 형태
```sql
-- 1) 함수 정의 확인
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'create_report_and_queue';

-- 기대 출력 형태:
-- schema_name | function_name           | args
-- public      | create_report_and_queue | p_target_type text, p_target_id uuid, p_reason text

-- 2) 트리거 정의 확인
select
  tgname as trigger_name,
  tgrelid::regclass::text as table_name
from pg_trigger
where tgname in ('trg_reports_to_queue', 'trg_report_threshold_transition')
  and not tgisinternal
order by tgname;

-- 기대 출력 형태:
-- trigger_name                    | table_name
-- trg_report_threshold_transition | public.reports
-- trg_reports_to_queue            | public.reports

-- 3) 정책 정의 확인
select
  schemaname,
  tablename,
  policyname,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'moderation_queue'
  and policyname in ('moderation_queue_insert_admin_only', 'moderation_queue_delete_admin_only')
order by policyname;

-- 기대 출력 형태:
-- schemaname | tablename        | policyname                         | cmd
-- public     | moderation_queue | moderation_queue_delete_admin_only | DELETE
-- public     | moderation_queue | moderation_queue_insert_admin_only | INSERT
```

### 재실측 절차 (3단계)
1. Supabase Dashboard SQL Editor에서 본 문서의 `SQL 시나리오 3개 (재현 스크립트)`를 순서대로 실행한다.
2. 각 시나리오 실행 직후 RPC 반환 row와 `moderation_queue`/`reports` 조회 결과를 캡처한다.
3. 본 섹션의 대체 증거를 실제 Observed 값(PASS/FAIL 포함)으로 치환해 확정한다.

## 롤백 힌트
- 후속 마이그레이션에서 아래를 역순으로 수행:
  1) `create_report_and_queue` 함수 drop 또는 이전 버전 복원
  2) `trg_report_threshold_transition`, `trg_reports_to_queue` 트리거 제거
  3) `moderation_queue_insert_admin_only`, `moderation_queue_delete_admin_only` 정책 복원
