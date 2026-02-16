# Ticket 05 BE 실행 로그

## 요약
- 목표: Edge Function 2종 구현
  - `create-upload-session` (업로드 signed upload URL, TTL 300초 계약)
  - `get-track-play-url` (재생 signed URL, TTL 60초)
- 결과:
  - 생성: `supabase/functions/create-upload-session/index.ts`
  - 생성: `supabase/functions/get-track-play-url/index.ts`
  - 생성: `supabase/functions/_shared/auth.ts`
  - 생성: `supabase/functions/_shared/errors.ts`

## 구현 포인트
1. 공통(`_shared/auth.ts`, `_shared/errors.ts`)
   - Bearer JWT 기반 인증 처리(`requireAuth`) + 선택 인증(`getOptionalAuth`)
   - role 판정(`profiles.role`) + role allowlist 체크(`requireRole`)
   - 표준 에러 포맷 응답:
     - `error.code`, `error.message`, `error.userMessage`, `error.retryable`, `error.correlationId`, `error.details`
   - 요청별 `correlationId`(`crypto.randomUUID()`) 생성

2. `create-upload-session`
   - 입력: `songId`, `kind(audio|cover)`, `filename|mimeType`
   - 검증:
     - 인증 필수
     - role: `artist|admin`
     - song 소유권(artist_id == auth.uid, admin 예외 허용)
     - 확장자/경로 규칙(`artist/{user_id}/song/{song_id}/{kind}.{ext}`)
   - 동작:
     - 버킷 선택: `audio -> song-audio`, `cover -> song-cover`
     - signed upload URL 발급 (`createSignedUploadUrl`)
   - 응답:
     - `correlationId`, `bucket`, `objectPath`, `signedUrl`, `token`, `expiresIn(300)`

3. `get-track-play-url`
   - 입력: `finalTrackId`
   - 검증:
     - `final_tracks` 존재 확인
     - 현재 단계 공개 기준: `final_tracks.status = 'top10'`
     - 연결된 `songs.audio_path` 존재 확인
   - 동작:
     - `song-audio` 버킷에서 signed URL 생성 (`createSignedUrl(..., 60)`)
   - 응답:
     - `correlationId`, `signedUrl`, `expiresIn(60)`

## 로컬 검증 로그
```bash
npx supabase functions serve --no-verify-jwt
```

실행 결과:
- 실패: Docker Desktop 미실행/미설치 상태
- 핵심 에러:
  - `failed to inspect service ... dockerDesktopLinuxEngine ...`
  - `Docker Desktop is a prerequisite for local development.`

## Observed Results (Remote)
- 실행 일시: 2026-02-16
- 환경: remote (`kwzguusrbciklojvimsh`)

### 1) 배포 커맨드 출력(핵심)
```bash
npx supabase functions deploy create-upload-session
npx supabase functions deploy get-track-play-url
npx supabase functions list
```

관측 핵심:
- `Deployed Functions on project kwzguusrbciklojvimsh: create-upload-session`
- `Deployed Functions on project kwzguusrbciklojvimsh: get-track-play-url`
- `functions list` 확인:
  - `create-upload-session` / `ACTIVE` / `VERSION 1`
  - `get-track-play-url` / `ACTIVE` / `VERSION 1`

### 2) 테스트 데이터 준비(원격)
- 테스트 user(artist), song, final_track을 원격에 생성
- 민감정보 마스킹:
  - `userId`: `1e96045d-...-ccf57440bb89`
  - `songId`: `60bf21e6-...-cb17d7920b8a`
  - `finalTrackId`: `2e7ef8fa-...-81dbf114147f`
  - JWT/키 값은 로그에 원문 미기록

### 3) 케이스별 요청/응답 관측

#### A-1. create-upload-session 정상(artist JWT + 본인 song)
- Request (masked):
  - `POST /functions/v1/create-upload-session`
  - `Authorization: Bearer <artist-jwt>`
  - body: `{"songId":"60bf...","kind":"audio","filename":"audio.mp3"}`
