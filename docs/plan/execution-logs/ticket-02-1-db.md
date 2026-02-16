# Ticket 02.1 DB 실행 로그 (HOTFIX)

## 요약
- 목표: `cast_votes_max3` 멱등 재시도 성공화, 동시성 레이스 봉쇄, `security definer` 보안 보강.
- 결과:
  - 생성: `supabase/migrations/202602160210_ticket02_1_votes_idempotency.sql`
  - 문서 갱신: `docs/contracts/schema.md`, `docs/contracts/api.md`, `docs/plan/mvp-tickets.md`
  - 원격 반영: `npx supabase db push --yes` 성공

## 변경점
1. votes 제약/인덱스 보강
   - 유지/보장: `unique (voter_id, final_track_id)`
   - 신규/보장: `unique (voter_id, client_request_id)`
   - 제거: 전역 `unique (client_request_id)` 제약(존재 시)
2. RPC 멱등성
   - 동일 `(auth.uid(), client_request_id)` 재시도 시 에러가 아닌 성공 동일응답 반환
   - `idempotent_replay` 플래그로 재생 응답 여부 표기
3. 동시성
   - `pg_advisory_xact_lock(hashtext(uid), hashtext('cast_votes_max3'))` 적용
   - 유니크 제약 + 락 조합으로 레이스 차단
4. 보안
   - 함수: `security definer`
   - `search_path = public, pg_temp` 고정

## 실행 커맨드 로그
```bash
# 1) 첫 시도 (반환 타입 변경 충돌)
npx supabase db push --yes
# output (요약)
# Applying migration 202602160210_ticket02_1_votes_idempotency.sql...
# ERROR: cannot change return type of existing function (SQLSTATE 42P13)

# 2) 마이그레이션 수정 (drop function 후 create)
# 3) 재시도
npx supabase db push --yes
# output (요약)
# Applying migration 202602160210_ticket02_1_votes_idempotency.sql...
# Finished supabase db push.
```

## 필수 테스트 시나리오(SQL 재현용)
아래 SQL은 Supabase SQL Editor 또는 DB 콘솔에서 재현 가능한 시나리오다.

```sql
-- 준비: top10 트랙/테스트 사용자 컨텍스트를 환경에 맞게 설정
-- 1) 정상 1표
select * from public.cast_votes_max3(:track1, :req1, 'dfp-a');

-- 2) 동일 client_request_id 재시도 => 성공 동일응답(idempotent_replay=true 기대)
select * from public.cast_votes_max3(:track1, :req1, 'dfp-a');

-- 3) 동일 트랙 중복(다른 req id) => DUPLICATE_VOTE 기대
select * from public.cast_votes_max3(:track1, :req2, 'dfp-a');

-- 4) 3표 제한
select * from public.cast_votes_max3(:track2, :req3, 'dfp-a');
select * from public.cast_votes_max3(:track3, :req4, 'dfp-a');
select * from public.cast_votes_max3(:track4, :req5, 'dfp-a'); -- VOTE_LIMIT_EXCEEDED 기대
```

## 테스트 결과 기록
- 원격 마이그레이션 반영: 성공 (`db push`)
- 구조 검증:
  - 멱등성 키 제약: `unique (voter_id, client_request_id)` 반영 코드 확인
  - 중복 트랙 제약: `unique (voter_id, final_track_id)` 반영 코드 확인
  - 함수 보안: `search_path = public, pg_temp` 반영 코드 확인
- 시나리오 SQL 실행:
  - 본 세션에서는 CLI 제약으로 원격 SQL 직접 실행 경로가 없어 재현 SQL을 로그에 남김
  - 운영 콘솔(SQL Editor)에서 동일 SQL로 즉시 검증 가능

## Observed Results (Supabase SQL Editor)
- 실행 일시: 2026-02-16
- 환경: remote (`unmyeong-song-dev`, ref `kwzguusrbciklojvimsh`)

| # | Scenario | Expected | Observed | PASS/FAIL | Notes |
|---:|---|---|---|---|---|
| 1 | 정상 1표 | 성공, `vote_count=1` | SQL Editor 실측 미완료 | FAIL | 본 에이전트 세션에서 Dashboard 브라우저 제어 불가 |
| 2 | 동일 `client_request_id` 재시도 | 성공 동일응답, `idempotent_replay=true`, 행 추가 없음 | SQL Editor 실측 미완료 | FAIL | A 항목 증거 미채집(브라우저 실행 불가) |
| 3 | 동일 트랙 재투표 | `DUPLICATE_VOTE` | SQL Editor 실측 미완료 | FAIL | B 항목 증거 미채집(브라우저 실행 불가) |
| 4 | 3표 제한 전 2/3표 | 성공 | SQL Editor 실측 미완료 | FAIL | 실측 미수행 |
| 5 | 4번째 투표 | `VOTE_LIMIT_EXCEEDED` | SQL Editor 실측 미완료 | FAIL | C 항목 증거 미채집(브라우저 실행 불가) |

### 시나리오별 상세 관측 (Observed)
- 공통 실행 SQL: 본 문서의 `필수 테스트 시나리오(SQL 재현용)` 블록과 동일(same as above).
- 반환값/카운트 관측:
  - SQL Editor 실측 결과(함수 반환 row, voter별 votes 카운트 변화) 미채집.
  - 원인: 현재 자동화 세션에서 Supabase Dashboard 브라우저 도구를 사용할 수 없어 SQL Editor 실행 컨텍스트 진입 불가.
- 기대 대비 판정:
  - 시나리오 1~5 모두 FAIL(실측 데이터 부재).

### 대안 관측 증거 (Available Evidence)
- 마이그레이션 원격 적용 증거:
  - `npx supabase db push --yes` 성공
  - 로그 핵심: `Applying migration 202602160210_ticket02_1_votes_idempotency.sql...` -> `Finished supabase db push.`
- 함수/제약 반영 코드 증거:
  - 함수 보안: `security definer`, `search_path = public, pg_temp`
  - 제약 보강: `unique (voter_id, final_track_id)`, `unique (voter_id, client_request_id)`
- 제한 사항:
  - `supabase db dump` 기반 원격 스키마 추출은 Docker Desktop 미구동으로 실패하여 추가 자동 증거 확보 불가.

### 재실측 지시 (필수 후속)
1. Supabase Dashboard SQL Editor에서 본 문서 시나리오 1~5를 순서대로 실행.
2. 각 시나리오 실행 전/후 voter별 `votes` 카운트 스냅샷을 기록.
3. 표의 Observed/PASS/FAIL을 실측값으로 갱신하고 본 섹션 FAIL을 해소.

## 롤백 힌트
- 후속 마이그레이션에서 아래를 순서대로 복원:
  1) `cast_votes_max3`를 Ticket 02 버전으로 재정의
  2) `uq_votes_voter_client_request` 제거 및 필요 시 이전 제약 복원
  3) 문서 역링크를 Ticket 02.1 이전 상태로 조정
