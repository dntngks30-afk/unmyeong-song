# Schema Contract (SSOT)

## 문서 목적
- 이 문서는 DB/Storage/RLS 계약의 단일 진실(Single Source of Truth)이다.
- 구현은 이 문서를 따라야 하며, 충돌 시 구현이 아닌 문서를 먼저 수정한다.

## 최소 권한 원칙 (Least Privilege)
- 기본 거부(Default Deny): 모든 테이블/버킷은 기본 거부 후 정책으로 최소 허용만 연다.
- 소유권 우선: user write는 `owner_id = auth.uid()` 제약이 기본이다.
- 불변 로그: 투표/신고 기록은 update/delete를 허용하지 않는다.
- 서비스 경계: 민감 write는 RPC/Edge Function만 허용한다.

## Role / Enum 모델

### Enum
- `user_role`: `viewer | artist | admin`
- `submission_status`: `draft | submitted | approved | rejected`
- `report_status`: `open | in_review | resolved | dismissed`
- `final_track_status`: `candidate | top10 | removed`
- `entitlement_status`: `inactive | active | grace | revoked`

### 역할 정의
- `viewer`: 콘텐츠 조회, 사연 작성, 신고, 투표 가능(권한 범위 내).
- `artist`: `viewer` 권한 + 자작곡 제출/관리.
- `admin`: moderation 및 운영 정책 권한.

## ER 수준 데이터 모델

### `profiles`
- 목적: 사용자 공개/권한 정보
- 컬럼:
  - `id uuid pk` (auth.users.id 참조)
  - `role user_role not null default 'viewer'`
  - `display_name text null`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`

### `stories`
- 목적: 사연 작성/목록/상세
- 컬럼:
  - `id uuid pk default gen_random_uuid()`
  - `author_id uuid not null` -> `profiles.id`
  - `title text not null`
  - `body text not null`
  - `is_blocked boolean not null default false`
  - `block_reason text null`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`

### `songs`
- 목적: 뮤지션 자작곡 제출
- 컬럼:
  - `id uuid pk default gen_random_uuid()`
  - `artist_id uuid not null` -> `profiles.id`
  - `title text not null`
  - `audio_path text not null` (Storage 경로)
  - `cover_path text null` (Storage 경로)
  - `making_note text not null`
  - `status submission_status not null default 'submitted'`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`

### `final_tracks`
- 목적: 결선 Top10 큐레이션
- 컬럼:
  - `id uuid pk default gen_random_uuid()`
  - `song_id uuid not null unique` -> `songs.id`
  - `rank_order int null`
  - `status final_track_status not null default 'candidate'`
  - `published_at timestamptz null`
  - `created_at timestamptz not null default now()`

### `votes`
- 목적: 결선 투표 기록(1인 3표)
- 컬럼:
  - `id uuid pk default gen_random_uuid()`
  - `voter_id uuid not null` -> `profiles.id`
  - `final_track_id uuid not null` -> `final_tracks.id`
  - `device_fingerprint text null`
  - `client_request_id uuid not null`
  - `created_at timestamptz not null default now()`
- 제약:
  - `unique (voter_id, final_track_id)` (중복 동일 트랙 투표 방지)
  - `unique (client_request_id)` (중복 요청 재실행 방지)

### `reports`
- 목적: 신고 접수
- 컬럼:
  - `id uuid pk default gen_random_uuid()`
  - `reporter_id uuid not null` -> `profiles.id`
  - `target_type text not null` (`story | song`)
  - `target_id uuid not null`
  - `reason text not null`
  - `status report_status not null default 'open'`
  - `score int not null default 1`
  - `created_at timestamptz not null default now()`

### `moderation_queue`
- 목적: 자동 검수/운영 검수 큐
- 컬럼:
  - `id uuid pk default gen_random_uuid()`
  - `source_report_id uuid not null unique` -> `reports.id`
  - `target_type text not null`
  - `target_id uuid not null`
  - `queue_status report_status not null default 'open'`
  - `risk_level text not null default 'low'` (`low | medium | high`)
  - `threshold_reached_at timestamptz null`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`

