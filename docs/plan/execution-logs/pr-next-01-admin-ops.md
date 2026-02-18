# PR-NEXT-01: Admin Ops UI + RPC Wiring

## 목표
관리자(admin)만 접근 가능한 승인 운영 화면을 완성하고, RPC를 실제로 호출해 운영이 가능하게 함.

## 구현 범위

### 1. Admin 라우팅/가드
- **경로**: `app/(tabs)/admin/index.tsx`
- **가드**: 진입 시 `profiles.is_admin` 조회
  - `false` 또는 세션 없음 → "관리자 권한이 없어요" 안내 + 마이로 돌아가기
  - `true` → 3개 세그먼트(사연/뮤지션/트랙) 렌더
- **접근**: 마이 탭 "승인 관리" → `/(tabs)/admin`
- **리다이렉트**: `/admin` → `/(tabs)/admin` (기존 링크 호환)

### 2. 조회 테이블/뷰

| 세그먼트 | 테이블/조인 | 조건 |
|---------|-------------|------|
| 사연 | `stories` + `profiles` (author) | `story_status = 'pending'` |
| 뮤지션 | `musician_applications` + `profiles` | `status = 'pending'` |
| 뮤지션(승인됨) | `profiles` | `is_musician_approved = true`, `role != 'admin'` |
| 트랙 | `final_tracks` + `songs` + `profiles` (artist) | `status = 'candidate'` |

### 3. RPC 호출

| 액션 | RPC | 파라미터 |
|------|-----|----------|
| 사연 승인 | `approve_story` | `p_story_id` |
| 사연 거절 | `reject_story` | `p_story_id` |
| 뮤지션 승인 | `approve_musician_application` | `p_application_id` |
| 뮤지션 거절 | `reject_musician_application` | `p_application_id`, `p_note`(선택) |
| 뮤지션 되돌리기 | `undo_musician_approval` | `p_user_id` |
| 트랙 승인 | `approve_final_track` | `p_final_track_id` |
| 트랙 거절 | `reject_final_track` | `p_final_track_id` |

### 4. 에러 메시지 매핑
- `AUTH_REQUIRED` / JWT / UNAUTHORIZED → "로그인이 필요해요"
- `FORBIDDEN_ROLE` / `RLS_DENIED` / `FORBIDDEN` / PGRST301 → "관리자 권한이 없어요"
- 그 외 → "처리에 실패했어요. 잠시 후 다시 시도해 주세요."

### 5. 파일 구조
```
features/admin/
  api/
    queries.ts   # fetchPendingStories, fetchPendingMusicians, fetchApprovedMusicians, fetchPendingTracks
    mutations.ts # approveStory, rejectStory, approveMusicianApplication, rejectMusicianApplication,
                  # undoMusicianApproval, approveFinalTrack, rejectFinalTrack

app/(tabs)/admin/
  index.tsx      # Admin 화면 (가드 + 세그먼트 + RPC 연결)

app/admin/
  index.tsx      # Redirect → (tabs)/admin
```

## 운영 순서
1. 관리자 계정으로 로그인 (`profiles.is_admin = true`)
2. 마이 탭 → "승인 관리" 클릭
3. 사연/뮤지션/트랙 세그먼트에서 각각 승인/거절 실행
4. 성공 시 해당 row가 리스트에서 즉시 제거(optimistic)

## 실패 시 점검
1. **"관리자 권한이 없어요"**
   - `profiles.is_admin` 확인
   - `profiles.role = 'admin'` 이면 `is_admin` 자동 true (sync_profile_is_admin 트리거)
2. **RPC 403 / FORBIDDEN_ROLE**
   - RPC는 `public.is_admin(auth.uid())` 체크
   - JWT에 userId 포함 여부, profiles에 해당 사용자 행 존재 여부 확인
3. **목록 조회 실패**
   - RLS 정책: admin은 stories/musician_applications/profiles/final_tracks select 허용
   - `final_tracks_all_admin`, `stories_select_public_approved_or_owner_admin` 등 확인

## 스모크 테스트 체크리스트
- [ ] 비관리자: admin 진입 시 "관리자 권한이 없어요" + 마이로 돌아가기
- [ ] 관리자: pending story approve → 리스트에서 사라짐, 공개 목록에 노출(approved)
- [ ] 관리자: pending story reject → 리스트에서 사라짐
- [ ] 관리자: musician approve → is_musician_approved true, 승인 대기에서 사라짐
- [ ] 관리자: undo musician approval → 승인됨에서 사라짐
- [ ] 관리자: pending track approve → 리스트에서 사라짐, show 목록에 노출(top10)
- [ ] 관리자: pending track reject → 리스트에서 사라짐

## 다음 PR (미구현)
- 미리듣기 버튼 (트랙 상세)
- 검색/필터
- 신고 큐 연동
