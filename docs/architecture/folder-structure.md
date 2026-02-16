# Folder Structure Guide

## 목표
- MVP 최소 구현을 유지하면서, FE/BE/DB 책임 경계를 분명히 나눈다.
- 순환 참조를 방지하고 변경 영향 범위를 예측 가능하게 만든다.

## 목표 폴더 트리
```text
unmyeong-song/
  app/
    _layout.tsx
    (tabs)/
      _layout.tsx
      home.tsx
      story.tsx
      show.tsx
      my.tsx
    story/
      [id].tsx
      write.tsx
    submission/
      new.tsx
  features/
    story/
      api/
      model/
      ui/
    submission/
      api/
      model/
      ui/
    show/
      api/
      model/
      ui/
    report/
      api/
      model/
      ui/
    entitlement/
      api/
      model/
  lib/
    api/
      client.ts
      errors.ts
      mappers.ts
    auth/
      session.ts
    validation/
      schema.ts
  supabase/
    migrations/
    seed/
    policies/
    functions/
      create-upload-session/
      get-track-play-url/
      entitlement-status/
  docs/
    contracts/
    architecture/
    plan/
```

## 폴더 존재 이유
- `app/`: 라우팅과 화면 진입점. 화면 조합만 담당.
- `app/(tabs)`: 탭 네비게이션 엔트리.
- `features/*`: 기능 단위 모듈. UI/모델/API 연결의 실질 구현.
- `lib/api`: 공통 API 클라이언트, 에러 표준화, 응답 매핑.
- `lib/auth`: 세션/사용자 기본 컨텍스트.
- `lib/validation`: 입력 검증 스키마(클라이언트 UX용 사전검증).
- `supabase/migrations|policies`: DB 스키마와 RLS 정책의 실제 소스.
- `supabase/functions`: 외부 검증/민감 로직용 Edge Functions.
- `docs/contracts`: 권위 계약 문서(SSOT).
- `docs/architecture`: 구조/패턴 가이드.
- `docs/plan`: 실행 티켓과 리스크 관리.

## Ownership 경계 재확인
- `app/(tabs)` = FE만 수정
- `features/*` = FE만 수정
- `lib/api` = FE만 수정
- `supabase/*` = DB/RLS만 수정
- `supabase/functions/*` = BE만 수정
- `docs/contracts/*` = 전 팀 공통 권위 문서

## Import 경계 규칙
- 허용 방향:
  - `app` -> `features` -> `lib`
  - `supabase/functions` -> `supabase` 공통 유틸(필요 시)
- 금지 방향:
  - `lib` -> `features` (역방향 금지)
  - `features/a` -> `features/b` 직접 참조 금지 (공통은 `lib`로 승격)
  - `app` -> `supabase/*` 직접 접근 금지 (`lib/api` 또는 feature api를 경유)
- 순환 참조 방지:
  - 배럴 파일(`index.ts`)은 기능 내부 노출용으로만 사용
  - 도메인 타입은 `features/*/model` 또는 `lib/api/mappers`에서 단방향 관리

## 네이밍/배치 규칙
- 화면 파일은 라우트 의미가 드러나는 이름 사용(`write.tsx`, `[id].tsx`).
- 서버 호출은 `features/*/api` 또는 `lib/api`에만 둔다.
- 임시 실험 코드는 feature 내부 `experimental` 폴더로 격리하고 티켓 완료 시 제거한다.