### `entitlements`
- 목적: 구독/권한 상태 저장(결제 구현은 추후)
- 컬럼:
  - `id uuid pk default gen_random_uuid()`
  - `user_id uuid not null unique` -> `profiles.id`
  - `status entitlement_status not null default 'inactive'`
  - `source text not null` (`app_store | play_store | manual`)
  - `expires_at timestamptz null`
  - `updated_at timestamptz not null default now()`

## 관계 요약
- `profiles 1:N stories`
- `profiles 1:N songs`
- `songs 1:0..1 final_tracks`
- `profiles 1:N votes`, `final_tracks 1:N votes`
- `profiles 1:N reports`
- `reports 1:0..1 moderation_queue`
- `profiles 1:0..1 entitlements`

## 인덱스/제약 (필수)
- `stories`
  - `idx_stories_created_at (created_at desc)`
  - `idx_stories_author_id (author_id)`
  - `idx_stories_is_blocked_created_at (is_blocked, created_at desc)`
- `songs`
  - `idx_songs_artist_id_created_at (artist_id, created_at desc)`
  - `idx_songs_status_created_at (status, created_at desc)`
- `final_tracks`
  - `idx_final_tracks_status_rank (status, rank_order)`
- `votes`
  - `idx_votes_voter_created_at (voter_id, created_at desc)`
  - `idx_votes_final_track (final_track_id)`
  - `uq_votes_client_request_id (client_request_id)`
- `reports`
  - `idx_reports_target (target_type, target_id)`
  - `idx_reports_status_created_at (status, created_at desc)`
- `moderation_queue`
  - `idx_mq_queue_status_created_at (queue_status, created_at desc)`
  - `idx_mq_risk_level (risk_level)`

## 테이블별 RLS 정책 요약 (자연어)
- 공통:
  - 모든 테이블 RLS `ON` 필수.
  - 정책 이름은 `<table>_<action>_<scope>` 규칙 사용.
  - `USING`/`WITH CHECK`를 함께 정의해 읽기/쓰기 모두 제한.
- `profiles`
  - 본인 `select/update` 허용.
  - `role` 변경은 admin 전용 경로만 허용.
- `stories`
  - 공개 목록/상세 `select` 허용 (`is_blocked=false` 조건).
  - 인증 사용자만 `insert` 허용, `author_id = auth.uid()`.
  - 수정/삭제는 본인 또는 admin.
- `songs`
  - 공개 가능한 상태(`approved`, `top10`)만 일반 `select`.
  - `artist` 이상만 `insert`, `artist_id = auth.uid()`.
  - 수정은 본인 아티스트 + 상태 전이 규칙 준수.
- `final_tracks`
  - 일반 사용자 `select` 허용(공개 상태).
  - `insert/update/delete`는 admin 전용.
- `votes`
  - 인증 사용자만 `insert` 가능, `voter_id = auth.uid()`.
  - `select`는 본인 기록 + 집계 뷰(개별 타인 데이터 비노출).
  - `update/delete` 금지(불변 로그).
  - `client_request_id` 재사용 요청은 거부.
- `reports`
  - 인증 사용자 `insert` 가능, `reporter_id = auth.uid()`.
  - 일반 사용자는 본인 신고 내역만 조회.
  - 상태 변경은 admin 또는 자동 함수만.
- `moderation_queue`
  - admin만 `select/update`.
  - 생성은 트리거/함수 경로만 허용.
- `entitlements`
  - 본인 조회 허용.
  - 쓰기 변경은 Edge Function(서버 검증) 전용.

## 트리거 / RPC / 함수 계약

### RPC
- `cast_votes_max3(p_final_track_id uuid)`:
  - 인증 사용자 기준 총 투표 수를 확인하고 3회 초과 시 실패.
  - 동일 트랙/중복 요청(`client_request_id`)을 차단한다.
  - 성공 시 `votes`에 1건 insert.
- `submit_story_rate_limited(p_title text, p_body text)`:
  - 사용자별 시간창 제한(예: 분당/시간당 제한) 후 `stories` insert.
  - PII 패턴(전화번호/이메일/계좌/정확 주소) 탐지 시 `CONTENT_BLOCKED`.
- `create_report_and_queue(p_target_type text, p_target_id uuid, p_reason text)`:
  - `reports` insert 후 누적 점수 계산.
  - 임계치 충족 시 `moderation_queue` 상태를 `in_review`로 승격.

### Trigger
- `trg_reports_to_queue`:
  - `reports` 신규 생성 시 `moderation_queue` 자동 생성.
