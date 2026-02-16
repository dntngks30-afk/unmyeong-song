# Repo Triage Report (20260216)

## 1) 변경 파일 목록 수집

### `git status --porcelain`
```text
 M AGENTS.md
 M docs/architecture/folder-structure.md
 M docs/architecture/state-management.md
 M docs/contracts/api.md
 M docs/contracts/schema.md
 M docs/contracts/ux-flows.md
 M docs/plan/execution-logs/ticket-01-db.md
 M docs/plan/mvp-tickets.md
 M supabase/migrations/202602160001_init_schema.sql
 M supabase/policies/01_base_rls.sql
```

### `git diff --name-only`
```text
(none)
```

해석:
- `status`에는 수정(M)으로 보이지만, 실제 diff 파일 목록은 비어 있음.
- 이 조합은 대체로 **인덱스/파일시스템 상태 불일치(racy stat)** 또는 **라인엔딩/정규화 후 인덱스 갱신 필요 상태**에서 발생한다.

## 2) 변경 유형 분류 (근거 포함)

비교 방법:
- 각 파일에 대해 `HEAD:<file>` blob 바이트 vs 워킹트리 파일 바이트를 직접 비교.
- 결과: 아래 10개 파일 모두 `byte-identical`.

| File | 분류 | 근거 | 영향 | 권장 조치 |
|---|---|---|---|---|
| `AGENTS.md` | `no_effect` | HEAD blob과 워킹트리 바이트 동일 | 낮음 | 인덱스 refresh |
| `docs/architecture/folder-structure.md` | `no_effect` | HEAD blob과 워킹트리 바이트 동일 | 낮음 | 인덱스 refresh |
| `docs/architecture/state-management.md` | `no_effect` | HEAD blob과 워킹트리 바이트 동일 | 낮음 | 인덱스 refresh |
| `docs/contracts/api.md` | `no_effect` | HEAD blob과 워킹트리 바이트 동일 | 낮음 | 인덱스 refresh |
| `docs/contracts/schema.md` | `no_effect` | HEAD blob과 워킹트리 바이트 동일 | 낮음 | 인덱스 refresh |
| `docs/contracts/ux-flows.md` | `no_effect` | HEAD blob과 워킹트리 바이트 동일 | 낮음 | 인덱스 refresh |
| `docs/plan/execution-logs/ticket-01-db.md` | `no_effect` | HEAD blob과 워킹트리 바이트 동일 | 낮음 | 인덱스 refresh |
| `docs/plan/mvp-tickets.md` | `no_effect` | HEAD blob과 워킹트리 바이트 동일 | 낮음 | 인덱스 refresh |
| `supabase/migrations/202602160001_init_schema.sql` | `no_effect` | HEAD blob과 워킹트리 바이트 동일 | 낮음 | 인덱스 refresh |
| `supabase/policies/01_base_rls.sql` | `no_effect` | HEAD blob과 워킹트리 바이트 동일 | 낮음 | 인덱스 refresh |

판단:
- 현재 M 표시는 **실질 코드/문서 변경이 아닌 상태 노이즈**로 분류.
- 자동 포맷/머지 잔재/로직 변경 근거는 발견되지 않음.

## 3) 되돌릴 것 vs 남길 것

### 되돌리기 후보
- 없음 (내용 변경 근거 없음)

### 남길 것
- 없음 (별도 기능 변경 없음)

권고:
- 파일 되돌리기(`git restore -- <files>`)보다 먼저 인덱스 상태 정리 수행.

## 4) 안전 정리 명령 후보 (커밋 금지)

```bash
# 1) 인덱스 상태 갱신 (비파괴)
git update-index --refresh

# 2) 재확인
git status --porcelain
git diff --name-only
```

보조 후보(1번 후에도 잔존 시):
```bash
# 파일 내용이 실제로 같다면 status 노이즈를 제거하기 위한 재스캔
git add -A
git reset --mixed
git status --porcelain
```

주의:
- `git checkout -- <files>` / `git restore --source=...`는 현재 케이스에서 불필요.
- 본 리포트 기준으로는 내용 손상 리스크 없이 인덱스 정리만 권장.

## 5) 분리 커밋 전략 (제안 티켓 2~4개)

1. `HYG-01` 인덱스 상태 노이즈 정리
   - 범위: 인덱스 refresh/재스캔 절차 표준화
2. `HYG-02` 라인엔딩/속성 검증 자동화
   - 범위: `.gitattributes` + CI pre-check(`git diff --name-only` non-empty guard)
3. `HYG-03` 작업 시작 전 워킹트리 헬스체크 추가
   - 범위: `status --porcelain`와 `diff --name-only` 불일치 감지 규칙
