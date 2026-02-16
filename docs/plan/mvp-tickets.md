# MVP Tickets Plan

## 실행 순서 원칙
- 권한/계약 -> 데이터/스토리지 -> UI 흐름 -> 운영/검증 순서로 진행한다.
- 모든 구현 티켓은 `docs/contracts/*`를 우선 참조한다.
- 모든 티켓은 완료 시 계약 역링크(어느 섹션을 구현했는지) 코멘트를 PR에 남긴다.

## Ticket 01 - Supabase 기본 스키마/Enum/RLS 뼈대 구축
- Owner: DB
- Scope + 파일 경로:
  - `supabase/migrations/202602160001_init_schema.sql`
  - `supabase/policies/01_base_rls.sql`
- Acceptance Criteria:
  - `profiles/stories/songs/final_tracks/votes/reports/moderation_queue/entitlements` 생성
  - enum 및 기본 FK/unique 제약 반영
  - 모든 테이블 RLS 활성화
  - 정책 이름 규칙 `<table>_<action>_<scope>` 적용
- Test Plan:
  - Command: `supabase db reset`
  - Manual:
    - anon: 공개 조회만 가능, write 거부
    - viewer: 본인 write 가능, 타인 데이터 write 거부
    - admin: 운영 경로 허용
- Rollback Plan:
  - 해당 마이그레이션 롤백 SQL 적용 또는 리셋 후 이전 baseline 재적용
- Dependencies:
  - `docs/contracts/schema.md`의 Role/ER/RLS 섹션

## Ticket 02 - 투표 1인 3표 RPC/제약 구현
- Owner: DB
- Scope + 파일 경로:
  - `supabase/migrations/202602160002_votes_rpc.sql`
  - `supabase/policies/02_votes_rls.sql`
- Acceptance Criteria:
  - `cast_votes_max3` RPC 추가
  - 사용자 총 3표 초과 시 `VOTE_LIMIT_EXCEEDED`에 매핑 가능한 오류 반환
  - 동일 트랙 중복 투표 차단
  - `client_request_id` 중복 요청 차단
  - `device_fingerprint` 로그 저장(차단 아님, 탐지용)
- Test Plan:
  - Command: `supabase db reset`
  - Manual:
    - 동일 사용자 4번째 실패
    - 동일 트랙 재투표 실패
    - 다른 사용자 투표 성공
    - 동일 요청 재전송 실패(멱등 보장)
- Rollback Plan:
  - RPC/정책 제거 마이그레이션 적용
- Dependencies:
  - `docs/contracts/schema.md` RPC 섹션
  - `docs/contracts/api.md` 투표/에러 코드 섹션

## Ticket 03 - 신고 등록 + 자동 검수 큐 전환 구현
- Owner: DB
- Scope + 파일 경로:
  - `supabase/migrations/202602160003_reports_queue.sql`
  - `supabase/policies/03_reports_rls.sql`
- Acceptance Criteria:
  - `create_report_and_queue` RPC 구현
  - 신고 생성 시 `moderation_queue` 자동 생성 트리거 동작
  - 누적 score 임계치(3, 5) 상태 전이 동작
- Test Plan:
  - Command: `supabase db reset`
  - Manual:
    - 신고 1건: `open`
    - 누적 3건: `in_review`
    - 누적 5건: `in_review` + `risk_level=high`
- Rollback Plan:
  - 트리거/RPC 제거 마이그레이션 적용
- Dependencies:
  - `docs/contracts/schema.md` reports/moderation_queue 섹션
  - `docs/contracts/api.md` 신고 액션 섹션

## Ticket 04 - 스토리지 버킷/경로/접근 정책 구현
- Owner: DB
- Scope + 파일 경로:
  - `supabase/migrations/202602160004_storage_rules.sql`
  - `supabase/policies/04_storage_access.sql`
- Acceptance Criteria:
  - `song-audio`, `song-cover` 버킷 생성
  - 경로 규칙(`artist/{user_id}/song/{song_id}/...`) 검증 정책 반영
  - 공개 URL 직접 접근 차단, signed URL 경로만 허용
  - signed URL TTL 정책(업로드 300초/재생 60초) 적용
- Test Plan:
  - Command: `supabase db reset`
  - Manual:
    - 잘못된 경로 업로드 거부
    - 권한 없는 사용자 signed URL 발급 거부
    - 만료 URL 접근 실패
- Rollback Plan:
  - 버킷 정책 이전 버전으로 복원
- Dependencies:
  - `docs/contracts/schema.md` Storage 계약 섹션

## Ticket 05 - Edge Function: 업로드 세션/재생 URL 발급
- Owner: BE
- Scope + 파일 경로:
  - `supabase/functions/create-upload-session/index.ts`
  - `supabase/functions/get-track-play-url/index.ts`
  - `supabase/functions/_shared/auth.ts`
- Acceptance Criteria:
  - 업로드 세션 발급 시 role/소유권 검증
  - 재생 URL 발급 시 공개 상태 및 접근 규칙 검증
  - 응답에 `correlationId` 포함
  - 표준 에러 코드 포맷 준수