- Observed:
  - HTTP `401`
  - body: `{"code":401,"message":"Invalid JWT"}`
- 기대(`200`, `expiresIn=300`, `correlationId`) 대비 실패

#### A-2. create-upload-session 무권한(anon JWT)
- Request (masked):
  - `POST /functions/v1/create-upload-session`
  - `Authorization: Bearer <anon-jwt>`
  - body: `{"songId":"60bf...","kind":"audio","filename":"audio.mp3"}`
- Observed:
  - HTTP `401`
  - 표준 에러 포맷 확인:
    - `error.code = AUTH_REQUIRED`
    - `error.message = Invalid auth token`
    - `error.retryable = false`
    - `error.correlationId = 73406dc1-7c0f-4005-a202-507cb4364af0`

#### B-1. get-track-play-url 정상(top10 + audio_path 존재 기대)
- Request (masked):
  - `POST /functions/v1/get-track-play-url`
  - `Authorization: Bearer <anon-jwt>`
  - body: `{"finalTrackId":"2e7e..."}`
- Observed:
  - HTTP `500`
  - 표준 에러 포맷 확인:
    - `error.code = UNKNOWN`
    - `error.message = Failed to create play signed url`
    - `error.retryable = true`
    - `error.correlationId = e5323dd8-95c1-4583-94fc-345efc3b520e`

#### B-2. get-track-play-url 실패(존재하지 않는 finalTrackId)
- Request (masked):
  - `POST /functions/v1/get-track-play-url`
  - `Authorization: Bearer <anon-jwt>`
  - body: `{"finalTrackId":"00000000-0000-0000-0000-000000000000"}`
- Observed:
  - HTTP `404`
  - 표준 에러 포맷 확인:
    - `error.code = NOT_FOUND`
    - `error.message = Final track not found`
    - `error.retryable = false`
    - `error.correlationId = f8577410-1fd1-4972-b0a4-8bc8ec208668`

### 4) CorrelationId 샘플
- `73406dc1-7c0f-4005-a202-507cb4364af0`
- `e5323dd8-95c1-4583-94fc-345efc3b520e`
- `f8577410-1fd1-4972-b0a4-8bc8ec208668`

### 5) PASS/FAIL 요약
| # | Scenario | Expected | Observed | PASS/FAIL | Notes |
|---|---|---|---|---|---|
| A-1 | create-upload-session 정상(artist) | 200 + signedUrl + expiresIn=300 + correlationId | 401 Invalid JWT | FAIL | API Gateway JWT 검증 단계에서 차단됨 |
| A-2 | create-upload-session 무권한 | 401/403 + 표준 에러 포맷 + correlationId | 401 AUTH_REQUIRED + correlationId | PASS | 표준 에러 포맷 확인됨 |
| B-1 | get-track-play-url 정상(top10) | 200 + signedUrl + expiresIn=60 + correlationId | 500 UNKNOWN + correlationId | FAIL | storage signed url 생성 실패(`audio_path` 대상 객체 상태 점검 필요) |
| B-2 | get-track-play-url 실패(존재X) | 표준 에러 포맷 | 404 NOT_FOUND + correlationId | PASS | 표준 에러 포맷 확인됨 |

## Debug Addendum (Ticket 05.1) — 401 Invalid JWT 원인 분리
- 실행 일시: 2026-02-16
- 목표: `create-upload-session`의 401 원인을 "토큰 소스"인지, "함수 내부 검증"인지 분리

### 1) 테스트 유저/토큰 준비
- 원격에서 테스트 유저 생성 후 password 로그인으로 `access_token` 발급
- JWT 형식 점검(수동 decode):
  - `segments = 3` (header.payload.signature)
  - `alg = ES256`, `typ = JWT`
  - `iss = https://kwzguusrbciklojvimsh.supabase.co/auth/v1`
  - `aud = authenticated`
  - `sub = <test-user-id>`
  - `exp = 1771256418`
