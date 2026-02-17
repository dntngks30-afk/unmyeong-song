# API Contract (SSOT)

## 목적
- 이 문서는 FE/BE/DB가 공유하는 API 계약의 단일 진실이다.
- 권한/제약/검증은 클라이언트가 아닌 서버 정책(RLS, RPC, Edge Function)으로 강제한다.

## 최소 권한 원칙 (Least Privilege)
- 읽기: 공개 데이터만 Direct Table 접근 허용.
- 쓰기: Direct insert 금지, RPC 또는 Edge Function 경유.
- 권한: 기본 거부(Default Deny), 명시 허용(Allowlist)만 허용.
- 민감 데이터: signed URL과 단기 토큰으로만 접근.

## API 표면 분리 원칙
- Direct Table Access:
  - 공개 목록/상세처럼 단순 읽기만 허용.
  - RLS로 읽기 범위를 강제.
- RPC:
  - 투표 제한, 사연 레이트리밋, 신고 임계치/전환 같은 규칙성 write.
- Edge Functions:
  - 외부 시스템 검증(결제 영수증 등), 민감 권한 판정, signed URL 발급.

## Auth/Gating 계약 (앱 진입 규칙)
- 앱 최초 진입 화면은 로그인(`/(auth)/login`)이다.
- 세션 없음:
  - `(tabs)` 접근 불가
  - 탭 딥링크(`/(tabs)/home`, `/(tabs)/story`, `/(tabs)/show`, `/(tabs)/my`)는 모두 auth 라우트로 리다이렉트
- 세션 있음:
  - `(tabs)` 접근 허용
- 세션 있음 + profiles 미존재:
  - 가입 분기(`/(auth)/signup`)로 이동 후 프로필/유형 저장을 완료해야 탭 진입

## 엔드포인트/액션 목록 (RLS 연결 포함)
| Domain | Surface | Method | Auth/Role | RLS 연계 | 비고 |
|---|---|---|---|---|---|
| 사연 목록 | `stories` | select | optional | `stories_select_public` | `is_blocked=false` |
| 사연 작성 | `submit_story_rate_limited` | RPC | login, `viewer+` | `stories_insert_owner` | PII/금칙어 검증 포함 |
| 사연 추천 | `cast_story_vote_max1` | RPC | login, `viewer+` | `story_votes_insert_owner` | 중복/멱등 보장 |
| Best 사연 조회 | `best_stories_v` | select | optional | `stories_select_public` | 추천수 기준 상위 3~4 |
| 업로드 세션 | `/functions/v1/create-upload-session` | POST | login, `artist+` | `songs_insert_owner`, storage policy | signed upload token |
| 제출 완료 | `complete_song_submission` | RPC | login, `artist+` | `songs_update_owner` | 경로 규칙 강제 |
| Top10 조회 | `final_tracks_public_v` | select | optional | `final_tracks_select_public` | 공개 상태만 |
| 재생 URL | `/functions/v1/get-track-play-url` | POST | login 권장 | storage read policy | signed URL TTL 적용 |
| 투표 | `cast_votes_max3` | RPC | login, `viewer+` | `votes_insert_owner_top10_only` | 1인 3표 + 중복 방지 |
| 신고 | `create_report_and_queue` | RPC | login, `viewer+` | `reports_insert_owner` | 누적 임계치 반영 |
| 권한 조회 | `/functions/v1/entitlement-status` | GET | login | `entitlements_select_self` | UI gating 용 |
| 뮤지션 신청 | `musician_applications` | insert/select | login | `musician_applications_*` | 본인 신청/조회 |
| 시즌 라운드 조회 | `active_season_round_tracks_v` | select | login | `rounds_select_active` | 예선/본선/결승 목록 |

## 요청/응답 예시
### 사연 작성
Request:
```json
{
  "title": "익명 사연",
  "body": "오늘 들려주고 싶은 이야기",
  "clientRequestId": "2f8f257e-2626-4ba3-a585-a5f0f57d0bb4"
}
```

### 회원가입 분기 (viewer vs musician 신청)
Signup request (공통):
```json
{
  "nickname": "무명청취자",
  "age": 25,
  "gender": "female",
  "favoriteGenre": "ballad",
  "signupType": "viewer"
}
```

Signup request (musician 신청):
```json
{
  "nickname": "무명뮤지션",
  "signupType": "musician",
  "bio": "싱어송라이터입니다.",
  "portfolioUrl": "https://example.com/portfolio",
  "sampleSongUrl": "https://example.com/sample.mp3"
}
```

Server writes:
- profiles upsert (`role=viewer`)
- signupType=musician이면 `musician_applications(status=pending)` insert

### 사연 추천 실행
Request:
```json
{
  "storyId": "5a85ab8f-8ce9-496c-93de-8858f860f9b8",
  "clientRequestId": "8a284e79-85f0-4d99-a4f8-7afdb78fdfe8"
}
```

