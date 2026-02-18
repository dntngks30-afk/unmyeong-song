-- Sample Pipeline DB Audit (PR description용)
-- Supabase SQL Editor에서 실행 후 결과를 PR에 붙여넣기

-- 1) musician_applications 컬럼 확인
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'musician_applications'
order by ordinal_position;

-- 2) 최근 신청 10건 (sample_song_audio_path 확인)
select id, user_id, status, sample_song_audio_path, sample_song_url, created_at
from public.musician_applications
order by created_at desc
limit 10;
