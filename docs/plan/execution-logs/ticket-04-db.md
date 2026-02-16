# Ticket 04 DB 실행 로그

## 요약
- 목표: Storage 버킷(`song-audio`, `song-cover`) 생성 + 경로 검증 + 접근 정책 구현.
- 결과:
  - 생성: `supabase/migrations/202602160004_storage_rules.sql`
  - 생성: `supabase/policies/04_storage_access.sql`
  - 원격 반영: `npx supabase db push --yes --include-all` 성공
  - 동기화 확인: `npx supabase migration list`에서 `202602160004` Local/Remote 일치

## 적용 파일/변경 요약
1. `supabase/migrations/202602160004_storage_rules.sql`
   - `storage.buckets`에 `song-audio`, `song-cover` private 버킷 upsert
   - `public.validate_storage_path(bucket_id, object_name, uid)` 헬퍼 함수 추가
   - `storage.objects` 정책 4종 추가:
     - `storage_objects_select_owner_or_admin`
     - `storage_objects_insert_owner_valid_path`
     - `storage_objects_update_owner_valid_path`
     - `storage_objects_delete_owner_or_admin`
2. `supabase/policies/04_storage_access.sql`
   - Ticket 04 정책 카탈로그/보장사항 정리
   - TTL 경계(업로드 300초/재생 60초)는 Edge Function 책임임을 명시

## 42501 오류 원인/조치 (PATCH)
- 오류: `alter table storage.objects enable row level security` 실행 시
  - `must be owner of table objects (SQLSTATE 42501)`
- 원인:
  - `storage.objects`는 Supabase 관리 테이블로, hosted 환경에서 테이블 소유권이 없어 `ALTER TABLE ... ENABLE RLS` 실행 불가.
- 조치:
  - 마이그레이션에서 해당 `ALTER TABLE` DDL 제거.
  - 접근 제어는 private 버킷 + `storage.objects` 정책으로 구현.

## 실행 커맨드 로그 (핵심)
```bash
# 1) 초기 시도
npx supabase db push --yes
# Found local migration files ... rerun with --include-all

# 2) include-all 시도 (PATCH 전)
npx supabase db push --yes --include-all
# 42501 관련 차단으로 실패

# 3) PATCH 적용 후 재시도
npx supabase db push --yes --include-all
# Applying migration 202602160004_storage_rules.sql...
# Finished supabase db push.

# 4) 동기화 확인
npx supabase migration list
# 202602160004 | 202602160004
```

## 버킷 생성 확인 (조회/대시보드)
```sql
select id, name, public
from storage.buckets
where id in ('song-audio', 'song-cover')
order by id;
```
기대 결과:
- `song-audio`, `song-cover` 2행 존재
- 두 버킷 모두 `public = false`

## 정책/함수 정의 조회 SQL + 기대 결과
```sql
-- 1) 경로 검증 함수 확인
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'validate_storage_path';

-- 기대: public.validate_storage_path(text, text, uuid)

-- 2) storage.objects 정책 확인
select
  schemaname,
  tablename,
  policyname,
  cmd
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname like 'storage_objects_%'
order by policyname;

-- 기대:
-- storage_objects_delete_owner_or_admin | DELETE
-- storage_objects_insert_owner_valid_path | INSERT
-- storage_objects_select_owner_or_admin | SELECT
-- storage_objects_update_owner_valid_path | UPDATE
```

## TTL 정책 경계 기록
- 업로드 300초 / 재생 60초 TTL 강제는 DB가 아닌 Edge Function 경계에서 적용한다.
- 본 Ticket 04(DB)는 버킷 비공개 + 경로/권한 정책 강제까지 구현한다.

## 롤백 힌트
- 후속 마이그레이션으로 아래 순서 역적용:
  1) `storage.objects` 정책 4종 제거
  2) `public.validate_storage_path` 함수 삭제(또는 이전 버전 복원)
  3) 필요 시 `storage.buckets` 버킷 설정/존재 상태 원복