Response:
```json
{
  "storyId": "5a85ab8f-8ce9-496c-93de-8858f860f9b8",
  "storyVoteCount": 14,
  "idempotentReplay": false
}
```

Best 기준:
- `vote_count desc, created_at desc`
- 기본 노출 개수 `top 3` (운영 설정으로 4까지 확장 가능)
- 조회수/댓글수는 반영하지 않는다.
Response:
```json
{
  "storyId": "c7c72732-5f84-46a6-b7b0-4f0f9c0cadce",
  "status": "accepted"
}
```

### 투표 실행
Request:
```json
{
  "finalTrackId": "72c2198a-6a31-4336-8f0f-54ef9f8bb02d",
  "deviceFingerprint": "dfp_8f1a6f9b",
  "clientRequestId": "3f5c95c6-fb15-4b7d-b584-1637448b990f"
}
```
RPC Raw Response (snake_case):
```json
{
  "accepted": true,
  "remaining_votes": 1,
  "vote_count": 2,
  "vote_id": "c4aa4e5d-a8cf-4236-b90d-b32f62fa9a4d",
  "voted_track_id": "72c2198a-6a31-4336-8f0f-54ef9f8bb02d",
  "idempotent_replay": false
}
```

FE Wrapper Response (camelCase, SSOT):
```json
{
  "voteId": "c4aa4e5d-a8cf-4236-b90d-b32f62fa9a4d",
  "votedTrackId": "72c2198a-6a31-4336-8f0f-54ef9f8bb02d",
  "userVoteCount": 2,
  "idempotentReplay": false
}
```

투표 표준 에러 매핑:
- `DUPLICATE_VOTE` (409): 동일 트랙 재투표(다른 `clientRequestId`)
- `VOTE_LIMIT_EXCEEDED` (409): 사용자 누적 3표 초과

멱등성 규칙:
- 동일 `(auth.uid(), clientRequestId)` 재시도는 에러가 아니라 성공 동일응답을 반환한다.
- 재시도 응답은 `idempotentReplay=true`로 표기한다.
- `deviceFingerprint`는 없으면 빈 문자열이 아니라 `null`(또는 필드 omit)로 전송한다.

### Top10 조회
SSOT surface 확정:
- `GET /rest/v1/final_tracks_public_v?select=id,title,artist,rank&order=rank.asc,id.asc&limit=10`

Request:
```json
{
  "surface": "GET /rest/v1/final_tracks_public_v?select=id,title,artist,rank&order=rank.asc,id.asc&limit=10",
  "auth": "optional (anon/authenticated)"
}
```
Response (snake_case가 있다면 FE에서 1회 camelCase 변환):
```json
[
  {
    "id": "72c2198a-6a31-4336-8f0f-54ef9f8bb02d",
    "title": "새벽의 무명",
    "artist": "익명 뮤지션",
    "rank": 1
  }
]
```

### 현재 시즌 라운드 조회
SSOT surface:
- `GET /rest/v1/active_season_round_tracks_v?select=season_id,round_id,round_type,track_id,title,artist,display_order&order=round_type.asc,display_order.asc`

Response:
```json
[
  {
    "season_id": "cbf6a96a-cf5e-4e03-bf2e-5f9b61958c4b",
    "round_id": "3417f5f3-f76e-4b72-9719-d1fd4d2ecd72",
    "round_type": "qualifier",
    "track_id": "72c2198a-6a31-4336-8f0f-54ef9f8bb02d",
    "title": "새벽의 무명",
    "artist": "익명 뮤지션",
    "display_order": 1
  }
]
```

## 인증/권한 요구사항
- 기본 인증: Supabase Auth 세션 JWT.
- Role 기준: `profiles.role`.
- 권한 판정 우선순위:
  1) 인증 여부
  2) 역할(role)
  3) 소유권(owner)
  4) 상태(status) 및 제약(limit)
- FE는 UI 표시 제어만 수행하며, 최종 허용/거부는 서버에서 판정한다.
- 업로드 권한:
  - `profiles.role='artist'` + 신청 상태 `approved` 조건을 모두 충족해야 업로드 세션 발급 허용
  - `pending/rejected/viewer`는 `FORBIDDEN_ROLE` 반환

