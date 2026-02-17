# PR-BE-02-STORIES QA Checklist

## 회귀/재현 체크

- [ ] [1] 로그인 상태에서 사연 제출 3회(앱 재시작 포함) 시 `로그인이 필요해요` 오탐 0회
- [ ] [2] Supabase `public.stories`에 row 생성 확인 (`user_id`, `title`, `content`, `created_at`)
- [ ] [3] 마이 탭에서 `내가 쓴 사연` 목록 즉시 조회(재진입 포함)
- [ ] [4] 로그아웃 상태에서 사연 제출 시 로그인 유도 동작 확인

## 추가 점검

- [ ] stories RLS: insert/update/delete는 본인만 가능
- [ ] stories select는 authenticated 컨텍스트에서 동작
- [ ] 스토리 작성 화면에서 세션 로딩 중에는 제출 버튼 비활성화