- `trg_set_updated_at`:
  - `profiles`, `stories`, `songs`, `moderation_queue`, `entitlements`의 `updated_at` 자동 갱신.
- `trg_report_threshold_transition`:
  - 동일 대상 신고 점수 누적이 임계치 이상이면 `moderation_queue.queue_status`를 `in_review`로 전이.

### SQL Function (내부)
- `is_admin(uid)` / `current_role(uid)`:
  - RLS policy 조건에서 역할 조회.
- `validate_storage_path(bucket, path)`:
  - 경로 규칙 준수 여부 확인.

## Storage 계약

### Bucket
- `song-audio` (필수 오디오, private)
- `song-cover` (선택 커버, 기본 private)

### 경로 규칙
- 오디오: `artist/{user_id}/song/{song_id}/audio.{ext}`
- 커버: `artist/{user_id}/song/{song_id}/cover.{ext}`
- 임시 업로드 경로와 공개 경로를 분리한다.
- 허용 확장자:
  - 오디오: `mp3 | m4a | wav`
  - 커버: `jpg | jpeg | png | webp`

### 접근 제어
- 공개 URL 직접 노출 금지.
- FE는 필요 시 서명 URL(signed URL)만 요청한다.
- 서버(RPC/Edge)가 사용자 역할/소유권/상태를 검증한 뒤 서명 URL을 발급한다.
- signed URL 정책:
  - 업로드 URL TTL 300초
  - 재생 URL TTL 60초
  - 단일 객체, 단일 method scope

## 모더레이션 임계치/상태전이 계약
### 신고 누적 임계치
| 누적 score | queue_status | 자동 동작 |
|---:|---|---|
| 1~2 | `open` | 큐 등록 유지 |
| 3~4 | `in_review` | 운영 검수 대상 승격 |
| 5+ | `in_review` + `risk_level=high` | 우선 검수 플래그 |

### 상태 전이 규칙
| from | to | 주체 | 조건 |
|---|---|---|---|
| `open` | `in_review` | trigger/rpc | 임계치 도달 |
| `in_review` | `resolved` | admin | 위반 확정/조치 완료 |
| `in_review` | `dismissed` | admin | 오신고 판단 |
| `open` | `dismissed` | admin | 명백한 오신고 |

## 안전한 마이그레이션 전략
- 원칙: Expand -> Migrate -> Contract.
  1) Expand: nullable 컬럼/신규 테이블/신규 정책 추가
  2) Migrate: 백필/데이터 정합성 점검
  3) Contract: 기존 컬럼 제거, 강한 제약 활성화
- 파괴적 변경은 최소 2단계 릴리즈로 분리한다.
- 모든 마이그레이션은 롤백 SQL 또는 역방향 절차를 문서화한다.
- RLS 변경 시 사전/사후 체크리스트를 둔다:
  - 예상 허용/거부 케이스 테스트
  - admin 우회 권한 경로 확인
  - anon 우회 가능성 차단 확인

## 변경 이력
- 2026-02-16: 인덱스/제약 섹션 추가, 최소 권한 원칙 명문화, 신고 임계치/상태전이 표 추가, Storage 공개/비공개 및 signed URL TTL 명시.
- 2026-02-16: Ticket 01 DB 산출물(`supabase/migrations/202602160001_init_schema.sql`, `supabase/policies/01_base_rls.sql`) 역링크 추가.

## 결정 근거
- 운영 초기에 분쟁이 큰 영역(RLS, vote, report, storage)에 대해 기계적으로 확인 가능한 제약/인덱스/전이표를 먼저 고정한다.
- 신고/투표는 데이터 품질 이슈가 잦아, 함수 계약과 제약을 문서 단계에서 선제적으로 명확히 한다.

## 비결정(추후)
- 신고 점수 가중치(신뢰 사용자/반복 신고자)
- 자동 차단과 수동 검수의 경계 조건
- 스토리지 공개 전환 승인 워크플로우(운영 콘솔/배치)

## 구현 역링크
- Ticket 01 마이그레이션: `supabase/migrations/202602160001_init_schema.sql`
- Ticket 01 정책 카탈로그: `supabase/policies/01_base_rls.sql`
- Ticket 01 실행 로그: `docs/plan/execution-logs/ticket-01-db.md`