### Edge Function `verify_jwt` 정책 (SSOT)
| Function | verify_jwt | 정책 결정 | 클라이언트 토큰 규칙 |
|---|---|---|---|
| `/functions/v1/create-upload-session` | `false` (TEMP) | Edge Gateway verify 레이어에서 정상 access_token도 `401 Invalid JWT`로 차단되는 이슈가 있어 임시 우회한다. 근거: `docs/plan/execution-logs/ticket-05-be.md` (`Ticket 05.3`, `Ticket 05.4`). | 함수 내부 `requireAuth`(JWT 검증) + `requireRole(artist/admin)` + song 소유권 검증을 필수 강제한다. |
| `/functions/v1/get-track-play-url` | `true` (현행 확정) | 향후 entitlement/개인화 확장 대비해 인증 컨텍스트를 유지한다. | 인증 토큰 기반 호출을 기본으로 하며, 공개 재생 전용으로 완전 전환 시에만 `false`로 재결정한다. |

운영 가드레일:
- `verify_jwt`는 기능 요구와 무관하게 임시 우회(`false`)로 유지하지 않는다.
- `verify_jwt` 변경은 본 문서와 실행 로그(`docs/plan/execution-logs/ticket-05-be.md`)에 함께 기록한다.
- TEMP 만료 조건(`create-upload-session`):
  - Supabase gateway JWT verify 이슈 해결 후 `verify_jwt=true`로 원복.
  - 추적 이슈 ID: `SUPABASE-EDGE-JWT-VERIFY-401` (placeholder).
  - 단계적 정상화/롤백 절차는 `docs/plan/execution-logs/ticket-05-5-jwt-investigation.md`를 기준으로 실행한다.
  - 원복 검증 기준: 테스트 계정 기준 정상 호출 5회 연속 200 + 무권한 케이스 401/403 + 함수 레벨 `correlationId` 관측.
  - 기준 미충족 시 즉시 `verify_jwt=false`로 롤백하고 support 이슈에 재발 시점/`sb-request-id`를 추가한다.

## 표준 에러 코드와 사용자 메시지
| code | HTTP | 사용자 메시지 | retryable |
|---|---:|---|---|
| `AUTH_REQUIRED` | 401 | 로그인이 필요합니다. | false |
| `FORBIDDEN_ROLE` | 403 | 권한이 없습니다. | false |
| `RLS_DENIED` | 403 | 요청을 처리할 수 없습니다. | false |
| `RATE_LIMITED` | 429 | 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요. | true |
| `VOTE_LIMIT_EXCEEDED` | 409 | 투표 가능 횟수를 초과했습니다. | false |
| `DUPLICATE_VOTE` | 409 | 이미 투표한 곡입니다. | false |
| `CONTENT_BLOCKED` | 422 | 정책상 등록할 수 없는 내용이 포함되어 있습니다. | false |
| `STORAGE_PATH_INVALID` | 400/403 | 파일 경로가 올바르지 않습니다. | false |
| `NOT_FOUND` | 404 | 요청한 정보를 찾을 수 없습니다. | false |
| `CONFLICT` | 409 | 이미 처리된 요청입니다. | false |
| `NETWORK_UNAVAILABLE` | 503 | 네트워크 연결을 확인해 주세요. | true |
| `UNKNOWN` | 500 | 일시적인 오류가 발생했습니다. 다시 시도해 주세요. | true |

### 에러 코드 상세 정의

다음 두 코드는 AGENTS.md의 `AppErrorCode` 타입과 호환되며, 상세 정의는 본 섹션이 단일 진실이다.

#### DUPLICATE_VOTE

| 항목 | 내용 |
|---|---|
| 의미(언제 발생) | 동일 사용자가 이미 투표한 트랙에 대해 재투표 요청 시(동일 트랙 중복). |
| 권장 HTTP status | 409 (Conflict) |
| status 선택 이유 | 리소스 상태 충돌(이미 투표됨)을 나타내며, 클라이언트가 상태를 갱신 후 재시도해야 함을 암시함. |
| retryable | false |
| details 스키마 | `{ "trackId": string, "remainingVotes": number }` — 중복된 트랙 ID, 현재 잔여 투표 수. |
| 표준 userMessage | "이미 투표한 곡입니다." |

#### STORAGE_PATH_INVALID

| 항목 | 내용 |
|---|---|
| 의미(언제 발생) | 업로드 세션 발급, 업로드 완료, 제출 등록(`complete_song_submission`) 단계에서 경로 규칙(`artist/{user_id}/song/{song_id}/...`) 위반 시. 잘못된 확장자, 임의 경로, 타인 경로 접근 시. |
| 권장 HTTP status | 기본 400 (Bad Request) / 예외 403 (Forbidden) |
| status 선택 이유 | 경로 규칙·버킷·확장자 위반은 클라이언트 요청 형식 오류이므로 400. 소유권 불일치(타인 경로 접근 시도)는 권한 거부이므로 403. |
| retryable | false |
| details 스키마 | `{ "bucket": string, "expectedPrefix": string, "receivedPath": string }` — 대상 버킷, 기대 경로 접두사, 실제 수신 경로. |
| 표준 userMessage | "파일 경로가 올바르지 않습니다." |

