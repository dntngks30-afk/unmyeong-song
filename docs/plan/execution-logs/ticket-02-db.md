# Ticket 02 DB 실행 로그

## 요약
- 목표: Ticket 02 범위(`cast_votes_max3` RPC + votes RLS 보강) 구현 및 원격 검증.
- 결과:
  - 생성 완료: `supabase/migrations/202602160002_votes_rpc.sql`
  - 생성 완료: `supabase/policies/02_votes_rls.sql`
  - 문서 반영: `docs/contracts/schema.md`, `docs/contracts/api.md`, `docs/plan/mvp-tickets.md`
  - 원격 검증: `npx supabase db push` 성공

## 실행 커맨드 로그
```bash
# 1) Ticket 02 원격 반영
npx supabase db push

# output (요약)
# Initialising login role...
# Connecting to remote database...
# Do you want to push these migrations to the remote database?
#  • 202602160002_votes_rpc.sql
# Applying migration 202602160002_votes_rpc.sql...
# NOTICE: policy "votes_insert_owner_top10_only" ... does not exist, skipping
# Finished supabase db push.
```

## 검증 결과 해석
- `202602160002_votes_rpc.sql`이 원격 DB에 적용되었다.
- `votes_insert_owner_top10_only` 정책 생성 전 `drop policy`에서 NOTICE가 발생했으나, 존재하지 않는 정책 드롭에 대한 정상 경고이며 실패가 아니다.
- `cast_votes_max3`와 votes RLS 보강이 Ticket 02 기준으로 반영되었다.

## 역링크
- 계약 문서: `docs/contracts/schema.md`, `docs/contracts/api.md`
- 티켓 문서: `docs/plan/mvp-tickets.md` (Ticket 02)
