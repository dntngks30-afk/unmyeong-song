# HOTFIX Router/Auth Stability

## 원인(1줄)
- 앱 시작 시 로그인 대신 다른 화면으로 보이던 원인은 루트에서 `router.replace` 기반 초기 이동과 가드 분산으로 라우팅 타이밍이 엇갈렸기 때문이다.

## 수정 요약
- `app/_layout.tsx`
  - RootLayout을 항상 Navigator를 렌더하는 최소 형태로 고정: `return <Stack screenOptions={{ headerShown:false }} />`
  - 조건부 `null` 반환 없음
- `app/index.tsx`
  - `useEffect + router.replace` 패턴 제거
  - `<Redirect href="/login" />` 단일 패턴으로 고정
- `app/(tabs)/_layout.tsx`
  - 단일 Auth Gate 위치로 고정
  - 세션 체크 완료 전에는 로딩 인디케이터 렌더
  - 세션 없음: `<Redirect href="/login" />`
  - 세션 있음: 탭 렌더
- `app/(auth)/signup.tsx`
  - 가입 성공 메시지를 요구 문구로 고정: "가입을 환영합니다. 지금 로그인해 주세요."

## grep 검증
- `router.replace(...(tabs)... )` : 0건
- `router.push(...(tabs)... )` : 0건
- `replace(...signup...)` 자동 리다이렉트 : 0건

## 시나리오 검증(코드 기준 + 실행)
- A) 앱 실행 -> `/` -> `/login` 고정: PASS (`app/index.tsx`)
- B) 로그인 화면에서 회원가입 버튼 -> `/signup`: PASS (`app/(auth)/login.tsx`)
- C) signup 성공 -> 환영 메시지 -> `/login` 복귀: PASS (`app/(auth)/signup.tsx`)
- D) login 성공 -> `/home` 진입: PASS (`app/(auth)/login.tsx`)
- E) 탭 직접 접근(session 없음) -> `/login` 차단: PASS (`app/(tabs)/_layout.tsx`)

## 실행 커맨드
- `npx tsc --noEmit`
- `npx expo start -c` (환경 포트 점유 이슈 시 `--port` 사용)
