# Smoke Checklist (MVP)

## 0. 실행 환경
- 프로젝트 ref: `kwzguusrbciklojvimsh`
- 앱 실행: `npx expo start --port 8082`
- 필수: 테스트 계정 role (`artist`/`admin`/`viewer`)와 준비 데이터(Top10 트랙, song/audio_path 존재)

## 1. 홈/탭 라우팅
- [ ] 앱 실행 -> `(tabs)` 진입
- [ ] `home`/`story`/`show`/`my` 탭 전환
- 기대: 크래시 없음, 상태 스켈레톤 정상

## 2. Show: Top10 조회/재생/투표 (Ticket 09)
### 2.1 Top10 로딩
- [ ] Show 진입 -> 불러오는 중... -> 리스트
- [ ] 빈 상태: 현재 투표 가능한 트랙이 없어요
- [ ] 실패: 잠시 후 다시 시도해 주세요

### 2.2 재생(expo-av)
- [ ] 트랙 A 재생 -> 로딩... -> 정지(실제 소리)
- [ ] 정지 클릭 -> 재생 중단
- [ ] 트랙 A 재생 중 트랙 B 재생 -> A 중단 + B 재생(겹침 없음)
- [ ] 실패 시: 재생에 실패했어요. 다시 시도해 주세요.
- 관측: `correlationId`(콘솔) (`signedUrl` UI/로그 노출 금지)

### 2.3 투표(1인 3표, 멱등)
- [ ] 1표 성공 -> 투표됨 + `userVoteCount` 갱신
- [ ] 동일 트랙 재투표 -> `DUPLICATE_VOTE` 문구
- [ ] 4번째 투표 -> `VOTE_LIMIT_EXCEEDED` 문구
- [ ] 비로그인/세션없음 -> `AUTH_REQUIRED` 문구
- 회귀: 요청 중 버튼 잠금, 중복 클릭으로 표 증가 없음

## 3. Story: 작성/목록/상세 + 차단/레이트리밋 (Ticket 07/07.1/07.2)
- [ ] 정상 작성 성공 -> 목록 반영 -> 상세 이동
- [ ] 1분 내 4회 작성 시도 -> `RATE_LIMITED` 문구(임시 기준: 1분 3회)
- [ ] 전화/이메일/계좌/주소 포함 -> `CONTENT_BLOCKED` 문구
- [ ] 같은 `clientRequestId` 재시도 -> 멱등 성공(중복 생성 없음)

## 4. Submission: 업로드 세션/업로드/제출 완료 (Ticket 08/08.1)
### 4.1 진입
- [ ] My 탭 -> 노래 제출하기 -> `submission/new` 이동

### 4.2 클라이언트 검증
- [ ] 오디오 누락 -> 제출 차단
- [ ] 메이킹노트 누락 -> 제출 차단

### 4.3 업로드 세션 + 업로드
- [ ] `create-upload-session` 성공 -> signed upload URL 발급(300s)
- [ ] PUT 업로드 성공(오디오 필수, 커버 선택)
- [ ] 실패 시 재시도 가능

### 4.4 제출 완료 RPC
- [ ] `complete_song_submission` 성공 -> `songs.status=submitted` 전이
- [ ] 잘못된 `audio_path` -> `STORAGE_PATH_INVALID`
- [ ] 타인 song 제출 -> `FORBIDDEN`(또는 SSOT 코드) 거부
- 보안: `signedUrl` UI/로그 노출 금지, `correlationId`만 기록

## 5. Reports: 신고 + moderation_queue 전이 (Ticket 03)
- [ ] `create_report_and_queue` 성공 -> queue 생성
- [ ] 누적 3점 -> `in_review/medium`
- [ ] 누적 5점 -> `in_review/high`
- [ ] (실측 불가 시) SQL Editor 재현 쿼리/기대 결과/재실측 절차 링크

## 6. RLS/Storage 회귀 체크 (Ticket 01/04)
- [ ] anon write 불가(스토리/투표/제출/신고 모두)
- [ ] votes: `unique(voter_id, final_track_id)` / `unique(voter_id, client_request_id)` 유지
- [ ] `storage.objects` RLS enable 시도 금지(42501 이슈 문서 링크)
- [ ] 경로 규칙 `artist/{uid}/song/{song_id}/...` 위반 시 차단

## 7. Edge verify_jwt 정책(중요)
- `create-upload-session`: `verify_jwt=false` (TEMP) + 내부 `requireAuth`/role/ownership 강제
- `get-track-play-url`: `verify_jwt=true`
- [ ] TEMP 우회 리스크/만료 조건 문서 링크
- [ ] 지원 이슈 추적 placeholder 링크 (`SUPABASE-EDGE-JWT-VERIFY-401`)

## 8. 결과 기록 템플릿
- 날짜/환경/계정 role
- PASS/FAIL 표
- FAIL 시: 재현 단계, 기대값/관측값, `correlationId`, 관련 로그/SQL

## Observed Results (2026-02-17 KST)
- 실행 환경: 로컬 개발 서버(`npx expo start --port 8082`) + QA 수동 조작 필요
- 관측 주체: QA Agent(문서화) / 실제 실기기-에뮬 조작 권한 없음
- 계정 role: 미확정(실측 세션 미연결)

