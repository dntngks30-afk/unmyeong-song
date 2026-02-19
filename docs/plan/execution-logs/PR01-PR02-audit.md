# PR01/PR02 Audit Log

## 목적
- PR01(Auth Gate)과 PR02(Signup 분기)가 계약(PR00)대로 구현되었는지 검증.
- 누락/오류가 있으면 원인과 수정 내역을 남기고 빌드 검증까지 완료.

## 감사 범위
- PR01: `app/_layout.tsx`, `app/(auth)/*`, 라우팅 엔트리
- PR02: `app/(auth)/signup.tsx`, `app/(tabs)/my.tsx`, `202602170003` 마이그레이션/RLS

## 점검 결과

### PR01
- PASS: 세션 없는 상태에서 `(auth)/login` 강제.
- PASS: 세션 있음 + profile 없음 상태에서 `/(auth)/signup` 강제.
- PASS: `(auth)` 그룹 라우트(`login`, `signup`) 존재.
- PASS: `package.json` main이 `expo-router/entry`로 고정되어 라우터 엔트리 사용.
- NOTE: `App.tsx`는 남아 있으나 엔트리에서 사용되지 않음(혼선은 문서로 관리 필요).

### PR02
- PASS: `musician_applications` 스키마/RLS 추가됨.
- PASS: signup 단계에서 viewer/musician 분기 저장 구현.
- PASS: My 탭에서 pending 상태 안내 및 업로드 비활성화 구현.

## 발견 이슈와 원인/조치

1) 이슈: signup 저장 시 기존 권한(role) 덮어쓰기 위험
- 증상: `profiles` upsert 때 role을 무조건 `viewer`로 저장.
- 원인: PR02 구현에서 role 보존 로직 누락.
- 조치: DB의 현재 role을 읽어 `artist/admin`이면 유지, 그 외는 `viewer`로 저장하도록 수정.
- 파일: `app/(auth)/signup.tsx`

2) 이슈: musician 신청 샘플 입력 필수 조건 누락
- 증상: `bio`만 입력하면 신청 가능.
- 원인: 계약(`sample_song_url 또는 sample_song_audio_path`) 필수 조건을 `canSaveProfile`에 반영하지 않음.
- 조치: musician 분기에서 `bio` + (URL 또는 audio_path 중 1개) 필수로 검증.
- 파일: `app/(auth)/signup.tsx`

3) 이슈: 타입체크 실패(빌드 게이트) - Supabase Edge Deno 코드가 앱 tsconfig에 섞임
- 증상: `npx tsc --noEmit` 실행 시 `supabase/functions/*`에서 Deno 관련 타입 오류 발생.
- 원인: Expo 앱 tsconfig와 Deno Edge 함수 타입체크 컨텍스트가 분리되지 않음.
- 조치: 앱 tsconfig에서 `supabase/functions/**/*`를 제외해 앱 빌드 타입체크와 분리.
- 파일: `tsconfig.json`

## 빌드/검증 실행
- `npx tsc --noEmit` -> PASS (앱 범위 타입체크)
- `npm run start -- --non-interactive --port 8082` -> PASS (Expo 서버 기동 확인)

## 결론
- PR01/PR02 핵심 요구사항은 충족.
- 누락/오류 3건은 수정 완료.
- PR03 진행 가능한 상태로 판단.
