# PR-NEXT-08: create-upload-session 이중 스키마 지원 + signup 샘플 업로드 계약

## 문제

- signup 뮤지션 가입 시 샘플 업로드에서 `STORAGE_PATH_INVALID` 발생
- `details.expected = { songId, kind }` → song 제출 스키마만 기대
- signup은 application 스키마 `{ purpose:"application", applicationId, kind:"audio" }` 로 호출

## 원인

- 배포된 Edge Function이 application 분기 미포함이거나, 요청 파싱 시 purpose 누락
- 클라이언트와 서버 contract 불일치 가능성

## 수정 사항

### 1. 클라이언트 로그 (`features/musician-apply/api/mutations.ts`)
- `createApplicationSampleUploadSession` 호출 전: `[uploadSession][reqKeys]`, `bodyPreview` (purpose, applicationId, kind)
- signup 호출 직전: `[signup][uploadSession] applicationId=`

### 2. Edge Function 로그 (`supabase/functions/create-upload-session/index.ts`)
- 요청 수신 직후: `[create-upload-session] mode=, uid=, purpose=, applicationId=, songId=, kind=`
- application 분기: `mode=application path=artist/{uid}/application/{id}/sample.mp3`
- song 분기: `mode=song path=...`

### 3. dual schema (기존 유지)
- `purpose === "application"`: applicationId 필수, 경로 `artist/{uid}/application/{applicationId}/sample.mp3`
- `purpose !== "application"` (기본): songId 필수, 경로 `artist/{ownerId}/song/{songId}/{kind}.{ext}`

## 배포

```powershell
npx supabase functions deploy create-upload-session
```

## 검증

### A) 파일 경로 성공
- signup 뮤지션 + mp3 선택
- 로그: `[create-upload-session] mode=application path=artist/<uid>/application/<uuid>/sample.mp3`
- 업로드 200/201
- DB `musician_applications.sample_song_audio_path` 저장
- Admin 샘플 재생 동작

### B) song 제출 회귀 방지
- submission/new 기존 플로우: songId + kind (audio/cover)
- 로그: `mode=song`
- 기존 동작 유지

### C) URL 전용
- signup 뮤지션 + sample URL만 입력
- DB `sample_song_url` 저장
- Admin에서 playFromUrl 재생
