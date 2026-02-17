# HOTFIX - Supabase Confirm Email OFF

## 목적
- 회원가입 시 `Email not confirmed`로 홈 진입이 막히는 경로를 제거한다.
- Confirm Email OFF 환경에서 가입 직후 session 생성 및 홈 진입을 보장한다.

## 1) Supabase 설정 변경

- 대상 경로:
  - `Supabase Dashboard > Authentication > Providers(Email) > Confirm email`
- 실행 상태:
  - 자동 변경: **blocked** (대시보드 인증 UI 자동 제어 도구 미사용 가능 환경)
  - 수동 확인 필요
- 대체 근거:
  - 로컬 `supabase/config.toml`에서 `auth.email.enable_confirmations = false` 확인
  - 파일 위치: `supabase/config.toml`

### 스크린샷 기록 위치(수동)
- `docs/plan/execution-logs/_evidence/hotfix-auth-confirm-email-off-dashboard.png`

## 2) 앱 코드 보완(최소 수정)

- 파일: `app/(auth)/signup.tsx`
- 변경점:
  1. `signUp` 응답 `data.session`이 없을 때 `signIn` 재시도하지 않음
  2. 사용자 안내:
     - `"가입은 완료됐지만 세션 생성이 지연되었습니다. 로그인으로 이동합니다."`
  3. 즉시 로그인 화면으로 이동:
     - `router.replace("/(auth)/login")`
  4. 에러는 원인 코드(`INVALID_CREDENTIALS`, `EMAIL_NOT_CONFIRMED`, `NETWORK`, `SESSION_MISSING`) 기반 분기 유지

## 3) 검증 결과(코드/정적)

- `npx tsc --noEmit`: PASS
- lints(변경 파일): PASS

## 4) 수동 검증 체크리스트

1. 새 이메일로 회원가입
2. Confirm Email OFF 상태에서 즉시 가입 완료 + 자동 홈 진입(`/(tabs)`) 확인
3. 앱 재시작 후 세션 유지 확인
4. session null fallback 발생 시 로그인 화면 이동 + 안내 문구 확인

## 5) 비고
- Dashboard 토글 변경 자체는 계정 인증이 필요한 운영 작업이므로, 실제 적용 여부는 수동 캡처 증거와 함께 확정한다.
