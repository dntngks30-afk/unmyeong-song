# PR-NEXT-06: 뮤지션 회원가입 샘플 업로드 파이프라인 + 이메일 정규화

## 문제

1. `AuthApiError: Unable to validate email address: invalid format` — 이메일 형식 검증 실패
2. 뮤지션 가입 시 샘플 파일 선택해도 업로드/저장되지 않음
3. 가입 완료 시 문구/이동 통일 필요

## 변경 사항

### STEP 1 — 이메일 정규화 및 검증
- `emailNorm = email.trim().toLowerCase()` 적용
- 정규식 `EMAIL_REGEX`로 사전 검증
- `supabase.auth.signUp`에 `emailNorm`만 전달
- `mapSignupError`에 invalid format 처리 추가
- `[auth][signup] emailNorm=` 디버그 로그 (비밀번호 미로그)

### STEP 2 — 세션 확보 + 샘플 업로드 파이프라인
- signUp 후 `getSession()` 우선 사용
- 세션 없으면 `signInWithPassword`로 임시 로그인 시도
- 이메일 인증 필요 시:  
  업로드 생략,  
  `"가입이 완료되었습니다. 이메일 인증 후 로그인하여 샘플곡 업로드/승인 신청을 완료해주세요."`  
  표시 후 로그인 화면으로 이동,  
  `[signup] no session after signup; upload deferred` 로그
- 세션 확보 시:
  - 뮤지션: `profiles.role = 'artist'` 업데이트
  - `musician_applications` insert (artist_name, bio, status=pending)
  - 샘플 파일 있으면: create-upload-session → upload → set_musician_application_sample_path → submit_musician_application
  - `signOut()` 후 완료 Alert
- 완료 문구:  
  뮤지션 `"가입이 완료되었습니다. 음원심사 후 뮤지션 활동이 가능합니다."`  
  사연자 `"가입을 환영합니다. 지금 로그인해 주세요."`

### STEP 3 — Admin 가시성
- `fetchPendingMusicians`에 `sample_song_audio_path` 이미 포함
- Admin 탭 샘플 재생(get-application-sample-url + useAudioPlayer) 기존 구현 그대로 사용

### STEP 4 — 에러 처리
- 업로드/저장/제출 실패 시: `"샘플곡 업로드에 실패했어요. 다시 시도해 주세요."` + 콘솔 로그
- viewer 가입 플로우는 기존과 동일하게 유지

## 변경 파일

- `app/(auth)/signup.tsx`
- `features/musician-apply/api/mutations.ts` (기존 함수 재사용, 변경 없음)

## 검증 방법

1. **이메일 정규화**: 이전에 invalid format이 났던 이메일로 가입 시도 → 오류 없이 진행
2. **뮤지션 + 샘플**:  
   - 가입 후 Storage `artist/{uid}/application/{applicationId}/sample.mp3` 존재 확인  
   - DB `musician_applications.sample_song_audio_path` 설정 확인  
   - 가입 완료 Alert 후 로그인 화면 이동 확인
3. **이메일 인증 필요 시**:  
   - 업로드 생략 메시지 확인  
   - 로그인 화면으로 이동 확인
4. **Admin 탭**:  
   - 승인 대기 뮤지션에 샘플 재생 버튼 노출  
   - 재생 가능 여부 확인 후 승인