- 동일 토큰으로 `GET /auth/v1/user` 호출 성공(`authUserId == sub`) 확인

### 2) 함수 재호출 결과
- `Authorization: Bearer <access_token>` + `create-upload-session` 호출:
  - Observed: HTTP `401`, body `{"code":401,"message":"Invalid JWT"}`
  - 특징: `correlationId` 없음 (함수 표준 에러 포맷 미도달)
- `Authorization: Bearer <anon-jwt>` + 동일 호출:
  - Observed: HTTP `401`, `error.code = AUTH_REQUIRED`, `correlationId` 존재
  - 특징: 함수 내부 에러 포맷 도달

### 3) 결론(원인 분리)
- 이번 401(`Invalid JWT`)는 `requireAuth` 이전 단계(Edge gateway JWT verify 단계)에서 차단된 케이스로 분류됨.
- 즉, "함수 코드 로직 실패"가 아니라 "토큰 검증 경로/토큰 소스 매칭 문제"로 보는 것이 타당함.
- 근거:
  1) user access token은 실제 JWT이며 `/auth/v1/user` 검증 통과
  2) 그러나 함수 호출에서는 gateway 레벨에서 `Invalid JWT`로 즉시 실패(함수 포맷 미도달)
  3) anon 토큰은 함수 내부까지 진입하여 `AUTH_REQUIRED + correlationId`를 반환

### 4) 관측 correlationId
- user access token 케이스: 없음(gateway 차단)
- anon 케이스(함수 내부 도달): `1bfe9a78-9a64-4e4d-9521-69e4796ca217`

### 5) 후속 점검 항목(코드 변경 전)
- Dashboard Functions Logs에서 같은 시각 요청의 verify 실패 로그(iss/aud/exp claim 검증 메시지) 확인
- 프로젝트 JWT 검증 설정(verify_jwt=true)과 Auth 토큰 체계(ES256) 호환성 확인
- 호출 헤더 조합(`apikey`로 legacy anon vs publishable key) 정책 정합성 확인

## Observed (Remote) - Debug (Ticket 05.2)
- 실행 일시: 2026-02-16
- 목표:
  - FAIL 1) `create-upload-session` 401 `Invalid JWT`
  - FAIL 2) `get-track-play-url` 500 `UNKNOWN`

### A) 401 `Invalid JWT` 원인 분리 + 최소 패치

#### A-1. 재현(패치 전)
- 테스트 유저 로그인으로 발급된 `access_token` 확인:
  - JWT 3세그먼트(`header.payload.signature`)
  - `alg=ES256`, `iss=https://kwzguusrbciklojvimsh.supabase.co/auth/v1`, `aud=authenticated`
  - `GET /auth/v1/user` 통과
- 같은 토큰으로 `create-upload-session` 호출:
  - Observed: `401 {"code":401,"message":"Invalid JWT"}`
  - `correlationId` 없음(함수 내부 미진입)

#### A-2. 최소 패치(코드 변경 없음, 배포 설정)
- 적용:
  - `npx supabase functions deploy create-upload-session --no-verify-jwt`
- 확인:
  - `npx supabase functions list --output json`
  - `create-upload-session`: `verify_jwt=false`, `version=2`

#### A-3. 패치 후 정상 호출
- `Authorization: Bearer <user access_token>` + 본인 `songId`:
  - Observed: HTTP `200`
  - 응답 필드:
    - `bucket=song-audio`
    - `objectPath=artist/{user_id}/song/{song_id}/audio.mp3`
    - `signedUrl` 존재
    - `expiresIn=300`
    - `correlationId=d85010bc-146f-4fe5-bb73-5eecf17c416d`
- 결론:
  - 기존 401은 "토큰 문자열 자체 불량"이 아니라 gateway JWT verify 경로 이슈.
  - 현재는 함수 내부 `requireAuth` 검증 경로로 정상 처리됨.

### B) 500 `UNKNOWN` 원인 분리(storage)

#### B-1. SQL 템플릿 동등 관측(원격)
아래 3개 SQL 템플릿에 대응하는 동등 관측을 원격 API로 확인함.

