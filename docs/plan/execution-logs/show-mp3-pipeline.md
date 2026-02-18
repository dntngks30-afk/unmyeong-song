# PR-LAUNCH-02: Show mp3 파이프라인

## SSOT
- 마이그레이션: `supabase/migrations/202602180002_show_play_count_pipeline.sql`
- 이 문서: bucket/경로 규칙, 정책 요약, play count 룰, 트러블슈팅

---

## 1. 데이터 모델 (현재 사용)

| 테이블 | 역할 | 핵심 컬럼 |
|--------|------|------------|
| `songs` | 뮤지션 제출곡 | artist_id, audio_path, status(draft/submitted/approved/rejected) |
| `final_tracks` | Show 노출 큐 | song_id, status(candidate/top10/removed), play_count |

- Show 공개 리스트: `final_tracks_public_v` (status='top10'만)
- 재생 URL: `get-track-play-url` Edge Function (top10만 허용)

---

## 2. Bucket / 경로 규칙

### Bucket
- `song-audio`: 오디오 파일 (private)
- `song-cover`: 커버 이미지 (private, 선택)

### 경로
- 오디오: `artist/{user_id}/song/{song_id}/audio.{mp3|m4a|wav}`
- 커버: `artist/{user_id}/song/{song_id}/cover.{jpg|jpeg|png|webp}`

### 업로드 권한
- `validate_storage_path`: owner + songs 테이블에 해당 song 존재 확인
- `create-upload-session`: is_musician_approved 또는 admin만 발급
- RLS `songs_insert`: is_musician_approved 또는 admin만 insert

### 읽기 권한
- signed URL만 (public read 없음)
- `get-track-play-url`: status='top10' final_track만 재생 URL 발급

---

## 3. Play Count 룰

| 항목 | 내용 |
|------|------|
| 증가 시점 | 재생 버튼 첫 클릭 시 1회 |
| 중복 방지 | 앱에서 동일 트랙 5분 내 중복 호출 차단 |
| RPC | `increment_track_play(p_final_track_id)` |
| 대상 | final_tracks.status='top10'만 |
| 권한 | authenticated (로그인 사용자) |
| 직접 UPDATE | 금지 (RPC로만) |

---

## 4. 업로드 → Show 노출 흐름

1. **create_draft_song** → songs 행 생성 (status=draft, audio_path placeholder)
2. **create-upload-session** → signed upload URL 발급
3. **PUT** → Storage에 업로드
4. **complete_song_submission** → songs.status=submitted
5. **Admin** → final_tracks에 candidate 추가 (수동 또는 툴)
6. **Admin** → approve_final_track → status=top10
7. **Show** → final_tracks_public_v에서 top10 노출

---

## 5. 트러블슈팅

### 403 / FORBIDDEN_ROLE
- **create-upload-session**: is_musician_approved=false → 마이 탭에서 "승인 필요" 안내 확인
- **get-track-play-url**: status≠top10 (candidate/removed) → Show에 안 보여야 정상

### Signed URL 만료
- 재생 URL TTL 60초. 재생 중 만료 시 "재생 URL이 만료되어 다시 요청했어요" 후 자동 재시도

### Audio load fail
- Storage에 해당 경로 파일 존재 여부 확인
- `songs.audio_path`와 실제 object 경로 일치 확인
- 네트워크/CORS 문제 시 Edge Function 로그 확인

### play_count 미반영
- RPC `increment_track_play`는 top10만 업데이트
- 5분 throttle: 동일 세션 5분 내 재생 시 카운트 증가 안 함 (정상)
- 새로고침 후 반영 확인

---

## 6. 검증 체크리스트

| # | 항목 | 기대 |
|---|------|------|
| 1 | 뮤지션 미승인 | 업로드 버튼 비활성 + "승인 필요" 안내 |
| 2 | 승인 후 업로드 | mp3 업로드 성공 + songs submitted |
| 3 | Admin 승인 후 | Show 리스트에 노출 |
| 4 | Show 상세 재생 | 재생/일시정지 정상 (모바일/웹) |
| 5 | 재생 클릭 | play_count 증가 (새로고침 후 반영) |
| 6 | pending 트랙 | public 재생/노출 불가 |
