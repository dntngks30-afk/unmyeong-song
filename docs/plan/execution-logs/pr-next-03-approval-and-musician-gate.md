# PR-NEXT-03: Approval Visibility + Musician Gatekeeper

## A) "승인했는데 사연 목록에 안 보임" 해결

### 원인 (증거)
- `listStories` → `getStoryList` → **stories** 테이블 직접 조회
- 필터: `story_status=eq.approved`, `is_blocked=eq.false` (정상)
- `approve_story` RPC: `story_status='approved'` 설정 (정상)
- RLS `stories_select_public_approved_or_owner_admin`: `(story_status='approved' AND is_blocked=false)` OR owner OR admin (정상)
- **best_stories_v** 뷰: `is_blocked=false`만 필터, `story_status` 미포함 → 홈 등에서 pending 노출 가능성

### 수정
- **202602190001_story_approval_visibility.sql**: `best_stories_v`에 `story_status='approved'` 조건 추가
- `getStoryList`는 이미 `story_status=eq.approved` 사용 → 추가 수정 없음

### 검증
- 승인 전: 목록 미노출
- 승인 후: 목록 노출
- 본인 pending: 마이/내 사연에는 보이나 공개 목록에는 미노출 (RLS 유지)

---

## B) 뮤지션 승인 전/후 업로드 권한

### 경로 규칙
| 용도 | 경로 | 허용 조건 |
|------|------|-----------|
| 정식 곡 제출 | `artist/{uid}/song/{song_id}/audio\|cover.{ext}` | `is_musician_approved=true` OR admin |
| 승인 신청 샘플 | `artist/{uid}/application/{application_id}/sample.mp3` | pending musician_application 소유자, `!is_musician_approved` |

### 플래그 변화 (관리자 승인 시)
- `approve_musician_application` RPC:
  - `musician_applications.status` → `approved`
  - `profiles.is_musician_approved` → `true`
  - `profiles.role` → `artist` (viewer였을 경우)

### 신규/수정 파일
- `app/(tabs)/my/apply.tsx` - 뮤지션 승인 신청 (샘플 1곡 업로드)
- `features/musician-apply/api/mutations.ts` - `createApplicationSampleUploadSession`, `setMusicianApplicationSamplePath`
- `supabase/functions/create-upload-session` - `purpose=application` 분기 추가
- `supabase/migrations/202602190002_musician_application_sample_rpc.sql` - `set_musician_application_sample_path` RPC

### submission/new 가드
- `!is_musician_approved`: 업로드 UI 비활성 + "승인 완료 후 제출 가능" + My/승인 신청 링크

### My 탭
- `is_musician_approved === false` → "뮤지션 승인 신청" 항목 노출 → `/(tabs)/my/apply`