## 에러 응답 포맷
```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded for submit_story_rate_limited",
    "userMessage": "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    "retryable": true,
    "correlationId": "d8f95a4e-188f-4be1-a7bf-137d8ec29e2f",
    "details": {
      "retryAfterSeconds": 30
    }
  }
}
```

## 레이트리밋/어뷰징 방지 규칙
- 사연 작성:
  - 계정 기준 분당/시간당 제한.
  - 동일 payload 반복 제출은 `clientRequestId`로 중복 차단.
- 신고:
  - 동일 대상 중복 신고 제한.
  - 짧은 시간 다량 신고 시 cooldown 부여.
- 투표 (1인 3표 부정 방지):
  - 계정 기준 총 3표 제한.
  - 동일 트랙 중복 투표 금지.
  - 디바이스 지문(`deviceFingerprint`) 기반 이상 패턴 감지 로그 저장.
  - 계정/디바이스 결합 레이트리밋 적용(예: 10분 창).
- 공통:
  - 서버 타임 기준 계산.
  - FE는 힌트만 표시, 강제는 서버.
  - 보안 로그(요청자, 디바이스, IP 해시, 결과 코드, correlationId) 저장.

## Storage 접근 계약
- 버킷:
  - `song-audio`: 비공개(private)
  - `song-cover`: 기본 비공개(private), 공개 전환은 admin 워크플로우에서만
- 경로:
  - 오디오: `artist/{user_id}/song/{song_id}/audio.{ext}`
  - 커버: `artist/{user_id}/song/{song_id}/cover.{ext}`
- 업로드 파일 규격:
  - 오디오는 `mp3`만 허용
  - 오디오 최대 크기 `10MB`
- signed URL 정책:
  - 발급 주체: Edge Function만
  - TTL: 재생용 60초, 업로드용 300초
  - scope: 단일 객체 + 단일 method
  - 재발급: 만료/권한 변경 시 즉시 재검증 후 발급

## Entitlement 인터페이스 계약
- 결제 구현은 티켓 범위이며, 여기서는 인터페이스만 고정한다.
- FE:
  - `GET /functions/v1/entitlement-status` 호출 결과로 UI gating만 수행.
- BE:
  - 민감 동작 전 `entitlements` + 외부 검증 상태로 최종 허용 판정.
- 연동 포인트:
  - `POST /functions/v1/verify-purchase-receipt` (구현 티켓)

## 보안 주의사항 (클라이언트 단독 판단 금지)
- 역할(role) 허용 여부
- 투표 가능 잔여 횟수/중복 여부
- 신고 cooldown/레이트리밋 통과 여부
- 스토리지 파일 접근 허용 여부
- entitlement 최종 유효성
- 운영자(admin) 권한 확인
- 차단 콘텐츠 게시 허용 여부

## 변경 이력
- 2026-02-17: PR00 계약 보강 - Auth gate(로그인 강제), 회원가입 유형 분기, `musician_applications`, `cast_story_vote_max1`+Best 기준, 주간 시즌/라운드 조회 surface, 업로드 mp3/10MB 제한을 확정.
- 2026-02-16: RLS 연결 표 추가, Storage 공개/비공개 및 signed URL 정책 명문화, 투표 부정 방지 전략 확장, 표준 에러 코드 보강.
- 2026-02-16: Ticket 02 기준 `cast_votes_max3` 구현 역링크와 votes RLS(`votes_insert_owner_top10_only`) 연결, `DUPLICATE_VOTE`/`VOTE_LIMIT_EXCEEDED` 매핑 명시.
- 2026-02-16: Ticket 02.1 hotfix로 투표 멱등 재시도 성공 동일응답(`idempotentReplay`) 규칙 및 응답 필드 보강.

## 결정 근거
- 구현 전 계약 정밀도를 높여 FE/DB/BE 간 해석 차이를 줄인다.
- 권한/보안 관련 로직은 서버 강제 지점(RLS/RPC/Edge)으로만 통일해 우회 경로를 축소한다.

## 비결정(추후)
- 디바이스 지문 구체 수집 방식(SDK/해시 정책)
- IP 기반 차단 임계치(지역/사업자별 편차 고려)
- 신고 임계치 동적 조정 방식(AB 또는 운영 콘솔)

## 구현 역링크
- Ticket 02 마이그레이션: `supabase/migrations/202602160002_votes_rpc.sql`
- Ticket 02 정책 카탈로그: `supabase/policies/02_votes_rls.sql`
- Ticket 02 실행 로그: `docs/plan/execution-logs/ticket-02-db.md`
- Ticket 02.1 마이그레이션: `supabase/migrations/202602160210_ticket02_1_votes_idempotency.sql`
- Ticket 02.1 실행 로그: `docs/plan/execution-logs/ticket-02-1-db.md`
