# PR-NEXT-07: 뮤지션 회원가입 INVALID_EMAIL 수정 + 샘플 필수 + 완료 리다이렉트

## Root Cause

1. **이메일 검증 실패**: 기존 `EMAIL_REGEX`가 일부 유효 이메일을 거절하거나, `trim().toLowerCase()`만 적용해 zero-width 문자(`\u200B-\u200D`, `\uFEFF`)가 남아 Supabase Auth 거절 가능.
2. **샘플 URL 미지원**: `sample_song_url` 컬럼은 있으나 저장 RPC 없음. Admin에서 URL 재생 분기 없음.
3. **제출 RPC 한계**: `submit_musician_application`가 `sample_song_audio_path`만 허용하여 URL-only 케이스에서 제출 불가.

## Diff Summary

### 신규
- `src/lib/auth/email.ts`: `normalizeEmail`, `validateEmailFormat`, `emailDebugPreview`
- `supabase/migrations/202602200002_set_musician_application_sample_url.sql`:
  - `set_musician_application_sample_url` RPC
  - `submit_musician_application` 확장: `sample_song_audio_path` OR `sample_song_url` 허용

### 수정
- `app/(auth)/signup.tsx`:
  - `normalizeEmail` / `validateEmailFormat` 사용
  - Zero-width 제거, 로컬@도메인.tld 검증
  - `[auth][signup] email debug` 로그 (len, leadingTrailing, newline, preview)
  - 뮤지션 샘플 필수 검사: 파일 OR URL 중 하나 필요
  - `sample_song_url` 저장 플로우 추가
  - 이메일 입력 `onBlur` 시 normalize
- `features/musician-apply/api/mutations.ts`: `setMusicianApplicationSampleUrl` 추가
- `features/admin/api/queries.ts`: `sample_song_url` 쿼리 포함
- `app/(tabs)/admin/index.tsx`: URL 재생 분기 (path 없으면 `sample_song_url`로 직접 재생)

## Acceptance Tests

### A) INVALID_EMAIL 회귀 방지
**재현**:
1. 이메일: `" TestUser@Example.com  "` (앞뒤 공백)
2. 뮤지션, 아티스트명, 샘플 mp3 선택
3. 가입완료 탭

**기대**:
- INVALID_EMAIL 없음
- 완료 Alert 후 확인 → `/login` 이동
- 콘솔: `[auth][signup] email debug len=... leadingTrailing=true newline=false preview=testuser@example.com`

### B) 샘플 필수
**재현**:
1. 뮤지션, 아티스트명만 입력
2. 샘플 파일/URL 없이 가입완료 탭

**기대**:
- `"샘플 곡(파일 또는 URL)을 입력해 주세요."` 표시
- signUp 호출 안 함

### C) End-to-end (세션 있을 때)
**파일**:
- 가입 후 `musician_applications`에 `sample_song_audio_path` 존재
- Storage: `artist/{uid}/application/{applicationId}/sample.mp3`
- Admin 탭에서 샘플 재생 버튼 → 재생

**URL**:
- `sample_song_url` 저장
- Admin 탭에서 샘플 재생 → URL 직접 재생

### D) Admin 탭 비노출
- 비관리자: admin 탭 `href: null`, 직접 접근 시 home 리다이렉트

## Evidence (수동 실행 후)

```
// A) email debug 로그 예시
[auth][signup] email debug len=22 leadingTrailing=true newline=false preview=testuser@example.com

// B) 샘플 누락 시
샘플 곡(파일 또는 URL)을 입력해 주세요.

// C) DB 확인
SELECT id, sample_song_audio_path, sample_song_url FROM musician_applications WHERE status='pending' ORDER BY created_at DESC LIMIT 1;
```