- Test Plan:
  - Command: `supabase functions serve`
  - Manual:
    - 무권한 요청 403 + `FORBIDDEN_ROLE`
    - 정상 요청 signed URL 반환
    - 만료 후 재요청 정상 발급
- Rollback Plan:
  - 함수 배포 이전 버전으로 롤백
- Dependencies:
  - `docs/contracts/api.md` Edge Function 섹션
  - `docs/contracts/schema.md` Storage 접근 규칙

## Ticket 06 - FE 탭 라우팅 4개 골격 구성
- Owner: FE
- Scope + 파일 경로:
  - `app/(tabs)/_layout.tsx`
  - `app/(tabs)/home.tsx`
  - `app/(tabs)/story.tsx`
  - `app/(tabs)/show.tsx`
  - `app/(tabs)/my.tsx`
- Acceptance Criteria:
  - 홈/사연/쇼/마이 탭 진입 가능
  - 화면별 기본 상태머신 placeholder 배치
  - 각 탭에서 계약 문서 링크 주석(개발용) 추가
- Test Plan:
  - Command: `npm run start`
  - Manual: 4개 탭 전환 및 각 탭 기본 렌더 확인
- Rollback Plan:
  - 탭 라우팅 변경 커밋 되돌리기
- Dependencies:
  - `docs/contracts/ux-flows.md` 공통 상태머신
  - `docs/architecture/folder-structure.md`

## Ticket 07 - 사연 작성/목록/상세 API 연결
- Owner: FE
- Scope + 파일 경로:
  - `features/story/api/queries.ts`
  - `features/story/api/mutations.ts`
  - `features/story/model/types.ts`
  - `app/story/write.tsx`
  - `app/story/[id].tsx`
- Acceptance Criteria:
  - 목록/상세 조회 및 작성 성공/실패 상태 처리
  - 레이트리밋/권한 오류 메시지 표준 코드로 표시
  - PII 경고 UX + 서버 차단 오류(`CONTENT_BLOCKED`) 연결
- Test Plan:
  - Command: `npx tsc --noEmit`
  - Manual:
    - 정상 작성 성공
    - 과다 요청 `RATE_LIMITED`
    - PII 포함 입력 `CONTENT_BLOCKED`
- Rollback Plan:
  - story feature 변경 범위만 선택 롤백
- Dependencies:
  - `docs/contracts/api.md` 사연 액션
  - `docs/contracts/ux-flows.md` 사연 작성 플로우

## Ticket 08 - 제출 업로드(오디오/커버/메이킹노트) 플로우
- Owner: FE
- Scope + 파일 경로:
  - `features/submission/api/mutations.ts`
  - `features/submission/model/types.ts`
  - `app/submission/new.tsx`
  - `lib/api/errors.ts`
