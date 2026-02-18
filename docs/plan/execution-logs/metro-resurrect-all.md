# Metro Resurrect All – 레거시 src/* 경로 복원

## 0) 증거 수집

### Git / OS 상태
```
git rev-parse --show-toplevel: C:/projects/no-name/unmyeong-song
git branch --show-current: recover/wip-mixed
git status --porcelain: src/services/ untracked, 기타 M 파일 다수
```

### dir src
```
src/
  components/
    ui/Card.tsx, PrimaryButton.tsx, Screen.tsx
  lib/
    env.ts, errors.ts, rpc/tracks.ts, rpc/votes.ts, supabase.ts
  services/
    my.ts, show.ts, stories.ts, votes.ts
  hooks/           ← 신규 생성
    useAudioPlayer.ts
```

### dir src\hooks (복원 전)
- **없음** → useAudioPlayer.ts가 없어 Metro "Unable to resolve ../../../src/hooks/useAudioPlayer" 에러 발생

### expo 에러 (현재 증상)
```
Unable to resolve "../../../src/hooks/useAudioPlayer" from "app/(tabs)/show/index.tsx"
```

---

## 1) 레거시 src/* import 전수조사

### git grep 결과 (app 폴더 기준)

| 경로 패턴 | 파일 | import 대상 |
|-----------|------|-------------|
| `../../../src/` | story/write.tsx | lib/supabase, components/ui/* |
| | story/index.tsx | components/ui/*, services/stories, lib/supabase |
| | story/[storyId].tsx | components/ui/*, services/stories, lib/supabase |
| | show/index.tsx | services/show, lib/supabase, **hooks/useAudioPlayer**, components/ui/* |
| | show/[trackId].tsx | components/ui/*, services/show, votes, lib/supabase, **hooks/useAudioPlayer** |
| `../../src/` | home.tsx | lib/rpc/tracks, lib/supabase, components/ui/* |
| | my.tsx | components/ui/*, services/my, lib/supabase |
| | _layout.tsx | lib/supabase |
| | auth/login.tsx, signup.tsx | lib/supabase, lib/errors |
| | submission/new.tsx | lib/supabase |
| | story/write.tsx | lib/supabase |
| | show/[id].tsx | lib/supabase |

### 모듈별 그룹화

| 카테고리 | 모듈 | 상태 |
|----------|------|------|
| **src/services/** | my, stories, show, votes | ✓ 이전 PR에서 복원 |
| **src/hooks/** | useAudioPlayer | ✓ 이번에 신규 생성 |
| **src/components/ui/** | Card, PrimaryButton, Screen | ✓ 존재 |
| **src/lib/** | supabase, errors, rpc/* | ✓ 존재 |

---

## 2) 복원 우선순위

| 우선순위 | 모듈 | 사유 |
|----------|------|------|
| **P0** | src/hooks/useAudioPlayer | show/index.tsx, [trackId].tsx에서 직접 import, 번들 에러 원인 |
| P1 | (없음) | services, components, lib는 이미 존재 |
| P2 | (없음) | |

---

## 3) Git 히스토리 되살리기

```
git log --all -- "src/hooks/useAudioPlayer.ts"  → 없음
git log --all -- "*useAudioPlayer*"              → 없음
```
- **과거 파일 없음** → 호환 훅 최소 구현으로 신규 생성

---

## 4) useAudioPlayer 호환 훅 구현

### 기대 return shape (app/(tabs)/show 사용처 기준)
- `trackId` (playingTrackId)
- `errorTrackId`
- `isLoading` (playLoading)
- `error` (playError)
- `toggle(trackId: string)`
- `isPlaying`
- `positionMs`, `durationMs`
- `formatTimeMs(ms: number)` (별도 export)

### 구현
- **expo-av** Audio.Sound 기반
- **get-track-play-url** Edge Function → features/show/api/mutations.getTrackPlayUrl
- 진행바/시간 업데이트: setOnPlaybackStatusUpdate
- didJustFinish 시 stopAndUnload

---

## 5) 파일 생성 검증

| 검증 | 결과 |
|------|------|
| Get-Item src/hooks/useAudioPlayer.ts Length | > 0 |
| Select-String "^export " | formatTimeMs, useAudioPlayer |
| node readFileSync | OK |

---

## 6) Metro 재번들

- 로컬에서 `npx expo start -c` 실행 필요 (샌드박스 EPERM 제한)
- 목표: `Unable to resolve ... src/hooks/useAudioPlayer` 제거
- 추가 src/* 에러 시 1) 목록 확장 후 동일 절차 반복

---

## 7) 원인 결론

**결론: (1) src/* 레거시 경로를 쓰던 화면이 남아있는 상태에서 폴더를 features/로 이동/삭제함 (리팩터 잔재)**

### 근거
- fe-progress.md: "src/hooks/useAudioPlayer.ts (신규)" 예정으로 기록되어 있으나 Git에 커밋된 적 없음
- app/(tabs)/show는 `../../../src/hooks/useAudioPlayer`를 import하지만, src/hooks 디렉터리 자체가 존재하지 않았음
- services(이전 PR), components, lib는 유지되어 있으나 hooks만 누락 → 체계적 리팩터(예: features로 이동) 과정에서 일부만 이동·삭제되고 app import는 그대로 남은 패턴

### 재발 방지 체크리스트
- [ ] **PR마다:** `git grep -n 'from "\.\./.*src/' app` 실행 → 누락 모듈 조기 발견
- [ ] **src 경로 정책:** app/(tabs)는 src/* 유지. 신규 기능은 features/*에 두고, src에는 레거시 호환 래퍼만 추가
- [ ] **파일 생성 시:** IDE로 직접 생성·저장. PowerShell here-string/Set-Content 사용 금지 (0 bytes·스크립트 저장 위험)

---

## 8) 커밋 규칙

```
1) fix: restore legacy src/hooks and other missing modules for metro
   - src/hooks/useAudioPlayer.ts 신규

2) docs: metro resurrect all rootcause
   - docs/plan/execution-logs/metro-resurrect-all.md
```
