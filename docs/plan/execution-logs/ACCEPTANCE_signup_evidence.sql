-- Acceptance evidence for musician signup (paste results into PR)
-- Precondition: Supabase Auth -> Email -> "Confirm email" = OFF

-- 1) musician_applications: sample_song_audio_path must be NOT NULL for file upload case
select id, status, sample_song_audio_path
from musician_applications
order by created_at desc
limit 3;

-- 2) storage.objects: uploaded mp3 must appear in song-audio bucket
select bucket_id, name
from storage.objects
where bucket_id = 'song-audio'
order by created_at desc
limit 3;
