# HOTFIX auth flow 실행 로그

## 원인 확정
- 앱 실행 시 로그인 대신 다른 화면이 뜬 직접 원인: `app/index.tsx`가 루트(`/`)에서 Top10 투표 UI를 직접 렌더해 엔트리 화면을 점유하고 있었다.

## 수정 요약
- `app/index.tsx`: 루트 화면을 Top10 UI에서 로그인 리다이렉트 전용 엔트리로 변경 (`/login`으로만 이동).
- `app/_layout.tsx`: 세션 기반 자동 리다이렉트 로직 제거, 스택 라우트 선언만 유지.
- `app/(auth)/login.tsx`:
  - 로그인 성공 시 `router.replace("/home")`
  - 회원가입 진입은 `Link href="/signup"` 버튼으로만 허용
  - 오류 메시지 문구를 요구사항대로 고정
- `app/(auth)/signup.tsx`:
  - 세션 기반 자동 이동 제거(자동로그인/자동탭 진입 금지)
  - 가입 성공 시 환영 알럿 후 `router.replace({ pathname: "/login", params: { email } })`
- `app/(tabs)/home.tsx`: 그룹 경로 이동(`/ (tabs)/...`)을 퍼블릭 경로(`/story`, `/show`)로 교체

## 자동 검수 결과

| 항목 | 기대 | 실제(코드 위치) | 통과여부 |
|---|---|---|---|
| 1) 첫화면 로그인 고정 | 앱 시작 시 루트는 로그인으로만 이동 | `app/index.tsx`의 `router.replace("/login")` 단일 진입 | PASS |
| 2) 회원가입은 로그인 버튼으로만 진입 | 자동 signup 이동 없음, 로그인 화면 버튼 진입만 | `app/(auth)/login.tsx`의 `Link href="/signup"`만 존재, `replace(...signup)` 없음 | PASS |
| 3) 회원가입 성공 -> 환영 메시지 -> 로그인 복귀 | 성공 시 자동로그인 없이 로그인 복귀 | `app/(auth)/signup.tsx`의 `Alert("가입을 환영합니다")` 후 `/login` replace | PASS |
| 4) 로그인 성공 -> 메인탭 진입 | 로그인 성공 시 메인 홈 탭으로 이동 | `app/(auth)/login.tsx`의 `router.replace("/home")` | PASS |
| 5) '/(tabs)' 같은 그룹 경로 네비 금지 | `router.replace('/(tabs)')`, `router.push('/(tabs)')` 0건 | 전수 검색 결과 0건, 퍼블릭 경로(`/home`, `/story`, `/show`)로 사용 | PASS |
| 6) '/' 라우트 충돌 없음 | `app/(tabs)/index.tsx` 없음, 루트 엔트리 단일화 | `app/(tabs)/index.tsx` 미존재 확인, 루트는 `app/index.tsx` 단일 처리 | PASS |

## 검증 커맨드
- `git status --porcelain`
- `rg "router\\.replace\\(\"/\\(tabs\\)\"\\)|router\\.replace\\('/\\(tabs\\)'\\)" .`
- `rg "router\\.push\\(\"/\\(tabs\\)\"\\)|router\\.push\\('/\\(tabs\\)'\\)" .`
- `rg "replace\\([^\\n]*signup" app`
- `npx tsc --noEmit`
