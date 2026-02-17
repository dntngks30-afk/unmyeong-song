# 프론트엔드 진행 기록

## FE-PR0: 4탭 + 공통 UI 컴포넌트 (2025-02-16)

### 변경 파일
- `app/(tabs)/_layout.tsx` (수정)
- `app/(tabs)/home.tsx` (수정)
- `app/(tabs)/stories.tsx` (신규)
- `app/(tabs)/show.tsx` (수정)
- `app/(tabs)/my.tsx` (수정)
- `app/(tabs)/story.tsx` (삭제)
- `src/components/ui/Screen.tsx` (신규)
- `src/components/ui/Card.tsx` (신규)
- `src/components/ui/PrimaryButton.tsx` (신규)

### 구현 요약
- expo-router Tabs로 홈/사연/쇼/마이 4탭 구조 확정, 하단 탭바 항상 노출
- Screen(다크+별패턴+TopBar), Card, PrimaryButton 공통 컴포넌트 생성
- 4탭 더미 화면을 동일 톤(다크 배경·라운드 카드·파란 CTA)으로 렌더

### 확인 방법
- `npx expo start -c` 실행 후 탭 이동 시 하단 4탭 고정
- 스크롤 시 탭바·하단 CTA 레이아웃 유지
- 홈/사연/쇼/마이 화면에서 공통 UI 일관 노출

### 남은 TODO
1. 상세 화면(사연/쇼) 스택 라우트 연동
2. API/DB 연동 복원(홈·사연·쇼·마이)
3. 사연 쓰기 /story/write 경로와 탭 통합

---

## FE-PR1: 홈 화면 디테일 + 탭 이동 (2025-02-16)

### 변경 파일
- `app/(tabs)/home.tsx` (수정)

### 구현 요약
- TopBar "무명의 노래" / "사연이, 노래가 되는 곳" 적용, 섹션1(이번 주 결선 쇼+전체보기>+가로카드3), 섹션2(사연보내기)
- "전체 보기 >" 및 결선 카드 터치 → Show 탭(/(tabs)/show) 이동
- 하단 CTA "사연 쓰기" → Stories 탭(/(tabs)/stories) 이동

