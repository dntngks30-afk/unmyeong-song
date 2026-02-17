# Ticket 05.5 — verify_jwt Invalid JWT 조사/정상화 플랜

## A) 현상 요약 (5줄)
1. `create-upload-session`를 `verify_jwt=true`로 배포하면 Edge Gateway 레이어에서 `401 Invalid JWT`가 발생하며 함수 표준 에러(`correlationId`)까지 도달하지 않는다.  
2. `verify_jwt=false`에서는 함수 내부 `requireAuth`/`requireRole`/ownership 검증이 동작하여 내부 통제는 유지된다.  
3. 영향 범위는 업로드 세션 발급 경로(`/functions/v1/create-upload-session`)이며, 제출 업로드 플로우의 선행 단계가 차단된다.  
4. 현재 운영 상태는 TEMP 우회(`verify_jwt=false`)이며, `get-track-play-url`는 `verify_jwt=true`를 유지 중이다.  
5. 긴급도는 중-상: 기능은 우회로 운영 가능하지만 gateway 1차 JWT 검증 부재 상태를 장기 유지하면 보안/운영 리스크가 누적된다.  

## B) 재현 단계 (복붙 가능)
전제: 테스트 계정(artist) 로그인으로 `access_token` 확보

1) 토큰 발급(예: auth API)
```bash
curl -s -X POST "https://kwzguusrbciklojvimsh.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: <ANON_OR_PUBLISHABLE_KEY>" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"<TEST_EMAIL>\",\"password\":\"<TEST_PASSWORD>\"}"
```
- 응답의 `access_token` 사용

2) `verify_jwt=true` 상태에서 create-upload-session 호출
```bash
curl -i -X POST "https://kwzguusrbciklojvimsh.supabase.co/functions/v1/create-upload-session" \
  -H "apikey: <ANON_OR_PUBLISHABLE_KEY>" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"songId":"<OWN_SONG_ID>","kind":"audio","filename":"audio.mp3"}'
```

기대값:
- HTTP 200
- 함수 응답(`correlationId`, `bucket`, `objectPath`, `signedUrl`, `expiresIn=300`)

관측값:
- HTTP 401
- body: `{"code":401,"message":"Invalid JWT"}`
- 함수 포맷 미도달(`correlationId` 없음)

## C) 토큰/키 근거 (마스킹)
- access token header 예시(마스킹):
  - `alg=ES256`
  - `kid=e39abf87-...-0d0bb67f`
- 프로젝트 JWKS(`/.well-known/jwks.json`) 관측:
  - 위 `kid`와 일치하는 key 존재 확인
- 동일 `access_token`으로 `/auth/v1/user` 호출:
  - 정상 200 (user identity 확인)
- 결론:
  - Auth 경로에서는 유효 토큰으로 처리되나, Edge `verify_jwt=true` 경로에서만 gateway 레벨 `Invalid JWT` 발생

## D) 가설 3개 + 판별 테스트
1. **가설: Edge Gateway가 다른 issuer/audience 또는 JWKS를 참조한다.**  
   - 확인 방법: 동일 토큰으로 `auth/v1/user` 성공 + functions 401을 같은 시간대에 수집하고, `sb-request-id` 기준으로 gateway 검증 로그에서 `iss/aud/kid` 판정값 비교.

2. **가설: 전달 토큰 타입/키 조합(apikey, Authorization) 처리 분기 문제다.**  
   - 확인 방법: `apikey`를 anon/publishable/service-role(보안 통제된 환경)로 바꿔 A/B 호출하고 실패 패턴이 동일한지 확인.

3. **가설: 키 회전/캐시/리전 동기화 이슈로 gateway가 구버전 키셋을 본다.**  
   - 확인 방법: 시간 간격 재시도(예: 5/15/30분), function 재배포 후 동일 토큰/신규 토큰 비교, 리전/프로젝트 메타와 함께 support에 캐시 무효화 요청.

## E) 정상화 플랜 (단계)
### Step 1) TEMP 유지 조건 (현재)
- `create-upload-session verify_jwt=false` 유지 기간: support 1차 답변 + 재현 세트 확인 완료 시점까지.
- 운영 통제:
  - 함수 내부 `requireAuth` + `requireRole(artist/admin)` + song ownership 강제
  - 실패/성공 이벤트에 `correlationId` 저장
- 모니터링:
  - `AUTH_REQUIRED`, `FORBIDDEN_ROLE`, `UNKNOWN` 비율
  - 업로드 세션 발급 성공률

### Step 2) `verify_jwt=true` 재시도 조건
- 조건:
  - 지원팀 답변으로 gateway 검증 포인트 확인
  - 테스트 계정/테스트 song으로 5회 연속 성공(200) 검증
- 절차:
  1) staging 성격의 검증 시간창 확보
  2) `create-upload-session`을 `verify_jwt=true`로 재배포
  3) 체크리스트 수행: 정상/무권한/만료토큰 시나리오

### Step 3) 성공 시 롤아웃
- 운영 반영:
  - `verify_jwt=true` 유지 배포
  - `docs/contracts/api.md` TEMP 문구 제거 또는 완료 처리
  - 실행 로그에 PASS 증거 추가

### Rollback (즉시 복귀)
- 조건: 재시도 중 401 `Invalid JWT` 재발
- 절차:
  1) `create-upload-session --no-verify-jwt` 재배포
  2) `functions list`로 플래그/버전 확인
  3) 운영 로그에 재발 시점/요청 식별자 기록

## F) Supabase 지원 이슈 제출 템플릿 (완성본)
제목:
- `[Edge Gateway] verify_jwt=true rejects valid access_token with 401 Invalid JWT`

본문:
```text
Project ref: kwzguusrbciklojvimsh
Region: <PROJECT_REGION>
Function: create-upload-session
Current setting: verify_jwt=true (issue reproduces), verify_jwt=false (works via internal requireAuth)

Reproduction:
1) Login and obtain access_token (JWT: alg=ES256, kid=<masked-kid>)
2) Call POST /functions/v1/create-upload-session
   - Authorization: Bearer <access_token>
   - apikey: <anon/publishable key>
   - body: {"songId":"<own-song-id>","kind":"audio","filename":"audio.mp3"}

Expected:
- 200 OK from function
- JSON with correlationId, signedUrl, expiresIn

Observed:
- 401 {"code":401,"message":"Invalid JWT"}
- No function-level correlationId (function error format not reached)
- Failure appears before function code execution (gateway verification layer)

Token/JWKS evidence:
- access_token header: alg=ES256, kid=<masked-kid>
- JWKS endpoint contains matching kid
- /auth/v1/user with same access_token returns 200

Time window (UTC):
- <YYYY-MM-DD HH:MM~HH:MM UTC>

Request identifiers:
- sb-request-id: 019c66f3-22dc-759c-8a75-cdda5cee04db
- sb-request-id: 019c66f3-7e72-7576-9e60-5592b2fc28a8

Attachments:
- docs/plan/execution-logs/ticket-05-be.md (Ticket 05.3, 05.4 evidence)
- docs/plan/execution-logs/ticket-05-5-jwt-investigation.md
```

## 참고 링크
- `docs/contracts/api.md` (Edge verify_jwt 정책)
- `docs/plan/execution-logs/ticket-05-be.md`
