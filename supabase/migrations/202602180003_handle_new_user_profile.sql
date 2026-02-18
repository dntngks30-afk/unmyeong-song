-- HOTFIX-STORY-AUTH: 사연 작성 "권한이 없습니다" (FORBIDDEN_ROLE) 해결
-- 원인: submit_story_rate_limited RPC에서 current_role(v_uid) is null → profiles 누락
-- 해결: auth.users INSERT 시 프로필 자동 생성 + 기존 auth 사용자 보완

-- 1) handle_new_user: 신규 가입 시 기본 프로필(role=viewer) 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, role, created_at, updated_at)
  values (
    new.id,
    'viewer'::public.user_role,
    now(),
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2) 기존 auth.users 중 프로필 없는 사용자 보완 (current_role null 방지)
insert into public.profiles (id, role, created_at, updated_at)
select
  u.id,
  'viewer'::public.user_role,
  coalesce(u.created_at, now()),
  now()
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
