# Metro Resolve Root Cause – `src/services` 모듈 해결 실패

## 1) 재현 로그

### 증상 (원본 에러)
- Android / Web Bundling failed
- `Unable to resolve "../../src/services/my"` from `app/(tabs)/my.tsx`
- `Unable to resolve "../../../src/services/stories"` from `app/(tabs)/story/[storyId].tsx`
- Metro 후보 확장자(.android.ts, .native.ts, .ts, .tsx, .js 등) 전부 없다고 보고

### 1) 증거 수집 결과 (2026-02-18)

#### OS 레벨 확인
```
Path: C:\projects\no-name\unmyeong-song
src\services\ 존재함
  - my.ts (Length: 0)  ← 빈 파일
  - stories.ts (Length: 320) ← PowerShell 스크립트 내용
```

#### Node existsSync
```
node -p "require('fs').existsSync('src/services/my.ts')"  → true
node -p "require('fs').existsSync('src/services/stories.ts')"  → true
```

#### import 사용처
- `app/(tabs)/my.tsx` → `../../src/services/my`
- `app/(tabs)/story/index.tsx` → `../../../src/services/stories`
- `app/(tabs)/story/[storyId].tsx` → `../../../src/services/stories`

---

## 2) 원인 결론

**결론: (1) services 폴더/파일이 실제로 생성되지 않았거나, 생성 시 내용이 잘못 저장됨**

구체적으로:

| 파일 | 상태 | 원인 |
|------|------|------|
| `src/services/my.ts` | 0 bytes | 파일이 비어 있음 (유효한 TS 모듈이 아님) |
| `src/services/stories.ts` | 320 bytes | PowerShell here-string 스크립트가 저장됨 (`@'...'@ \| Set-Content`) |

**추정 시나리오:** 이전에 PowerShell로 `Set-Content`를 실행할 때, 스크립트 자체가 파일 내용으로 들어가거나, 실행 결과가 잘못 저장된 것으로 보임. Metro는 해당 경로의 파일을 찾지만, 내용이 유효한 TypeScript가 아니라서 모듈로 인식하지 못하거나 parse 단계에서 실패함.

---

## 3) 수정 사항 (최소 변경)

### 변경 파일
1. **`src/services/stories.ts`** – PowerShell 스크립트 제거 후 유효한 TypeScript로 교체  
   - `listStories`, `getStory` 구현 (`features/story/api/queries` 래핑)
2. **`src/services/my.ts`** – 빈 파일 대신 유효한 TypeScript로 작성  
   - `getMySummary`, `getMyEntitlement` 구현 (Supabase 연동)

### import 경로
- 수정하지 않음. `../../src/services/my`, `../../../src/services/stories` 경로는 정확함.

---

## 4) 재발 방지 체크리스트

- [ ] **새 services 모듈 추가 시:**  
  - IDE나 에디터에서 직접 생성/저장  
  - PowerShell `Set-Content` 사용 시, here-string(`@'...'@`)이 파일 내용으로 들어가지 않도록 주의
- [ ] **빌드 전 점검:**  
  - `node -p "require('fs').existsSync('src/services/my.ts')"`  
  - `node -p "require('fs').existsSync('src/services/stories.ts')"`  
  - 두 파일 모두 `true` 이고, 내용이 유효한 TS인지 확인
- [ ] **서비스 레이어 통일:**  
  - `src/services/*` 추가 시 `features/*`와 겹치지 않도록 역할 구분  
  - 필요 시 `grep -r "src/services"`로 import 경로 일관성 검증
- [ ] **캐시 초기화:**  
  - 번들링 문제 재현 시 `npx expo start -c`로 Metro 캐시 클리어 후 재시도

---

## 5) 커밋 규칙

```text
1) fix: restore services module paths for metro
   - src/services/stories.ts, src/services/my.ts 유효 TS로 교체

2) docs: metro resolve rootcause
   - docs/plan/execution-logs/metro-resolve-rootcause.md 추가
```

---

## 6) 검증 (수정 후)

- [x] `existsSync('src/services/my.ts')` → true
- [x] `existsSync('src/services/stories.ts')` → true
- [ ] `npx expo start -c` 후 Android/Web 번들링 성공  
  - *주의: 샌드박스/EPERM 환경에서는 transformer spawn이 실패할 수 있음. 로컬 터미널에서 직접 실행해 확인*
