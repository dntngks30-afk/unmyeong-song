# PR-LAUNCH-01: 승인제 운영 매뉴얼

## SSOT
- 마이그레이션: `supabase/migrations/202602180001_launch_admin_approval.sql`
- 이 문서: 승인 기준, 일일 운영 루틴, 실수 방지, 장애 시 점검

---

## 1. 승인 기준

### 1.1 사연 (stories)
- **pending** → admin이 승인/거절
- 공개 리스트(Story 탭): `story_status='approved'` + `is_blocked=false`만 노출
- 승인 기준: 개인정보/금전정보 미포함, 서비스 정책 준수
- RPC: `approve_story(p_story_id)`, `reject_story(p_story_id)`

### 1.2 뮤지션 (profiles.is_musician_approved)
- **승인 대기**: `musician_applications.status='pending'`
- 승인 시: `profiles.is_musician_approved=true`, `role='artist'`
- **되돌리기**: 잘못 승인 시 `undo_musician_approval(p_user_id)` → `is_musician_approved=false`, `role='viewer'`
- 업로드/제출 버튼: `is_musician_approved=true` 또는 admin일 때만 활성
- RPC: `approve_musician_application`, `reject_musician_application`, `undo_musician_approval`

### 1.3 트랙 (final_tracks)
- **candidate** → admin이 승인 → `top10` / 거절 → `removed`
- Show 탭: `status='top10'`만 노출
- RPC: `approve_final_track`, `reject_final_track`

---

## 2. 일일 운영 루틴 (권장 순서)

1. **Admin 진입**: 마이 탭 → "승인 관리" (admin 계정만 노출)
2. **큐 처리 순서**:
   - (1) 사연 승인 큐 → pending 사연 Approve/Reject
   - (2) 뮤지션 승인 큐 → pending 신청 Approve/Reject, 승인됨 목록에서 되돌리기 필요 시 Undo
   - (3) 트랙 승인 큐 → candidate 트랙 Approve/Reject
3. **빈 큐**: 각 탭에 "대기 중인 … 없어요" 표시 시 다음 큐로 이동

---

## 3. 실수 방지 / 되돌리기 / 거절 처리 기준

| 상황 | 조치 |
|------|------|
| 사연 잘못 승인 | 현재 RPC 없음. 수동: `UPDATE stories SET story_status='rejected' WHERE id=...` (admin 권한 필요) |
| 사연 잘못 거절 | 수동: `UPDATE stories SET story_status='pending' WHERE id=...` 후 재승인 |
| 뮤지션 잘못 승인 | **되돌리기** 버튼으로 `undo_musician_approval` 호출 |
| 뮤지션 잘못 거절 | musician_applications에 새 pending 신청이 있으면 재심사, 없으면 사용자가 재신청 필요 |
| 트랙 잘못 승인 | 수동: `UPDATE final_tracks SET status='removed' WHERE id=...` (admin 권한 필요) |
| 트랙 잘못 거절 | 수동: `UPDATE final_tracks SET status='candidate' WHERE id=...` 후 재승인 |

---

## 4. 장애 시 점검

### 4.1 정책 확인
```sql
-- Stories: approved만 공개
SELECT polname, polcmd, polroles FROM pg_policy WHERE polrelid = 'public.stories'::regclass;

-- Songs insert: is_musician_approved OR admin
SELECT polname FROM pg_policy WHERE polrelid = 'public.songs'::regclass AND polcmd = 'a';
```

### 4.2 RPC 권한
```sql
SELECT routine_name, grantee FROM information_schema.routine_privileges
WHERE routine_schema='public' AND routine_name IN (
  'approve_story','reject_story','approve_musician_application',
  'reject_musician_application','undo_musician_approval',
  'approve_final_track','reject_final_track'
);
-- grantee = authenticated 기대
```

### 4.3 로그
- Supabase Dashboard → Logs → Postgres / Edge Functions
- `FORBIDDEN_ROLE`: 비관리자가 RPC 호출 시
- `NOT_FOUND`: 대상 id 없음 또는 이미 처리됨

### 4.4 트랙 미리듣기
- 현재 `get-track-play-url`는 `status='top10'`만 허용. **candidate 트랙은 미리듣기 미지원**.
- 승인 전 미리듣기 필요 시: Edge Function 확장 또는 Storage 직접 signedUrl(admin) 별도 구현.

---

## 5. 검증 체크리스트 (반드시 통과)

| # | 항목 | 기대 |
|---|------|------|
| 1 | pending 사연 | Story 공개 리스트에 **안 보임** |
| 2 | admin 승인 후 사연 | approved 사연만 공개 리스트에 **보임** |
| 3 | 뮤지션 미승인 | 업로드/제출 버튼 **비활성** + 안내 |
| 4 | 뮤지션 승인 후 | 업로드/제출 버튼 **활성** |
| 5 | pending 트랙(candidate) | Show 탭에 **안 보임** |
| 6 | 트랙 승인 후(top10) | Show 탭에 **보임** |
| 7 | 비관리자 admin RPC 호출 | RLS/정책으로 **차단** (`FORBIDDEN_ROLE`) |
| 8 | 비관리자 /admin 진입 | `profiles.is_admin=false` → 마이로 **리다이렉트** |

---

## 6. 관련 경로

- Admin UI: `app/admin/index.tsx`
- 마이 탭 admin 링크: `app/(tabs)/my.tsx` (status=admin일 때 "승인 관리")
- Stories 공개 조회: `features/story/api/queries.ts` (`story_status=approved`)
- Submission 업로드 조건: `app/submission/new.tsx` (`is_musician_approved` 또는 admin)
- Entitlement: `src/services/my.ts` (`getMyEntitlement`)