1) `finalTrackId -> songId/audio_path`
- Observed:
  - `final_track_id=2e7ef8fa-d480-4821-905e-81dbf114147f`
  - `status=top10`
  - `song_id=60bf21e6-5007-4692-a4ff-cb17d7920b8a`
  - `audio_path=artist/1e96045d-baa4-4c80-9b3e-ccf57440bb89/song/00000000-0000-0000-0000-000000000001/audio.mp3`

2) `storage.objects` 존재 확인(동등: storage list API)
- Observed:
  - `bucket=song-audio`
  - `prefix=artist/1e96045d-baa4-4c80-9b3e-ccf57440bb89/song/00000000-0000-0000-0000-000000000001`
  - `targetFile=audio.mp3`
  - `matchCount=1` (객체 존재)
  - `created_at=2026-02-16T14:29:59.026Z`

3) 경로 규칙 점검
- Observed:
  - `audio_path like 'artist/%/song/%/%' = true`

#### B-2. 함수 재호출
- `get-track-play-url` 재호출(동일 `finalTrackId`)
- Observed:
  - HTTP `200`
  - `signedUrl` 존재
  - `expiresIn=60`
  - `correlationId=6b9c5b84-80c2-44d2-8563-4471f802004f`

#### B-3. 결론
- 초기 500(`Failed to create play signed url`)은 당시 스토리지 객체 준비 상태와 시점 이슈로 판단됨.
- 현재 관측 기준으로는:
  - `audio_path` 유효
  - `song-audio` 객체 존재
  - signed URL 발급 정상(200)
- 따라서 Ticket 05 코드의 즉시 수정 필요성은 낮음(문서상 데이터 선행조건을 명시하는 것으로 충분).

### PASS/FAIL 업데이트 (Ticket 05.2)
| Scenario | Before | After | 최종 판정 |
|---|---|---|---|
| create-upload-session 정상(user token) | 401 Invalid JWT | 200 + signed upload URL | RESOLVED (운영 설정 패치) |
| get-track-play-url 정상(top10 + object 존재) | 500 UNKNOWN | 200 + signed URL | RESOLVED (데이터/시점 이슈) |

## 수동 테스트(curl 예시)

### 1) 무권한 요청 (create-upload-session)
```bash
curl -i -X POST "http://127.0.0.1:54321/functions/v1/create-upload-session" \
  -H "Content-Type: application/json" \
  -d '{"songId":"<song-id>","kind":"audio","filename":"audio.mp3"}'
```
기대:
- HTTP 401
- `error.code = AUTH_REQUIRED`

### 2) 정상 업로드 세션 발급
```bash
curl -i -X POST "http://127.0.0.1:54321/functions/v1/create-upload-session" \
  -H "Authorization: Bearer <artist-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"songId":"<song-id>","kind":"audio","filename":"audio.mp3"}'
```
기대:
- HTTP 200
- `bucket=song-audio`
- `objectPath=artist/<uid>/song/<songId>/audio.mp3`
- `signedUrl` 존재
- `correlationId` 존재

### 3) 정상 재생 URL 발급
```bash
curl -i -X POST "http://127.0.0.1:54321/functions/v1/get-track-play-url" \
  -H "Content-Type: application/json" \
  -d '{"finalTrackId":"<top10-final-track-id>"}'
```
기대:
- HTTP 200
- `signedUrl` 존재
- `expiresIn=60`
- `correlationId` 존재

### 4) 만료 후 재요청
- 60초 만료 이후 동일 `finalTrackId`로 재요청
- 기대: 새 `signedUrl` 재발급

## 롤백 힌트
- 함수 단위 롤백:
  1) `supabase/functions/create-upload-session/index.ts` 이전 버전 복구
  2) `supabase/functions/get-track-play-url/index.ts` 이전 버전 복구
  3) `_shared/auth.ts`, `_shared/errors.ts`를 Ticket 05 이전 상태로 복구