| # | 항목 | Expected | Observed | PASS/FAIL | Notes |
|---|---|---|---|---|---|
| 1 | 탭 라우팅(home/story/show/my) | 탭 전환 시 크래시 없이 화면 전환 | 본 세션은 터미널 실행만 가능, UI 탭 클릭 관측 불가 | FAIL (실측 불가) | 재현: (1) 앱 실행 후 각 탭 1회 클릭, (2) 왕복 전환 2회 반복. 로그 요약: Metro는 8082에서 기동 확인, UI 이벤트 로그 미수집. correlationId: N/A |
| 2 | Show Top10 로드 | 진입 시 로딩 후 리스트 또는 empty/error 문구 | Show 탭 진입 자체를 수동 수행하지 못해 상태 미확정 | FAIL (실측 불가) | 재현: (1) Show 탭 진입, (2) 초기 상태/결과 상태 캡처. 로그 요약: 네트워크 요청 트레이스 미수집. correlationId: N/A |
| 3 | Show 재생(트랙 A) | 재생 -> 정지, 실제 오디오 출력 | 오디오 장치/앱 조작 불가로 재생 이벤트 관측 불가 | FAIL (실측 불가) | 재현: (1) 트랙 A 재생 버튼, (2) 정지 버튼. 로그 요약: expo-av 이벤트 로그 미수집. correlationId: getPlayUrl 성공 시 콘솔에서 확인 필요 |
| 4 | Show 트랙 전환(A->B) | A 중단 후 B만 재생(겹침 없음) | 동시 재생 여부를 청취/상태로 확인하지 못함 | FAIL (실측 불가) | 재현: (1) A 재생 중 B 재생, (2) A/B 상태 라벨 확인. 로그 요약: PlaybackStatus 콜백 결과 미수집. correlationId: getPlayUrl 호출별 수동 기록 필요 |
| 5 | 투표 1회 성공 | 투표됨 표시 + 카운트 갱신 | 로그인 세션/버튼 조작 부재로 성공 경로 미관측 | FAIL (실측 불가) | 재현: (1) 로그인 후 트랙 1개 투표, (2) UI badge/userVoteCount 확인. 로그 요약: castVotes 응답 페이로드 미수집. correlationId: N/A(RPC) |
| 6 | 중복 투표 | 동일 트랙 재투표 시 `DUPLICATE_VOTE` 문구 | 중복 클릭 테스트 미수행 | FAIL (실측 불가) | 재현: (1) 같은 트랙 연속 2회 투표, (2) 에러 문구 확인. 로그 요약: 에러 코드 매핑 로그 미수집. correlationId: N/A(RPC) |
| 7 | 3표 한도 | 4번째 투표 시 `VOTE_LIMIT_EXCEEDED` 문구 | 4회 시나리오 미수행 | FAIL (실측 불가) | 재현: (1) 서로 다른 트랙 3개 투표, (2) 4번째 투표 시 메시지 확인. 로그 요약: 한도 초과 응답 미수집. correlationId: N/A(RPC) |
| 8 | Submission 플로우(최소 1회) | My->제출->세션->PUT->`complete_song_submission` 완료 | UI 입력/파일 선택/업로드 조작 불가로 단계별 실측 미수행 | FAIL (실측 불가) | 재현: (1) My 탭 CTA 진입 후 오디오 업로드, (2) 제출 완료 RPC 확인. 실패 시 단계/콘솔 요약 기록(세션발급/PUT/RPC) + correlationId 기록. signedUrl 기록 금지 |

### 재실측 절차 (필수 후속)
1. 실기기 또는 에뮬에서 Expo Go 실행 후 `kwzguusrbciklojvimsh` 테스트 계정(artist) 로그인.
2. 본 문서의 1~8 항목을 순서대로 수행하고 각 항목의 Observed/PASS-FAIL/Notes를 업데이트.
3. FAIL 항목은 반드시 재현 단계 2줄 + 콘솔/네트워크 요약 + correlationId(있을 때)를 남긴다.
4. `signedUrl`은 어떤 경우에도 문서/스크린샷/로그에 기록하지 않는다.

## 실측 불가 처리 규칙
- 실측 불가 항목은 FAIL로 방치하지 않는다.
- 반드시 3가지를 함께 남긴다:
  1) 실행 불가 이유(환경/권한/도구 제약)
  2) 재실측 절차(누가, 어디서, 어떤 순서로)
  3) 기대값(성공/거부 기준, 에러 코드/메시지)

링크(문서 하단)
- contracts:
  - `docs/contracts/api.md`
  - `docs/contracts/schema.md`
  - `docs/contracts/ux-flows.md`
- execution logs:
  - `docs/plan/execution-logs/ticket-05-be.md`
  - `docs/plan/execution-logs/ticket-08-1-db.md`
  - `docs/plan/execution-logs/ticket-07-1-db.md`
  - `docs/plan/execution-logs/ticket-03-db.md`
  - `docs/plan/execution-logs/ticket-04-db.md`
