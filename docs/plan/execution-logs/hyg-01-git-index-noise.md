# HYG-01 Git Index Noise 정리 로그

## 목표
- 파일 내용 변경 없이 `git status` 노이즈(`needs update`, 대량 `M`)를 정리한다.
- 완료 기준: `git status --porcelain` 빈 출력 + `git diff` 없음.

## 1) 현상 캡처 (Before)
실행 커맨드:
```bash
git status
git status --porcelain
git diff --name-only
git diff --stat
git diff --ignore-space-at-eol --name-only
git ls-files -v | findstr "^[S|H]"
```

관측:
- 다수 파일이 `modified`/`M`로 표시됨.
- 동시에 `git diff --quiet` / `git diff --ignore-space-at-eol --quiet` 는 모두 exit code `0` (실질 내용 diff 없음).
- 경고 반복:
  - `CRLF will be replaced by LF the next time Git touches it`

## 2) 인덱스 refresh
실행 커맨드:
```bash
git update-index --refresh
git status --porcelain
```

관측:
- `needs update` 메시지 및 `M` 노이즈가 계속 재발.

## 3) line ending / config 점검
실행 커맨드:
```bash
git config --show-origin --get core.autocrlf
git config --show-origin --get core.eol
git config --show-origin --get core.filemode
git ls-files .gitattributes
```

관측:
- `core.autocrlf=true` (system)
- `core.filemode=false` (repo local)
- `.gitattributes` 존재, `*.md/*.sql/*.ts/*.tsx/*.json`에 `eol=lf` 강제

가설:
1. Windows worktree + `autocrlf=true` + `.gitattributes eol=lf` 조합에서
2. 인덱스 stat/timestamp와 line ending 경고가 겹치며
3. 실질 변경 없이 `M`/`needs update` 노이즈가 발생

## 4) 비파괴 정리 조치
사전 안전 확인:
```bash
git diff --quiet
git diff --ignore-space-at-eol --quiet
```
- 두 명령 모두 exit code `0` -> 내용 변경 없음 확인.

실행 조치:
```bash
git checkout -- <git status --porcelain 로 수집한 M 파일 목록>
git update-index --refresh
```

## 5) 결과 (After)
검증 커맨드:
```bash
git status --porcelain
git diff --name-only
git diff --stat
```

결과:
- `git status --porcelain` 빈 출력
- `git diff --name-only` 빈 출력
- `git diff --stat` 빈 출력

## “내용 변경 없음” 근거
- `git diff --quiet` = 0
- `git diff --ignore-space-at-eol --quiet` = 0
- 정리 후 `status/diff` 모두 빈 출력
- 즉, 의미 있는 텍스트 변경 없이 인덱스/라인엔딩 노이즈만 제거됨

## 재발 방지 체크 (권장)
- 작업 전후로 아래 점검:
  - `git status --porcelain`
  - `git diff --quiet`
  - `git update-index --refresh`
- line ending 정책은 `.gitattributes`를 SSOT로 유지
- 필요 시 로컬 환경에서 `autocrlf` 동작과 `.gitattributes` 적용 상태를 주기 점검
  - (본 티켓에서는 git config 변경하지 않음)
