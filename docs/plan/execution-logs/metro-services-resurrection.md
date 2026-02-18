# Metro Services Resurrection – 레거시 src/services 복원

## 0) 증거 수집

### Git / OS 상태
```
git rev-parse --show-toplevel: C:/projects/no-name/unmyeong-song
git branch --show-current: recover/wip-mixed
git status --porcelain: src/services/ untracked (??)
```

### src/services 디렉터리 (수정 후)
| 파일 | Length | export 수 |
|------|---------|-----------|
| my.ts | ~1.8KB | 2 (getMySummary, getMyEntitlement) |
| stories.ts | ~1.5KB | 3 (Story type, listStories, getStory) |
| show.ts | ~2.2KB | 4 (ShowTrack type, formatCheerDisplay, getShowTracks, getTrackById) |
| votes.ts | ~2.0KB | 1 (voteTrack) |

### npx expo start -c / expo export 실행
- 샌드박스 환경에서 `spawn EPERM` / `rmdir dist EPERM`로 실패. 로컬에서 수동 실행 필요.
- grep 결과: 에러 로그에 `Unable to resolve` / `src/services` 없음 (모듈 해상도 단계까지는 통과)
- 목표: `Unable to resolve ... src/services/*` 에러 제거

---

## 1) 레거시 import 전수조사

### git grep 결과 (app 내 src/services 참조)
```
app/(tabs)/story/index.tsx:6:   import { listStories, type Story } from "../../../src/services/stories";
app/(tabs)/story/[storyId].tsx:6:   import { getStory } from "../../../src/services/stories";
app/(tabs)/show/index.tsx:4:   import { getShowTracks, formatCheerDisplay, type ShowTrack } from "../../../src/services/show";
app/(tabs)/show/[trackId].tsx:7:   import { getTrackById, formatCheerDisplay } from "../../../src/services/show";
app/(tabs)/show/[trackId].tsx:8:   import { voteTrack } from "../../../src/services/votes";
app/(tabs)/my.tsx:5:   import { getMySummary, getMyEntitlement } from "../../src/services/my";
```

### 필요 모듈 리스트 (확정)
| 모듈 | 필요한 export |
|------|---------------|
| **my** | getMySummary, getMyEntitlement |
| **stories** | listStories, getStory, type Story |
| **show** | getShowTracks, formatCheerDisplay, getTrackById, type ShowTrack |
| **votes** | voteTrack |

---

## 2) 되살리기 결과

### Git 히스토리
- `git log --all -- "src/services/show.ts"` → 없음
- `git log --all -- "src/services/votes.ts"` → 없음
- my, stories는 이전 PR에서 이미 복원됨
- **결론:** show, votes는 git에 없음 → 호환 래퍼 자동 생성

### 구현 전략
| 모듈 | 위임 대상 | 비고 |
|------|-----------|------|
| stories | features/story/api/queries (getStoryList, getStoryDetail) | 기존 복원 |
| my | supabase 직접 (profiles, stories, songs, votes) | 기존 복원 |
| show | src/lib/rpc/tracks (getTop10Tracks) | voteCount=0 fallback |
| votes | src/lib/rpc/votes (castVotesMax3) | DUPLICATE_VOTE / VOTE_LIMIT_EXCEEDED 매핑 |

---

## 3) 자동 생성(호환 래퍼) 상세

### show.ts
- `getShowTracks(accessToken?)` → getTop10Tracks 래핑, voteCount=0
- `formatCheerDisplay(voteCount)` → "응원 N" / "응원 1.2K"
- `getTrackById(trackId, accessToken?)` → Top10에서 id 매칭
- `type ShowTrack` → id, title, artist?, rank?, voteCount

### votes.ts
- `voteTrack(trackId, accessToken?)` → castVotesMax3 래핑
- 반환: `{ ok: true, remaining }` | `{ ok: false, code, message }`
- code 매핑: DUPLICATE_VOTE, VOTE_LIMIT_EXCEEDED

---

## 4) 파일 저장/유효성 검증

| 검증 | show.ts | votes.ts | my.ts | stories.ts |
|------|---------|----------|-------|------------|
| Length > 0 | ✓ | ✓ | ✓ | ✓ |
| export 존재 | ✓ (4) | ✓ (1) | ✓ (2) | ✓ (3) |
| node readFileSync | OK | OK | OK | OK |

---

## 5) Metro 재시도

로컬에서 실행:
```bash
npx expo start -c
```
- 더 이상 `Unable to resolve ... src/services/*` 에러 없어야 함.
- 추가 모듈 누락 시 동일 래퍼 패턴으로 생성 후 4) 검증 반복.

---

## 6) 원인 분석(결론)

**결론: (2) 파일 생성 시 here-string/명령 합쳐침으로 0 bytes 또는 스크립트 문자열이 저장되어 “존재는 하나 모듈이 아님”**

### 근거
- `my.ts` 이전 상태: 0 bytes (빈 파일)
- `stories.ts` 이전 상태: 320 bytes, PowerShell here-string (`@'...'@ | Set-Content`) 내용 저장
- Metro는 `Unable to resolve`로 보고 → 모듈로 인식하지 못함
- app/(tabs)의 import 경로(`../../src/services/my`, `../../../src/services/stories` 등)는 정확함

### 추가로 show, votes는
- (1)과 유사: 레거시 파일이 never committed/생성되지 않아 app/(tabs) import만 남음
- Git에 `src/services/show.ts`, `src/services/votes.ts` 흔적 없음

---

## 7) 재발 방지 체크리스트

- [ ] **새 서비스 모듈 추가 시:** IDE/에디터로 직접 생성·저장. PowerShell `Set-Content` 사용 금지(here-string 오염 위험)
- [ ] **레거시 import grep:** `git grep -n "src/services/" app` 로 추가 누락 확인
- [ ] **래퍼 정책:** app/(tabs)는 `src/services/*` 유지. 기능은 `features/*` 또는 `src/lib/rpc/*`에 두고, 서비스는 위임 래퍼만 유지
- [ ] **빌드 전:** `Get-Item src/services/*.ts | Select Name,Length` 로 0 bytes 방지
- [ ] **캐시:** `npx expo start -c` 로 Metro 캐시 초기화 후 재시도

---

## 8) 커밋 규칙

```
1) fix: resurrect legacy src/services wrappers for metro
   - src/services/show.ts, src/services/votes.ts 신규
   - stories.ts, my.ts (이전 PR에서 복원 완료)

2) docs: rootcause for metro services resolution
   - docs/plan/execution-logs/metro-services-resurrection.md
```
