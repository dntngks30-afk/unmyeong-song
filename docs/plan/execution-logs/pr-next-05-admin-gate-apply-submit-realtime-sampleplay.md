# PR-NEXT-05: Admin 탭 비노출 / 승인 신청 제출 / 즉시 반영 / 샘플 재생

## 요약

- **PART 1**: 비관리자 탭바에서 admin 탭 완전 비노출
- **PART 2**: 뮤지션 승인 신청 제출 버튼 동작 + Alert → 홈 이동
- **PART 3**: 관리자 승인 시 뮤지션 화면 즉시 반영 (realtime + focus refetch)
- **PART 4**: 관리자 탭에서 승인대기 뮤지션 샘플곡 앱 내 재생

---

## 변경 파일

### PART 1
- `app/(tabs)/_layout.tsx`: `isAdmin` 상태 추가, `getMyEntitlement`로 관리자 여부 조회, 비관리자일 때 `tabBarButton: () => null`로 admin 탭 숨김
- `app/(tabs)/admin/index.tsx`: 비관리자 접근 시 `router.replace("/(tabs)/home")`로 홈 리다이렉트

### PART 2
- `supabase/migrations/202602200001_submit_musician_application.sql`: `submit_musician_application` RPC 추가 (idempotent, sample_song_audio_path 필수)
- `features/musician-apply/api/mutations.ts`: `submitMusicianApplication` API 추가
- `app/(tabs)/my/apply.tsx`: 제출 시 `console.log("[Apply] submit pressed")`, try/catch, `submitMusicianApplication` 호출, 성공 시 Alert "신청이 완료 되었습니다. 승인이 완료되면 뮤지션 활동이 가능합니다." + `router.replace("/(tabs)/home")`

### PART 3
- `src/services/my.ts`: `subscribeToProfileChanges(userId, onUpdate)` 추가
- `app/submission/new.tsx`: `userId` 상태 추가, `subscribeToProfileChanges` 구독, `useFocusEffect`로 포커스 시 프로필 재조회

### PART 4
- `supabase/functions/get-application-sample-url/index.ts`: 관리자 전용 Edge Function, `musician_applications.sample_song_audio_path`로 signed URL 발급
- `features/admin/api/samplePlay.ts`: `getApplicationSamplePlayUrl` API
- `features/admin/api/queries.ts`: `PendingMusician`에 `sample_song_audio_path` 추가
- `src/hooks/useAudioPlayer.ts`: `playFromUrl(signedUrl, sourceId)` 추가
- `app/(tabs)/admin/index.tsx`: 승인대기 뮤지션 카드에 "샘플 재생" 버튼, 샘플 없으면 "샘플곡이 없습니다." 표시

---

## 검증 방법

### PART 1
1. **비관리자**: 로그인 후 탭바에 홈·사연·쇼·마이 4개만 노출되는지 확인
2. **관리자**: 탭바에 관리자 탭이 보이고 진입 가능한지 확인

### PART 2
1. 마이 → 뮤지션 승인 신청
2. 샘플 업로드 후 "승인 신청 제출" 클릭
3. 콘솔에 `[Apply] submit pressed` 출력 확인
4. 성공 시 Alert "신청이 완료 되었습니다. 승인이 완료되면 뮤지션 활동이 가능합니다." 확인
5. "확인" 클릭 시 홈 탭으로 이동 확인

### PART 3
1. 뮤지션 계정으로 로그인 후 submission/new 화면 노출
2. 다른 기기/탭에서 관리자가 해당 뮤지션 승인
3. 로그아웃 없이 submission/new에서 곡 업로드 가능해지는지 확인
4. (Realtime 미설정 시) submission/new로 포커스 이동 시 프로필 재조회로 반영되는지 확인

### PART 4
1. 관리자로 로그인 → 관리자 탭 → 뮤지션
2. 승인대기 뮤지션 중 `sample_song_audio_path` 있는 항목에 "샘플 재생" 버튼 표시 확인
3. "샘플 재생" 클릭 시 오디오 재생 확인
4. 샘플 없는 뮤지션에 "샘플곡이 없습니다." 표시 확인
5. 비관리자: Edge Function 호출 시 403 FORBIDDEN 반환 (재생 옵션 자체가 비노출)

---

## 주의사항

- **Realtime**: `profiles` 테이블에 Postgres Changes 구독 사용. Supabase 대시보드에서 Realtime 활성화 필요.
- **Edge Function 배포**: `supabase functions deploy get-application-sample-url` 실행 필요.
- **Migration 적용**: `supabase db push` 또는 `supabase migration up`으로 `submit_musician_application` RPC 적용.