- Acceptance Criteria:
  - 오디오 필수/커버 선택/메이킹노트 필수 검증
  - 세션 발급 -> 업로드 -> 제출 완료 흐름 구현
  - 경로 규칙 위반 시 표준 에러 코드 `STORAGE_PATH_INVALID` 표출 (정의: [docs/contracts/api.md](../contracts/api.md#표준-에러-코드와-사용자-메시지))
- Test Plan:
  - Command: `npx tsc --noEmit`
  - Manual:
    - 필수값 누락 차단
    - 잘못된 확장자/경로 차단
    - 정상 제출 완료
- Rollback Plan:
  - 제출 플로우 화면/API 연결만 롤백
- Dependencies:
  - `docs/contracts/api.md` 제출 액션
  - `docs/contracts/schema.md` Storage 경로 규칙
  - `docs/contracts/ux-flows.md` 제출 업로드 플로우

## Ticket 09 - 쇼 Top10 재생 + 투표(1인 3표) UI
- Owner: FE
- Scope + 파일 경로:
  - `features/show/api/queries.ts`
  - `features/show/api/mutations.ts`
  - `app/(tabs)/show.tsx`
  - `features/show/ui/Top10List.tsx`
- Acceptance Criteria:
  - Top10 목록 렌더 및 재생 URL 요청 동작
  - 투표 성공 시 잔여표 갱신, 초과 시 표준 오류 메시지 노출
  - 중복 투표 시 표준 에러 코드 `DUPLICATE_VOTE` 노출 (정의: [docs/contracts/api.md](../contracts/api.md#표준-에러-코드와-사용자-메시지))
  - 요청 중 버튼 잠금 처리
- Test Plan:
  - Command: `npx tsc --noEmit`
  - Manual:
    - 3표 성공, 4번째 실패
    - 동일 트랙 재투표 실패
    - 네트워크 실패 후 재시도 동작 확인
- Rollback Plan:
  - show feature 변경 파일 롤백
- Dependencies:
  - `docs/contracts/api.md` 쇼/투표 액션
  - `docs/contracts/ux-flows.md` 결선 쇼/투표 플로우

## Ticket 10 - Entitlement 인터페이스/에러 표준화/QA 스모크
- Owner: QA (협업: FE/BE)
- Scope + 파일 경로:
  - `features/entitlement/api/queries.ts`
  - `lib/api/errors.ts`
  - `docs/qa/smoke-checklist.md`
  - `package.json` (lint/test 스크립트 연결 티켓으로 제안만)
- Acceptance Criteria:
  - entitlement 상태 조회 인터페이스만 연결(결제 검증은 미구현)
  - 표준 에러 코드 -> 사용자 메시지 매핑 일관성 검증
  - 스모크 체크리스트 작성 완료
  - QA 체크리스트에 RLS/Storage/Vote/Report 회귀 항목 포함
- Test Plan:
  - Command: `npx tsc --noEmit`
  - Manual:
    - entitlement active/inactive에 따른 UI gating 검증
    - 주요 오류 코드 사용자 문구 매핑 스냅샷 검증
- Rollback Plan:
  - entitlement UI gating 및 에러 매핑 변경 롤백
- Dependencies:
  - `docs/contracts/api.md` Entitlement 섹션
  - `AGENTS.md` 표준 에러 규칙

## 나중에 깨질 수 있는 포인트 Top10 + 예방 규칙 매핑
| Risk | 예방 규칙 위치 | 반영 여부 |
|---|---|---|
| RLS 누락/오설정 | `docs/contracts/schema.md` RLS 정책 요약 | Yes |
| anon key로 특권 우회 | `AGENTS.md` Guardrails | Yes |
| 투표 1인 3표 미강제 | `docs/contracts/schema.md` RPC `cast_votes_max3` | Yes |
| 동일 트랙 중복 투표 | `docs/contracts/schema.md` votes unique 제약 | Yes |
| 신고 후 검수 큐 누락 | `docs/contracts/schema.md` `trg_reports_to_queue` | Yes |
| 스토리지 URL 공개 | `docs/contracts/schema.md` Storage 접근 제어 | Yes |
| 클라이언트 단독 권한 판단 | `docs/contracts/api.md` 보안 주의사항 | Yes |
| 오프라인 재시도 중복 write | `docs/contracts/ux-flows.md` 오프라인 쓰기 규칙 | Yes |
| 라우팅 가드 누락 | `docs/contracts/ux-flows.md` 플로우별 권한 규칙 | Yes |
| 에러 코드/메시지 불일치 | `AGENTS.md` + `docs/contracts/api.md` | Yes |

## 에러코드 표준 표 (Ticket 08/09 관련)

| code | HTTP | retryable | 용도 |
|---|---:|---|---|
| `DUPLICATE_VOTE` | 409 | false | 동일 트랙 중복 투표, 재전송, 중복 클릭 |
| `STORAGE_PATH_INVALID` | 422 | false | 업로드 세션/완료/제출 단계의 경로 규칙 위반 |

상세 정의(userMessage, details 스키마 등)는 `docs/contracts/api.md`의 Error Codes 섹션을 참조한다.

## 즉시 실행 추천 순서 (권장)
1. Ticket 01 - Supabase 기본 스키마/Enum/RLS 뼈대 구축
2. Ticket 02 - 투표 1인 3표 RPC/제약 구현
3. Ticket 05 - Edge Function: 업로드 세션/재생 URL 발급

## 문서 gap 리스트 (우선순위)
### 상 (즉시 보강 필요)
- RLS 정책별 SQL 예시가 아직 문서에 없음 (`schema.md` 자연어 수준 -> SQL 스니펫 필요)
- 디바이스 지문 수집 정책(개인정보/보관기간/폐기)이 미정
- 신고 임계치 조정 권한/절차(누가 변경 가능한지) 미정

### 중 (MVP 구현 전 보강 권장)
- 에러 코드의 세부 `details` 스키마 정의 미흡(엔드포인트별 상이)
- signed URL 재발급 실패 시 fallback UX 상세 미정
- entitlement grace 기간 정책(일수/행동) 미정

### 하 (운영 단계에서 보강)
- 운영 대시보드 지표 정의(신고 처리 SLA, 투표 이상 탐지율)
- 지역/언어별 차단 문구 톤 조정 가이드
- 스토리지 비용 최적화(오디오 트랜스코딩/수명주기) 정책

## 변경 이력
- 2026-02-16: 티켓 AC/테스트 플랜을 실행 가능한 수준으로 정제, vote/report/storage 보안 항목 추가, gap 리스트 우선순위화.

## 결정 근거
- 티켓 자체를 검증 가능한 단위로 만들면 구현 단계에서 해석 차이와 QA 누락이 줄어든다.
- 보안/권한/운영 리스크를 티켓 레벨에서 선제적으로 드러내야 롤백 비용이 낮다.

## 비결정(추후)
- QA 자동화 범위(E2E 도입 여부)
- Supabase 로컬/원격 환경 분리 전략(dev/stage/prod)
- 문서 자동 동기화(contracts 변경 시 티켓 갱신 자동화)

이 2개 코드의 Single Source of Truth는 api.md의 Error Codes 섹션이다.
