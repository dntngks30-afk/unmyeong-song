# Story Auth/RLS 디버그 — "로그인이 필요해요" 문제

## 1. 재현 절차
1. 로그인 상태에서 앱 진입
2. Story 탭 → "사연 쓰기" 진입
3. 제목/내용 입력 후 "제출" 클릭
4. **관측**: "로그인이 필요해요" 메시지 표시 (제출 실패)

## 2. 진단 결과

### (A) 코드 분석 — 세션/토큰 전달
- `app/(tabs)/story/write.tsx`:
  - `submitStory({ title, body, clientRequestId })` 호출
  - **accessToken을 전달하지 않음**
  - 세션 동기화(useEffect getSession) 없음
- `src/services/storySubmit.ts`: 파일 미존재 (import 실패 시 createStory 경로 사용)
- `features/story/api/mutations.ts` createStory:
  - `accessToken` 없으면 즉시 `AUTH_REQUIRED` 반환 ("로그인이 필요해요")
  - RPC 호출 시 `Authorization: Bearer ${input.accessToken}` 필수

### (B) 원인 결론
**P0. 프론트에서 accessToken 미전달**
- (tabs)/story/write가 submitStory 호출 시 accessToken을 넘기지 않음
- storySubmit 설계상 supabase.rpc()에 의존하면 클라이언트 세션이 자동 붙으나, 토큰을 명시하지 않으면 세션 복원 지연/레이스 시 auth.uid() = null → AUTH_REQUIRED

### (C) RLS/DB 확인 (참고)
- `submit_story_rate_limited` RPC: `grant execute to authenticated` only
- `auth.uid()` null 시 `raise exception 'AUTH_REQUIRED'`
- stories insert: RPC 내부에서 처리, author_id = auth.uid() 자동 설정

## 3. 수정 요약
- `app/(tabs)/story/write.tsx`:
  1. `submitStory`(storySubmit) → `createStory`(features/story/api/mutations) 교체 + accessToken 명시 전달
  2. 세션 동기화: useEffect(getSession + onAuthStateChange) → accessToken state
  3. 제출 직전 accessToken 확인, 없으면 "세션이 만료되었어요. 다시 로그인 해주세요." (SESSION_EXPIRED_MSG)
  4. AUTH_REQUIRED 응답 시 SESSION_EXPIRED_MSG로 표시
  5. 세션 로딩 중 버튼 disabled + "세션 확인 중..." 라벨, 레이스 컨디션 방지
- `features/story/api/mutations.ts`:
  - extractStoryId: RPC 응답 `story_id` (snake_case) 파싱 추가 (submit_story_rate_limited 반환 형식)

## 4. 검증 체크리스트
- [ ] 로그인 직후 사연 작성 1건 저장 성공
- [ ] 앱 재시작 후에도 로그인 유지된 상태에서 저장 성공
- [ ] 저장 직후 My 탭에 내 사연이 보임 (기능 별도 확인)
- [ ] Story 탭 공개 리스트에는 pending이 안 보임 (정책 별도 확인)
- [ ] 로그아웃 상태에서는 write 진입 차단 + 안내 메시지 정상
