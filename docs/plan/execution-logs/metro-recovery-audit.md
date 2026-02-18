# Metro Recovery Audit – 깨진 import 전수조사

## 0) 사고 격리 스냅샷

```
git rev-parse --show-toplevel: C:/projects/no-name/unmyeong-song
git branch --show-current: recover/wip-mixed
git status: src/services/, src/hooks/ untracked; M 파일 다수
```

**스냅샷 브랜치 (수동 실행):**  
*.git/index.lock* 등 lock 파일로 실패 가능. lock 제거 후:
```bash
git switch -c rescue/metro-recovery-snapshot
git add -A
git commit -m "chore: snapshot before metro recovery" || true
```

**패키지 매니저:** npm (package-lock.json 존재)
```bash
npm install   # 의존성 재확인
```

---

## 1) 깨진 import 전수조사 결과

### A) src/services/

| 모듈 | import 경로 | 사용처 | 상태 |
|------|-------------|--------|------|
| my | `../../src/services/my` | app/(tabs)/my.tsx | ✓ 존재 |
| stories | `../../../src/services/stories` | app/(tabs)/story/index.tsx, [storyId].tsx | ✓ 존재 |
| show | `../../../src/services/show` | app/(tabs)/show/index.tsx, [trackId].tsx | ✓ 존재 |
| votes | `../../../src/services/votes` | app/(tabs)/show/[trackId].tsx | ✓ 존재 |

### B) src/hooks/

| 모듈 | import 경로 | 사용처 | 상태 |
|------|-------------|--------|------|
| useAudioPlayer | `../../../src/hooks/useAudioPlayer` | app/(tabs)/show/index.tsx, [trackId].tsx | ✓ 존재 |

### C) src/components/

| 모듈 | import 경로 | 사용처 | 상태 |
|------|-------------|--------|------|
| ui/Card | `../../src/components/ui/Card` 등 | story/write, home, story/*, show/*, my | ✓ 존재 |
| ui/PrimaryButton | `../../../src/components/ui/PrimaryButton` | story/write, home, show/[trackId] | ✓ 존재 |
| ui/Screen | `../../src/components/ui/Screen` 등 | story/write, home, story/*, show/*, my | ✓ 존재 |

### D) src/lib/

| 모듈 | import 경로 | 사용처 | 상태 |
|------|-------------|--------|------|
| supabase | `../../src/lib/supabase` 등 | 다수 (layout, login, signup, story, show, my, submission, ...) | ✓ 존재 |
| errors | `../../src/lib/errors` | app/(auth)/login.tsx, signup.tsx | ✓ 존재 |
| rpc/tracks | `../../src/lib/rpc/tracks` | app/(tabs)/home.tsx | ✓ 존재 |

---

## 2) 복구 대상 리스트 (전체)

```
src/services/my
src/services/stories
src/services/show
src/services/votes
src/hooks/useAudioPlayer
src/components/ui/Card
src/components/ui/PrimaryButton
src/components/ui/Screen
src/lib/supabase
src/lib/errors
src/lib/rpc/tracks
src/lib/rpc/votes
src/lib/env
```

---

## 3) 유효성 검증 결과

| 파일 | Length>0 | export 존재 | PowerShell 흔적 없음 |
|------|----------|-------------|----------------------|
| src/services/my.ts | ✓ | ✓ | ✓ |
| src/services/stories.ts | ✓ | ✓ | ✓ |
| src/services/show.ts | ✓ | ✓ | ✓ |
| src/services/votes.ts | ✓ | ✓ | ✓ |
| src/hooks/useAudioPlayer.ts | ✓ | ✓ | ✓ |
| src/components/ui/*.tsx | ✓ | ✓ | ✓ |
| src/lib/*.ts | ✓ | ✓ | ✓ |

---

## 4) 재현 절차

1. `npx expo start -c` 실행
2. Android 또는 Web 번들 요청
3. "Unable to resolve ... src/*" 에러 발생 시 해당 경로를 위 리스트에 추가

---

## 5) 추가 에러 시 루프

에러 발생 → 리스트 추가 → Git 히스토리 확인 → 복원/래퍼 생성 → 유효성 검증 → 재번들
