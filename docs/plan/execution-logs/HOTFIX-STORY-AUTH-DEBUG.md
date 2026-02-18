# HOTFIX-STORY-AUTH+HIDE-DEBUG 실행 로그

## 목표
1. 사연쓰기 제출 시 "권한이 없습니다" (401/403) 완전 해결
2. DebugPanel 배포/일반 사용자에게 비노출

---

## (1) "권한이 없습니다" 원인 확정

### 증거 A: 에러 메시지 위치
- `src/lib/errors.ts` → `FORBIDDEN_ROLE: "권한이 없습니다."`
- `toAppError()`가 RPC 응답의 code/message를 `FORBIDDEN_ROLE`로 매핑

### 증거 B: 발생 지점 (코드)
- `supabase/migrations/202602160007_1_stories_rpc.sql` 42-44행:
```sql
if public.current_role(v_uid) is null then
  raise exception 'FORBIDDEN_ROLE' using errcode = 'P0001';
end if;
```
- `current_role(v_uid)` = `profiles.role` (profiles.id = v_uid)
- **원인**: `profiles`에 해당 사용자 행이 없으면 `current_role`이 null → `FORBIDDEN_ROLE`

### 증거 C: Authorization 헤더
- `features/story/api/mutations.ts` 86-91행:
  - `Authorization: Bearer ${input.accessToken}` 포함
  - `apikey`, `Content-Type` 설정됨
- `write.tsx`에서 `accessToken` 있을 때만 `canSubmit` true → 토큰 누락 시 클라이언트에서 차단

### 결론
- **401/403의 직접 원인**: Authorization 누락이 아님.
- **실제 원인**: `profiles` 테이블에 행이 없어 `current_role(v_uid)`가 null.

---

## (2) 적용한 수정

### A. 마이그레이션 `202602180003_handle_new_user_profile.sql`
1. **`handle_new_user` 트리거**: `auth.users` INSERT 시 `profiles`에 기본 행(role=viewer) 자동 생성
2. **보완 INSERT**: `auth.users`에 있지만 `profiles`에 없는 사용자에게 기본 프로필(row) 추가

### B. createStory 증거 로깅 (`__DEV__`만)
- 요청 직전: `hasAccessToken`, `tokenLen`, `url`, `hasAuthHeader`
- 401/403 응답 시: `status`, `body`, `hasToken`

### C. write.tsx
- DebugPanel: `{__DEV__ ? <Card>...</Card> : null}`로 감싸 일반 사용자 비노출
- `FORBIDDEN_ROLE` 전용 메시지: `"프로필 설정이 완료되지 않았을 수 있어요. 로그아웃 후 다시 로그인해 주세요."`

---

## (3) 검증 절차

1. **마이그레이션 실행**
   ```bash
   supabase db push
   # 또는 supabase migration up
   ```

2. **사연쓰기 제출**
   - 제목 2자+, 내용 10자+, 약관 2개 체크 후 제출
   - "권한이 없습니다" 미발생 확인
   - 제출 성공 후 Alert → 홈 이동 확인

3. **디버그 로그 (개발 모드)**
   - 제출 시 `[createStory] 요청 직전` 로그 확인
   - 401/403 시 `[createStory] 권한 에러 응답` 로그 확인

4. **DebugPanel**
   - 릴리즈 빌드에서 DebugPanel 미노출 확인

---

## (4) INSERT 성공 확인

마이그레이션 적용 후:
```sql
-- profiles 보완 결과 확인
select count(*) from public.profiles;
select count(*) from auth.users;
-- profiles 수 >= auth.users 수 (신규 가입은 트리거로 자동 생성)
```

제출 성공 시 `createStory` 응답에 `story_id` 포함 → `stories` 테이블에 행 존재 확인.
