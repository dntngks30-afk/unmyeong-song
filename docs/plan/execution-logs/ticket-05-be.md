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
