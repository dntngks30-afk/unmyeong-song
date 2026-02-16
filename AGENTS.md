# AGENTS.md

## 목적
- 이 문서는 협업 규칙과 경계의 기준 문서다.
- 제품 계약의 단일 진실은 `docs/contracts/*`이며, 구현은 반드시 계약을 따른다.

## 프로젝트 커맨드
- `install`: `npm install`
- `dev`: `npm run start`
- `lint`: `npm run lint` (placeholder, 스크립트 추가는 티켓으로 처리)
- `typecheck`: `npx tsc --noEmit`
- `test`: `npm run test` (placeholder, 테스트 러너 확정 후 연결)

## 브랜치/커밋 규칙
- 한 커밋은 하나의 목적만 포함한다.
- 커밋 크기는 리뷰 가능한 단위로 작게 나눈다.
- `docs/contracts/*`를 깨는 변경은 금지한다.
- 계약 변경이 필요하면 먼저 `docs/contracts/*`를 수정하고, 이후 구현 티켓을 따른다.

## Ownership & Boundaries
- `app/(tabs)` = FE만 수정
- `features/*` = FE만 수정
- `lib/api` = FE만 수정
- `supabase/*` = DB/RLS만 수정
- `supabase/functions/*` = BE만 수정 (Edge Functions)
- `docs/contracts/*` = 모든 팀의 정답지(권위 문서)

## Guardrails (금지 규칙)
- 특권 동작을 anon key로 우회하지 않는다.
- 모든 write는 검증된 함수/RPC 또는 강한 제약이 있는 insert만 허용한다.
- 파일 URL은 무지성 공개하지 않는다. 접근 규칙(signed URL, 만료, 경로 검증)을 반드시 둔다.

## Definition of Done
- 타입체크 통과: `npx tsc --noEmit`
- 린트 통과: `npm run lint` (placeholder가 실제 스크립트로 대체되어야 함)
- 스모크 테스트 통과:
  - 앱 실행 확인: `npm run start`
  - 탭 라우팅 진입 확인(홈/사연/쇼/마이)
  - 핵심 액션 실패 경로에서 표준 에러 메시지 노출 확인
- 계약 일치 확인:
  - 변경이 `docs/contracts/*`와 모순되지 않음
  - 신규 권한/정책은 contracts에 먼저 반영됨

## 표준 에러 핸들링 규칙
### 표준 에러 객체
```ts
type AppErrorCode =
  | "AUTH_REQUIRED"
  | "FORBIDDEN_ROLE"
  | "RATE_LIMITED"
  | "RLS_DENIED"
  | "CONTENT_BLOCKED"
  | "VOTE_LIMIT_EXCEEDED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "NETWORK_UNAVAILABLE"
  | "UNKNOWN";

type AppError = {
  code: AppErrorCode;
  message: string;
  userMessage: string;
  retryable: boolean;
  correlationId?: string;
  details?: Record<string, unknown>;
};
```

### 사용자 메시지 매핑 규칙
- `AUTH_REQUIRED`: "로그인이 필요합니다."
- `FORBIDDEN_ROLE`: "권한이 없습니다."
- `RATE_LIMITED`: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."
- `RLS_DENIED`: "요청을 처리할 수 없습니다."
- `CONTENT_BLOCKED`: "정책상 등록할 수 없는 내용이 포함되어 있습니다."
- `VOTE_LIMIT_EXCEEDED`: "투표 가능 횟수를 초과했습니다."
- `NETWORK_UNAVAILABLE`: "네트워크 연결을 확인해 주세요."
- `UNKNOWN`: "일시적인 오류가 발생했습니다. 다시 시도해 주세요."

## Top10 리스크 대응 인덱스
- RLS 누락/오설정: `docs/contracts/schema.md` RLS 정책 요약
- 투표 1인 3표 초과: `docs/contracts/schema.md` RPC `cast_votes_max3`
- 신고 누락/전환 실패: `docs/contracts/schema.md` 트리거 `report_to_review_queue`
- 스토리지 공개 URL 유출: `docs/contracts/schema.md` Storage 접근 규칙
- 클라이언트 단독 권한 판단: `docs/contracts/api.md` 보안 주의사항
- 레이트리밋 부재로 어뷰징: `docs/contracts/api.md` 레이트리밋/어뷰징 규칙
- 오프라인 재시도로 중복 write: `docs/contracts/ux-flows.md` 오프라인 행동 규칙
- 라우팅 가드 누락: `docs/contracts/ux-flows.md` 플로우별 권한 가드
- 표준 에러 불일치: `docs/contracts/api.md` 에러 코드/메시지 맵
- 계약 없는 구현 선행: 본 문서의 브랜치/커밋 규칙 + `docs/contracts/*`
