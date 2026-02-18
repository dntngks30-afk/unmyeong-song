-- PR-NEXT-03 A: 승인한 사연이 공개 목록에 즉시 노출되도록 정합
-- best_stories_v에 story_status='approved' 조건 추가 (공개 노출은 승인된 사연만)

create or replace view public.best_stories_v as
select
  s.id,
  s.title,
  s.body,
  s.created_at,
  s.author_id,
  public.get_story_vote_count(s.id) as vote_count
from public.stories s
where s.is_blocked = false
  and s.story_status = 'approved'::public.story_status
order by vote_count desc, s.created_at desc;
