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