### 확인 방법
- 홈에서 "전체 보기 >" 터치 시 쇼 탭으로 전환
- 결선 카드(#1/#2/#3) 터치 시 쇼 탭으로 전환
- 하단 "사연 쓰기" 버튼 터치 시 사연 탭으로 전환, 하단 4탭 유지

### 남은 TODO
1. 상세 화면(사연/쇼) 스택 라우트 연동
2. API/DB 연동 복원(홈·사연·쇼·마이)
3. FE-PR3: 사연쓰기 실제 화면 붙이기

---

## FE-PR2: Show 탭 TOP10 리스트 (2025-02-16)

### 변경 파일
- `app/(tabs)/show.tsx` (수정)

### 구현 요약
- 상단 "이번 주 결선", 섹션 "TOP 10", 서브카피 "공개된 노래를 듣고 하루 1번 응원할 수 있어요." 구성
- 10개 더미 아이템: 좌측 랭크/중앙 타이틀·아티스트·응원수/우측 ▶ 플레이 느낌, 터치 시 선택 하이라이트
- ScrollView + 하단 padding, onPress 핸들러 유지(향후 상세 연동 대비)

### 확인 방법
- Show 탭 진입 시 "이번 주 결선"·TOP10 리스트 UI 노출
- 리스트 스크롤·아이템 터치(선택 하이라이트) 정상 동작
- 하단 4탭 유지, 탭바와 겹치지 않음

### 남은 TODO
1. Show 상세/재생 화면 스택 연동
2. API/DB 연동 복원
3. FE-PR3: 사연쓰기 실제 화면 붙이기

---

## FE-PR2A: 리스트→상세 라우팅, 탭 유지 (2025-02-16)

### 변경 파일
- `app/(tabs)/_layout.tsx` (수정: stories→story)
- `app/(tabs)/show/` (_layout, index, [trackId]) (신규)
- `app/(tabs)/story/` (_layout, index, [storyId]) (신규)
- `app/(tabs)/show.tsx`, `stories.tsx` (삭제)
- `app/(tabs)/home.tsx` (수정: /stories→/story 경로)

### 구현 요약
- Show/Story 탭을 폴더 기반(Stack)으로 전환, 리스트→상세 push 라우팅 추가
- /(tabs)/show/[trackId], /(tabs)/story/[storyId] 상세 더미 화면, 탭 유지
- home 사연 쓰기 CTA 경로를 /story로 수정

### 확인 방법
- Show 탭 TOP10 아이템 터치 → 상세 진입, 탭바 유지
- Story 탭 리스트 아이템 터치 → 상세 진입(댓글 없음 문구), 탭바 유지
- 무한루프/깜빡임 없음

### 남은 TODO
1. Show/Story 상세 실제 API/데이터 연동
2. 상세 화면 백 버튼(헤더) 필요 시 추가
3. FE-PR3: 사연쓰기 실제 화면 붙이기

---

## FE-PR2B: /story/write (tabs) 내부 구현, 탭 유지 (2025-02-16)

### 변경 파일
- `app/(tabs)/story/write.tsx` (신규)
- `app/(tabs)/home.tsx` (수정: CTA → /story/write)
- `app/(tabs)/story/index.tsx` (수정: CTA → /story/write)

### 구현 요약
- /story/write 스켈레톤: 제목/내용 플레이스홀더 카드, 제출 버튼 disabled, PII/익명 문구 포함
- 홈·story 탭 "사연 쓰기" CTA → /story/write 진입, 탭 유지
- write 화면 "← 뒤로" → router.back()로 story/index 복귀

### 확인 방법
- 홈 "사연 쓰기" 버튼 → /story/write 진입, 탭바 유지
- story 탭 "사연 쓰기" 버튼 → /story/write 진입, 탭바 유지
- write "← 뒤로" 터치 → story 목록으로 복귀

### 남은 TODO
1. 사연 쓰기 실제 입력/제출 연동
2. Show/Story 상세 API 연동
3. FE-PR3: 기타 UI 확장

---

## FE-PR2C: Show TOP10 데이터 연동 복원 (2025-02-16)

### 변경 파일
- `app/(tabs)/show/index.tsx` (수정)
- `app/(tabs)/home.tsx` (수정)

### 구현 요약
- Show TOP10: getTop10Tracks(final_tracks_public_v) 연동, 로딩/에러/빈상태 UI, 에러 시 SUPABASE ref 진단 1줄
- 홈 결선 카드: TOP3 실데이터 반영(성공 시), 실패 시 더미 유지 + TODO 표시
- stories/my: 미수정(백엔드 미확정, 런타임 에러 없음)

### 확인 방법
- Show 탭: DB에 top10 데이터 시 실데이터 렌더, 없으면 빈상태, 에러 시 진단 UI+다시시도
- 홈: API 성공 시 결선 카드 TOP3 실데이터, 실패 시 더미
- endless loading 없음

### 남은 TODO
1. stories/my API 연동(stories RPC·my entitlement 확정 후)
2. Show 응원수(votes) 연동
3. FE-PR3: 기타 UI 확장

---

## FE-PR3: 사연 쓰기 UI 완성 (2025-02-16)

### 변경 파일
- `app/(tabs)/story/write.tsx` (수정)
- `src/components/ui/Screen.tsx` (수정: onBackPress 지원)

### 구현 요약
- 사연 쓰기: 제목/내용(200~2000자)/이메일(선택), 글자수 카운트, 체크박스 2개, 로컬 검증
- 제출 버튼: 검증 통과 시에만 활성, onPress 시 Alert "제출 준비중(다음 PR에서 RPC 연동)"
- KeyboardAvoidingView + ScrollView, TopBar 뒤로가기(←)

### 확인 방법
- 제목 2자/내용 200자/체크 2개 충족 시 제출 버튼 활성화
- 제출 터치 → Alert "제출 준비중" 노출
- 키보드 노출 시 하단 버튼 가려지지 않음, 탭 유지

### 남은 TODO
1. submit_story RPC 연동
2. PII 필터링 서버측
3. 작성 성공 후 라우팅

---

## FE-PR4: 결선 쇼 상세 UI (2025-02-16)

### 변경 파일
- `app/(tabs)/show/[trackId].tsx` (수정)

### 구현 요약
- 결선 상세: TopBar 뒤로가기, 커버 플레이스홀더/곡정보, 미니플레이어(더미), 사연한줄·메이킹노트 카드
- 하단 "응원하기(오늘 1회)" CTA, onPress 시 Alert "투표 기능 준비중", 안내 "남은 응원: 0/1 · 마감: 01:22:45"
- ScrollView + PrimaryButton, SafeArea, 탭 유지

### 확인 방법
- Show 리스트에서 아이템 터치 → 상세 진입, 뒤로가기 정상
- 상세 UI(커버/플레이어/사연/메이킹/응원 버튼) 노출, 응원 터치 → Alert
- 하단 4탭 유지, 크래시/무한렌더 없음

### 남은 TODO
- [필수-백엔드] signed URL 재생 연동
- [필수-백엔드] 투표 RPC 연동(1인 n표/중복 방지)
- [필수-UX] 로딩/에러/빈 상태(실데이터 전환)

---

## FE-PR5C: Show 응원수(votes) 실데이터 표시 (2025-02-16)

### 변경 파일
- `app/(tabs)/show/index.tsx` (수정)
- `app/(tabs)/show/[trackId].tsx` (수정)
- `src/services/show.ts` (신규)

### 구현 요약
- getShowTracks: final_tracks_public_v에 vote_count 있으면 사용, 없으면 getTop10Tracks fallback + 0
- 리스트/상세: formatCheerDisplay(voteCount)로 "응원 1,234" 포맷, 없으면 0
- endless loading 금지, 에러 시 fallback 처리

### 확인 방법
- Show 리스트/상세에서 응원수 표시 (DB에 vote_count 컬럼 시 실값, 없으면 0)
- vote_count 없는 뷰에서도 리스트 로딩·표시 정상
- 로딩 후 멈춤 없음

### 남은 TODO
1. final_tracks_public_v에 vote_count 컬럼 마이그레이션 추가
2. 투표 RPC 연동(표시만 완료)
3. 상세 단일 조회 최적화(선택)

---

## FE-PR5A: Story 목록/상세 실데이터 조회 (2025-02-16)

### 변경 파일
- `app/(tabs)/story/index.tsx` (수정)
- `app/(tabs)/story/[storyId].tsx` (수정)
- `src/services/stories.ts` (신규)

### 구현 요약
- listStories/getStory: stories 테이블 REST 연동, limit 기반 목록·상세 1건
- 목록: loading/ready/empty/error, 상세: loading/ready/not_found/error, 에러 시 "준비중" 표시
- 상세에 "댓글 기능은 준비 중입니다." 포함, 무한로딩·크래시 없음

### 확인 방법
- Story 탭: 데이터 있으면 목록 렌더, 없으면 빈상태, API 실패 시 "준비중"
- 상세: 정상 조회 시 내용 표시, not_found/error 시 안전 메시지
- 크래시/무한로딩 없음

### 남은 TODO
1. submit_story RPC 연동(쓰기)
2. cast_story_vote_max1 연동
3. 페이지네이션(MVP 제외)

---

## FE-PR5B: My 탭 API 기반 구조 (2025-02-16)

### 변경 파일
- `app/(tabs)/my.tsx` (수정)
- `src/services/my.ts` (신규)

### 구현 요약
- getMySummary/getMyEntitlement: 내 사연/제출곡/투표 카운트, entitlement 조회
- 스키마 미확정/실패 시 null, UI는 "준비중(스키마 확정 후 연동)" 표시
- 로그인 상태에서 크래시/무한로딩 없음

### 확인 방법
- My 탭 진입 시 카드 4개(내 사연/제출곡/투표/entitlement) 표시
- API 성공 시 N건/status, 실패 시 "준비중" 표시
- 로그인 상태에서 화면 깨짐 없음

### 남은 TODO
1. stories user_id/author_id 스키마 통일 후 반영
2. entitlement UI gating
3. 내 사연/제출곡 목록 화면 연동

---

## FE-PR5D: /story/write UI 폴리시 (2025-02-16)

### 변경 파일
- `app/(tabs)/story/write.tsx` (수정)

### 구현 요약
- 제출 후 Alert "준비중" 확인 시 입력 초기화 + router.replace("/(tabs)/story")로 탭 유지 복귀
- KeyboardAvoidingView padding/offset 조정, 하단 CTA 키보드 시 접근 가능
- 에러 안내 1줄(버튼 위 스크롤 영역), 실시간 글자수 유지

### 확인 방법
- 키보드 노출 시 스크롤로 CTA 접근 가능
- 제출 → "준비중" Alert 확인 → 입력 초기화 + story 탭 복귀
- 탭 유지, 크래시 없음

### 남은 TODO
1. submit_story_rate_limited RPC 연동
2. 제출 성공 시 상세 화면 라우팅
3. 이메일/제목 최대 길이 제한

---

## FE-PR5E: /story/write 제목·이메일 최대 길이 (2025-02-16)

### 변경 파일
- `app/(tabs)/story/write.tsx` (수정)

### 구현 요약
- TITLE_MAX 60, EMAIL_MAX 254, BODY_MAX 2000 상수, maxLength + onChangeText clamp 강제
- UI 카운트: 제목 12/60, 이메일 20/254, 내용 기존 유지
- 제출 활성 조건에 길이 초과 반영, 에러 안내 문구 업데이트

### 확인 방법
- 제목 60자 초과 입력 시 차단, 카운트 표시
- 이메일 254자 초과 시 차단, 카운트 표시
- 길이 초과 시 제출 버튼 비활성

### 남은 TODO
1. submit_story_rate_limited RPC 연동
2. 제출 성공 라우팅
3. 서버측 길이 검증

---

## FE-PR5F: /story/write RPC 연동 (2025-02-16)

### 변경 파일
- `app/(tabs)/story/write.tsx` (수정)
- `src/services/storySubmit.ts` (신규)

### 구현 요약
- 제출 버튼을 `submit_story_rate_limited` RPC에 연결 (supabase.rpc)
- 제출 중: 버튼 disabled + 스피너 + "제출 중..." 텍스트
- 성공: "제출이 완료됐어요" 메시지 + storyId 상태 저장, "다음: 상세 보기 (준비중)" placeholder (라우팅 없음)
- 실패: RATE_LIMITED → "잠시 후 다시 시도", CONTENT_BLOCKED → PII 안내, 기타 → userMessage
- payload 콘솔 출력 금지

### 확인 방법
- 로그인 후 사연 작성 → 제출 → 성공 시 "제출 완료" 카드 표시
- 연속 제출 시 레이트리밋 메시지
- PII 포함 시 CONTENT_BLOCKED 메시지

### 남은 TODO
1. 제출 성공 시 상세 화면 라우팅
2. 서버측 길이 검증
3. "다음: 상세 보기" 버튼 활성화

---

## FE-PR5G: 제출 성공 시 상세 라우팅·초기화 (2025-02-16)

### 변경 파일
- `app/(tabs)/story/write.tsx` (수정)
- `app/(tabs)/story/[storyId].tsx` (수정)

### 구현 요약
- 성공 시 router.replace(`/(tabs)/story/${storyId}?fromSubmit=1`)로 상세 화면 진입
- 라우팅 전 resetForm + errorMessage 클리어, submittedStoryId 제거(성공 카드 UI 삭제)
- 상세 화면: fromSubmit=1일 때 "제출된 사연입니다" 배너 1줄 표시, 댓글 없음 문구 유지

### 확인 방법
- 사연 작성 → 제출 성공 → 상세 화면 진입, "제출된 사연입니다" 배너 표시
- 상세에서 뒤로가기 → story index로 자연스럽게 복귀
- 다시 사연 쓰기 진입 시 빈 폼, 중복 제출 없음

### 남은 TODO
1. 서버측 길이 검증
2. "다음: 상세 보기" 버튼 활성화(이미 라우팅으로 대체)
3. 목록 갱신(refetch on focus 등)

---

## FE-PR6: Show 실오디오 재생 (2025-02-16)

### 변경 파일
- `app/(tabs)/show/index.tsx` (수정)
- `app/(tabs)/show/[trackId].tsx` (수정)
- `src/services/audio.ts` (신규)
- `src/hooks/useAudioPlayer.ts` (신규)

### 구현 요약
- getPlayableAudioUrl: POST /functions/v1/get-track-play-url { finalTrackId }, 1회 재시도, 만료/에러 시 사용자 메시지
- useAudioPlayer: expo-av 싱글톤, 트랙 전환 시 unload, play/pause/진행바/시간(mm:ss)
- 리스트: ▶ 클릭 재생, 재생중 카드 하이라이트
- 상세: 미니플레이어 play/pause 토글, position 기반 진행바, 에러 시 "다시 시도"

### 확인 시나리오
- Show 리스트에서 ▶ → signed URL 발급 후 재생, 재생중 카드 하이라이트
- 상세 화면 미니플레이어 play/pause/진행바/시간 동작
- 다른 트랙 재생 시 이전 사운드 정리, endless loading 없음

### 남은 TODO
1. [필수-백엔드] 투표 RPC 연동(1인 3표/중복 방지)
2. [필수-UX] 재생 백그라운드/인터럽트(전화/잠금화면) 정책 결정
3. [선택-개선] 리스트 하단 미니플레이어(전역 플레이어)로 통합

---

## HOTFIX-FE-ICON: 탭바 아이콘 X 표시 수정 (2025-02-16)

### 변경 파일
- `app/(tabs)/_layout.tsx` (수정)

### 문제 원인(추정)
- 탭 아이콘 이미지 소스(require 경로) 누락 또는 잘못된 경로로 X(깨진 이미지) 표시

### 해결 방식
- tabBarIcon을 Text 기반 이모지(🏠 📝 🎵 👤)로 교체, focused 시 opacity/굵기 반영

### 확인 시나리오
- iOS/Android 모두 하단 탭바 아이콘 정상 표시
- 탭 전환 시 활성 탭 하이라이트(opacity/굵기) 적용
- 앱 번들에 이미지 의존 없이 동작

---

## HOTFIX-FE-UI: 홈 체크박스 제거·사연 탭 CTA 축소 (2025-02-16)

### 변경 파일
- `app/(tabs)/home.tsx` (수정)
- `app/(tabs)/story/index.tsx` (수정)

### 구현 요약
- 홈: "사연 보내기" 카드 섹션 제거, "사연 쓰기" PrimaryButton CTA 유지
- 사연 탭: PrimaryButton → 작은 CTA 바(높이 46px, 폭 80%)로 교체, 탭바 바로 위(bottom 12) 고정 배치
- ScrollView paddingBottom 조정으로 스크롤 콘텐츠가 CTA에 가려지지 않도록 처리

### 확인 시나리오
- 홈에서 "사연 보내기" 카드 없음, "사연 쓰기" 버튼만 노출
- 사연 탭 CTA가 작은 바 형태로 탭바 바로 위에 고정
- 스크롤 시 마지막 사연이 CTA에 가리지 않음

### 남은 TODO
1. useBottomTabBarHeight 도입 검토(탭바 높이 동적 반영)
2. CTA 터치 영역/접근성 개선
3. SafeArea 기기별 미세 조정

---

## FE-PR7: Show 응원하기 투표 RPC 연동 (2025-02-16)

### 변경 파일
- `app/(tabs)/show/[trackId].tsx` (수정)
- `src/services/votes.ts` (신규)

### 구현 요약
- voteTrack: cast_votes_max3 RPC 호출, remaining_votes 반환, DUPLICATE_VOTE/VOTE_LIMIT_EXCEEDED 코드 처리
- 응원하기 버튼: disabled+로딩 중복탭 방지, 성공 시 remaining 갱신·"응원 완료", 중복 "이미 응원했어요", 제한초과 "오늘 응원권을 모두 사용했어요"
- "남은 응원: X/3" 표시(remaining 확보 시), 미확보 시 "—"

### 확인 시나리오
- 응원하기 → 성공 시 "응원 완료", 남은 응원 갱신, 버튼 "응원함"으로 비활성
- 이미 응원한 곡 재클릭 또는 중복 → "이미 응원했어요"
- 3표 사용 후 → "오늘 응원권을 모두 사용했어요", 버튼 비활성

### 남은 TODO
1. FE-PR8: 재생 백그라운드/인터럽트 정책 적용
2. FE-PR9: 리스트 하단 미니플레이어 통합 (선택)
3. 마감 타이머 실제 데이터 연동

---

<!-- 이후 PR은 아래에 append -->
