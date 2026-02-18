# Metro Recovery Root Cause – 원인 결론 및 재발 방지

## 1) 재현 절차

1. `npx expo start -c` 실행 (Metro 캐시 클리어)
2. Android 또는 Web 번들 요청
3. "Unable to resolve ../../../src/*" 또는 유사 에러 발생

---

## 2) 깨진 import 전체 리스트

| 카테고리 | 모듈 | 상태 |
|----------|------|------|
| **src/services/** | my, stories, show, votes | ✓ 복원됨 |
| **src/hooks/** | useAudioPlayer | ✓ 복원됨 |
| **src/components/ui/** | Card, PrimaryButton, Screen | ✓ 존재 |
| **src/lib/** | supabase, errors, rpc/tracks, rpc/votes, env | ✓ 존재 |

---

## 3) 복원/생성한 파일 리스트

| 파일 | 유형 | 비고 |
|------|------|------|
| src/services/my.ts | 호환 래퍼 | getMySummary, getMyEntitlement |
| src/services/stories.ts | 호환 래퍼 | features/story 래핑 |
| src/services/show.ts | 호환 래퍼 | getTop10Tracks 래핑 |
| src/services/votes.ts | 호환 래퍼 | castVotesMax3 래핑 |
| src/hooks/useAudioPlayer.ts | 호환 훅 | expo-av + getTrackPlayUrl |

*(components/ui, lib/* 은 기존에 존재)*

---

## 4) 원인 결론

**결론: (1) app이 레거시 src/* 경로를 계속 import하는데, 리팩터 과정에서 파일이 삭제/이동됨 (리팩터 잔재)**

### 근거

| 증거 | 내용 |
|------|------|
| fe-progress.md | "src/hooks/useAudioPlayer.ts (신규)" 예정이나 Git에 없음 |
| Git log | `git log --all -- "src/hooks/useAudioPlayer.ts"` → 없음 |
| Git log | `git log --all -- "src/services/show.ts"` → 없음 |
| app import | app/(tabs)/show 등이 `../../../src/hooks/useAudioPlayer` 등 상대경로로 직접 참조 |
| 디렉터리 | src/hooks, src/services 일부가 과거에 생성·삭제 또는 never committed |

**추가: (2) 파일 생성 커맨드 실수**  
- my.ts 0 bytes, stories.ts PowerShell 스크립트 저장 사례가 이전에 있었음 (metro-resolve-rootcause.md 참고)

---

## 5) 재발 방지 규칙

### A) app에서 상대경로로 src 직접 참조 금지 → alias(@/)로 통일

- **권장:** tsconfig paths에 `"@/*": ["src/*"]` 설정 후, app import를 `@/services/my` 등으로 교체
- **현재:** 일단 레거시 유지. 단, **신규 파일은 src/*에 추가하지 말고 features/* 또는 별도 레이어에 두기**

### B) PR 체크: git grep로 src/ 레거시 import 검사

```bash
git grep -n 'from "\.\./.*src/' app
```
- 결과가 있으면: 해당 모듈이 src/*에 실제 존재하는지 확인
- 누락 시: 복원 또는 호환 래퍼 생성

### C) 파일 생성 정책

- **PowerShell here-string / Set-Content 사용 금지** (0 bytes·스크립트 저장 위험)
- **파일 생성·수정은 반드시 IDE/에디터에서 직접 저장**

### D) 유효성 검증 (생성 직후)

- `Get-Item <file> | select Name,Length` → Length > 0
- `Select-String <file> -Pattern "^export "` → export 1개 이상
- 파일 상단 40줄에 `@'` / `Set-Content` / PowerShell 흔적 없어야 함

---

## 6) 스냅샷 브랜치 (수동 실행)

`.git/index.lock` 또는 ref lock으로 실패할 수 있음. 수동 실행:

```bash
# lock 제거 (필요 시)
rm -f .git/index.lock
rm -f .git/refs/heads/rescue/metro-recovery-snapshot.lock

git switch -c rescue/metro-recovery-snapshot
git add -A
git commit -m "chore: snapshot before metro recovery" || true
```

---

## 7) 커밋 정책

```
1) fix: restore missing legacy src modules for metro
   - src/services/*, src/hooks/useAudioPlayer.ts

2) docs: metro recovery audit and rootcause
   - docs/plan/execution-logs/metro-recovery-audit.md
   - docs/plan/execution-logs/metro-recovery-rootcause.md
```
